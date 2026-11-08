// Blocky Worlds: the hybrid writer in the app (owner, 2026-11-08: "Production writer: use the Opus-plan + Sonnet-lines
// setup at low effort"). Pure: the app's settings for it and how a hybrid result is saved (draft row parts, the run's
// card, the per-call cost log). blocky-worlds-api/index.ts makes the calls (llm.js writeHybrid / rewriteHybrid).
//
// Which scripts: a typed topic ("Your topic": the idea row's source "topic") on "Write", and "Rewrite" of a draft the
// hybrid wrote (the saved plan, Sonnet only). Library ideas and the user's own scripts keep the beats -> script path.
// The switch: BLOCKY_WORLDS_HYBRID=off falls back to the old path (default on).
import { partLines } from "./script.js";

export const APP_HYBRID = Object.freeze({
  // what the emergency cap check counts one write as (the 2026-11-08 run: $0.10-0.13 a script, $0.22 with a medium-effort
  // plan and a fix); the guard refuses when the 24 h spend plus this would pass the cap
  guardUsd: 0.25,
  // a hard cap per write: no call is sent whose worst case (every output token) could take this write over it. The worst
  // case of a full write is ~$0.45 (plan 9k + lines 8k + fix 6k + judge 2.5k output tokens), so a normal write never hits it
  capUsd: 0.6,
  // the judge scores the script as feedback (saved on the draft); it never blocks and never triggers a rewrite
  judge: true,
});

/** The draft's card: the plan's card (with the user's topic) plus what a rewrite and the re-checks need. */
export function hybridCard(result, recipe) {
  return { ...result.card, hybrid: { plan: result.plan, recipe: recipe?.id ?? null, refs: (result.references ?? []).map((r) => r.id) } };
}

/** The plan's beats in the beat-sheet shape the drafts keep (part, summary, shows, words, uses). */
export function hybridBeats(plan, lengthSec) {
  const words = Object.fromEntries(partLines(lengthSec).map((b) => [b.id, b.words]));
  return (plan?.beats ?? []).map((b) => ({ part: b.part, summary: String(b.intent ?? ""), shows: String(b.shows ?? ""), words: words[b.part] ?? 0, uses: [] }));
}

/**
 * The draft's checks: the hard checks are its problems (they block a video), the advisory notes its warnings; kind
 * "hybrid" (the app re-checks it the same way); the judge's feedback; the writer's calls (model, USD and tokens each).
 */
export function hybridChecksRow(result, { flow = "hybrid", previous = null } = {}) {
  const c = result.checks ?? { hard: [], advisory: [], words: 0, seconds: 0 };
  return {
    problems: c.hard, warnings: c.advisory, words: c.words, seconds: c.seconds, kind: "hybrid",
    feedback: result.feedback ?? previous?.feedback ?? null,
    writer: { flow, calls: result.calls ?? {}, costUsd: result.costUsd ?? 0, firstHard: result.firstHard ?? [], fixed: result.fixed ?? null, trimmed: (result.trimmed ?? []).length, stopped: result.stopped ?? null, planNotes: result.planNotes ?? [] },
  };
}

/** The card a run carries to the renderer: the plan stays with the draft (the renderer reads the card fields only). */
export function runCard(card) {
  if (!card) return null;
  const { hybrid: _hybrid, ...c } = card;
  return c;
}

/** A card as it joins the library: no user topic, no plan. */
export function stripForLibrary(card) {
  const { topic: _topic, hybrid: _hybrid, ...c } = card ?? {};
  return c;
}

/**
 * One log line per paid call of a write, for the function logs (the cost ledger blocky_worlds_ai_calls keeps one row per
 * write with its total, which the daily script limit counts). usage: { input, cacheRead, cacheWrite, output }.
 */
export function callLogLines({ userId, draftId = null, action, calls }) {
  return Object.entries(calls ?? {}).filter(([, c]) => c).map(([step, c]) => ({
    tag: "blocky-worlds writer call", userId, draftId, action, step, model: c.model, usd: c.usd,
    input: c.usage?.input ?? 0, cacheRead: c.usage?.cacheRead ?? 0, cacheWrite: c.usage?.cacheWrite ?? 0, output: c.usage?.output ?? 0,
  }));
}
