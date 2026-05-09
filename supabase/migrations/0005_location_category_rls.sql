-- ============================================================================
-- Migration 0005 — RLS policies for location and category reference tables
-- ----------------------------------------------------------------------------
-- The location and category tables were created in migration 0001 WITHOUT RLS
-- enabled, so they were readable/writable by anyone authenticated. This
-- migration enables RLS and locks them down:
--   • All authenticated roles can SELECT.
--   • Only admin can INSERT, UPDATE, DELETE.
--
-- NOTE: We use separate per-operation policies (not FOR ALL) because
--   PostgreSQL's FOR ALL + USING does not reliably cover INSERT WITH CHECK
--   in all Supabase configurations. This matches the pattern used throughout
--   migration 0002.
--
-- Run this file in the Supabase SQL Editor after migration 0004.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- category
-- ---------------------------------------------------------------------------
ALTER TABLE category ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS category_select        ON category;
DROP POLICY IF EXISTS category_admin_all     ON category;
DROP POLICY IF EXISTS category_admin_insert  ON category;
DROP POLICY IF EXISTS category_admin_update  ON category;
DROP POLICY IF EXISTS category_admin_delete  ON category;

CREATE POLICY category_select ON category FOR SELECT
    USING (current_user_role() IN ('admin', 'editor', 'viewer'));

CREATE POLICY category_admin_insert ON category FOR INSERT
    WITH CHECK (current_user_role() = 'admin');

CREATE POLICY category_admin_update ON category FOR UPDATE
    USING      (current_user_role() = 'admin')
    WITH CHECK (current_user_role() = 'admin');

CREATE POLICY category_admin_delete ON category FOR DELETE
    USING (current_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- location
-- ---------------------------------------------------------------------------
ALTER TABLE location ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS location_select        ON location;
DROP POLICY IF EXISTS location_admin_all     ON location;
DROP POLICY IF EXISTS location_admin_insert  ON location;
DROP POLICY IF EXISTS location_admin_update  ON location;
DROP POLICY IF EXISTS location_admin_delete  ON location;

CREATE POLICY location_select ON location FOR SELECT
    USING (current_user_role() IN ('admin', 'editor', 'viewer'));

CREATE POLICY location_admin_insert ON location FOR INSERT
    WITH CHECK (current_user_role() = 'admin');

CREATE POLICY location_admin_update ON location FOR UPDATE
    USING      (current_user_role() = 'admin')
    WITH CHECK (current_user_role() = 'admin');

CREATE POLICY location_admin_delete ON location FOR DELETE
    USING (current_user_role() = 'admin');

-- ============================================================================
-- Verify with:
--   SELECT count(*) FROM category;   -- should be 6 (seed data)
--   SELECT count(*) FROM location;   -- should be 17 (seed data)
--   -- As an admin, try:
--   INSERT INTO location (name) VALUES ('Test') RETURNING id;
--   DELETE FROM location WHERE name = 'Test';
-- ============================================================================
