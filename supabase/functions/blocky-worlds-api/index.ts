// deno-lint-ignore-file no-explicit-any
// blocky-worlds-api: the Blocky Worlds template's server entry point for the page. The actions and reply shapes are in
// _shared/blockyWorlds/contract.js. The flow: idea -> script -> settings -> generate -> result.
//
// Switches (function secrets):
//   BLOCKY_WORLDS_ACCESS=owner|allowlist|everyone   who may see and use the template at all (_shared/blockyWorlds/gate.js).
//                                    Default (unset or unknown) owner: only the Blocky owner list (gate.js; secret
//                                    BLOCKY_WORLDS_OWNER_EMAILS may override it; ADMIN_EMAILS opens nothing here); allowlist adds
//                                    BLOCKY_WORLDS_TEST_USERS; everyone is launch. Until everyone, the owner's and
//                                    testers' runs are env "test". Everyone else gets OFF on every action and a bare
//                                    { visible: false } from `access`. (BLOCKY_WORLDS_ENABLED is retired: it opens nothing.)
//   BLOCKY_WORLDS_LLM=mock           ideas and scripts from examples.js: no Anthropic call, no cost (the free flow test)
//   BLOCKY_WORLDS_PAID_CALLS=off     a hard off switch for every paid call
//   BLOCKY_WORLDS_HYBRID=off         a typed topic's script back on the old beats -> script path (default: the hybrid
//                                    writer, Opus 5.5 plans + Sonnet 5.5 writes the lines, _shared/blockyWorlds/hybridApp.js)
//   BLOCKY_WORLDS_CACHE_TTL=1h|off   the hybrid writer's prompt cache (default 5m)
//   BLOCKY_WORLDS_RENDERER=runpod    video making on (docs/blocky-worlds-pipeline.md), and only when RunPod and the
//                                    callback secret are configured too (renderSupabase.ts); otherwise start refuses
//                                    BEFORE anything is charged. A tester's dryRun still runs every check and the price
//   BLOCKY_WORLDS_ENGINE=studio      (2026-11-13) new videos are made by the Studio worker (_shared/blockyWorlds/studio.js,
//                                    scripts/blockyWorlds/studioWorker/): Sonnet director + 1 fix round. The kit checks
//                                    always run before the charge; start refuses (nothing charged) without a live worker.
//                                    Unset / anything else: the RunPod pipeline above. docs/blocky-worlds-launch.md
// The protocol (docs/blocky-worlds-protocol.md): "Pick an idea" serves unseen ideas from the judged library first; every
// source becomes a complete idea card; then card -> beat sheet -> script, each step checked and retried on its own.
// Learning: picked / rewritten / generated / downloaded / thumbs are counted per library idea (event action).
// The price comes from the length here and the script is re-checked here: nothing the page sends about either is
// trusted. Credits are charged once, at start, in the same transaction that creates the run (blocky_worlds_start_run).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cors, err, ok } from "../shared/cors.ts";
import { adminEmailList } from "../_shared/contentMachine/adminGuard.js";
import { ERRORS, FAILED_MESSAGE, failReason } from "../_shared/blockyWorlds/contract.js";
import { DEFAULT_LENGTH, LENGTHS, NARRATOR } from "../_shared/blockyWorlds/config.js";
import { canGenerate, canRemoveEndCard, canWrite, endCardFor } from "../_shared/blockyWorlds/access.js";
import { accessModeFrom, blockyOwners, closedReply, guestAllowed, viewerAccess } from "../_shared/blockyWorlds/gate.js";
import { costBasisUsd, PRICES, toolKey } from "../_shared/blockyWorlds/pricing.js";
import { BLENDER_FLAT } from "../_shared/blockyWorlds/blenderPricing.js";
import { studioFullCostUsd } from "../_shared/blockyWorlds/studio.js";
import { KIT_PREFER, studioBuilds, studioIdeaOk } from "../_shared/blockyWorlds/studioBuilds.js";
import { DEFAULT_SETTINGS, decide, MAX_FREE_RETRIES, RETRIES_USED_UP, SPEND_ALERT_USD, WRITING } from "../_shared/blockyWorlds/guard.js";
import { alertOnce } from "../_shared/adminAlert.ts";
import { MOODS } from "../_shared/blockyWorlds/formulas.js";
import { cardOf, DAILY_IDEA_BATCHES, FREE_IDEA_BATCHES, IDEAS_PER_BATCH } from "../_shared/blockyWorlds/ideas.js";
import { checkScript, narrationOf, normalizeScript, PART_IDS, scriptFromText } from "../_shared/blockyWorlds/script.js";
import { storyTextProblem, topicProblem } from "../_shared/blockyWorlds/safety.js";
import { isShownNote, noteSpots, paidGate } from "../_shared/blockyWorlds/paidGate.js";
import { cardFromScript, CACHE_TTLS, draftCheck, fixLines, fixPart, HYBRID, moneyMeter, providerFrom, repairOpener, rewriteHybrid, writeBeats, writeHybrid, writeIdeaPool, writeIdeas, writeScript, writeTopicIdeas } from "../_shared/blockyWorlds/llm.js";
import { ideaKey } from "../_shared/blockyWorlds/ideaEngine.js";
import { pickRecipe, RECIPES } from "../_shared/blockyWorlds/recipes.js";
import { examplesByIds, examplesFor } from "../_shared/blockyWorlds/referenceTexts.js";
import { APP_HYBRID, callLogLines, hybridCard, hybridChecksRow, hybridBeats, runCard, stripForLibrary } from "../_shared/blockyWorlds/hybridApp.js";
import { openerKey, pickForUser } from "../_shared/blockyWorlds/library.js";
import { cardProblems, problemSpots } from "../_shared/blockyWorlds/protocol.js";
import { queueInfo, renderConfigured, renderRuntime } from "../_shared/blockyWorlds/renderSupabase.ts";
import { canFilm, canFilmLine, fittingWithSwap, launchModeFrom, moveNote } from "../_shared/blockyWorlds/boardFit.js";
import { boardOnlyBlocked, productionSettings, stageOf } from "../_shared/blockyWorlds/render.js";
import { autoScenePlan, cleanScenePlan, PICKER } from "../_shared/blockyWorlds/scenePlan.js";
import { adaptLength, adaptStory, checkStoryText } from "../_shared/blockyWorlds/adapt.js";
import { characterSpec, charactersNote, checkUpload, cleanCharacters, readCharacter, ROLES, roleOf } from "../_shared/blockyWorlds/characterRef.js";
import { engineFrom, readyEmailOn, STUDIO, studioEtaText, studioStageOf } from "../_shared/blockyWorlds/studio.js";
import { studioQueueInfo, studioWorkerAlive } from "../_shared/blockyWorlds/studioSupabase.ts";
import { progressView } from "../_shared/blockyWorlds/studioStages.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const flag = (k: string) => (Deno.env.get(k) ?? "").trim().toLowerCase();
// THE switch (gate.js): owner (default, fail-closed) | allowlist | everyone
const ACCESS = accessModeFrom(Deno.env.get("BLOCKY_WORLDS_ACCESS"));
const OPEN = ACCESS === "everyone";
const TESTERS = adminEmailList(Deno.env.get("BLOCKY_WORLDS_TEST_USERS"));
const OWNERS = blockyOwners(Deno.env.get("BLOCKY_WORLDS_OWNER_EMAILS"));
const PAID_OFF = flag("BLOCKY_WORLDS_PAID_CALLS") === "off";
// BLOCKY_WORLDS_PREPAY=on (after migration 20261216200000): the Blender page charges its flat price at "Write my script"
const PREPAY = flag("BLOCKY_WORLDS_PREPAY") === "on";
const PROVIDER = providerFrom(Deno.env.get("BLOCKY_WORLDS_LLM"));
// the hybrid writer for typed topics (default on; the mock provider keeps the free old path)
const HYBRID_ON = flag("BLOCKY_WORLDS_HYBRID") !== "off" && PROVIDER === "anthropic";
const CACHE_TTL: string = (CACHE_TTLS as readonly string[]).includes(flag("BLOCKY_WORLDS_CACHE_TTL")) ? flag("BLOCKY_WORLDS_CACHE_TTL") : HYBRID.cacheTtl;
const envGet = (k: string) => Deno.env.get(k) ?? "";
// THE ENGINE (2026-11-13, _shared/blockyWorlds/studio.js): BLOCKY_WORLDS_ENGINE=studio -> new videos are directed by the
// Studio worker (Sonnet director + 1 fix round, scripts/blockyWorlds/studioWorker/); anything else: the RunPod pipeline.
// A run records its engine at the charge (blocky_worlds_start_run p_engine), so a switch never moves a running video.
const ENGINE = engineFrom(envGet);
const STUDIO_ON = ENGINE === "studio";
// THE IDEA ENGINE (ideaEngine.js, owner 2026-11-14): Opus writes a pool of ~40 ideas, a judge keeps the best 10 (the best 1 for "AI can decide"),
// near-duplicates of the library, the examples and the log of ideas already given out (db blocky_worlds_idea_log) are rejected. On by default
// with the Studio engine, BLOCKY_WORLDS_IDEA_ENGINE=on|off overrides.
const IDEA_ENGINE = (flag("BLOCKY_WORLDS_IDEA_ENGINE") === "on" || (STUDIO_ON && flag("BLOCKY_WORLDS_IDEA_ENGINE") !== "off")) && PROVIDER === "anthropic";
// BLOCKY_WORLDS_READY_EMAIL=on: the sweeper emails "your video is ready" (studioSupabase.ts); the page says so
const READY_EMAIL = readyEmailOn(envGet);
// on only when it says runpod AND everything a run needs is configured: a half-configured renderer never charges anyone.
// Studio: the switch is enough here; start also needs a live worker (studioWorkerAlive), checked before the charge.
const RENDERER = STUDIO_ON ? "studio" : (Deno.env.get("BLOCKY_WORLDS_RENDERER") ?? "").trim() === "runpod" && renderConfigured() ? "runpod" : "";
const BUCKET = "blocky-worlds-renders";
// BOARD-ONLY LAUNCH MODE (owner, 2026-11-12; _shared/blockyWorlds/boardFit.js): BLOCKY_WORLDS_LAUNCH=board shows only
// library ideas the board kit can film, gives the writers the kit as hard rules and checks every script against the kit
// before the charge; BLOCKY_WORLDS_BOARD_ONLY=on adds the strict render (no old-planner lines: a miss is refunded) and
// implies launch mode. Both off by default; a secret change switches them (no code deploy).
const LAUNCH_BOARD = launchModeFrom(envGet) && !STUDIO_ON;
// THE KIT for every writer and check (owner, 2026-11-13, studioBuilds.js): the Studio engine never refuses a story for
// "not in the kit": the kit is a PREFERENCE ("prefer"), unknown things go on the run's Studio builds list, and only a
// brand, a famous name, unsafe words or a story with nothing to show blocks (with Fix it). Otherwise the board mode
// (true: hard kit rules + checks) or nothing, as before.
const KIT: boolean | "prefer" = STUDIO_ON ? KIT_PREFER : LAUNCH_BOARD;
/** the library rows the picker may show: in launch mode only those the board kit can film (computed at read time) */
const LIBRARY_LIMIT = LAUNCH_BOARD ? 200 : 60;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

