// The templates this engine serves. One engine (stories, scenes, charges,
// jobs, clips, final video), one niche per template for everything a viewer
// would tell apart: the look, the wording of every prompt, the library, the
// ideas, the price rows.
//
// AI Fruit Story is the engine's built-in wording: its niche overrides
// nothing, so its prompts are exactly what each builder has always written
// (tests/fruitPromptSnapshot.test.mjs pins them byte for byte). Another niche
// supplies only what differs; each builder documents the hooks it reads.
//
// A row's niche is its `niche` column. Rows from before that column, and
// requests from browsers that don't send one, are fruit.
import { FRUIT } from "./fruit.js";
import { BLOCKY } from "./blocky.js";

export const NICHES = Object.freeze({ fruit: FRUIT, blocky: BLOCKY });
export const DEFAULT_NICHE = "fruit";

/** The niche of a story/series/character row, a niche id, or a niche itself. Unknown or missing = fruit. */
export function nicheOf(x) {
  if (x && typeof x === "object" && x.id && NICHES[x.id] === x) return x;
  const id = typeof x === "string" ? x : x?.niche;
  return (typeof id === "string" && Object.hasOwn(NICHES, id) ? NICHES[id] : null) ?? FRUIT;
}

/** A niche id sent by the browser: missing = fruit, anything unknown = null (the caller refuses it). */
export function nicheIdFrom(value) {
  if (value == null || value === "") return DEFAULT_NICHE;
  return typeof value === "string" && Object.hasOwn(NICHES, value) ? value : null;
}

/**
 * A niche's own hooks for one builder ("picture", "clip", "writer", "series",
 * "review", "check", "upload", "plate", "cast"). Fruit has none: null means
 * "use the builder's built-in wording". Any other niche without them is not
 * ready for that step, and must never fall back to Fruit's wording by accident.
 */
export function hooksOf(x, part) {
  const n = nicheOf(x);
  if (n[part] || n.id === DEFAULT_NICHE) return n[part] ?? null;
  throw new Error(`${n.name} has no ${part} rules yet`);
}

/** Does this niche have its own rules for a builder? (Fruit never does: it is the built-in wording.) */
export const hasHooks = (x, part) => Boolean(nicheOf(x)[part]);

/** The price row a step charges under: the niche's own, else the engine's (Fruit's). kind: "image" | "v2" | "v3" | "v4" */
export const toolKeyOf = (x, kind, fallback) => nicheOf(x).toolKeys?.[kind] ?? fallback;
