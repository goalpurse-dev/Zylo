// Blocky Worlds, LOCAL DEV ONLY (?mock=1): the blocky-worlds-api actions in the browser, from the same mock steps the
// server's mock mode uses (no network, no cost). Imported lazily only when import.meta.env.DEV, so a production build
// never contains it. A finished test run plays one of the page clips. ?as=guest|free|starter|pro   who is looking;   &renderer=1   pretend the renderer is on.
// Simulations: &blocked=1 (or a topic with "blocked" in it): the script comes back blocked by a real check (the climax
// never uses the planted object), with Fix it; &fail=1 (or a topic with "fail" in it): every video fails after ~6 s with
// a hiccup on our side (&fail=story: the builder couldn't show the story); the credits come back.
// &queue=N: every video first waits in line as #N (all video machines busy), moving up one place every 8 s, with a
// "starts in about X minutes" ETA (90 s a place); &eta=late: the ETA has already passed ("Almost there"). Then the normal flow.
import { LENGTHS, DEFAULT_LENGTH, NARRATOR } from "../../../../../supabase/functions/_shared/blockyWorlds/config.js";
import { MOODS } from "../../../../../supabase/functions/_shared/blockyWorlds/formulas.js";
import { cardOf, IDEAS_PER_BATCH } from "../../../../../supabase/functions/_shared/blockyWorlds/ideas.js";
import { PRICES } from "../../../../../supabase/functions/_shared/blockyWorlds/pricing.js";
import { checkScript, narrationOf, normalizeScript, PART_IDS, scriptFromText } from "../../../../../supabase/functions/_shared/blockyWorlds/script.js";
import { cardFromScript, fixPart, scriptProtocolCheck, writeBeats, writeIdeas, writeScript } from "../../../../../supabase/functions/_shared/blockyWorlds/llm.js";
import { EXAMPLE_IDEAS } from "../../../../../supabase/functions/_shared/blockyWorlds/examples.js";
import { problemSpots } from "../../../../../supabase/functions/_shared/blockyWorlds/protocol.js";
import { failReason } from "../../../../../supabase/functions/_shared/blockyWorlds/contract.js";
import { errorFromReply } from "../api/blockyWorldsApi";
import { canFilm, fittingOnly } from "../../../../../supabase/functions/_shared/blockyWorlds/boardFit.js";
// the judged library's live ideas (scripts/blockyWorlds/devFixture.mjs), so localhost shows the real, varied ideas
import LIBRARY from "./libraryFixture.json";

const Q = new URLSearchParams(window.location.search);
// the renderer is pretended ON by default so the whole flow can be clicked through (?renderer=0 shows the "off" state)
const AS = Q.get("as") ?? "starter", RENDERER = Q.get("renderer") !== "0";
const BLOCKED = Q.get("blocked") === "1", FAIL = Q.get("fail");
const QUEUE = Math.max(0, Math.min(9, Number(Q.get("queue")) || 0)), LATE = Q.get("eta") === "late";
// the board-only launch mode (the server's BLOCKY_WORLDS_LAUNCH=board), on by default here so localhost shows what launch
// customers see: only library ideas the board kit can film, "What we can film", "Move it to our town". &launch=off: as before
const LAUNCH = Q.get("launch") !== "off";
const PLACE_S = 8, PLACE_ETA = 90;
// the mock script is the example script, whose planted object is this card's (Grandpa's whistle): the real checks run on it
const PROTO = EXAMPLE_IDEAS[0];
const mentions = (row, word) => JSON.stringify(row ?? {}).toLowerCase().includes(word);
const PAID = ["starter", "pro", "generative"].includes(AS);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const id = () => crypto.randomUUID();
const state = { ideas: new Map(), drafts: new Map(), runs: [], seed: 0, served: new Set() };

/** The next library ideas this visitor hasn't seen, best first with a little shuffle (like the server's pickForUser). */
function libraryBatch(mood) {
  const fresh = (LAUNCH ? fittingOnly(LIBRARY) : LIBRARY).filter((r) => !state.served.has(r.id) && (!mood || r.idea.mood === mood));
  const picked = fresh.map((r, i) => ({ r, k: i + Math.random() * 12 })).sort((a, b) => a.k - b.k).slice(0, IDEAS_PER_BATCH).map((x) => x.r);
  picked.forEach((r) => state.served.add(r.id));
  return picked.map((r) => r.idea);
}
/** "Your topic" in test mode: three worlds built around the words typed (no writer call), on library ideas' bones. */
function topicIdeasFor(topic, mood) {
  const t = String(topic).trim().toLowerCase(), T = t.replace(/^./, (c) => c.toUpperCase());
  const rules = [
    [`In this town, ${t} is in charge, and everybody obeys.`, `${T} Is in Charge`, `Everybody obeyed. Except me.`],
    [`In this town, if you say "${t}" out loud, it shows up at your door that night.`, `Never Say ${T}`, `I said it in my sleep.`],
    [`In this town, every night ${t} gets one wish, and the whole street pays for it.`, `${T}'s Wish`, `Then it wished for me.`],
  ];
  const bones = LIBRARY.filter((r) => !mood || r.idea.mood === mood);
  return rules.map(([opener, title, teaser], i) => ({ ...bones[(state.seed * 3 + i) % bones.length].idea, opener, title, teaser }));
}
const fail = (code, error, extra = {}) => { throw errorFromReply({ code, error, ...extra }); };

