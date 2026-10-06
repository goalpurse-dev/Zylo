// Blocky Stories on this computer: a local Supabase (database, sign-in,
// storage, live updates) in Docker, with Blocky's own two functions served
// next to it. Nothing here writes to the real project. The full guide, with
// the Docker install steps, is docs/blocky-local.md.
//
//   node scripts/blocky/local.mjs setup     build .blocky-local/ (once, and after a database change)
//   node scripts/blocky/local.mjs start     start the local Supabase and save its keys to .env.blocky.local
//   node scripts/blocky/local.mjs seed      the test account (plan, credits, switch on), the bucket, the avatars
//   node scripts/blocky/local.mjs serve     serve Blocky's functions and run the job sweep (leave it running)
//   node scripts/blocky/local.mjs status    what is running, and at which addresses
//   node scripts/blocky/local.mjs stop      stop everything (the local data is kept)
//   node scripts/blocky/local.mjs reset     wipe the local database and build it again from setup's files
//
// How it is kept apart from the real project:
//   - its own Supabase folder, .blocky-local/ (git-ignored), so the repo's
//     supabase/ folder and its link to the real project are never used to start
//     or change anything;
//   - only Blocky's functions are copied into it (plus the shared CORS file):
//     no AI Fruit Story function can run here;
//   - its keys live in .env.blocky.local (git-ignored; a commit that contains
//     it is refused). The production .env.local is never read by the local
//     functions or by the scripts in local mode.
// The ONE thing that reads the real project is `setup`: a schema-only dump
// (table and function definitions, no rows) so the local database has the same
// shape as the real one.
import fs from "fs";
import path from "path";
import { spawn, spawnSync } from "child_process";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const WORK = path.join(ROOT, ".blocky-local");
const SB = path.join(WORK, "supabase");
const ENV_FILE = path.join(ROOT, ".env.blocky.local");
const BACKEND = "20261026100000_blocky_stories_backend.sql";
/** The folders Blocky's functions are made of. Nothing else is ever served locally. */
const FUNCTION_DIRS = ["shared", "_shared/blocky", "blocky-story-api", "blocky-worker"];
const API_PORT = 54321;
const LOCAL_URL = `http://127.0.0.1:${API_PORT}`;
const [command = "status", ...flags] = process.argv.slice(2);

