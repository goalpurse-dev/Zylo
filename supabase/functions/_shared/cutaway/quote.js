// Cutaway Explainer: the quote for a topic: premade or custom, the credits, and whether the kit can build it.
// The page shows it live (the price on Generate, "We can't build this one yet"); cutaway-api recomputes it from the
// topic text before charging and ignores anything the page sends about the price.
import { classifyTopic, kitCheck, premadeByKey } from "./topics.js";
import { videoCredits } from "./pricing.js";

/** The free part of the quote (no network). check.verdict "unsure" = the server asks Haiku (kitCheck.js). */
export function quoteTopic(topic, lengthSec) {
  const c = classifyTopic(topic);
  const check = c.kind === "premade" ? { verdict: "yes", missing: [], closest: [] } : kitCheck(topic);
  return { kind: c.kind, premade: c.premade, premadeTopic: premadeByKey(c.premade)?.topic ?? null, credits: videoCredits(c.kind, lengthSec), check };
}

/** The 2-3 closest premade topics as their display names (for "We can't build this one yet"). */
export const closestNames = (keys) => keys.map((k) => premadeByKey(k)?.topic).filter(Boolean);
