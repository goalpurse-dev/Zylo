// deno-lint-ignore-file no-explicit-any
// cutaway-api: the Cutaway Explainer template's server entry point for the page (the 3D pipeline, M3).
// The actions and the reply shapes are in _shared/cutaway/contract.js; the run's path (RunPod, retry, the Fly fallback,
// refunds) in _shared/cutaway/orchestrate.js and runtime.ts.
//
//   access {}  quote {topic, lengthSec}  start {topic, lengthSec, removeWatermark}  status {runId}  list {}
//   remove {runId}  approveLayout {runId, approve}  opsStatus {}  opsSetDailyCap {usd}  (owner only)
//
// Who may generate: CUTAWAY_ENABLED=true for everyone with a paid plan (access.js); while it is off, only the emails in
// CUTAWAY_TEST_USERS (owner test mode: one line, removed at launch). The owner (ADMIN_EMAILS) approves layouts.
// The price comes from the topic text here (premade = an approved layout exists), never from what the page sends; the
// credits are charged once, at start, in the same transaction that creates the run (cutaway_start_run).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cors, err, ok } from "../shared/cors.ts";
import { ERRORS } from "../_shared/cutaway/contract.js";
import { LENGTHS, PRICES } from "../_shared/cutaway/pricing.js";
import { canGenerate } from "../_shared/cutaway/access.js";
import { canRemoveEndCard, endCardFor } from "../_shared/cutaway/endCard.js";
import { classifyTopic, kitCheck, normTopic, PREMADE, premadeByKey } from "../_shared/cutaway/topics.js";
import { closestNames } from "../_shared/cutaway/quote.js";
import { checkKitFit } from "../_shared/cutaway/kitCheck.js";
import { capAlertLevel, DAILY_CAP_RANGE, decide, DEFAULT_SETTINGS, topicProblem } from "../_shared/cutaway/guard.js";
import { alertOnce } from "../_shared/adminAlert.ts";
import { adminEmailList, isAdmin } from "../_shared/contentMachine/adminGuard.js";
import { BUCKET, runDir } from "../_shared/cutaway/jobs.js";
import { advance, CONFIG, dispatchNew, expectedUsd, layoutKeyOf, viewOf, watch } from "../_shared/cutaway/runtime.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const flag = (k: string) => (Deno.env.get(k) ?? "").trim().toLowerCase();
// One Supabase project serves production and every preview: one server switch, off unless "true".
const ENABLED = flag("CUTAWAY_ENABLED") === "true";
const TESTERS = adminEmailList(Deno.env.get("CUTAWAY_TEST_USERS"));
const OWNERS = adminEmailList(Deno.env.get("ADMIN_EMAILS"));
const PAID_OFF = flag("CUTAWAY_PAID_CALLS") === "off";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

class ApiError extends Error {
  /** `detail`: what really happened, for the logs and the owner's Details (never shown to a customer) */
  constructor(public code: keyof typeof ERRORS, message?: string, public extra: Record<string, unknown> = {}, public detail?: string) { super(message ?? ERRORS[code].message); }
}
/** One request's trail: the step it is on, and whether the owner is asking (the owner's error replies carry `debug`). */
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
  return { user, plan, tester: isAdmin(user, TESTERS), owner: isAdmin(user, OWNERS) };
}
async function requireUser(req: Request, trace?: Trace) {
  const who = await whoIs(req);
  if (!who) throw new ApiError("SIGN_IN");
  if (trace) trace.owner = who.owner;
  return who;
}
/** may generate: the switch is on (or a tester while it is off), and a paid plan (testers too: the same rule as customers) */
async function requireGenerator(req: Request, trace?: Trace) {
  const who = await requireUser(req, trace);
  if (!ENABLED && !who.tester) throw new ApiError("OFF");
  if (!canGenerate(who.plan)) throw new ApiError("UPGRADE");
  return who;
}

