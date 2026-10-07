// Dry run of Blocky's backend SQL and the pending Fruit undo in a throwaway in-process Postgres
// (PGlite). Nothing here touches a real database, and no key is needed.
//   A. Blocky's backend, on a database with NO Fruit object at all: it
//      installs, charges, refunds, refuses and rolls back on its own.
//   B. The Fruit undo, on a replica of Fruit's LIVE tables and functions
//      (fruit_live_schema.json, read from the real database on 2026-10-06):
//      the calls the live API makes work before and after, no row is lost,
//      the two restored functions are the originals word for word.
// One connection only, so this can't test two charges at the same moment:
// that is scripts/blocky/chargeLocking.mjs, on a throwaway account.
//
//   npm i --no-save @electric-sql/pglite      (once; not a dependency of the app)
//   node scripts/blocky/sql/dryRun.mjs
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PGlite } from "@electric-sql/pglite";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const schemaFile = path.join(HERE, "fruit_live_schema.json");
const platformFile = path.join(HERE, "platform_functions.json");
const live = JSON.parse(fs.readFileSync(schemaFile, "utf8"));
const platform = JSON.parse(fs.readFileSync(platformFile, "utf8"));
const sql = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const results = [];
const ok = (name, cond, detail = "") => { results.push({ name, ok: Boolean(cond), detail }); console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); };
const fails = async (db, q, re) => { try { await db.exec(q); return false; } catch (e) { return re.test(String(e.message)) ? true : `other error: ${e.message}`; } };
const one = async (db, q, params = []) => (await db.query(q, params)).rows[0];

const PLATFORM = `
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.role', true), '') $$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
CREATE TABLE public.profiles (id uuid PRIMARY KEY REFERENCES auth.users(id), plan_code text, credit_balance integer NOT NULL DEFAULT 0, credits_spent_today integer NOT NULL DEFAULT 0);
CREATE TABLE public.tool_prices (tool_key text PRIMARY KEY, credits_per_second numeric(10,4), flat_credits integer, allowed_durations integer[], allowed_sizes text[], requires_sound boolean, min_plan text, active boolean NOT NULL DEFAULT true, notes text, updated_at timestamptz NOT NULL DEFAULT now(), sound_credits_per_second numeric(10,4), size_tiers jsonb);
CREATE TABLE public.global_feature_flags (key text PRIMARY KEY, enabled boolean NOT NULL DEFAULT false, note text, updated_at timestamptz NOT NULL DEFAULT now());
${platform.map((f) => `${f.def};`).join("\n")}
`;
const USER = "11111111-1111-1111-1111-111111111111";

