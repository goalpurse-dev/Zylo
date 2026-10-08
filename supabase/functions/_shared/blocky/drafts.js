// Blocky Stories: three versions to choose from (decision 68). A DRAFT is one
// "write me three versions": the plans, then a script for each as it becomes
// ready, then the one the user picks. Only the picked one gets the editor's
// pass. This file is the pure part: turning a vetted plan into a plan for a
// cast, and what the page is shown of a draft. blocky-story-api does the rest.
import { revealRange } from "./twists.js";

/** A draft row's version as it is stored: {n, status: "writing"|"ready"|"failed", vetted, title, hook, plan, startedAt?, lines?, script?, error?} */

// A, B and C in a vetted plan's sentences are the characters. B and C always are; a capital A is the
// character when what follows makes it one ("A's badge", "A, floating", "A and B", "A holds"), and the word
// "a" at the start of a sentence otherwise ("A small key glows").
const SLOT_A = /\bA\b(?=(?:['’]s\b|\s*,|\s+(?:and|or|is|was|has|had|can|will|would|who|still)\b|\s+\w+s\b|\s*[.!?]?$))/g;
const SLOT_BC = /\b([BC])\b/g;
/** Puts the cast's names where a vetted plan says A, B or C. names: {A: "Vex", B: "Noob", C?: "Lux"} */
export function withNames(text, names) {
  return String(text ?? "").replace(SLOT_BC, (m, s) => names[s] ?? m).replace(SLOT_A, () => names.A ?? "A");
}

/**
 * A vetted plan (vettedPlans.js) as a twist plan for this cast and this length.
 * cast: the characters in slot order (A first). The clue stays in its scene; the payoff moves into the
 * scenes this length allows when the plan was written for another length.
 */
export function vettedToTwistPlan(vetted, cast, sceneCount) {
  const slots = Object.keys(vetted.slots ?? {});
  const names = Object.fromEntries(slots.map((s, i) => [s, cast[i]?.name ?? s]));
  const idOf = Object.fromEntries(slots.map((s, i) => [s, cast[i]?.id ?? null]));
  const say = (text) => withNames(text, names);
  const { min, max } = revealRange(sceneCount);
  return {
    vetted: true,
    title: vetted.title, hook: vetted.hook, premise: say(vetted.premise), seenAs: say(vetted.seenAs), emotion: vetted.emotion,
    roles: Object.fromEntries(slots.map((s) => [idOf[s], vetted.slots[s]]).filter(([id]) => id)),
    assumed: say(vetted.assumed), stakes: say(vetted.stakes), patternId: vetted.patternId, twist: say(vetted.twist), mechanic: vetted.mechanic,
    clue: say(vetted.clue), clueScene: Math.min(2, Math.max(1, vetted.clueScene)), payoff: say(vetted.payoff), revealScene: Math.min(max, Math.max(min, vetted.revealScene)),
    consequence: say(vetted.consequence), winnerId: idOf[vetted.winner], finalLine: vetted.finalLine,
  };
}

/** A version as the page gets it: the card, never the plan behind it. */
export function versionCard(v) {
  return {
    n: v.n, status: v.status, vetted: Boolean(v.vetted), title: v.title ?? "", hook: v.hook ?? "",
    lines: (v.lines ?? []).map((l) => ({ speakerId: l.speakerId, line: l.line })),
    lengthSec: v.lengthSec ?? null,
    ...(v.status === "failed" ? { error: "We couldn't write this version. Pick another one, or write three new ones." } : {}),
  };
}

/** A draft as the page gets it. left: how many more the user may start today. */
export function draftView(row, left = null) {
  return {
    id: row.id, status: row.status, picked: row.picked ?? null, storyId: row.story_id ?? null,
    versions: [...(row.versions ?? [])].sort((a, b) => a.n - b.n).map(versionCard),
    ...(left === null ? {} : { left }),
  };
}

/** A version that was started and neither finished nor failed within this long may be started again. */
export const VERSION_STALE_MS = 150_000;
/** Should this call write version n now? Not when it is done, and not while another call is still writing it. */
export function shouldWrite(version, now = Date.now()) {
  if (!version || version.status !== "writing") return false;
  return !version.startedAt || now - new Date(version.startedAt).getTime() > VERSION_STALE_MS;
}
