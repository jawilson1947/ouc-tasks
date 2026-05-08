-- ============================================================================
-- Migration 0002 — Simplify role model to (admin, editor, viewer)
-- ----------------------------------------------------------------------------
-- BEFORE:  user_role enum = (admin, staff, contractor, viewer)
-- AFTER:   user_role enum still includes the legacy values (Postgres can't
--          drop enum values without a destructive recreate), but no profiles
--          carry them — staff/contractor rows are migrated to 'editor'.
--
-- Permission model:
--   admin   — full CRUD on everything; only role that can manage other users.
--   editor  — SELECT on all tasks (so reports work meaningfully); INSERT,
--             UPDATE, DELETE only on tasks they created. Mirrors apply to
--             subtask/attachment/comment via parent task ownership.
--   viewer  — SELECT only. No mutations.
--
-- NOTE on Editor SELECT scope: this migration grants Editor read access to
--   ALL tasks. If the requirement is strictly "Editor sees only their own
--   tasks", change task_select_anyone below to add (created_by = auth.uid()
--   OR current_user_role() IN ('admin','viewer')) to the Editor branch.
--
-- HOW TO RUN: Postgres requires `ALTER TYPE ... ADD VALUE` to commit before
--   the new value can be used. Run this file in TWO PARTS:
--     PART 1: lines marked "PART 1" only — execute, wait for completion.
--     PART 2: everything below "PART 2 starts here" — execute together.
-- ============================================================================

-- =============================== PART 1 ===================================
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'editor';

-- ============================ PART 2 starts here ==========================

-- 1. Migrate existing staff/contractor profiles to editor.
UPDATE user_profile
   SET role = 'editor'
 WHERE role IN ('staff', 'contractor');

-- 2. Drop old task policies that referenced staff/contractor.
DROP POLICY IF EXISTS task_admin_staff_all      ON task;
DROP POLICY IF EXISTS task_contractor_select    ON task;
DROP POLICY IF EXISTS task_contractor_update    ON task;
DROP POLICY IF EXISTS task_viewer_select        ON task;

-- 3. New task policies.
CREATE POLICY task_admin_all ON task FOR ALL
    USING       ( current_user_role() = 'admin' )
    WITH CHECK  ( current_user_role() = 'admin' );

CREATE POLICY task_select_anyone ON task FOR SELECT
    USING       ( current_user_role() IN ('admin','editor','viewer') );

CREATE POLICY task_editor_insert ON task FOR INSERT
    WITH CHECK  (
        current_user_role() = 'editor'
        AND created_by = auth.uid()
    );

CREATE POLICY task_editor_update ON task FOR UPDATE
    USING       (
        current_user_role() = 'editor'
        AND created_by = auth.uid()
    )
    WITH CHECK  (
        current_user_role() = 'editor'
        AND created_by = auth.uid()
    );

CREATE POLICY task_editor_delete ON task FOR DELETE
    USING       (
        current_user_role() = 'editor'
        AND created_by = auth.uid()
    );

-- 4. Subtask policies — mirror parent task ownership.
DROP POLICY IF EXISTS subtask_select        ON subtask;
DROP POLICY IF EXISTS subtask_admin_all     ON subtask;
DROP POLICY IF EXISTS subtask_editor_write  ON subtask;

CREATE POLICY subtask_select ON subtask FOR SELECT
    USING       ( current_user_role() IN ('admin','editor','viewer') );

CREATE POLICY subtask_admin_all ON subtask FOR ALL
    USING       ( current_user_role() = 'admin' )
    WITH CHECK  ( current_user_role() = 'admin' );

CREATE POLICY subtask_editor_write ON subtask FOR ALL
    USING (
        current_user_role() = 'editor'
        AND EXISTS (
            SELECT 1 FROM task t
             WHERE t.id = subtask.task_id
               AND t.created_by = auth.uid()
        )
    )
    WITH CHECK (
        current_user_role() = 'editor'
        AND EXISTS (
            SELECT 1 FROM task t
             WHERE t.id = subtask.task_id
               AND t.created_by = auth.uid()
        )
    );

-- 5. Attachment policies — mirror parent task ownership.
DROP POLICY IF EXISTS attachment_select        ON attachment;
DROP POLICY IF EXISTS attachment_admin_all     ON attachment;
DROP POLICY IF EXISTS attachment_editor_write  ON attachment;

CREATE POLICY attachment_select ON attachment FOR SELECT
    USING       ( current_user_role() IN ('admin','editor','viewer') );

CREATE POLICY attachment_admin_all ON attachment FOR ALL
    USING       ( current_user_role() = 'admin' )
    WITH CHECK  ( current_user_role() = 'admin' );

CREATE POLICY attachment_editor_write ON attachment FOR ALL
    USING (
        current_user_role() = 'editor'
        AND task_id IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM task t
             WHERE t.id = attachment.task_id
               AND t.created_by = auth.uid()
        )
    )
    WITH CHECK (
        current_user_role() = 'editor'
        AND task_id IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM task t
             WHERE t.id = attachment.task_id
               AND t.created_by = auth.uid()
        )
    );

-- 6. Comment policies — author-based for editors.
DROP POLICY IF EXISTS comment_select        ON comment;
DROP POLICY IF EXISTS comment_admin_all     ON comment;
DROP POLICY IF EXISTS comment_editor_write  ON comment;

CREATE POLICY comment_select ON comment FOR SELECT
    USING       ( current_user_role() IN ('admin','editor','viewer') );

CREATE POLICY comment_admin_all ON comment FOR ALL
    USING       ( current_user_role() = 'admin' )
    WITH CHECK  ( current_user_role() = 'admin' );

CREATE POLICY comment_editor_write ON comment FOR ALL
    USING       ( current_user_role() = 'editor' AND author_id = auth.uid() )
    WITH CHECK  ( current_user_role() = 'editor' AND author_id = auth.uid() );

-- ============================================================================
-- End of migration. After running both parts, all profiles should have a role
-- in (admin, editor, viewer). Verify with:
--   SELECT role, count(*) FROM user_profile GROUP BY role;
-- ============================================================================
