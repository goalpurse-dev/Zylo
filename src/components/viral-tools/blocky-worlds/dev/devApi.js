// Blocky Worlds, LOCAL DEV ONLY (?mock=1): the blocky-worlds-api actions in the browser, from the same mock steps the
// server's mock mode uses (no network, no cost). Imported lazily only when import.meta.env.DEV, so a production build
// never contains it. ?as=guest|free|starter|pro   who is looking;   &renderer=1   pretend the renderer is on.
import { LENGTHS, DEFAULT_LENGTH, NARRATOR } from "../../../../../supabase/functions/_shared/blockyWorlds/config.js";
import { MOODS } from "../../../../../supabase/functions/_shared/blockyWorlds/formulas.js";
import { cardOf, IDEAS_PER_BATCH } from "../../../../../supabase/functions/_shared/blockyWorlds/ideas.js";
import { PRICES } from "../../../../../supabase/functions/_shared/blockyWorlds/pricing.js";
import { checkScript, narrationOf, normalizeScript, PART_IDS, scriptFromText } from "../../../../../supabase/functions/_shared/blockyWorlds/script.js";
import { cardFromScript, writeBeats, writeIdeas, writeScript, writeTopicIdeas } from "../../../../../supabase/functions/_shared/blockyWorlds/llm.js";
import { errorFromReply } from "../api/blockyWorldsApi";

const Q = new URLSearchParams(window.location.search);
// the renderer is pretended ON by default so the whole flow can be clicked through (?renderer=0 shows the "off" state)
const AS = Q.get("as") ?? "starter", RENDERER = Q.get("renderer") !== "0";
const PAID = ["starter", "pro", "generative"].includes(AS);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const id = () => crypto.randomUUID();
const state = { ideas: new Map(), drafts: new Map(), runs: [], seed: 0 };
const fail = (code, error, extra = {}) => { throw errorFromReply({ code, error, ...extra }); };

const draftView = (d) => ({ id: d.id, source: d.source, ideaId: d.ideaId, title: d.title, lengthSec: d.lengthSec, lines: d.lines, post: d.post, credits: PRICES[d.lengthSec], check: d.check, ready: !d.check.problems.length, updatedAt: d.updatedAt, writesLeft: 14 });
const runView = (r) => {
  const t = (Date.now() - r.startedAt) / 1000;
  const status = t < 3 ? "queued" : t < 7 ? "voice" : t < 12 ? "plan" : t < 22 ? "render" : "done";
  return { id: r.id, draftId: r.draftId, title: r.title, lengthSec: r.lengthSec, credits: r.credits, createdAt: new Date(r.startedAt).toISOString(), doneAt: status === "done" ? new Date(r.startedAt + 22000).toISOString() : null, status, stepAt: r.startedAt, pct: status === "render" ? Math.round(((t - 12) / 10) * 100) : status === "done" ? 100 : 0, post: status === "done" ? r.post : null, finalUrl: null, downloadUrl: null, poster: status === "done" ? "/blocky-worlds/hero.jpg" : null, error: null, refunded: false };
};

