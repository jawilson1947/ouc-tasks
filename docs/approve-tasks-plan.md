# Implementation Plan — Task Approval Feature

**Target:** `ouc-tasks` (Next.js App Router · TypeScript · Tailwind · Supabase)
**Date drafted:** 2026-05-19
**Author:** Jim Wilson

---

## 1. Summary

Adds a task-approval workflow to OUC Tasks. A new `approver` role gains a dedicated "Approve Tasks" sidebar item that lists all non-Done tasks ordered by priority (high → low). The approver can view, edit, delete, approve, and **revoke approval of** any task that is not yet Done; every action emails the assignee. Approval is **permission for the assignee to start work** — it does **not** change a task's status to Done. A visual badge distinguishes Approved vs. Unapproved tasks across the app, and existing Done tasks are backfilled as approved (and locked).

### Design decisions (confirmed)

| Decision | Choice |
|---|---|
| Permission model | New `approver` role added to `user_role` enum |
| Approval data | New `task.approved_at` (timestamptz) + `task.approved_by` (uuid → user_profile) columns |
| Backfill of Done tasks | Migration sets `approved_at = now()` and `approved_by` to a designated system admin |
| Approval semantics | Approval = permission to start work. Approval never auto-changes `status`. |
| Revocation | Allowed **only while `status = 'not_started'`**. Once work has begun (`in_progress`, `blocked`, or `done`), approval is locked and cannot be revoked. |
| Enforcement of "approved before work" | None — work may proceed even on an unapproved task. The badge is advisory only. |
| In-app notifications | Email only for v1. A notification bell may be added later but is out of scope now. |
| Email delivery | SendGrid HTTPS API. `SENDGRID_API_KEY` lives in `.env.local`; no new SaaS dependency beyond the existing transactional email slot. |

---

## 2. Data model changes

### 2.1 New migration: `supabase/migrations/0006_task_approval.sql`

Run in two parts (Postgres requires `ALTER TYPE ... ADD VALUE` to commit before the new value is usable — same pattern as `0002_simplify_roles.sql`).

**PART 1 — enum extension**

```sql
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'approver';
```

**PART 2 — schema, RLS, backfill**

1. Add columns to `task`:
   - `approved_at  timestamptz`
   - `approved_by  uuid references user_profile(id)`
   - Index: `create index task_approved_at_idx on task(approved_at) where approved_at is not null;`
2. Add a helper function `current_user_role()` already exists per `0002`; extend `task` policies:
   - `task_approver_all` policy allowing `current_user_role() = 'approver'` to `SELECT`, `UPDATE`, `DELETE` on any task (approvers act on everyone's tasks; that's the whole point).
   - Keep existing `task_admin_all`, `task_select_anyone`, and editor policies untouched.
3. Refresh the `task_with_totals` view (see `0004`) to add the two new columns.
4. **Backfill** — pick the first admin as the system approver, then mark all currently-Done tasks as approved:

   ```sql
   with sys as (
     select id from user_profile
      where role = 'admin'
        and active
      order by created_at asc
      limit 1
   )
   update task
      set approved_at = coalesce(completed_at, now()),
          approved_by = (select id from sys)
    where status = 'done'
      and approved_at is null;
   ```

5. Mirror `subtask`, `attachment`, `comment` policy patterns: add an `_approver_all` policy on each so approvers can edit a task's children too (drag-from-`0002` pattern).

### 2.2 TypeScript types

Update `src/lib/supabase/types.ts` (or the closest equivalent generated types file) to add:

- `'approver'` to the `user_role` union
- `approved_at: string | null` and `approved_by: string | null` to the `task` and `task_with_totals` rows

---

## 3. Permission helpers

Add a single source of truth so we never hand-check the role string in multiple places.

### 3.1 `src/lib/permissions.ts` (new)

```ts
import { createClient } from '@/lib/supabase/server';

export type AppRole = 'admin' | 'editor' | 'approver' | 'viewer';

export async function getCurrentRole(): Promise<AppRole | null> { ... }

export function canApproveTasks(role: AppRole | null): boolean {
  return role === 'approver' || role === 'admin';
}
```

Rationale: admins implicitly inherit approver power, which matches the RLS (admin-all). The sidebar uses `canApproveTasks(role)` to enable the new menu item.

---

## 4. Sidebar — new menu item

Edit `src/components/Sidebar.tsx`:

