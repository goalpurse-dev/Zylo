// IN THIS TOWN: THE RULES (owner 2026-11-22, round 4: "simplify the rules"). Before this there were about 60 rules
// spread over the writer, the plan, the scene cards, the picture check and the engine, some of them only for one test
// and some contradicting each other (docs/in-this-town-rules.md has the full list and what happened to each one).
// Now: 12 short GLOBAL rules (craft basics, the same text everywhere) + STORY RULES the plan writes fresh for every
// story (the town's habits + world states, mood + colours, camera style, pace, places, who is outside). Pure.

export const GLOBAL_RULES = Object.freeze([
  "SIMPLE + KID-SAFE: words a 9-year-old learning English knows, short lines; scary is fine, nobody gets hurt.",
  "ONE TOWN RULE: said in the first line, every line follows from the one before, the ending uses that same rule.",
  "SHOWABLE: every line is something the engine can show (the engine kit).",
  "NAMED = SEEN: what a line names (a person, a thing, an action, the monster) is in the frame, big enough to read, and the one the line is about does it.",
  "FACES: never cut by the frame, never under the captions; close-ups only for a reaction or a speaker, at most 1 shot in 4.",
  "CAMERA: never inside a wall or a body, never under the ground, never just one flat surface or a glare blob.",
  "ALIVE: nobody is frozen (everyone breathes, blinks and moves), every action blends into the next, walking feet move with the ground.",
  "SHOW THE PLACE: the first shot of every place moves through it (a street glide, a low drone or a follow walk), never just one house.",
  "THE STORY'S WORLD: nothing on screen contradicts the story rules (who is outside, what moves, what is lit).",
  "SAME CAST: a character keeps one look and one voice all story; only the one speaking moves their mouth.",
  "ONE SCENE, ONE PLACE: a scene stays in one of the story's own places.",
  "EVERY LINE A NEW PICTURE: each line changes what we see (a new shot or a new action), never the same shot twice in a row.",
]);
/** the rules as a numbered prompt block (which = the numbers this step works with; all by default) */
export function globalRulesText(which = null) {
  const pick = GLOBAL_RULES.map((r, i) => ({ n: i + 1, r })).filter((x) => !which || which.includes(x.n));
  return `THE GLOBAL RULES (always):\n${pick.map((x) => `${x.n}. ${x.r}`).join("\n")}`;
}
/** which global rules each step reads (the writer cannot frame a face; the checker cannot hear a voice) */
export const RULES_FOR = Object.freeze({ writer: [1, 2, 3, 12], plan: [2, 8, 9, 10, 11], scene: [4, 5, 6, 7, 8, 9, 11, 12], check: [4, 5, 6, 9] });

export const CAMERA_STYLES = Object.freeze(["glide", "drone", "follow", "handheld", "still"]);
const s = { type: "string" };
/** THE STORY RULES the plan writes fresh for every story (the town's habits + world states stay in plan.town / lines.world) */
export function storyRulesSchema() {
  return {
    type: "object", additionalProperties: false, required: ["mood", "colours", "camera_style", "cut_every_s", "places_why", "outside"],
    properties: { mood: s, colours: s, camera_style: { type: "string", enum: [...CAMERA_STYLES] }, cut_every_s: { type: "number" }, places_why: s, outside: s },
  };
}
export const STORY_RULES_PROMPT = `THE STORY RULES (write them fresh for THIS story, nothing fixed): mood (one short phrase), colours (the palette in a few words), camera_style (glide / drone / follow / handheld / still: how the camera mostly moves), cut_every_s (seconds between cuts: about 1.2 for a fast story, 1.6 for a calm one), places_why (why these places), outside (who is outdoors when, by the town's habits). The town's habits and every line's world state are the rest of the story rules.`;
/** a plan's story rules as a short block for the scene and check steps */
export function storyRulesText(plan) {
  const r = plan?.story_rules;
  if (!r) return "";
  return `THE STORY RULES (this story): mood ${r.mood}; colours ${r.colours}; camera ${r.camera_style}; a cut about every ${r.cut_every_s} s; places: ${r.places_why}; outside: ${r.outside}; the town: "${plan.town?.rule ?? ""}"${(plan.town?.habits ?? []).length ? ` (${plan.town.habits.join("; ")})` : ""}.`;
}
