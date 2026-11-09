// Blocky Worlds SHOT RECIPES (owner, 2026-11-08): "the AI inventing every shot line by line looks random. Take the best
// reference videos and turn each into a fixed, pre-directed shot recipe: the exact camera moves, distances, order and
// timing. One recipe per story type. The AI only picks the recipe and fills in the story's own characters, places and
// props. Copy structure and camera only; never their story, characters or names."
//
// A recipe is pure data (lib/recipes/data/<id>.json). It holds ENUMS ONLY: no story text, no names, no quotes, no
// footage, no frame paths from the source video (`source.video` is an internal id for our own bookkeeping).
//
// {
//   version: 1, id: "creature_town_attack", storyType: "creature_town_attack", name, what,
//   source: { video, shots, duration, note },            // internal only
//   aliases: ["giant_reveal"],                           // other story types that map to this recipe
//   pace: { targetShot: 1.1, minShot: 0.8, maxShot: 2.2, maxPerLine: 4 },   // seconds
//   beats: {
//     <beat>: {                                          // rule | tour | me | until | discovery | climax | closer
//       mode: "flow" | "per_line",                       // flow: the slots stretch over the whole beat in order
//                                                        // per_line: the slots are a mini-sequence that restarts on
//                                                        //           every line ("one example per line")
//       targetShot: 1.07,                                // the source's median shot in this beat (s)
//       light: "keep" | "day" | "night" | "dusk" | "warm",  // time-of-day rule (never against the line's own time words)
//       slots: [{
//         role:    one of ROLES,
//         share:   0.12,                                 // the slot's share of the beat's time (flow) / the line's (per_line)
//         cam:     { distance, height, move, speed },    // DISTANCES / HEIGHTS / MOVES / SPEEDS below
//         subject: one of SUBJECTS,                      // who / what the slot frames (filled from the world bible)
//         scale:   [SCALE_CUES],                         // what must be in frame next to the subject for size
//         action:  one of ACTIONS,                       // "line" = the line's own verb; others fixed
//         cutOn:   "word" | "noun" | "verb" | "line",    // where the cut INTO this slot lands
//         causes:  true,                                 // this shot's effect is the next shot (cause -> effect)
//       }]
//     }
//   }
// }
export const RECIPE_VERSION = 1;
export const BEATS = Object.freeze(["rule", "tour", "me", "until", "discovery", "climax", "closer"]);
export const ROLES = Object.freeze(["establish", "explain", "reveal", "creature", "scale", "life", "character", "reaction", "humour", "threat", "cause", "consequence", "chase", "mood", "aftermath", "ending", "transition", "other"]);
export const DISTANCES = Object.freeze(["extreme_wide", "wide", "medium", "close", "extreme_close"]);
export const HEIGHTS = Object.freeze(["aerial", "high", "eye_level", "ground_low"]);
export const MOVES = Object.freeze(["static", "push_in", "pull_out", "track", "pan", "tilt_up", "orbit", "flyover", "fpv", "top_down", "low_hero", "shake"]);
export const SPEEDS = Object.freeze(["slow", "medium", "fast"]);
export const SUBJECTS = Object.freeze(["creature", "town", "threat", "narrator", "sidekick", "neighbour", "crowd", "prop", "place", "line"]);
export const SCALE_CUES = Object.freeze(["person", "people", "houses", "trees", "creature", "town", "crowd", "prop"]);
export const ACTIONS = Object.freeze(["line", "walks", "reacts_scared", "reacts_surprised", "reacts_happy", "looks_up", "runs", "points", "idle", "attacks", "roars", "cheers"]);
export const CUT_ON = Object.freeze(["word", "noun", "verb", "line"]);
export const MODES = Object.freeze(["flow", "per_line"]);
export const LIGHTS = Object.freeze(["keep", "day", "night", "dusk", "warm"]);

const isNum = (x) => typeof x === "number" && Number.isFinite(x);
const NAMEY = /[A-Z][a-z]{2,}/; // a capitalised word in a free-text field = a possible name: refused