class ApiError extends Error {
  /** `detail`: what really happened, for the logs and the owner's Details (never shown to a customer) */
  constructor(public code: keyof typeof ERRORS, message?: string, public extra: Record<string, unknown> = {}, public detail?: string) { super(message ?? ERRORS[code].message); }
}
type Trace = { action: string; step: string; owner: boolean };

// ---------- who is asking ----------
async function whoIs(req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token || token === SUPABASE_ANON_KEY) return null;
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return null;
  const user = data.user;
  const { data: profile } = await admin.from("profiles").select("plan_code").eq("id", user.id).single();
  const plan = String(profile?.plan_code ?? "free").toLowerCase();
  // the owner always tests like a tester (BLOCKY_WORLDS_TEST_USERS may be empty): sees the template, dryRun, runs env
  // "test"; testers count only while the switch is allowlist or everyone
  const { owner, tester, allowed } = viewerAccess({ mode: ACCESS, user, owners: OWNERS, testers: TESTERS });
  return { user, plan, tester, owner, allowed };
}
/** signed in, and the template is open to them (BLOCKY_WORLDS_ACCESS): refused before anything is read or charged */
async function requireUser(req: Request, trace: Trace) {
  const who = await whoIs(req);
  if (!who) throw new ApiError("SIGN_IN");
  trace.owner = who.owner;
  if (!who.allowed) throw new ApiError("OFF");
  return who;
}
/** may write scripts (and generate): a paid plan, the same rule for testers; the owner always (their test runs) */
const writerOk = (who: { plan: string; owner: boolean }) => who.owner || canWrite(who.plan);
async function requireWriter(req: Request, trace: Trace) {
  const who = await requireUser(req, trace);
  if (!writerOk(who)) throw new ApiError("UPGRADE");
  return who;
}

// ---------- the caps (fail closed) ----------
async function guardFor(userId: string, addUsd: number, kind: "video" | "writing") {
  const [{ data: settings }, { data: counts, error }] = await Promise.all([
    admin.from("blocky_worlds_settings").select("*").eq("id", 1).maybeSingle(),
    admin.rpc("blocky_worlds_guard", { p_user: userId }),
  ]);
  // owner 2026-11-18: at most ~6 videos a day per user (Try agains included)
  let c: any = error ? null : counts;
  if (c && kind === "video") {
    const { count } = await admin.from("blocky_worlds_runs").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", new Date(Date.now() - 86_400_000).toISOString());
    c = { ...c, user_starts_24h: count ?? 0 };
  }
  const g = decide(settings ?? DEFAULT_SETTINGS, c, addUsd, { envOff: PAID_OFF && PROVIDER !== "mock", kind });
  if (!g.ok) throw new ApiError(g.code as any, g.code === "LIMIT" ? g.reason ?? undefined : g.message ?? undefined, { retryAfterSec: g.retryAfterSec }, `${g.reason}${error ? `: ${error.message}` : ""}`);
  return { settings, counts: counts ?? {} };
}
/** owner 2026-11-18: one email a day when the real In This Town spend of the last 24 h passes SPEND_ALERT_USD ($25);
 *  the automatic pause for new videos comes at blocky_worlds_settings.daily_cap_usd ($50). Never throws. */
async function spendAlert(counts: any, settings: any) {
  try {
    const spent = Number(counts?.spent_24h ?? 0), cap = Number(settings?.daily_cap_usd ?? DEFAULT_SETTINGS.daily_cap_usd);
    if (spent < SPEND_ALERT_USD) return;
    await alertOnce(admin, "in-this-town-spend-25", 86_400, `In This Town: $${spent.toFixed(2)} spent in the last 24 h`,
      `The real In This Town cost (GPU, AI, voice) of the last 24 hours is $${spent.toFixed(2)}, over the $${SPEND_ALERT_USD} alert line. New videos pause automatically at $${cap}. To pause everything now: set paid_calls = false in public.blocky_worlds_settings. To lift the automatic pause: raise daily_cap_usd there.`);
  } catch (e) { console.error("[blocky-worlds-api] spend alert:", (e as any)?.message ?? e); }
}
/** the free Try agains a paid script has used (owner 2026-11-18: MAX_FREE_RETRIES) */
async function retriesUsed(draftId: string | null) {
  if (!draftId) return 0;
  const { count } = await admin.from("blocky_worlds_runs").select("id", { count: "exact", head: true }).eq("draft_id", draftId).not("resume_of", "is", null);
  return count ?? 0;
}
const ideaBatchesFor = (plan: string) => (canWrite(plan) ? DAILY_IDEA_BATCHES : FREE_IDEA_BATCHES);
async function logCall(userId: string, purpose: "ideas" | "script", usd: number, okCall = true) {
  await admin.from("blocky_worlds_ai_calls").insert({ user_id: userId, purpose, provider: PROVIDER, usd: Number(usd) || 0, ok: okCall });
}
/** a writer failure as the page sees it: never charged; the cost (if any) is logged */
function writerError(e: any) {
  if (e instanceof ApiError) return e;
  if (e?.balance) return new ApiError("BUSY", "Blocky Worlds is paused on our side for a few minutes.", { retryAfterSec: 600 }, `Anthropic balance: ${e?.message}`);
  return new ApiError("WRITER", undefined, {}, e?.message ?? String(e));
}

// ---------- views ----------
function draftView(d: any) {
  // owner 2026-11-17 (paidGate.js): only REAL blockers are problems; every style rule is a note with "Fix this line"
  const check = paidGate(d.checks ?? {});
  return {
    id: d.id, source: d.source, ideaId: d.idea_id, title: d.title, lengthSec: d.length_sec, lines: d.lines ?? [], post: d.post ?? {},
    credits: PRICES[d.length_sec] ?? null,
    check: { problems: check.problems ?? [], warnings: check.shown ?? [], words: check.words ?? 0, seconds: check.seconds ?? 0, spots: problemSpots({ lines: d.lines ?? [] }, check.problems ?? []) },
    notes: noteSpots(check, d.lines ?? []),
    ready: !(check.problems ?? []).length, updatedAt: d.updated_at,
    // Studio: the things the kit does not have, which the director builds (never a block)
    ...(STUDIO_ON ? { studioBuilds: studioBuilds({ lines: d.lines ?? [] }, d.card ?? null) } : {}),
    // the hybrid writer's judge: a score and notes as feedback only (never a block)
    feedback: check.feedback ? { score: check.feedback.score ?? null, notes: check.feedback.notes ?? [] } : null,
  };
}
async function signed(path: string | undefined, download?: string) {
  if (!path) return null;
  const { data } = await admin.storage.from(BUCKET).createSignedUrl(path, 3600, download ? { download } : undefined);
  return data?.signedUrl ?? null;
}
/** "Try again" continues for free only once migration 20261218100000 is applied (its columns exist); checked once */
let retryOk = false, retryAskedAt = 0;
const retryOn = async () => {
  if (retryOk) return true;
  if (Date.now() - retryAskedAt < 60_000) return false; // not yet: asked again at most once a minute
  retryAskedAt = Date.now();
  const { error } = await admin.from("blocky_worlds_runs").select("charge_on_done").limit(1);
  retryOk = !error;
  return retryOk;
};
async function runView(r: any, { owner = false, queue = null }: { owner?: boolean; queue?: any } = {}) {
  const canRetry = r.status === "failed" && r.engine === "studio" && (await retryOn()) && (await retriesUsed(r.draft_id ?? null)) < MAX_FREE_RETRIES;
  const done = r.status === "done", files = r.files ?? {}, working = !["done", "failed"].includes(r.status);
  return {
    id: r.id, draftId: r.draft_id, title: r.title, lengthSec: r.length_sec, credits: r.credits_charged, createdAt: r.created_at, doneAt: r.finished_at,
    status: r.status, stepAt: Date.parse(r.stage_at ?? r.created_at), pct: r.pct ?? 0, post: done ? r.post : null,
    // the progress screen's stage (render.js STAGES: queued, voice, storyboard, plan, prompts, checks, stills, mix, render,
    // finish; a Studio run: studio.js STUDIO_STAGES: queued, voice, plan, directing, previews, checking, fixing, rendering,
    // finishing) and the engine that makes it (the page picks the stage list by it)
    engine: r.engine === "studio" ? "studio" : "pipeline",
    stage: r.engine === "studio" ? studioStageOf(r) : stageOf(r.status, r.pct ?? 0),
    ...(r.engine === "studio" && working ? { etaText: studioEtaText(r.length_sec), emailWhenReady: READY_EMAIL } : {}),
    // LIVE PROGRESS (the Blender pipeline, blenderKit/progress.mjs; the worker keeps it in the run's render jsonb): the
    // stage, the percent, the ceiling the page may creep to, what is happening, and when it was written
    ...(r.engine === "studio" && working && r.render?.progress ? { progress: progressView(r.render.progress) } : {}),
    claimedAt: r.claimed_at ?? null,
    // the shared line (renderQueue.js): place in line + seconds until it starts while waiting, seconds until ready;
    // etaAt = when they were computed (the page counts down between polls)
    queuePosition: working ? queue?.queuePosition ?? null : null, etaSec: working ? queue?.etaSec ?? null : null,
    doneEtaSec: working ? queue?.doneEtaSec ?? null : null, etaAt: working && queue ? Date.now() : null,
    // the light 720p copy plays on the page; the download is the full 1080p file
    finalUrl: done ? await signed(files.web ?? files.final) : null, downloadUrl: done ? await signed(files.final, `${(r.title || "blocky-world").replace(/[^\w -]/g, "").slice(0, 60)}.mp4`) : null,
    poster: done ? await signed(files.poster) : null,
    error: r.status === "failed" ? FAILED_MESSAGE : null, refunded: Boolean(r.refunded_at),
    // "Try again" (owner 2026-11-18): a failed Studio video continues from its saved parts and is charged only when it is
    // ready; a retry run shows that it is not charged yet (chargeOnDone credits are taken when it is done)
    canRetry, chargeOnDone: working ? Number(r.charge_on_done ?? 0) : 0, resumeOf: r.resume_of ?? null,
    ...(r.status === "failed" ? (({ kind, text }) => ({ reason: text, failKind: kind }))(failReason(r.error_code, r.error_message)) : {}),
    ...(owner && r.status === "failed" ? { debug: { code: r.error_code, message: r.error_message } } : {}),
  };
}