1. The `NAV` constant is currently a static array. Change `Sidebar` props to also accept `canApprove: boolean` (passed down from the layout, which already loads the profile/role).
2. Insert a new entry after "My Tasks":

   ```ts
   { href: '/approvals', label: 'Approve Tasks', icon: '✅', requires: 'approver' }
   ```

3. Render the link with disabled styling when `!canApprove`:
   - `aria-disabled="true"`, `tabIndex={-1}`, click guarded with `e.preventDefault()`
   - Tailwind: `opacity-40 cursor-not-allowed pointer-events-none`
   - Title tooltip: "Requires Task Approval permission"

4. In `src/app/(app)/layout.tsx`, pass `canApprove={canApproveTasks(profile?.role ?? null)}` into `<Sidebar />`.

---

## 5. The Approve Tasks page

### 5.1 Route — `src/app/(app)/approvals/page.tsx` (new, server component)

Mirrors the structure of `tasks/page.tsx`:

1. Server-side guard at the top:

   ```ts
   const role = await getCurrentRole();
   if (!canApproveTasks(role)) redirect('/dashboard?error=Not+authorized');
   ```

2. Query `task_with_totals` filtered to non-Done, ordered by priority desc, then due_date asc:

   ```ts
   .neq('status', 'done')
   .order('priority', { ascending: false })
   .order('due_date',  { ascending: true, nullsFirst: false })
   ```

3. Render the same `<table>` layout as `/tasks` with two additional columns:
   - **Approval** — shows `<ApprovedBadge approved={t.approved_at != null} />`
   - **Action** — a single primary button "Review" → links to `/approvals/[legacyId]`

   No search box, no chip filters — the approver wants everything in priority order on one page. (If the queue gets unwieldy later, add a `?priority=` chip row; out of scope for v1.)

### 5.2 Review page — `src/app/(app)/approvals/[legacyId]/page.tsx` (new)

Reuses the existing task detail components (`TaskForm`, `TaskPhotosCard`, `TaskReceiptsCard`, `SubtaskEditor`) inside an "Approver view" wrapper. Four things change versus the existing edit page:

1. **Header chrome** — adds an Approval status banner at the top showing current approved/unapproved state and approver name + timestamp if approved.
2. **Approve button** — primary CTA that fires `approveTask(taskId)` (see §6). Visible when `approved_at IS NULL`. Helper text: *"Approving permits the assignee to begin work. Status is not changed."*
3. **Revoke Approval button** — secondary CTA that fires `revokeApproval(taskId)`. Visible when `approved_at IS NOT NULL` **and** `status = 'not_started'`. Hidden (and the server action refuses) the moment status moves to `in_progress`, `blocked`, or `done` — at that point approval is locked. Confirmation prompt: *"Revoking approval will cancel the assignee's permission to start work. Continue?"*
4. **Delete button** — already exists for admin/editor on their own tasks; surface it here for the approver too.

All buttons live in a sticky footer bar so the approver doesn't have to scroll up after editing.

---

## 6. Server actions — `src/app/(app)/approvals/actions.ts` (new)

Four actions, all gated on `canApproveTasks(role)`:

| Action | Purpose | Status side-effects | Emails assignee? |
|---|---|---|---|
| `approveTask(formData)` | Sets `approved_at = now()`, `approved_by = userId`. | None — `status` is intentionally left untouched. Approval is permission to begin work, not completion. | Yes — "Your task was approved — you may begin work" |
| `revokeApproval(formData)` | Sets `approved_at = NULL`, `approved_by = NULL`. **Refuses unless `status = 'not_started'`** (returns a form error; once work has begun, approval is locked). | None | Yes — "Approval revoked for your task — please do not begin work" |
| `updateTaskAsApprover(formData)` | Same payload as `tasks/actions.ts#updateTask` but bypasses the "must be creator" check (RLS allows it for approvers). | None | Yes — "An approver updated your task" with a diff summary |
| `deleteTaskAsApprover(formData)` | Hard delete. | n/a | Yes — "An approver deleted your task" |

Each action:

