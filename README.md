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
| `prisma/` | Prisma schema + `mysql_schema.sql` (MySQL 5.7 DDL, applied via `npm run db:schema`) |
| `src/` | Next.js application code (App Router, TypeScript, Tailwind) |
| `scripts/` | `apply-mysql-schema.mjs` — applies the MySQL DDL |

## Tech stack

- **Frontend:** Next.js (App Router) · TypeScript · Tailwind CSS
- **Database:** MySQL 5.7 via Prisma ORM
- **Auth:** NextAuth (credentials, bcrypt, JWT sessions)
- **File storage:** Vercel Blob (private store)
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

1. Create a MySQL database named `ouctasks` and a user with full grants on it
2. Put the connection string in `.env.local` as `DATABASE_URL`
3. Run `npm run db:schema` to apply `prisma/mysql_schema.sql`, then `npx prisma generate`

## Mockups

Open any of the HTML files in `docs/mockups/` directly in a browser to preview the design — no server needed:

- `dashboard.html` — campus rollups, charts, recent activity
- `login.html` — sign-in screen
- `task-detail.html` — drill-down for a single task

## License

Internal Oakwood University Church project. Not for external distribution.
