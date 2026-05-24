# Request-Approval Verification Plan

End-to-end walk-through for two changes now on `main`:

1. **Request Approval feature** — commit `fe99d0a`. Button on `/tasks/[legacyId]/edit` that emails every active approver/admin, with success / no-approvers / partial-failure banners.
2. **Approval-request timestamp persistence** — migration `0008_approval_requested_at.sql` plus the matching code on `main`. New column `task.requested_approval_at`, label "Request for approval submitted on …" in the edit footer, "Requested on …" line in the `/approvals` queue.

Every step is one action + one expected observation. Quoted strings come directly from the source files referenced inline. The plan is runnable by a human on staging (or local) and structured so an agent can drive a browser through it.

---

## Prerequisites

Complete in this exact order before starting Test 1.

1. **Apply migration 0008.** Either:
   - Run `supabase db push` from the repo root against the target project, OR
   - In the Supabase Dashboard, open **SQL Editor → New query**, paste the contents of `supabase/migrations/0008_approval_requested_at.sql`, and click **Run**.
2. **Verify the migration landed.** In the Supabase SQL Editor run:
   ```sql
   SELECT column_name FROM information_schema.columns
    WHERE table_name = 'task' AND column_name = 'requested_approval_at';
   -- expect: 1 row
   SELECT column_name FROM information_schema.columns
    WHERE table_name = 'task_with_totals' AND column_name = 'requested_approval_at';
   -- expect: 1 row
   ```
