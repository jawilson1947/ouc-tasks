# GitHub Repository Setup — `ouctasks`

> **Status as of 2026-05-07 — prep complete.**
> Steps 1, 3, 6 (file relocations), and 7 are already done. Current folder structure matches Section 2 below. The `README.md` and `.gitignore` already exist at the repo root. **Resume at Step 2** (git config + commit), then jump straight to **Step 4** to create and push the GitHub repo.

> Read this top-to-bottom before running any commands. The order matters because `create-next-app` won't overwrite an existing folder cleanly, so we move our current artifacts into a `docs/` subfolder first.

## 1. Decisions

**Repo visibility — make it PRIVATE.** This repo will eventually contain operational data references, internal vendor info, and possibly `.env.example` files that hint at infrastructure. There is no benefit to a public repo for a single-org operational tool.

**Repo name.** `ouctasks` (lowercase) is the GitHub convention. The local Windows folder `C:\OUCtasks` and the GitHub repo `ouctasks` will work fine together — Windows is case-insensitive on the filesystem, and git URLs are consistently lowercase.

**Branch model.** `main` is the production branch. Use short-lived feature branches (`feat/login`, `fix/cost-rollup`) and squash-merge through pull requests. No long-lived `develop` branch — this team is too small to need it.

**Commit identity.** Set git to use your real name and email globally before committing.

## 2. Recommended Repo Layout

```
ouctasks/
├── .github/
│   └── workflows/             # CI later (lint, type-check, test)
├── .gitignore
├── .env.example               # template, no secrets
├── README.md
├── docs/
│   ├── application-plan.md    # the master plan
│   ├── REPO_SETUP.md          # this file
│   ├── mockups/               # static HTML mockups
│   │   ├── dashboard.html
│   │   ├── login.html
│   │   └── task-detail.html
│   └── logos/                 # source brand assets (master copies)
├── public/
│   └── logos/                 # runtime copies served by Next.js
├── supabase/
│   ├── migrations/
│   │   └── 0001_initial_schema.sql   # = our schema.sql, renamed
│   └── seed.sql               # optional dev seed data
├── scripts/
│   └── migrate-tasks.ts       # imports the 25 Word-doc tasks
├── src/
│   ├── app/                   # Next.js App Router
│   ├── components/
│   ├── lib/
│   │   └── supabase.ts        # client setup
│   └── types/
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.mjs
```

## 3. Setup Commands (run in order)

These assume you have Node.js 20+, git, and the GitHub CLI (`gh`) installed. If you don't have `gh`, use the GitHub web UI instead of the `gh repo create` step.

### Step 1 — Stage existing artifacts so the scaffold doesn't collide

```powershell
cd C:\OUCtasks
mkdir docs
mkdir docs\mockups
move application-plan.md   docs\
move REPO_SETUP.md         docs\
move schema.sql            docs\
move mockups\*.html        docs\mockups\
rmdir mockups
# Keep logos\ at the root for now — we'll copy a runtime set into public\ after scaffolding
```

### Step 2 — Initialize git and a starting README

```powershell
cd C:\OUCtasks
git init -b main
git config user.name  "Jim Wilson"
git config user.email "jwilson@digitalsupportsystems.com"

# Minimal README so the repo isn't empty on first push
@"
# OUC Tasks

Infrastructure task management for Oakwood University Church.
See docs/application-plan.md for the full plan.

Live at: https://tasks.oucsda.org
"@ | Out-File -Encoding utf8 README.md
```

### Step 3 — Add a `.gitignore` before any node_modules show up

Save this as `C:\OUCtasks\.gitignore`:

```gitignore
# dependencies
node_modules/
.pnp
.pnp.js

# next.js
.next/
out/

# environment
.env
.env*.local
!.env.example

# build / cache
*.tsbuildinfo
next-env.d.ts
.turbo/

# editor / OS
.vscode/
.idea/
.DS_Store
Thumbs.db
desktop.ini

# logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# supabase local
supabase/.branches
supabase/.temp
```

### Step 4 — First commit, then create the GitHub repo

```powershell
git add .
git commit -m "Initial commit: plan, schema, branding, mockups"

# Option A — using gh CLI (recommended)
gh repo create ouctasks --private --source . --remote origin --push

# Option B — manual: create the empty private repo at github.com/<you>/ouctasks first, then:
git remote add origin https://github.com/<your-username>/ouctasks.git
git branch -M main
git push -u origin main
```

### Step 5 — Scaffold Next.js into the repo root

```powershell
cd C:\OUCtasks
npx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*" --no-eslint --use-npm
# When prompted, accept overwriting the existing README.md (we'll re-add notes after).
```

This adds `package.json`, `next.config.mjs`, `tailwind.config.ts`, `tsconfig.json`, and the `src/app/` skeleton. Your `docs/`, `logos/`, and `.gitignore` are preserved.

### Step 6 — Wire up Supabase

```powershell
npm install @supabase/supabase-js @supabase/ssr
mkdir supabase\migrations
move docs\schema.sql supabase\migrations\0001_initial_schema.sql

# .env.example template (commit this)
@"
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=ONLY_USE_SERVER_SIDE
"@ | Out-File -Encoding utf8 .env.example

# .env.local (DO NOT commit — already in .gitignore)
copy .env.example .env.local
# then edit .env.local with the real values from Supabase project settings
```

Create the actual Supabase project at https://supabase.com (free tier is fine to start). Once created, run the contents of `supabase/migrations/0001_initial_schema.sql` in the Supabase SQL editor — that bootstraps every table, view, trigger, and RLS policy plus the seed reference data.

### Step 7 — Copy runtime logo assets into `public/`

```powershell
mkdir public\logos
copy "logos\OUC Full Logo (PMS 432).png"     public\logos\ouc-full-pms432.png
copy "logos\OUC Reverse Logo (PMS 432).png"  public\logos\ouc-reverse-pms432.png
copy "logos\OUC Block Logo (PMS 432).png"    public\logos\ouc-block-pms432.png
copy "logos\OUC Full Logo (BLACK).png"       public\logos\ouc-full-black.png
```

Use kebab-case filenames in `public/` so Next.js URLs are clean. The masters in `logos/` keep their original filenames as a reference.

### Step 8 — Commit the scaffolded app

```powershell
git add .
git commit -m "Scaffold Next.js + Tailwind + Supabase, copy runtime logos"
git push
```

### Step 9 — Connect Vercel for auto-deploy (later)

Once the app actually builds and runs locally with `npm run dev`, connect the GitHub repo to Vercel. Every push to `main` will deploy to production; PRs get preview URLs. Add `tasks.oucsda.org` as a custom domain in Vercel, then add the matching CNAME in Cloudflare with the orange cloud OFF (DNS only) so Vercel issues TLS.

## 4. What to do — and not do — before pushing

**Do** add a short README with at least one paragraph about what the project is. Empty repos are confusing later.

**Do** commit the `.env.example` file with placeholder values so collaborators know what env vars exist.

**Do not** commit the real `.env.local`, the Supabase service role key, any `.pem` files, or anything inside a folder named `secrets/` or `keys/`.

**Do not** run `git rm -rf` or `git push --force` on `main` after the first push. Use feature branches.

## 5. Want me to do any of this for you?

I can prepare the entire scaffolded folder structure (everything in steps 1, 3, and the docs reorg) right here in `C:\OUCtasks` so all that's left for you is steps 2, 4, 5, 6, and 9 — the ones that need your GitHub credentials, your Supabase project, and your Vercel account. Just say the word.
