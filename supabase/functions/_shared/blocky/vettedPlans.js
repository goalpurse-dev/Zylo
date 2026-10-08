// Vetted story plans: plans the owner writes by hand for the idea feature
// (decision 68). A plain text file, one plan per block, a blank line between
// blocks, "key: value" lines. The characters are A, B and optionally C, so any
// library avatar can play them. Every block is run through the SAME checks as
// a plan the model writes (twists.js#validateTwistPlan), so a hand-written plan
// drops straight in or is told which line to fix.
//
//   title: The Admin Who Wasn't
//   hook: A fake admin picks on the one player he shouldn't.
//   type: abusive_admin
//   A: a player faking admin powers
//   B: the quiet owner of the game
//   premise: What happens if a player fakes admin powers to scare a quiet newcomer?
//   pattern: quiet_power
//   mechanic: owner_power
//   stakes: B's place on the server
//   clue: scene 2: while saying sorry, B turns a small gold key over in one hand
//   payoff: scene 5: B holds the gold key up and A, floating helplessly, drops
//   consequence: A is kicked from the server he pretended to run
//   winner: B
//   last line: Cute commands. Want to see real ones?
//
// Optional lines: "C: ..." (a third character), "twist: ..." (what the viewer finds out, in one
// sentence), "seen as: ..." (what something to read is on screen instead), "viewer assumes: ...",
// "feeling: ..." (one of the five), "scenes: 6".
// Pure: parsing and checking. scripts/blocky/importPlans.mjs reads the file.
import { STORY_EMOTIONS } from "./rules.js";
import { MECHANIC_IDS, TWIST_PATTERN_IDS, validateTwistPlan } from "./twists.js";
import { wordCount } from "./duration.js";

/** The ten story types (scope C1's ten narrative engines). An idea batch takes five different ones. */
export const STORY_TYPES = Object.freeze([
  { id: "forbidden_power", label: "A forbidden power with a hidden cost" },
  { id: "glitch", label: "A glitch that reveals something it shouldn't" },
  { id: "scheme", label: "A prank or scheme that spirals out of control" },
  { id: "countdown", label: "A countdown or a ticking clock" },
  { id: "abusive_admin", label: "A hidden villain or an admin abusing power" },
  { id: "dilemma", label: "A choice with no clean right answer" },
  { id: "avatar_secret", label: "A secret about the character's own account" },
  { id: "trade", label: "A trade or deal that costs more than expected" },
  { id: "server_rule", label: "A server rule that turns sinister if broken" },
  { id: "transformation", label: "A change of identity that changes who they become" },
]);
export const STORY_TYPE_IDS = Object.freeze(STORY_TYPES.map((t) => t.id));
/** A vetted plan is written for this many scenes unless it says otherwise (30 seconds). */
export const DEFAULT_PLAN_SCENES = 6;

const KEYS = { "title": "title", "hook": "hook", "type": "type", "a": "A", "b": "B", "c": "C", "premise": "premise", "pattern": "pattern", "mechanic": "mechanic", "stakes": "stakes", "clue": "clue", "payoff": "payoff", "consequence": "consequence", "winner": "winner", "last line": "finalLine", "twist": "twist", "seen as": "seenAs", "viewer assumes": "assumed", "feeling": "emotion", "scenes": "scenes" };
const REQUIRED = ["title", "hook", "type", "A", "B", "premise", "pattern", "mechanic", "stakes", "clue", "payoff", "consequence", "winner", "finalLine"];
const LABEL = Object.fromEntries(Object.entries(KEYS).map(([written, key]) => [key, written === "a" || written === "b" || written === "c" ? written.toUpperCase() : written]));

/**
 * Splits a file into blocks. Lines that start with # are comments.
 * @returns {{line: number, fields: object, problems: string[]}[]}  line: where the block starts (1-based)
 */
export function parsePlanFile(text) {
  const blocks = [];
  let current = null;
  String(text ?? "").replace(/\r\n/g, "\n").split("\n").forEach((raw, i) => {
    const line = raw.trim();
    if (!line) { current = null; return; }
    if (line.startsWith("#")) return;
    if (!current) { current = { line: i + 1, fields: {}, problems: [] }; blocks.push(current); }
    const at = line.indexOf(":");
    const key = at > 0 ? KEYS[line.slice(0, at).trim().toLowerCase().replace(/\s+/g, " ")] : null;
    if (!key) { current.problems.push(`line ${i + 1}: "${line.slice(0, 40)}" is not a "key: value" line this format knows`); return; }
    if (key in current.fields) current.problems.push(`line ${i + 1}: "${LABEL[key]}" is there twice`);
    current.fields[key] = line.slice(at + 1).trim();
  });
  return blocks;
}