3. **Confirm the Vercel deploy includes both commits.** In the Vercel dashboard for the target project, open the latest production deployment, check that the commit SHA matches the current `main` HEAD (and that `fe99d0a` appears in the deploy's commit list).
4. **Confirm the environment variables on that deployment.** In **Vercel → Project → Settings → Environment Variables**, confirm all of the following are set for the environment under test:
   - `SENDGRID_API_KEY`
   - `EMAIL_FROM`
   - `EMAIL_REPLY_TO`
   - `NEXT_PUBLIC_APP_URL` (used by the email template to build the `/approvals/<id>` link).
5. **Confirm test users.** Run in the SQL editor:
   ```sql
   SELECT role, count(*) FROM user_profile
    WHERE active = true AND email IS NOT NULL
    GROUP BY role;
   -- expect: at least one row with role='approver' AND one with role='admin'
   ```
   You also need at least one user with role `editor` (or `admin`) whose inbox you control, to sign in as the requester. Note the email addresses of every `approver`/`admin` — you will be checking each of their inboxes.
6. **Pick a test task.** Run:
   ```sql
   SELECT t.legacy_id, t.title, t.status, t.assignee_id, t.requested_approval_at,
          twt.total_cost
     FROM task t
     JOIN task_with_totals twt ON twt.id = t.id
    WHERE t.status = 'not_started'
      AND t.assignee_id IS NOT NULL
      AND twt.total_cost > 0
      AND t.requested_approval_at IS NULL
    ORDER BY t.legacy_id DESC
    LIMIT 5;
   ```
   Pick one row. Record its `legacy_id` as `<LEGACY_ID>` — you will substitute it everywhere below. If no row qualifies, create or edit a task so that `status='not_started'`, a known user is assigned, and at least one subtask has non-zero `labor_cost + equipment_cost`.
7. **Open inboxes.** Open the inbox of every approver/admin user from step 5 in separate browser tabs (or have IMAP/webmail ready). You will be checking all of them.

---

## Test 1 — Happy path: Request Approval sends an email

1. Sign in as the editor (or task owner) identified in Prerequisites step 5.
2. Navigate to `/tasks/<LEGACY_ID>/edit`.
   - Expect: page loads, heading reads "Edit Task #<LEGACY_ID>".
3. Inspect the form footer (above the sub-task editor, below the Contractor field).
   - Expect: a button labelled exactly **Request Approval** is rendered immediately to the left of the **Cancel** link, with **Save changes** to its right.
4. Inspect the same footer for the timestamp label.
   - Expect: **no** "Request for approval submitted on …" text is present (because `requested_approval_at` is NULL).
5. Click **Request Approval**.
   - Expect: a native browser `confirm()` dialog appears with the prompt text:
     `Send an approval request to all active approvers?`
6. Click **OK** on the dialog.
   - Expect: the button briefly reads **Requesting…**, then the page redirects.
7. Inspect the URL after the redirect.
   - Expect: path is `/tasks/<LEGACY_ID>/edit`, query string is exactly `?approversNotified=1` (no `emailFailed`, no `noApprovers`).
8. Inspect the page for the success banner (rendered above the form).
   - Expect: a green-bordered banner with the text:
     `Approver(s) have been notified.`
   - Expect: no amber italic suffix.
9. Inspect the form footer again.
   - Expect: to the left of the Request Approval button, a muted line reads:
     `Request for approval submitted on <timestamp>`
     where `<timestamp>` matches the current time in the app timezone, e.g. `May 23, 2026, 4:12 PM`.
10. Open each approver/admin inbox listed in Prerequisites step 5.
    - Expect: every one of them received an email.
    - Expect subject (literal): `Approval requested: "<task title>" (#<LEGACY_ID>)`
    - Expect body to contain, in order:
      - Greeting `Hi <approver first name>,` (or `Hello,` if their `full_name` is null).
      - The line `<requester name> has requested your approval for the following task:` with the requester's display name in **bold**.
      - The task identifier and title (e.g. `#<LEGACY_ID> — <task title>`).
      - A bulleted list with `Assignee: <assignee full name> (<assignee email>)` and `Planned budget: $X,XXX.XX` (USD, matches `total_cost` from `task_with_totals`).
      - A **Review this task** button linking to `<NEXT_PUBLIC_APP_URL>/approvals/<LEGACY_ID>`.
      - The footer line `The task's status has not changed; approval is permission to begin work.`
11. From one of those emails, click the **Review this task** button.
    - Expect: a new tab opens at `/approvals/<LEGACY_ID>`. After signing in if prompted, the review page renders with heading `Review Task #<LEGACY_ID>` and the task title beneath it.

---

## Test 2 — Re-click overwrites the timestamp

1. Return to `/tasks/<LEGACY_ID>/edit` (the same tab, or navigate back).
2. Note the displayed timestamp string after "Request for approval submitted on " — record it as `T1`.
3. Wait at least one full minute so any new timestamp would visibly differ.
4. Click **Request Approval**.
   - Expect: the `confirm()` dialog fires again (no throttle, no cooldown).
5. Click **OK**.
   - Expect: redirect to `/tasks/<LEGACY_ID>/edit?approversNotified=1` and the green "Approver(s) have been notified." banner.
6. Inspect the timestamp label.
   - Expect: it now shows a value `T2` strictly later than `T1`.
7. Re-check each approver inbox.
   - Expect: a second email arrived in every approver/admin inbox (same subject, fresh send timestamp).

---

## Test 3 — Cancel on the confirm dialog is a no-op

1. On `/tasks/<LEGACY_ID>/edit`, note the current timestamp as `T2` (from Test 2).
2. Click **Request Approval**.
   - Expect: the `confirm()` dialog appears.
3. Click **Cancel** on the dialog.
   - Expect: no redirect occurs; the URL stays at `/tasks/<LEGACY_ID>/edit` with no query string.
   - Expect: no banner appears.
4. Re-check approver inboxes.
   - Expect: no new email arrived since Test 2.
5. Inspect the timestamp label.
   - Expect: it still reads `T2` — unchanged.

---

## Test 4 — Zero approvers

1. In the Supabase SQL Editor, snapshot the current state so you can restore it:
   ```sql
   SELECT id, role, active FROM user_profile
    WHERE role IN ('admin','approver');
   ```
   Copy the output.
2. Temporarily deactivate every approver and admin:
   ```sql
   UPDATE user_profile SET active = false
    WHERE role IN ('admin','approver');
   ```
3. On `/tasks/<LEGACY_ID>/edit`, note the current timestamp as `T2`.
4. Click **Request Approval**, then **OK** on the confirm dialog.
5. Inspect the URL after the redirect.
   - Expect: `/tasks/<LEGACY_ID>/edit?noApprovers=1`.
6. Inspect the page for the banner.
   - Expect: a green-bordered banner with the text:
     `No approvers exist; request cannot be forwarded.`
   - Expect: the "Approver(s) have been notified." banner is NOT shown.
7. Re-check every (previously-active) approver/admin inbox.
   - Expect: no new email arrived.
8. Inspect the timestamp label.
   - Expect: it still reads `T2` — unchanged from Test 2.
9. Restore the user states using the snapshot from step 1, e.g.:
   ```sql
   UPDATE user_profile SET active = true
    WHERE id IN (<list of ids that were active before>);
   ```
10. Verify restoration:
    ```sql
    SELECT count(*) FROM user_profile
     WHERE role IN ('admin','approver') AND active = true;
    -- expect: same count as the original snapshot
    ```

---

## Test 5 — SendGrid failure

1. In **Vercel → Project → Settings → Environment Variables**, change `SENDGRID_API_KEY` for the environment under test to an obviously invalid value, e.g. `SG.invalid-test-key`. (Removing it entirely also works; the wrapper short-circuits on missing key.)
2. Trigger a redeploy so the new env value takes effect (Vercel → Deployments → latest → **Redeploy**, or push an empty commit).
3. Wait for the deploy to finish, then on `/tasks/<LEGACY_ID>/edit` note the current timestamp as `T2`.
4. Click **Request Approval**, then **OK** on the confirm dialog.
5. Inspect the URL after the redirect.
   - Expect: `/tasks/<LEGACY_ID>/edit?approversNotified=1&emailFailed=1` (the server action still uses the `approversNotified=1` flag and appends `&emailFailed=1` whenever any send failed).
6. Inspect the page for the banner.
   - Expect: a green-bordered banner reading `Approver(s) have been notified.` immediately followed by an amber italic suffix in the same banner:
     `(one or more email notifications failed — please follow up manually)`
7. Re-check every approver/admin inbox.
   - Expect: no new email arrived.
8. Inspect the timestamp label.
   - Expect: it still reads `T2` — the column is only stamped when `okCount > 0`, and a full SendGrid failure leaves `okCount` at 0.
9. In SQL, double-check:
   ```sql
   SELECT requested_approval_at FROM task WHERE legacy_id = <LEGACY_ID>;
   -- expect: same value as T2, not the current time
   ```
10. Restore `SENDGRID_API_KEY` to the original valid value in Vercel and redeploy. Wait for the deploy to finish before proceeding.

---

## Test 6 — Approvals queue displays "Requested on …"

1. Sign in as a user with role `approver` or `admin` (in a fresh browser/incognito if needed).
2. Navigate to `/approvals`.
   - Expect: heading `Approve Tasks` and the queue table.
3. Locate the row for the task from Test 1 (`<LEGACY_ID>`).
   - Expect: under the title (and below the `<subtask_count> sub-task(s)… · #<LEGACY_ID>` muted line), a third muted line reads:
     `Requested on <timestamp>`
     where `<timestamp>` matches the value persisted after Test 2.
4. Pick any other task row whose `requested_approval_at` is NULL (verify in SQL if needed:
   `SELECT legacy_id FROM task WHERE requested_approval_at IS NULL AND status <> 'done' LIMIT 3;`).
   - Expect: that row has **no** "Requested on …" line under its title — only the sub-task count line.
5. Create the "approved AND requested" combination. In SQL:
   ```sql
   -- Find an admin id to stamp as approver:
   SELECT id FROM user_profile WHERE role='admin' AND active=true LIMIT 1;
   -- Mark the test task approved AFTER its request:
   UPDATE task
      SET approved_at = now(),
          approved_by = '<admin uuid from above>'
    WHERE legacy_id = <LEGACY_ID>;
   ```
6. Hard-refresh `/approvals` (Cmd-Shift-R / Ctrl-Shift-R).
7. Locate the same row.
   - Expect: the **green check approval badge** is visible in the Approval column.
   - Expect: the `Requested on <timestamp>` line is still rendered under the title — approving did NOT clear it.

---

## Test 7 — Approvals review page

1. From `/approvals`, click into the test task's **Review** button (or navigate directly to `/approvals/<LEGACY_ID>`).
2. Inspect the page heading and banner.
   - Expect: heading `Review Task #<LEGACY_ID>`. Since you set `approved_at` in Test 6, the green banner at the top begins with `Approved.` followed by the approver name and time.
3. Scroll to the form footer (just above the sub-task editor).
   - Expect: the muted label `Request for approval submitted on <timestamp>` is rendered to the left of **Cancel** (this page reuses `TaskForm`, so the same label appears).
   - Expect: **no** "Request Approval" button — the approval review page intentionally omits `requestApprovalSlot`.
4. Click **Save changes** without changing anything.
   - Expect: redirect to `/approvals/<LEGACY_ID>?updated=1` (same page) and a green banner reading `Saved. The assignee has been notified.` The form submits via `updateTaskAsApprover`.
5. Scroll to the sticky bottom bar.
   - Expect: a button labelled `⏸️ Revoke approval` (because `status = 'not_started'` and the task is approved), and a button labelled `🗑 Delete task`. Both are visible and clickable.
6. Click **⏸️ Revoke approval**, confirm the prompt
   `Revoking approval will cancel the assignee's permission to start work. Continue?`,
   then click OK.
   - Expect: redirect to `/approvals?revoked=1`. The badge for `<LEGACY_ID>` on the queue is back to "Awaiting approval".
7. Navigate to `/approvals/<LEGACY_ID>` again and click **✅ Approve task** in the sticky bar.
   - Expect: redirect to `/approvals?approved=1`. The badge is back to "Approved" on the queue.

---

## Test 8 — Approving does NOT clear the timestamp

1. Confirm the task is still in the "approved after requested" state from Test 7 step 7.
2. Navigate to `/tasks/<LEGACY_ID>/edit`.
3. Inspect the form footer.
   - Expect: the muted label `Request for approval submitted on <timestamp>` is still rendered (same value persisted in Test 2). The approval action did not touch `requested_approval_at`.
4. Confirm in SQL:
   ```sql
   SELECT approved_at, requested_approval_at
     FROM task WHERE legacy_id = <LEGACY_ID>;
   -- expect: both columns non-null; requested_approval_at unchanged from T2.
   ```

---

## Database spot-checks

Run these in the Supabase SQL Editor any time during the walk-through.

```sql
-- 1. Column and view shape.
\d task                 -- requested_approval_at timestamptz, nullable, no default
\d task_with_totals     -- requested_approval_at appears in the column list

SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_name = 'task' AND column_name = 'requested_approval_at';
-- expect: requested_approval_at | timestamp with time zone | YES

-- 2. The view exposes the new column.
SELECT requested_approval_at FROM task_with_totals
 WHERE legacy_id = <LEGACY_ID>;

-- 3. Single-task history.
SELECT legacy_id, status, approved_at, approved_by, requested_approval_at
  FROM task
 WHERE legacy_id = <LEGACY_ID>;

-- 4. Spread of timestamp population across the table.
SELECT (requested_approval_at IS NOT NULL) AS requested, count(*)
  FROM task GROUP BY 1;

-- 5. Backfill sanity — no historical rows were stamped by the migration.
SELECT count(*) FROM task
 WHERE requested_approval_at IS NOT NULL
   AND id NOT IN (
       SELECT id FROM task
        WHERE created_at >= '2026-05-01'  -- adjust to the deploy date
   );
-- expect: 0 before the deploy date is reached
```

---

## Rollback notes

If verification fails and the changes must be backed out:

1. **Revert the code commits on `main`** (in this order, so HEAD is left clean):
   ```bash
   git revert <timestamp-feature-commit-sha>     # the timestamp UI + action stamp
   git revert fe99d0a                            # the original Request Approval button + action
   git push origin main
   ```
   Wait for Vercel to redeploy and confirm the production deploy SHA now matches the post-revert HEAD.
2. **Drop the column and rebuild the view** in the Supabase SQL Editor:
   ```sql
   BEGIN;

   -- Drop the column. The view that references it must be dropped first.
   DROP VIEW IF EXISTS task_with_totals;

   ALTER TABLE task DROP COLUMN IF EXISTS requested_approval_at;

   -- Recreate the view as it was after migration 0006 (no requested_approval_at).
   CREATE VIEW task_with_totals AS
   SELECT
       t.*,
       coalesce(sum(s.labor_cost), 0)                              AS total_labor_cost,
       coalesce(sum(s.equipment_cost), 0)                          AS total_equipment_cost,
       coalesce(sum(s.labor_cost + s.equipment_cost), 0)           AS total_cost,
       count(s.id)                                                 AS subtask_count,
       count(s.id) FILTER (WHERE s.status = 'done')                AS subtask_done_count
     FROM task t
     LEFT JOIN subtask s ON s.task_id = t.id
    GROUP BY t.id;

   COMMIT;
   ```
3. **Smoke-test the rollback.** Reload `/tasks/<LEGACY_ID>/edit` and `/approvals`.
   - Expect: pages load without errors. The "Request Approval" button and the "Request for approval submitted on …" label are gone. The "Requested on …" line in the queue is gone.
4. **Do not re-apply migration 0008** until both commits have been re-landed and reviewed — the code reads `requested_approval_at` from the `task` SELECT in `/tasks/[legacyId]/edit/page.tsx` and `/approvals/[legacyId]/page.tsx`, and from `task_with_totals` in `/approvals/page.tsx`. Re-applying the migration without the code, or vice versa, will produce 500s on those routes.
