# Plan — "Request Approval" button on the task edit page

Status: proposal, not yet implemented. Please review and weigh in on the open questions before any code is written.

## Overview

Add a "Request Approval" button on `/tasks/[legacyId]/edit`, immediately to the left of the existing "Cancel" link. Clicking it dispatches an email to every active approver (and admin) summarizing the task — title, assignee, budget total — and linking back to the approval review record at `/approvals/[legacyId]`. The button does not change the task's data or status; it only sends notifications.

Mirrors the existing approval-flow email pattern (`src/lib/email/`, `sendApprovalEmail.ts`, the `shared.ts` HTML shell) so the new template looks and reads like the others.

## UI change

**File:** `src/components/TaskForm.tsx` (footer row, lines ~314–327) and `src/app/(app)/tasks/[legacyId]/edit/page.tsx`.

Constraint: HTML forms can't nest, and the existing footer's Cancel/Save belong to the `updateTask` form. Cleanest approach:

1. Add an optional prop to `TaskForm`: `requestApprovalSlot?: React.ReactNode`. When provided, render it inside the footer immediately before the Cancel link.
2. The edit page passes `<RequestApprovalButton taskId={task.id} legacyId={task.legacy_id} />`, a new small client component in `src/components/`.
3. `RequestApprovalButton` is a plain `<button type="button">` (not a submit). On click it calls the imported server action directly via `useTransition`, so no nested `<form>` is needed.

**Where it lives:** only on `/tasks/[legacyId]/edit`. The `/approvals/[legacyId]` review page reuses `TaskForm` too — we do **not** pass the slot there, so the button is invisible to approvers who are already reviewing.

**Styling:** match the existing Cancel link (white background, border, same padding/text size), with a subtle accent — e.g. `border-ouc-accent text-ouc-accent` — to signal it's an active action rather than a navigation. No icon.