const draftView = (d) => ({ id: d.id, source: d.source, ideaId: d.ideaId, title: d.title, lengthSec: d.lengthSec, lines: d.lines, post: d.post, credits: PRICES[d.lengthSec], check: d.check, ready: !d.check.problems.length, updatedAt: d.updatedAt, writesLeft: 14, ...(d.notice ? { notice: d.notice } : {}) });
const runView = (r) => {
  const waited = (Date.now() - r.startedAt) / 1000, lineS = r.queue * PLACE_S;
  // the line (&queue=N): queued with a place and an ETA; the run's own clock starts when its turn comes
  if (waited < lineS) {
    const pos = r.queue - Math.floor(waited / PLACE_S);
    return { id: r.id, draftId: r.draftId, title: r.title, lengthSec: r.lengthSec, credits: r.credits, createdAt: new Date(r.startedAt).toISOString(), doneAt: null, status: "queued", stepAt: r.startedAt, pct: 0, post: null, finalUrl: null, downloadUrl: null, poster: null, error: null, refunded: false, queuePosition: pos, etaSec: LATE ? 0 : Math.round(((lineS - waited) / PLACE_S) * PLACE_ETA), doneEtaSec: Math.round(((lineS - waited) / PLACE_S) * PLACE_ETA + 230), etaAt: Date.now() };
  }
  const t = waited - lineS;
  if (r.failCode && t >= 6) {
    const { kind, text } = failReason(r.failCode);
    return { id: r.id, draftId: r.draftId, title: r.title, lengthSec: r.lengthSec, credits: r.credits, createdAt: new Date(r.startedAt).toISOString(), doneAt: new Date(r.startedAt + 6000).toISOString(), status: "failed", stepAt: r.startedAt, pct: 0, post: null, finalUrl: null, downloadUrl: null, poster: null, error: "We couldn't make this video. It's not your fault, and your credits are back.", reason: text, failKind: kind, refunded: true };
  }
  const status = t < 3 ? "queued" : t < 7 ? "voice" : t < 12 ? "plan" : t < 22 ? "render" : "done";
  return { id: r.id, draftId: r.draftId, title: r.title, lengthSec: r.lengthSec, credits: r.credits, createdAt: new Date(r.startedAt).toISOString(), doneAt: status === "done" ? new Date(r.startedAt + 22000).toISOString() : null, status, stepAt: r.startedAt, queuePosition: null, etaSec: null, doneEtaSec: status === "done" ? null : Math.max(0, Math.round((22 - t) * 10)), etaAt: Date.now(), pct: status === "render" ? Math.round(((t - 12) / 10) * 100) : status === "done" ? 100 : 0, post: status === "done" ? r.post : null, finalUrl: status === "done" ? "/blocky-worlds/clips/street.mp4" : null, downloadUrl: status === "done" ? "/blocky-worlds/clips/street.mp4" : null, poster: status === "done" ? "/blocky-worlds/clips/street.jpg" : null, error: null, refunded: false };
};

