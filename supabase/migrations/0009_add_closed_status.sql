-- ============================================================================
-- Migration 0009 — Add 'closed' value to task_status enum
-- ----------------------------------------------------------------------------
-- 'Closed' is a terminal status for tasks that are finished and archived.
-- Unlike 'Done' (work complete, pending payment), 'Closed' means the task
-- record is fully resolved and should be hidden from all standard listings.
--
-- PostgreSQL notes:
--   • ALTER TYPE … ADD VALUE cannot be rolled back once committed, but
--     IF NOT EXISTS makes re-running this migration safe.
--   • The new value is available to all subsequent statements and future
--     transactions as soon as this migration commits.
-- ============================================================================

ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'closed' AFTER 'done';