export async function devCall(action, body) {
  await wait(action === "writeScript" || action === "rewrite" ? 900 : 350);
  if (action === "access") return { enabled: false, signedIn: AS !== "guest", plan: AS === "guest" ? null : AS, owner: AS === "owner", tester: true, visible: true, canWrite: PAID, canGenerate: PAID && RENDERER, canRemoveWatermark: AS === "pro" || AS === "generative", mock: true, renderer: RENDERER, lengths: LENGTHS, defaultLength: DEFAULT_LENGTH, prices: PRICES, narrator: { name: NARRATOR.voiceName }, moods: Object.entries(MOODS).map(([k, m]) => ({ id: k, label: m.label })), ideaBatchesLeft: PAID ? 20 : 3 };
  if (AS === "guest") fail("SIGN_IN");
  if (action === "ideas" || action === "topicIdeas") {
    const r = action === "ideas" ? await writeIdeas({ provider: "mock", seed: state.seed++, mood: body.mood ?? null }) : await writeTopicIdeas({ provider: "mock", topic: body.topic, mood: body.mood ?? null, seed: state.seed++ });
    const cards = r.ideas.slice(0, action === "ideas" ? IDEAS_PER_BATCH : 3).map((idea) => { const k = id(); state.ideas.set(k, { idea, source: action === "ideas" ? "library" : "topic" }); return cardOf(idea, k); });
    return { ideas: cards, batchesLeft: null, fromLibrary: action === "ideas" };
  }
  if (!PAID) fail("UPGRADE");
  if (action === "writeScript" || action === "rewrite") {
    const prev = action === "rewrite" ? state.drafts.get(body.draftId) : null;
    const row = prev ? { idea: prev.card } : state.ideas.get(body.ideaId);
    if (!row) fail("NOT_FOUND", "We couldn't find that idea. Get new ideas and pick one.");
    const lengthSec = Number(body.lengthSec ?? prev?.lengthSec ?? DEFAULT_LENGTH);
    const beats = (await writeBeats({ provider: "mock", card: row.idea, lengthSec })).beats;
    const w = await writeScript({ provider: "mock", idea: row.idea, lengthSec, beats });
    const d = { id: prev?.id ?? id(), source: row.source === "topic" ? "topic" : "idea", ideaId: body.ideaId ?? prev?.ideaId, card: row.idea, title: w.script.title, lengthSec, lines: w.script.lines, post: w.script.post, check: { ...w.check, kind: "written" }, updatedAt: new Date().toISOString() };
    state.drafts.set(d.id, d);
    return draftView(d);
  }
  if (action === "saveScript") {
    const prev = body.draftId ? state.drafts.get(body.draftId) : null;
    const lengthSec = Number(body.lengthSec ?? DEFAULT_LENGTH);
    const script = Array.isArray(body.lines) ? normalizeScript({ title: body.title ?? prev?.title ?? "", lines: body.lines.map((l) => ({ part: PART_IDS.includes(l.part) ? l.part : "own", text: l.text })), post: prev?.post ?? {} }) : scriptFromText(body.text ?? "", body.title ?? "");
    if (!script.lines.length) fail("BAD_INPUT", "Write or paste a script first.");
    const check = { ...checkScript(script, lengthSec, "own"), kind: "own" };
    const card = prev?.card ?? (await cardFromScript({ provider: "mock", lines: script.lines })).card;
    const d = { id: prev?.id ?? id(), source: prev?.source ?? "own", ideaId: prev?.ideaId ?? null, card, title: script.title || script.lines[0].text.slice(0, 60), lengthSec, lines: script.lines, post: { ...script.post, title: script.post.title || script.lines[0].text.slice(0, 70) }, check, updatedAt: new Date().toISOString() };
    state.drafts.set(d.id, d);
    return draftView(d);
  }
  if (action === "fixOpener") {
    const d = state.drafts.get(body.draftId);
    d.lines[0] = { ...d.lines[0], text: `In this town, ${d.lines[0].text.replace(/^in (this|my) \w+,?\s*/i, "").replace(/^./, (c) => c.toLowerCase())}` };
    d.check = { ...checkScript({ title: d.title, lines: d.lines, post: d.post }, d.lengthSec, d.check.kind), kind: d.check.kind };
    return draftView(d);
  }
  if (action === "quote") {
    const d = state.drafts.get(body.draftId), lengthSec = Number(body.lengthSec ?? d.lengthSec);
    const c = checkScript({ title: d.title, lines: d.lines, post: d.post }, lengthSec, d.check.kind);
    return { credits: PRICES[lengthSec], lengthSec, ready: !c.problems.length, problems: c.problems };
  }
  if (action === "start") {
    const d = state.drafts.get(body.draftId);
    if (d.check.problems.length) fail("NOT_READY", d.check.problems[0], { problems: d.check.problems });
    if (!RENDERER) fail("RENDER_OFF");
    const r = { id: id(), draftId: d.id, title: d.title, lengthSec: d.lengthSec, credits: PRICES[d.lengthSec], post: d.post, narration: narrationOf(d), startedAt: Date.now() };
    state.runs.unshift(r);
    return runView(r);
  }
  if (action === "list") return { runs: state.runs.map(runView) };
  if (action === "status") return runView(state.runs.find((r) => r.id === body.runId));
  if (action === "event") return { ok: true };
  if (action === "remove") { state.runs = state.runs.filter((r) => r.id !== body.runId); return { ok: true }; }
  if (action === "drafts") return { drafts: [...state.drafts.values()].map(draftView), writesLeft: 14 };
  return fail("BAD_INPUT", "Unknown action.");
}