1. Validates input (reuse `readForm`/`validate` from `tasks/actions.ts` — extract to `src/app/(app)/tasks/form-helpers.ts` and import from both).
2. For `revokeApproval`: re-fetches `status` server-side and aborts with a form error unless `status = 'not_started'`. The button is also hidden client-side (§5.2) but the server check is the source of truth.
3. Performs the DB write.
4. Calls `sendApprovalEmail(...)` (see §7).
5. Calls `revalidatePath('/approvals')`, `revalidatePath('/tasks')`, `revalidatePath('/dashboard')`, `revalidatePath('/board')`.
6. Redirects back to `/approvals` with a flash query param (`?approved=1`, `?revoked=1`, `?updated=1`, `?deleted=1`).

---

## 7. Email pipeline — SendGrid

### 7.1 Environment variables

The existing `.env.example` already has a transactional-email block. Update it to SendGrid:

```
# ---- Transactional email (SendGrid) ----
SENDGRID_API_KEY=SG.YOUR_KEY
EMAIL_FROM="OUC Tasks <noreply@oucsda.org>"
EMAIL_REPLY_TO="tasks-admin@oucsda.org"   # optional
```

`SENDGRID_API_KEY` is server-side only (no `NEXT_PUBLIC_` prefix). The sender domain (`oucsda.org`) needs to be **verified in the SendGrid dashboard** (Sender Authentication → Domain Authentication) before mail will deliver. Jim's noted he'll add the key to `.env.local` directly.

Remove the legacy `RESEND_API_KEY` line from `.env.example` to avoid confusion.

### 7.2 SendGrid wrapper — `src/lib/email/sendgrid.ts` (new)

Thin wrapper around SendGrid's HTTPS API (`@sendgrid/mail` npm package):

```ts
import sgMail from '@sendgrid/mail';

const key = process.env.SENDGRID_API_KEY;
if (key) sgMail.setApiKey(key);

export async function sendEmail(args: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!key) return { ok: false, error: 'SENDGRID_API_KEY not set' };
  try {
    await sgMail.send({
      to: args.to,
      from: process.env.EMAIL_FROM!,
      replyTo: process.env.EMAIL_REPLY_TO,
      subject: args.subject,
      text: args.text,
      html: args.html,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
```

Add `@sendgrid/mail` to `package.json` (`npm install @sendgrid/mail`).

### 7.3 Higher-level wrapper — `src/lib/email/sendApprovalEmail.ts` (new)

```ts
import { sendEmail } from './sendgrid';
import { renderTaskApproved, renderTaskRevoked, renderTaskUpdated, renderTaskDeleted } from './templates';

type Kind = 'approved' | 'revoked' | 'updated' | 'deleted';

export async function sendApprovalEmail(args: {
  kind: Kind;
  to: string;                    // assignee email
  taskTitle: string;
  taskLegacyId: number | null;
  approverName: string;
  changes?: Record<string, { from: unknown; to: unknown }>; // for 'updated'
}): Promise<void> { ... }
```

Server actions in §6 call this once per write. The function logs SendGrid failures and returns `void` — callers never await a result that could block the user.

### 7.4 Email templates

Four templates in `src/lib/email/templates/`:

| File | Kind | Subject |
|---|---|---|
| `taskApproved.ts` | approved | `✅ Your task "<title>" was approved — you may begin work` |
| `taskRevoked.ts` | revoked | `⏸️ Approval revoked for "<title>" — please pause work` |
| `taskUpdatedByApprover.ts` | updated | `📝 Your task "<title>" was updated by <approver>` (bulleted diff) |
| `taskDeletedByApprover.ts` | deleted | `🗑 Your task "<title>" was removed by <approver>` |

Each template exports a function returning `{ html, text }`. All include a deep link to `/tasks/<legacyId>` (omitted in the deletion email). Templates are plain TS — no React — to keep the bundle slim. If we later want richer HTML we can swap in `@react-email/render` without changing the call sites.

### 7.5 Failure handling

Emails are best-effort. If `sendEmail` returns `{ ok: false, ... }`, log the error server-side (`console.error('[email]', ...)`) and surface a non-blocking flash on the redirect (`?emailFailed=1`). The task state itself must remain committed — we don't roll back a DB write because email broke. The approver can resend manually by re-running the action.

### 7.6 Local dev

In development with no SendGrid key set, `sendEmail` returns `{ ok: false, error: 'SENDGRID_API_KEY not set' }` and the server action continues normally. This keeps `npm run dev` working without forcing every developer to wire up SendGrid.

---

## 8. Visual badges — Approved / Unapproved icons

### 8.1 Icon choice

To match the existing emoji-based `NAV` icons in `Sidebar.tsx`:

