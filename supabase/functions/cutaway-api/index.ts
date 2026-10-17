// deno-lint-ignore-file no-explicit-any
// cutaway-api: the Cutaway Explainer template's only server entry point.
//
//   start      {topic, lengthSec, soundEffects}   charge step 1 (script + critic, voice, wide images + vision check) and create the run
//   ideas      {}                      the user's used topics (for the topic suggestions)
//   advance    {runId}                 move the run one small step (the page calls this every few seconds)
//   regenerate {runId, index}          redo wide image `index` and the later ones (each is an edit of the one before)
//   approve    {runId}                 "Looks good -> make video": charge step 2 and go on to keyframes, clips, stitch
//
// The pipeline itself is _shared/cutaway/engine.js (also run by scripts/cutaway/runLocal.mjs).
// A step that fails refunds its own charge once. Hidden behind the cutaway_explainer flag.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
import { cors, err, ok } from "../shared/cors.ts";
import { advance, approve, newRun, progressOf, refundsFor, regenerateWide, userMessage } from "../_shared/cutaway/engine.js";
import { cropPixels } from "../_shared/cutaway/beats.js";
import { checkImage, planVideo } from "../_shared/cutaway/llm.js";
import { generateSfx } from "../_shared/cutaway/sound.js";
import { synthesize } from "../_shared/cutaway/voice.js";
import { directSender } from "../_shared/cutaway/runware.js";
import { LENGTHS, PRICES } from "../_shared/cutaway/pricing.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RUNWARE_API_KEY = Deno.env.get("RUNWARE_API_KEY") ?? "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const ELEVENLABS_KEY = Deno.env.get("ELEVENLABS_KEY") ?? "";
const FLY_API_TOKEN = Deno.env.get("FLY_API_TOKEN") ?? "";
const FLY_APP = Deno.env.get("FLY_RENDER_APP") ?? "zyvo-render";
const CUTAWAY_FINAL_IMAGE = Deno.env.get("CUTAWAY_FINAL_IMAGE") ?? `registry.fly.io/${FLY_APP}:cutaway-final`;

const BUCKET = "generated";
const FLAG = "cutaway_explainer";
const PAID_PLANS = new Set(["starter", "pro", "generative", "affiliate"]);
const LEASE_SEC = 140;
const RENDER_TIMEOUT_MS = 12 * 60 * 1000;
const FINAL_MACHINE = { cpu_kind: "performance", cpus: 4, memory_mb: 8192 };
const FINAL_USD_PER_SECOND = 0.0000478;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

/** Keeps work running after the response (EdgeRuntime.waitUntil); plain fire-and-forget elsewhere. */
function background(p: Promise<unknown>) {
  const rt = (globalThis as any).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(p);
}

class ApiError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

// ---------- access ----------

async function requireUser(req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) throw new ApiError("Please sign in.", 401);
  const userId = data.user.id;
  const [{ data: profile }, { data: global }, { data: mine }] = await Promise.all([
    admin.from("profiles").select("plan_code").eq("id", userId).single(),
    admin.from("global_feature_flags").select("enabled").eq("key", FLAG).maybeSingle(),
    admin.from("user_feature_flags").select("flags").eq("user_id", userId).maybeSingle(),
  ]);
  if (!(global?.enabled === true || mine?.flags?.[FLAG] === true)) throw new ApiError("This template isn't available yet.", 403);
  if (!PAID_PLANS.has(String(profile?.plan_code ?? "free").toLowerCase())) throw new ApiError("Cutaway Explainer needs a paid plan.", 402);
  return userId;
}

// ---------- credits ----------

async function price(toolKey: string, input: Record<string, unknown> = {}) {
  const { data, error } = await admin.rpc("compute_tool_price", { p_tool_key: toolKey, p_input: input });
  if (error || data == null) throw new ApiError("Couldn't load the price. Please try again.", 503);
  return Number(data);
}

async function charge(userId: string, credits: number) {
  const { error } = await admin.rpc("deduct_credits", { uid: userId, amount: credits });
  if (error) throw new ApiError(/INSUFFICIENT_CREDITS/.test(error.message) ? "Not enough credits." : "Couldn't charge credits.", /INSUFFICIENT_CREDITS/.test(error.message) ? 402 : 500);
}

