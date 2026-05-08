/**
 * migrate-tasks.ts
 * ----------------------------------------------------------------------------
 * One-time import of the 25 backlog tasks from the legacy Word document
 * (OUC IT Infrastructure Tasks.docx) into the Supabase database.
 *
 * RUN:
 *   npm install -D tsx                              # one-time
 *   node --env-file=.env.local --import=tsx scripts/migrate-tasks.ts
 *
 *   (or, if you prefer:  npx tsx --env-file=.env.local scripts/migrate-tasks.ts)
 *
 * REQUIRES the schema to be loaded first. From the Supabase SQL editor, run:
 *   supabase/migrations/0001_initial_schema.sql
 *
 * Idempotent: safe to re-run. Tasks are upserted on `legacy_id`; sub-tasks
 * are wiped and re-inserted per task each run.
 *
 * NOTE on cost data: the source Word doc has a few small inconsistencies
 * between the Total / Labor / Equipment columns and the per-line dollar
 * amounts inside the Description column. Where they conflict, this script
 * trusts the per-line itemized amounts. Verify after import; sums are
 * logged at the end.
 * ----------------------------------------------------------------------------
 */
 
import { createClient } from '@supabase/supabase-js';
 
// ---------------------------------------------------------------------------
// Error formatting — Supabase returns plain { code, message, details, hint }
// objects, not Error instances, so default Node logging shows them as
// "#<Object>". This helper prints every field we care about.
// ---------------------------------------------------------------------------
 
function prettyErr(e: unknown): string {
  if (e instanceof Error) return e.stack ?? e.message;
  if (e && typeof e === 'object') {
    try {
      return JSON.stringify(e, Object.getOwnPropertyNames(e), 2);
    } catch {
      return String(e);
    }
  }
  return String(e);
}
 
// Catch anything that escapes a per-task try/catch so we never see the
// opaque "#<Object>" rejection text again.
process.on('unhandledRejection', (reason) => {
  console.error('\nUnhandled rejection:');
  console.error(prettyErr(reason));
  process.exit(1);
});
 
// ---------------------------------------------------------------------------
// Data: hand-curated from OUC IT Infrastructure Tasks.docx
// ---------------------------------------------------------------------------
 
type Subtask = {
  description: string;
  labor_cost?: number;
  equipment_cost?: number;
};
 
type LegacyTask = {
  legacy_id: number;
  priority: 1 | 2 | 3 | 4 | 5;
  title: string;
  category: string;            // must match Category.name (case-sensitive)
  location: string;            // must match Location.name (case-sensitive)
  description?: string;
  subtasks: Subtask[];
};
 
