# Oakwood University Church — Infrastructure Task Management Application — Implementation Plan

> **Project folder:** `C:\OUCtasks` (logo assets in `C:\OUCtasks\logos`)
> **Brand color:** Pantone 432 C — `#333F48` (charcoal-blue)
> **Custom domain:** `tasks.oucsda.org`

## 1. Purpose

Replace the current Word-document task list (`OUC IT Infrastructure Tasks.docx`) with a browser-based application that lets Oakwood University Church (OUC) staff and outside contractors collaborate on the same backlog in real time. The app will keep everything the document already does — priorities, cost breakdowns, sub-task descriptions, completion tracking — and add the things a static document can't do: assignment, due dates, photo evidence, and a live budget dashboard.

## 2. Users and Roles

The system needs to serve three distinct audiences, so role-based access is required from day one.

**Admin** (Jim and senior staff): full create/edit/delete on every task, manage users and categories, view full financial dashboard, export reports.

**Staff** (OUC employees and trusted volunteers): create and update tasks, assign to people, comment, upload photos, mark sub-tasks complete. Cannot delete or change other users' assignments.

**Contractor** (outside vendors and tradespeople): see only the tasks assigned to them or their company, update sub-task status, upload photos and notes, log labor hours. Cannot see total budget figures across the campus or other contractors' work.

**Viewer** (optional, e.g. board members): read-only access to dashboards and task summaries.

## 3. Data Model

The document's table maps cleanly onto five core entities:

**Task** — the top-level work bundle (rows 1–25 in the current doc). Fields: id, title, priority (1–5), status (Not Started / In Progress / Blocked / Done), category, location, assignee, due date, total labor cost (derived), total equipment cost (derived), total cost (derived), notes, created/updated timestamps, created_by.

**SubTask** — the numbered sub-items inside each row's Description column. Fields: id, task_id, sequence, description, labor_cost, equipment_cost, status, completed_at, completed_by.

**User** — staff, contractors, viewers. Common fields: id, name, email, role, phone, active, last_login. Contractor profiles extend the base record with: company name, trade or specialty, license number (optional), insurance expiry date (optional), default hourly labor rate, billing email, mailing address, internal notes. Contractors can self-edit their own profile; admins can view or edit any. A contractor onboarding flow (admin invites by email → contractor sets password or signs in with Google → completes profile) replaces the missing external identity source.

**Attachment** — photos, receipts, spec sheets, before/after shots. Fields: id, task_id (or subtask_id), filename, storage_url, type (photo / receipt / spec / document / other), amount (for receipts, nullable), vendor (for receipts, nullable), uploaded_by, uploaded_at, caption. Typing receipts with a dollar amount lets the dashboard reconcile actual spend against estimated cost per sub-task.

**Comment** — free-form discussion thread per task. Fields: id, task_id, author, body, created_at.

Plus two reference tables that come straight out of patterns I see in the existing document:

**Category** — Surveillance, Access Control, AV/Displays, Cabling, Maintenance, Other.

**Location** — FLC, Sanctuary, Pastoral Suite, Choir Room, Treasury, MPR North/South, Main Foyer, Balcony, Gym, etc. (Pre-populated from the 25 existing tasks.)

A small **AuditLog** table is worth adding so any field change is recoverable — useful when contractors and staff are both editing the same record.

## 4. Core Features

Based on what you selected as priorities:

**Assignment and due dates.** Every task and sub-task can be assigned to a user. Each task has a due date and an optional "needs by" target. A "My Tasks" view shows each user just their work, sorted by due date and priority. Overdue items are flagged in red.

**Cost rollups and budget dashboard.** Sub-task costs auto-roll up to task totals (replacing the manual TOTAL cost column). A campus-wide dashboard shows: total backlog dollar value, spent vs. remaining, cost by category, cost by priority, cost by location, and completion percentage by priority band. Filterable by date range so you can see "what did we close out this quarter."

**Photos, receipts, and attachments.** Each task and sub-task accepts file uploads, classified as photo, receipt, spec sheet, or document. Photos are required on completion for camera installs, door hardware repairs, and TV mounts (configurable by category). Receipts are tagged with a dollar amount and vendor so the dashboard can show estimated versus actual spend per task and per category. Attachments stored in Supabase object storage; thumbnails generated automatically. Contractors upload from their phones in the field.