/** A failed step refunds its own charge (step 1 before approval, step 2 after), once. */
/**
 * A run that fails on our side refunds what the user paid for it (engine.js#refundsFor).
 * Returns the row patch (charges marked refunded) and the credits to give back; the credits are
 * returned only after that patch is saved, so a refund can never be paid twice.
 */
function refundPlan(row: any, state: any) {
  const charges = Array.isArray(row.charges) ? row.charges.map((c: any) => ({ ...c })) : [];
  const idx = refundsFor(state, charges);
  if (!idx.length) return { patch: {}, credits: 0 };
  let credits = 0;
  for (const i of idx) { credits += Number(charges[i].credits) || 0; charges[i].refunded = true; }
  return { patch: { charges, credits_refunded: (row.credits_refunded ?? 0) + credits }, credits };
}

// ---------- storage ----------

const runPath = (row: any, name: string) => `cutaway/${row.user_id}/${row.id}/${name}`;
const publicUrl = (path: string) => admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

async function upload(path: string, bytes: Uint8Array, contentType: string) {
  const { error } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error(`STORAGE: ${error.message}`);
  return publicUrl(path);
}

async function fetchBytes(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`download ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

// ---------- the engine's dependencies ----------

function depsFor(row: any) {
  return {
    planVideo: ({ topic, lengthSec, usedIdeas }: any) => planVideo({ apiKey: ANTHROPIC_API_KEY, topic, lengthSec, usedIdeas }),
    checkImage: ({ imageUrl, description, checks }: any) => checkImage({ apiKey: ANTHROPIC_API_KEY, imageUrl, description, checks }),
    synthesize: ELEVENLABS_KEY ? ({ text }: any) => synthesize({ apiKey: ELEVENLABS_KEY, text }) : null,
    // Sound effects: one shared cache for every user (cutaway/sfx-cache/<key>.mp3); a hit costs nothing.
    sfx: ELEVENLABS_KEY ? async ({ cacheKey, text, seconds }: any) => {
      const path = `cutaway/sfx-cache/${cacheKey}.mp3`;
      const { data } = await admin.storage.from(BUCKET).list("cutaway/sfx-cache", { search: `${cacheKey}.mp3` });
      if ((data ?? []).some((f: any) => f.name === `${cacheKey}.mp3`)) return { url: publicUrl(path), costUsd: 0, cached: true };
      const { bytes, costUsd } = await generateSfx({ apiKey: ELEVENLABS_KEY, text, seconds });
      return { url: await upload(path, bytes, "audio/mpeg"), costUsd, cached: false };
    } : null,
    saveAudio: async (b64: string) => upload(runPath(row, "voice.mp3"), new Uint8Array(await (await fetch(`data:audio/mpeg;base64,${b64}`)).arrayBuffer()), "audio/mpeg"),
    send: directSender(RUNWARE_API_KEY),
    maxCropsPerTick: 2,
    crop: async ({ imageUrl, box }: any) => {
      const img = await Image.decode(await fetchBytes(imageUrl));
      const p = cropPixels(box, img.width, img.height);
      const jpg = await img.crop(p.x, p.y, p.w, p.h).encodeJPEG(92);
      const url = await upload(runPath(row, `crop-${crypto.randomUUID().slice(0, 8)}.jpg`), jpg, "image/jpeg");
      return { image: url, h: p.h };
    },
    keep: async (url: string, name: string) => upload(runPath(row, name), await fetchBytes(url), name.endsWith(".mp4") ? "video/mp4" : "image/jpeg"),
    startRender: async (job: any) => {
      if (!FLY_API_TOKEN) throw new Error("the video stitcher isn't configured");
      const path = runPath(row, `final-${Date.now().toString(36)}.mp4`);
      const { data: signed, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path, { upsert: true });
      if (error || !signed?.signedUrl) throw new Error("couldn't prepare the upload");
      const res = await fetch(`https://api.machines.dev/v1/apps/${FLY_APP}/machines`, {
        method: "POST",
        headers: { Authorization: `Bearer ${FLY_API_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `cutaway-final-${String(row.id).slice(0, 8)}-${Date.now().toString(36)}`,
          config: {
            image: CUTAWAY_FINAL_IMAGE, guest: FINAL_MACHINE, auto_destroy: true, restart: { policy: "no" },
            init: { cmd: ["node", "src/cutawayFinal.mjs"] },
            env: { CUTAWAY_FINAL_JOB: JSON.stringify({ ...job, runId: row.id, uploadUrl: signed.signedUrl }), WORK_DIR: "/tmp/render", MACHINE_USD_PER_SECOND: String(FINAL_USD_PER_SECOND) },
          },
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`stitcher didn't start (${res.status})`);
      return { path, startedAt: Date.now() };
    },
    checkRender: async (handle: any) => {
      const dir = handle.path.slice(0, handle.path.lastIndexOf("/"));
      const name = handle.path.slice(handle.path.lastIndexOf("/") + 1);
      const { data } = await admin.storage.from(BUCKET).list(dir, { search: name });
      if ((data ?? []).some((f: any) => f.name === name)) {
        const seconds = (Date.now() - handle.startedAt) / 1000;
        return { state: "done", url: publicUrl(handle.path), costUsd: Number((seconds * FINAL_USD_PER_SECOND).toFixed(5)) };
      }
      if (Date.now() - handle.startedAt > RENDER_TIMEOUT_MS) return { state: "error", message: "the stitch took too long" };
      return { state: "pending" };
    },
  };
}

