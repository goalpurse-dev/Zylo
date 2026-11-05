// deno-lint-ignore-file no-explicit-any
// cutaway-api: the Cutaway Explainer template's server entry point for the page (the 3D pipeline, M3).
// The actions and the reply shapes are in _shared/cutaway/contract.js; the run's path (RunPod, retry, the Fly fallback,
// refunds) in _shared/cutaway/orchestrate.js and runtime.ts.
//
//   access {}  quote {topic, lengthSec}  start {topic, lengthSec, removeWatermark}  status {runId}  list {}
//   remove {runId}  approveLayout {runId, approve}  opsStatus {}  opsSetDailyCap {usd}  opsSetCustom {on}  opsSetBeta {on}
//   opsRetirePart {id}  (owner only)
//
// Who may generate: CUTAWAY_ENABLED=true for everyone with a paid plan (access.js); while it is off, only the emails in
// CUTAWAY_TEST_USERS (owner test mode: one line, removed at launch). The owner (ADMIN_EMAILS) approves layouts.
// The price comes from the topic text here (premade = an approved layout exists), never from what the page sends; the
// credits are charged once, at start, in the same transaction that creates the run (cutaway_start_run).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cors, err, ok } from "../shared/cors.ts";
import { ERRORS } from "../_shared/cutaway/contract.js";
import { LENGTHS, lengthsFor, PRICES } from "../_shared/cutaway/pricing.js";
import { canGenerate } from "../_shared/cutaway/access.js";
import { canRemoveEndCard, endCardFor } from "../_shared/cutaway/endCard.js";
import { cantBuildMessage, CATEGORIES, classifyTopic, kitCheck, normTopic, openCategories, PREMADE, premadeByKey } from "../_shared/cutaway/topics.js";
import { closestNames } from "../_shared/cutaway/quote.js";
import { checkKitFit } from "../_shared/cutaway/kitCheck.js";
import { capAlertLevel, DAILY_CAP_RANGE, decide, DEFAULT_SETTINGS, topicProblem, customDayLimit, customDayCap } from "../_shared/cutaway/guard.js";
import { alertOnce } from "../_shared/adminAlert.ts";
import { adminEmailList, isAdmin } from "../_shared/contentMachine/adminGuard.js";
import { BUCKET, runDir } from "../_shared/cutaway/jobs.js";
import { PREVIEW, PREVIEW_TOPIC_KEYS, previewDecision, topicsForGoals } from "../_shared/cutaway/freePreview.js";
import { advance, CONFIG, dispatchNew, expectedUsd, getUrl, layoutKeyOf, newRunFromPlan, startGiftFinish, viewOf, watch } from "../_shared/cutaway/runtime.ts";

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
async function serverQuote(userId: string | null, topic: string, lengthSec: number, { log = false, open = [] as string[] } = {}) {
  const c = classifyTopic(topic), approved = await approvedKeys();
  const premade = c.kind === "premade" && c.premade && approved.has(c.premade) ? c.premade : null;
  let check: any = premade ? { verdict: "yes", missing: [], closest: [] } : kitCheck(topic, { open }), checkedBy = "rules";
  if (!premade && check.verdict === "unsure") {
    if (!CONFIG.anthropic) throw new ApiError("BUSY", "The topic check isn't available right now. Try a premade topic.", {}, "no Anthropic key on the server");
    const ai = await checkKitFit({ apiKey: CONFIG.anthropic, topic, open }).catch((e: any) => {
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

/**
 * The categories open to this person (topics.js CATEGORIES; phase 0 of the any-topic plan, 2026-11-04): each opens only
 * after its proof (cutaway_settings.categories {key: "open"}); the owner tests every one. Fails closed: unreadable = none.
 */
async function openFor(owner: boolean): Promise<string[]> {
  if (owner) return CATEGORIES.map((c: any) => c.key);
  const { data, error } = await admin.from("cutaway_settings").select("categories").eq("id", 1).maybeSingle();
  return error ? [] : openCategories(data?.categories);
}

/** Custom topics for customers: off unless the owner switched them on (/admin/ops; fails closed). */
async function customTopicsOn() {
  const { data, error } = await admin.from("cutaway_settings").select("custom_enabled").eq("id", 1).maybeSingle();
  return !error && data?.custom_enabled === true;
}
/** the "Beta" badge on custom topics (off by default; /admin/ops) */
async function customBetaOn() {
  const { data, error } = await admin.from("cutaway_settings").select("custom_beta").eq("id", 1).maybeSingle();
  return !error && data?.custom_beta === true;
}

// a custom video on a premade topic with no approved layout yet keeps the premade key, so approving its layout makes
// that topic premade
const namedPremade = (topic: string) => { const c = classifyTopic(topic); return c.kind === "premade" ? c.premade ?? null : null; };
const topicKey = (topic: string) => normTopic(topic).replace(/^(a|an|the) /, "").replace(/\b(how|does|do|work|works|a|an|the)\b/g, " ").trim().replace(/\s+/g, "_").slice(0, 40);

// ---------- actions ----------
// ---------- the free preview ----------
const hash = async (salt: string, value: string) => {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`zyvo-preview:${salt}:${value}`)));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
};
async function previewFacts(userId: string) {
  const [{ data: settings }, { data: onboarding }, { data: existing }] = await Promise.all([
    admin.from("onboarding_settings").select("*").eq("id", 1).maybeSingle(),
    admin.from("user_onboarding").select("enrolled, goals").eq("user_id", userId).maybeSingle(),
    admin.from("cutaway_free_previews").select("*").eq("user_id", userId).maybeSingle(),
  ]);
  return { settings, onboarding, existing };
}
async function freePreviewSpend() {
  const since = new Date(Date.now() - 86400000).toISOString();
  const { data, error } = await admin.from("cutaway_runs").select("status, cost_usd").eq("free_preview", true).gte("created_at", since);
  if (error) return Infinity; // fails closed
  return (data ?? []).reduce((a: number, r: any) => a + (["done", "failed"].includes(r.status) ? Number(r.cost_usd) || 0 : Math.max(Number(r.cost_usd) || 0, PREVIEW.expectedUsd)), 0);
}
/** the videos on offer: a ready shared plan, in the order the survey's first answer asks for, each with its own clip */
async function previewTopics(goals: string[]) {
  const [{ data: plans }, approved] = await Promise.all([admin.from("cutaway_preview_plans").select("topic_key, source_run, title").eq("active", true), approvedKeys()]);
  const ready = (plans ?? []).filter((p: any) => approved.has(p.topic_key));
  const order = topicsForGoals(goals, PREVIEW_TOPIC_KEYS.length).filter((k: string) => ready.some((p: any) => p.topic_key === k)).slice(0, 3);
  const { data: sources } = await admin.from("cutaway_runs").select("*").in("id", ready.map((p: any) => p.source_run));
  return await Promise.all(order.map(async (key: string) => {
    const plan = ready.find((p: any) => p.topic_key === key), source = (sources ?? []).find((r: any) => r.id === plan.source_run), dir = source ? runDir(source) : null;
    return { key, topic: premadeByKey(key)?.topic ?? key, hook: premadeByKey(key)?.hook ?? "", title: plan.title, clipUrl: dir ? await getUrl(admin, `${dir}/web.mp4`, 3600) : null, poster: dir ? await getUrl(admin, `${dir}/poster.jpg`, 3600) : null };
  }));
}
// force: the owner's look at the flow, on any plan, at any rollout (?onboarding=force&real=1). Ignored for anyone else.
async function freePreviewState(who: any, body: any = {}) {
  const forced = who.owner && body?.force === true;
  const { settings, onboarding, existing } = await previewFacts(who.user.id);
  const on = forced || Boolean(settings?.free_preview_on && onboarding?.enrolled);
  const live = existing && existing.status !== "failed" ? existing : null;
  const { data: run } = live?.run_id ? await admin.from("cutaway_runs").select("*").eq("id", live.run_id).maybeSingle() : { data: null };
  const { data: finish } = live?.finish_run_id ? await admin.from("cutaway_runs").select("*").eq("id", live.finish_run_id).maybeSingle() : { data: null };
  // a preview made again after a failure (ours or theirs: started 10+ minutes after their first try), finished and not
  // watched to the end yet: Home says "watch it", not "finish it"
  const again = Boolean(run && live && Date.parse(run.created_at) - Date.parse(live.created_at) > 600000);
  const { count: watchedCount } = run?.status === "done" && again ? await admin.from("funnel_events").select("id", { count: "exact", head: true }).eq("user_id", who.user.id).eq("event", "preview_watched_to_end") : { count: 1 };
  return {
    on, plan: who.plan,
    preview: run ? await viewOf(admin, run) : null,
    finish: finish ? await viewOf(admin, finish) : null,
    paid: Boolean(live?.paid_at),
    unseen: (watchedCount ?? 1) === 0,
    // their last preview failed (it's theirs again): the page and Home say so and offer the same video again
    lastFailed: existing?.status === "failed" ? { topicKey: existing.topic_key ?? null } : null,
    topics: on && !live ? await previewTopics(onboarding?.goals ?? []) : [],
  };
}
/** the owner's re-run of a customer's failed free preview, on the same topic (owner, 2026-11-03: the GPU failures) */
async function rerunFailedPreview(userId: string) {
  const [{ data: row }, { data: profile }] = await Promise.all([
    admin.from("cutaway_free_previews").select("*").eq("user_id", userId).maybeSingle(),
    admin.from("profiles").select("plan_code").eq("id", userId).maybeSingle(),
  ]);
  if (!row || row.status !== "failed") throw new ApiError("BAD_INPUT", "that preview is not a failed one");
  if ((profile?.plan_code ?? "free") !== "free") throw new ApiError("BAD_INPUT", "that account has a plan now");
  const { data: plan } = await admin.from("cutaway_preview_plans").select("source_run").eq("topic_key", row.topic_key).eq("active", true).maybeSingle();
  if (!plan) throw new ApiError("BAD_INPUT", "no plan for that topic");
  const { data: taken } = await admin.from("cutaway_free_previews").update({ status: "reserved", run_id: null, updated_at: new Date().toISOString() }).eq("user_id", userId).eq("status", "failed").select("user_id");
  if (!taken?.length) throw new ApiError("BAD_INPUT", "already taken");
  try {
    const { data: source } = await admin.from("cutaway_runs").select("*").eq("id", plan.source_run).single();
    const run = await newRunFromPlan(admin, source, { user_id: userId, free_preview: true, end_card: true });
    await admin.from("cutaway_free_previews").update({ run_id: run.id }).eq("user_id", userId);
    const patch = await dispatchNew(admin, run);
    return { id: run.id, step: patch?.status ?? "queued" };
  } catch (e: any) {
    await admin.from("cutaway_free_previews").update({ status: "failed" }).eq("user_id", userId);
    throw new ApiError("BUSY", undefined, {}, e?.message ?? "the preview didn't start");
  }
}
async function startFreePreview(req: Request, who: any, body: any) {
  const key = String(body?.topicKey ?? "");
  const forced = who.owner && body?.force === true;
  const facts = await previewFacts(who.user.id);
  const { settings, onboarding } = facts;
  // the owner can look again: an earlier failed look is cleared, the money cap below still counts
  if (forced && facts.existing?.status === "failed") await admin.from("cutaway_free_previews").delete().eq("user_id", who.user.id);
  const existing = forced && facts.existing?.status === "failed" ? null : facts.existing;
  const since = new Date(Date.now() - PREVIEW.windowDays * 86400000).toISOString();
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "";
  const device = String(body?.deviceId ?? "").slice(0, 80);
  const ipHash = ip ? await hash("ip", ip) : null, deviceHash = device ? await hash("device", device) : null;
  const count = async (col: string, value: string | null) => {
    if (!value) return 0;
    const { count: n, error } = await admin.from("cutaway_free_previews").select("user_id", { count: "exact", head: true }).eq(col, value).neq("status", "failed").neq("user_id", who.user.id).gte("created_at", since);
    if (error) throw new ApiError("BUSY", undefined, {}, error.message); // fails closed
    return n ?? 0;
  };
  const [{ data: plan }, ipCount, deviceCount, spent24h] = await Promise.all([
    PREVIEW_TOPIC_KEYS.includes(key) ? admin.from("cutaway_preview_plans").select("source_run").eq("topic_key", key).eq("active", true).maybeSingle() : Promise.resolve({ data: null }),
    count("ip_hash", ipHash), count("device_hash", deviceHash), freePreviewSpend(),
  ]);
  const d = previewDecision({ switchOn: (forced || Boolean(settings?.free_preview_on)) && !PAID_OFF, enrolled: forced || Boolean(onboarding?.enrolled), plan: forced ? "free" : who.plan, existing, ipCount, deviceCount, spent24h, capUsd: Number(settings?.free_preview_daily_cap_usd ?? 0), hasPlan: Boolean(plan) });
  if (!d.ok) {
    if (d.code === "PREVIEW_USED" && existing?.run_id) { const { data: cur } = await admin.from("cutaway_runs").select("*").eq("id", existing.run_id).maybeSingle(); if (cur) return await viewOf(admin, cur); }
    throw new ApiError(d.code as any, d.message);
  }
  // the one preview: a row in this table, on the server. Two starts at once can't both get it.
  const row = { user_id: who.user.id, topic_key: key, ip_hash: ipHash, device_hash: deviceHash, status: "reserved", run_id: null, updated_at: new Date().toISOString() };
  if (existing) {
    const { data: taken } = await admin.from("cutaway_free_previews").update(row).eq("user_id", who.user.id).eq("status", "failed").select("user_id");
    if (!taken?.length) throw new ApiError("PREVIEW_USED");
  } else {
    const { error } = await admin.from("cutaway_free_previews").insert(row);
    if (error?.code === "23505") throw new ApiError("PREVIEW_USED");
    if (error) throw new ApiError("SERVER", undefined, {}, error.message);
  }
  try {
    const { data: source } = await admin.from("cutaway_runs").select("*").eq("id", plan!.source_run).single();
    const run = await newRunFromPlan(admin, source, { user_id: who.user.id, free_preview: true, end_card: true });
    await admin.from("cutaway_free_previews").update({ run_id: run.id }).eq("user_id", who.user.id);
    const patch = await dispatchNew(admin, run);
    return await viewOf(admin, { ...run, ...patch });
  } catch (e: any) {
    await admin.from("cutaway_free_previews").update({ status: "failed" }).eq("user_id", who.user.id);
    throw new ApiError("BUSY", undefined, {}, e?.message ?? "the preview didn't start");
  }
}

async function handle(req: Request, trace: Trace) {
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "");
  trace.action = action;

  if (action === "access") {
    const who = await whoIs(req);
    const [approved, customOn, beta, open] = await Promise.all([approvedKeys(), customTopicsOn(), customBetaOn(), openFor(Boolean(who?.owner))]);
    return {
      customBeta: beta,
      enabled: ENABLED, tester: Boolean(who?.tester), owner: Boolean(who?.owner), signedIn: Boolean(who), plan: who?.plan ?? null,
      // custom topics: "Coming soon" on the page until the owner switches them on (the owner can always test them)
      customOpen: customOn || Boolean(who?.owner),
      canGenerate: Boolean(who && (ENABLED || who.tester) && canGenerate(who.plan)), canRemoveWatermark: Boolean(who && canRemoveEndCard(who.plan)),
      premade: PREMADE.filter((p) => approved.has(p.key)).map((p) => ({ key: p.key, topic: p.topic, hook: p.hook })),
      // the categories that passed their proof (the page refuses the rest as you type, as the server does)
      openCategories: open,
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
    // custom topics are "Coming soon" until the owner switches them on (launch: premade only, the owner's decision of
    // 2026-10-26): refused before the kit check, so nothing is spent or charged; the owner can still test them
    if (action === "start" && !who.owner) {
      const named = classifyTopic(topic), [approved, customOn] = await Promise.all([approvedKeys(), customTopicsOn()]);
      if (!customOn && !(named.kind === "premade" && named.premade && approved.has(named.premade))) throw new ApiError("SOON", undefined, {}, "custom topics are switched off (cutaway_settings.custom_enabled)");
    }
    trace.step = "kit check";
    const quote = await serverQuote(who.user.id, topic, lengthSec, { log: action === "start" && body?.dryRun !== true, open: await openFor(Boolean(who.owner)) });
    if (action === "quote") return { quote };
    if (!quote.buildable) throw new ApiError("CANT_BUILD", cantBuildMessage(quote.missing), { missing: quote.missing, closest: quote.closest }, `not buildable: ${quote.missing.join(", ") || "-"}`);
    if (!lengthsFor(quote.kind).includes(lengthSec)) throw new ApiError("BAD_INPUT", "Premade topics are 30 seconds for now.");

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

    // during the Beta, custom videos per user per 24 hours (the owner's rule of 2026-10-31); a failed, refunded run does not
    // count (the owner's rule of 2026-11-05: a customer's failures used up their day). Premade has no such limit; the owner
    // tests freely. Fails closed. 5 a day on the paid plans, none on Generative (customDayCap; the owner's rule of 2026-11-05)
    if (quote.kind === "custom" && !who.owner && customDayCap(who.plan) !== Infinity) {
      const { data: recent, error: rErr } = await admin.from("cutaway_runs").select("created_at, status").eq("user_id", who.user.id).eq("kind", "custom").gte("created_at", new Date(Date.now() - 86400000).toISOString());
      const lim = customDayLimit(rErr ? null : recent, Date.now(), who.plan);
      if (!lim.ok) throw new ApiError(lim.code as any, lim.message, { retryAfterSec: lim.retryAfterSec }, rErr?.message ?? `custom runs in 24 h: ${recent?.length}`);
    }

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

  // ---------- the free 10 s preview of the new-user tutorial (freePreview.js) ----------
  if (action === "freePreviewState") return await freePreviewState(who, body);
  if (action === "startFreePreview") return await startFreePreview(req, who, body);
  if (action === "finishFreePreview") {
    const run = await startGiftFinish(admin, who.user.id);
    return { finish: run ? await viewOf(admin, run) : null };
  }
  if (action === "opsPreparePreviewPlan") {
    if (!who.owner) throw new ApiError("NOT_FOUND");
    const key = String(body?.topicKey ?? "");
    if (!PREVIEW_TOPIC_KEYS.includes(key) || !(await approvedKeys()).has(key)) throw new ApiError("BAD_INPUT", "Pick an approved premade topic.");
    const { data: run, error } = await admin.from("cutaway_runs").insert({ user_id: who.user.id, env: "test", topic: premadeByKey(key)?.topic ?? key, topic_key: key, length_sec: 30, kind: "premade", layout_key: key, layout_used: true, end_card: true, credits_charged: 0, free_preview: true, preview_pool: true }).select("*").single();
    if (error) throw new ApiError("SERVER", undefined, {}, error.message);
    const patch = await dispatchNew(admin, run);
    return await viewOf(admin, { ...run, ...patch }, { owner: true });
  }
  if (action === "opsRerunFailedPreview") {
    if (!who.owner) throw new ApiError("NOT_FOUND");
    return await rerunFailedPreview(String(body?.userId ?? ""));
  }

  // /admin/ops, the owner only: the emergency cap against the last 24 hours, and changing it
  if (["opsStatus", "opsSetDailyCap", "opsSetCustom", "opsSetBeta", "opsRetirePart"].includes(action)) {
    if (!who.owner) throw new ApiError("NOT_FOUND");
    if (action === "opsSetBeta") {
      const { error } = await admin.from("cutaway_settings").update({ custom_beta: body?.on === true, updated_at: new Date().toISOString() }).eq("id", 1);
      if (error) throw new ApiError("SERVER", undefined, {}, error.message);
    }
    // a bad saved part is retired: no later video is shown it (a part of that name can be designed again)
    if (action === "opsRetirePart") {
      const id = String(body?.id ?? ""); if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError("BAD_INPUT");
      const { error } = await admin.from("cutaway_parts_library").update({ retired_at: new Date().toISOString() }).eq("id", id).is("retired_at", null);
      if (error) throw new ApiError("SERVER", undefined, {}, error.message);
    }
    if (action === "opsSetCustom") {
      const { error } = await admin.from("cutaway_settings").update({ custom_enabled: body?.on === true, updated_at: new Date().toISOString() }).eq("id", 1);
      if (error) throw new ApiError("SERVER", undefined, {}, error.message);
    }
    if (action === "opsSetDailyCap") {
      const usd = Math.round(Number(body?.usd));
      if (!Number.isFinite(usd) || usd < DAILY_CAP_RANGE.min || usd > DAILY_CAP_RANGE.max) throw new ApiError("BAD_INPUT", `Pick a whole number of dollars from ${DAILY_CAP_RANGE.min} to ${DAILY_CAP_RANGE.max}.`);
      const { error } = await admin.from("cutaway_settings").update({ daily_cap_usd: usd, updated_at: new Date().toISOString() }).eq("id", 1);
      if (error) throw new ApiError("SERVER", undefined, {}, error.message);
    }
    const since = new Date(Date.now() - 24 * 3600e3).toISOString();
    const [{ data: settings }, { data: counts }, { data: alerts }, { data: parts }, { data: refused }, { data: failed }] = await Promise.all([
      admin.from("cutaway_settings").select("*").eq("id", 1).maybeSingle(),
      admin.rpc("cutaway_guard", { p_user: who.user.id }),
      admin.from("system_logs").select("event, created_at").eq("source", "ops-alert").like("event", "cutaway:cap%").gte("created_at", since).order("created_at", { ascending: false }),
      // what users ask for: the parts the kit learned, the topics refused, the videos that failed (and where)
      admin.from("cutaway_parts_library").select("id, name, synonyms, topic, uses, created_at, retired_at").order("created_at", { ascending: false }).limit(40),
      admin.from("cutaway_parts_backlog").select("topic, missing, checked_by, created_at").order("created_at", { ascending: false }).limit(30),
      admin.from("cutaway_runs").select("topic, kind, stage, error_code, error_message, cost_usd, created_at").eq("status", "failed").order("created_at", { ascending: false }).limit(30),
    ]);
    const capUsd = Number(settings?.daily_cap_usd ?? DEFAULT_SETTINGS.daily_cap_usd), usedUsd = Number(counts?.spent_24h) || 0;
    return {
      capUsd, usedUsd, running: Number(counts?.running) || 0, paidCalls: settings?.paid_calls !== false && !PAID_OFF, range: DAILY_CAP_RANGE, customEnabled: settings?.custom_enabled === true, customBeta: settings?.custom_beta === true,
      parts: parts ?? [], refused: refused ?? [], failed: (failed ?? []).map((r: any) => ({ ...r, error_message: String(r.error_message ?? "").split("\n")[0].slice(0, 200) })),
      perUser: { maxRunning: Number(settings?.user_max_running ?? DEFAULT_SETTINGS.user_max_running), startsPerHour: Number(settings?.user_starts_per_hour ?? DEFAULT_SETTINGS.user_starts_per_hour) },
      alerts: (alerts ?? []).map((a: any) => ({ level: Number(String(a.event).replace("cutaway:cap", "")), at: a.created_at })),
    };
  }

  if (action === "list") {
    const { data } = await admin.from("cutaway_runs").select("*").eq("user_id", who.user.id).eq("free_preview", false).is("deleted_at", null).order("created_at", { ascending: false }).limit(20);
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