/** problems of a recipe (empty = valid). Pure, never throws. */
export function validateRecipe(r) {
  const bad = [];
  if (!r || typeof r !== "object") return ["recipe: not an object"];
  if (r.version !== RECIPE_VERSION) bad.push(`version ${r.version} != ${RECIPE_VERSION}`);
  if (!/^[a-z][a-z0-9_]*$/.test(r.id ?? "")) bad.push(`id "${r.id}"`);
  if (!/^[a-z][a-z0-9_]*$/.test(r.storyType ?? "")) bad.push(`storyType "${r.storyType}"`);
  const p = r.pace ?? {};
  for (const k of ["targetShot", "minShot", "maxShot"]) if (!isNum(p[k]) || p[k] <= 0) bad.push(`pace.${k}`);
  if (isNum(p.minShot) && isNum(p.maxShot) && p.minShot >= p.maxShot) bad.push("pace: minShot >= maxShot");
  // SHOT GRAMMAR v2 (owner 2026-11-09, lib/shotGrammar.js): the framing mix the planner steers this story type to
  //   mix: { character, insert, world, action (shares summing to 1), crowdMax (share of crowd shots) }
  if (r.mix != null) {
    const m = r.mix, ks = ["character", "insert", "world", "action"];
    for (const k of ks) if (!isNum(m[k]) || m[k] < 0 || m[k] > 1) bad.push(`mix.${k}`);
    if (ks.every((k) => isNum(m[k])) && Math.abs(ks.reduce((a, k) => a + m[k], 0) - 1) > 0.05) bad.push("mix: the four shares must sum to 1");
    if (m.crowdMax != null && (!isNum(m.crowdMax) || m.crowdMax < 0 || m.crowdMax > 0.3)) bad.push("mix.crowdMax");
    for (const k of Object.keys(m)) if (![...ks, "crowdMax"].includes(k)) bad.push(`mix: unknown field "${k}"`);
  }
  for (const b of BEATS) {
    const B = r.beats?.[b];
    if (!B) { bad.push(`beat ${b}: missing`); continue; }
    if (!MODES.includes(B.mode)) bad.push(`${b}.mode "${B.mode}"`);
    if (B.light != null && !LIGHTS.includes(B.light)) bad.push(`${b}.light "${B.light}"`);
    if (B.targetShot != null && (!isNum(B.targetShot) || B.targetShot < 0.5 || B.targetShot > 4)) bad.push(`${b}.targetShot ${B.targetShot}`);
    if (!Array.isArray(B.slots) || !B.slots.length) { bad.push(`${b}: no slots`); continue; }
    B.slots.forEach((s, i) => {
      const at = `${b}[${i}]`;
      if (!ROLES.includes(s.role)) bad.push(`${at}.role "${s.role}"`);
      if (s.share != null && (!isNum(s.share) || s.share <= 0 || s.share > 1)) bad.push(`${at}.share ${s.share}`);
      const c = s.cam ?? {};
      if (!DISTANCES.includes(c.distance)) bad.push(`${at}.cam.distance "${c.distance}"`);
      if (!HEIGHTS.includes(c.height)) bad.push(`${at}.cam.height "${c.height}"`);
      if (!MOVES.includes(c.move)) bad.push(`${at}.cam.move "${c.move}"`);
      if (c.speed != null && !SPEEDS.includes(c.speed)) bad.push(`${at}.cam.speed "${c.speed}"`);
      if (!SUBJECTS.includes(s.subject)) bad.push(`${at}.subject "${s.subject}"`);
      for (const q of s.scale ?? []) if (!SCALE_CUES.includes(q)) bad.push(`${at}.scale "${q}"`);
      if (s.action != null && !ACTIONS.includes(s.action)) bad.push(`${at}.action "${s.action}"`);
      if (s.cutOn != null && !CUT_ON.includes(s.cutOn)) bad.push(`${at}.cutOn "${s.cutOn}"`);
      const known = new Set(["role", "share", "cam", "subject", "scale", "action", "cutOn", "causes"]);
      for (const k of Object.keys(s)) if (!known.has(k)) bad.push(`${at}: unknown field "${k}" (recipes hold enums only)`);
    });
  }
  // PATTERNS ONLY: free text is limited to name / what / note, and never carries a capitalised word other than the first
  for (const k of ["what"]) if (r[k] != null && NAMEY.test(String(r[k]).slice(1))) bad.push(`${k}: looks like it carries a name`);
  return bad;
}

/** the slot list of a beat as a flat, normalised array (shares summing to 1) */
export function beatSlots(recipe, beat) {
  const slots = recipe?.beats?.[beat]?.slots ?? [];
  const tot = slots.reduce((a, s) => a + (s.share ?? 1 / slots.length), 0) || 1;
  return slots.map((s) => ({ ...s, share: (s.share ?? 1 / slots.length) / tot }));
}
