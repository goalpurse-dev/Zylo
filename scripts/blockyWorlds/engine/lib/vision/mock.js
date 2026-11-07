// Blocky Worlds shot review: the FREE stand-in judge (no network, no cost, deterministic), for tests, dry runs and
// BLOCKY_WORLDS_REVIEW=mock. It cannot see pictures: it "sees" the planned shots each item carries (item.plan) and
// judges them against the story's requirements the way the paid judge is asked to (who in focus, the things on screen,
// the story's place and time, a pose for an action, a face for a feeling). It is NOT evidence of what renders; only the
// paid judge on real stills is.
//   mockJudge({ see, costUsd, delayMs, fail }) -> { name, model, judge(batch), worstCase(batch) }
//   see(item) -> a raw verdict (judge.js schema) overrides the planned-shot reading
import { verdictsOf } from "./judge.js";

const GENERIC = new Set(["street", "school", "bedroom", "woods"]);
const words = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);

/** what the planned shots show, as words */
function shownWords(shots) {
  const w = new Set();
  for (const s of shots) {
    for (const o of s.objects ?? []) [o.name, ...(o.aliases ?? [])].forEach((x) => words(String(x).replace(/_/g, " ")).forEach((y) => w.add(y)));
    for (const c of s.crowds ?? []) [c.kind, ...(c.aliases ?? [])].forEach((x) => words(x).forEach((y) => w.add(y)));
    for (const g of s.giants ?? []) [g.id, ...(g.aliases ?? [])].forEach((x) => words(x).forEach((y) => w.add(y)));
    for (const a of s.actors ?? []) if (a.hold) words(a.hold).forEach((y) => w.add(y));
    for (const x of s.worldAliases ?? []) words(x).forEach((y) => w.add(y));
    if (s.insert?.text) words(s.insert.text).forEach((y) => w.add(y));
  }
  return w;
}
const sing = (x) => x.replace(/(es|s)$/, "");

export function plannedSight(item) {
  const shots = item.plan ?? [];
  const real = shots.filter((s) => s.camera !== "insert");
  const shown = shownWords(shots);
  const who = item.who?.id ?? null;
  const castWho = who && item.castIds?.includes(who);
  const whoOk = !who || !castWho || real.some((s) => s.focus === who && (s.actors ?? []).some((a) => a.id === who));
  const missing = (item.nouns ?? []).filter((n) => { const ws = words(n); const last = ws.at(-1) ?? ""; return !(shown.has(last) || shown.has(sing(last)) || [...shown].some((x) => sing(x) === sing(last))); });
  const placeOk = !item.place || !/turtle|creature|inside|whale|elephant/i.test(item.place) || real.every((s) => !GENERIC.has(s.set));
  const timeOk = !item.light || real.every((s) => s.light === item.light);
  const actors = real.flatMap((s) => s.actors ?? []);
  const actionOk = !item.moving || actors.some((a) => a.pose && !["stand", "talk"].includes(a.pose)) || real.some((s) => (s.crowds ?? []).some((c) => c.action && c.action !== "stand") || (s.giants ?? []).some((g) => g.action && g.action !== "idle"));
  const emotionOk = !item.emotion || !castWho || actors.some((a) => a.id === who && a.expr && a.expr !== "neutral");
  const card = shots.some((s) => s.insert?.kind === "card") && !real.length;
  const worldOk = worldMatches(item, real);
  const fails = [!whoOk, missing.length, !placeOk, !timeOk, !actionOk, !emotionOk, card, !worldOk].filter(Boolean).length;
  return {
    line: item.line, shows: `(mock) ${real.length} shots: ${real.map((s) => `${s.set}/${s.light} focus ${s.focus}`).join("; ")}`,
    who_ok: whoOk, missing, action_ok: actionOk, static: !actionOk, place_ok: placeOk, time_ok: timeOk, emotion_ok: emotionOk, world_ok: worldOk, card,
    verdict: fails === 0 ? "match" : !whoOk && !placeOk ? "miss" : "partial", types: [], bad_shots: [], fix: "(mock)",
  };
}

/** WORLD CONTINUITY, as planned: every shot in a bible set, every actor in the bible's look (item.bible = tl.world) */
export function worldMatches(item, real) {
  const B = item.bible;
  if (!B) return true;
  const sets = new Set(B.sets ?? []);
  return real.every((s) => (sets.has(s.set) || /^world:/.test(s.set ?? "")) && (s.actors ?? []).every((a) => {
    const c = item.cast?.[a.id];
    if (!c) return true;
    const b = B.cast?.[c.bibleId];
    return !!b && c.seed === b.seed && (!c.look || JSON.stringify(c.look) === JSON.stringify(b.look));
  }));
}

export function mockJudge({ see = null, costUsd = 0, delayMs = 0, fail = 0, model = "mock" } = {}) {
  let fails = fail;
  return {
    name: "mock", model,
    async judge(batch) {
      if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
      if (fails > 0) { fails--; throw Object.assign(new Error("mock judge failure"), { costUsd: 0 }); }
      const data = { lines: batch.map((it) => see?.(it) ?? plannedSight(it)) };
      return { data, costUsd, ms: delayMs, usage: null, model, lines: verdictsOf(data, batch) };
    },
    worstCase: () => costUsd,
  };
}
