// Cutaway Explainer (3D): topic suggestions, limited to what the parts kit can build. The first kit covers
// "yard + soil cut" topics (research/seamless-niche/BUILD_PLAN.md, M2): a dug pit or trench in the home world,
// layers, pipes, tanks, sheets, water, vehicles. `ready` marks topics already built end to end.
export const KIT_TOPICS = [
  { topic: "Landfill", hook: "dig a pit and throw your trash in", ready: true },
  { topic: "Septic tank", hook: "dig a hole behind the house and flush into it" },
  { topic: "Swimming pool", hook: "dig a hole in your yard and fill it with water" },
  { topic: "Water well", hook: "dig down until the hole fills with water" },
  { topic: "French drain", hook: "your yard turns into a swamp every time it rains" },
  { topic: "Road", hook: "scrape off the grass and drive on the dirt" },
  { topic: "Rain gutter", hook: "let the rain pour straight off your roof" },
  { topic: "Sewer pipe", hook: "run a pipe from your toilet to the street" },
];

const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();

/** Kit topics the user hasn't made yet, ready ones first. */
export function freshSuggestions(usedTopics = [], count = 6) {
  const used = new Set(usedTopics.map(norm));
  return KIT_TOPICS.filter((t) => !used.has(norm(t.topic))).slice(0, count);
}

export const isKitTopic = (topic) => KIT_TOPICS.some((t) => norm(t.topic) === norm(topic));
