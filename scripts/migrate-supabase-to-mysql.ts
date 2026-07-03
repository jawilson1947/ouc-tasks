/**
 * =============================================================================
 * OUC Tasks — one-time data migration: Supabase Postgres → MySQL
 * =============================================================================
 * Copies every row from the Supabase project into the MySQL database created
 * by supabase/migrations/mysql_schema.sql, in foreign-key order.
 *
 * Prerequisites:
 *   1. mysql_schema.sql has been run against the target MySQL database
 *      (tables exist, seed data present).
 *   2. .env.local contains the Supabase vars (URL + SERVICE_ROLE key) and
 *      DATABASE_URL pointing at the target MySQL.
 *
 * Run:
 *   npm run migrate:data
 *   npm run migrate:data -- --dry-run     (fetch + report counts, no writes)
 *
 * Notes:
 *   • Idempotent: rows are inserted with ON DUPLICATE KEY UPDATE, so re-runs
 *     are safe.
 *   • Passwords do NOT migrate — Supabase Auth never exposes password hashes.
 *     Every user's password_hash is left NULL; users must set a password via
 *     the reset flow (or sign in via an OAuth provider) after cutover.
 *   • email_verified / last_login are pulled from auth.users via the Admin API.
 *   • Storage files are NOT copied here — see migrate-storage-to-blob.ts.
 * =============================================================================
 */

import { createClient } from '@supabase/supabase-js'
import mysql from 'mysql2/promise'

const DRY_RUN = process.argv.includes('--dry-run')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DATABASE_URL = process.env.DATABASE_URL

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
if (!DATABASE_URL && !DRY_RUN) {
  console.error('Missing DATABASE_URL')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
})

// ---------------------------------------------------------------------------
// Value converters (Postgres/JS → MySQL)
// ---------------------------------------------------------------------------

/** ISO timestamptz → 'YYYY-MM-DD HH:MM:SS' in UTC (MySQL DATETIME). */
function ts(v: string | null): string | null {
  if (v == null) return null
  return new Date(v).toISOString().slice(0, 19).replace('T', ' ')
}

/** Postgres date → 'YYYY-MM-DD'. */
function d(v: string | null): string | null {
  if (v == null) return null
  return String(v).slice(0, 10)
}

function bool(v: boolean | null): number | null {
  return v == null ? null : v ? 1 : 0
}

function json(v: unknown): string | null {
  return v == null ? null : JSON.stringify(v)
}

// ---------------------------------------------------------------------------
// Fetch all rows of a Supabase table (paginated past the 1000-row cap)
// ---------------------------------------------------------------------------

async function fetchAll(table: string): Promise<Record<string, any>[]> {
  const rows: Record<string, any>[] = []
  const page = 1000
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + page - 1)
    if (error) throw new Error(`fetch ${table}: ${error.message}`)
    rows.push(...(data ?? []))
    if (!data || data.length < page) break
  }
  return rows
}

/** auth.users metadata keyed by user id (email_confirmed_at, last_sign_in_at). */
async function fetchAuthUsers(): Promise<Map<string, any>> {
  const map = new Map<string, any>()
  for (let pageNum = 1; ; pageNum++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page: pageNum,
      perPage: 1000,
    })
    if (error) throw new Error(`auth.admin.listUsers: ${error.message}`)
    for (const u of data.users) map.set(u.id, u)
    if (data.users.length < 1000) break
  }
  return map
}

// ---------------------------------------------------------------------------
// MySQL bulk upsert
// ---------------------------------------------------------------------------