- **Approved:** `✅` (U+2705)
- **Unapproved:** `⏳` (U+23F3) — "pending" reads better than a red ✗ for a workflow that's not a rejection

If the design team prefers SVG, create `src/components/icons/ApprovedIcon.tsx` and `UnapprovedIcon.tsx` using Tailwind-styled inline SVGs (path data lifted from Heroicons `check-badge` and `clock`).

### 8.2 Shared component — `src/components/ApprovalBadge.tsx` (new)

```tsx
export function ApprovalBadge({ approved }: { approved: boolean }) {
  if (approved) {
    return <span title="Approved" className="text-green-600">✅</span>;
  }
  return <span title="Awaiting approval" className="text-amber-600">⏳</span>;
}
```

### 8.3 Where the badge appears

| Screen | Rule | File |
|---|---|---|
| `/tasks` (All Tasks) | Add a small column or inline badge next to the title for every row. `approved_at != null` ⇒ ✅, else ⏳. | `src/app/(app)/tasks/page.tsx` |
| `/tasks/mine` | Same. | `src/app/(app)/tasks/mine/page.tsx` |
| `/tasks/[legacyId]` (detail) | Show badge prominently in the header next to the title. | `src/app/(app)/tasks/[legacyId]/page.tsx` |
| `/board` (Kanban) | Show badge on each card. | `src/app/(app)/board/page.tsx` |
| `/dashboard` (recent activity) | Show badge on the line items. | `src/app/(app)/dashboard/page.tsx` |
| `/approvals` | Show badge in the dedicated Approval column. | new (§5.1) |

Requirement #6 mandate ("⏳ on every non-Done task") is satisfied because non-Done tasks will always have `approved_at = null` after migration (the backfill only filled Done tasks).
Requirement #7 ("✅ on every Done task") is satisfied by the migration backfill in §2.1 Part 2 step 4.

---

## 9. Test plan

Verification before declaring done:

1. **Migration smoke test** — run on a staging branch of the Supabase project. Confirm:
   - `select role, count(*) from user_profile group by role` includes `approver` after a manual `update user_profile set role='approver' where email='...'` for one test user.
   - `select count(*) from task where status='done' and approved_at is null` returns 0.
   - `select count(*) from task where status<>'done' and approved_at is not null` returns 0.
2. **Permission matrix** — log in as each of {admin, editor, approver, viewer} and confirm:
   - Sidebar "Approve Tasks" enabled for admin + approver, disabled (greyed) for editor + viewer.
   - Direct navigation to `/approvals` redirects non-approvers to `/dashboard?error=...`.
   - Editor cannot delete someone else's task; approver can.
3. **Approval flow** — as approver, approve a task. Verify:
   - `approved_at`, `approved_by` populated; `status` **unchanged**.
   - Badge flips from ⏳ to ✅ on `/tasks`, `/board`, `/dashboard`.
   - SendGrid Activity log shows a delivered message to the assignee; the assignee's inbox receives the "you may begin work" email.
4. **Revoke flow (allowed)** — on an approved task with `status = 'not_started'`, click Revoke. Verify:
   - `approved_at` and `approved_by` are nulled.
   - Badge flips from ✅ back to ⏳ everywhere.
   - Assignee receives the "approval revoked" email.
5. **Revoke is blocked once work begins** — repeat for tasks at each of `in_progress`, `blocked`, and `done`. For each:
   - The Revoke button must be hidden in the UI.
   - A direct server-action invocation (e.g., via a crafted form POST) must return a form error and leave the row unchanged.
6. **Edit-as-approver** — change priority on a task created by someone else. Confirm DB updated, email sent with the diff, task remains in `/approvals` (status was not changed).
7. **Delete-as-approver** — delete a task. Confirm cascade behaviour (subtasks/attachments removed per existing FKs), email sent, task gone from all listings.
8. **Backfill correctness** — pick three pre-existing Done tasks before migration; after migration confirm all three show ✅ and `approved_by` points at the chosen admin.
9. **No-key fallback** — temporarily unset `SENDGRID_API_KEY` in local `.env.local`, repeat the approve flow, confirm the DB write commits and the redirect carries `?emailFailed=1` (no crash).
10. **RLS regression** — repeat existing editor/viewer scenarios from the `0002` migration notes to confirm we didn't open a hole.

---

## 10. File inventory

