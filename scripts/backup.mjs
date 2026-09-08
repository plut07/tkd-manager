/**
 * Dump every table to a timestamped JSON file.
 *
 *   node scripts/backup.mjs [outputDir]
 *
 * Reads SUPABASE_SERVICE_ROLE_KEY from .env.local, so it runs wherever the app
 * runs and needs nothing else installed.
 *
 * Written because "clear the data and start again" is a reasonable thing to
 * want and an unreasonable thing to do without a copy first. Postgres has no
 * undo, and neither does this app: a delete that cascades through eleven tables
 * is gone the moment it commits.
 *
 * The file it writes is a plain JSON object of table name to rows. That is
 * enough to read, to diff, and to put back by hand -- it is not a restore tool,
 * and does not pretend to be one. Restoring in the right order is a job for
 * somebody who has read what went wrong.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Read .env.local without pulling in a dotenv dependency. */
function env() {
  const out = {};
  for (const line of readFileSync(join(ROOT, ".env.local"), "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const at = trimmed.indexOf("=");
    if (at > 0) out[trimmed.slice(0, at)] = trimmed.slice(at + 1);
  }
  return out;
}

// Every table the app owns. Listed explicitly rather than discovered, so a new
// table has to be added here deliberately and a backup never silently misses
// one it did not know about.
const TABLES = [
  "roles", "permissions", "role_permissions", "app_users",
  "clubs", "students",
  "events", "event_categories", "event_registrations", "event_team_members",
  "event_documents", "event_photos", "event_matches", "event_category_brackets",
  "event_attempts", "event_officials", "ring_officials",
  "event_form_templates", "event_form_fields",
  "grading_forms", "grading_import_batches", "grading_candidates",
  "grading_exam_scores", "exam_syllabus",
  "waiver_signatures", "access_requests",
  "scoreboard_rings", "scoreboard_entries", "scoreboard_results", "scoreboard_themes",
  "app_releases", "join_code_attempts",
];

const config = env();
const supabase = createClient(config.NEXT_PUBLIC_SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const dump = { takenAt: new Date().toISOString(), tables: {} };
let total = 0;

for (const table of TABLES) {
  const { data, error } = await supabase.from(table).select("*");
  if (error) {
    // A table that does not exist yet is worth saying out loud rather than
    // leaving as a silent gap in the file.
    console.log(`  ${table}: SKIPPED (${error.message})`);
    dump.tables[table] = { error: error.message };
    continue;
  }
  dump.tables[table] = data;
  total += data.length;
  if (data.length > 0) console.log(`  ${table}: ${data.length}`);
}

const dir = process.argv[2] ?? join(ROOT, "backups");
mkdirSync(dir, { recursive: true });
const path = join(dir, `tkd-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
writeFileSync(path, JSON.stringify(dump, null, 2));

console.log(`\n${total} rows across ${TABLES.length} tables`);
console.log(`written to ${path}`);
