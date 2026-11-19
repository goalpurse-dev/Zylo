// Which example videos the new-user tutorial offers, by the survey's "What do you want to make?" answers. Pure, so it is
// tested in node (tests/exampleChoice.test.mjs). The list itself lives in src/data/onboardingExamples.js.
import { DEFAULT_EXAMPLES, EXAMPLE_CARDS, ONBOARDING_EXAMPLES } from "../data/onboardingExamples.js";

/** A usable entry: has a key, a title and a video. A broken line in the list is skipped, never shown. */
const usable = (e) => e && typeof e.key === "string" && e.key && typeof e.title === "string" && typeof e.video === "string" && e.video;

/**
 * The examples to show, best match first, `count` of them, no repeats. Matches the answers in the order given (the first
 * answer weighs most), then fills up with the defaults, then with the rest of the list.
 */
export function examplesFor(goals = [], { list = ONBOARDING_EXAMPLES, defaults = DEFAULT_EXAMPLES, count = EXAMPLE_CARDS } = {}) {
  const ok = list.filter(usable);
  const answers = (Array.isArray(goals) ? goals : []).filter((g) => typeof g === "string");
  // every usable example, best first
  const ranked = [];
  const add = (e) => { if (e && !ranked.includes(e)) ranked.push(e); };
  for (const g of answers) for (const e of ok) if (Array.isArray(e.goals) && e.goals.includes(g)) add(e);
  for (const key of defaults) add(ok.find((e) => e.key === key));
  for (const e of ok) add(e);
  // one card per kind of video first (an all-Town row hides that Zyvo makes other kinds too), then the next best
  const chosen = new Set();
  for (const e of ranked) if (chosen.size < count && ![...chosen].some((c) => c.niche === e.niche)) chosen.add(e);
  for (const e of ranked) if (chosen.size < count) chosen.add(e);
  return ranked.filter((e) => chosen.has(e));
}

/** One example by key, or the first default (the tutorial never ends up with nothing to show). */
export function exampleByKey(key, { list = ONBOARDING_EXAMPLES, defaults = DEFAULT_EXAMPLES } = {}) {
  const ok = list.filter(usable);
  return ok.find((e) => e.key === key) ?? ok.find((e) => e.key === defaults[0]) ?? ok[0] ?? null;
}