### New files

| Path | Purpose |
|---|---|
| `supabase/migrations/0006_task_approval.sql` | Schema, RLS, backfill |
| `src/lib/permissions.ts` | `getCurrentRole`, `canApproveTasks` helpers |
| `src/components/ApprovalBadge.tsx` | Shared ✅ / ⏳ badge |
| `src/app/(app)/approvals/page.tsx` | Approval queue list |
| `src/app/(app)/approvals/[legacyId]/page.tsx` | Approval-flavored task detail/edit |
| `src/app/(app)/approvals/actions.ts` | `approveTask`, `revokeApproval`, `updateTaskAsApprover`, `deleteTaskAsApprover` |
| `src/lib/email/sendgrid.ts` | SendGrid API wrapper |
| `src/lib/email/sendApprovalEmail.ts` | Higher-level helper that picks template + invokes `sendEmail` |
| `src/lib/email/templates/taskApproved.ts` | Email body — approval |
| `src/lib/email/templates/taskRevoked.ts` | Email body — revocation |
| `src/lib/email/templates/taskUpdatedByApprover.ts` | Email body — update with diff |
| `src/lib/email/templates/taskDeletedByApprover.ts` | Email body — deletion |
| `src/app/(app)/tasks/form-helpers.ts` | Extracted `readForm`/`validate` (shared) |

### Modified files

| Path | Change |
|---|---|
| `src/components/Sidebar.tsx` | New `canApprove` prop; insert "Approve Tasks" link with disabled-state styling |
| `src/app/(app)/layout.tsx` | Compute `canApprove` and pass to `<Sidebar />` |
| `src/app/(app)/tasks/page.tsx` | Add approval column / inline badge |
| `src/app/(app)/tasks/mine/page.tsx` | Add approval badge |
| `src/app/(app)/tasks/[legacyId]/page.tsx` | Header badge; surface approval metadata |
| `src/app/(app)/board/page.tsx` | Card-level badge |
| `src/app/(app)/dashboard/page.tsx` | Badge on recent-activity items |
| `src/app/(app)/tasks/actions.ts` | Import `readForm`/`validate` from the extracted helper |
| `src/lib/supabase/types.ts` (or generated types) | Add `approver` to role union; add new task columns |
| `.env.example` | Replace `RESEND_API_KEY` block with `SENDGRID_API_KEY` + `EMAIL_FROM` + `EMAIL_REPLY_TO` |
| `package.json` | Add `@sendgrid/mail` dependency |

---

## 11. Rollout

1. **Branch & PR** — `feature/task-approval` off `main`, single PR for review.
2. **Staging migration** — run `0006_task_approval.sql` Part 1, wait for commit, run Part 2. Verify backfill counts (§9 step 1).
3. **Promote test user** — set one Oakwood admin's `role` to `approver` via the User Management UI so we exercise the role path (not just admin-inherits-approver).
4. **Smoke test in staging** end-to-end including the email round trip.
5. **Production migration** during a quiet window. Same two-part procedure.
6. **Announce** to OUC staff with a one-paragraph note explaining the new sidebar item and what triggers an approval email.

---

## 12. Resolved decisions (recorded so the next reader doesn't re-litigate)

- Permission gating uses a new **`approver`** role added to the `user_role` enum. Admin implicitly inherits approver power.
- Approval is stored as **`task.approved_at` + `task.approved_by`** columns. No separate audit table for v1.
- Backfill: existing **Done** tasks are marked approved (`approved_at = coalesce(completed_at, now())`, `approved_by` = oldest active admin).
- Approval is **permission to begin work**. It never auto-changes `status`.
- **Work may proceed without approval.** The ⏳/✅ badge is advisory only; no code enforces "approved before in_progress." Editors are trusted to honour it. Add enforcement later if abuse becomes a real problem.
- Approval **may be revoked, but only while `status = 'not_started'`**. Once a task moves to `in_progress`, `blocked`, or `done`, the approval is locked and cannot be revoked.
- `updateTaskAsApprover` does **not** auto-revoke approval when "material" fields change. The approver decides explicitly via the Revoke button (when still allowed by the status rule above).
- Email delivery uses **SendGrid** via `@sendgrid/mail`, key in `.env.local`. Supabase Edge Functions / `pg_net` are not used.
- **No in-app notification bell** for v1; email only. May be revisited later once an in-app notifications table exists.