/** Count one learning event (the row, and the library idea's stat). Returns false when it was already counted. */
async function countEvent(userId: string, libraryId: string | null, kind: string, { draftId = null, runId = null }: { draftId?: string | null; runId?: string | null } = {}) {
  const { error } = await admin.from("blocky_worlds_events").insert({ user_id: userId, library_id: libraryId, draft_id: draftId, run_id: runId, kind });
  if (error) { if (!/duplicate key/i.test(error.message)) console.error("[blocky-worlds-api] event:", error.message); return false; }
  if (libraryId) await admin.rpc("blocky_worlds_bump", { p_library: libraryId, p_kind: kind });
  return true;
}

/** The kind of checks a draft gets: ours keep their parts (the hybrid writer's its hard/advisory split); anything the user saved is checked as their own. */
const kindOf = (d: any) => (d.checks?.kind === "written" ? "written" : d.checks?.kind === "hybrid" ? "hybrid" : "own");
/** The same checks the script was written against: ours get the protocol's too (the object pays off, the callback). */
function recheck(d: any, lengthSec = d.length_sec) {
  const script = { title: d.title, lines: d.lines ?? [], post: d.post ?? {} };
  // the mock writer's sample script doesn't follow the card, so mock mode checks it without the card (like writeScript)
  // launch mode: what the board kit can't film blocks here too (boardFit.js on kitCheck.js): quote and start run this
  // BEFORE the charge, so a story the board can't film never reaches the paid render
  return paidGate({ ...draftCheck(script, lengthSec, kindOf(d), PROVIDER === "mock" ? null : d.card ?? null, { board: KIT }), kind: kindOf(d) });
}
/** everything a rewrite should hear about: the blockers and the style notes */
const failedOf = (c: any) => [...(c.problems ?? []), ...(c.notes ?? [])];
/** Launch mode: what the planner moved from the user's idea to fit the kit, in one line (null when nothing moved). */
const movedNotice = (card: any) => (card?.moved ? `We moved your story into our town: ${String(card.moved).slice(0, 200)}` : null);
/** "The rewrite still has a problem" in plain words (never a silent failing rewrite). */
const stillFailing = (problems: string[]) => (problems.length ? `It still needs one fix: ${problems[0]}${problems.length > 1 ? ` (and ${problems.length - 1} more)` : ""}` : null);
async function loadDraft(userId: string, draftId: unknown) {
  if (!/^[0-9a-f-]{36}$/i.test(String(draftId ?? ""))) throw new ApiError("BAD_INPUT");
  const { data } = await admin.from("blocky_worlds_drafts").select("*").eq("id", draftId).eq("user_id", userId).is("deleted_at", null).maybeSingle();
  if (!data) throw new ApiError("NOT_FOUND", "We couldn't find that script.");
  return withTopic(data);
}
/**
 * A draft from a typed topic carries the user's own words on its card (card.topic: the script's core, and the topic
 * check). Cards written before 2026-11-06 get them from their idea row.
 */
async function withTopic(d: any) {
  if (d?.source !== "topic" || !d.card || d.card.topic || !d.idea_id) return d;
  const { data: idea } = await admin.from("blocky_worlds_ideas").select("topic").eq("id", d.idea_id).maybeSingle();
  return idea?.topic ? { ...d, card: { ...d.card, topic: idea.topic } } : d;
}
const lengthOf = (v: unknown, fallback = DEFAULT_LENGTH) => {
  const n = v == null ? fallback : Number(v);
  if (!LENGTHS.includes(n)) throw new ApiError("BAD_INPUT", `Pick a length from ${LENGTHS[0]} to ${LENGTHS.at(-1)} seconds, in 10 s steps.`);
  return n;
};
const moodOf = (v: unknown) => (typeof v === "string" && (MOODS as any)[v] ? v : null);
async function scriptsLeft(userId: string, counts?: any) {
  const used = counts?.user_scripts_today ?? (await admin.rpc("blocky_worlds_guard", { p_user: userId })).data?.user_scripts_today ?? 0;
  return Math.max(0, WRITING.dailyScripts - Number(used));
}

// ---------- THE BLENDER PAGE'S ONE PRICE (owner 2026-11-15; blenderPricing.js BLENDER_FLAT, migration 20261216200000) ----------
// "Write my script" from the Blender page (body.flat) writes at most BLENDER_FLAT.writeSec (the video stays at ~90 s) and,
// with BLOCKY_WORLDS_PREPAY=on, CHARGES the flat price first (blocky_worlds_prepay): a writer failure gives it all back
// at once; "Make my video" then consumes the prepay instead of charging (start below); a failed video gives the whole
// price back (blocky_worlds_refund); no video within 7 days: all but 25 credits back (blocky_worlds_prepay_expire).
const blenderAvailable = (who: { owner: boolean } | null) => OPEN || Boolean(who?.owner);
const prepayOn = (who: any) => PREPAY && blenderAvailable(who);
// NEW PURCHASES PAUSED (owner 2026-11-18, until one live video succeeds end to end): "Write my script" (the purchase)
// is refused for everyone but the owner until the function secret BLOCKY_WORLDS_PURCHASES=on. Scripts already paid,
// their "Make my video", Try again and refunds are untouched.
const PURCHASES_OPEN = flag("BLOCKY_WORLDS_PURCHASES") === "on";
const PURCHASES_PAUSED_MESSAGE = "In This Town is getting an upgrade, back very soon.";
async function flatWrite(req: Request, body: any, trace: Trace) {
  const who = await requireWriter(req, trace);
  if (!PURCHASES_OPEN && !who.owner) throw new ApiError("BUSY", PURCHASES_PAUSED_MESSAGE, { retryAfterSec: 3600 }, "new purchases paused (BLOCKY_WORLDS_PURCHASES is not on)");
  const inner = { ...body, flat: false, lengthSec: Math.min(Number(body?.lengthSec ?? BLENDER_FLAT.writeSec) || BLENDER_FLAT.writeSec, BLENDER_FLAT.writeSec) };
  if (!prepayOn(who)) return { ...(await route(req, inner, trace)), flat: { credits: BLENDER_FLAT.credits, charge: "start" } };
  trace.step = "prepay";
  const { data: pre, error } = await admin.rpc("blocky_worlds_prepay", { p_user: who.user.id, p_credits: BLENDER_FLAT.credits, p_keep: BLENDER_FLAT.keepCredits, p_days: BLENDER_FLAT.expireDays });
  if (error || !pre) {
    if (/INSUFFICIENT_CREDITS/.test(error?.message ?? "")) throw new ApiError("CREDITS", `You need ${BLENDER_FLAT.credits} credits for this video.`, { credits: BLENDER_FLAT.credits });
    throw new ApiError("SERVER", "Couldn't take the payment. Nothing was charged.", {}, error?.message ?? "no prepay row");
  }
  let out: any;
  try { out = await route(req, inner, trace); }
  catch (e) {
    // the writer failed: the whole price back, once (a second call returns 0)
    await admin.rpc("blocky_worlds_prepay_refund", { p_prepay: pre.id, p_keep: 0, p_why: "writer_failed" }).then(({ error: rErr }: any) => { if (rErr) console.error("[blocky-worlds-api] prepay refund FAILED, refund by hand:", pre.id, rErr.message); });
    throw e;
  }
  await admin.from("blocky_worlds_prepays").update({ draft_id: out.id }).eq("id", pre.id);
  return { ...out, flat: { credits: BLENDER_FLAT.credits, charge: "script", paidAt: pre.created_at, expiresAt: pre.expires_at, keepCredits: BLENDER_FLAT.keepCredits } };
}
/** the draft's open (paid, unused, not refunded) prepay, or null */
async function openPrepay(userId: string, draftId: string) {
  const { data } = await admin.from("blocky_worlds_prepays").select("id, credits").eq("user_id", userId).eq("draft_id", draftId).is("run_id", null).is("refunded_at", null).maybeSingle();
  return data ?? null;
}

/** "Fix this line" calls one draft may use (free; a runaway loop can't spend without end) */
const FIX_LINES_PER_DRAFT = 40;
/** the draft's paid state for the page (owner 2026-11-17: once paid at "Write my script", later steps say "Paid ✓", never the price) */
async function paidOf(userId: string, draftId: string) {
  const { data } = await admin.from("blocky_worlds_prepays").select("credits, created_at, expires_at").eq("user_id", userId).eq("draft_id", draftId).is("run_id", null).is("refunded_at", null).maybeSingle();
  return data ? { flat: { credits: data.credits, charge: "script", paidAt: data.created_at, expiresAt: data.expires_at, keepCredits: BLENDER_FLAT.keepCredits } } : {};
}
/** a draft as the page sees it, with its paid state */
async function viewFor(userId: string, d: any) {
  return { ...draftView(d), ...(await paidOf(userId, d.id)) };
}

/**
 * Before a fresh script is shown (owner 2026-11-17): a STYLE rule the writer's own fix left open (the notes that used
 * to block: the town line, the button, the length band ...) is fixed line by line (fixLines, at most 2 notes, ~1-2
 * small calls), kept only when better. Never throws: a failure just leaves the note for the user's "Fix this line".
 */
