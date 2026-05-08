-- ============================================================================
-- Migration 0003 — Contractor entity + task→contractor link
-- ----------------------------------------------------------------------------
-- "Contractor" is now a business entity (not a user role): a vendor or
-- sub-contractor a task can be assigned to. Tasks may optionally point at one.
--
-- Run this whole file in the Supabase SQL Editor after migration 0002.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. contractor table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contractor (
    id                    uuid primary key default uuid_generate_v4(),
    business_name         text not null,

    -- Primary contact
    primary_first_name    text,
    primary_last_name     text,
    primary_email         text,
    primary_phone         text,

    -- Business mailing address
    address_line1         text,
    address_line2         text,
    city                  text,
    state                 text,
    zipcode               text,
    business_phone        text,

    -- Misc
    notes                 text,
    active                boolean not null default true,

    created_by            uuid references user_profile(id),
    created_at            timestamptz not null default now(),
    updated_at            timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS contractor_business_name_idx ON contractor(business_name);
CREATE INDEX IF NOT EXISTS contractor_active_idx        ON contractor(active) WHERE active;

DROP TRIGGER IF EXISTS trg_contractor_updated ON contractor;
CREATE TRIGGER trg_contractor_updated
    BEFORE UPDATE ON contractor
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE contractor ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contractor_select         ON contractor;
DROP POLICY IF EXISTS contractor_admin_all      ON contractor;
DROP POLICY IF EXISTS contractor_editor_write   ON contractor;

CREATE POLICY contractor_select ON contractor FOR SELECT
    USING (current_user_role() IN ('admin','editor','viewer'));

CREATE POLICY contractor_admin_all ON contractor FOR ALL
    USING       (current_user_role() = 'admin')
    WITH CHECK  (current_user_role() = 'admin');

-- Editors can create contractors freely; they can edit/delete only ones they created.
CREATE POLICY contractor_editor_insert ON contractor FOR INSERT
    WITH CHECK (current_user_role() = 'editor' AND created_by = auth.uid());

CREATE POLICY contractor_editor_update ON contractor FOR UPDATE
    USING       (current_user_role() = 'editor' AND created_by = auth.uid())
    WITH CHECK  (current_user_role() = 'editor' AND created_by = auth.uid());

CREATE POLICY contractor_editor_delete ON contractor FOR DELETE
    USING (current_user_role() = 'editor' AND created_by = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. task → contractor link
-- ---------------------------------------------------------------------------
ALTER TABLE task ADD COLUMN IF NOT EXISTS contractor_id uuid
    REFERENCES contractor(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS task_contractor_idx ON task(contractor_id) WHERE contractor_id IS NOT NULL;

-- task_with_totals view needs to expose contractor_id (it does already because
-- the view is `select t.*, ...`). No change required to the view.

-- ============================================================================
-- End. Verify with:
--   SELECT count(*) FROM contractor;                 -- should be 0
--   \d task                                          -- contractor_id column should exist
-- ============================================================================