/* ───────────────────────── A. Blocky's backend ───────────────────────── */
{
  console.log("\nA. Blocky's backend, on a database with no Fruit object");
  const db = new PGlite();
  await db.exec(PLATFORM);
  await db.exec(sql("supabase/migrations/20261026100000_blocky_stories_backend.sql"));
  ok("the backend SQL runs from start to finish", true);
  ok("no Fruit object exists in this database", (await one(db, "select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'fruit%'")).n === 0 && (await one(db, "select count(*)::int n from pg_proc where proname like 'fruit%'")).n === 0);
  const tables = await one(db, "select count(*)::int n, bool_and(relrowsecurity) rls from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname like 'blocky%'");
  ok("12 Blocky tables, every one with row-level security on", tables.n === 12 && tables.rls === true);
  // Paid calls: off until the owner switches them on.
  const paid = async (add = 0) => (await one(db, "select public.blocky_paid_state($1) s", [add])).s;
  ok("paid calls are OFF on a fresh install, with a $3.00 daily cap", (await paid()).on === false && (await paid()).reason === "switch_off" && Number((await paid()).cap_usd) === 3);
  const cols = (await db.query("select column_name from information_schema.columns where table_name='blocky_characters'")).rows.map((r) => r.column_name);
  ok("the avatar library has no age and no gender column", !cols.includes("age") && !cols.includes("gender") && cols.includes("look"));

  await db.exec(`INSERT INTO auth.users VALUES ('${USER}'); INSERT INTO public.profiles VALUES ('${USER}', 'starter', 100, 0);
    INSERT INTO public.blocky_characters (id, name, tag, role, voice_style, face, look, ref_image_url, ref_image_path, ref_width, ref_height, ref_model, ref_prompt)
    VALUES ('vex', 'Vex', 'Admin', 'Cold rule keeper', 'low, flat', 'two eyes and one mouth', 'a white cube head', 'https://example.test/vex.jpg', 'x', 768, 1376, 'm', 'p'),
           ('noob', 'Noob', 'New player', 'Lost and honest', 'bright, small', 'two eyes and one mouth', 'a yellow cube head', 'https://example.test/noob.jpg', 'x', 768, 1376, 'm', 'p');`);
  const scene = (speaker, line) => ({ title: "t", speaker_id: speaker, line, present_ids: ["vex", "noob"], location_id: "loc1", action: "points", emotion: "cold", shot: "close-up", placement: "", duration_sec: 5 });
  const story = { source: "prompt", input: {}, title: "The Admin Who Wasn't", cast_ids: ["vex", "noob"], quality: "v2", aspect: "9:16", length_sec: 15, locations: [], planner: {} };
  const storyId = (await one(db, "select public.blocky_create_story($1, $2::jsonb, $3::jsonb, '{}') id", [USER, JSON.stringify(story), JSON.stringify([scene("vex", "Who gave you admin?"), scene("noob", "You did. Yesterday."), scene("vex", "Then I take it back.")])])).id;
  const scenes = (await db.query("select id from public.blocky_story_scenes where story_id=$1 order by idx", [storyId])).rows.map((r) => r.id);
  ok("blocky_create_story: a story with 3 scenes", scenes.length === 3);

  const items = scenes.map((id) => ({ scene_id: id, kind: "image", tool_key: "image:blocky-story", price_input: { width: 768, height: 1376 }, request: { model: "x" }, prompt: "p" }));
  const charge = (await one(db, "select public.blocky_charge_step($1, $2, 'pictures', ARRAY['draft'], 'pictures', $3::jsonb) r", [USER, storyId, JSON.stringify(items)])).r;
  const bal = async () => (await one(db, "select credit_balance b from public.profiles where id=$1", [USER])).b;
  ok("blocky_charge_step: 3 pictures charged 12 credits from the shared balance, in one step", charge.credits === 12 && (await bal()) === 88, `balance ${await bal()}`);
  ok("3 jobs and 3 ledger rows", (await one(db, "select (select count(*) from public.blocky_jobs)::int j, (select count(*) from public.blocky_credit_ledger where operation='charge')::int l")).j === 3);

  const [j1, j2, j3] = charge.jobs.map((j) => j.job_id);
  const r1 = (await one(db, "select public.blocky_refund_job($1, 'IMAGE_FAILED', 'x', 0) r", [j1])).r;
  const r2 = (await one(db, "select public.blocky_refund_job($1, 'IMAGE_FAILED', 'x', 0) r", [j1])).r;
  ok("blocky_refund_job: gives 4 credits back once; a second refund of the same job does nothing", r1 === true && r2 === false && (await bal()) === 92, `balance ${await bal()}`);
  await db.exec(`select public.blocky_complete_job('${j2}', 'https://example.test/a.jpg', 0.03, '{}'); select public.blocky_complete_job('${j3}', 'https://example.test/b.jpg', 0.03, '{}');`);
  ok("a finished job can't be refunded", (await one(db, "select public.blocky_refund_job($1, 'X', 'x', 0) r", [j2])).r === false && (await bal()) === 92);
  ok("the story moves on when every picture is done", (await one(db, "select status from public.blocky_stories where id=$1", [storyId])).status === "pictures_ready");

  await db.exec(`UPDATE public.profiles SET credit_balance = 3 WHERE id = '${USER}'`);
  const before = (await one(db, "select count(*)::int n from public.blocky_jobs")).n;
  const one4 = JSON.stringify([{ ...items[0] }]);
  ok("not enough credits: refused, nothing charged, no job made", (await fails(db, `select public.blocky_charge_step('${USER}', '${storyId}', 'regenerate', ARRAY['pictures_ready'], 'pictures', '${one4}'::jsonb)`, /INSUFFICIENT_CREDITS/)) === true && (await bal()) === 3 && (await one(db, "select count(*)::int n from public.blocky_jobs")).n === before);
  await db.exec(`UPDATE public.profiles SET credit_balance = 500 WHERE id = '${USER}'`);
  const clip = JSON.stringify([{ scene_id: scenes[1], kind: "clip", tool_key: "video:blocky-story-v3", price_input: { durationSec: 5, withSound: true, width: 720, height: 1280 }, request: { model: "x" } }]);
  ok("a Pro tier clip on a Starter plan: refused, nothing charged", (await fails(db, `select public.blocky_charge_step('${USER}', '${storyId}', 'reclip', ARRAY['pictures_ready'], 'animating', '${clip}'::jsonb)`, /PLAN_UPGRADE_REQUIRED: pro/)) === true && (await bal()) === 500);
  const clip2 = JSON.stringify([{ scene_id: scenes[1], kind: "clip", tool_key: "video:blocky-story-v2", price_input: { durationSec: 5, withSound: true, width: 720, height: 1280 }, request: { model: "x" } }]);
  const c2 = (await one(db, `select public.blocky_charge_step('${USER}', '${storyId}', 'reclip', ARRAY['pictures_ready'], 'animating', '${clip2}'::jsonb) r`)).r;
  ok("a V2 clip of 5 s is priced on the server: 25 credits", c2.credits === 25 && (await bal()) === 475);
  ok("the wrong story status is refused", (await fails(db, `select public.blocky_charge_step('${USER}', '${storyId}', 'pictures', ARRAY['draft'], 'pictures', '${one4}'::jsonb)`, /WRONG_STATUS/)) === true);

  // The browser: reads its own stories, writes nothing, can't read the library.
  await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${USER}', false);`);
  ok("the browser reads its own story", (await one(db, "select count(*)::int n from public.blocky_stories")).n === 1);
  ok("the browser can't write a story", (await fails(db, `UPDATE public.blocky_stories SET title = 'x'`, /permission denied|BLOCKY_READ_ONLY/)) === true);
  ok("the browser can't read the avatar library, the jobs or the ledger directly", (await fails(db, "select * from public.blocky_characters", /permission denied/)) === true && (await fails(db, "select * from public.blocky_jobs", /permission denied/)) === true && (await fails(db, "select * from public.blocky_credit_ledger", /permission denied/)) === true);
  ok("the browser can't call the charge function", (await fails(db, `select public.blocky_charge_step('${USER}', '${storyId}', 'pictures', ARRAY['draft'], 'pictures', '${one4}'::jsonb)`, /permission denied/)) === true);
  ok("the browser can't read or flip the paid switch", (await fails(db, "select * from public.blocky_settings", /permission denied/)) === true && (await fails(db, "update public.blocky_settings set paid_calls = true", /permission denied/)) === true && (await fails(db, "select public.blocky_paid_state(0)", /permission denied/)) === true);
  await db.exec(`SELECT set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);`);
  ok("another user sees nothing", (await one(db, "select count(*)::int n from public.blocky_stories")).n === 0);
  await db.exec("RESET ROLE");

  // The switch and the daily cap. One clip job is still queued here: 25 credits, counted as about $0.25 in flight.
  await db.exec("UPDATE public.blocky_settings SET paid_calls = true");
  const open = await paid();
  ok("switched on: paid calls are allowed, and the running job is counted", open.on === true && Number(open.spent_usd) === 0 && Math.abs(Number(open.in_flight_usd) - 0.2525) < 1e-6, JSON.stringify(open));
  await db.exec(`INSERT INTO public.blocky_ai_calls (user_id, provider, model, purpose, request, cost_usd) VALUES ('${USER}', 'runware', 'm', 'clip', '{}', 2.60)`);
  ok("under the cap: a small step is still allowed ($2.60 spent + $0.25 running + $0.10)", (await paid(0.10)).on === true);
  const over = await paid(0.20);
  ok("a step that would pass the cap is refused before it is charged ($2.60 + $0.25 + $0.20 > $3.00)", over.on === false && over.reason === "cap_reached", JSON.stringify(over));
  await db.exec(`INSERT INTO public.blocky_ai_calls (user_id, provider, model, purpose, request, cost_usd, created_at) VALUES ('${USER}', 'runware', 'm', 'clip', '{}', 50, now() - interval '2 days')`);
  ok("yesterday's spend doesn't count toward today", (await paid(0.10)).on === true);
  await db.exec("UPDATE public.blocky_settings SET daily_cap_usd = 2.5");
  ok("lowering the cap below today's spend stops paid calls at once", (await paid()).on === false && (await paid()).reason === "cap_reached");
  await db.exec("UPDATE public.blocky_settings SET paid_calls = false, daily_cap_usd = 3");
  ok("switched off again: nothing is allowed, whatever the cap", (await paid()).on === false && (await paid()).reason === "switch_off");
  ok("the switch is one row and can't become two", (await fails(db, "INSERT INTO public.blocky_settings (id) VALUES (true)", /duplicate key/)) === true && (await fails(db, "INSERT INTO public.blocky_settings (id) VALUES (false)", /check constraint/)) === true);

  await db.exec(sql("supabase/rollbacks/20261026100000_blocky_stories_backend_rollback.sql"));
  ok("the rollback removes every Blocky object and keeps the price rows", (await one(db, "select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'blocky%'")).n === 0 && (await one(db, "select count(*)::int n from pg_proc where proname like 'blocky%' or proname = 'trigger_blocky_reconcile'")).n === 0 && (await one(db, "select count(*)::int n from public.tool_prices where tool_key like '%blocky%'")).n === 4);
  await db.close();
}

