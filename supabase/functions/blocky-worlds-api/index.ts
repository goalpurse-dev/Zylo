// deno-lint-ignore-file no-explicit-any
// blocky-worlds-api: the Blocky Worlds template's server entry point for the page. The actions and reply shapes are in
// _shared/blockyWorlds/contract.js. The flow: idea -> script -> settings -> generate -> result.
//
// Switches (function secrets):
//   BLOCKY_WORLDS_ENABLED=true       the template for everyone (otherwise only BLOCKY_WORLDS_TEST_USERS, owner test mode)
//   BLOCKY_WORLDS_LLM=mock           ideas and scripts from examples.js: no Anthropic call, no cost (the free flow test)
//   BLOCKY_WORLDS_PAID_CALLS=off     a hard off switch for every paid call
//   BLOCKY_WORLDS_RENDERER=runpod    video making on (docs/blocky-worlds-pipeline.md), and only when RunPod and the
//                                    callback secret are configured too (renderSupabase.ts); otherwise start refuses
//                                    BEFORE anything is charged. A tester's dryRun still runs every check and the price
// The protocol (docs/blocky-worlds-protocol.md): "Pick an idea" serves unseen ideas from the judged library first; every
// source becomes a complete idea card; then card -> beat sheet -> script, each step checked and retried on its own.
// Learning: picked / rewritten / generated / downloaded / thumbs are counted per library idea (event action).
// The price comes from the length here and the script is re-checked here: nothing the page sends about either is
// trusted. Credits are charged once, at start, in the same transaction that creates the run (blocky_worlds_start_run).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cors, err, ok } from "../shared/cors.ts";
import { adminEmailList, isAdmin } from "../_shared/contentMachine/adminGuard.js";
import { ERRORS, FAILED_MESSAGE } from "../_shared/blockyWorlds/contract.js";
import { DEFAULT_LENGTH, LENGTHS, NARRATOR } from "../_shared/blockyWorlds/config.js";
import { canGenerate, canRemoveEndCard, canWrite, endCardFor } from "../_shared/blockyWorlds/access.js";
import { costBasisUsd, PRICES, toolKey } from "../_shared/blockyWorlds/pricing.js";
import { DEFAULT_SETTINGS, decide, WRITING } from "../_shared/blockyWorlds/guard.js";
import { MOODS } from "../_shared/blockyWorlds/formulas.js";
import { cardOf, DAILY_IDEA_BATCHES, FREE_IDEA_BATCHES, IDEAS_PER_BATCH } from "../_shared/blockyWorlds/ideas.js";
import { checkScript, narrationOf, normalizeScript, PART_IDS, scriptFromText } from "../_shared/blockyWorlds/script.js";
import { topicProblem } from "../_shared/blockyWorlds/safety.js";
import { cardFromScript, providerFrom, repairOpener, writeBeats, writeIdeas, writeScript, writeTopicIdeas } from "../_shared/blockyWorlds/llm.js";
import { openerKey, pickForUser } from "../_shared/blockyWorlds/library.js";
import { cardProblems } from "../_shared/blockyWorlds/protocol.js";
import { renderConfigured, renderRuntime } from "../_shared/blockyWorlds/renderSupabase.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const flag = (k: string) => (Deno.env.get(k) ?? "").trim().toLowerCase();
const ENABLED = flag("BLOCKY_WORLDS_ENABLED") === "true";
const TESTERS = adminEmailList(Deno.env.get("BLOCKY_WORLDS_TEST_USERS"));
const OWNERS = adminEmailList(Deno.env.get("ADMIN_EMAILS"));
const PAID_OFF = flag("BLOCKY_WORLDS_PAID_CALLS") === "off";
const PROVIDER = providerFrom(Deno.env.get("BLOCKY_WORLDS_LLM"));
// on only when it says runpod AND everything a run needs is configured: a half-configured renderer never charges anyone
const RENDERER = (Deno.env.get("BLOCKY_WORLDS_RENDERER") ?? "").trim() === "runpod" && renderConfigured() ? "runpod" : "";
const BUCKET = "blocky-worlds-renders";

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
  return { user, plan, tester: isAdmin(user, TESTERS), owner: isAdmin(user, OWNERS) };
}
/** signed in, and the template is on for them */
async function requireUser(req: Request, trace: Trace) {
  const who = await whoIs(req);
  if (!who) throw new ApiError("SIGN_IN");
  trace.owner = who.owner;
  if (!ENABLED && !who.tester) throw new ApiError("OFF");
  return who;
}
/** may write scripts (and generate): a paid plan, the same rule for testers */
async function requireWriter(req: Request, trace: Trace) {
  const who = await requireUser(req, trace);
  if (!canWrite(who.plan)) throw new ApiError("UPGRADE");
  return who;
}