async function upsert(
  conn: mysql.Connection,
  table: string,
  columns: string[],
  rows: (string | number | null)[][],
) {
  if (rows.length === 0) {
    console.log(`  ${table}: 0 rows — skipped`)
    return
  }
  if (DRY_RUN) {
    console.log(`  ${table}: ${rows.length} rows (dry run — not written)`)
    return
  }
  const collist = columns.map((c) => `\`${c}\``).join(', ')
  const chunk = 500
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk)
    const placeholders = slice
      .map(() => `(${columns.map(() => '?').join(', ')})`)
      .join(', ')
    await conn.execute(
      `INSERT INTO \`${table}\` (${collist}) VALUES ${placeholders}
       ON DUPLICATE KEY UPDATE \`${columns[0]}\` = \`${columns[0]}\``,
      slice.flat(),
    )
  }
  console.log(`  ${table}: ${rows.length} rows migrated`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`Supabase → MySQL data migration ${DRY_RUN ? '(DRY RUN)' : ''}`)

  console.log('\nFetching from Supabase…')
  const [
    authUsers,
    categories,
    locations,
    profiles,
    contractors,
    tasks,
    subtasks,
    attachments,
    comments,
    auditLogs,
  ] = await Promise.all([
    fetchAuthUsers(),
    fetchAll('category'),
    fetchAll('location'),
    fetchAll('user_profile'),
    fetchAll('contractor'),
    fetchAll('task'),
    fetchAll('subtask'),
    fetchAll('attachment'),
    fetchAll('comment'),
    fetchAll('audit_log'),
  ])
  console.log(
    `  ${categories.length} categories, ${locations.length} locations, ` +
      `${profiles.length} users (${authUsers.size} auth), ${contractors.length} contractors,\n` +
      `  ${tasks.length} tasks, ${subtasks.length} subtasks, ${attachments.length} attachments, ` +
      `${comments.length} comments, ${auditLogs.length} audit rows`,
  )

  const conn = DRY_RUN
    ? (null as unknown as mysql.Connection)
    : await mysql.createConnection(DATABASE_URL!)
  if (!DRY_RUN) await conn.execute('SET FOREIGN_KEY_CHECKS = 0')

  console.log('\nWriting to MySQL…')

  // 1. Reference tables. Seeded names may already exist with different
  //    auto-increment ids — migrate by id so task FKs stay valid. If the
  //    seed rows collide on the unique name with a different id, clear the
  //    seed rows first (fresh DB) or reconcile manually.
  await upsert(conn, 'category', ['id', 'name', 'color_hex', 'sort_order'],
    categories.map((r) => [r.id, r.name, r.color_hex, r.sort_order]))

  await upsert(conn, 'location', ['id', 'name', 'building', 'sort_order'],
    locations.map((r) => [r.id, r.name, r.building, r.sort_order]))

  // 2. Users (merge user_profile + auth.users)
  await upsert(
    conn,
    'user_profile',
    ['id', 'email', 'password_hash', 'email_verified', 'full_name', 'role',
     'phone', 'active', 'last_login', 'company_name', 'trade',
     'license_number', 'insurance_expiry', 'default_labor_rate',
     'billing_email', 'mailing_address', 'notes', 'created_at', 'updated_at'],
    profiles.map((r) => {
      const au = authUsers.get(r.id)
      return [
        r.id, r.email,
        null, // password hashes cannot be exported from Supabase Auth
        au?.email_confirmed_at ? 1 : 0,
        r.full_name, r.role, r.phone, bool(r.active),
        ts(r.last_login ?? au?.last_sign_in_at ?? null),
        r.company_name, r.trade, r.license_number,
        d(r.insurance_expiry), r.default_labor_rate,
        r.billing_email, r.mailing_address, r.notes,
        ts(r.created_at), ts(r.updated_at),
      ]
    }),
  )

  // 3. Contractors
  await upsert(
    conn,
    'contractor',
    ['id', 'business_name', 'primary_first_name', 'primary_last_name',
     'primary_email', 'primary_phone', 'address_line1', 'address_line2',
     'city', 'state', 'zipcode', 'business_phone', 'notes', 'active',
     'created_by', 'created_at', 'updated_at'],
    contractors.map((r) => [
      r.id, r.business_name, r.primary_first_name, r.primary_last_name,
      r.primary_email, r.primary_phone, r.address_line1, r.address_line2,
      r.city, r.state, r.zipcode, r.business_phone, r.notes, bool(r.active),
      r.created_by, ts(r.created_at), ts(r.updated_at),
    ]),
  )

  // 4. Tasks
  await upsert(
    conn,
    'task',
    ['id', 'legacy_id', 'title', 'description', 'priority', 'status',
     'category_id', 'location_id', 'assignee_id', 'contractor_id',
     'due_date', 'needs_by_date', 'notes', 'created_by', 'created_at',
     'updated_at', 'completed_at', 'approved_at', 'approved_by',
     'requested_approval_at'],
    tasks.map((r) => [
      r.id, r.legacy_id, r.title, r.description, r.priority, r.status,
      r.category_id, r.location_id, r.assignee_id, r.contractor_id,
      d(r.due_date), d(r.needs_by_date), r.notes, r.created_by,
      ts(r.created_at), ts(r.updated_at), ts(r.completed_at),
      ts(r.approved_at), r.approved_by, ts(r.requested_approval_at),
    ]),
  )

  // 5. Subtasks
  await upsert(
    conn,
    'subtask',
    ['id', 'task_id', 'sequence', 'description', 'labor_cost',
     'equipment_cost', 'status', 'completed_at', 'completed_by',
     'created_at', 'updated_at'],
    subtasks.map((r) => [
      r.id, r.task_id, r.sequence, r.description, r.labor_cost,
      r.equipment_cost, r.status, ts(r.completed_at), r.completed_by,
      ts(r.created_at), ts(r.updated_at),
    ]),
  )

  // 6. Attachments (storage_path keeps the Supabase path; the Blob migration
  //    script rewrites it after copying the file)
  await upsert(
    conn,
    'attachment',
    ['id', 'task_id', 'subtask_id', 'type', 'filename', 'storage_path',
     'content_type', 'size_bytes', 'caption', 'receipt_amount', 'vendor',
     'receipt_date', 'uploaded_by', 'uploaded_at'],
    attachments.map((r) => [
      r.id, r.task_id, r.subtask_id, r.type, r.filename, r.storage_path,
      r.content_type, r.size_bytes, r.caption, r.receipt_amount, r.vendor,
      d(r.receipt_date), r.uploaded_by, ts(r.uploaded_at),
    ]),
  )

  // 7. Comments
  await upsert(
    conn,
    'comment',
    ['id', 'task_id', 'author_id', 'body', 'created_at', 'edited_at'],
    comments.map((r) => [
      r.id, r.task_id, r.author_id, r.body, ts(r.created_at), ts(r.edited_at),
    ]),
  )

  // 8. Audit log
  await upsert(
    conn,
    'audit_log',
    ['id', 'table_name', 'record_id', 'action', 'changed_by', 'changed_at',
     'old_values', 'new_values'],
    auditLogs.map((r) => [
      r.id, r.table_name, r.record_id, r.action, r.changed_by,
      ts(r.changed_at), json(r.old_values), json(r.new_values),
    ]),
  )

  if (!DRY_RUN) {
    await conn.execute('SET FOREIGN_KEY_CHECKS = 1')

    // Verification counts
    console.log('\nVerification (MySQL row counts):')
    for (const t of ['category', 'location', 'user_profile', 'contractor',
                     'task', 'subtask', 'attachment', 'comment', 'audit_log']) {
      const [rows] = await conn.execute(`SELECT COUNT(*) AS n FROM \`${t}\``)
      console.log(`  ${t}: ${(rows as any)[0].n}`)
    }
    await conn.end()
  }

  console.log('\nDone.')
  console.log('REMINDERS:')
  console.log('  • Password hashes did not migrate — users must reset passwords.')
  console.log('  • Run the 0006 approval backfill (Section 12 of mysql_schema.sql) if not already applied.')
  console.log('  • Run migrate-storage-to-blob.ts to copy files and rewrite attachment.storage_path.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
