// Blocky Worlds: the video protocol's checks and step prompts (docs/blocky-worlds-protocol.md is the rulebook).
// Every source (a library idea, "Your topic", a pasted script) becomes the same complete IDEA CARD, then always:
//   card -> beat sheet (7 parts) -> script -> shot plan (fixed vocabulary) -> render
// Each step has code checks here; a failed step is retried on its own (llm.js), never the whole chain.
import { FORMULAS, MOODS, SETTINGS, TWISTS } from "./formulas.js";
import { hasOpener } from "./opener.js";
import { safetyProblems } from "./safety.js";
import { PART_IDS, PARTS, partBudgets, wordCount } from "./script.js";
import { contentWords } from "./library.js";

// ---------- step 1: the idea card ----------
export const CARD_FIELDS = Object.freeze(["opener", "title", "premise", "price", "examples", "narrator", "prop", "twist", "teaser", "closer", "formula", "twistType", "mood", "setting"]);
/** What a card is missing or gets wrong (empty = complete). */
export function cardProblems(card) {
  const out = [];
  for (const f of CARD_FIELDS) {
    const v = card?.[f];
    if (f === "examples" ? !(Array.isArray(v) && v.filter((x) => String(x).trim()).length === 3) : !String(v ?? "").trim()) out.push(`missing ${f}`);
  }
  if (card?.opener && !hasOpener(card.opener)) out.push('opener must start with "In this world, " or "In this town, "');
  if (card?.formula && !FORMULAS[card.formula]) out.push(`unknown formula ${card.formula}`);
  if (card?.twistType && !TWISTS[card.twistType]) out.push(`unknown twist ${card.twistType}`);
  if (card?.mood && !MOODS[card.mood]) out.push(`unknown mood ${card.mood}`);
  out.push(...safetyProblems(CARD_FIELDS.map((f) => (Array.isArray(card?.[f]) ? card[f].join(" ") : card?.[f] ?? "")).join(" \n ")));
  return out;
}

/** A pasted script turned back into a card (so every video runs the same protocol). */
export const CARD_FROM_SCRIPT_SYSTEM = `You read a short story narration and write its IDEA CARD for Blocky Worlds. Fill every field from the script; when the script lacks a piece, invent the smallest piece that fits it (never change what the script says).
- opener: the script's first line if it states the world rule; otherwise a first line that does, starting with exactly "In this world, " or "In this town, ".
- price (what breaking the rule costs), examples (exactly three short examples of the rule from the script), narrator (who tells it and how they're the exception), prop (the object that wins the climax), twist (how it ends), teaser (a card line that hints at the twist), closer (the script's last line), title.
- formula: F1 everyone-has-X-except-me, F2 never-do-X-or-Y, F3 every-night-we-give-X-to-Y, F4 our-town-lives-inside-Z, F5 everyone-gets-X-when-Y, F6 some-are-A-the-rest-are-B.
- twistType: T1 rule-is-the-weapon, T2 hidden-truth, T3 weakness-is-strength, T4 wording-loophole, T5 open-loop-sting, T6 wholesome-inversion.
- mood: horror, wholesome, funny or epic. setting: one of: ${SETTINGS.join("; ")}.
Return only the JSON object.`;
export const cardFromScriptPrompt = (lines) => `THE SCRIPT\n${lines.map((l) => (typeof l === "string" ? l : l.text)).join("\n")}`;