const sceneAnd = (value) => { const m = /^scene\s+(\d+)\s*:\s*(.+)$/i.exec(String(value ?? "")); return m ? { scene: Number(m[1]), text: m[2].trim() } : null; };
export const slugOf = (title) => String(title ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

/**
 * One block → a checked plan. Returns {plan, problems}; problems is empty when the plan can be used.
 * plan: {slug, title, hook, type, slots: {A, B, C?}, sceneCount, premise, seenAs, emotion, assumed, stakes,
 *        patternId, mechanic, clue, clueScene, payoff, revealScene, consequence, winner, finalLine}
 */
export function vettedPlanFrom(block) {
  const f = block.fields;
  const problems = [...block.problems];
  for (const key of REQUIRED) if (!f[key]) problems.push(`"${LABEL[key]}" is missing`);
  const slots = Object.fromEntries(["A", "B", "C"].filter((s) => f[s]).map((s) => [s, f[s]]));
  const sceneCount = f.scenes ? Number(f.scenes) : DEFAULT_PLAN_SCENES;
  if (!Number.isInteger(sceneCount) || sceneCount < 3 || sceneCount > 24) problems.push(`"scenes" must be a whole number from 3 to 24 (got "${f.scenes}")`);
  if (f.type && !STORY_TYPE_IDS.includes(f.type)) problems.push(`"type" must be one of: ${STORY_TYPE_IDS.join(", ")}`);
  if (f.pattern && !TWIST_PATTERN_IDS.includes(f.pattern)) problems.push(`"pattern" must be one of: ${TWIST_PATTERN_IDS.join(", ")}`);
  if (f.mechanic && !MECHANIC_IDS.includes(f.mechanic)) problems.push(`"mechanic" must be one of: ${MECHANIC_IDS.join(", ")}`);
  if (f.emotion && !STORY_EMOTIONS.includes(f.emotion)) problems.push(`"feeling" must be one of: ${STORY_EMOTIONS.join(", ")}`);
  if (f.winner && !slots[f.winner]) problems.push(`"winner" must be ${Object.keys(slots).join(" or ") || "A or B"} (got "${f.winner}")`);
  if (f.hook && (wordCount(f.hook) < 4 || wordCount(f.hook) > 18)) problems.push(`"hook" is one line of 4 to 18 words (got ${wordCount(f.hook)})`);
  const clue = sceneAnd(f.clue), payoff = sceneAnd(f.payoff);
  if (f.clue && !clue) problems.push('"clue" starts with its scene: "scene 2: what is seen or heard"');
  if (f.payoff && !payoff) problems.push('"payoff" starts with its scene: "scene 5: who does what"');
  if (problems.length) return { plan: null, problems };

  // The same checks a model-written plan gets, with A, B and C as the cast.
  const cast = Object.entries(slots).map(([id, role]) => ({ id, name: id, tag: role }));
  const raw = {
    premise: f.premise, seenAs: f.seenAs ?? "", emotion: f.emotion ?? "satisfaction", roles: cast.map((c) => ({ id: c.id, role: c.tag })),
    assumed: f.assumed ?? "", stakes: f.stakes, patternId: f.pattern, twist: f.twist || `${payoff.text}. ${f.consequence}`, mechanic: f.mechanic,
    clue: clue.text, clueScene: clue.scene, payoff: payoff.text, revealScene: payoff.scene, consequence: f.consequence, winnerId: f.winner, finalLine: f.finalLine, title: f.title,
  };
  const checked = validateTwistPlan(raw, { cast, sceneCount, generated: false });
  // What the viewer assumes is optional in a hand-written plan (the writer works it out from the premise).
  const found = checked.errors.filter((e) => f.assumed || !e.startsWith("assumed:")).map((e) => e
    .replace(/^finalLine:/, '"last line":').replace(/^patternId:/, '"pattern":').replace(/^winnerId:/, '"winner":')
    .replace(/^clueScene:/, '"clue" scene:').replace(/^revealScene:/, '"payoff" scene:').replace(/^(premise|stakes|clue|payoff|consequence|mechanic|assumed|title):/, '"$1":'));
  if (found.length) return { plan: null, problems: found };
  const p = checked.plan;
  return {
    plan: {
      slug: slugOf(f.title), title: p.title, hook: f.hook, type: f.type, slots, sceneCount, twist: p.twist,
      premise: p.premise, seenAs: p.seenAs, emotion: p.emotion, assumed: f.assumed ?? "", stakes: p.stakes, patternId: p.patternId, mechanic: p.mechanic,
      clue: p.clue, clueScene: p.clueScene, payoff: p.payoff, revealScene: p.revealScene, consequence: p.consequence, winner: f.winner, finalLine: p.finalLine,
    },
    problems: [],
  };
}

/** A whole file → {plans, report}. report: one entry per block, with the line it starts on. */
export function readPlanFile(text) {
  const report = parsePlanFile(text).map((block) => { const r = vettedPlanFrom(block); return { line: block.line, title: block.fields.title ?? "(no title)", ok: r.problems.length === 0, problems: r.problems, plan: r.plan }; });
  const seen = new Map();
  for (const r of report) {
    if (!r.ok) continue;
    if (seen.has(r.plan.slug)) { r.ok = false; r.problems = [`the same title as the plan on line ${seen.get(r.plan.slug)}`]; r.plan = null; } else seen.set(r.plan.slug, r.line);
  }
  return { plans: report.filter((r) => r.ok).map((r) => r.plan), report };
}