// ---------- the quote ----------
async function approvedKeys(): Promise<Set<string>> {
  const { data } = await admin.from("cutaway_layouts").select("key").eq("approved", true).is("retired_at", null);
  return new Set((data ?? []).map((r: any) => r.key));
}
/**
 * Premade only when the topic names a premade topic AND its layout is approved (the owner's rule: premade topics at
 * launch = only topics with an approved layout); otherwise custom, after the kit check (rules, then Haiku when unsure).
 */
async function serverQuote(userId: string | null, topic: string, lengthSec: number, { log = false } = {}) {
  const c = classifyTopic(topic), approved = await approvedKeys();
  const premade = c.kind === "premade" && c.premade && approved.has(c.premade) ? c.premade : null;
  let check: any = premade ? { verdict: "yes", missing: [], closest: [] } : kitCheck(topic), checkedBy = "rules";
  if (!premade && check.verdict === "unsure") {
    if (!CONFIG.anthropic) throw new ApiError("BUSY", "The topic check isn't available right now. Try a premade topic.", {}, "no Anthropic key on the server");
    const ai = await checkKitFit({ apiKey: CONFIG.anthropic, topic }).catch((e: any) => {
      throw new ApiError("BUSY", e?.balance ? "Custom topics are paused on our side for now. Try a premade topic." : "We couldn't check this topic right now. Try again in a few minutes, or pick a premade topic.",
        { retryAfterSec: e?.balance ? 1800 : 120 }, `${e?.balance ? "Anthropic balance: " : ""}${e?.message ?? e}`);
    });
    checkedBy = "claude";
    check = { verdict: ai.buildable ? "yes" : "no", missing: ai.missing, closest: ai.closest.length ? ai.closest : check.closest };
  }
  const kind = premade ? "premade" : "custom", buildable = check.verdict === "yes";
  if (!buildable && log) await admin.from("cutaway_parts_backlog").insert({ user_id: userId, topic, missing: check.missing, checked_by: checkedBy, closest: check.closest });
  return { kind, premade, credits: PRICES.video.credits[kind][lengthSec], buildable, missing: check.missing ?? [], closest: closestNames((check.closest ?? []).filter((k: string) => approved.has(k))) };
}

/** The owner's view of a cap refusal: which cap, and the numbers it compared. */
function capDetail(reason: string | null, settings: any, counts: any, addUsd: number, cErr: any) {
  if (cErr) return `cap check: the spend state could not be read (${cErr.message})`;
  const s = { ...DEFAULT_SETTINGS, ...(settings ?? {}) }, c = counts ?? {}, $ = (v: unknown) => `$${(Number(v) || 0).toFixed(2)}`;
  return `${reason}: this video ~${$(addUsd)}. You: ${c.user_running ?? 0} of ${s.user_max_running} running, ${c.user_starts_1h ?? 0} of ${s.user_starts_per_hour} starts in 1 h. ` +
    `Everyone: ${$(c.spent_24h)} of the ${$(s.daily_cap_usd)} emergency cap in 24 h, ${c.running ?? 0} running. Balance fail ${c.minutes_since_balance_fail ?? "-"} min ago.`;
}

/**
 * The emergency cap's emails: at 50 % and 80 % of it, and when it is reached (a start refused), each level at most
 * once per 24 h (alertOnce keeps the memory in system_logs). Awaited before the reply: work left behind a response
 * can be cut off. Never throws.
 */
async function noteCapLevel(usedUsd: number, capUsd: number) {
  const level = capAlertLevel(usedUsd, capUsd);
  if (!level) return;
  const $ = (v: number) => `$${v.toFixed(2)}`;
  const subject = level >= 100 ? `Cutaway: the ${$(capUsd)} emergency cap was reached (new videos see "High demand")` : `Cutaway: ${level} % of the ${$(capUsd)} daily emergency cap used`;
  const text = `Cutaway Explainer has used ${$(usedUsd)} of our provider cost in the last 24 hours (videos in progress counted at their price), against an emergency cap of ${$(capUsd)}.\n\n` +
    (level >= 100 ? "New videos are refused with \"High demand right now, please try again shortly\"; nothing is charged for them, and videos in progress finish.\n\n" : "") +
    "If this is real demand, raise the cap on /admin/ops (the Cutaway card): it takes effect at once. If it isn't, something may be looping: switch paid calls off there.";
  await alertOnce(admin, `cutaway:cap${level}`, 24 * 3600, subject, text).catch(() => false);
}

