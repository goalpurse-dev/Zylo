// Wrote supabase/migrations/20261026100000_blocky_stories_backend.sql (and its
// rollback) from the LIVE definitions of AI Fruit Story's backend
// (fruit_live_schema.json, read from the real database on 2026-10-06 with
// readFruitLiveSchema.sql, which only reads), under Blocky's names.
// The copied part was a one-time copy. Blocky's own parts (the avatar library,
// the paid-calls switch and daily cap) are written here by hand. Once the file
// is applied to the real database this is the record of where it came from:
// later changes are their own migrations.
//   node scripts/blocky/sql/generateBackend.cjs
const fs = require("fs");
const path = require("path");
const schemaFile = path.join(__dirname, "fruit_live_schema.json");
const outFile = process.argv[2] ?? "supabase/migrations/20261026100000_blocky_stories_backend.sql";
const s = JSON.parse(fs.readFileSync(schemaFile, "utf8"));
const rn = (t) => String(t)
  .replace(/x-fruit-worker-secret/g, "x-blocky-worker-secret")
  .replace(/FRUIT_/g, "BLOCKY_")
  .replace(/fruit_/g, "blocky_");

// The idea engine is its own phase; the library table is Blocky's own shape (below).
const SKIP_TABLES = new Set(["fruit_ideas", "fruit_characters"]);
// Columns that were only ever for the template seam inside Fruit's tables.
const SKIP_COLUMNS = new Set(["niche", "overlay"]);
const ORDER = ["fruit_series", "fruit_stories", "fruit_story_scenes", "fruit_charges", "fruit_test_overrides", "fruit_jobs", "fruit_credit_ledger", "fruit_ai_calls", "fruit_series_episodes", "fruit_provider_alerts"];
const tables = ORDER.map((n) => s.tables.find((t) => t.name === n));
if (tables.some((t) => !t) || s.tables.filter((t) => !SKIP_TABLES.has(t.name)).length !== ORDER.length) throw new Error("table list changed");

const out = [];
const p = (...lines) => out.push(...lines);

p(`-- Blocky Stories: its own backend. Its own tables (blocky_*), functions,
-- row-level security, guards, live updates and job sweep. Nothing here reads,
-- writes, alters or depends on an AI Fruit Story object (fruit_*).
--
-- Built as a copy of the LIVE definitions of AI Fruit Story's backend (read
-- from the real database on 2026-10-06) under Blocky's names, so the money
-- path is the one that already runs in production:
--   blocky_charge_step        one atomic charge per paid step, priced on the server
--   blocky_refund_job         a failed job gives its credits back, once
--   blocky_complete_job, blocky_refresh_story_status, blocky_create_story
-- What is shared is the platform's, exactly as Fruit uses it: profiles (the
-- ONE credit balance), deduct_credits, tool_prices + compute_tool_price.
--
-- Credits and row locking (the same as Fruit's, so a Blocky charge and a
-- Fruit charge at the same moment can never spend the same credits):
--   - a charge goes through public.deduct_credits: ONE statement,
--       UPDATE profiles SET credit_balance = credit_balance - n WHERE id = uid AND credit_balance >= n
--     Postgres locks that profile row for the statement. A second charge on
--     the same account (Blocky's or Fruit's) waits for the first to finish,
--     then checks the balance that is left. No path reads the balance first
--     and writes it later.
--   - a refund is ONE statement too: credit_balance = credit_balance + n, on
--     the same row, after the job row is locked (FOR UPDATE) and checked, so
--     a job is refunded at most once (also guarded by the ledger's unique key).
--   - the story row and each scene row are locked (FOR UPDATE) for the step.
--
-- Different from Fruit on purpose:
--   - blocky_characters: an avatar has no age and no gender column at all.
--   - the library is not readable from the browser (no policy): the API serves
--     it, behind the blocky_v1 switch.
--   - no ideas table yet (the idea engine is its own phase).
--   - blocky_settings: paid calls are OFF until the owner switches them on, and
--     stop for the day at a spending cap ($3.00 to start with).
--
-- Rollback: supabase/rollbacks/20261026100000_blocky_stories_backend_rollback.sql

BEGIN;
SET LOCAL lock_timeout = '5s';
`);

