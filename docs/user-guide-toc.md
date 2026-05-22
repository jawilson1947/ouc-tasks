# OUC Tasks — User Guide

> Combined user guide covering all roles (viewer, editor, approver, admin).
> Role-specific behavior is called out inline within each chapter rather
> than split into separate guides.

> **Status:** Table of contents only — no body content yet.

---

## 1. Welcome & Orientation

- 1.1 What OUC Tasks is for — replacing the legacy Word-doc task list with a live tracker for IT and facilities work across the Oakwood University Church campus
- 1.2 Who uses it — staff, sub-contractors, approvers, administrators
- 1.3 The four roles at a glance — **viewer**, **editor**, **approver**, **admin** (what each can and can't do)
- 1.4 What you'll find on every screen — the brand-color sidebar, the top search bar, the user badge, the "Log Off" button
- 1.5 How URLs are structured — `tasks.oucsda.org`, route names, and what the legacy `#` IDs mean

## 2. Signing In & Account Basics

- 2.1 Signing in at `/login` — email + password, "Keep me signed in"
- 2.2 Forgotten passwords — requesting a reset email at `/auth/forgot`
- 2.3 Setting a new password from a reset link — `/auth/reset`, password requirements, link expiration
- 2.4 Signing out — the Log Off button in the sidebar
- 2.5 Getting an account — admins invite users; there is no self-signup
- 2.6 What happens if you hit the app without signing in — automatic redirect to `/login?next=…`

## 3. Finding Your Way Around

- 3.1 The sidebar — Dashboard, All Tasks, My Tasks, Approve Tasks, Board View, Reports, Receipts, Contractors, Settings
- 3.2 Greyed-out menu items — why "Approve Tasks" is disabled until you have approver permission
- 3.3 The Settings group — Locations, Categories, User Management, Admin Dashboard (the last two are admin-only)
- 3.4 The top search bar — what it searches across (tasks, sub-tasks, vendors, locations)
- 3.5 Reading the user badge in the sidebar footer — your display name, sign-in status

## 4. The Dashboard

- 4.1 What the Dashboard is for — a single-glance read on the backlog
- 4.2 Stat cards explained — Total Backlog (dollars + task count + labor/equipment split), Done, In Progress, Blocked, Not Started
- 4.3 The High Priority Tasks list — top 6 by priority then due date, with the approval badge on each row
- 4.4 The "View all" link — jumping into the filtered All Tasks view
- 4.5 Export buttons (placeholder) — what they will do once wired up

## 5. Working with Tasks

- 5.1 The task model — what a task is (title, description, priority 1-5, status, category, location, contractor, assignee, due date, internal notes)
- 5.2 Browsing **All Tasks** at `/tasks` — the table layout, columns, what the colored priority dot means
- 5.3 Searching task titles — the text search box and how it composes with other filters
- 5.4 Filter chips — Status (Not Started / In Progress / Blocked / Done), Priority (P1-P5), Category
- 5.5 Clearing filters — the "Clear" link and the empty-state message
- 5.6 Opening a task — clicking the title row to land on the detail page
- 5.7 **My Tasks** at `/tasks/mine` — only the tasks assigned to you, grouped by status
- 5.8 What you see on a task — header (priority bubble, title, approval badge, legacy `#` id, status pill, category, location, due date), description, sub-tasks, photos, receipts, the Details side rail, the Cost Summary
- 5.9 Editing a task at `/tasks/[id]/edit` — every field on the form, with field-by-field guidance
- 5.10 Internal Notes — the modal field that stays out of the main form body
- 5.11 Creating a new task at `/tasks/new` — required fields, role restriction (admin, editor, or approver only; viewers see a redirect)
- 5.12 Deleting a task — when the Delete button appears, the confirmation modal, and what gets cascade-deleted (sub-tasks, photos, receipts, comments)

## 6. Sub-tasks

- 6.1 Why sub-tasks exist — the numbered work items that roll up into a task's cost and progress
- 6.2 Reading the sub-task panel on the task detail page — sequence number, description, labor cost, equipment cost, status
- 6.3 Adding a sub-task from the Sub-tasks editor on the edit page
- 6.4 Editing a sub-task inline — labor/equipment dollars, status (Not Started / In Progress / Done), and the strikethrough styling once done
- 6.5 Deleting a sub-task
- 6.6 How sub-task totals roll up into the parent task's Cost Summary
- 6.7 What happens when every sub-task is Done — the auto-complete trigger that moves the parent task to Done

## 7. Photos & Documents (Attachments)

- 7.1 Where attachments live — the Attachments card on each task detail / edit page
- 7.2 What you can upload — JPEG, PNG, WebP images, plus PDF documents (max 50 MB)
- 7.3 Drag-and-drop and click-to-browse upload flow
- 7.4 Adding a caption with the upload
- 7.5 Viewing photos — the thumbnail grid (2 columns on phone, 3 on tablet+) and the lightbox
- 7.6 Viewing PDFs — opening in a new tab via signed URL
- 7.7 Deleting a photo or document — who's allowed to delete (admins and the original uploader)

## 8. Receipts

- 8.1 The Receipts card on the task detail page — listing receipts per task, with vendor, date, amount, and caption
- 8.2 Uploading a receipt on a task — supported types (JPEG, PNG, WebP, PDF, max 10 MB), vendor, amount, and date fields
- 8.3 Viewing a receipt — image lightbox or PDF in a new tab
- 8.4 Deleting a receipt
- 8.5 The campus-wide **Receipts** page at `/receipts` — every receipt across every task, sorted newest first, with the running total spend
- 8.6 Jumping from a receipt to its parent task

## 9. The Board View

- 9.1 What the Board is for — a four-column Kanban grouped by status (Not Started / In Progress / Blocked / Done)
- 9.2 Reading a card — priority bubble, title, approval badge, category pill, location, total cost, due date
- 9.3 Column subtotals — per-status dollar rollup at the top of each column
- 9.4 Opening a task from a card
- 9.5 Drag-and-drop status changes (planned) — what currently works and what's still pending

## 10. Reports

- 10.1 What the Reports page covers — Cost by Category, Cost by Priority, Status Distribution, Cost by Location (top 12)
- 10.2 Reading a report card — the horizontal bar, dollar value, percentage share of the grand total
- 10.3 The Reports Export Bar — what each option does
- 10.4 Exporting CSV — Full Task List vs. Report Summary
- 10.5 Exporting PDF — Summary Landscape, Summary Portrait, and the Formal Task Report
- 10.6 The Formal Task Report at `/reports/print`
  - 10.6.1 Why it opens in a new tab in preview mode
  - 10.6.2 Picking a status filter (Not Started / In Progress / Blocked / Done) before generating
  - 10.6.3 Generating, printing, or saving as PDF
  - 10.6.4 Clearing the filter to return to the empty state
- 10.7 Tips for getting a clean print — page orientation, hidden chrome, what the print header looks like

## 11. Contractors

- 11.1 What "contractors" means in OUC Tasks — businesses you contract with, not user accounts
- 11.2 Browsing the contractor list — business name, primary contact, phone, location, open / total task counts
- 11.3 Adding a new contractor at `/contractors/new` — required fields, address, primary contact name + email + phone, business phone
- 11.4 Marking a contractor inactive vs. deleting them
- 11.5 Editing a contractor at `/contractors/[id]/edit`
- 11.6 Linking a contractor to a task — the Contractor dropdown on the task form
- 11.7 How a linked contractor surfaces on the task detail page — name, primary contact, click-to-call phone, deep link back to the contractor record

## 12. Task Approval (Approver / Admin)

> The whole chapter only applies to users with the **approver** role or to **admins** (who inherit approver power). Other users see the Approve Tasks menu item greyed out.

- 12.1 What approval means — permission for the assignee to begin work; approval does **not** change a task's status
- 12.2 The ✅ Approved / ⏳ Awaiting badge — where it shows up (All Tasks, My Tasks, task detail header, Board cards, Dashboard high-priority list)
- 12.3 Done tasks are pre-approved — what the backfill did to historical tasks
- 12.4 The Approve Tasks queue at `/approvals` — every non-Done task sorted by priority then due date, with awaiting-vs-approved counts in the header
- 12.5 What's in each queue row — priority, title, category, location, status, approval badge, total cost, due date, "Review" button
- 12.6 The Review page at `/approvals/[id]`
  - 12.6.1 The approval status banner — current state, who approved, when, and whether revocation is still possible
  - 12.6.2 Editing the task while reviewing — same form as the regular edit page, but submitting as an approver bypasses owner checks
  - 12.6.3 Editing sub-tasks, photos, and receipts in approver context
  - 12.6.4 The sticky footer — Approve, Revoke approval, Delete
- 12.7 Approving a task — what happens to `approved_at` / `approved_by`, what the assignee receives by email
- 12.8 Revoking an approval — when it's allowed (only while status is Not Started), why the button disappears once work begins, and what the assignee gets by email
- 12.9 Updating a task as approver — the diff that gets included in the email to the assignee (title, description, priority, status, category, location, contractor, assignee, due date, notes)
- 12.10 Deleting a task as approver — the confirmation modal, the cascade behavior, and the deletion notice email
- 12.11 The email pipeline — what the assignee actually sees in their inbox (subjects, deep links back to the task)
- 12.12 What "email failed" flash messages mean and how to recover (resend by re-running the action)
- 12.13 Limits of approval — work may technically proceed before approval; the badge is advisory, not enforced

## 13. Settings — Locations & Categories

- 13.1 Why these exist — every task is filed under one Location and one Category; this is where the dropdown values come from
- 13.2 Browsing Locations at `/settings/locations`
- 13.3 Adding a Location at `/settings/locations/new` — name, building (optional), sort order
- 13.4 Editing a Location at `/settings/locations/[id]/edit`
- 13.5 Deleting a Location — what happens if tasks still reference it
- 13.6 Browsing Categories at `/settings/categories`
- 13.7 Adding a Category at `/settings/categories/new` — name, color, sort order, and where the color shows up (badges across the app)
- 13.8 Editing a Category
- 13.9 Deleting a Category — same caveat about referenced tasks
- 13.10 Who can change these — admins write; everyone else can read

## 14. User Management (Admin Only)

- 14.1 Who sees this — only `role = 'admin'`; everyone else hits a "needs admin role" screen
- 14.2 The user list at `/admin/users` — name, email, role pill, last login, active status, role counts in the header
- 14.3 Inviting a new user — the New User form, full name, email, role choice, admin-set vs. auto-generated temporary password
- 14.4 The one-time temporary password — copying it to the clipboard, why it's only shown once, how to share it with the new user
- 14.5 Changing a user's role — admin / editor / approver / viewer, and what each role implies for the app
- 14.6 Deactivating a user vs. deleting them
- 14.7 Why you can't delete your own account
- 14.8 Legacy roles — handling rows that still say `staff` or `contractor` from before the role simplification

## 15. The Admin Dashboard

- 15.1 What `/admin` shows — top-line stat cards (active users, tasks, sub-tasks, receipts) and read-only inventories
- 15.2 The user inventory section — same data as User Management but read-only, with a "Manage →" jump for admins
- 15.3 The Categories inventory — color swatch, name, sort order
- 15.4 The Locations inventory — name, building
- 15.5 Read-only access for non-admins — what's visible and what's hidden

## 16. Notifications & Email

- 16.1 What triggers an email today — task approval, revocation, approver edits (with diff), approver deletions, and password reset links
- 16.2 What an approval notification email looks like in the assignee's inbox — subject line, body content, deep link back to the task
- 16.3 Receiving a password-reset email
- 16.4 Email delivery is best-effort — what the "email notification failed" flash means in the approver UI
- 16.5 What is **not** sent by email yet — task assignment, sub-task completion, comments (planned; out of scope for v1)

## 17. Tips, Conventions & Troubleshooting

- 17.1 What the legacy `#` IDs mean — they map back to rows 1-25 of the original Word doc
- 17.2 Priority numbers — what P1 through P5 mean (Lowest → Highest)
- 17.3 Status meanings — Not Started, In Progress, Blocked, Done
- 17.4 Time zones and dates — how due dates and timestamps are displayed
- 17.5 Why a button is greyed out — common cases (wrong role, status lock, upload still loading)
- 17.6 "Not authorized" redirects — what they mean and how to get the right role
- 17.7 Browser support — Chromium-based browsers, Safari, Firefox
- 17.8 Reporting a problem — who to contact and what to include

## 18. Reference

- 18.1 Role permission matrix — admin / editor / approver / viewer × create task / edit task / delete task / approve task / manage users / manage settings
- 18.2 Sidebar map — every menu item and the URL it points to
- 18.3 Status, priority, and category color legend
- 18.4 Glossary — assignee, contractor, sub-task, attachment, legacy ID, approval, revocation, RLS, signed URL
- 18.5 What's coming next — items the UI marks as "Coming soon" (drag-and-drop on the Board, in-app notification bell, comments, the audit log feed on the dashboard)
