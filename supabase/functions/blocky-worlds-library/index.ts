// deno-lint-ignore-file no-explicit-any
// blocky-worlds-library: the idea library's owner endpoint (docs/blocky-worlds-protocol.md, "The idea library").
//
//   estimate { target }                   -> the expected cost of a batch (no call)
//   start    { target, maxUsd }           -> opens a batch (no call yet); then call tick until it is done
//   tick     { batchId }                  -> one tick: a few generation + judge calls (fits the function time limit)
//   rerank   {}                           -> recompute every live idea's rank from its stats (no call)
//   status   {}                           -> library counts by status/formula/mood, the last batches (no call)
//   addPost  { runId?, libraryId?, url, likes, views, postedAt } -> the owner's real TikTok numbers (they count most)
//
// Who: the owner (the Blocky owner list, gate.js; a signed-in session) for everything; tick also accepts the header x-blocky-worlds-cron
// equal to the function secret BLOCKY_WORLDS_CRON_SECRET (a scheduled job, once the owner sets one up).
// Mock mode (BLOCKY_WORLDS_LLM=mock): every tick is free. A real batch needs an explicit maxUsd and stops before it.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cors, err, ok } from "../shared/cors.ts";
import { isAdmin } from "../_shared/contentMachine/adminGuard.js";
import { blockyOwners } from "../_shared/blockyWorlds/gate.js";
import { batchCost, LIBRARY, rankOf } from "../_shared/blockyWorlds/library.js";
import { MODELS } from "../_shared/blockyWorlds/config.js";
import { PRICE, providerFrom } from "../_shared/blockyWorlds/llm.js";
import { rerank, supabaseStore, tick } from "../_shared/blockyWorlds/libraryJob.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const OWNERS = blockyOwners(Deno.env.get("BLOCKY_WORLDS_OWNER_EMAILS"));
const CRON_SECRET = (Deno.env.get("BLOCKY_WORLDS_CRON_SECRET") ?? "").trim();
const PROVIDER = providerFrom(Deno.env.get("BLOCKY_WORLDS_LLM"));
const PAID_OFF = (Deno.env.get("BLOCKY_WORLDS_PAID_CALLS") ?? "").trim().toLowerCase() === "off";
const MAX_BATCH_USD = 25; // a hard ceiling on any single batch, whatever maxUsd asks for

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const COLS = "id, idea, opener, opener_key, formula, twist, mood, setting, score, status, rank, shown, picked, rewritten, generated, downloaded, thumbs_up, thumbs_down, likes_total";

async function owner(req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token || token === SUPABASE_ANON_KEY) return null;
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data } = await client.auth.getUser(token);
  return data?.user && isAdmin(data.user, OWNERS) ? data.user : null;
}

/** The job's store on Supabase (shared with the local runner, scripts/blockyWorlds/runLibraryBatch.mjs). */
const store = supabaseStore(admin, PROVIDER);

