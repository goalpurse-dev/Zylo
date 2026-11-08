// Blocky Worlds: the video protocol's checks and step prompts (docs/blocky-worlds-protocol.md is the rulebook).
// Every source (a library idea, "Your topic", a pasted script) becomes the same complete IDEA CARD, then always:
//   card -> beat sheet (7 parts) -> script -> shot plan (fixed vocabulary) -> render
// Each step has code checks here; a failed step is retried on its own (llm.js), never the whole chain.
import { FORMULAS, MOODS, SETTINGS, TWISTS } from "./formulas.js";
import { hasOpener } from "./opener.js";
import { safetyProblems } from "./safety.js";
import { PART_IDS, PARTS, partBudgets, wordCount } from "./script.js";
import { contentWords } from "./library.js";
import { conflictLines, TOPIC_PREFIX } from "./topic.js";

// ---------- step 1: the idea card ----------
export const CARD_FIELDS = Object.freeze(["opener", "title", "premise", "price", "examples", "narrator", "prop", "twist", "teaser", "closer", "formula", "twistType", "mood", "setting"]);
/** What a card is missing or gets wrong (empty = complete). */
export function cardProblems(card) {
  const out = [];
  for (const f of CARD_FIELDS) {
    const v = card?.[f];
    if (f === "examples" ? !(Array.isArray(v) && v.filter((x) => String(x).trim()).length === 3) : !String(v ?? "").trim()) out.push(`missing ${f}`);
  }
  if (card?.opener && !hasOpener(card.opener)) out.push('opener must start with "In this town, "');
  if (card?.formula && !FORMULAS[card.formula]) out.push(`unknown formula ${card.formula}`);
  if (card?.twistType && !TWISTS[card.twistType]) out.push(`unknown twist ${card.twistType}`);
  if (card?.mood && !MOODS[card.mood]) out.push(`unknown mood ${card.mood}`);
  out.push(...safetyProblems(CARD_FIELDS.map((f) => (Array.isArray(card?.[f]) ? card[f].join(" ") : card?.[f] ?? "")).join(" \n ")));
  return out;
}