const TASKS: LegacyTask[] = [
  {
    legacy_id: 1, priority: 5, title: 'Team Alert Fob for Administrative Secretary',
    category: 'Surveillance', location: 'Admin Office',
    subtasks: [
      { description: 'Purchase live camera and monitor', equipment_cost: 389.95 },
      { description: 'Purchase Wisenet archive license', equipment_cost: 102.00 },
      { description: 'Pull HDMI and ethernet cable', labor_cost: 115.00 },
      { description: 'Video Surveillance system integration' },
      { description: 'Network integration' },
    ],
  },
  {
    legacy_id: 2, priority: 4, title: 'Install choir room surveillance camera',
    category: 'Surveillance', location: 'Choir Room',
    subtasks: [
      { description: 'Purchase AXIS M3086-V-4 overhead camera', equipment_cost: 335.01 },
      { description: 'Pull an ethernet cable to Choir room', labor_cost: 75.00 },
      { description: 'Purchase Wisenet archive license', equipment_cost: 102.00 },
      { description: 'Video Surveillance system integration' },
    ],
  },
  {
    legacy_id: 3, priority: 5, title: 'Reinstall Treasury live camera and monitor',
    category: 'Surveillance', location: 'Treasury',
    subtasks: [
      { description: 'Reinstall Treasury live camera and monitor', labor_cost: 150.00 },
      { description: 'Purchase AXIS M3086 camera with HDMI', equipment_cost: 396.00 },
    ],
  },
  {
    legacy_id: 4, priority: 5, title: 'Repair FLC-100 door hinge assembly',
    category: 'Maintenance', location: 'Family Life Center (FLC)',
    subtasks: [
      { description: 'Purchase FAAN950 hinge and hardware', equipment_cost: 289.70 },
      { description: 'Install hinge and adjust strike plate alignment', labor_cost: 175.00 },
    ],
  },
  {
    legacy_id: 5, priority: 3, title: 'Replace FLC-100 outer area camera',
    category: 'Surveillance', location: 'Family Life Center (FLC)',
    subtasks: [
      { description: 'Purchase Wisenet camera', equipment_cost: 0 },
      { description: 'Purchase Wisenet archive license', equipment_cost: 102.00 },
      { description: 'Install camera', labor_cost: 125.00 },
    ],
  },
  {
    legacy_id: 6, priority: 1, title: 'Install television monitor in pastoral suite',
    category: 'AV/Displays', location: 'Pastoral Suite',
    subtasks: [
      { description: 'Purchase Samsung 65" UHD U800 Smart TV', equipment_cost: 457.00 },
      { description: 'Pull RGB coax to pastoral suite', labor_cost: 175.00 },
      { description: 'Purchase and install wall mount', labor_cost: 135.00 },
      { description: 'Connect to Channel Master DI #3' },
    ],
  },
  {
    legacy_id: 7, priority: 2, title: 'Reinstall senior pastor door card reader',
    category: 'Access Control', location: 'Senior Pastor Office',
    subtasks: [
      { description: 'Install door strike and card reader', labor_cost: 510.00 },
      { description: 'Purchase ISONAS cable harness', equipment_cost: 95.00 },
      { description: 'Install cable harness', labor_cost: 110.00 },
    ],
  },
  {
    legacy_id: 8, priority: 4, title: 'Reconfigure video production rack',
    category: 'AV/Displays', location: 'Video Production Rack',
    subtasks: [
      { description: 'Replace OUBN AJA Helo Encoder', equipment_cost: 745.00 },
      { description: 'Replace Backup/local livestream AJA Helo Encoder', equipment_cost: 745.00 },
      { description: 'Reconfigure FLC Optical fiber video feed' },
      { description: 'Organize equipment rack' },
    ],
  },
  {
    legacy_id: 9, priority: 1, title: 'Replace FLC sprinkler room card reader',
    category: 'Access Control', location: 'FLC Sprinkler Room',
    subtasks: [
      { description: 'Purchase ISONAS rc04 Card reader', equipment_cost: 850.00 },
      { description: 'Replace card reader' },
      { description: 'Validate network connectivity' },
    ],
  },
  {
    legacy_id: 10, priority: 2, title: 'Reconnect OUC north entry TV monitor',
    category: 'AV/Displays', location: 'North Entry',
    subtasks: [
      { description: 'Find previous coax or reinstall', labor_cost: 250.00 },
    ],
  },
  {
    legacy_id: 11, priority: 3, title: 'Replace FLC/OUC breezeway TV monitor',
    category: 'AV/Displays', location: 'Breezeway',
    subtasks: [
      { description: 'Purchase replacement TV monitor', equipment_cost: 437.00 },
      { description: 'Mount TV monitor and reconnect COAX', labor_cost: 150.00 },
    ],
  },
  {
    legacy_id: 12, priority: 3, title: 'Replace MPRS1 TV monitor',
    category: 'AV/Displays', location: 'MPRS (South)',
    subtasks: [
      { description: 'Purchase replacement TV monitor', equipment_cost: 279.00 },
      { description: 'Mount unit on wall', labor_cost: 75.00 },
    ],
  },
  {
    legacy_id: 13, priority: 3, title: 'Replace MPRS2 TV monitor',
    category: 'AV/Displays', location: 'MPRS (South)',
    subtasks: [
      { description: 'Purchase replacement TV monitor', equipment_cost: 279.00 },
      { description: 'Mount unit on wall', labor_cost: 75.00 },
    ],
  },
  {
    legacy_id: 14, priority: 3, title: 'Replace MPRS3 TV monitor',
    category: 'AV/Displays', location: 'MPRS (South)',
    subtasks: [
      { description: 'Purchase replacement TV monitor', equipment_cost: 279.00 },
      { description: 'Mount unit on wall', labor_cost: 75.00 },
    ],
  },
  {
    legacy_id: 15, priority: 3, title: 'Rewire main foyer east TV monitor',
    category: 'Cabling', location: 'Main Foyer',
    subtasks: [
      { description: 'Pull RGB coax to location', labor_cost: 120.00 },
    ],
  },
  {
    legacy_id: 16, priority: 3, title: 'Rewire main foyer west TV monitor',
    category: 'Cabling', location: 'Main Foyer',
    subtasks: [
      { description: 'Pull RGB coax to location', labor_cost: 120.00 },
    ],
  },
  {
    legacy_id: 17, priority: 3, title: 'Replace MPRN1 TV monitor',
    category: 'AV/Displays', location: 'MPRN (North)',
    subtasks: [
      { description: 'Purchase replacement TV monitor', equipment_cost: 279.00 },
      { description: 'Mount unit on wall', labor_cost: 75.00 },
    ],
  },
  {
    legacy_id: 18, priority: 3, title: 'Replace MPRN2 TV monitor',
    category: 'AV/Displays', location: 'MPRN (North)',
    subtasks: [
      { description: 'Purchase replacement TV monitor', equipment_cost: 279.00 },
      { description: 'Mount unit on wall', labor_cost: 75.00 },
    ],
  },
  {
    legacy_id: 19, priority: 3, title: 'Replace MPRN3 TV monitor',
    category: 'AV/Displays', location: 'MPRN (North)',
    subtasks: [
      { description: 'Purchase replacement TV monitor', equipment_cost: 279.00 },
      { description: 'Mount unit on wall', labor_cost: 75.00 },
    ],
  },
  {
    legacy_id: 20, priority: 3, title: 'Connect Balcony east & west LG monitors',
    category: 'AV/Displays', location: 'Balcony',
    subtasks: [
      { description: 'Connect Balcony east & west LG monitors', labor_cost: 150.00 },
    ],
  },
  {
    legacy_id: 21, priority: 3, title: 'Automate main lobby double doors lock & unlock',
    category: 'Access Control', location: 'Main Lobby',
    subtasks: [
      { description: 'Install maglocks on main lobby doors', labor_cost: 2100.00 },
      { description: 'Purchase ISONAS RC04 Card reader', equipment_cost: 850.00 },
      { description: 'Purchase Connectivity hardware', equipment_cost: 1425.00 },
      { description: 'Install and connect', labor_cost: 1650.00 },
      { description: 'Integrate with ISONAS OUC church stack' },
    ],
  },
  {
    legacy_id: 22, priority: 5, title: 'Fix FLC gym basketball net activation switch',
    category: 'Maintenance', location: 'FLC Gym',
    subtasks: [
      { description: 'Purchase rocker arm spring loaded switch', equipment_cost: 55.00 },
      { description: 'Replace current fixed-state switch', labor_cost: 210.00 },
    ],
  },
  {
    legacy_id: 23, priority: 4, title: 'Annual maintenance on FLC-100D',
    category: 'Maintenance', location: 'Family Life Center (FLC)',
    subtasks: [
      { description: 'Annual maintenance service visit', labor_cost: 250.00 },
    ],
  },
  {
    legacy_id: 24, priority: 4, title: 'Annual maintenance on FLC-100B',
    category: 'Maintenance', location: 'Family Life Center (FLC)',
    subtasks: [
      { description: 'Annual maintenance service visit', labor_cost: 350.00 },
    ],
  },
  {
    legacy_id: 25, priority: 4, title: 'Install remote door un-lock for Admin Office',
    category: 'Access Control', location: 'Admin Office',
    subtasks: [
      { description: 'Purchase wireless key fob and 12-volt relay switch', equipment_cost: 210.00 },
      { description: 'Install 120-volt electrical head-end', labor_cost: 625.00 },
      { description: 'Patch relay into card reader', labor_cost: 250.00 },
    ],
  },
];
 