async function autoFixStyle(userId: string, d: any) {
  try {
    let cur = d, checks = recheck(d);
    for (const note of (checks.notes ?? []).filter(isShownNote).slice(0, 2)) {
      const lines = noteSpots(checks, cur.lines ?? []).find((n) => n.text === note)?.lines ?? [];
      if (!lines.length) continue;
      const fix: any = await fixLines({ apiKey: ANTHROPIC_KEY, provider: PROVIDER, script: { title: cur.title, lines: cur.lines, post: cur.post }, indexes: lines, note, card: PROVIDER === "mock" ? null : cur.card ?? null, lengthSec: cur.length_sec, kind: kindOf(cur), board: KIT, gate: paidGate });
      if (fix.costUsd) await logCall(userId, "script", fix.costUsd);
      if (!fix.ok) continue;
      cur = { ...cur, lines: fix.script.lines };
      checks = recheck(cur);
    }
    if (cur === d) return d;
    const { data, error } = await admin.from("blocky_worlds_drafts").update({ lines: cur.lines, checks: { ...(d.checks ?? {}), ...checks, autoFixed: true }, updated_at: new Date().toISOString() }).eq("id", d.id).select("*").single();
    return error || !data ? d : data;
  } catch (e: any) {
    console.error("[blocky-worlds-api] autoFixStyle:", d?.id, e?.message ?? e);
    return d;
  }
}

async function handle(req: Request, trace: Trace) {
  const body = await req.json().catch(() => ({}));
  trace.action = String(body?.action ?? "");
  if ((trace.action === "writeScript" || trace.action === "adaptStory") && body?.flat === true) return await flatWrite(req, body, trace);
  return await route(req, body, trace);
}

