// Cutaway Explainer: topic suggestions for the left panel, best first
// (research/seamless-niche/CREATOR_PLAYBOOK.md section 4: structural or outdoor
// topics with a soil cut and a strong surprise do best). The planner fact-checks
// every surprise; these are starting points, not facts it must use.
export const TOPIC_SUGGESTIONS = [
  { topic: "Dam", hook: "pile dirt across a river" },
  { topic: "Skyscraper", hook: "stack floors on top of each other" },
  { topic: "Sewage treatment plant", hook: "run every pipe in town to one pond" },
  { topic: "Tunnel under a river", hook: "dig under the river" },
  { topic: "Electricity to your outlet", hook: "run a wire from a spinning magnet to your house" },
  { topic: "Landfill", hook: "dig a pit and throw your trash in" },
  { topic: "Ice rink", hook: "flood a floor in winter" },
  { topic: "Fire sprinklers", hook: "hang a hose from the ceiling" },
  { topic: "Elevator", hook: "pull a box up with a rope" },
  { topic: "Suspension bridge", hook: "lay a log over a river" },
  { topic: "House foundation", hook: "set the house on the dirt" },
  { topic: "Lightning rod", hook: "stick a metal pole on the roof" },
  { topic: "Car engine", hook: "light fuel in a can" },
  { topic: "Nuclear power plant", hook: "boil water with hot rocks" },
  { topic: "Airplane toilet", hook: "put your toilet in a plane" },
  { topic: "Car brakes", hook: "press a stick against the wheel" },
  { topic: "Revolving door", hook: "cut a hole in a skyscraper wall" },
  { topic: "Lighthouse", hook: "light a fire on a cliff" },
  { topic: "Smoke detector", hook: "put a person on night watch" },
  { topic: "Microwave oven", hook: "put food next to a radio tower" },
];

const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();

/** Suggestions the user hasn't made yet (by topic name), best first. */
export function freshSuggestions(usedTopics = [], count = 6) {
  const used = new Set(usedTopics.map(norm));
  return TOPIC_SUGGESTIONS.filter((t) => !used.has(norm(t.topic))).slice(0, count);
}