async function handle(req: Request) {
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "");
  const cron = CRON_SECRET && req.headers.get("x-blocky-worlds-cron") === CRON_SECRET;
  const who = cron && action === "tick" ? null : await owner(req);
  if (!cron && !who) return { status: 404, body: { code: "NOT_FOUND", message: "Requested function was not found" } };

  if (action === "estimate") {
    const target = Math.max(1, Math.min(5000, Number(body?.target ?? LIBRARY.target)));
    const price = { gen: PRICE[MODELS.library], judge: PRICE[MODELS.judge] };
    return { body: { target, models: { generate: MODELS.library, judge: MODELS.judge }, at50: batchCost({ accepted: target, acceptRate: 0.5, price }), at35: batchCost({ accepted: target, acceptRate: 0.35, price }), mock: PROVIDER === "mock" } };
  }
  if (action === "start") {
    const target = Math.max(1, Math.min(5000, Number(body?.target ?? LIBRARY.target)));
    const maxUsd = Number(body?.maxUsd);
    if (PROVIDER !== "mock" && !(maxUsd > 0)) return { status: 400, body: { error: "A real batch needs maxUsd (the most it may spend)." } };
    if (PROVIDER !== "mock" && PAID_OFF) return { status: 403, body: { error: "Paid calls are off (BLOCKY_WORLDS_PAID_CALLS=off)." } };
    const { data, error } = await admin.from("blocky_worlds_idea_batches").insert({ provider: PROVIDER, requested: target, note: JSON.stringify({ maxUsd: PROVIDER === "mock" ? 0 : Math.min(maxUsd, MAX_BATCH_USD) }) }).select("*").single();
    if (error) throw new Error(error.message);
    return { body: { batch: data } };
  }
  if (action === "tick") {
    const { data: b } = await admin.from("blocky_worlds_idea_batches").select("*").eq("id", String(body?.batchId ?? "")).maybeSingle();
    if (!b) return { status: 404, body: { error: "No such batch." } };
    if (b.status !== "running") return { body: { batch: b, log: ["batch is not running"] } };
    if (b.provider !== PROVIDER) return { status: 409, body: { error: `This batch was started in ${b.provider} mode; the function is in ${PROVIDER} mode.` } };
    const maxUsd = PROVIDER === "mock" ? Infinity : Math.min(Number(JSON.parse(b.note ?? "{}").maxUsd ?? 0), MAX_BATCH_USD);
    return { body: await tick({ store, batch: b, provider: PROVIDER, apiKey: ANTHROPIC_KEY, maxUsd, callsPerTick: 3 }) };
  }
  if (action === "rerank") return { body: await rerank({ store }) };
  if (action === "status") {
    const { data: rows } = await admin.from("blocky_worlds_library").select("status, formula, twist, mood, source, score");
    const count = (f: (r: any) => string) => (rows ?? []).reduce((a: any, r: any) => { const k = f(r); a[k] = (a[k] ?? 0) + 1; return a; }, {});
    const { data: batches } = await admin.from("blocky_worlds_idea_batches").select("*").order("created_at", { ascending: false }).limit(10);
    return { body: { byStatus: count((r) => r.status), live: { byFormula: count((r) => (r.status === "live" ? r.formula : "-")), byMood: count((r) => (r.status === "live" ? r.mood : "-")) }, batches, mock: PROVIDER === "mock" } };
  }
  if (action === "addPost") {
    const likes = Math.max(0, Math.floor(Number(body?.likes ?? 0))), views = Math.max(0, Math.floor(Number(body?.views ?? 0)));
    let libraryId = body?.libraryId ? String(body.libraryId) : null;
    if (!libraryId && body?.runId) libraryId = (await admin.from("blocky_worlds_runs").select("library_id").eq("id", String(body.runId)).maybeSingle()).data?.library_id ?? null;
    await admin.from("blocky_worlds_posts").insert({ run_id: body?.runId ?? null, library_id: libraryId, url: String(body?.url ?? "").slice(0, 500) || null, likes, views, posted_at: body?.postedAt ?? null });
    if (libraryId) {
      const { data: posts } = await admin.from("blocky_worlds_posts").select("likes").eq("library_id", libraryId);
      const total = (posts ?? []).reduce((a: number, p: any) => a + Number(p.likes || 0), 0);
      const { data: row } = await admin.from("blocky_worlds_library").select(COLS).eq("id", libraryId).maybeSingle();
      if (row) await store.update(libraryId, { likes_total: total, rank: rankOf({ ...row, likes_total: total }) });
    }
    return { body: { ok: true, libraryId } };
  }
  return { status: 400, body: { error: "Unknown action." } };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  try {
    const r: any = await handle(req);
    return r.status && r.status >= 400 ? err(req, r.body?.error ?? r.body?.message ?? "Error", r.status, r.body) : ok(req, r.body);
  } catch (e) {
    console.error("[blocky-worlds-library]", e instanceof Error ? e.message : String(e));
    return err(req, "Something went wrong on our side.", 500, { code: "SERVER" });
  }
});
