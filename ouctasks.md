# OUC Tasks — Session Log

**Date:** 2026-05-18  
**Branch:** `feature/photos-and-print-filter`  
**PR:** https://github.com/jawilson1947/ouc-tasks/pull/3

---

## Feature 1: Task Photo Uploads

### Goal
Allow images to be uploaded with each task to enhance documentation.

### What was built

**New files:**
- `src/app/api/photos/upload/route.ts` — `POST /api/photos/upload` endpoint. Accepts JPEG, PNG, WebP (no PDFs), max 10 MB. Stores files in Supabase Storage under `{user_id}/{task_id}/photos/` and inserts an `attachment` record with `type='photo'`. Requires admin or editor role.
- `src/app/(app)/tasks/photo-actions.ts` — `deletePhoto` server action. Checks that the user is admin or the original uploader before removing the file from storage and the DB record.
- `src/components/TaskPhotosCard.tsx` — Client component that renders a photo gallery on the task detail page. Features:
  - 2-column (mobile) / 3-column (tablet+) thumbnail grid
  - Thumbnails load lazily via signed URLs (`/api/receipts/signed-url`)
  - Drag-and-drop upload slide-over with caption field and image preview
  - Lightbox viewer on thumbnail click (shows caption)
  - Per-photo View and Delete buttons

**Modified files:**
- `src/app/(app)/tasks/[legacyId]/page.tsx` — Added parallel Supabase query for `type='photo'` attachments; renders `<TaskPhotosCard>` above the existing Receipts card.

### Notes
- No database migration needed — the `attachment_type` enum already included `'photo'` as a value.
- The signed-URL endpoint (`/api/receipts/signed-url`) is reused since both photos and receipts share the same storage bucket.

---

## Feature 2: Status-Filtered Formal Task Report

### Goal
Filter the Formal Task Report by task status before printing. The report should not run until a filter has been selected.

### What was built

**Modified files:**
- `src/components/ReportsExportBar.tsx` — Changed the Formal Task Report link to open `/reports/print?preview=1` instead of `/reports/print`. This suppresses the auto-print trigger so the filter UI is visible before anything prints.
- `src/app/(app)/reports/print/page.tsx` — Major changes:
  - Reads `?status=` query param (single value, e.g. `?status=not_started`)
  - If no status param is present, skips all data fetching entirely and renders only the filter panel
  - If a status is selected, fetches only tasks matching that status via `.in('status', activeStatuses)`
  - Report header shows the active filter label (e.g. *"Filtered: In Progress"*)
  - Report content (header, table, legend, footer) is conditionally rendered only when `reportReady` is true
  - Added "Print Formal Task Report" `<h1>` title above the filter card
  - Added small italic "Select filter before printing" note below the filter card
- `src/app/(app)/reports/print/PrintControlsClient.tsx` — Rewrote the controls component:
  - Status options are **mutually exclusive radio buttons** styled as pill toggles (only one can be selected at a time)
  - **Generate Report** button is disabled until a status is selected
  - **Print / Save as PDF** button only appears after the report has been generated
  - **Clear** link resets selection and returns to the no-report state
  - Preserves `?preview=1` in the URL across filter changes so auto-print is never triggered

### User flow
1. Reports page → **Export PDF** → **Formal Task Report** — opens new tab showing filter panel only
2. Click one status pill (Not Started / In Progress / Blocked / Done)
3. Click **Generate Report** — page reloads, fetches matching tasks, renders the report
4. Click **🖨 Print / Save as PDF** to open the print dialog

---

## Technical Notes

### Worktree / Main branch issue
Early in the session, changes were made in a git worktree (`claude/infallible-volhard-c036ad`) but the dev server was running from `main`. Changes were copied to `main` directly and all subsequent edits were made in `/Users/jimwilson/ouctasks` on `main`. The PR was created from a new branch `feature/photos-and-print-filter` branched off `main`.

### Key files reference

| File | Purpose |
|------|---------|
| `src/app/api/photos/upload/route.ts` | Photo upload API endpoint |
| `src/app/(app)/tasks/photo-actions.ts` | deletePhoto server action |
| `src/components/TaskPhotosCard.tsx` | Photo gallery UI component |
| `src/app/(app)/reports/print/page.tsx` | Formal Task Report (server component) |
| `src/app/(app)/reports/print/PrintControlsClient.tsx` | Filter controls + Print button (client component) |
| `src/app/(app)/reports/print/AutoPrintClient.tsx` | Auto-print trigger (suppressed by `?preview=1`) |
| `src/components/ReportsExportBar.tsx` | Export dropdown on Reports page |

---

# Session Log — 2026-07-03: Supabase → MySQL Migration (completed)

## What was done
- **Schema**: `supabase/migrations/mysql_schema.sql` applied to `ouctasks` DB at 162.144.105.50. Server is **MySQL 5.7.44**, so the schema was adapted: removed `DEFAULT (UUID())` (Prisma generates UUIDs client-side) and named `CONSTRAINT ... CHECK` clauses (bare CHECK, parsed+ignored by 5.7). Added `DROP TRIGGER IF EXISTS` for idempotency. Apply script: `scripts/apply-mysql-schema.mjs`.
- **DATABASE_URL fixed**: now uses the `ouc-it` MySQL user (`cctv_admin` had no grants on `ouctasks`).
- **Data**: `npm run migrate:data` — 10 categories, 25 locations, 7 users, 6 contractors, 41 tasks, 94 subtasks, 7 attachments. Approval backfill re-run post-import.
- **Code**: all ~45 pages/server actions/API routes converted from Supabase to Prisma + NextAuth. `src/lib/supabase/` deleted; `@supabase/ssr` removed. RLS replaced by `requireRole()` checks in every mutating action. NULLS-LAST orderings moved to JS sorts (MySQL limitation).
- **Auth**: NextAuth credentials (email + bcrypt password in `user_profile.password_hash`), JWT sessions. `NEXTAUTH_SECRET` added to `.env.local`. Password resets via sha256 token (`/auth/forgot` → `/auth/reset`); admin user-invite flow issues the same tokens (48h).
- **Storage**: Vercel Blob **private** store `ouc-tasks-files` (store_nOfiFr5VAZz7Wdmz). All 7 files copied via `npm run migrate:storage`; `attachment.storage_path` keeps the same pathnames. Serving: components → `/api/receipts/signed-url` → same-origin `/api/files?path=...` which streams via `get(path, {access:'private'})` behind session auth. Uploads use `put(..., {access:'private'})`.

## Post-migration notes
- **Users must set new passwords** (Supabase never exposes hashes) — "Forgot password" flow or Admin → Users.
- **Vercel deploy prep**: add `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `SENDGRID_API_KEY`, `EMAIL_FROM` to Vercel env; `BLOB_READ_WRITE_TOKEN` is already connected (Production/Preview). Confirm the MySQL server allows connections from Vercel's egress IPs. Supabase env vars can be removed after a soak period.
- Local dev Blob token in `.env.local` is the store RW token (revealed via dashboard + passkey reauth; `vercel env pull` returns it empty because it's marked sensitive).
- Legacy Supabase project can be decommissioned once verified in production.