/* ── guards ── */
for (const n of ["fruit_plan_rank", "fruit_block_client_writes", "fruit_characters_block_client_writes"]) {
  const f = s.functions.find((x) => x.name === n);
  p(`${rn(f.def)};`, `REVOKE ALL ON FUNCTION public.${rn(f.name)}(${f.args.replace(/\bp_\w+ /g, "")}) FROM PUBLIC, anon, authenticated;`, `GRANT EXECUTE ON FUNCTION public.${rn(f.name)}(${f.args.replace(/\bp_\w+ /g, "")}) TO service_role;`, "");
}

/* ── the avatar library: Blocky's own shape ── */
p(`/* ─── The avatar library ──────────────────────────────────────────────── */

-- An avatar is "a blocky game avatar": a name, a locked look, a face decal and
-- how it sounds. There is NO age and NO gender column, so neither can ever
-- reach a prompt.
CREATE TABLE public.blocky_characters (
  id             text PRIMARY KEY CHECK (id ~ '^[a-z][a-z0-9-]{0,39}$'),
  name           text NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  first_name     text GENERATED ALWAYS AS (lower(split_part(name, ' ', 1))) STORED,
  hue            smallint NOT NULL DEFAULT 0 CHECK (hue BETWEEN 0 AND 360),
  tag            text NOT NULL,
  role           text NOT NULL,
  role_tags      text[] NOT NULL DEFAULT '{}',
  voice_style    text NOT NULL,
  face           text NOT NULL,
  look           text NOT NULL,
  ref_image_url  text NOT NULL CHECK (ref_image_url ~ '^https?://'),
  ref_image_path text NOT NULL,
  ref_width      smallint NOT NULL,
  ref_height     smallint NOT NULL,
  ref_model      text NOT NULL,
  ref_seed       bigint,
  ref_prompt     text NOT NULL,
  ref_cost_usd   numeric(10,6),
  active         boolean NOT NULL DEFAULT true,
  temporary      boolean NOT NULL DEFAULT false,
  sort_order     integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.blocky_characters IS 'Blocky Stories avatar library. No age, no gender. Written by the service role only; the API serves it.';
COMMENT ON COLUMN public.blocky_characters.temporary IS 'true = a stand-in made from a test picture, to be replaced when the real library is made. Find them: SELECT id FROM blocky_characters WHERE temporary;';
-- Script-name matching uses the first word of the name, so it is unique.
CREATE UNIQUE INDEX blocky_characters_first_name_key ON public.blocky_characters (first_name);
CREATE INDEX blocky_characters_list_idx ON public.blocky_characters (sort_order) WHERE active;
`);