// ---------- step 2: the beat sheet ----------
/** What a beat can use from the card (the checks follow these). */
export const USES = Object.freeze(["rule", "price", "example1", "example2", "example3", "exception", "prop_setup", "escalation1", "escalation2", "escalation3", "truth", "prop_payoff", "twist", "closer"]);
export const BEATS_SYSTEM = `You plan the beat sheet of a Blocky Worlds video from its idea card: the seven parts of the proven shape, what happens in each, what the camera shows, and which pieces of the card each part uses.
THE PARTS (in order): ${PARTS.map((p) => `${p.id} (${p.what})`).join("; ")}.
RULES
- rule uses "rule". tour uses "price" and all three examples. me uses "exception" and "prop_setup" (the planted object is shown and named here).
- until escalates in three visible steps: "escalation1", "escalation2", "escalation3".
- discovery uses "truth" (the hidden truth about the rule). climax uses "prop_payoff" (the planted object or the rule itself wins) and "twist". closer uses "closer" and calls back the first line.
- shows: one sentence of what is on screen, concrete and filmable in a blocky toy-like world (characters, a place, a key object).
- words: about how many spoken words the part gets (the totals are given).
Return only the JSON object.`;
export function beatsSchema() {
  const s = { type: "string" };
  return { type: "object", additionalProperties: false, required: ["beats"], properties: { beats: { type: "array", items: { type: "object", additionalProperties: false, required: ["part", "summary", "shows", "words", "uses"], properties: { part: { type: "string", enum: [...PART_IDS] }, summary: s, shows: s, words: { type: "integer" }, uses: { type: "array", items: { type: "string", enum: [...USES] } } } } } } };
}
export const beatsPrompt = (card, lengthSec) => `THE IDEA CARD\n${JSON.stringify(card)}\n\nLENGTH: ${lengthSec} s. Words per part: ${partBudgets(lengthSec).map((b) => `${b.id} ~${b.words}`).join(", ")}.`;
/** What a beat sheet gets wrong (empty = fine). */
export function beatProblems(beats) {
  const out = [], list = Array.isArray(beats) ? beats : [];
  if (list.map((b) => b.part).join(",") !== PART_IDS.join(",")) out.push(`the beats must be the 7 parts in order (${PART_IDS.join(", ")})`);
  const uses = (part) => new Set(list.find((b) => b.part === part)?.uses ?? []);
  const need = { rule: ["rule"], tour: ["price", "example1", "example2", "example3"], me: ["exception", "prop_setup"], until: ["escalation1", "escalation2", "escalation3"], discovery: ["truth"], climax: ["prop_payoff"], closer: ["closer"] };
  for (const [part, items] of Object.entries(need)) for (const u of items) if (!uses(part).has(u)) out.push(`${part} must use ${u}`);
  for (const b of list) if (!String(b.shows ?? "").trim() || !String(b.summary ?? "").trim()) out.push(`${b.part}: summary and shows are required`);
  out.push(...safetyProblems(list.map((b) => `${b.summary} ${b.shows}`).join(" \n ")));
  return out;
}

// ---------- step 3: the script (script.js checkScript, plus these protocol checks) ----------
/** The planted object pays off: its words appear in a me/tour line (set up) and in a climax line (pay off). */
export function propProblems(card, script) {
  const prop = contentWords(card?.prop).filter((w) => w.length > 3);
  if (!prop.length) return [];
  const linesOf = (parts) => script.lines.filter((l) => parts.includes(l.part)).map((l) => contentWords(l.text)).flat();
  const setup = linesOf(["tour", "me"]), payoff = linesOf(["climax"]);
  const out = [];
  if (!prop.some((w) => setup.includes(w))) out.push(`the planted object (${card.prop}) is never set up in the tour or "me" part`);
  if (!prop.some((w) => payoff.includes(w))) out.push(`the planted object (${card.prop}) never pays off in the climax`);
  return out;
}
/** The closer calls back line 1: the last two lines share a content word with the first line or with the card's closer. */
export function callbackProblem(card, script) {
  const first = contentWords(script.lines[0]?.text), lastTwo = script.lines.slice(-2).map((l) => contentWords(l.text)).flat();
  const cardCloser = contentWords(card?.closer);
  const echoes = lastTwo.some((w) => first.includes(w)) || cardCloser.filter((w) => lastTwo.includes(w)).length >= 2;
  return echoes ? null : "the last lines don't call back the first line (reuse a word or image from it)";
}

