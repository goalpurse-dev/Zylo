// Runs the Content Machine migration and its SQL tests in PGlite (Postgres in WebAssembly), on this
// machine, with no database of ours touched. The roles and the storage table Supabase provides are stubbed.
//
// PGlite is not a project dependency; install it once outside the repo and point at it:
//   npm install --prefix <dir> @electric-sql/pglite@0.2.17
//   PGLITE_DIR=<dir> node scripts/contentMachine/sqlCheck.mjs
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const dir = process.env.PGLITE_DIR;
if (!dir) { console.error("Set PGLITE_DIR to a folder where @electric-sql/pglite is installed."); process.exit(2); }
const entry = createRequire(join(dir, "package.json")).resolve("@electric-sql/pglite");
const { PGlite } = await import(pathToFileURL(entry).href);

const root = new URL("../../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");
const db = new PGlite();
await db.exec(`
  create role anon; create role authenticated; create role service_role;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
`);

const steps = [
  ["migration", "supabase/migrations/20261107100000_content_machine.sql"],
  ["migration again (must be safe to re-run)", "supabase/migrations/20261107100000_content_machine.sql"],
  ["spend tests", "tests/contentMachineSpend.lifecycle.sql"],
  ["rollback", "supabase/rollbacks/20261107100000_content_machine_rollback.sql"],
  ["migration after rollback", "supabase/migrations/20261107100000_content_machine.sql"],
];
for (const [label, file] of steps) {
  try {
    await db.exec(read(file));
    console.log(`ok   ${label}`);
  } catch (e) {
    console.error(`FAIL ${label}: ${e.message}`);
    process.exit(1);
  }
}
console.log("All Content Machine SQL checks passed.");