// ---------- the caps (fail closed) ----------
async function guardFor(userId: string, addUsd: number, kind: "video" | "writing") {
  const [{ data: settings }, { data: counts, error }] = await Promise.all([
    admin.from("blocky_worlds_settings").select("*").eq("id", 1).maybeSingle(),
    admin.rpc("blocky_worlds_guard", { p_user: userId }),
  ]);
  const g = decide(settings ?? DEFAULT_SETTINGS, error ? null : counts, addUsd, { envOff: PAID_OFF && PROVIDER !== "mock", kind });
  if (!g.ok) throw new ApiError(g.code as any, g.code === "LIMIT" ? g.reason ?? undefined : g.message ?? undefined, { retryAfterSec: g.retryAfterSec }, `${g.reason}${error ? `: ${error.message}` : ""}`);
  return { settings, counts: counts ?? {} };
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
  const check = d.checks ?? {};
  return {
    id: d.id, source: d.source, ideaId: d.idea_id, title: d.title, lengthSec: d.length_sec, lines: d.lines ?? [], post: d.post ?? {},
    credits: PRICES[d.length_sec] ?? null,
    check: { problems: check.problems ?? [], warnings: check.warnings ?? [], words: check.words ?? 0, seconds: check.seconds ?? 0 },
    ready: !(check.problems ?? []).length, updatedAt: d.updated_at,
  };
}
async function signed(path: string | undefined, download?: string) {
  if (!path) return null;
  const { data } = await admin.storage.from(BUCKET).createSignedUrl(path, 3600, download ? { download } : undefined);
  return data?.signedUrl ?? null;
}
async function runView(r: any, { owner = false } = {}) {
  const done = r.status === "done", files = r.files ?? {};
  return {
    id: r.id, draftId: r.draft_id, title: r.title, lengthSec: r.length_sec, credits: r.credits_charged, createdAt: r.created_at, doneAt: r.finished_at,
    status: r.status, stepAt: Date.parse(r.stage_at ?? r.created_at), pct: r.pct ?? 0, post: done ? r.post : null,
    // the light 720p copy plays on the page; the download is the full 1080p file
    finalUrl: done ? await signed(files.web ?? files.final) : null, downloadUrl: done ? await signed(files.final, `${(r.title || "blocky-world").replace(/[^\w -]/g, "").slice(0, 60)}.mp4`) : null,
    poster: done ? await signed(files.poster) : null,
    error: r.status === "failed" ? FAILED_MESSAGE : null, refunded: Boolean(r.refunded_at),
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

/** The kind of checks a draft gets: ours keep their parts; anything the user saved is checked as their own. */
const kindOf = (d: any) => (d.checks?.kind === "written" ? "written" : "own");
function recheck(d: any, lengthSec = d.length_sec) {
  const script = { title: d.title, lines: d.lines ?? [], post: d.post ?? {} };
  return { ...checkScript(script, lengthSec, kindOf(d)), kind: kindOf(d) };
}
async function loadDraft(userId: string, draftId: unknown) {
  if (!/^[0-9a-f-]{36}$/i.test(String(draftId ?? ""))) throw new ApiError("BAD_INPUT");
  const { data } = await admin.from("blocky_worlds_drafts").select("*").eq("id", draftId).eq("user_id", userId).is("deleted_at", null).maybeSingle();
  if (!data) throw new ApiError("NOT_FOUND", "We couldn't find that script.");
  return data;
}
const lengthOf = (v: unknown, fallback = DEFAULT_LENGTH) => {
  const n = v == null ? fallback : Number(v);
  if (!LENGTHS.includes(n)) throw new ApiError("BAD_INPUT", `Pick ${LENGTHS.join(", ")} seconds.`);
  return n;
};
const moodOf = (v: unknown) => (typeof v === "string" && (MOODS as any)[v] ? v : null);
async function scriptsLeft(userId: string, counts?: any) {
  const used = counts?.user_scripts_today ?? (await admin.rpc("blocky_worlds_guard", { p_user: userId })).data?.user_scripts_today ?? 0;
  return Math.max(0, WRITING.dailyScripts - Number(used));
}

async function handle(req: Request, trace: Trace) {
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "");
  trace.action = action;

  if (action === "access") {
    const who = await whoIs(req);
    const visible = ENABLED || Boolean(who?.tester);
    let ideaBatchesLeft = null;
    if (who && visible) {
      const { data } = await admin.rpc("blocky_worlds_guard", { p_user: who.user.id });
      ideaBatchesLeft = Math.max(0, ideaBatchesFor(who.plan) - Number(data?.user_ideas_today ?? 0));
    }
    return {
      enabled: ENABLED, signedIn: Boolean(who), plan: who?.plan ?? null, owner: Boolean(who?.owner), tester: Boolean(who?.tester),
      visible, canWrite: Boolean(who && visible && canWrite(who.plan)), canGenerate: Boolean(who && visible && canGenerate(who.plan) && RENDERER),
      canRemoveWatermark: Boolean(who && canRemoveEndCard(who.plan)), mock: PROVIDER === "mock", renderer: Boolean(RENDERER),
      lengths: LENGTHS, defaultLength: DEFAULT_LENGTH, prices: PRICES, narrator: { name: NARRATOR.voiceName },
      moods: Object.entries(MOODS).map(([id, m]: any) => ({ id, label: m.label })), ideaBatchesLeft,
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
      const { data: cands, error: cErr } = await admin.rpc("blocky_worlds_library_candidates", { p_user: who.user.id, p_mood: mood, p_limit: 60 });
      if (cErr) console.error("[blocky-worlds-api] library:", cErr.message);
      const chosen = pickForUser(cands ?? [], IDEAS_PER_BATCH, mood);
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
      written = topic != null
        ? await writeTopicIdeas({ apiKey: ANTHROPIC_KEY, provider: PROVIDER, topic, mood: moodOf(body?.mood), seed, avoid })
        : await writeIdeas({ apiKey: ANTHROPIC_KEY, provider: PROVIDER, seed, mood: moodOf(body?.mood), avoid });
    } catch (e: any) {
      await logCall(who.user.id, "ideas", e?.costUsd ?? 0, false);
      throw writerError(e);
    }
    await logCall(who.user.id, "ideas", written.costUsd);
    if (!written.ideas.length) throw new ApiError("WRITER", "No idea passed our checks this time. Try again.");
    const { data: rows, error } = await admin.from("blocky_worlds_ideas").insert(written.ideas.map((idea: any) => ({ user_id: who.user.id, source: topic != null ? "topic" : "batch", topic, idea }))).select("id, idea");
    if (error) throw new ApiError("SERVER", undefined, {}, error.message);
    return { ideas: (rows ?? []).map((r: any) => cardOf(r.idea, r.id)), batchesLeft: Math.max(0, allowed - used - 1) };
  }

  // ---------- 2. the script (paid plans; writing is free, with a daily limit) ----------
  if (action === "writeScript" || action === "rewrite" || action === "fixOpener") {
    trace.step = "sign-in";
    const who = await requireWriter(req, trace);
    trace.step = "limits";
    const { counts } = await guardFor(who.user.id, PROVIDER === "mock" ? 0 : action === "fixOpener" ? 0.005 : 0.08, "writing");
    if (Number(counts.user_scripts_today ?? 0) >= WRITING.dailyScripts) throw new ApiError("DAILY_LIMIT", `That's today's ${WRITING.dailyScripts} script writes. Edit the script yourself, or come back tomorrow.`);

    if (action === "fixOpener") {
      const d = await loadDraft(who.user.id, body?.draftId);
      const lines = d.lines ?? [];
      if (!lines.length) throw new ApiError("NOT_READY", "The script is empty.");
      trace.step = "writer";
      let fix: any;
      try { fix = await repairOpener({ apiKey: ANTHROPIC_KEY, provider: PROVIDER, line: lines[0].text, next: lines[1]?.text ?? "" }); } catch (e: any) { await logCall(who.user.id, "script", e?.costUsd ?? 0, false); throw writerError(e); }
      await logCall(who.user.id, "script", fix.costUsd);
      if (!fix.line) throw new ApiError("WRITER", 'We couldn\'t fix the first line. Start it with "In this world, " or "In this town, " yourself.');
      const next = { ...d, lines: [{ ...lines[0], text: fix.line }, ...lines.slice(1)] };
      const checks = recheck(next);
      const { data } = await admin.from("blocky_worlds_drafts").update({ lines: next.lines, checks, writes: d.writes + 1, updated_at: new Date().toISOString() }).eq("id", d.id).select("*").single();
      return draftView(data);
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
    const libraryId = ideaRow?.library_id ?? null;
    trace.step = "card";
    if (!card || cardProblems(card).length) {
      if (!d?.lines?.length) throw new ApiError("NOT_FOUND", "We couldn't find that idea. Get new ideas and pick one.");
      try { const c = await cardFromScript({ apiKey: ANTHROPIC_KEY, provider: PROVIDER, lines: d.lines }); costUsd += c.costUsd; card = c.card; } catch (e: any) { await logCall(who.user.id, "script", e?.costUsd ?? 0, false); throw writerError(e); }
    }
    // step 2: the beat sheet (kept across rewrites of the same length)
    trace.step = "beats";
    let beats: any = d?.beats && d.length_sec === lengthSec ? d.beats : null;
    if (!beats) {
      try { const b = await writeBeats({ apiKey: ANTHROPIC_KEY, provider: PROVIDER, card, lengthSec }); costUsd += b.costUsd; beats = b.beats; } catch (e: any) { await logCall(who.user.id, "script", (e?.costUsd ?? 0) + costUsd, false); throw writerError(e); }
    }
    // step 3: the script, following the beats
    trace.step = "writer";
    let written: any;
    try {
      written = await writeScript({ apiKey: ANTHROPIC_KEY, provider: PROVIDER, idea: card, lengthSec, previous: d ? { lines: d.lines } : null, note: String(body?.note ?? "").slice(0, 300), beats });
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
    return { ...draftView(saved.data), writesLeft: await scriptsLeft(who.user.id) };
  }

  if (action === "saveScript") {
    trace.step = "sign-in";
    const who = await requireWriter(req, trace);
    const lengthSec = lengthOf(body?.lengthSec);
    const d = body?.draftId ? await loadDraft(who.user.id, body.draftId) : null;
    // the user's lines (an edit keeps each line's part when it's one of ours) or their own pasted text
    const script = Array.isArray(body?.lines)
      ? normalizeScript({ title: body?.title ?? d?.title ?? "", lines: body.lines.slice(0, 200).map((l: any) => ({ part: PART_IDS.includes(l?.part) ? l.part : "own", text: String(l?.text ?? "").slice(0, 400) })), post: d?.post ?? { title: body?.title ?? "" } })
      : scriptFromText(String(body?.text ?? "").slice(0, 12000), String(body?.title ?? "").slice(0, 80));
    if (!script.lines.length) throw new ApiError("BAD_INPUT", "Write or paste a script first.");
    if (!script.post.title) script.post.title = script.title || script.lines[0].text.slice(0, 70);
    const checks = { ...checkScript(script, lengthSec, "own"), kind: "own" };
    let card: any = d?.card ?? null;
    if (!card && !checks.problems.length) {
      try { const c = await cardFromScript({ apiKey: ANTHROPIC_KEY, provider: PROVIDER, lines: script.lines }); card = c.card; await logCall(who.user.id, "script", c.costUsd); } catch (e: any) { console.error("[blocky-worlds-api] card from script:", e?.message ?? e); }
    }
    const row = { title: script.title || script.post.title, length_sec: lengthSec, lines: script.lines, post: script.post, checks, card, updated_at: new Date().toISOString() };
    const saved = d
      ? await admin.from("blocky_worlds_drafts").update(row).eq("id", d.id).select("*").single()
      : await admin.from("blocky_worlds_drafts").insert({ ...row, user_id: who.user.id, source: "own" }).select("*").single();
    if (saved.error) throw new ApiError("SERVER", undefined, {}, saved.error.message);
    return draftView(saved.data);
  }

  if (action === "drafts") {
    const who = await requireUser(req, trace);
    const { data } = await admin.from("blocky_worlds_drafts").select("*").eq("user_id", who.user.id).is("deleted_at", null).order("updated_at", { ascending: false }).limit(10);
    return { drafts: (data ?? []).map(draftView), writesLeft: canWrite(who.plan) ? await scriptsLeft(who.user.id) : 0 };
  }

  // ---------- 3-4. settings (the quote) and generate ----------
  if (action === "quote" || action === "start") {
    trace.step = "sign-in";
    const who = await requireWriter(req, trace);
    const d = await loadDraft(who.user.id, body?.draftId);
    const lengthSec = action === "quote" ? lengthOf(body?.lengthSec, d.length_sec) : d.length_sec;
    trace.step = "script check";
    const checks = recheck(d, lengthSec);
    if (action === "quote") return { credits: PRICES[lengthSec], lengthSec, ready: !checks.problems.length, problems: checks.problems };
    if (checks.problems.length) throw new ApiError("NOT_READY", checks.problems[0], { problems: checks.problems });
    const dryRun = body?.dryRun === true && who.tester;
    if (!RENDERER && !dryRun) throw new ApiError("RENDER_OFF", undefined, {}, "BLOCKY_WORLDS_RENDERER is not runpod, or RunPod / the callback secret is not configured");
    trace.step = "cap check";
    await guardFor(who.user.id, costBasisUsd(lengthSec), "video");
    trace.step = "price";
    const { data: price, error: pErr } = await admin.rpc("compute_tool_price", { p_tool_key: toolKey(lengthSec), p_input: {} });
    if (pErr || price == null) throw new ApiError("SERVER", "Couldn't load the price. Please try again.", {}, pErr?.message ?? "no price row");
    const credits = Number(price), endCard = endCardFor(who.plan, body?.removeWatermark === true);
    if (dryRun) return { dryRun: true, credits, endCard, lengthSec, renderer: Boolean(RENDERER), checks };
    trace.step = "job creation";
    const script = { title: d.title, lines: d.lines };
    const { data: run, error } = await admin.rpc("blocky_worlds_start_run", {
      p_user: who.user.id, p_draft: d.id, p_title: d.title, p_length: lengthSec, p_lines: d.lines, p_narration: narrationOf(script), p_post: d.post,
      p_narrator: NARRATOR, p_end_card: endCard, p_credits: credits, p_env: who.tester && !ENABLED ? "test" : "prod",
    });
    if (error || !run) {
      if (/INSUFFICIENT_CREDITS/.test(error?.message ?? "")) throw new ApiError("CREDITS", `You need ${credits} credits for this video.`, { credits });
      throw new ApiError("SERVER", "Couldn't start. Nothing was charged.", {}, error?.message ?? "no run returned");
    }
    const ideaLib = d.idea_id ? (await admin.from("blocky_worlds_ideas").select("library_id").eq("id", d.idea_id).maybeSingle()).data?.library_id ?? null : null;
    await admin.from("blocky_worlds_runs").update({ card: d.card ?? null, library_id: ideaLib }).eq("id", run.id);
    if (ideaLib) await countEvent(who.user.id, ideaLib, "generated", { draftId: d.id, runId: run.id });
    // the pipeline (docs/blocky-worlds-pipeline.md): the prepare job goes to RunPod now; a run that can't be sent is
    // failed and refunded by the runtime; anything else that goes wrong here is picked up by the sweeper within a minute
    trace.step = "dispatch";
    let started: any = null;
    try { started = await renderRuntime(admin).start(run.id); } catch (e: any) { console.error("[blocky-worlds-api] start dispatch:", run.id, e?.message ?? e); }
    return await runView({ ...run, ...(started ?? {}), library_id: ideaLib }, { owner: who.owner });
  }

  // ---------- 5. results ----------
  const who = await requireUser(req, trace);
  if (action === "list") {
    const { data } = await admin.from("blocky_worlds_runs").select("*").eq("user_id", who.user.id).is("deleted_at", null).order("created_at", { ascending: false }).limit(20);
    return { runs: await Promise.all((data ?? []).map((r: any) => runView(r, { owner: who.owner }))) };
  }
  const runId = String(body?.runId ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(runId)) throw new ApiError("BAD_INPUT");
  const { data: run } = await admin.from("blocky_worlds_runs").select("*").eq("id", runId).eq("user_id", who.user.id).is("deleted_at", null).maybeSingle();
  if (!run) throw new ApiError("NOT_FOUND", "We couldn't find that video.");
  if (action === "status") return await runView(run, { owner: who.owner });
  if (action === "event") {
    const kind = String(body?.kind ?? "");
    if (!["downloaded", "thumb_up", "thumb_down"].includes(kind)) throw new ApiError("BAD_INPUT");
    if (run.status !== "done") throw new ApiError("BAD_INPUT", "This video isn't ready yet.");
    const fresh = await countEvent(who.user.id, run.library_id, kind, { draftId: run.draft_id, runId: run.id });
    // a user's own idea (topic or pasted) that made a good video joins the library as "pending": anonymised (only the
    // idea card, no user data), and the AI judge decides on the next library tick whether anyone else sees it
    if (fresh && !run.library_id && (kind === "thumb_up" || kind === "downloaded") && run.card && !cardProblems(run.card).length) {
      const c = run.card;
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