// ---------- rows ----------

/** What the browser gets: the state minus provider task ids and prompts. */
function view(row: any) {
  const s = row.state ?? {};
  return {
    id: row.id, topic: row.topic, lengthSec: row.length_sec, step: s.step, error: userMessage(s),
    createdAt: row.created_at, finalUrl: s.finalUrl ?? row.final_url ?? null,
    narration: s.narration ?? null, title: s.plan?.title ?? null, hasVoice: Boolean(s.voice),
    soundEffects: s.soundEffects !== false,
    wide: (s.wide ?? []).map((w: any) => ({ id: w.id, label: w.label, status: w.status, url: w.url ?? null, vision: w.vision ? { pass: w.vision.pass, fix: w.vision.fix } : null })),
    surprises: (s.plan?.surprises ?? []).map((x: any) => ({ beat: x.beat, kind: x.kind, text: x.text, number: x.number })),
    progress: progressOf(s),
    creditsCharged: row.credits_charged, creditsRefunded: row.credits_refunded,
  };
}

async function loadRun(userId: string, runId: string) {
  const { data, error } = await admin.from("cutaway_runs").select("*").eq("id", runId).eq("user_id", userId).single();
  if (error || !data) throw new ApiError("Run not found.", 404);
  return data;
}

const sumCosts = (s: any) => Number(Object.values(s.costs ?? {}).reduce((a: number, b: any) => a + (Number(b) || 0), 0).toFixed(5));

/** Saves a new state if nobody else wrote the row in between (version check). */
async function save(row: any, state: any, extra: Record<string, unknown> = {}) {
  const refund = refundPlan({ ...row, ...extra }, state);
  const { data, error } = await admin.from("cutaway_runs").update({
    state, step: state.step, version: row.version + 1, lease_until: null, cost_usd: sumCosts(state),
    final_url: state.finalUrl ?? null, updated_at: new Date().toISOString(), ...extra, ...refund.patch,
  }).eq("id", row.id).eq("version", row.version).select("*").maybeSingle();
  if (error) throw new Error(error.message);
  if (data && refund.credits > 0) {
    const { error: refundErr } = await admin.rpc("deduct_credits", { uid: row.user_id, amount: -refund.credits });
    if (refundErr) console.error("[cutaway-api] refund failed, needs a manual refund:", row.id, refund.credits, refundErr.message);
  }
  return data ?? (await admin.from("cutaway_runs").select("*").eq("id", row.id).single()).data;
}