const log = (m) => console.log(m);
const die = (m) => { console.error(`\n${m}`); process.exit(1); };
/** Runs the Supabase CLI inside .blocky-local. */
function supabase(args, { capture = false, allowFail = false } = {}) {
  const r = spawnSync("npx", ["supabase", ...args, "--workdir", WORK], { cwd: ROOT, shell: true, encoding: "utf8", stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit" });
  if (r.status !== 0 && !allowFail) die(`supabase ${args.join(" ")} failed${capture ? `:\n${r.stderr || r.stdout}` : "."}`);
  return r;
}
function needDocker() {
  const r = spawnSync("docker", ["info", "--format", "{{.ServerVersion}}"], { shell: true, encoding: "utf8" });
  if (r.status !== 0) die("Docker is not running. Install Docker Desktop and start it first (docs/blocky-local.md, step 1).");
}
const readEnv = () => (fs.existsSync(ENV_FILE) ? Object.fromEntries(fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/).map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")])) : {});
/** Sets keys in .env.blocky.local, keeping every other line (the provider keys) as it is. */
function writeEnv(values) {
  const lines = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/) : fs.readFileSync(path.join(ROOT, ".env.blocky.local.example"), "utf8").split(/\r?\n/);
  for (const [k, v] of Object.entries(values)) {
    const at = lines.findIndex((l) => new RegExp(`^\\s*${k}\\s*=`).test(l));
    if (at >= 0) lines[at] = `${k}=${v}`; else lines.push(`${k}=${v}`);
  }
  fs.writeFileSync(ENV_FILE, lines.join("\n"));
}

/** Copies Blocky's function folders into the local Supabase folder. */
function syncFunctions() {
  for (const dir of FUNCTION_DIRS) {
    const to = path.join(SB, "functions", dir);
    fs.rmSync(to, { recursive: true, force: true });
    fs.cpSync(path.join(ROOT, "supabase/functions", dir), to, { recursive: true });
  }
}

function setup() {
  needDocker();
  fs.mkdirSync(path.join(SB, "migrations"), { recursive: true });
  // 1. The local Supabase's own settings: Postgres 17 like the real project, and only Blocky's two functions.
  fs.writeFileSync(path.join(SB, "config.toml"), `# Written by scripts/blocky/local.mjs. Local only.
project_id = "blocky-local"

[api]
port = ${API_PORT}

[db]
port = 54322
major_version = 17

[studio]
port = 54323

[auth]
site_url = "http://localhost:5173"
additional_redirect_urls = ["http://localhost:5173", "http://127.0.0.1:5173"]

[functions.blocky-story-api]
verify_jwt = true

[functions.blocky-worker]
verify_jwt = false
`);
  // 2. The shape of the real database (definitions only, no rows). Read-only on the real project.
  const baseline = path.join(SB, "migrations", "00000000000001_baseline.sql");
  if (!fs.existsSync(baseline) || flags.includes("--refresh")) {
    log("Reading the real database's table and function definitions (no rows) ...");
    const r = spawnSync("npx", ["supabase", "db", "dump", "--linked", "--schema", "public", "-f", baseline], { cwd: ROOT, shell: true, stdio: "inherit" });
    if (r.status !== 0) die("The schema dump failed. Is this folder linked to the project (npx supabase link) and is Docker running?");
  }
  const dump = fs.readFileSync(baseline, "utf8");
  if (/INSERT INTO|COPY .* FROM stdin/i.test(dump)) die("The baseline holds rows. It must be definitions only: delete .blocky-local/ and run setup again.");
  // 3. The extensions the definitions lean on, before them.
  fs.writeFileSync(path.join(SB, "migrations", "00000000000000_extensions.sql"), `-- Local only. The real project has these already.
DO $$ BEGIN CREATE EXTENSION IF NOT EXISTS pg_net; EXCEPTION WHEN others THEN RAISE NOTICE 'pg_net: %', SQLERRM; END $$;
DO $$ BEGIN CREATE EXTENSION IF NOT EXISTS pg_cron; EXCEPTION WHEN others THEN RAISE NOTICE 'pg_cron: %', SQLERRM; END $$;
CREATE SCHEMA IF NOT EXISTS private;
`);
  // 4. Blocky's own backend, unless the real database has it already (then the baseline brought it).
  const own = path.join(SB, "migrations", "00000000000002_blocky_stories_backend.sql");
  if (/"blocky_stories"|public\.blocky_stories/.test(dump)) fs.rmSync(own, { force: true });
  else fs.copyFileSync(["supabase/migrations", "supabase/pending"].map((d) => path.join(ROOT, d, BACKEND)).find((f) => fs.existsSync(f)), own);
  syncFunctions();
  if (!fs.existsSync(ENV_FILE)) { fs.copyFileSync(path.join(ROOT, ".env.blocky.local.example"), ENV_FILE); log("Created .env.blocky.local from the example. Put your LOCAL provider keys in it (docs/blocky-local.md, step 3)."); }
  log(`\nSetup done: ${path.relative(ROOT, WORK)}/ is ready. Next: node scripts/blocky/local.mjs start`);
}

function start() {
  needDocker();
  if (!fs.existsSync(path.join(SB, "config.toml"))) die("Run setup first: node scripts/blocky/local.mjs setup");
  supabase(["start"]);
  saveKeys();
  log(`\nThe local Supabase is running at ${LOCAL_URL} (its dashboard: http://127.0.0.1:54323). Next: node scripts/blocky/local.mjs seed`);
}
/** The local keys (the same fixed ones on every computer) go into .env.blocky.local. */
function saveKeys() {
  const out = supabase(["status", "-o", "env"], { capture: true }).stdout;
  const get = (name) => out.match(new RegExp(`^${name}="?([^"\\r\\n]+)"?`, "m"))?.[1];
  const anon = get("ANON_KEY");
  const service = get("SERVICE_ROLE_KEY");
  if (!anon || !service) die(`Couldn't read the local keys from "supabase status":\n${out}`);
  const env = readEnv();
  writeEnv({
    VITE_SUPABASE_URL: LOCAL_URL,
    VITE_SUPABASE_ANON_KEY: anon,
    BLOCKY_LOCAL_SERVICE_ROLE_KEY: service,
    // The address the browser and the providers use for stored pictures and clips. A tunnel's address goes here for paid runs.
    BLOCKY_PUBLIC_URL: env.BLOCKY_PUBLIC_URL || LOCAL_URL,
    BLOCKY_WORKER_SECRET: env.BLOCKY_WORKER_SECRET && !/^change-me/.test(env.BLOCKY_WORKER_SECRET) ? env.BLOCKY_WORKER_SECRET : `local-${crypto.randomUUID()}`,
  });
}

async function seed() {
  process.env.BLOCKY_TARGET = "local";
  const { admin, TEST_EMAIL } = await import("./lib.mjs");
  const { ROSTER, avatarPrompt } = await import("./roster.mjs");
  const db = admin();
  const password = readEnv().BLOCKY_TEST_PASSWORD || "blocky-local-1234";
  // 1. The test account: a paid plan, credits, and the Blocky switch on. Local only.
  let user = (await db.auth.admin.listUsers()).data?.users?.find((u) => u.email === TEST_EMAIL);
  if (!user) {
    const made = await db.auth.admin.createUser({ email: TEST_EMAIL, password, email_confirm: true });
    if (made.error) die(`Couldn't create the test account: ${made.error.message}`);
    user = made.data.user;
  }
  const profile = await db.from("profiles").upsert({ id: user.id, plan_code: "generative", credit_balance: 2000 }, { onConflict: "id" });
  if (profile.error) die(`Couldn't write the test profile: ${profile.error.message}`);
  const flag = await db.from("user_feature_flags").upsert({ user_id: user.id, flags: { blocky_v1: true } }, { onConflict: "user_id" });
  if (flag.error) die(`Couldn't switch Blocky on for the test account: ${flag.error.message}`);
  // 2. The bucket pictures and clips are stored in.
  const bucket = await db.storage.createBucket("generated", { public: true });
  if (bucket.error && !/exist/i.test(bucket.error.message)) die(`Couldn't create the storage bucket: ${bucket.error.message}`);
  // 3. The avatars that have a reference picture so far (the test pictures on this computer; the full library is its own phase).
  const dir = path.join(ROOT, "data/blocky-tests/test2");
  const publicBase = (readEnv().BLOCKY_PUBLIC_URL || LOCAL_URL).replace(/\/+$/, "");
  let n = 0;
  for (const [i, a] of ROSTER.entries()) {
    const file = [`pro-${a.id}.jpg`, `retest-${a.id}-A.jpg`, `${a.id}-roblox-lite.jpg`].map((f) => path.join(dir, f)).find((f) => fs.existsSync(f));
    if (!file) continue;
    const storagePath = `blocky/library/${a.id}.jpg`;
    const up = await db.storage.from("generated").upload(storagePath, fs.readFileSync(file), { contentType: "image/jpeg", upsert: true });
    if (up.error) die(`Couldn't store ${a.id}'s picture: ${up.error.message}`);
    const row = await db.from("blocky_characters").upsert({
      id: a.id, name: a.name, tag: a.tag, role: a.role, role_tags: a.tags, voice_style: a.voice, face: a.face, look: a.look, hue: 0,
      ref_image_url: `${publicBase}/storage/v1/object/public/generated/${storagePath}`, ref_image_path: storagePath, ref_width: 768, ref_height: 1376,
      ref_model: /pro-/.test(file) ? "google:4@2" : "google:nano-banana@2-lite", ref_prompt: avatarPrompt(a), active: true, sort_order: i,
    }, { onConflict: "id" });
    if (row.error) die(`Couldn't write ${a.id}: ${row.error.message}`);
    n += 1;
  }
  log(`Seeded: ${TEST_EMAIL} (password ${password}, Generative plan, 2,000 credits, Blocky switched on), the "generated" bucket, ${n} avatars with a reference picture.`);
  log("Next: node scripts/blocky/local.mjs serve   (and, in another terminal: npm run dev -- --mode blocky)");
}

function serve() {
  needDocker();
  const env = readEnv();
  if (!env.BLOCKY_WORKER_SECRET) die("Run start first: .env.blocky.local has no BLOCKY_WORKER_SECRET yet.");
  syncFunctions();
  // Edits in the repo's Blocky function folders are copied over as they are saved; the local runtime reloads them.
  for (const dir of FUNCTION_DIRS) {
    fs.watch(path.join(ROOT, "supabase/functions", dir), { recursive: true }, (_, file) => {
      if (!file) return;
      const from = path.join(ROOT, "supabase/functions", dir, file);
      try { if (fs.statSync(from).isFile()) fs.copyFileSync(from, path.join(SB, "functions", dir, file)); } catch { /* a file being written or removed: the next save copies it */ }
    });
  }
  const child = spawn("npx", ["supabase", "functions", "serve", "--workdir", WORK, "--env-file", ENV_FILE], { cwd: ROOT, shell: true, stdio: "inherit" });
  child.on("exit", (code) => process.exit(code ?? 0));
  // The job sweep the real project runs from the database every 20 seconds: started jobs, results, refunds for the ones that failed.
  const sweep = async () => {
    try {
      const res = await fetch(`${LOCAL_URL}/functions/v1/blocky-worker`, { method: "POST", headers: { "Content-Type": "application/json", "x-blocky-worker-secret": env.BLOCKY_WORKER_SECRET }, body: JSON.stringify({ action: "reconcile" }), signal: AbortSignal.timeout(60_000) });
      const out = await res.json().catch(() => null);
      const busy = out && Object.entries(out).filter(([k, v]) => k !== "ok" && Number(v) > 0);
      if (busy?.length) log(`[sweep] ${busy.map(([k, v]) => `${k} ${v}`).join(", ")}`);
    } catch { /* the functions are still starting, or reloading */ }
  };
  setTimeout(() => setInterval(sweep, 10_000), 8000);
  log(`Serving Blocky's functions at ${LOCAL_URL}/functions/v1/ with the keys in .env.blocky.local. Paid calls are ${String(env.BLOCKY_PAID_CALLS).toLowerCase() === "off" ? "OFF" : "ON"}. Ctrl+C stops it.`);
}

function status() {
  const r = supabase(["status"], { allowFail: true });
  const env = readEnv();
  log(`\n.env.blocky.local: ${fs.existsSync(ENV_FILE) ? "there" : "missing (run setup)"}; paid calls ${String(env.BLOCKY_PAID_CALLS ?? "").toLowerCase() === "off" ? "OFF" : "ON"}; public address ${env.BLOCKY_PUBLIC_URL || "(not set)"}`);
  for (const k of ["RUNWARE_API_KEY", "ANTHROPIC_API_KEY", "OPENAI_API_KEY"]) log(`  ${k}: ${env[k] ? "set" : "NOT set"}`);
  process.exit(r.status ?? 0);
}

if (command === "setup") setup();
else if (command === "start") start();
else if (command === "seed") await seed();
else if (command === "serve") serve();
else if (command === "status") status();
else if (command === "stop") supabase(["stop"]);
else if (command === "reset") { needDocker(); supabase(["db", "reset"]); log("The local database is rebuilt and empty. Next: node scripts/blocky/local.mjs seed"); }
else die(`Unknown command "${command}". See the top of scripts/blocky/local.mjs.`);