// ---------------------------------------------------------------------------
// Importer
// ---------------------------------------------------------------------------
 
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.');
  console.error('Run with:  node --env-file=.env.local --import=tsx scripts/migrate-tasks.ts');
  process.exit(1);
}
 
const supabase = createClient(url, key, { auth: { persistSession: false } });
 
async function lookupRefs() {
  const [{ data: cats, error: catErr }, { data: locs, error: locErr }] = await Promise.all([
    supabase.from('category').select('id, name'),
    supabase.from('location').select('id, name'),
  ]);
  if (catErr) throw new Error(`category lookup failed: ${prettyErr(catErr)}`);
  if (locErr) throw new Error(`location lookup failed: ${prettyErr(locErr)}`);
  if (!cats || !locs) throw new Error('category or location query returned no data');
 
  const catMap = new Map<string, number>(cats.map((c) => [c.name, c.id]));
  const locMap = new Map<string, number>(locs.map((l) => [l.name, l.id]));
  return { catMap, locMap };
}
 
async function importTask(t: LegacyTask, catMap: Map<string, number>, locMap: Map<string, number>) {
  const category_id = catMap.get(t.category);
  const location_id = locMap.get(t.location);
  if (!category_id) throw new Error(`Unknown category: ${t.category} (task #${t.legacy_id})`);
  if (!location_id) throw new Error(`Unknown location: ${t.location} (task #${t.legacy_id})`);
 
  // Upsert task on legacy_id
  const { data: task, error: taskErr } = await supabase
    .from('task')
    .upsert(
      {
        legacy_id: t.legacy_id,
        title: t.title,
        priority: t.priority,
        category_id,
        location_id,
        description: t.description ?? null,
        status: 'not_started',
      },
      { onConflict: 'legacy_id' }
    )
    .select('id')
    .single();
  if (taskErr) throw new Error(`task upsert failed: ${prettyErr(taskErr)}`);
  if (!task) throw new Error('task upsert returned no row');
 
  // Wipe and re-insert sub-tasks for this task (idempotent re-run)
  const { error: delErr } = await supabase.from('subtask').delete().eq('task_id', task.id);
  if (delErr) throw new Error(`subtask delete failed: ${prettyErr(delErr)}`);
 
  const rows = t.subtasks.map((s, i) => ({
    task_id: task.id,
    sequence: i + 1,
    description: s.description,
    labor_cost: s.labor_cost ?? 0,
    equipment_cost: s.equipment_cost ?? 0,
  }));
  if (rows.length) {
    const { error: insErr } = await supabase.from('subtask').insert(rows);
    if (insErr) throw new Error(`subtask insert failed: ${prettyErr(insErr)}`);
  }
 
  const subTotal = t.subtasks.reduce(
    (a, s) => a + (s.labor_cost ?? 0) + (s.equipment_cost ?? 0),
    0
  );
  return { id: task.id, subTotal };
}
 