// a custom video on a premade topic with no approved layout yet keeps the premade key, so approving its layout makes
// that topic premade
const namedPremade = (topic: string) => { const c = classifyTopic(topic); return c.kind === "premade" ? c.premade ?? null : null; };
const topicKey = (topic: string) => normTopic(topic).replace(/^(a|an|the) /, "").replace(/\b(how|does|do|work|works|a|an|the)\b/g, " ").trim().replace(/\s+/g, "_").slice(0, 40);

// ---------- actions ----------
async function handle(req: Request, trace: Trace) {
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "");
  trace.action = action;

  if (action === "access") {
    const who = await whoIs(req);
    const approved = await approvedKeys();
    return {
      enabled: ENABLED, tester: Boolean(who?.tester), owner: Boolean(who?.owner), signedIn: Boolean(who), plan: who?.plan ?? null,
      canGenerate: Boolean(who && (ENABLED || who.tester) && canGenerate(who.plan)), canRemoveWatermark: Boolean(who && canRemoveEndCard(who.plan)),
      premade: PREMADE.filter((p) => approved.has(p.key)).map((p) => ({ key: p.key, topic: p.topic, hook: p.hook })),
    };
  }

  if (action === "quote" || action === "start") {
    trace.step = "sign-in";
    const who = action === "start" ? await requireGenerator(req, trace) : await requireUser(req, trace);
    trace.step = "topic";
    const topic = String(body?.topic ?? "").trim().replace(/\s+/g, " "), lengthSec = Number(body?.lengthSec);
    const bad = topicProblem(topic);
    if (bad) throw new ApiError("BAD_INPUT", bad);
    if (!LENGTHS.includes(lengthSec)) throw new ApiError("BAD_INPUT", "Pick 30 or 60 seconds.");
    trace.step = "kit check";
    const quote = await serverQuote(who.user.id, topic, lengthSec, { log: action === "start" && body?.dryRun !== true });
    if (action === "quote") return { quote };
    if (!quote.buildable) throw new ApiError("CANT_BUILD", undefined, { missing: quote.missing, closest: quote.closest }, `not buildable: ${quote.missing.join(", ") || "-"}`);

    // the caps, read fresh (fail closed), before anything is charged
    trace.step = "cap check";
    const [{ data: settings }, { data: counts, error: cErr }] = await Promise.all([
      admin.from("cutaway_settings").select("*").eq("id", 1).maybeSingle(),
      admin.rpc("cutaway_guard", { p_user: who.user.id }),
    ]);
    const addUsd = expectedUsd(quote.kind, lengthSec);
    const g = decide(settings ?? DEFAULT_SETTINGS, cErr ? null : counts, addUsd, { envOff: PAID_OFF });
    if (!cErr && counts && body?.dryRun !== true && (g.ok || g.reason === "the emergency cap")) {
      const capUsd = Number(settings?.daily_cap_usd ?? DEFAULT_SETTINGS.daily_cap_usd), spent = Number(counts.spent_24h) || 0;
      await noteCapLevel(g.ok ? spent + addUsd : Math.max(spent + addUsd, capUsd), capUsd);
    }
    if (!g.ok) throw new ApiError(g.code as any, g.code === "LIMIT" ? g.reason ?? undefined : g.message ?? undefined, { retryAfterSec: g.retryAfterSec }, capDetail(g.reason, settings, counts, addUsd, cErr));

    // the end card comes from the plan, read here (the page's request only asks)
    trace.step = "price";
    const endCard = endCardFor(who.plan, body?.removeWatermark === true);
    const { data: price, error: pErr } = await admin.rpc("compute_tool_price", { p_tool_key: PRICES.video.toolKey(quote.kind, lengthSec), p_input: {} });
    if (pErr || price == null) throw new ApiError("SERVER", "Couldn't load the price. Please try again.", {}, pErr?.message ?? "no price row");
    const credits = Number(price);
    // owner test mode only: every check above, then stop before anything is charged or created (free)
    if (body?.dryRun === true && who.tester) return { dryRun: true, quote, credits, endCard, guard: { ok: true, everyoneSpent24hUsd: Number(counts?.spent_24h ?? 0), capUsd: Number(settings?.daily_cap_usd ?? DEFAULT_SETTINGS.daily_cap_usd), addUsd } };
    trace.step = "job creation";
    const { data: run, error } = await admin.rpc("cutaway_start_run", {
      p_user: who.user.id, p_topic: topic, p_topic_key: quote.premade ?? namedPremade(topic) ?? topicKey(topic), p_length: lengthSec, p_kind: quote.kind,
      p_end_card: endCard, p_credits: credits, p_env: who.tester && !ENABLED ? "test" : "prod", p_layout_key: quote.premade,
    });
    if (error || !run) {
      if (/INSUFFICIENT_CREDITS/.test(error?.message ?? "")) throw new ApiError("CREDITS", `You need ${credits} credits for this video.`, { credits });
      throw new ApiError("SERVER", "Couldn't start. Nothing was charged.", {}, error?.message ?? "no run returned");
    }
    // owner test mode only: a forced failure on our side, to see the refund and the failed state (no provider is called)
    if (body?.testFail === true && who.tester && !ENABLED) {
      const { patch } = await advance(admin, run, { event: "failed", code: "BAD_JOB", message: "owner test: forced failure", retryable: false });
      return await viewOf(admin, { ...run, ...patch }, { owner: who.owner });
    }
    // off to the GPU; a run that can't be sent anywhere is refunded inside (runtime.ts)
    trace.step = "dispatch";
    const patch = await dispatchNew(admin, run);
    return await viewOf(admin, { ...run, ...patch }, { owner: who.owner });
  }

  const who = await requireUser(req, trace);

  // /admin/ops, the owner only: the emergency cap against the last 24 hours, and changing it
  if (action === "opsStatus" || action === "opsSetDailyCap") {
    if (!who.owner) throw new ApiError("NOT_FOUND");
    if (action === "opsSetDailyCap") {
      const usd = Math.round(Number(body?.usd));
      if (!Number.isFinite(usd) || usd < DAILY_CAP_RANGE.min || usd > DAILY_CAP_RANGE.max) throw new ApiError("BAD_INPUT", `Pick a whole number of dollars from ${DAILY_CAP_RANGE.min} to ${DAILY_CAP_RANGE.max}.`);
      const { error } = await admin.from("cutaway_settings").update({ daily_cap_usd: usd, updated_at: new Date().toISOString() }).eq("id", 1);
      if (error) throw new ApiError("SERVER", undefined, {}, error.message);
    }
    const since = new Date(Date.now() - 24 * 3600e3).toISOString();
    const [{ data: settings }, { data: counts }, { data: alerts }] = await Promise.all([
      admin.from("cutaway_settings").select("*").eq("id", 1).maybeSingle(),
      admin.rpc("cutaway_guard", { p_user: who.user.id }),
      admin.from("system_logs").select("event, created_at").eq("source", "ops-alert").like("event", "cutaway:cap%").gte("created_at", since).order("created_at", { ascending: false }),
    ]);
    const capUsd = Number(settings?.daily_cap_usd ?? DEFAULT_SETTINGS.daily_cap_usd), usedUsd = Number(counts?.spent_24h) || 0;
    return {
      capUsd, usedUsd, running: Number(counts?.running) || 0, paidCalls: settings?.paid_calls !== false && !PAID_OFF, range: DAILY_CAP_RANGE,
      perUser: { maxRunning: Number(settings?.user_max_running ?? DEFAULT_SETTINGS.user_max_running), startsPerHour: Number(settings?.user_starts_per_hour ?? DEFAULT_SETTINGS.user_starts_per_hour) },
      alerts: (alerts ?? []).map((a: any) => ({ level: Number(String(a.event).replace("cutaway:cap", "")), at: a.created_at })),
    };
  }

  if (action === "list") {
    const { data } = await admin.from("cutaway_runs").select("*").eq("user_id", who.user.id).is("deleted_at", null).order("created_at", { ascending: false }).limit(20);
    return { runs: await Promise.all((data ?? []).map((r: any) => viewOf(admin, r, { owner: who.owner }))) };
  }

  const runId = String(body?.runId ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(runId)) throw new ApiError("BAD_INPUT");
  const { data: run } = await admin.from("cutaway_runs").select("*").eq("id", runId).eq("user_id", who.user.id).is("deleted_at", null).maybeSingle();
  if (!run) throw new ApiError("NOT_FOUND");

  if (action === "status") {
    // a run that went quiet is looked at here too (the cron does it every 2 minutes anyway)
    let r = run;
    if (!["done", "failed"].includes(run.status) && Date.now() - Date.parse(run.watched_at ?? run.created_at) > 90000) {
      await watch(admin, run).catch((e) => console.error("[cutaway-api] watch:", e?.message ?? e));
      r = (await admin.from("cutaway_runs").select("*").eq("id", runId).single()).data ?? run;
    }
    return await viewOf(admin, r, { owner: who.owner });
  }

  if (action === "remove") {
    if (!["done", "failed"].includes(run.status)) throw new ApiError("BAD_INPUT", "This video is still being made.");
    await admin.from("cutaway_runs").update({ deleted_at: new Date().toISOString() }).eq("id", runId);
    const dir = runDir(run), { data: files } = await admin.storage.from(BUCKET).list(dir, { limit: 100 });
    const top = (files ?? []).filter((f: any) => f.id).map((f: any) => `${dir}/${f.name}`);
    if (top.length) await admin.storage.from(BUCKET).remove(top);
    return { ok: true };
  }

  if (action === "approveLayout") {
    if (!who.owner) throw new ApiError("NOT_FOUND");
    if (run.status !== "done") throw new ApiError("BAD_INPUT", "Only a finished video's layout can be approved.");
    const approve = body?.approve !== false, key = layoutKeyOf(run);
    if (!key) throw new ApiError("BAD_INPUT", "This video has no layout to approve.");
    // the layout row was saved when the video finished (runtime.ts saveLayout); a reused one already exists
    const now = new Date().toISOString();
    const { error } = await admin.from("cutaway_layouts").update(approve ? { approved: true, approved_by: who.user.id, approved_at: now, retired_at: null, updated_at: now } : { approved: false, retired_at: now, updated_at: now }).eq("key", key);
    if (error) throw new ApiError("SERVER");
    await admin.from("cutaway_runs").update({ layout_approved: approve }).eq("id", runId);
    return { ok: true, approved: approve, key, premade: premadeByKey(key)?.topic ?? null };
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
    if (!known || ["SERVER", "BUSY", "LIMIT"].includes(code)) console.error("[cutaway-api]", JSON.stringify({ action: trace.action, step: trace.step, code, detail }));
    // the owner's reply says where it stopped and why (the Details link on the page); a customer's never does
    const debug = trace.owner ? { step: trace.step || null, code, message: detail } : undefined;
    if (known) return err(req, e.message, ERRORS[e.code].status, { code: e.code, ...e.extra, ...(debug ? { debug } : {}) });
    return err(req, ERRORS.SERVER.message, 500, { code: "SERVER", ...(debug ? { debug } : {}) });
  }
});