The baseline features that come with any task tracker are also in scope: list view with multi-column sort and filter, kanban-style board view by status, full-text search, comment threads, status change history, and CSV export.

## 5. Page Structure

Roughly seven screens cover the whole app:

1. **Dashboard** — campus-wide rollups, overdue list, recently completed.
2. **Task list** — sortable/filterable table, the spiritual successor to the current Word table.
3. **Task detail** — sub-tasks, costs, attachments, comments, assignment, history.
4. **My tasks** — personalized queue for each logged-in user.
5. **Board view** — kanban by status, optionally grouped by assignee or location.
6. **Reports** — exportable summaries for board meetings, insurance, vendor receipts.
7. **Admin** — user management, categories, locations, audit log.

A printable "work order" view of a single task is worth building for contractors who still want paper on site.

## 6. Recommended Tech Stack

For a small church team that wants a real web app without a heavy custom build, the cleanest path is:

- **Frontend:** Next.js (React) with Tailwind CSS. Mobile-friendly out of the box, since contractors will use phones in the field.
- **Backend + database + auth + file storage:** Supabase. Bundles Postgres, authentication (email + password as primary, Google OAuth as the optional second method per your decision), object storage for photos and receipts, and row-level security to enforce the role-based permissions above.
- **Hosting:** Vercel for the web app; Supabase hosts the database and storage. Both have generous free tiers, and a small paid plan (~$25–$45/month total) covers a team of this size comfortably.
- **Domain and TLS:** `tasks.oucsda.org` will be configured in Cloudflare DNS as a CNAME pointed at the Vercel deployment. Set the Cloudflare proxy to "DNS only" (grey cloud) so Vercel can issue and renew its own TLS certificate; flip it to proxied later only if you want Cloudflare's WAF in front.

Alternatives worth considering:

- **Airtable + Airtable Interfaces** — fastest to ship (days, not weeks), no custom code, but ~$20/user/month adds up with contractors and the role/permission model is coarser.
- **Microsoft 365 / SharePoint Lists + Power Apps** — if you're already paying for M365 and want to keep IT footprint in one place. Heavier to build, friendlier to church IT policies.
- **Full custom (Node/Express + Postgres + S3)** — most flexibility, most work. Only worth it if you have a developer on staff or a long-term commitment to the codebase.

## 7. Phased Rollout

**Phase 1 — Foundation (Week 1–2).** Set up project, schema, auth. Import the 25 existing tasks and their sub-tasks from the Word doc. Basic list view. Goal: every task currently in the doc is visible in the app.

**Phase 2 — Collaboration (Week 2–3).** Add user accounts, role-based access, assignment, due dates, status tracking, and the "My Tasks" view. Goal: real users can be invited and start working.

**Phase 3 — Field Use (Week 3–4).** Photo upload, mobile polish, comments, audit log. Goal: a contractor can use it from their phone on a job site.

**Phase 4 — Insight (Week 4–5).** Dashboard, cost rollups, reports, exports, printable work orders. Goal: you can answer budget and progress questions without opening a spreadsheet.

**Phase 5 — Polish and rollout (Week 5–6).** Wire up the `tasks.oucsda.org` domain through Cloudflare, install the church logo across login screen, header, and favicon, onboard staff and contractors, write a one-page user guide, retire the Word doc as the source of truth. Goal: nobody is double-entering anything.

## 8. Decisions Confirmed (2026-05-07)

The open questions from the prior draft are resolved. These are now requirements, not options.

**Notifications.** Email only. No SMS layer. Outbound email goes through Supabase Auth for account flows and a transactional service (Resend or Postmark) for assignment, due-date, and completion notices.

**Authentication.** No SSO. Email and password is the primary login method, with Google sign-in offered as an optional convenience. Both are supported natively by Supabase Auth.

**Contractor identity.** No external system to sync with. Contractor profile management is built into the app (see updated User entity in Section 3): admins invite contractors by email, contractors complete their own profile after first sign-in.

**Approval workflow.** Contractor self-attestation. When a contractor marks a sub-task done, it is final unless an admin reverses it. The audit log captures every status change so the trail is recoverable.

