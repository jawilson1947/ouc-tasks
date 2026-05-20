-- ============================================================================
-- Migration 0007 — Default Postgres session timezone
-- ----------------------------------------------------------------------------
-- Sets the per-role default timezone to America/Chicago. This affects how
-- Postgres formats timestamps when they're cast to text (now()::text, the
-- output of psql, etc.) and how interval arithmetic interprets "tomorrow".
--
-- It does NOT change how timestamptz values are stored or returned over the
-- wire to Supabase/Postgres clients — those are always UTC. The app's
-- display layer (src/lib/format.ts) handles the user-visible zone via the
-- NEXT_PUBLIC_APP_TIMEZONE env var.
--
-- Why bother then? Two reasons:
--   1. Defense in depth: if any code path ever calls now()::text, current_date,
--      or interval math that depends on "local now", we want it to behave as
--      Central time rather than UTC.
--   2. SQL Editor sessions in the Supabase dashboard inherit these defaults,
--      so when an admin runs `select now()` they see a Central time, not UTC.
--
-- To change the default timezone later, edit the IANA name below and re-run
-- this file (or apply a new migration that ALTERs the same roles).
-- ============================================================================

ALTER ROLE authenticated   SET timezone = 'America/Chicago';
ALTER ROLE anon            SET timezone = 'America/Chicago';
ALTER ROLE service_role    SET timezone = 'America/Chicago';
ALTER ROLE postgres        SET timezone = 'America/Chicago';

-- ============================================================================
-- Verify the change applied. Reconnect (close and reopen the SQL editor tab)
-- before running this, because role defaults are picked up at session start:
--
--   SHOW timezone;                              -- expect: America/Chicago
--   SELECT now(), now()::text;                  -- expect: trailing -05/-06 offset
--
-- To inspect what's set per role:
--   SELECT rolname, rolconfig FROM pg_roles
--    WHERE rolname IN ('authenticated','anon','service_role','postgres');
-- ============================================================================