/* ── tables ── */
p(`/* ─── Stories, scenes, series, jobs, charges, the ledger, the call log ─── */`, "");
for (const t of tables) {
  const cols = t.columns.filter((c) => !SKIP_COLUMNS.has(c.name)).map((c) => {
    const serial = /^nextval\('fruit_credit_ledger_id_seq'/.test(c.default ?? "");
    const type = serial ? "bigserial" : c.type.replace("timestamp with time zone", "timestamptz");
    return `  ${c.name} ${type}${c.notnull && !serial ? " NOT NULL" : ""}${c.default && !serial ? ` DEFAULT ${c.default}` : ""}`;
  });
  p(`CREATE TABLE public.${rn(t.name)} (`, cols.join(",\n"), `);`, "");
}
const cons = s.constraints.filter((c) => !SKIP_TABLES.has(c.table) && !/niche|overlay/.test(c.name));
const rank = { p: 0, u: 1, c: 2, f: 3 };
for (const c of [...cons].sort((a, b) => rank[a.type] - rank[b.type] || ORDER.indexOf(a.table) - ORDER.indexOf(b.table) || a.name.localeCompare(b.name))) {
  p(`ALTER TABLE public.${rn(c.table)} ADD CONSTRAINT ${rn(c.name)} ${rn(c.def).replace(/REFERENCES blocky_/g, "REFERENCES public.blocky_")};`);
}
p("");
for (const i of s.indexes.filter((x) => !SKIP_TABLES.has(x.table) && !/niche/.test(x.name))) p(`${rn(i.def)};`);
p("");

/* ── row-level security, guards, grants ── */
p(`/* ─── Who can read and write ──────────────────────────────────────────── */

-- Every table: row-level security on. The browser can only READ its own
-- stories, scenes, series and episodes (that is what live updates use); it can
-- write nothing. Everything else is the service role's.`);
const all = ["fruit_characters", ...ORDER];
for (const n of all) p(`ALTER TABLE public.${rn(n)} ENABLE ROW LEVEL SECURITY;`);
p("");
for (const pol of s.policies.filter((x) => !SKIP_TABLES.has(x.table))) {
  p(`CREATE POLICY ${rn(pol.name)} ON public.${rn(pol.table)} FOR ${pol.cmd} TO ${pol.roles.join(", ")} USING (${pol.qual});`);
}
p("");
for (const n of all) {
  p(`REVOKE ALL ON public.${rn(n)} FROM PUBLIC, anon, authenticated;`, `GRANT ALL ON public.${rn(n)} TO service_role;`);
  const readers = [...new Set(s.grants.filter((g) => g.table === n && g.privilege === "SELECT" && ["anon", "authenticated"].includes(g.grantee)).map((g) => g.grantee))];
  if (readers.length && n !== "fruit_characters") p(`GRANT SELECT ON public.${rn(n)} TO ${readers.join(", ")};`);
}
p(`GRANT USAGE, SELECT ON SEQUENCE public.blocky_credit_ledger_id_seq TO service_role;`, "");
for (const tg of s.triggers.filter((x) => x.table !== "fruit_ideas")) p(`${rn(tg.def).replace("EXECUTE FUNCTION blocky_", "EXECUTE FUNCTION public.blocky_")};`);
p("");

/* ── functions ── */
p(`/* ─── The money path and the story state ──────────────────────────────── */`, "");
const sig = (f) => f.args.split(",").map((a) => a.trim().replace(/^p_\w+\s+/, "")).join(", ");
// blocky_create_story: Fruit's body from before the template seam (20260930151906), under Blocky's names.
const undo = fs.readFileSync("supabase/migrations/20261026090000_story_niches_undo.sql", "utf8").replace(/\r\n/g, "\n");
const a = undo.indexOf("CREATE OR REPLACE FUNCTION public.fruit_create_story");
const b = undo.indexOf("$function$;", a) + "$function$;".length;
if (a < 0 || b < a) throw new Error("create_story body");
p(rn(undo.slice(a, b)), "");
for (const n of ["fruit_refresh_story_status", "fruit_charge_step", "fruit_complete_job", "fruit_refund_job", "fruit_raise_provider_alert"]) {
  const f = s.functions.find((x) => x.name === n);
  p(`${rn(f.def)};`, "");
}
for (const n of ["fruit_create_story", "fruit_refresh_story_status", "fruit_charge_step", "fruit_complete_job", "fruit_refund_job", "fruit_raise_provider_alert"]) {
  const f = s.functions.find((x) => x.name === n);
  p(`REVOKE ALL ON FUNCTION public.${rn(n)}(${sig(f)}) FROM PUBLIC, anon, authenticated;`, `GRANT EXECUTE ON FUNCTION public.${rn(n)}(${sig(f)}) TO service_role;`);
}
p("");

/* ── the paid-calls switch and the daily cap (Blocky's own) ── */
p(`/* ─── Paid calls: off by default, and a daily spending cap ────────────── */

-- ONE row. paid_calls = false (the default): no Blocky call that costs money
-- at a provider is made. daily_cap_usd: when today's spend reaches it, paid
-- calls stop until 00:00 UTC. The owner changes the row (the table editor, or
-- node scripts/blocky/paid.mjs on | off | cap 3); nobody else can read or write it.
CREATE TABLE public.blocky_settings (
  id            boolean PRIMARY KEY DEFAULT true CHECK (id),
  paid_calls    boolean NOT NULL DEFAULT false,
  daily_cap_usd numeric(8,2) NOT NULL DEFAULT 3.00 CHECK (daily_cap_usd >= 0),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.blocky_settings IS 'Blocky Stories: the paid-calls switch (off by default) and the daily spending cap in USD. One row.';
INSERT INTO public.blocky_settings (id) VALUES (true);
ALTER TABLE public.blocky_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.blocky_settings FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.blocky_settings TO service_role;
CREATE TRIGGER zzz_blocky_settings_guard BEFORE INSERT OR DELETE OR UPDATE ON public.blocky_settings FOR EACH ROW EXECUTE FUNCTION public.blocky_block_client_writes('touch');

-- The switch and the cap, as the functions read them before every paid step.
--   spent_usd      what blocky_ai_calls has logged since 00:00 UTC (every paid call is logged with its real cost)
--   in_flight_usd  jobs charged and still running: their cost is not known yet, so it is estimated from their
--                  credits (a credit costs us at most $0.0101 at a provider; never under one picture, $0.04)
--   p_add_usd      what the step being asked for is expected to cost
-- on = the switch is on AND spent + in flight + this step stays within the cap.
CREATE OR REPLACE FUNCTION public.blocky_paid_state(p_add_usd numeric DEFAULT 0)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  WITH s AS (
    SELECT COALESCE((SELECT paid_calls FROM public.blocky_settings), false) AS paid_calls,
           COALESCE((SELECT daily_cap_usd FROM public.blocky_settings), 0) AS cap_usd,
           (SELECT COALESCE(sum(cost_usd), 0) FROM public.blocky_ai_calls
             WHERE created_at >= (date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')) AS spent_usd,
           (SELECT COALESCE(sum(GREATEST(credits * 0.0101, 0.04)), 0) FROM public.blocky_jobs
             WHERE status IN ('queued', 'submitting', 'submitted', 'provider_done')) AS in_flight_usd
  )
  SELECT jsonb_build_object(
    'on', paid_calls AND spent_usd + in_flight_usd + GREATEST(COALESCE(p_add_usd, 0), 0) <= cap_usd,
    'reason', CASE WHEN NOT paid_calls THEN 'switch_off'
                   WHEN spent_usd + in_flight_usd + GREATEST(COALESCE(p_add_usd, 0), 0) > cap_usd THEN 'cap_reached' END,
    'paid_calls', paid_calls,
    'cap_usd', cap_usd,
    'spent_usd', round(spent_usd, 4),
    'in_flight_usd', round(in_flight_usd, 4)
  ) FROM s
$function$;
REVOKE ALL ON FUNCTION public.blocky_paid_state(numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.blocky_paid_state(numeric) TO service_role;
`);

/* ── realtime, sweep, prices, flag ── */
p(`/* ─── Live updates ────────────────────────────────────────────────────── */

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.blocky_stories, public.blocky_story_scenes;
  END IF;
END $$;

/* ─── The job sweep (every 20 seconds, only when something is in flight) ── */

-- Calls blocky-worker's reconcile with its secret. Both live in the vault
-- (blocky_worker_url, blocky_worker_secret); until they are set this does nothing.
CREATE SCHEMA IF NOT EXISTS private;
CREATE OR REPLACE FUNCTION private.trigger_blocky_reconcile()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE secret text; worker_url text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.blocky_jobs WHERE status IN ('queued', 'submitting', 'submitted', 'provider_done'))
     AND NOT EXISTS (SELECT 1 FROM public.blocky_stories WHERE status = 'building') THEN
    RETURN;
  END IF;
  SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets WHERE name = 'blocky_worker_secret' LIMIT 1;
  SELECT decrypted_secret INTO worker_url FROM vault.decrypted_secrets WHERE name = 'blocky_worker_url' LIMIT 1;
  IF secret IS NULL OR worker_url IS NULL THEN
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := worker_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-blocky-worker-secret', secret),
    body := jsonb_build_object('action', 'reconcile'),
    timeout_milliseconds := 15000
  );
END;
$function$;
REVOKE ALL ON FUNCTION private.trigger_blocky_reconcile() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.trigger_blocky_reconcile() TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'blocky-story-reconcile';
    PERFORM cron.schedule('blocky-story-reconcile', '20 seconds', 'select private.trigger_blocky_reconcile();');
  END IF;
END $$;
`);

const prices = s.prices.filter((r) => /blocky/.test(r.tool_key));
if (prices.length !== 4) throw new Error("expected the 4 Blocky price rows");
// tool_prices: allowed_durations integer[], allowed_sizes text[], size_tiers jsonb (read from the real database).
const lit = (v) => `'${String(v).replace(/'/g, "''")}'`;
const q = (v, k) => {
  if (v === null || v === undefined) return "NULL";
  if (k === "allowed_durations") return `ARRAY[${v.join(", ")}]::integer[]`;
  if (k === "allowed_sizes") return `ARRAY[${v.map(lit).join(", ")}]::text[]`;
  if (k === "size_tiers") return `${lit(JSON.stringify(v))}::jsonb`;
  return typeof v === "number" || typeof v === "boolean" ? String(v) : lit(v);
};
const priceCols = ["tool_key", "credits_per_second", "flat_credits", "allowed_durations", "allowed_sizes", "requires_sound", "min_plan", "active", "notes"];
for (const r of prices) if (r.size_tiers !== null || r.sound_credits_per_second !== null) throw new Error("a Blocky price row uses a column this insert leaves out");
p(`/* ─── Price rows and the switch ───────────────────────────────────────── */

-- Blocky's own price rows and its switch. On the real database they exist
-- already (20261006190000, kept by the undo); a fresh database gets them here.`);
for (const r of prices) {
  p(`INSERT INTO public.tool_prices (${priceCols.join(", ")}) VALUES (${priceCols.map((k) => q(r[k], k)).join(", ")}) ON CONFLICT (tool_key) DO NOTHING;`);
}
p(`INSERT INTO public.global_feature_flags (key, enabled, note) VALUES ('blocky_v1', false, 'Blocky Stories for everyone. false = hidden (accounts with a per-user blocky_v1 flag still get it).') ON CONFLICT (key) DO NOTHING;`, "");
p(`NOTIFY pgrst, 'reload schema';`, `COMMIT;`, "");
fs.writeFileSync(outFile, out.join("\n"));

// Rollback.
fs.writeFileSync(process.argv[3] ?? "supabase/rollbacks/20261026100000_blocky_stories_backend_rollback.sql", `-- Rollback for 20261026100000_blocky_stories_backend.sql: removes Blocky Stories' backend.
-- It deletes every Blocky story, scene, job, charge row and log row. Credits already
-- charged stay charged (the balance is on profiles); refund by hand first if any are owed.
-- It touches no AI Fruit Story object, and keeps the price rows and the blocky_v1 switch.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'blocky-story-reconcile';
  END IF;
END $$;
DROP FUNCTION IF EXISTS private.trigger_blocky_reconcile();
${["blocky_create_story(uuid, jsonb, jsonb, uuid[])", "blocky_charge_step(uuid, uuid, text, text[], text, jsonb)", "blocky_complete_job(uuid, text, numeric, jsonb)", "blocky_refund_job(uuid, text, text, numeric)", "blocky_refresh_story_status(uuid)", "blocky_raise_provider_alert(text, text, text, jsonb)"].map((f) => `DROP FUNCTION IF EXISTS public.${f};`).join("\n")}
${[...ORDER].reverse().map((n) => `DROP TABLE IF EXISTS public.${rn(n)} CASCADE;`).join("\n")}
DROP TABLE IF EXISTS public.blocky_characters CASCADE;
DROP FUNCTION IF EXISTS public.blocky_paid_state(numeric);
DROP TABLE IF EXISTS public.blocky_settings CASCADE;
DROP FUNCTION IF EXISTS public.blocky_characters_block_client_writes();
DROP FUNCTION IF EXISTS public.blocky_block_client_writes();
DROP FUNCTION IF EXISTS public.blocky_plan_rank(text);
NOTIFY pgrst, 'reload schema';
COMMIT;
`);
console.log("written", outFile, out.join("\n").split("\n").length, "lines");