**Receipts.** Stored in the app, attached to the task or sub-task they belong to, tagged with vendor and dollar amount. The Attachment entity in Section 3 has been updated to support this. Receipt totals will be summed alongside estimated costs in the dashboard.

**Branding.** Logo assets received and stored in `C:\OUCtasks\logos` (Block, Full, Reverse, and LogoTEXT variants in BLACK, WHITE, and PMS 432). Brand color is Pantone 432 C (`#333F48`). Light backgrounds throughout the app, with PMS 432 reserved for primary buttons, links, and brand surfaces. The app will live at `tasks.oucsda.org`, with DNS managed in Cloudflare and TLS issued by Vercel. See Section 11 for the full palette and logo usage rules.

## 9. Migration of Existing Data

The current 25 tasks should be imported, not retyped. The cleanest path is to write a one-time script that parses the Word document's table and inserts each row as a Task plus its numbered sub-items as SubTask records. Categories and locations get inferred from keywords in the descriptions (e.g. "camera" → Surveillance; "FLC" → Family Life Center). This is a half-day of work and eliminates transcription errors.

## 10. Success Criteria

Six months in, the app is working if: nobody is opening the Word doc anymore; every active task has an owner and a due date; budget questions for the board can be answered in two clicks; contractors are uploading completion photos without being chased for them; and the backlog count is going down, not up.

## 11. Visual Design and Brand

Light backgrounds with the OUC brand color reserved for emphasis. The accent color is Pantone 432 C, which is a sophisticated near-black charcoal — by itself it would feel monochrome, so a small secondary accent is introduced for interactive elements that need to pop (links, primary buttons on hover, focus rings).

**Color palette.**

| Role | Token | Hex | Use |
|------|-------|-----|-----|
| Brand Primary | `--ouc-primary` | `#333F48` | Logo, headers, primary buttons, key UI surfaces |
| Brand Primary (hover) | `--ouc-primary-hover` | `#1F2830` | Button hover, active nav state |
| Accent | `--ouc-accent` | `#3B7BD9` | Links, focus rings, selected rows, info badges |
| Background | `--ouc-bg` | `#FFFFFF` | Page background |
| Surface | `--ouc-surface` | `#F7F8FA` | Cards, sidebars, table headers |
| Border | `--ouc-border` | `#E2E5EA` | Dividers, input borders |
| Text Primary | `--ouc-text` | `#1A1F25` | Body text |
| Text Muted | `--ouc-text-muted` | `#5C6773` | Secondary labels, captions |

**Status colors** (kept distinct from the brand palette for legibility on badges and dashboards):

| Status | Hex | Notes |
|--------|-----|-------|
| Not Started | `#8A94A6` | Neutral gray |
| In Progress | `#2563EB` | Blue |
| Blocked | `#DC2626` | Red |
| Done | `#16A34A` | Green |
| Overdue (modifier) | `#DC2626` | Red border / icon overlay on any non-Done task |

**Priority pills** use a single hue ramped by saturation so 1–5 reads as a gradient rather than a rainbow: light gray for P1, deepening to the brand charcoal for P5.

**Typography.** System UI stack for body (`-apple-system, "Segoe UI", Roboto, sans-serif`) — fast, no licensing, native on every platform. Headings use the same family at heavier weight; if a more church-styled face is wanted later, the wordmark in the logo suggests pairing with a serif like *Cormorant Garamond* or *EB Garamond* for headings, which I can swap in once you've decided.

**Logo usage rules.**

- **Header (light background):** `OUC Full Logo (PMS 432).png` at 32–40 px tall.
- **Login screen:** `OUC Full Logo (PMS 432).png` at ~120 px tall, centered above the form.
- **Printable work orders:** `OUC Full Logo (BLACK).png` for clean black-and-white print.
- **Favicon and PWA icon:** generated from `OUC Block Logo (PMS 432).png` at 16, 32, 64, 192, and 512 px.
- **Reverse / dark surfaces** (e.g. emailed PDFs with a dark header bar): `OUC Reverse Logo (PMS 432).png` or the WHITE variant.
- Maintain at least 1× the cap-height of "OAKWOOD" as clear space around the logo. Never recolor or distort.

A future task is to convert at least the Block and Full logos to SVG so they render perfectly at any size; the supplied PNGs are sufficient for first launch.
