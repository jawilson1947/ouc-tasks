# OUC Tasks

> Church Infrastructure task management for administrators, staff, and sub-contractors.

A web app that replaces the legacy Word-document task list at **Oakwood University Church** with a real platform for tracking, assigning, costing, and closing out IT and facilities work across the campus.

**Repository:** `ouc-tasks`
**Live site:** https://tasks.oucsda.org *(once deployed)*
**Brand color:** Pantone 432 C — `#333F48`

---

## What's in this repo

| Path | Purpose |
|------|---------|
| `docs/application-plan.md` | Full implementation plan — read this first |
| `docs/REPO_SETUP.md` | Step-by-step repo and infrastructure setup guide |
| `docs/mockups/` | Static HTML mockups (dashboard, login, task detail) |
| `logos/` | Master brand assets (original filenames preserved) |
| `public/logos/` | Runtime logo copies with web-safe kebab-case names |
| `supabase/migrations/` | Numbered SQL migrations — run on Supabase project |
| `src/` | Next.js application code (App Router, TypeScript, Tailwind) |
| `scripts/` | One-off scripts including the legacy task migration |

## Tech stack

- **Frontend:** Next.js (App Router) · TypeScript · Tailwind CSS
- **Backend / DB / Auth / Storage:** Supabase (PostgreSQL · Row-Level Security)
- **Hosting:** Vercel
- **DNS:** Cloudflare
- **Charts:** Chart.js

## Local development

> The repo isn't scaffolded with Next.js yet — see `docs/REPO_SETUP.md` Step 5.

After scaffolding:

```bash
npm install
cp .env.example .env.local        # then fill in real values
npm run dev                       # http://localhost:3000
```

## Database setup

1. Create a new Supabase project at https://supabase.com
2. In the project SQL editor, run `supabase/migrations/0001_initial_schema.sql`
3. Copy the project URL and anon key into `.env.local`

## Mockups

Open any of the HTML files in `docs/mockups/` directly in a browser to preview the design — no server needed:

- `dashboard.html` — campus rollups, charts, recent activity
- `login.html` — sign-in screen
- `task-detail.html` — drill-down for a single task

## License

Internal Oakwood University Church project. Not for external distribution.
