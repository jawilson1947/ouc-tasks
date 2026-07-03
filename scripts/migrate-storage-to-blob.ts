/**
 * =============================================================================
 * OUC Tasks — one-time file migration: Supabase Storage → Vercel Blob (PRIVATE)
 * =============================================================================
 * Companion to migrate-supabase-to-mysql.ts (run that first — it copies the
 * attachment rows with their original Supabase storage_path values).
 *
 * The Vercel Blob store is PRIVATE, so attachment.storage_path holds the blob
 * *pathname* — which is identical to the legacy Supabase object path. That
 * means the DB rows never change; this script only copies the bytes:
 *
 * For every attachment row in MySQL:
 *   1. idempotency check: get(storage_path, { access: 'private' }) — if the
 *      blob already exists, skip the row (already migrated)
 *   2. otherwise download the file from the Supabase Storage bucket
 *      (NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET, service-role key)
 *   3. put() it to Vercel Blob at the SAME path with access:'private' and
 *      addRandomSuffix:false — storage_path in the DB stays as-is
 *
 * Prerequisites (.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *   NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET (default 'receipts'),
 *   DATABASE_URL (target MySQL), BLOB_READ_WRITE_TOKEN (Vercel Blob —
 *   required even for --dry-run, since the idempotency check calls get()).
 *
 * Run:
 *   npm run migrate:storage
 *   npm run migrate:storage -- --dry-run   (report what would move, no writes)
 *
 * Notes:
 *   • Idempotent: rows whose blob already exists in the store are skipped,
 *     so re-runs only retry previous failures.
 *   • Failures are logged per-row and don't abort the run; re-run to retry.
 * =============================================================================
 */

import { createClient } from '@supabase/supabase-js'
import { get, put } from '@vercel/blob'
import mysql from 'mysql2/promise'

const DRY_RUN = process.argv.includes('--dry-run')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DATABASE_URL = process.env.DATABASE_URL
const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? 'receipts'

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL')
  process.exit(1)
}
if (!process.env.BLOB_READ_WRITE_TOKEN) {
  // get() needs the token even in dry-run (idempotency check hits the store).
  console.error('Missing BLOB_READ_WRITE_TOKEN (required for --dry-run too)')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
})

type AttachmentRow = {
  id: string
  storage_path: string
  filename: string
  content_type: string | null
}

/** True if the blob already exists in the private store. */
async function blobExists(pathname: string): Promise<boolean> {
  const existing = await get(pathname, { access: 'private' })
  return existing !== null
}

async function main() {
  console.log(
    `Supabase Storage → Vercel Blob (private) migration ${DRY_RUN ? '(DRY RUN)' : ''}\n` +
      `  bucket: ${BUCKET}`,
  )

  const conn = await mysql.createConnection(DATABASE_URL!)

  const [rows] = await conn.execute(
    `SELECT id, storage_path, filename, content_type
       FROM attachment
      ORDER BY uploaded_at`,
  )
  const attachments = rows as AttachmentRow[]
  await conn.end()

  console.log(`\n${attachments.length} attachment rows to check.`)

  let ok = 0
  let skipped = 0
  let failed = 0

  for (const att of attachments) {
    const label = `${att.id} (${att.storage_path})`

    try {
      // 1. Idempotency: blob already in the store → nothing to do.
      if (await blobExists(att.storage_path)) {
        console.log(`  skip (already migrated) ${label}`)
        skipped += 1
        continue
      }

      if (DRY_RUN) {
        console.log(`  would migrate ${label}`)
        ok += 1
        continue
      }

      // 2. Download from Supabase Storage
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .download(att.storage_path)
      if (error || !data) {
        throw new Error(`download failed: ${error?.message ?? 'no data'}`)
      }

      // 3. Upload to Vercel Blob at the SAME path (private, no suffix) —
      // storage_path in the DB is already this pathname, so no UPDATE needed.
      await put(att.storage_path, data, {
        access: 'private',
        addRandomSuffix: false,
        ...(att.content_type ? { contentType: att.content_type } : {}),
      })

      console.log(`  migrated ${label}`)
      ok += 1
    } catch (e) {
      failed += 1
      console.error(`  FAILED ${label}: ${e instanceof Error ? e.message : e}`)
    }
  }

  console.log(
    `\nDone. ${ok} ${DRY_RUN ? 'would be migrated' : 'migrated'}, ` +
      `${skipped} already migrated, ${failed} failed.`,
  )
  if (failed > 0) {
    console.log('Failed rows were not copied — re-run to retry.')
    process.exit(1)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