/** One engine step under a lease, so two open tabs never run the same step twice. */
async function tick(row: any) {
  if (!["plan", "voice", "wide", "keyframes", "clips", "sound", "render"].includes(row.state?.step)) return row;
  const now = new Date();
  const { data: leased } = await admin.from("cutaway_runs")
    .update({ lease_until: new Date(now.getTime() + LEASE_SEC * 1000).toISOString() })
    .eq("id", row.id).eq("version", row.version)
    .or(`lease_until.is.null,lease_until.lt.${now.toISOString()}`)
    .select("*").maybeSingle();
  if (!leased) return row; // another call is working on it
  const next = await advance(leased.state, depsFor(leased));
  return save(leased, next);
}

/** The used-ideas log: topics and mechanisms of the user's earlier videos (newest 40). */
async function usedIdeas(userId: string) {
  const { data } = await admin.from("cutaway_runs").select("topic, state->plan->mechanisms").eq("user_id", userId).neq("step", "failed").order("created_at", { ascending: false }).limit(40);
  const topics = [...new Set((data ?? []).map((r: any) => String(r.topic)))];
  const mechanisms = [...new Set((data ?? []).flatMap((r: any) => (Array.isArray(r.mechanisms) ? r.mechanisms : [])).map((m: any) => String(m)))].slice(0, 80);
  return { topics, mechanisms };
}

// ---------- actions ----------

async function handle(req: Request) {
  const userId = await requireUser(req);
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "");

  if (action === "ideas") {
    const { topics } = await usedIdeas(userId);
    return { usedTopics: topics };
  }

  if (action === "start") {
    const topic = String(body?.topic ?? "").trim().replace(/\s+/g, " ");
    const lengthSec = Number(body?.lengthSec);
    const soundEffects = body?.soundEffects !== false;
    if (topic.length < 3 || topic.length > 120) throw new ApiError("Type a topic (3 to 120 characters).");
    if (!LENGTHS.includes(lengthSec)) throw new ApiError("Pick 30 or 60 seconds.");
    const { mechanisms } = await usedIdeas(userId);
    const credits = await price(PRICES.plan.toolKey(lengthSec));
    await charge(userId, credits);
    const { data: row, error } = await admin.from("cutaway_runs").insert({
      user_id: userId, topic, length_sec: lengthSec, step: "plan", state: newRun({ topic, lengthSec, soundEffects, usedIdeas: mechanisms }),
      credits_charged: credits, charges: [{ stage: "plan", credits, at: new Date().toISOString() }],
    }).select("*").single();
    if (error || !row) {
      await admin.rpc("deduct_credits", { uid: userId, amount: -credits });
      throw new ApiError("Couldn't start. Your credits were returned.", 500);
    }
    // Start planning now; the page keeps calling "advance".
    background(tick(row).catch((e) => console.error("[cutaway-api] first tick:", e?.message ?? e)));
    return view(row);
  }

  const row = await loadRun(userId, String(body?.runId ?? ""));

  if (action === "advance") return view(await tick(row));

  if (action === "regenerate") {
    const index = Number(body?.index);
    if (row.state?.step !== "approval" || !Number.isInteger(index) || !row.state.wide?.[index]) throw new ApiError("This image can't be regenerated now.", 409);
    const count = row.state.wide.length - index;
    const credits = (await price(PRICES.regenerate.toolKey())) * count;
    await charge(userId, credits);
    const charges = [...(row.charges ?? []), { stage: "regenerate", credits, index, at: new Date().toISOString() }];
    return view(await save(row, regenerateWide(row.state, index), { charges, credits_charged: row.credits_charged + credits }));
  }

  if (action === "approve") {
    if (row.state?.step !== "approval") throw new ApiError("The images aren't ready for approval.", 409);
    const credits = await price(PRICES.video.toolKey(), { durationSec: row.length_sec });
    await charge(userId, credits);
    const charges = [...(row.charges ?? []), { stage: "video", credits, at: new Date().toISOString() }];
    const saved = await save(row, approve(row.state), { charges, credits_charged: row.credits_charged + credits });
    background(tick(saved).catch((e) => console.error("[cutaway-api] approve tick:", e?.message ?? e)));
    return view(saved);
  }

  throw new ApiError("Unknown action.");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  try {
    return ok(req, await handle(req));
  } catch (e) {
    if (e instanceof ApiError) return err(req, e.message, e.status);
    console.error("[cutaway-api]", e instanceof Error ? e.message : e);
    return err(req, "Something went wrong. Please try again.", 500);
  }
});
