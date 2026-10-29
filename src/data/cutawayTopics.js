// Cutaway Explainer (3D): the premade topics, shown as chips under the topic box. The list itself and the
// "premade or custom" rule live with the server (supabase/functions/_shared/cutaway/topics.js), which decides the
// price from the topic text. `ready` marks topics with a saved layout (already built end to end).
import { classifyTopic, closestPremade, kitCheck, normTopic, premadeByKey, PREMADE } from "../../supabase/functions/_shared/cutaway/topics.js";

export { classifyTopic, closestPremade, kitCheck, premadeByKey };

export const KIT_TOPICS = PREMADE.map((p) => ({ key: p.key, topic: p.topic, hook: p.hook, ready: p.layout }));

/**
 * Premade topics the user hasn't made yet, in catalog order (the ones with a saved layout come first).
 * approved: only these keys (the owner-approved layouts the server reports); null = the whole catalog.
 */
export function freshSuggestions(usedTopics = [], count = 6, approved = null) {
  const used = new Set(usedTopics.map(normTopic)), only = approved == null ? null : new Set(approved);
  return KIT_TOPICS.filter((t) => !used.has(normTopic(t.topic)) && (!only || only.has(t.key))).slice(0, count);
}

export const isKitTopic = (topic) => classifyTopic(topic).kind === "premade";