async function main() {
  console.log('OUC Tasks — legacy import starting…\n');
 
  const { catMap, locMap } = await lookupRefs();
  console.log(`Found ${catMap.size} categories, ${locMap.size} locations.\n`);
 
  if (catMap.size === 0 || locMap.size === 0) {
    throw new Error(
      'category or location table is empty — did you run supabase/migrations/0001_initial_schema.sql? ' +
      'The seed data lives in that file.'
    );
  }
 
  let grandTotal = 0;
  let imported = 0;
  const failures: Array<{ legacy_id: number; reason: string }> = [];
  for (const t of TASKS) {
    try {
      const { subTotal } = await importTask(t, catMap, locMap);
      grandTotal += subTotal;
      imported += 1;
      console.log(
        `  #${String(t.legacy_id).padStart(2)}  P${t.priority}  ${t.title.padEnd(54)} $${subTotal.toFixed(2)}`
      );
    } catch (e) {
      const reason = e instanceof Error ? e.message : prettyErr(e);
      failures.push({ legacy_id: t.legacy_id, reason });
      console.error(`  #${t.legacy_id} FAILED: ${reason}`);
    }
  }
 
  console.log(
    `\nDone. Imported ${imported}/${TASKS.length} tasks. Backlog total: $${grandTotal.toFixed(2)}`
  );
  console.log('Expected from Word doc: $17,493.66 (variances are noted in script header).');
 
  if (failures.length) {
    console.error(`\n${failures.length} task(s) failed:`);
    for (const f of failures) console.error(`  - #${f.legacy_id}: ${f.reason}`);
    process.exit(1);
  }
}
 
main().catch((err) => {
  console.error('\nMigration failed:');
  console.error(prettyErr(err));
  process.exit(1);
});