**Disabled state:** disabled while the parent form has unsaved changes (we don't currently track dirty state, so realistically: disabled while the action is `pending` via `useTransition`, and disabled if the task is already approved — `approved_at IS NOT NULL`). Treat unsaved changes as out of scope; users save first, then click Request Approval.

**Feedback after click:** server action redirects back to the same page with `?requested=1` (and `?emailFailed=1` if SendGrid was misconfigured or partial failure). The edit page renders a green flash banner identical to the pattern in `src/app/(app)/approvals/[legacyId]/page.tsx`'s `sp.updated` block — "Approval request sent to N approver(s)."

## Server action

**File:** new `src/app/(app)/tasks/request-approval-action.ts` (kept as its own file to mirror the modular layout — actions.ts, photo-actions.ts, receipt-actions.ts, subtask-actions.ts).

**Signature:** `export async function requestApproval(formData: FormData): Promise<void>` — receives `id` (uuid) and `legacy_id` from hidden inputs the client button posts.

**Permission gate:** anyone allowed to edit the task. Reuse the same check that already guards `/tasks/[legacyId]/edit`:

- Signed in.
- `user_profile.role` in (`admin`, `editor`, `approver`).
- If `editor`, must be the task's `created_by`.

If the gate fails, redirect to `/tasks/[legacyId]?error=…`.

**Steps:**

1. Load task by id from `task_with_totals` (need `total_cost` plus title, legacy_id, assignee_id, approved_at, status).
2. Short-circuit if `approved_at IS NOT NULL` — redirect with `?error=Task+is+already+approved`.
3. Fetch the assignee's name (single user — `task.assignee_id`) for inclusion in the body.
4. Fetch approver recipients (see next section).
5. Render the new template once, then loop over recipients calling `sendEmail()` for each. Track `okCount` / `failCount`.
6. (Optional, gated by an open question below) write `approval_requested_at = now()` on the task row.
7. `revalidatePath('/tasks/[legacyId]')` and `'/tasks/[legacyId]/edit'`.
8. `redirect('/tasks/[legacyId]/edit?requested=1' + (failCount > 0 ? '&emailFailed=1' : ''))`.

## Recipient query

Match `canApproveTasks()` in `src/lib/permissions.ts`, which treats `'admin'` and `'approver'` as equivalent. Skip deactivated users and rows missing an email.

```ts
const { data: recipients } = await supabase
  .from('user_profile')
  .select('id, full_name, email')
  .in('role', ['admin', 'approver'])
  .eq('active', true)
  .not('email', 'is', null);
```

Zero recipients is an edge case — see open questions.

## Email content

Recipient: each approver/admin individually (one `sendEmail()` call per recipient, not a single message with BCC — the existing pattern in `sendApprovalEmail.ts` is one-to-one, easier to debug, and keeps the To: header informative).

From / reply-to: inherited from `EMAIL_FROM` and `EMAIL_REPLY_TO` env vars via the existing `sendEmail()` wrapper — nothing new to add.

**Subject (proposed):**

> Approval requested: "{task title}" (#{legacy id})

**Body (proposed, plain-voice to match `taskApproved.ts`):**

> Hi {approver first name},
>
> {requester full name} is requesting your approval on task #{legacy id} — **{task title}**.
>
> - Assignee: {assignee full name} ({assignee email}) — or "Unassigned" if `assignee_id` is null
> - Budget total: ${total_cost formatted as USD}
>
> [Review this task] → links to `${appUrl()}/approvals/{legacyId}`
>
> The task's status has not changed; approval is permission to begin work.
>
> — OUC Tasks

HTML version uses the existing `htmlShell()` from `templates/shared.ts` with the same teal/grey OUC brand colors and the same dark-button CTA style as `taskApproved.ts`. Plain text mirrors the body above.

**New template file:** `src/lib/email/templates/taskApprovalRequested.ts` exporting `renderTaskApprovalRequested(args)`. Add a corresponding `'requested'` case in `sendApprovalEmail.ts` so all approval-related emails route through one helper — but only if that fits the existing shape. (Currently `sendApprovalEmail.ts` is hard-wired to email a single assignee. The cleaner option may be a parallel `sendApprovalRequestEmail.ts` helper since the recipient model is different — one-to-many to approvers, not one-to-one to assignee. **Recommendation:** new helper file, parallel to `sendApprovalEmail.ts`.)

Currency formatting: use `fmtUSD()` from `src/lib/format.ts`.

Deep link helper: extend `templates/shared.ts` with `approvalUrl(legacyId)` returning `${appUrl()}/approvals/${legacyId}`, mirroring the existing `taskUrl()`.

## Edge cases & open questions

1. **Repeated clicks — throttle or send again?** A user could click the button several times in a row.
   *Recommendation:* allow re-sending freely for now. No throttle, no dedupe. If we later add `approval_requested_at`, we can show "Last requested 12 minutes ago" and soft-disable the button for, say, 5 minutes.

2. **Should we persist that a request was sent?** I.e. add `task.approval_requested_at timestamptz` and `task.approval_requested_by uuid`.
   *Recommendation:* yes, in the same change, because it's cheap and unlocks the UI affordance above ("Last requested ..."). This adds a small migration: `0008_task_approval_requested_at.sql`. If you'd rather defer, the feature works without it — flash banner only.

3. **What if zero approvers exist?** Possible in fresh installs.
   *Recommendation:* don't write anything; redirect with `?error=No+active+approvers+to+notify`. Surface a clear error rather than silently doing nothing.

4. **What if SendGrid is not configured?** `sendEmail()` returns `{ ok: false, error: 'SENDGRID_API_KEY not set' }`. The existing pattern is to log and continue.
   *Recommendation:* follow that pattern. If every recipient call returns `ok:false`, redirect with `?requested=1&emailFailed=1` and the flash banner shows the amber "email notification failed — please follow up manually" suffix, identical to `/approvals` today.

5. **Does the task need to be in a particular status?**
   *Recommendation:* allow request from any status as long as `approved_at IS NULL`. Most realistic flow is `not_started` → request → approve → user begins work. But forcing status = `not_started` would block edge cases (e.g. blocked task that needs re-approval); not worth the rigidity.

6. **Budget total — planned cost only, or actual?** `task_with_totals.total_cost` is `sum(subtask.labor_cost + subtask.equipment_cost)`. It does **not** include receipts.
   *Recommendation:* use `total_cost` and label it "Planned budget" in the email body to be unambiguous. If receipts are wanted too, that's a follow-up.

7. **Who is "the requester" in the email body?** I'm proposing the currently-signed-in user's `full_name` (or email as fallback). Confirm that's what you want — alternative is to leave the requester anonymous and just say "An editor is requesting…".

8. **Should the requester be CC'd or BCC'd?**
   *Recommendation:* no. They already know they clicked the button. Keeps the inbox quiet.

## Out of scope

- No in-app notification bell, badge, or unread indicator for approvers.
- No audit log of who requested approval when (beyond the optional `approval_requested_at` column from open question #2).
- No DB migration unless open question #2 is answered "yes."
- No changes to `/approvals/[legacyId]` (the review page) — its current Approve/Revoke/Delete sticky footer is untouched.
- No change to `task.status` or `task.approved_at` from this action — both stay where they are.
- No dirty-form detection on the edit page.
- No batching or BCC — one email per recipient.
- No retry logic on SendGrid failure beyond what `sendEmail()` already returns.

## Test plan

Manual checks once built:

1. As an `editor` who created the task, open `/tasks/3/edit`. Confirm the "Request Approval" button appears immediately to the left of "Cancel" with matching height/padding.
2. Click it. Confirm the green flash "Approval request sent to N approver(s)." appears and the URL has `?requested=1`.
3. Inbox check: every active user with role `admin` or `approver` (and a non-null email) receives one message. Subject matches the proposed format. Body includes task title, legacy id, assignee full name + email, budget total formatted as USD, and a working link to `/approvals/3`.
4. Inactive approver: deactivate one in `/admin/users`, click again — they should NOT receive an email.
5. Unassigned task: clear assignee, save, then request approval — body should read "Assignee: Unassigned" rather than crashing.
6. Already-approved task: approve it via `/approvals/3`, return to the edit page — button is disabled (or, if not disabled, clicking it redirects with `?error=Task+is+already+approved`).
7. SendGrid disabled (clear `SENDGRID_API_KEY` in `.env.local`): click — flash banner appears with the amber "email notification failed" suffix; no crash.
8. Permissions: as a `viewer`, the edit page already redirects, so the button is unreachable. As an `editor` who did NOT create the task, the edit page redirects, so the button is unreachable. The server action repeats the same gate as defense in depth.
9. Zero approvers: temporarily set every approver/admin to `active=false` — click should redirect with `?error=No+active+approvers+to+notify`.
10. UI on `/approvals/[legacyId]`: confirm the Request Approval button does **not** appear there.