async function route(req: Request, body: any, trace: Trace) {
  const action = String(body?.action ?? "");
  trace.action = action;

  if (action === "access") {
    const who = await whoIs(req);
    // the owner (the Blocky owner list) always sees it; anyone else only as BLOCKY_WORLDS_ACCESS allows. Closed = a bare reply.
    const visible = who ? who.allowed : guestAllowed(ACCESS);
    if (!visible) return closedReply(Boolean(who));
    let ideaBatchesLeft = null;
    if (who && visible) {
      const { data } = await admin.rpc("blocky_worlds_guard", { p_user: who.user.id });
      ideaBatchesLeft = Math.max(0, ideaBatchesFor(who.plan) - Number(data?.user_ideas_today ?? 0));
    }
    return {
      enabled: OPEN, signedIn: Boolean(who), plan: who?.plan ?? null, owner: Boolean(who?.owner), tester: Boolean(who?.tester),
      visible, canWrite: Boolean(who && visible && writerOk(who)), canGenerate: Boolean(who && visible && (who.owner || canGenerate(who.plan)) && RENDERER),
      canRemoveWatermark: Boolean(who && canRemoveEndCard(who.plan)), mock: PROVIDER === "mock", renderer: Boolean(RENDERER),
      // the engine (studio.js): "studio" shows the Beta label and the Studio progress screen
      engine: ENGINE, beta: STUDIO_ON,
      lengths: LENGTHS, defaultLength: DEFAULT_LENGTH, prices: PRICES, narrator: { name: NARRATOR.voiceName },
      moods: Object.entries(MOODS).map(([id, m]: any) => ({ id, label: m.label })), ideaBatchesLeft,
      // launch mode: the page shows "What we can film" (generated from the kit list) and "Move it to our town"
      launch: LAUNCH_BOARD ? "board" : "off", film: LAUNCH_BOARD ? canFilm() : null,
      // the SCENE PLAN (owner-only, the Blender kit engine): after the script, each scene's location from the library
      scenePlan: blenderAvailable(who),
      // THE BLENDER UI (owner-only first, 2026-11-15): topic + "explain more" + character references, no length picker
      blenderUi: blenderAvailable(who), roles: blenderAvailable(who) ? ROLES : null,
      // the Blender page's ONE price (BLENDER_FLAT): when it is charged ("script": at Write my script; "start": at Make my video)
      flat: blenderAvailable(who) ? { paused: !PURCHASES_OPEN && !who?.owner ? PURCHASES_PAUSED_MESSAGE : null, credits: BLENDER_FLAT.credits, charge: prepayOn(who) ? "script" : "start", keepCredits: BLENDER_FLAT.keepCredits, expireDays: BLENDER_FLAT.expireDays, maxSec: BLENDER_FLAT.priceRowSec } : null,
    };
  }

  // ---------- 1. ideas (free, a daily limit) ----------
  if (action === "ideas" || action === "topicIdeas") {
    trace.step = "sign-in";
    const who = await requireUser(req, trace);
    const topic = action === "topicIdeas" ? String(body?.topic ?? "").trim().replace(/\s+/g, " ") : null;
    if (topic != null) { const bad = topicProblem(topic); if (bad) throw new ApiError("BAD_INPUT", bad); }
    if (topic == null) {
      // the judged library: only ideas this user hasn't seen, mixed across formulas and moods; no call, no daily limit
      trace.step = "library";
      const mood = moodOf(body?.mood);
      // launch mode: more candidates (the filter drops most of them), then only the ones the board kit can film; the
      // hidden rows keep their stats and come back when the filter is lifted (nothing stored, nothing retired)
      const { data: cands, error: cErr } = await admin.rpc("blocky_worlds_library_candidates", { p_user: who.user.id, p_mood: mood, p_limit: LIBRARY_LIMIT });
      if (cErr) console.error("[blocky-worlds-api] library:", cErr.message);
      // Studio: never hidden for a kit miss, only for its blocks (a brand, a famous name, unsafe words)
      const chosen = pickForUser(STUDIO_ON ? (cands ?? []).filter((c: any) => studioIdeaOk(c.idea)) : LAUNCH_BOARD ? fittingWithSwap(cands ?? []) : cands ?? [], IDEAS_PER_BATCH, mood);
      if (chosen.length >= IDEAS_PER_BATCH) {
        const { data: rows, error } = await admin.from("blocky_worlds_ideas").insert(chosen.map((c: any) => ({ user_id: who.user.id, source: "library", library_id: c.id, idea: c.idea }))).select("id, idea");
        if (error) throw new ApiError("SERVER", undefined, {}, error.message);
        await admin.rpc("blocky_worlds_mark_seen", { p_user: who.user.id, p_ids: chosen.map((c: any) => c.id) });
        return { ideas: (rows ?? []).map((r: any) => cardOf(r.idea, r.id)), batchesLeft: null, fromLibrary: true };
      }
    }
    trace.step = "limits";
    const { counts } = await guardFor(who.user.id, PROVIDER === "mock" ? 0 : 0.01, "writing");
    const allowed = ideaBatchesFor(who.plan), used = Number(counts.user_ideas_today ?? 0);
    if (used >= allowed) throw new ApiError("DAILY_LIMIT", canWrite(who.plan) ? `That's today's ${allowed} batches of ideas. Type your own topic, or come back tomorrow.` : `That's today's ${allowed} free batches of ideas. Upgrade to turn one into a video, or come back tomorrow.`);
    trace.step = "writer";
    const { data: past, count } = await admin.from("blocky_worlds_ideas").select("idea", { count: "exact" }).eq("user_id", who.user.id).order("created_at", { ascending: false }).limit(40);
    const avoid = (past ?? []).map((p: any) => p.idea?.opener).filter(Boolean);
    const seed = Math.floor((count ?? 0) / IDEAS_PER_BATCH) + (body?.more ? 1 : 0);
    let written: any;
    try {
      if (IDEA_ENGINE && topic == null) {
        // the idea engine: the log of ideas already given out + the library's openers are the corpus the new ideas must differ from
        const { data: logRows } = await admin.from("blocky_worlds_idea_log").select("rule").order("given_at", { ascending: false }).limit(300);
        const { data: libRows } = await admin.from("blocky_worlds_library").select("idea").limit(300);
        const decideOne = body?.decide === true;
        const pool: any = await writeIdeaPool({ apiKey: ANTHROPIC_KEY, count: decideOne ? 1 : IDEAS_PER_BATCH, style: body?.style === "dark" || body?.style === "funny" ? body.style : null, corpus: [...avoid, ...(libRows ?? []).map((r: any) => `${r.idea?.opener ?? ""} ${r.idea?.price ?? ""}`)], given: (logRows ?? []).map((r: any) => r.rule), meter: moneyMeter(0.6) });
        if (pool.ideas.length) {
          await admin.from("blocky_worlds_idea_log").upsert(pool.ideas.map((x: any) => ({ rule_key: ideaKey(x), rule: x.rule, hook: x.hook, style: x.style, twist: x.twist, source: x.source, total: x.total, scores: x.scores, given_to: who.user.id })), { onConflict: "rule_key", ignoreDuplicates: true });
          written = { ideas: pool.ideas.map((x: any) => x.card), costUsd: pool.costUsd };
        }
      }
      if (!written) written = topic != null
        ? await writeTopicIdeas({ apiKey: ANTHROPIC_KEY, provider: PROVIDER, topic, mood: moodOf(body?.mood), seed, avoid, board: KIT })
        : await writeIdeas({ apiKey: ANTHROPIC_KEY, provider: PROVIDER, seed, mood: moodOf(body?.mood), avoid, board: KIT });
    } catch (e: any) {
      await logCall(who.user.id, "ideas", e?.costUsd ?? 0, false);
      throw writerError(e);
    }
    await logCall(who.user.id, "ideas", written.costUsd);
    // launch mode: the topic needs things the board can't film even after steering: say what, and what we can film
    if (!written.ideas.length && written.unfit) throw new ApiError("BAD_INPUT", `Your idea needs ${written.unfit.needs.map((w: string) => `"${w}"`).join(", ") || "something"}, which we can't film yet. We can film ${canFilmLine()}. Try it there.`);
    if (!written.ideas.length) throw new ApiError("WRITER", "No idea passed our checks this time. Try again.");
    const { data: rows, error } = await admin.from("blocky_worlds_ideas").insert(written.ideas.map((idea: any) => ({ user_id: who.user.id, source: topic != null ? "topic" : "batch", topic, idea }))).select("id, idea");
    if (error) throw new ApiError("SERVER", undefined, {}, error.message);
    return { ideas: (rows ?? []).map((r: any) => cardOf(r.idea, r.id)), batchesLeft: Math.max(0, allowed - used - 1) };
  }

  // ---------- 2. the script (paid plans; writing is free, with a daily limit) ----------
  // ---------- "FIX THIS LINE" (owner, 2026-11-17): free, only the note's lines, then re-checked ----------
  // Never counted toward the daily script writes (a paid user is never stuck on a note); the emergency caps still apply
  // and one draft takes at most FIX_LINES_PER_DRAFT of them.
  if (action === "fixLines") {
    trace.step = "sign-in";
    const who = await requireWriter(req, trace);
    const d = await loadDraft(who.user.id, body?.draftId);
    const note = String(body?.note ?? "").slice(0, 400);
    const before = recheck(d);
    const spot = noteSpots(before, d.lines ?? []).find((n) => n.text === note);
    // fixed meanwhile (or a stale page): the current state, no call
    if (!spot || !spot.lines.length) return { ...(await viewFor(who.user.id, { ...d, checks: before })), fixed: !spot };
    if (Number(d.checks?.lineFixes ?? 0) >= FIX_LINES_PER_DRAFT) throw new ApiError("DAILY_LIMIT", "That's a lot of line fixes for one script. Edit the line yourself, or press Rewrite.");
    trace.step = "limits";
    await guardFor(who.user.id, PROVIDER === "mock" ? 0 : 0.03, "writing");
    trace.step = "writer";
    let fix: any;
    try {
      fix = await fixLines({ apiKey: ANTHROPIC_KEY, provider: PROVIDER, script: { title: d.title, lines: d.lines, post: d.post }, indexes: spot.lines, note, card: PROVIDER === "mock" ? null : d.card ?? null, lengthSec: d.length_sec, kind: kindOf(d), board: KIT, gate: paidGate });
    } catch (e: any) { await logCall(who.user.id, "script", e?.costUsd ?? 0, false); throw writerError(e); }
    if (fix.costUsd) await logCall(who.user.id, "script", fix.costUsd);
    const next = { ...d, lines: fix.script.lines };
    const checks = recheck(next);
    // kept when the note is gone with no new blocker; otherwise the script stays as it was (and the page says so)
    if (!fix.ok) {
      await admin.from("blocky_worlds_drafts").update({ checks: { ...(d.checks ?? {}), lineFixes: Number(d.checks?.lineFixes ?? 0) + 1 } }).eq("id", d.id);
      return { ...(await viewFor(who.user.id, { ...d, checks: before })), fixed: false, notice: "We couldn't fix that line this time. Edit it yourself, or try once more." };
    }
    const { data, error } = await admin.from("blocky_worlds_drafts").update({ lines: next.lines, checks: { ...checks, lineFixes: Number(d.checks?.lineFixes ?? 0) + 1 }, updated_at: new Date().toISOString() }).eq("id", d.id).select("*").single();
    if (error) throw new ApiError("SERVER", undefined, {}, error.message);
    return { ...(await viewFor(who.user.id, data)), fixed: true, changed: spot.lines };
  }

  if (action === "writeScript" || action === "rewrite" || action === "fixOpener" || action === "fixPart") {
    trace.step = "sign-in";
    const who = await requireWriter(req, trace);
    trace.step = "limits";
    // a write or rewrite may go to the hybrid writer (decided below, once the idea is loaded): counted at its cost
    const { counts } = await guardFor(who.user.id, PROVIDER === "mock" ? 0 : action === "fixOpener" ? 0.005 : action === "fixPart" ? 0.02 : HYBRID_ON ? APP_HYBRID.guardUsd : 0.08, "writing");
    if (Number(counts.user_scripts_today ?? 0) >= WRITING.dailyScripts) throw new ApiError("DAILY_LIMIT", `That's today's ${WRITING.dailyScripts} script writes. Edit the script yourself, or come back tomorrow.`);

    if (action === "fixOpener") {
      const d = await loadDraft(who.user.id, body?.draftId);
      const lines = d.lines ?? [];
      if (!lines.length) throw new ApiError("NOT_READY", "The script is empty.");
      trace.step = "writer";
      let fix: any;
      try { fix = await repairOpener({ apiKey: ANTHROPIC_KEY, provider: PROVIDER, line: lines[0].text, next: lines[1]?.text ?? "" }); } catch (e: any) { await logCall(who.user.id, "script", e?.costUsd ?? 0, false); throw writerError(e); }
      await logCall(who.user.id, "script", fix.costUsd);
      if (!fix.line) throw new ApiError("WRITER", 'We couldn\'t fix the first line. Start it with "In this town, " yourself.');
      const next = { ...d, lines: [{ ...lines[0], text: fix.line }, ...lines.slice(1)] };
      const checks = recheck(next);
      const { data } = await admin.from("blocky_worlds_drafts").update({ lines: next.lines, checks, writes: d.writes + 1, updated_at: new Date().toISOString() }).eq("id", d.id).select("*").single();
      return await viewFor(who.user.id, data);
    }

    // "Fix it": only the lines a check flagged in one part are rewritten; every other line stays word for word; the
    // whole script is re-checked with the same checks (one retry with what's still wrong, inside fixPart)
    if (action === "fixPart") {
      const d = await loadDraft(who.user.id, body?.draftId);
      const before = recheck(d);
      const part = String(body?.part ?? "");
      const spots = problemSpots({ lines: d.lines ?? [] }, before.problems).filter((s: any) => s.fix === "part" && s.part === part);
      if (!spots.length) {
        // nothing left to fix there (fixed meanwhile): the current state, no call
        return { ...(await viewFor(who.user.id, { ...d, checks: before })), fixed: !before.problems.length, writesLeft: await scriptsLeft(who.user.id, counts) };
      }
      const indexes = [...new Set(spots.flatMap((s: any) => s.lines))].sort((a: number, b: number) => a - b);
      trace.step = "writer";
      let fix: any;
      try {
        fix = await fixPart({ apiKey: ANTHROPIC_KEY, provider: PROVIDER, script: { title: d.title, lines: d.lines, post: d.post }, indexes, reasons: spots.map((s: any) => s.problem), card: PROVIDER === "mock" ? null : d.card ?? null, lengthSec: d.length_sec, kind: kindOf(d), board: KIT });
      } catch (e: any) { await logCall(who.user.id, "script", e?.costUsd ?? 0, false); throw writerError(e); }
      await logCall(who.user.id, "script", fix.costUsd);
      // saved only when it's better than before (fewer problems); otherwise the draft stays as it was
      const after = paidGate(fix.check);
      if (after.problems.length + after.notes.length >= before.problems.length + before.notes.length) {
        throw new ApiError("WRITER", "We couldn't fix that part this time. Try Fix it once more, or edit those lines yourself.", {}, `fixPart ${part}: ${fix.check.problems.join(" | ")}`);
      }
      const checks = { ...after, kind: kindOf(d) };
      const { data, error } = await admin.from("blocky_worlds_drafts").update({ lines: fix.script.lines, checks, writes: d.writes + 1, updated_at: new Date().toISOString() }).eq("id", d.id).select("*").single();
      if (error) throw new ApiError("SERVER", undefined, {}, error.message);
      return { ...(await viewFor(who.user.id, data)), fixed: fix.fixed, notice: stillFailing(checks.problems), writesLeft: await scriptsLeft(who.user.id) };
    }

    // the idea: from the card (writeScript), or the draft's (rewrite); a draft of the user's own gets a small idea
    let d: any = null, ideaRow: any = null, lengthSec: number;
    if (action === "rewrite") {
      d = await loadDraft(who.user.id, body?.draftId);
      lengthSec = lengthOf(body?.lengthSec, d.length_sec);
      if (d.idea_id) ideaRow = (await admin.from("blocky_worlds_ideas").select("*").eq("id", d.idea_id).eq("user_id", who.user.id).maybeSingle()).data;
    } else {
      lengthSec = lengthOf(body?.lengthSec);
      if (!/^[0-9a-f-]{36}$/i.test(String(body?.ideaId ?? ""))) throw new ApiError("BAD_INPUT");
      ideaRow = (await admin.from("blocky_worlds_ideas").select("*").eq("id", body.ideaId).eq("user_id", who.user.id).maybeSingle()).data;
      if (!ideaRow) throw new ApiError("NOT_FOUND", "We couldn't find that idea. Get new ideas and pick one.");
    }
    // step 1: the complete idea card (a library or topic idea is one already; a user's own script is read back into one)
    let card: any = d?.card ?? ideaRow?.idea ?? null, costUsd = 0;
    // the user's own topic is the story's core (older topic ideas kept it only on the idea row)
    if (card && !card.topic && ideaRow?.source === "topic" && ideaRow.topic) card = { ...card, topic: ideaRow.topic };
    const libraryId = ideaRow?.library_id ?? null;

    // the production writer for a typed topic (owner, 2026-11-08): Opus 5.5 plans, Sonnet 5.5 writes the lines, low
    // effort, one draft, one fix only on a hard failure, the judge as feedback only; a rewrite of its draft is the lines
    // call again from the saved plan. Library ideas and the user's own scripts keep the path below.
    const topicText = card?.topic ?? (ideaRow?.source === "topic" ? ideaRow.topic : null);
    const hybridWrite = action === "writeScript" && ideaRow?.source === "topic" && Boolean(topicText);
    const hybridRewrite = action === "rewrite" && d?.checks?.kind === "hybrid" && Boolean(d?.card?.hybrid?.plan);
    // "Move it to our town" (launch mode): a rewrite whose note moves the story into the kit (the problems name what to
    // replace); a hybrid draft is planned again (its saved plan is the thing that has to move), any other is re-beat
    const move = action === "rewrite" && body?.move === true;
    const note = move ? moveNote(recheck(d, lengthSec).problems) : String(body?.note ?? "").slice(0, 300);
    if (HYBRID_ON && move && hybridRewrite && d?.card?.topic) {
      trace.step = "move to our town";
      const meter = moneyMeter(APP_HYBRID.capUsd);
      const picked = pickRecipe({ topic: d.card.topic, card: d.card });
      const recipe = { ...picked, what: (RECIPES as any)[picked.id]?.what };
      const r: any = await writeHybrid({ apiKey: ANTHROPIC_KEY, topic: d.card.topic, recipe, examples: examplesFor(recipe.id), lengthSec, meter, judge: APP_HYBRID.judge, idea: d.card, ttl: CACHE_TTL, note, board: KIT });
      for (const line of callLogLines({ userId: who.user.id, draftId: d.id, action: "move", calls: r.calls })) console.log(JSON.stringify(line));
      if (!r.script?.lines?.length) {
        await logCall(who.user.id, "script", r.costUsd, false);
        throw writerError(Object.assign(new Error(r.stopped ?? "the writer returned no script"), { balance: Boolean(r.failure?.balance) }));
      }
      await logCall(who.user.id, "script", r.costUsd);
      const row = { title: r.script.title || d.title, length_sec: lengthSec, lines: r.script.lines, post: r.script.post, checks: hybridChecksRow(r, { flow: "move to our town", previous: d.checks }), card: hybridCard(r, recipe), beats: hybridBeats(r.plan, lengthSec), updated_at: new Date().toISOString() };
      const saved = await admin.from("blocky_worlds_drafts").update({ ...row, writes: d.writes + 1 }).eq("id", d.id).select("*").single();
      if (saved.error) throw new ApiError("SERVER", undefined, {}, saved.error.message);
      return { ...(await viewFor(who.user.id, saved.data)), notice: stillFailing(paidGate(row.checks).problems) ?? movedNotice(r.card), writesLeft: await scriptsLeft(who.user.id) };
    }
    if (HYBRID_ON && (hybridWrite || hybridRewrite)) {
      trace.step = hybridWrite ? "hybrid writer" : "hybrid rewrite";
      const meter = moneyMeter(APP_HYBRID.capUsd);
      let r: any, row: any;
      if (hybridWrite) {
        const picked = pickRecipe({ topic: topicText, card });
        const recipe = { ...picked, what: (RECIPES as any)[picked.id]?.what };
        r = await writeHybrid({ apiKey: ANTHROPIC_KEY, topic: topicText, recipe, examples: examplesFor(recipe.id), lengthSec, meter, judge: APP_HYBRID.judge, idea: card, ttl: CACHE_TTL, board: KIT });
        if (r.script?.lines?.length) row = { title: r.script.title, length_sec: lengthSec, lines: r.script.lines, post: r.script.post, checks: hybridChecksRow(r), card: hybridCard(r, recipe), beats: hybridBeats(r.plan, lengthSec) };
      } else {
        const failed = failedOf(recheck(d, lengthSec));
        r = await rewriteHybrid({ apiKey: ANTHROPIC_KEY, plan: d.card.hybrid.plan, card: d.card, examples: examplesByIds(d.card.hybrid.refs ?? []), lengthSec, previous: { lines: d.lines }, failed, note, meter, ttl: CACHE_TTL, board: KIT });
        if (r.script?.lines?.length) row = { title: r.script.title || d.title, length_sec: lengthSec, lines: r.script.lines, post: r.script.post, checks: hybridChecksRow(r, { flow: "hybrid rewrite", previous: d.checks }) };
      }
      for (const line of callLogLines({ userId: who.user.id, draftId: d?.id ?? null, action, calls: r.calls })) console.log(JSON.stringify(line));
      if (!row) {
        await logCall(who.user.id, "script", r.costUsd, false);
        throw writerError(Object.assign(new Error(r.stopped ?? "the writer returned no script"), { balance: Boolean(r.failure?.balance) }));
      }
      await logCall(who.user.id, "script", r.costUsd);
      row.updated_at = new Date().toISOString();
      const saved = d
        ? await admin.from("blocky_worlds_drafts").update({ ...row, writes: d.writes + 1 }).eq("id", d.id).select("*").single()
        : await admin.from("blocky_worlds_drafts").insert({ ...row, user_id: who.user.id, idea_id: ideaRow.id, source: "topic", writes: 1 }).select("*").single();
      if (saved.error) throw new ApiError("SERVER", undefined, {}, saved.error.message);
      // a style rule the writer's own fix left open is fixed line by line before the script is shown (paidGate.js notes)
      const fixedRow = await autoFixStyle(who.user.id, saved.data);
      return { ...(await viewFor(who.user.id, fixedRow)), notice: stillFailing(paidGate(fixedRow.checks).problems) ?? (hybridWrite ? movedNotice(r.card) : null), writesLeft: await scriptsLeft(who.user.id) };
    }

    trace.step = "card";
    if (!card || cardProblems(card).length) {
      if (!d?.lines?.length) throw new ApiError("NOT_FOUND", "We couldn't find that idea. Get new ideas and pick one.");
      try { const c = await cardFromScript({ apiKey: ANTHROPIC_KEY, provider: PROVIDER, lines: d.lines }); costUsd += c.costUsd; card = c.card; } catch (e: any) { await logCall(who.user.id, "script", e?.costUsd ?? 0, false); throw writerError(e); }
    }
    // step 2: the beat sheet (kept across rewrites of the same length)
    trace.step = "beats";
    // (a move to our town plans the beats again: the old ones are set in the world that has to move)
    let beats: any = d?.beats && d.length_sec === lengthSec && !move ? d.beats : null;
    if (!beats) {
      try { const b = await writeBeats({ apiKey: ANTHROPIC_KEY, provider: PROVIDER, card, lengthSec, board: KIT }); costUsd += b.costUsd; beats = b.beats; } catch (e: any) { await logCall(who.user.id, "script", (e?.costUsd ?? 0) + costUsd, false); throw writerError(e); }
    }
    // step 3: the script, following the beats
    trace.step = "writer";
    let written: any;
    try {
      // a rewrite is told exactly which checks the current version fails (writeScript re-checks and retries once)
      const failed = d ? failedOf(recheck(d, lengthSec)) : [];
      written = await writeScript({ apiKey: ANTHROPIC_KEY, provider: PROVIDER, idea: card, lengthSec, previous: d ? { lines: d.lines } : null, note, beats, failed, board: KIT });
    } catch (e: any) {
      await logCall(who.user.id, "script", (e?.costUsd ?? 0) + costUsd, false);
      throw writerError(e);
    }
    await logCall(who.user.id, "script", written.costUsd + costUsd);
    const s = written.script, checks = { ...written.check, kind: "written" };
    const row = { title: s.title, length_sec: lengthSec, lines: s.lines, post: s.post, checks, card, beats, updated_at: new Date().toISOString() };
    const saved = d
      ? await admin.from("blocky_worlds_drafts").update({ ...row, writes: d.writes + 1 }).eq("id", d.id).select("*").single()
      : await admin.from("blocky_worlds_drafts").insert({ ...row, user_id: who.user.id, idea_id: ideaRow.id, source: ideaRow.source === "topic" ? "topic" : "idea", writes: 1 }).select("*").single();
    if (saved.error) throw new ApiError("SERVER", undefined, {}, saved.error.message);
    // learning: a library idea was picked (its first script) or rewritten
    if (libraryId) await countEvent(who.user.id, libraryId, d ? "rewritten" : "picked", { draftId: saved.data.id });
    const fixedRow = await autoFixStyle(who.user.id, saved.data);
    return { ...(await viewFor(who.user.id, fixedRow)), notice: stillFailing(paidGate(fixedRow.checks).problems), writesLeft: await scriptsLeft(who.user.id) };
  }

  if (action === "saveScript") {
    trace.step = "sign-in";
    const who = await requireWriter(req, trace);
    const lengthSec = lengthOf(body?.lengthSec);
    const d = body?.draftId ? await loadDraft(who.user.id, body.draftId) : null;
    // the user's lines (an edit keeps each line's part when it's one of ours) or their own pasted text
    const script = Array.isArray(body?.lines)
      ? normalizeScript({ title: body?.title ?? d?.title ?? "", lines: body.lines.slice(0, 200).map((l: any) => ({ part: PART_IDS.includes(l?.part) ? l.part : "own", text: String(l?.text ?? "").slice(0, 400), ...(typeof l?.beat === "string" ? { beat: l.beat } : {}), ...(typeof l?.speaker === "string" ? { speaker: l.speaker } : {}) })), post: d?.post ?? { title: body?.title ?? "" } })
      : scriptFromText(String(body?.text ?? "").slice(0, 12000), String(body?.title ?? "").slice(0, 80));
    if (!script.lines.length) throw new ApiError("BAD_INPUT", "Write or paste a script first.");
    if (!script.post.title) script.post.title = script.title || script.lines[0].text.slice(0, 70);
    const checks = { ...checkScript(script, lengthSec, "own"), kind: "own" };
    let card: any = d?.card ?? null;
    if (!card && !checks.problems.length) {
      try { const c = await cardFromScript({ apiKey: ANTHROPIC_KEY, provider: PROVIDER, lines: script.lines }); card = c.card; await logCall(who.user.id, "script", c.costUsd); } catch (e: any) { console.error("[blocky-worlds-api] card from script:", e?.message ?? e); }
    }
    // launch mode: a pasted script that needs a cave is told so here, with Fix it / Move it to our town (never after the charge)
    // (Studio: the same checks without any kit miss; only its blocks, studioBuilds.js)
    const checked = paidGate(KIT ? { ...draftCheck(script, lengthSec, "own", card, { board: KIT }), kind: "own" } : checks);
    const row = { title: script.title || script.post.title, length_sec: lengthSec, lines: script.lines, post: script.post, checks: checked, card, updated_at: new Date().toISOString() };
    const saved = d
      ? await admin.from("blocky_worlds_drafts").update(row).eq("id", d.id).select("*").single()
      : await admin.from("blocky_worlds_drafts").insert({ ...row, user_id: who.user.id, source: "own" }).select("*").single();
    if (saved.error) throw new ApiError("SERVER", undefined, {}, saved.error.message);
    return await viewFor(who.user.id, saved.data);
  }

  if (action === "drafts") {
    const who = await requireUser(req, trace);
    const { data } = await admin.from("blocky_worlds_drafts").select("*").eq("user_id", who.user.id).is("deleted_at", null).order("updated_at", { ascending: false }).limit(10);
    const ids = (data ?? []).map((x: any) => x.id);
    const { data: pre } = ids.length ? await admin.from("blocky_worlds_prepays").select("draft_id, credits, created_at, expires_at").eq("user_id", who.user.id).in("draft_id", ids).is("run_id", null).is("refunded_at", null) : { data: [] };
    const paidMap = new Map((pre ?? []).map((p: any) => [p.draft_id, p]));
    return { drafts: (data ?? []).map((x: any) => { const p: any = paidMap.get(x.id); return { ...draftView(x), ...(p ? { flat: { credits: p.credits, charge: "script", paidAt: p.created_at, expiresAt: p.expires_at, keepCredits: BLENDER_FLAT.keepCredits } } : {}) }; }), writesLeft: canWrite(who.plan) ? await scriptsLeft(who.user.id) : 0 };
  }

  // ---------- "EXPLAIN MORE" (owner-only first, the Blender UI; _shared/blockyWorlds/adapt.js) ----------
  // the user's long description / full narration -> OUR rules (hook, "You see, in this town", the story shape, 60-100 s,
  // filmable things), keeping their story, characters and twist; one writer call (+ one fix when a hard check fails)
  if (action === "adaptStory") {
    trace.step = "sign-in";
    const who = await requireWriter(req, trace);
    if (!blenderAvailable(who)) throw new ApiError("NOT_FOUND", "Not available.");
    const text: any = checkStoryText(body?.text);
    if (!text.ok) throw new ApiError("BAD_INPUT", text.error);
    // the story box is checked as a story (adapt.js: 25 words to ~3,000 characters), never as a 200-character topic
    const bad = storyTextProblem(text.text);
    if (bad) throw new ApiError("BAD_INPUT", bad);
    const characters = cleanCharacters(body?.characters);
    trace.step = "limits";
    const { counts } = await guardFor(who.user.id, PROVIDER === "mock" ? 0 : 0.12, "writing");
    if ((await scriptsLeft(who.user.id, counts)) <= 0) throw new ApiError("DAILY_LIMIT", "That's today's script writes. Come back tomorrow.");
    trace.step = "writer";
    let a: any;
    try {
      a = PROVIDER === "mock"
        ? (() => { const s = scriptFromText(text.text, ""); return { script: s, lengthSec: adaptLength(text.words), check: { hard: [], advisory: [] }, kept: null, changed: ["mock: your text as written"], costUsd: 0 }; })()
        : await adaptStory({ apiKey: ANTHROPIC_KEY, text: text.text, note: charactersNote(characters), meter: moneyMeter(0.4) });
    } catch (e: any) { await logCall(who.user.id, "script", e?.costUsd ?? 0, false); throw writerError(e); }
    await logCall(who.user.id, "script", a.costUsd);
    const lengthSec = a.lengthSec;
    const checks = { ...checkScript(a.script, lengthSec, "own"), kind: "own" };
    const card = { adapted: true, topic: text.text.slice(0, 300), characters, kept: a.kept, changed: a.changed };
    const row = { title: a.script.title || a.script.lines[0]?.text?.slice(0, 60) || "My story", length_sec: lengthSec, lines: a.script.lines, post: { ...(a.script.post ?? {}), title: a.script.post?.title || a.script.title || "" }, checks: { ...checks, warnings: [...(checks.warnings ?? []), ...a.check.advisory] }, card, updated_at: new Date().toISOString() };
    const saved = await admin.from("blocky_worlds_drafts").insert({ ...row, user_id: who.user.id, source: "own" }).select("*").single();
    if (saved.error) throw new ApiError("SERVER", undefined, {}, saved.error.message);
    const fixedRow = await autoFixStyle(who.user.id, saved.data);
    return { ...(await viewFor(who.user.id, fixedRow)), adapted: { kept: a.kept, changed: a.changed, stillOpen: a.check.hard }, writesLeft: await scriptsLeft(who.user.id) };
  }

  // ---------- CHARACTER REFERENCE (owner-only first; _shared/blockyWorlds/characterRef.js) ----------
  // ONE cheap vision call turns an avatar / cartoon picture into OUR blocky character spec; photos of real people, logos
  // and brands are refused. The picture is read from this request, forwarded to that call only, and never stored.
  if (action === "characterRef") {
    trace.step = "sign-in";
    const who = await requireWriter(req, trace);
    if (!blenderAvailable(who)) throw new ApiError("NOT_FOUND", "Not available.");
    const up: any = checkUpload({ image: body?.image, mediaType: body?.mediaType });
    if (!up.ok) throw new ApiError("BAD_INPUT", up.error);
    const role = roleOf(body?.role);
    if (PROVIDER === "mock") return { spec: characterSpec({ kind: "roblox_avatar", name_hint: "Test Avatar", skin: "#f1dfc6", hair_style: "spiky", hair_color: "#3a2a1a", shirt: "#7ed321", shirt_pattern: "stripes", shirt_color2: "#ffe600", pants: "#3a3f55", accessories: [], summary: "mock: a green striped shirt" }, role).spec };
    trace.step = "limits";
    await guardFor(who.user.id, 0.01, "writing");
    trace.step = "vision";
    const r: any = await readCharacter({ apiKey: ANTHROPIC_KEY, image: up.data, mediaType: up.mediaType, role }).catch((e: any) => ({ ok: false, code: "WRITER", error: undefined, detail: e?.message ?? String(e), costUsd: 0 }));
    await logCall(who.user.id, "ideas", r.costUsd ?? 0, r.ok || ["REAL_PERSON", "BRAND", "NOT_A_CHARACTER"].includes(r.code));
    if (!r.ok) throw new ApiError(r.code === "WRITER" ? "WRITER" : "BAD_INPUT", r.error, {}, r.detail);
    return { spec: r.spec };
  }

  // ---------- 3-4. settings (the quote) and generate ----------
  // ---------- the SCENE PLAN (owner-only; _shared/blockyWorlds/scenePlan.js): each scene's location from the library ----------
  if (action === "scenePlan") {
    trace.step = "sign-in";
    const who = await requireWriter(req, trace);
    if (!blenderAvailable(who)) throw new ApiError("NOT_FOUND", "Not available.");
    const d = await loadDraft(who.user.id, body?.draftId);
    return { ...autoScenePlan(d.lines ?? []), locations: PICKER };
  }

  // ---------- "TRY AGAIN" (owner 2026-11-18): the same script continues from the failed run's saved parts; nothing is
  // charged now, the price is taken only when the video is ready (blocky_worlds_retry_run + the charge-on-done trigger)
  if (action === "retry") {
    trace.step = "sign-in";
    const who = await requireWriter(req, trace);
    const failedId = String(body?.runId ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(failedId)) throw new ApiError("BAD_INPUT");
    const { data: failed } = await admin.from("blocky_worlds_runs").select("id, status, engine, draft_id, length_sec, user_id").eq("id", failedId).eq("user_id", who.user.id).is("deleted_at", null).maybeSingle();
    if (!failed) throw new ApiError("NOT_FOUND", "We couldn't find that video.");
    if (failed.status !== "failed" || failed.engine !== "studio") throw new ApiError("BAD_INPUT", "Only a video that didn't make it can be tried again.");
    if (!(await retryOn())) throw new ApiError("BUSY", "Try again is being switched on. Nothing was charged. Please try again in a few minutes.", { retryAfterSec: 300 }, "migration 20261218100000 not applied");
    if ((await retriesUsed(failed.draft_id)) >= MAX_FREE_RETRIES) throw new ApiError("LIMIT", RETRIES_USED_UP);
    const busyMsg = "This script is already being made. Wait for it to finish.";
    const { data: active } = await admin.from("blocky_worlds_runs").select("id").eq("draft_id", failed.draft_id).not("status", "in", "(done,failed)").limit(1).maybeSingle();
    if (active) throw new ApiError("LIMIT", busyMsg, { runId: active.id });
    trace.step = "studio worker";
    if (!(await studioWorkerAlive(admin))) throw new ApiError("BUSY", "Our video studio is restarting. Nothing was charged. Try again in a few minutes.", { retryAfterSec: 300 });
    trace.step = "cap check";
    const gr = await guardFor(who.user.id, studioFullCostUsd(failed.length_sec), "video");
    await spendAlert(gr.counts, gr.settings);
    trace.step = "job creation";
    const { data: run, error } = await admin.rpc("blocky_worlds_retry_run", { p_user: who.user.id, p_failed: failed.id, p_env: null });
    if (error || !run) {
      if (/INSUFFICIENT_CREDITS/.test(error?.message ?? "")) throw new ApiError("CREDITS", `You need ${BLENDER_FLAT.credits} credits on your account. Nothing is taken now: we charge them only when your video is ready.`, { credits: BLENDER_FLAT.credits });
      if (/one_active_per_draft|duplicate key/i.test(error?.message ?? "")) throw new ApiError("LIMIT", busyMsg, {}, error?.message);
      throw new ApiError("SERVER", "Couldn't start. Nothing was charged.", {}, error?.message ?? "no run returned");
    }
    return await runView(run, { owner: who.owner, queue: (await studioQueueInfo(admin, [run]))[run.id] ?? null });
  }

  if (action === "quote" || action === "start") {
    trace.step = "sign-in";
    const who = await requireWriter(req, trace);
    const d = await loadDraft(who.user.id, body?.draftId);
    const lengthSec = action === "quote" ? lengthOf(body?.lengthSec, d.length_sec) : d.length_sec;
    trace.step = "script check";
    const checks = recheck(d, lengthSec);
    // the Blender page (body.flat): ONE price per video, the 90 s row; a draft it already paid for costs nothing more
    const flatDraft = body?.flat === true && blenderAvailable(who);
    const prepaid = flatDraft && prepayOn(who) ? await openPrepay(who.user.id, d.id) : null;
    if (action === "quote") return { credits: flatDraft ? BLENDER_FLAT.credits : PRICES[lengthSec], lengthSec, ready: !checks.problems.length, problems: checks.problems, ...(prepaid ? { prepaid: true } : {}) };
    if (checks.problems.length) throw new ApiError("NOT_READY", checks.problems[0], { problems: checks.problems });
    const dryRun = body?.dryRun === true && (who.tester || who.owner);
    if (!RENDERER && !dryRun) throw new ApiError("RENDER_OFF", undefined, {}, "BLOCKY_WORLDS_RENDERER is not runpod, or RunPod / the callback secret is not configured");
    // board-only without the automatic storyboard would send every line to the old planner: refused before any charge
    // (the pipeline only: the Studio engine never uses the storyboard)
    if (!STUDIO_ON && boardOnlyBlocked(productionSettings(envGet))) throw new ApiError("RENDER_OFF", undefined, {}, "BLOCKY_WORLDS_BOARD_ONLY is on but BLOCKY_WORLDS_STORYBOARD is not auto");
    // the Studio engine: a run is only charged while a Studio worker is alive to make it (fail closed, before any charge)
    if (STUDIO_ON && !dryRun) {
      trace.step = "studio worker";
      if (!(await studioWorkerAlive(admin))) throw new ApiError("BUSY", "Our video studio is restarting. Nothing was charged. Try again in a few minutes.", { retryAfterSec: 300 }, `no Studio worker said hello in the last ${STUDIO.workerSeenSec} s (blocky_worlds_workers)`);
    }
    trace.step = "cap check";
    // what one attempt is expected to cost us (the emergency cap counts it): the Studio model's or the pipeline's
    const gs = await guardFor(who.user.id, STUDIO_ON ? studioFullCostUsd(lengthSec) : costBasisUsd(lengthSec), "video");
    await spendAlert(gs.counts, gs.settings);
    trace.step = "price";
    const { data: price, error: pErr } = prepaid ? { data: prepaid.credits, error: null } : await admin.rpc("compute_tool_price", { p_tool_key: toolKey(flatDraft ? BLENDER_FLAT.priceRowSec : lengthSec), p_input: {} });
    if (flatDraft && prepayOn(who) && !prepaid) throw new ApiError("NOT_READY", "This script's payment is not open any more (refunded or used). Write the script again.");
    if (pErr || price == null) throw new ApiError("SERVER", "Couldn't load the price. Please try again.", {}, pErr?.message ?? "no price row");
    const credits = Number(price), endCard = endCardFor(who.plan, body?.removeWatermark === true);
    if (dryRun) return { dryRun: true, credits, endCard, lengthSec, renderer: Boolean(RENDERER), checks };
    // one video at a time per script: a double-tapped "Try again" never charges twice (the unique index
    // blocky_worlds_runs_one_active_per_draft makes the same promise inside the start transaction)
    trace.step = "one per script";
    const busyMsg = "This script is already being made. Wait for it to finish.";
    const { data: active } = await admin.from("blocky_worlds_runs").select("id").eq("draft_id", d.id).not("status", "in", "(done,failed)").limit(1).maybeSingle();
    if (active) throw new ApiError("LIMIT", busyMsg, { runId: active.id });
    // the maker's scene plan is validated before charging
    let scenePlan: any = null;
    if (blenderAvailable(who) && body?.scenePlan) {
      const c = cleanScenePlan(body.scenePlan, (d.lines ?? []).length);
      if (!c.ok) throw new ApiError("BAD_INPUT", c.error);
      scenePlan = c.plan;
    }
    // the maker's character references (characterRef.js specs, re-cleaned): they go to the director's style sheet
    const characters = blenderAvailable(who) ? cleanCharacters(body?.characters ?? d.card?.characters) : [];
    trace.step = "job creation";
    const script = { title: d.title, lines: d.lines };
    const { data: run, error } = await admin.rpc("blocky_worlds_start_run", {
      p_user: who.user.id, p_draft: d.id, p_title: d.title, p_length: lengthSec, p_lines: d.lines, p_narration: narrationOf(script), p_post: d.post,
      p_narrator: NARRATOR, p_end_card: endCard, p_credits: credits, p_env: (who.tester || who.owner) && !OPEN ? "test" : "prod",
      // the engine is written with the charge (migration 20261213100000): the pipeline's sweeper never sees a Studio run.
      // Sent only for Studio, so the pipeline keeps working whether or not that migration is applied yet.
      ...(STUDIO_ON ? { p_engine: "studio" } : {}),
      // the paid script: its prepay is consumed instead of a new charge (migration 20261216200000)
      ...(prepaid ? { p_prepay: prepaid.id } : {}),
    });
    if (error || !run) {
      if (/INSUFFICIENT_CREDITS/.test(error?.message ?? "")) throw new ApiError("CREDITS", `You need ${credits} credits for this video.`, { credits });
      // the whole start (charge included) was rolled back: nothing was charged
      if (/one_active_per_draft|duplicate key/i.test(error?.message ?? "")) throw new ApiError("LIMIT", busyMsg, {}, error?.message);
      if (/PREPAY_NOT_OPEN/.test(error?.message ?? "")) throw new ApiError("NOT_READY", "This script's payment is not open any more (refunded or used). Write the script again.", {}, error?.message);
      throw new ApiError("SERVER", "Couldn't start. Nothing was charged.", {}, error?.message ?? "no run returned");
    }
    const ideaLib = d.idea_id ? (await admin.from("blocky_worlds_ideas").select("library_id").eq("id", d.idea_id).maybeSingle()).data?.library_id ?? null : null;
    await admin.from("blocky_worlds_runs").update({ card: scenePlan || characters.length ? { ...(runCard(d.card ?? null) ?? {}), ...(scenePlan ? { scene_plan: scenePlan } : {}), ...(characters.length ? { characters } : {}) } : runCard(d.card ?? null), library_id: ideaLib, ...(STUDIO_ON ? { studio_builds: studioBuilds({ lines: d.lines ?? [] }, d.card ?? null) } : {}) }).eq("id", run.id);
    if (ideaLib) await countEvent(who.user.id, ideaLib, "generated", { draftId: d.id, runId: run.id });
    // the pipeline (docs/blocky-worlds-pipeline.md): the prepare job goes to RunPod now; a run that can't be sent is
    // failed and refunded by the runtime; anything else that goes wrong here is picked up by the sweeper within a minute
    // A Studio run waits in the table: a Studio worker claims it (blocky_worlds_claim_studio_run); nothing is sent here.
    if (run.engine === "studio") return await runView({ ...run, library_id: ideaLib }, { owner: who.owner, queue: (await studioQueueInfo(admin, [run]))[run.id] ?? null });
    trace.step = "dispatch";
    let started: any = null;
    try { started = await renderRuntime(admin).start(run.id); } catch (e: any) { console.error("[blocky-worlds-api] start dispatch:", run.id, e?.message ?? e); }
    return await runView({ ...run, ...(started ?? {}), library_id: ideaLib }, { owner: who.owner, queue: (await queueInfo(admin, [run.id]))[run.id] ?? null });
  }

  // ---------- 5. results ----------
  const who = await requireUser(req, trace);
  if (action === "list") {
    const { data } = await admin.from("blocky_worlds_runs").select("*").eq("user_id", who.user.id).is("deleted_at", null).order("created_at", { ascending: false }).limit(20);
    const working = (data ?? []).filter((r: any) => !["done", "failed"].includes(r.status) && r.engine !== "studio").map((r: any) => r.id);
    const q: Record<string, any> = { ...(working.length ? await queueInfo(admin, working) : {}), ...(await studioQueueInfo(admin, data ?? [])) };
    return { runs: await Promise.all((data ?? []).map((r: any) => runView(r, { owner: who.owner, queue: q[r.id] ?? null }))) };
  }
  const runId = String(body?.runId ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(runId)) throw new ApiError("BAD_INPUT");
  const { data: run } = await admin.from("blocky_worlds_runs").select("*").eq("id", runId).eq("user_id", who.user.id).is("deleted_at", null).maybeSingle();
  if (!run) throw new ApiError("NOT_FOUND", "We couldn't find that video.");
  if (action === "status") return await runView(run, { owner: who.owner, queue: ["done", "failed"].includes(run.status) ? null : run.engine === "studio" ? (await studioQueueInfo(admin, [run]))[run.id] ?? null : (await queueInfo(admin, [run.id]))[run.id] ?? null });
  if (action === "event") {
    const kind = String(body?.kind ?? "");
    if (!["downloaded", "thumb_up", "thumb_down"].includes(kind)) throw new ApiError("BAD_INPUT");
    if (run.status !== "done") throw new ApiError("BAD_INPUT", "This video isn't ready yet.");
    const fresh = await countEvent(who.user.id, run.library_id, kind, { draftId: run.draft_id, runId: run.id });
    // a user's own idea (topic or pasted) that made a good video joins the library as "pending": anonymised (only the
    // idea card, no user data), and the AI judge decides on the next library tick whether anyone else sees it
    if (fresh && !run.library_id && (kind === "thumb_up" || kind === "downloaded") && run.card && !cardProblems(run.card).length) {
      // only the card: the user's own typed topic stays with them
      const c: any = stripForLibrary(run.card);
      const { error } = await admin.from("blocky_worlds_library").insert({ idea: c, opener: c.opener, opener_key: openerKey(c.opener), formula: c.formula, twist: c.twistType, mood: c.mood, setting: c.setting, status: "pending", source: "user", source_draft: run.draft_id });
      if (error && !/duplicate key/i.test(error.message)) console.error("[blocky-worlds-api] promote:", error.message);
    }
    return { ok: true };
  }
  if (action === "remove") {
    if (!["done", "failed"].includes(run.status)) throw new ApiError("BAD_INPUT", "This video is still being made.");
    await admin.from("blocky_worlds_runs").update({ deleted_at: new Date().toISOString() }).eq("id", runId);
    const paths = Object.values(run.files ?? {}).filter((p) => typeof p === "string") as string[];
    if (paths.length) await admin.storage.from(BUCKET).remove(paths);
    return { ok: true };
  }
  throw new ApiError("BAD_INPUT", "Unknown action.");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  const trace: Trace = { action: "", step: "", owner: false };
  try {
    return ok(req, await handle(req, trace));
  } catch (e) {
    const known = e instanceof ApiError, code = known ? e.code : "SERVER";
    const detail = known ? e.detail ?? e.message : e instanceof Error ? e.message : String(e);
    if (!known || ["SERVER", "BUSY", "LIMIT", "WRITER"].includes(code)) console.error("[blocky-worlds-api]", JSON.stringify({ action: trace.action, step: trace.step, code, detail }));
    // the owner's reply says where it stopped and why; a customer's never does
    const debug = trace.owner ? { step: trace.step || null, code, message: detail } : undefined;
    if (known) return err(req, e.message, ERRORS[e.code].status, { code: e.code, ...e.extra, ...(debug ? { debug } : {}) });
    return err(req, ERRORS.SERVER.message, 500, { code: "SERVER", ...(debug ? { debug } : {}) });
  }
});