export async function devCall(action, body) {
  await wait(action === "writeScript" || action === "rewrite" ? 900 : 350);
  if (action === "access") return { enabled: false, signedIn: AS !== "guest", plan: AS === "guest" ? null : AS, owner: AS === "owner", tester: true, visible: true, canWrite: PAID, canGenerate: PAID && RENDERER, canRemoveWatermark: AS === "pro" || AS === "generative", mock: true, renderer: RENDERER, lengths: LENGTHS, defaultLength: DEFAULT_LENGTH, prices: PRICES, narrator: { name: NARRATOR.voiceName }, moods: Object.entries(MOODS).map(([k, m]) => ({ id: k, label: m.label })), ideaBatchesLeft: PAID ? 20 : 3, launch: LAUNCH ? "board" : "off", film: LAUNCH ? canFilm() : null };
  if (AS === "guest") fail("SIGN_IN");
  if (action === "ideas" || action === "topicIdeas") {
    // the library first (like the server); once a mood's library is used up, the mock writer, as the live writer would
    const fromLib = action === "ideas" ? libraryBatch(body.mood ?? null) : [];
    const fromLibrary = fromLib.length >= IDEAS_PER_BATCH;
    const ideas = action === "topicIdeas" ? topicIdeasFor(body.topic, body.mood ?? null)
      : fromLibrary ? fromLib : (await writeIdeas({ provider: "mock", seed: ++state.seed, mood: body.mood ?? null })).ideas;
    state.seed++;
    const cards = ideas.slice(0, action === "ideas" ? IDEAS_PER_BATCH : 3).map((idea) => { const k = id(); state.ideas.set(k, { idea, source: action === "ideas" ? "library" : "topic" }); return cardOf(idea, k); });
    return { ideas: cards, batchesLeft: null, fromLibrary };
  }
  if (!PAID) fail("UPGRADE");
  if (action === "writeScript" || action === "rewrite") {
    const prev = action === "rewrite" ? state.drafts.get(body.draftId) : null;
    const row = prev ? { idea: prev.card } : state.ideas.get(body.ideaId);
    if (!row) fail("NOT_FOUND", "We couldn't find that idea. Get new ideas and pick one.");
    const lengthSec = Number(body.lengthSec ?? prev?.lengthSec ?? DEFAULT_LENGTH);
    const beats = (await writeBeats({ provider: "mock", card: row.idea, lengthSec })).beats;
    const w = await writeScript({ provider: "mock", idea: row.idea, lengthSec, beats });
    const d = { id: prev?.id ?? id(), source: row.source === "topic" ? "topic" : "idea", ideaId: body.ideaId ?? prev?.ideaId, card: row.idea, title: w.script.title, lengthSec, lines: w.script.lines, post: w.script.post, check: { ...w.check, kind: "written" }, updatedAt: new Date().toISOString(), blocked: prev?.blocked ?? (BLOCKED || mentions(row, "blocked")), failing: prev ? null : (FAIL ? (FAIL === "story" ? "PRODUCTION_CHECK" : "CHUNK_FAILED") : mentions(row, "fail") ? "CHUNK_FAILED" : null) };
    if (d.blocked) {
      // the simulated block: a first write whose climax never uses the planted object; checked by the real checks
      const lastMe = d.lines.findLastIndex((l) => l.part === "me");
      d.lines = d.lines.map((l, i) => (i === lastMe ? { ...l, text: "And in my pocket, I keep Grandpa's old brass whistle." } : !prev && l.part === "climax" && /whistle/i.test(l.text) ? { ...l, text: "Then I did the only thing I could." } : l));
      d.check = { ...scriptProtocolCheck({ title: d.title, lines: d.lines, post: d.post }, lengthSec, PROTO), kind: "written" };
      d.notice = d.check.problems.length ? `It still needs one fix: ${d.check.problems[0]}` : null;
    }
    state.drafts.set(d.id, d);
    return draftView(d);
  }
  if (action === "fixPart") {
    const d = state.drafts.get(body.draftId);
    if (!d) fail("NOT_FOUND", "We couldn't find that script.");
    const card = d.blocked ? PROTO : null;
    const before = d.blocked ? scriptProtocolCheck(d, d.lengthSec, card) : checkScript(d, d.lengthSec, d.check.kind);
    const spots = problemSpots(d, before.problems).filter((x) => x.fix === "part" && x.part === body.part);
    if (!spots.length) return { ...draftView(d), fixed: !before.problems.length };
    const r = await fixPart({ provider: "mock", script: { title: d.title, lines: d.lines, post: d.post }, indexes: spots.flatMap((x) => x.lines), reasons: spots.map((x) => x.problem), card, lengthSec: d.lengthSec, kind: d.check.kind });
    if (r.check.problems.length >= before.problems.length) fail("WRITER", "We couldn't fix that part this time. Try Fix it once more, or edit those lines yourself.");
    Object.assign(d, { lines: r.script.lines, check: { ...r.check, kind: d.check.kind }, updatedAt: new Date().toISOString(), notice: r.check.problems.length ? `It still needs one fix: ${r.check.problems[0]}` : null });
    return { ...draftView(d), fixed: r.fixed };
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
    // one video at a time per script (like the server): a double-tapped Try again never charges twice
    const active = state.runs.find((x) => x.draftId === d.id && ["queued", "voice", "plan", "render"].includes(runView(x).status));
    if (active) fail("LIMIT", "This script is already being made. Wait for it to finish.", { runId: active.id });
    const r = { id: id(), draftId: d.id, title: d.title, lengthSec: d.lengthSec, credits: PRICES[d.lengthSec], post: d.post, narration: narrationOf(d), startedAt: Date.now(), failCode: d.failing ?? null, queue: QUEUE };
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