/* ───────────────── B. The Fruit undo, on a replica of live ───────────────── */
function fruitReplica() {
  const out = ["CREATE SEQUENCE public.fruit_credit_ledger_id_seq;"];
  for (const t of live.tables) {
    out.push(`CREATE TABLE public.${t.name} (\n${t.columns.map((c) => `  "${c.name}" ${c.type}${c.generated ? ` GENERATED ALWAYS AS (${c.default}) STORED` : `${c.notnull ? " NOT NULL" : ""}${c.default ? ` DEFAULT ${c.default}` : ""}`}`).join(",\n")}\n);`);
  }
  const rank = { p: 0, u: 1, c: 2, f: 3 };
  for (const c of [...live.constraints].sort((a, b) => rank[a.type] - rank[b.type])) out.push(`ALTER TABLE public.${c.table} ADD CONSTRAINT ${c.name} ${c.def};`);
  for (const i of live.indexes) out.push(`${i.def};`);
  for (const f of live.functions) out.push(`${f.def};`);
  for (const t of live.triggers) out.push(`${t.def};`);
  return out.join("\n");
}
const shape = async (db) => ({
  nicheColumns: (await db.query("select table_name||'.'||column_name c from information_schema.columns where table_schema='public' and table_name like 'fruit%' and column_name in ('niche','overlay') order by 1")).rows.map((r) => r.c),
  nicheIndexes: (await db.query("select indexname from pg_indexes where schemaname='public' and indexname like '%niche%' order by 1")).rows.map((r) => r.indexname),
  nicheConstraints: (await db.query("select conname from pg_constraint where conname like '%niche%' order by 1")).rows.map((r) => r.conname),
  pickIdeas: (await db.query("select pg_get_function_identity_arguments(oid) a from pg_proc where proname='fruit_pick_ideas'")).rows.map((r) => r.a),
  createStory: (await db.query("select pg_get_function_identity_arguments(oid) a from pg_proc where proname='fruit_create_story'")).rows.map((r) => r.a),
  firstNameIndex: (await db.query("select indexdef from pg_indexes where schemaname='public' and indexname like 'fruit_characters%first_name%'")).rows.map((r) => r.indexdef),
  ageGenderRequired: (await db.query("select attname, attnotnull from pg_attribute where attrelid='public.fruit_characters'::regclass and attname in ('age','gender') order by 1")).rows.map((r) => `${r.attname}:${r.attnotnull}`),
  counts: await one(db, "select (select count(*) from public.fruit_characters)::int characters, (select count(*) from public.fruit_ideas)::int ideas, (select count(*) from public.fruit_stories)::int stories, (select count(*) from public.fruit_story_scenes)::int scenes"),
});
async function seededReplica() {
  const db = new PGlite();
  await db.exec(PLATFORM);
  await db.exec(fruitReplica());
  await db.exec(`INSERT INTO auth.users VALUES ('${USER}'); INSERT INTO public.profiles VALUES ('${USER}', 'starter', 100, 0);`);
  const ch = (id, name, fruit, gender, age) => `('${id}', '${name}', '${fruit}', '${gender}', ${age}, 'Wife', 'Calm', 'calm', 'face', 'build', 'outfit', 'https://example.test/${id}.jpg', 'p', 768, 1376, 'm', 'p')`;
  await db.exec(`INSERT INTO public.fruit_characters (id, name, fruit, gender, age, tag, role, voice_style, face, build, outfit, ref_image_url, ref_image_path, ref_width, ref_height, ref_model, ref_prompt) VALUES ${ch("mia", "Mia Mango", "mango", "female", 34)}, ${ch("rick", "Rick Radish", "radish", "male", 41)};`);
  for (let i = 0; i < 8; i++) await db.exec(`INSERT INTO public.fruit_ideas (id, title, summary, cast_ids, story_type) VALUES ('idea-${i}', 'Idea ${i}', 'Summary', ARRAY['mia','rick'], 'drama');`);
  return db;
}
// The calls the LIVE functions make (fruit-story-api v56): named arguments, exactly these.
const liveCalls = async (db) => {
  const ideas = (await db.query("select * from public.fruit_pick_ideas(p_seed := $1, p_count := $2)", [`${USER}:0`, 5])).rows;
  const scene = { title: "t", speaker_id: "mia", line: "Tonight has to be perfect.", present_ids: ["mia", "rick"], location_id: "loc1", action: "a", emotion: "e", shot: "close-up", placement: "", duration_sec: 5 };
  const story = { source: "prompt", input: {}, title: "T", cast_ids: ["mia", "rick"], quality: "v2", aspect: "9:16", length_sec: 15, locations: [], planner: {} };
  await db.exec("BEGIN");
  const id = (await one(db, "select public.fruit_create_story(p_user_id := $1, p_story := $2::jsonb, p_scenes := $3::jsonb, p_call_ids := '{}') id", [USER, JSON.stringify(story), JSON.stringify([scene, scene])])).id;
  const n = (await one(db, "select count(*)::int n from public.fruit_story_scenes where story_id=$1", [id])).n;
  await db.exec("ROLLBACK");   // the dry run: the story is never kept
  return { ideas: ideas.length, sameIdeas: ideas.map((i) => i.id).join(","), scenes: n };
};
{
  console.log("\nB. The Fruit undo, on a replica of Fruit's live tables and functions");
  const db = await seededReplica();
  const before = await shape(db);
  ok("the replica matches live: template columns on 5 tables, the three-argument fruit_pick_ideas", before.nicheColumns.length === 5 && before.pickIdeas.join() === "p_seed text, p_count integer, p_niche text", before.nicheColumns.join(" "));
  // One real story kept across the undo.
  await db.exec(`select public.fruit_create_story('${USER}', '{"source":"prompt","title":"Kept","cast_ids":["mia","rick"],"quality":"v2","aspect":"9:16","length_sec":15}'::jsonb, '[{"speaker_id":"mia","line":"Hello there.","present_ids":["mia"],"duration_sec":5}]'::jsonb, '{}')`);
  const callsBefore = await liveCalls(db);
  ok("before: the live calls work (5 ideas; a rolled-back story with 2 scenes)", callsBefore.ideas === 5 && callsBefore.scenes === 2);

  await db.exec(sql("supabase/pending/20261026090000_story_niches_undo.sql"));
  const after = await shape(db);
  ok("the undo runs from start to finish, in its one transaction", true);
  ok("no template or overlay column is left", after.nicheColumns.length === 0, JSON.stringify(after.nicheColumns));
  ok("no template index or check is left", after.nicheIndexes.length === 0 && after.nicheConstraints.length === 0, JSON.stringify([after.nicheIndexes, after.nicheConstraints]));
  ok("fruit_pick_ideas: exactly one, with two arguments", after.pickIdeas.join("|") === "p_seed text, p_count integer");
  ok("fruit_create_story: exactly one, the same four arguments", after.createStory.join("|") === before.createStory.join("|") && after.createStory.length === 1);
  ok("first names unique table-wide again; age and gender required again", after.firstNameIndex.join() === "CREATE UNIQUE INDEX fruit_characters_first_name_key ON public.fruit_characters USING btree (first_name)" && after.ageGenderRequired.join() === "age:true,gender:true", after.firstNameIndex.join());
  ok("no row lost: characters, ideas, stories and scenes are the same", JSON.stringify(after.counts) === JSON.stringify((await shape(db)).counts) && after.counts.stories === 1 && after.counts.characters === 2 && after.counts.ideas === 8, JSON.stringify(after.counts));
  const callsAfter = await liveCalls(db);
  ok("after: the same live calls work, and give the same 5 ideas in the same order", callsAfter.ideas === 5 && callsAfter.scenes === 2 && callsAfter.sameIdeas === callsBefore.sameIdeas);
  // The restored functions are the originals, word for word.
  const def = async (name) => (await one(db, "select pg_get_functiondef(oid) d from pg_proc where proname=$1", [name])).d.trim();
  const original = (file, name) => { const t = sql(file).replace(/\r\n/g, "\n"); const a = t.lastIndexOf(`CREATE OR REPLACE FUNCTION public.${name}(`); return t.slice(a, t.indexOf("$function$;", a) + "$function$".length).trim(); };
  // Only how Postgres prints a definition back differs: the schema prefix on the return type, a default's cast, white space.
  const norm = (d) => d.replace(/DEFAULT '\{\}'::uuid\[\]/, "DEFAULT '{}'").replace("RETURNS SETOF public.fruit_ideas", "RETURNS SETOF fruit_ideas").replace(/\s+/g, " ").trim();
  ok("fruit_pick_ideas is the original of 20260927123135, word for word", norm(await def("fruit_pick_ideas")) === norm(original("supabase/migrations/20260927123135_fruit_story_backend.sql", "fruit_pick_ideas")));
  ok("fruit_create_story is the original of 20260930151906, word for word", norm(await def("fruit_create_story")) === norm(original("supabase/migrations/20260930151906_fruit_staging_and_test_override.sql", "fruit_create_story")));
  // The other eight functions are untouched.
  const others = live.functions.filter((f) => !["fruit_pick_ideas", "fruit_create_story"].includes(f.name));
  let same = 0;
  const firstDiff = (a, b) => { let i = 0; while (i < a.length && a[i] === b[i]) i++; return `at ${i}: now ${JSON.stringify(a.slice(Math.max(0, i - 40), i + 50))} / expected ${JSON.stringify(b.slice(Math.max(0, i - 40), i + 50))}`; };
  for (const f of others) { const now = norm(await def(f.name)); if (now === norm(f.def)) same += 1; else console.log("   differs:", f.name, firstDiff(now, norm(f.def))); }
  { const now = norm(await def("fruit_pick_ideas")); const want = norm(original("supabase/migrations/20260927123135_fruit_story_backend.sql", "fruit_pick_ideas")); if (now !== want) console.log("   differs: fruit_pick_ideas", firstDiff(now, want)); }
  ok(`the other ${others.length} Fruit functions are untouched (charge, refund, complete, status, guards, alert)`, same === others.length);

  // A second run changes nothing and fails nothing.
  await db.exec(sql("supabase/pending/20261026090000_story_niches_undo.sql"));
  ok("running the undo a second time changes nothing and fails nothing", JSON.stringify(await shape(db)) === JSON.stringify(after));

  // And back: the rollback of the undo puts the columns back.
  await db.exec(sql("supabase/pending/20261026090000_story_niches_undo_rollback.sql"));
  const back = await shape(db);
  ok("the undo's own rollback puts everything back", back.nicheColumns.join() === before.nicheColumns.join() && back.pickIdeas.join() === before.pickIdeas.join());
  await db.close();

  // Refusals: nothing changes when a row belongs to another template.
  const db2 = await seededReplica();
  await db2.exec(`INSERT INTO public.fruit_characters (id, name, niche, fruit, tag, role, voice_style, face, build, outfit, ref_image_url, ref_image_path, ref_width, ref_height, ref_model, ref_prompt) VALUES ('vex', 'Vex', 'blocky', 'avatar', 'Admin', 'r', 'v', 'f', 'b', 'o', 'https://example.test/vex.jpg', 'p', 768, 1376, 'm', 'p');`);
  const refused = await fails(db2, sql("supabase/pending/20261026090000_story_niches_undo.sql"), /undo refused: 1 rows of fruit_characters belong to another template/);
  await db2.exec("ROLLBACK").catch(() => {});
  const still = await shape(db2);
  ok("with a row of another template: refused, and nothing at all changed", refused === true && still.nicheColumns.length === 5 && still.pickIdeas.join() === "p_seed text, p_count integer, p_niche text", String(refused));
  await db2.close();
}

const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length} of ${results.length} checks passed`);
process.exitCode = bad.length ? 1 : 0;