/** A pasted script turned back into a card (so every video runs the same protocol). */
export const CARD_FROM_SCRIPT_SYSTEM = `You read a short story narration and write its IDEA CARD for Blocky Worlds. Fill every field from the script; when the script lacks a piece, invent the smallest piece that fits it (never change what the script says).
- opener: the script's first line if it states the world rule; otherwise a first line that does, starting with exactly "In this town, ".
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
- If the card has a "topic" (the user's own idea), it is the core: its world, threat and characters appear in every part's summary and shows, the rule part states it, and the climax beats it. Its CONFLICT (who does what to whom: "a wolf's army is hunting the turtle") is the spine: until brings it closer, the climax ENDS it (the threat beaten, tricked, trapped, escaped or driven off), never a truce or a gag that cancels it. Its descriptors ("giant", "big bad") stay.
- shows: one sentence of what is on screen, concrete and filmable in a blocky toy-like world (characters, a place, a key object).
- words: about how many spoken words the part gets (the totals are given).
Return only the JSON object.`;
export function beatsSchema() {
  const s = { type: "string" };
  return { type: "object", additionalProperties: false, required: ["beats"], properties: { beats: { type: "array", items: { type: "object", additionalProperties: false, required: ["part", "summary", "shows", "words", "uses"], properties: { part: { type: "string", enum: [...PART_IDS] }, summary: s, shows: s, words: { type: "integer" }, uses: { type: "array", items: { type: "string", enum: [...USES] } } } } } } };
}
export const beatsPrompt = (card, lengthSec) => `THE IDEA CARD\n${JSON.stringify(card)}${card?.topic && conflictLines(card.topic).length ? `\n\nTHE USER'S OWN IDEA: "${String(card.topic).slice(0, 200)}"\n${conflictLines(card.topic).join("\n")}` : ""}\n\nLENGTH: ${lengthSec} s. Words per part: ${partBudgets(lengthSec).map((b) => `${b.id} ~${b.words}`).join(", ")}.`;
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
// The planted object, recognised the way a listener would (2026-11-05: a real climax said "I tore off a strip and wrote
// ZERO" right after "I looked at Grandma's duct tape" and was refused, because only the card's exact words counted).
// A line refers to the object when it uses:
//   - any distinctive word of it ("tape", "duct", "the roll" for "Grandma's roll of duct tape"), singular or plural,
//     possessive or not; the owner ("Grandma's") and plain size/age words ("old", "little") don't count on their own
//   - a piece of it: "a strip of it", or a bare "a strip" when the object is something strips come from (tape, paper...)
//   - a bare piece word ("a strip", "a piece") right after the object was named (the last two lines before the part)
// A climax that never names the object, never uses a piece of it and doesn't follow straight on from it still fails.
const PROP_STOP = new Set("a an the of and or with from for to in on at my your his her our their its this that these those some one two three".split(" "));
const PROP_GENERIC = new Set("old little big small tiny giant huge new fresh brand magic magical special lucky favorite favourite secret shiny broken chipped tiny same last first real only own".split(" "));
/** A word's singular, lowercase form: "tapes" -> "tape", "boxes" -> "box", "berries" -> "berry", "glass" stays. */
export function nounKey(word) {
  let w = String(word ?? "").toLowerCase().replace(/[’']s$/, "").replace(/[^a-z0-9]/g, "");
  if (w.length > 4 && w.endsWith("ies")) w = `${w.slice(0, -3)}y`;
  else if (w.length > 4 && /(ss|x|z|ch|sh)es$/.test(w)) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("s") && !/(ss|us|is)$/.test(w)) w = w.slice(0, -1);
  return w;
}
const tokens = (text) => String(text ?? "").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").split(/[^A-Za-z0-9']+/).map((t) => t.replace(/^'+|'+$/g, "")).filter(Boolean);
/**
 * The object's distinctive words (singular). The owner ("Grandma's") and plain size words only when nothing else is left,
 * or with withOwner (the set-up check: "I live with Grandma" next to her tape was always enough there).
 */
export function propWords(prop, { withOwner = false } = {}) {
  const raw = tokens(prop);
  const all = raw.map((t) => ({ key: nounKey(t), owner: /'s$/i.test(t) })).filter((w) => w.key.length > 2 && !PROP_STOP.has(w.key));
  const strong = all.filter((w) => (withOwner || !w.owner) && !PROP_GENERIC.has(w.key)).map((w) => w.key);
  return [...new Set(strong.length ? strong : all.map((w) => w.key))];
}
/** Piece words, and the materials each comes from (a bare "a strip" counts for tape, never for a whistle). */
const PIECES = Object.freeze({
  flat: { pieces: "strip piece bit scrap shred sheet length square corner tear patch", stuff: "tape ribbon paper cloth fabric bandage foil wrap plaster sticker scarf blanket cardboard leather rubber gum note letter map poster flag sheet towel napkin envelope newspaper page wallpaper" },
  cord: { pieces: "length piece bit knot loop coil end strand", stuff: "rope string thread yarn wire cord chain twine lace shoelace hose cable ribbon licorice leash vine" },
  food: { pieces: "slice piece bit crumb chunk bite wedge", stuff: "bread cake cheese pie pizza cookie sandwich chocolate candy pancake toast muffin biscuit cracker carrot apple" },
  breakable: { pieces: "shard piece bit chunk sliver fragment", stuff: "glass mirror crystal plate vase egg shell ice bottle window jar lens" },
  pour: { pieces: "pinch handful drop dab splash sprinkle spoonful blob squirt spray", stuff: "salt sand dust powder glitter sugar flour pepper seed water juice soup paint ink glue honey syrup perfume potion slime mud" },
  stick: { pieces: "stub piece bit chunk end sliver shaving", stuff: "chalk crayon candle pencil stick wood soap twig branch" },
});
const ALL_PIECES = new Set(Object.values(PIECES).flatMap((f) => f.pieces.split(" ")));
const piecesFor = (words) => new Set(Object.values(PIECES).filter((f) => f.stuff.split(" ").some((s) => words.includes(s))).flatMap((f) => f.pieces.split(" ")));
/**
 * How a line refers to the planted object: "word" (it names it), "piece" (a piece of it: "a strip of it", or "a strip" of
 * tape), "bare-piece" (a piece word that needs the object named just before), or null.
 */
export function propReference(prop, text, { withOwner = false } = {}) {
  const words = propWords(prop, { withOwner });
  if (!words.length) return null;
  const toks = tokens(text).map(nounKey);
  if (toks.some((t) => words.includes(t))) return "word";
  const fits = piecesFor(words);
  for (let i = 0; i < toks.length; i++) {
    if (!ALL_PIECES.has(toks[i])) continue;
    const ofIt = toks[i + 1] === "of" && ["it", "them", "that", "this"].includes(toks[i + 2]);
    if (ofIt) return "piece";
    if (toks[i + 1] === "of") continue; // "a piece of cake": a piece of something else
    if (fits.has(toks[i])) return "piece";
    return "bare-piece";
  }
  return null;
}
/** Whether a part refers to the object (a bare piece word counts when the object was named in the two lines before it). */
function partRefersTo(prop, lines, parts, opts = {}) {
  const at = lines.findIndex((l) => parts.includes(l.part));
  if (at < 0) return false;
  const before = lines.slice(Math.max(0, at - 2), at).some((l) => propReference(prop, l.text) === "word");
  return lines.some((l) => parts.includes(l.part) && (() => { const r = propReference(prop, l.text, opts); return r === "word" || r === "piece" || (r === "bare-piece" && before); })());
}
/** The planted object pays off: it is set up in the tour or "me" part and used in the climax (propReference). */
export function propProblems(card, script) {
  if (!propWords(card?.prop).length) return [];
  const lines = script?.lines ?? [];
  const out = [];
  if (!partRefersTo(card.prop, lines, ["tour", "me"], { withOwner: true })) out.push(`The object the story hangs on (${card.prop}) is never shown before the trouble starts: name it in the "Me" part.`);
  if (!partRefersTo(card.prop, lines, ["climax"])) out.push(`The climax never pays off ${card.prop}: the hero should win with it (name it, or use a piece of it).`);
  return out;
}
/** The closer calls back line 1: the last two lines share a content word with the first line or with the card's closer. */
export function callbackProblem(card, script) {
  const first = contentWords(script.lines[0]?.text), lastTwo = script.lines.slice(-2).map((l) => contentWords(l.text)).flat();
  const cardCloser = contentWords(card?.closer);
  const echoes = lastTwo.some((w) => first.includes(w)) || cardCloser.filter((w) => lastTwo.includes(w)).length >= 2;
  return echoes ? null : "The ending doesn't call back the first line: reuse a word or picture from line 1 in the last two lines.";
}

/**
 * Where each problem sits, so the page can show it next to that part and offer "Fix it" for just that part:
 * [{ problem, part, lines: [index...], fix: "opener" | "part" | "rewrite" }]. A problem with no single place (too short,
 * missing parts, the title) is fixed by a rewrite of the whole script.
 */
export function problemSpots(script, problems) {
  const lines = script?.lines ?? [];
  const partLines = (part) => lines.map((l, i) => (l.part === part ? i : -1)).filter((i) => i >= 0);
  const spot = (problem, part, idx, fix = "part") => ({ problem, part, lines: idx, fix });
  return (problems ?? []).map((p) => {
    if (/^The first line must start/.test(p) && lines.length) return spot(p, lines[0].part, [0], "opener");
    const lineNo = p.match(/^Line (\d+) has/);
    if (lineNo && lines[Number(lineNo[1]) - 1]) { const i = Number(lineNo[1]) - 1; return spot(p, lines[i].part, [i]); }
    if (/never shown before the trouble starts/.test(p)) { const part = partLines("me").length ? "me" : "tour"; return spot(p, part, partLines(part)); }
    if (/never pays off/.test(p) && partLines("climax").length) return spot(p, "climax", partLines("climax"));
    if (/call back the first line/.test(p) && lines.length) { const part = lines.at(-1).part; return spot(p, part, partLines(part)); }
    // the topic check (topic.js): the rule line and the climax can be fixed in place; drifting across the story needs a rewrite
    if (p.startsWith(TOPIC_PREFIX)) {
      if (/the first line /.test(p) && lines.length) { const idx = partLines("rule"); return spot(p, lines[idx[0] ?? 0].part, idx.length ? idx : [0]); }
      if (/the climax never (involves|ends)/.test(p) && partLines("climax").length) return spot(p, "climax", partLines("climax"));
      return spot(p, null, [], "rewrite");
    }
    const word = p.match(/^Uses "([^"]+)"/)?.[1];
    if (word) {
      const i = lines.findIndex((l) => safetyProblems(l.text).some((s) => s.includes(`"${word}"`)));
      if (i >= 0) return spot(p, lines[i].part, [i]);
    }
    return spot(p, null, [], "rewrite");
  });
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
