-- ============================================================================
-- Migration 0005 — RLS policies for location and category reference tables
-- ----------------------------------------------------------------------------
-- The location and category tables were created in migration 0001 WITHOUT RLS
-- enabled, so they are readable/writable by anyone authenticated. This
-- migration enables RLS and locks them down: admins can manage, all other
-- authenticated users can only read.
--
-- Run this file in the Supabase SQL Editor after migration 0004.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- category
-- ---------------------------------------------------------------------------
ALTER TABLE category ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS category_select        ON category;
DROP POLICY IF EXISTS category_admin_all     ON category;

CREATE POLICY category_select ON category FOR SELECT
    USING (current_user_role() IN ('admin', 'editor', 'viewer', 'staff', 'contractor'));

CREATE POLICY category_admin_all ON category FOR ALL
    USING       (current_user_role() = 'admin')
    WITH CHECK  (current_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- location
-- ---------------------------------------------------------------------------
ALTER TABLE location ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS location_select        ON location;
DROP POLICY IF EXISTS location_admin_all     ON location;

CREATE POLICY location_select ON location FOR SELECT
    USING (current_user_role() IN ('admin', 'editor', 'viewer', 'staff', 'contractor'));

CREATE POLICY location_admin_all ON location FOR ALL
    USING       (current_user_role() = 'admin')
    WITH CHECK  (current_user_role() = 'admin');

-- ============================================================================
-- Verify with:
--   SELECT count(*) FROM category;   -- should be 6 (seed data)
--   SELECT count(*) FROM location;   -- should be 17 (seed data)
-- ============================================================================