// ---------- step 4: the shot plan (the fixed vocabulary the renderer can build) ----------
export const SHOTS = Object.freeze({
  camera: Object.freeze(["wide_establishing", "medium", "medium_two_shot", "closeup_face", "extreme_closeup", "low_angle_threat", "top_down", "over_shoulder", "insert_prop", "silhouette_reveal", "back_follow", "pov"]),
  light: Object.freeze(["day", "golden", "dusk", "night", "storm", "fog", "snow", "warm_interior", "sunrise"]),
  fx: Object.freeze(["rain", "snow", "fog", "glow", "sparkles", "dust", "lights_out", "wind", "none"]),
  action: Object.freeze(["idle", "walk", "run", "sit", "wave", "point", "phone", "cower", "carry", "climb", "fall", "hug", "cheer", "look_up", "talk", "sleep"]),
  expr: Object.freeze(["happy", "sad", "scared", "excited", "bored", "angry", "sleepy", "surprised", "smirk", "cry", "neutral"]),
  sets: SETTINGS,
});
export const SHOTS_SYSTEM = `You plan the shots of a Blocky Worlds video: one or more shots for every line of the script, using ONLY this vocabulary.
camera: ${SHOTS.camera.join(", ")}
light: ${SHOTS.light.join(", ")}
fx: ${SHOTS.fx.join(", ")}
action: ${SHOTS.action.join(", ")}
expr: ${SHOTS.expr.join(", ")}
set: ${SETTINGS.join("; ")}
RULES
- Every line gets at least one shot; listed examples get one shot each. Visuals are literal: every spoken noun is shown.
- Line 1 shows the rule in action (wide_establishing or insert_prop).
- Threats are shown with low_angle_threat, silhouette_reveal or extreme_closeup; emotional beats with closeup_face.
- Light follows the story: normal world bright, crisis darker (night, storm, fog, dusk), ending warm (day, golden, sunrise, warm_interior).
- characters: who is on screen (names from the script, "narrator" for the kid), their action and expression. sign: short in-world text if a sign, note or screen is shown, else "".
Return only the JSON object.`;
export function shotsSchema() {
  const s = { type: "string" }, en = (list) => ({ type: "string", enum: [...list] });
  return {
    type: "object", additionalProperties: false, required: ["shots"],
    properties: { shots: { type: "array", items: { type: "object", additionalProperties: false, required: ["line", "camera", "set", "light", "fx", "characters", "sign"], properties: {
      line: { type: "integer" }, camera: en(SHOTS.camera), set: en(SETTINGS), light: en(SHOTS.light), fx: en(SHOTS.fx), sign: s,
      characters: { type: "array", items: { type: "object", additionalProperties: false, required: ["who", "action", "expr"], properties: { who: s, action: en(SHOTS.action), expr: en(SHOTS.expr) } } },
    } } } },
  };
}
export const shotsPrompt = (script) => `THE SCRIPT (line numbers from 0)\n${script.lines.map((l, i) => `${i} [${l.part}] ${l.text}`).join("\n")}`;
/** What a shot plan gets wrong (empty = fine). */
export function shotProblems(shots, script) {
  const out = [], list = Array.isArray(shots) ? shots : [];
  const n = script.lines.length;
  const covered = new Set(list.map((s) => s.line));
  for (let i = 0; i < n; i++) if (!covered.has(i)) out.push(`line ${i} has no shot`);
  for (const s of list) {
    if (!(s.line >= 0 && s.line < n)) out.push(`a shot points at line ${s.line}, which doesn't exist`);
    if (!SHOTS.camera.includes(s.camera)) out.push(`unknown camera ${s.camera}`);
    if (!SETTINGS.includes(s.set)) out.push(`unknown set ${s.set}`);
    if (!SHOTS.light.includes(s.light)) out.push(`unknown light ${s.light}`);
    for (const c of s.characters ?? []) if (!SHOTS.action.includes(c.action) || !SHOTS.expr.includes(c.expr)) out.push(`line ${s.line}: unknown action/expression`);
  }
  const firstShot = list.find((s) => s.line === 0);
  if (firstShot && !["wide_establishing", "insert_prop"].includes(firstShot.camera)) out.push("line 0 must open on wide_establishing or insert_prop");
  out.push(...safetyProblems(list.map((s) => s.sign).join(" ")));
  return [...new Set(out)];
}
/** Shots per second of narration: the references cut every ~1-2 s. */
export const shotPace = (shots, seconds) => Number((seconds / Math.max(1, shots.length)).toFixed(2));

/** The words a part was given vs what the script used (for the beat-sheet budget report). */
export const partWords = (script) => Object.fromEntries(PART_IDS.map((p) => [p, script.lines.filter((l) => l.part === p).reduce((a, l) => a + wordCount(l.text), 0)]));
