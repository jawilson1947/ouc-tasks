/**
 * Applies prisma/mysql_schema.sql to the MySQL database in
 * DATABASE_URL. Parses the file statement-by-statement, honouring
 * DELIMITER $$ ... DELIMITER ; blocks (mysql2 can't process DELIMITER).
 *
 * Run:  node --env-file=.env.local scripts/apply-mysql-schema.mjs
 */
import { readFile } from 'node:fs/promises'
import mysql from 'mysql2/promise'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('Missing DATABASE_URL')
  process.exit(1)
}

const sql = await readFile('prisma/mysql_schema.sql', 'utf8')

// ---------------------------------------------------------------------------
// Split into executable statements, respecting DELIMITER changes.
// ---------------------------------------------------------------------------
const statements = []
let delimiter = ';'
let buf = ''

for (const rawLine of sql.split('\n')) {
  const line = rawLine
  const trimmed = line.trim()

  // Skip whole-line comments everywhere (a comment ending in ';' must not
  // be mistaken for a statement terminator) and blank lines between statements
  if (trimmed.startsWith('--')) continue
  if (buf === '' && trimmed === '') continue

  const delimMatch = trimmed.match(/^DELIMITER\s+(\S+)/i)
  if (delimMatch) {
    if (buf.trim()) {
      statements.push(buf.trim())
      buf = ''
    }
    delimiter = delimMatch[1]
    continue
  }

  buf += line + '\n'

  // Statement complete when the buffer (sans trailing whitespace) ends
  // with the current delimiter.
  const flat = buf.trimEnd()
  if (flat.endsWith(delimiter)) {
    statements.push(flat.slice(0, -delimiter.length).trim())
    buf = ''
  }
}
if (buf.trim()) statements.push(buf.trim())

console.log(`Parsed ${statements.length} statements`)

const conn = await mysql.createConnection(url)
let ok = 0
try {
  for (const [i, stmt] of statements.entries()) {
    const label = stmt.replace(/\s+/g, ' ').slice(0, 80)
    try {
      await conn.query(stmt)
      ok++
      console.log(`  [${i + 1}/${statements.length}] OK   ${label}`)
    } catch (err) {
      console.error(`  [${i + 1}/${statements.length}] FAIL ${label}`)
      console.error(`      ${err.message}`)
      process.exitCode = 1
      break
    }
  }
} finally {
  await conn.end()
}
console.log(`Done: ${ok}/${statements.length} statements applied`)
