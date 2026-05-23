-- ============================================================================
-- Migration 0008 — Approval-request timestamp
-- ----------------------------------------------------------------------------
-- Adds a single column on `task`:
--   requested_approval_at  timestamptz  -- NULL means "never requested"
--
-- Set by the `requestApproval` server action whenever at least one approval
-- email is actually accepted by SendGrid (i.e. okCount > 0). Re-clicking the
-- Request Approval button overwrites with the new request time — no
-- preserve-first-only behavior, no throttle. Approving a task does NOT clear
-- this column; it stays alongside approved_at as a historical record.
--
-- The view `task_with_totals` is defined as `SELECT t.*, …`. Postgres freezes
-- the column list at view-creation time, so the new task column will not
-- automatically flow through. We DROP + CREATE the view the same way
-- 0004_refresh_task_with_totals_view.sql and 0006_task_approval.sql did.
--
-- Adding a nullable timestamptz column is a metadata-only change and safe to
-- bundle with the view rebuild in one migration file.
-- ============================================================================

-- 1. Schema addition on task.
ALTER TABLE task
    ADD COLUMN IF NOT EXISTS requested_approval_at timestamptz;

-- 2. Refresh the task_with_totals view so the new column flows through.
--    CREATE OR REPLACE VIEW can't reshape the column list, so DROP + CREATE
--    (same pattern as migration 0004 and 0006).
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

-- 3. Backfill: leave existing rows NULL. No-op on purpose — historical tasks
--    were never tracked with this field, and pretending we know the original
--    request time would be misleading.

-- ============================================================================
-- Verify with:
--   SELECT requested_approval_at FROM task_with_totals LIMIT 1;
--   \d task_with_totals     -- requested_approval_at should appear
-- ============================================================================
