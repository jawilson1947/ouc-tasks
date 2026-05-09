-- ============================================================================
-- Migration 0004 — Refresh task_with_totals view
-- ----------------------------------------------------------------------------
-- The view was originally created with `SELECT t.*` before contractor_id was
-- added to the task table (migration 0003). PostgreSQL resolves `*` at view-
-- creation time, so the view's column list was frozen and does NOT include
-- contractor_id.
--
-- CREATE OR REPLACE VIEW cannot change column positions (adding contractor_id
-- into t.* shifts the computed columns, which Postgres treats as a rename).
-- The safe fix is DROP then CREATE.
--
-- Error fixed:
--   "column task_with_totals.contractor_id does not exist"
--
-- Run this file in the Supabase SQL Editor after migration 0003.
-- ============================================================================

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

-- ============================================================================
-- Verify with:
--   SELECT contractor_id FROM task_with_totals LIMIT 1;
--   \d task_with_totals     -- contractor_id should appear in the column list
-- ============================================================================
