-- ============================================================================
-- Migration 0006 — Task Approval workflow
-- ----------------------------------------------------------------------------
-- Adds a fourth user role ('approver') plus two columns on `task`:
--   approved_at  timestamptz   -- NULL means "awaiting approval"
--   approved_by  uuid          -- references user_profile(id)
--
-- Semantics (per docs/approve-tasks-plan.md):
--   - Approval is PERMISSION TO BEGIN WORK. It never auto-changes status.
--   - Approval may be REVOKED only while task.status = 'not_started'. Once
--     work has begun ('in_progress', 'blocked', or 'done'), approval is
--     locked. This rule is enforced in the server action, not in the DB.
--   - Admin implicitly inherits approver power (via the existing
--     task_admin_all policy). 'approver' role gets full CRUD on every task.
--
-- HOW TO RUN: same two-part pattern as 0002_simplify_roles.sql. Postgres
-- requires ALTER TYPE ... ADD VALUE to commit before the new enum value can
-- be used.
--   PART 1: lines marked "PART 1" only — execute, wait for completion.
--   PART 2: everything below "PART 2 starts here" — execute together.
-- ============================================================================

-- =============================== PART 1 =====================================
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'approver';

-- ============================ PART 2 starts here ============================

-- 1. Schema additions on task.
ALTER TABLE task
    ADD COLUMN IF NOT EXISTS approved_at timestamptz,
    ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES user_profile(id);

CREATE INDEX IF NOT EXISTS task_approved_at_idx
    ON task(approved_at)
 WHERE approved_at IS NOT NULL;

-- 2. RLS policies — approver has the same full CRUD as admin on tasks AND
--    on the child tables (subtask, attachment, comment). Approver is, in
--    effect, "admin-for-task-content but not for users/settings".
CREATE POLICY task_approver_all ON task FOR ALL
    USING       ( current_user_role() = 'approver' )
    WITH CHECK  ( current_user_role() = 'approver' );

CREATE POLICY subtask_approver_all ON subtask FOR ALL
    USING       ( current_user_role() = 'approver' )
    WITH CHECK  ( current_user_role() = 'approver' );

CREATE POLICY attachment_approver_all ON attachment FOR ALL
    USING       ( current_user_role() = 'approver' )
    WITH CHECK  ( current_user_role() = 'approver' );

CREATE POLICY comment_approver_all ON comment FOR ALL
    USING       ( current_user_role() = 'approver' )
    WITH CHECK  ( current_user_role() = 'approver' );

-- 3. Refresh the task_with_totals view so the new columns flow through.
--    CREATE OR REPLACE VIEW can't reshape the column list, so DROP + CREATE
--    (same pattern as migration 0004).
DROP VIEW IF EXISTS task_with_totals;

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

-- 4. Backfill — every Done task is retroactively marked approved.
--    approved_by is set to the oldest active admin (the "system" approver).
--    approved_at is the task's completed_at if known, else now().
WITH sys AS (
    SELECT id
      FROM user_profile
     WHERE role = 'admin'
       AND active
     ORDER BY created_at ASC
     LIMIT 1
)
UPDATE task
   SET approved_at = coalesce(completed_at, now()),
       approved_by = (SELECT id FROM sys)
 WHERE status = 'done'
   AND approved_at IS NULL;

-- ============================================================================
-- Verify with:
--   SELECT count(*) FROM task WHERE status = 'done'    AND approved_at IS NULL;  -- expect 0
--   SELECT count(*) FROM task WHERE status <> 'done'   AND approved_at IS NOT NULL; -- expect 0
--   SELECT approved_at IS NOT NULL AS approved, count(*)
--     FROM task GROUP BY 1;
-- ============================================================================
