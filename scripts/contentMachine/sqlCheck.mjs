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
  -- The vault and pg_net, recording instead of calling (the tick test reads net.calls).
  create schema vault;
  create table vault.decrypted_secrets (name text primary key, decrypted_secret text);
  insert into vault.decrypted_secrets values ('cm_worker_secret', 'test-secret'), ('cm_worker_url', 'https://worker.test/tick');
  create schema net;
  create table net.calls (url text, headers jsonb, body jsonb);
  create function net.http_post(url text, headers jsonb, body jsonb, timeout_milliseconds integer) returns bigint
    language sql as $$ insert into net.calls values (url, headers, body); select 1::bigint $$;
`);

const M1 = "supabase/migrations/20261107100000_content_machine.sql";
const M2 = "supabase/migrations/20261108100000_content_machine_slideshows.sql";
const M3 = "supabase/migrations/20261109100000_content_machine_assets.sql";
const M4 = "supabase/migrations/20261110100000_content_machine_logo_rules.sql";
const M5 = "supabase/migrations/20261112100000_content_machine_round5.sql";
const M6 = "supabase/migrations/20261113100000_content_machine_posts.sql";
const M7 = "supabase/migrations/20261114100000_content_machine_learning.sql";
const steps = [
  ["migration 1", M1],
  ["migration 1 again (must be safe to re-run)", M1],
  ["spend tests", "tests/contentMachineSpend.lifecycle.sql"],
  ["migration 2 (slideshows)", M2],
  ["migration 2 again", M2],
  ["slideshow tests", "tests/contentMachineSlideshows.lifecycle.sql"],
  ["the minute tick (stubbed pg_net)", "tests/contentMachineTick.pglite.sql"],
  ["migration 3 (assets)", M3],
  ["migration 3 again", M3],
  ["asset tests", "tests/contentMachineAssets.lifecycle.sql"],
  ["migration 4 (logo rules)", M4],
  ["migration 4 again", M4],
  ["migration 5 (round 5: subtitles, meme prompt)", M5],
  ["migration 5 again", M5],
  ["round 5 tests", "tests/contentMachineRound5.lifecycle.sql"],
  ["rollback 5", "supabase/rollbacks/20261112100000_content_machine_round5_rollback.sql"],
  ["migration 5 after its rollback", M5],
  ["migration 5 again (before 6)", M5],
  ["migration 6 (posts, stats, flawed, Anthropic cap)", M6],
  ["migration 6 again", M6],
  ["posts tests", "tests/contentMachinePosts.lifecycle.sql"],
  ["migration 7 (learning loop)", M7],
  ["migration 7 again", M7],
  ["learning tests (stubbed pg_net)", "tests/contentMachineLearning.pglite.sql"],
  ["rollback 7", "supabase/rollbacks/20261114100000_content_machine_learning_rollback.sql"],
  ["rollback 6", "supabase/rollbacks/20261113100000_content_machine_posts_rollback.sql"],
  ["rollback 5 before the others", "supabase/rollbacks/20261112100000_content_machine_round5_rollback.sql"],
  ["rollback 3", "supabase/rollbacks/20261109100000_content_machine_assets_rollback.sql"],
  ["rollback 2", "supabase/rollbacks/20261108100000_content_machine_slideshows_rollback.sql"],
  ["rollback 1", "supabase/rollbacks/20261107100000_content_machine_rollback.sql"],
  ["both migrations after rollback", M1],
  ["", M2],
  ["", M3],
  ["", M4],
  ["", M5],
  ["", M6],
  ["", M7],
];
for (const [label, file] of steps) {
  try {
    await db.exec(read(file));
    if (label) console.log(`ok   ${label}`);
  } catch (e) {
    console.error(`FAIL ${label}: ${e.message}`);
    process.exit(1);
  }
}
console.log("All Content Machine SQL checks passed.");
