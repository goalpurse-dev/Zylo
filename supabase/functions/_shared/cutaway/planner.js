// Cutaway Explainer: the plan (script + beats + wide states + surprises + sound)
// and every prompt built from it. Pure: no network, no runtime APIs (Deno and node both import it).
// Method: research/seamless-niche/TEST1_REVIEW.md (R1-R21) and CREATOR_PLAYBOOK.md (sections 1-5).

import { NEVER, STYLE_BLOCK, WATER_RULES } from "./style.js";
import { MODELS } from "./pricing.js";
import { LIBRARY, SOUND_KEYS } from "./sound.js";
import { workFor } from "./pricing.js";

export const MOVES = Object.freeze(["push-in", "pull-out", "follow", "arc", "hold"]);
export const SURPRISE_KINDS = Object.freeze(["fact", "myth", "gross", "danger", "funny"]);
export const MIN_BOX = 0.4; // crops narrower than 40% of the wide image get soft (TEST1_REVIEW.md)

/** Words the narration should have: ~228 wpm once the stitch has sped the voice up. */
// The voice is never sped up (owner, 2026-10-19): the script is sized for the voice's own pace,
// minus ~1.2 s for the end hold.
export const targetWords = (lengthSec, wpm = MODELS.voice.wpm) => Math.round(((lengthSec - 1.2) * wpm) / 60);

/** The script numbers per length (CREATOR_PLAYBOOK.md section 2, scaled to the length). */
export function rulesFor(lengthSec) {
  return lengthSec >= 60
    ? { buts: [4, 6], names: [2, 4], surprises: [3, 4], firstSurpriseBeat: 4, mythFrom: 0.7 }
    : { buts: [2, 3], names: [1, 2], surprises: [2, 3], firstSurpriseBeat: 4, mythFrom: 0.6 };
}

const BOX = { type: "object", additionalProperties: false, required: ["x", "y", "w"], properties: { x: { type: "number" }, y: { type: "number" }, w: { type: "number" } } };

export const PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "facts", "mechanisms", "surprises", "life", "world", "cutaway", "states", "beats", "end"],
  properties: {
    title: { type: "string" },
    facts: { type: "array", items: { type: "object", additionalProperties: false, required: ["claim", "check"], properties: { claim: { type: "string" }, check: { type: "string" } } } },
    mechanisms: { type: "array", items: { type: "string" } },
    surprises: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["beat", "kind", "text", "number"], properties: { beat: { type: "integer" }, kind: { type: "string", enum: [...SURPRISE_KINDS] }, text: { type: "string" }, number: { type: "string" } } },
    },
    life: { type: "string" },
    world: { type: "string" },
    cutaway: { type: "string" },
    states: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["id", "label", "description", "change", "parts", "problem", "checks"],
        properties: {
          id: { type: "string" }, label: { type: "string" }, description: { type: "string" }, change: { type: "string" },
          parts: { type: "array", items: { type: "string" } }, problem: { type: "boolean" }, checks: { type: "array", items: { type: "string" } },
        },
      },
    },
    beats: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        required: ["text", "verb", "state", "box", "show", "edit", "action", "ongoing", "adds", "move", "sound", "card"],
        properties: {
          text: { type: "string" }, verb: { type: "string" }, state: { type: "string" }, box: BOX,
          show: { type: "string" }, edit: { type: "string" }, action: { type: "string" }, ongoing: { type: "string" }, adds: { type: "string" },
          move: { type: "string", enum: [...MOVES] },
          sound: {
            type: "object", additionalProperties: false, required: ["key", "text", "at", "whole"],
            properties: { key: { type: "string", enum: ["", ...SOUND_KEYS] }, text: { type: "string" }, at: { type: "string", enum: ["start", "verb"] }, whole: { type: "boolean" } },
          },
          card: { type: "object", additionalProperties: false, required: ["text", "word"], properties: { text: { type: "string" }, word: { type: "string" } } },
        },
      },
    },
    end: { type: "object", additionalProperties: false, required: ["state", "box", "show", "edit"], properties: { state: { type: "string" }, box: BOX, show: { type: "string" }, edit: { type: "string" } } },
  },
};

export const PLANNER_SYSTEM = `You plan vertical "cutaway explainer" videos: one continuous camera move through a 3D cutaway diorama that shows how something works. These videos get millions of views when they follow the rules below exactly.

STEP 1 — FACTS AND SURPRISES. List every mechanism the video claims in "facts" (claim + why it is true; only physically correct, commonly accepted facts; keep simplifications honest). "mechanisms": short names of each mechanism explained (e.g. "S-bend water trap", "compressor cycle"). Then pick the SURPRISES: concrete, true, ideally with a number ("weighs as much as six cars", "air can only push it 33 feet"). Kinds: fact, myth (the shape "That [familiar thing] is not [assumption], it is [mechanism]"), gross, danger, funny. Placement:
  - the first surprise (often gross or dangerous, physically big) in one of the first 4 beats (~12 s),
  - another in the middle,
  - a myth-bust near the end, about something the viewer has seen or heard in real life.
For each surprise give the beat index (0-based) it lands in and "number": the short number card to show on screen ("= 6 CARS", "33 FT", "50 YEARS"), or "" when it has no number.

STEP 2 — NARRATION. Second person, plain words a 12-year-old knows. Sentences average 15-19 words, NONE over 30 words: put full stops between "But..." and "So you...". The formula:
  HOOK: "If you [ONE naive physical action with an object], you have a [thing]." (never "do the machine's job by hand").
  LOOPS: "But [a failure you can SEE: it floods, sinks, stinks, explodes, cracks]." "So you [add one real part, described physically]."
  NAMES: "This is a [real term]." on the most important parts.
  MYTH-BUST near the end. FINISH: "Add [two or three finishing touches]. Congratulations, you have built a [thing]."
Never explain a mechanism from the USED IDEAS list you are given (a one-line nod back is fine).

STEP 3 — BEATS. Split the narration into beats: one clause of about 3 seconds (8 to 14 words) with exactly ONE visible change. For each beat:
  text     the exact words (all beats joined = the whole narration, in order)
  verb     the one word in text where the change happens on screen, copied exactly
  state    the id of the wide image this beat's FIRST frame is cropped from
  box      the crop for the FIRST frame: x, y top-left, w width, fractions of the wide image (height fraction = w). w 0.4-1. The thing named fills 25-50% of the frame. Two beats in a row never have the same state and nearly the same box.
  show     what is visible in that first frame, concretely
  edit     a small close-up change to apply to the crop, or ""
  action   the one thing that happens, landing on the verb
  ongoing  an action that must keep going for the WHOLE beat (falling rain, flowing water, a moving truck), or ""
  adds     the name of the part that APPEARS during this beat, exactly as written in a state's "parts", or "". APPEARS ON ITS WORD: the beat's own state must NOT contain that part, and the NEXT beat's state (or "end") MUST contain it. Each change from one wide state to the next brings in AT MOST ONE appearing part, so at most (number of states - 1) beats have "adds"; other parts are either in the master already or left out.
  move     how the camera gets to the NEXT beat's first frame at the end of the beat: push-in, pull-out, follow, arc, hold
  sound    0 or 1 short sound effect tied to a clear on-screen action: key = one of ${Object.keys(LIBRARY).join(", ")}, "custom" (then text describes the exact sound, e.g. "garbage bags thudding into a pit"), or "" for none. at = "verb" or "start"; whole = true only for rain. Sparse: at most one effect every two beats (~6 s), only on the strongest moments. No music, never a whoosh for a camera move.
  card     the number card for a surprise landing in this beat: text (e.g. "= 6 CARS") and the word it appears on; or text "" and word "".
"end": the final frame (state, box, show, edit): the solved, calm result, wide or medium.

STEP 4 — WORLD AND STATES.
  world    one paragraph describing the diorama in physical detail (buildings, materials, colours, surroundings, a big soil cross-section where it fits), restated in every prompt
  cutaway  where the cut plane runs: RIGHT THROUGH the part the story is about, so the problem, the cause and the fix are in one frame
  life     ONE moving element that makes the world alive where it fits (a garbage truck, a car, a worker, a dog), or ""; put it in the states where it appears
  states   the wide images in order. states[0] = master "W0" (full description, change ""). Each later state is an EDIT of the previous one: "change" says only what changes (a new part, weather, time passing, a crack), "description" the full resulting scene.
           parts   every part visible in this state (short names; reuse the exact same names across states)
           problem true while the story's problem is still visible in this state
           checks  3-5 short yes/no facts a person could verify by looking at this image (e.g. "the gutter runs along the level bottom edge of the roof", "no water falls from the roof edge", "the pit is lined with a black sheet"). Only about this state.
  Weather or time-passing changes ("ten years later") may be their own state and beat where the story needs it.
  The "end" state must have problem = false.

RULES
- The camera never travels along an empty surface. Big moves go through a wider framing or follow the moving thing.
- The master is tight: subject and cutaway fill about 70% of the frame; the world runs to the frame edges.
- Water: ${WATER_RULES}
- Weather: keep it dry. Rain only if the story is about rain, and then only above ground: the cut-away faces always stay dry (rain drawn on a cut face reads as a leak).
- No drawn explainers: no arrows, dots, glows, symbols or labels in any image or clip. Show how it works with the real parts and what they do.
- Every beat has an action or a part appearing.
- The last beats show the fix working; "end" is calm and the problem is gone.`;

export function plannerUser({ topic, lengthSec, usedIdeas = [] }) {
  const w = workFor(lengthSec);
  const r = rulesFor(lengthSec);
  return [
    `Topic: ${topic}`,
    `Length: ${lengthSec} seconds.`,
    `Narration: about ${targetWords(lengthSec)} words in total.`,
    `Beats: exactly ${w.beats}.`,
    `Wide states: exactly ${w.wideImages} (W0 = master, then W1, W2, ...).`,
    `"But" loops: ${r.buts[0]}-${r.buts[1]}. "This is a" names: ${r.names[0]}-${r.names[1]}. Surprises: ${r.surprises[0]}-${r.surprises[1]}.`,
    usedIdeas.length ? `USED IDEAS (already explained in earlier videos, do not explain again): ${usedIdeas.join("; ")}` : "USED IDEAS: none yet.",
  ].join("\n");
}

export const CRITIC_SYSTEM = `You are the critic for a cutaway explainer plan. You get the plan and a list of problems a program already found. Fix EVERY listed problem and anything else that breaks these checks, then return the whole corrected plan in the same format:
- every fact and surprise is true (fix or replace anything false or overstated; keep numbers honest)
- the hook is one naive physical action with an object, not doing the machine's job by hand
- sentences average 15-19 words, none over 30; "But" loops and "This is a" names in the asked range
- the first surprise lands in the first 4 beats; a myth-bust near the end
- each beat 8-14 words with exactly one visible change; no two beats in a row with the same state and nearly the same box
- "adds": the part is missing from the beat's own state and present in the next beat's state (or "end"); each state change brings in at most one appearing part, so at most (states - 1) beats have "adds"
- every part that appears is named in the narration
- "end" is calm and the problem is gone
- states' "checks" are short yes/no facts you can see in that image, and EVERY check agrees with that state's own "description" and with the plan (never a check that forbids something the scene or the narration includes, e.g. "no gas escaping" when a gas flare is in the scene)
- liquids and gas only go where the story says: if the story is about containing something, the scene and the checks say where it goes and that nothing escapes elsewhere
Change as little as possible otherwise.`;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export function normBox(box) {
  const w = clamp(Number(box?.w) || 1, MIN_BOX, 1);
  return { x: clamp(Number(box?.x) || 0, 0, 1 - w), y: clamp(Number(box?.y) || 0, 0, 1 - w), w };
}

export const words = (text) => String(text ?? "").trim().split(/\s+/).filter(Boolean);
const bare = (w) => String(w).toLowerCase().replace(/[^a-z0-9']/g, "");
const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
export const sentencesOf = (text) => String(text).split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);

/** Box distance in wide-image units: centre distance and size ratio. */
export function boxJump(a, b) {
  const ca = [a.x + a.w / 2, a.y + a.w / 2], cb = [b.x + b.w / 2, b.y + b.w / 2];
  const dist = Math.hypot(ca[0] - cb[0], ca[1] - cb[1]);
  const scale = Math.max(a.w, b.w) / Math.min(a.w, b.w);
  return { dist, scale, far: dist > 0.3 || (dist > 0.18 && scale > 1.8) };
}

/**
 * Shape checks only (is this the plan format at all?): exact beat and state counts, every required
 * field present with the right type. A reply that fails these is malformed (e.g. 95 beats): it is
 * retried once instead of being sent to the critic.
 */
export function shapeProblems(plan, lengthSec) {
  const w = workFor(lengthSec);
  const out = [];
  if (!plan || typeof plan !== "object") return ["not an object"];
  const str = (v) => typeof v === "string";
  const isBox = (b) => b && ["x", "y", "w"].every((k) => typeof b[k] === "number" && Number.isFinite(b[k]));
  if (!Array.isArray(plan.facts) || !plan.facts.length) out.push("facts missing");
  if (!Array.isArray(plan.surprises)) out.push("surprises missing");
  if (!Array.isArray(plan.mechanisms)) out.push("mechanisms missing");
  if (!str(plan.world) || !str(plan.cutaway)) out.push("world or cutaway missing");
  if (!Array.isArray(plan.states) || plan.states.length !== w.wideImages) out.push(`states: ${plan.states?.length ?? 0} (must be exactly ${w.wideImages})`);
  else plan.states.forEach((s, i) => { if (!str(s?.id) || !str(s?.description) || !Array.isArray(s?.parts) || !Array.isArray(s?.checks) || typeof s?.problem !== "boolean") out.push(`state ${i + 1} malformed`); });
  if (!Array.isArray(plan.beats) || plan.beats.length !== w.beats) out.push(`beats: ${plan.beats?.length ?? 0} (must be exactly ${w.beats})`);
  else plan.beats.forEach((b, i) => { if (!str(b?.text) || !str(b?.verb) || !str(b?.state) || !isBox(b?.box) || !str(b?.show) || !str(b?.action)) out.push(`beat ${i + 1} malformed`); });
  if (!plan.end || !str(plan.end.state) || !isBox(plan.end.box)) out.push("end malformed");
  return out;
}

/** Closest word in `text` to `want` (same word, then the longest shared start of 4+ letters), or null. */
function closestWord(text, want) {
  const ws = words(text).map(bare).filter(Boolean);
  const w = bare(want);
  if (!w) return null;
  if (ws.includes(w)) return w;
  let best = null, bestLen = 3;
  for (const x of ws) {
    let k = 0;
    while (k < Math.min(x.length, w.length) && x[k] === w[k]) k++;
    if (k > bestLen) { best = x; bestLen = k; }
  }
  return best;
}

/**
 * The program's own bookkeeping, done before any check (the model kept getting it off by one):
 *  - "appears on its word": a beat that adds a part starts from the last state WITHOUT it, and the
 *    next frame comes from the first state WITH it (all states are edits of one camera, so the crop boxes stay valid)
 *  - a verb or card word that isn't in its beat's text -> the closest word that is (e.g. "seals" -> "seal")
 * Content is never touched.
 */
export function repairStructure(input) {
  if (!input || !Array.isArray(input.beats) || !Array.isArray(input.states)) return input;
  const plan = JSON.parse(JSON.stringify(input));
  const index = new Map(plan.states.map((s, i) => [s.id, i]));
  const hasAt = (i, part) => (plan.states[i]?.parts ?? []).some((p) => norm(p) === norm(part));
  plan.beats.forEach((b) => {
    const v = closestWord(b.text, b.verb);
    if (v && bare(b.verb) !== v) b.verb = words(b.text).find((x) => bare(x) === v);
    if (b.card?.text && b.card.word) {
      const c = closestWord(b.text, b.card.word) ?? bare(b.verb);
      b.card.word = words(b.text).find((x) => bare(x) === c) ?? b.verb;
    }
  });
  // "Appears on its word" needs one change between wide images per appearing part. Assign states in
  // story order: each appearing part gets the step into the first state that shows it, if that step
  // isn't taken yet and comes later than the last one used. Parts that can't get their own step
  // (more parts than images, or two parts first shown in the same state) stay in the plan but lose
  // "adds": they are listed in plan.addsDropped and reported as warnings, never as failures.
  const frames = [...plan.beats, plan.end];
  const firstOf = (part) => plan.states.findIndex((_, k) => hasAt(k, part));
  const dropped = [];
  let floor = 0; // frames after the last appearing part are at least this state
  plan.beats.forEach((b, i) => {
    if (!b.adds) return;
    const first = firstOf(b.adds);
    if (first < 0) return; // no state shows the part: left for the checks and the critic
    // In the master already (it can't appear), or its step into `first` is taken / already passed.
    if (first === 0 || first - 1 < floor) { dropped.push(b.adds); b.adds = ""; return; }
    for (let k = 0; k <= i; k++) { const s = index.get(frames[k].state) ?? 0; if (s > first - 1) frames[k].state = plan.states[first - 1].id; }
    frames[i].state = plan.states[first - 1].id;
    for (let k = i + 1; k < frames.length; k++) { const s = index.get(frames[k].state) ?? 0; if (s < first) frames[k].state = plan.states[first].id; }
    floor = first;
  });
  if (dropped.length) plan.addsDropped = dropped;
  return plan;
}

/** True when the narration of the last part has the myth-bust shape ("... is not ..., it is ..."). */
function narrationHasMyth(plan, from) {
  return plan.beats.slice(from).some((b) => /\b(is not|isn't|are not|aren't)\b/i.test(b.text) && /\b(it is|it's|they are|they're|that is)\b/i.test(b.text.split(/\b(?:is not|isn't|are not|aren't)\b/i)[1] ?? ""));
}

/** Softer checks: reported to the critic and kept on the run, but never fail it. */
export function planWarnings(plan) {
  const out = [];
  if (!Array.isArray(plan?.beats)) return out;
  const narration = norm(plan.beats.map((b) => b.text).join(" "));
  for (const b of plan.beats) if (b.adds && !norm(b.adds).split(" ").some((t) => t.length > 3 && narration.includes(t))) out.push(`the part "${b.adds}" appears but is never named`);
  for (const p of plan.addsDropped ?? []) out.push(`"${p}" can't appear on its own word (not enough changes between wide images): it is already visible before it is named`);
  return out;
}

/** All the program's checks. Returns a list of problems (empty = fine). */
export function planProblems(plan, lengthSec, usedIdeas = [], opts = {}) {
  const w = workFor(lengthSec);
  const r = rulesFor(lengthSec);
  const problems = [];
  if (!plan || typeof plan !== "object") return ["not an object"];
  if (!Array.isArray(plan.facts) || plan.facts.length === 0) problems.push("no facts");
  if (!Array.isArray(plan.states) || plan.states.length !== w.wideImages) problems.push(`states: ${plan.states?.length} (want exactly ${w.wideImages})`);
  if (!Array.isArray(plan.beats) || plan.beats.length !== w.beats) problems.push(`beats: ${plan.beats?.length} (want exactly ${w.beats})`);
  if (problems.length) return problems;
  const states = new Map(plan.states.map((s) => [s.id, s]));
  const has = (stateId, part) => (states.get(stateId)?.parts ?? []).some((p) => norm(p) === norm(part));
  plan.beats.forEach((b, i) => {
    const n = i + 1;
    if (!states.has(b.state)) problems.push(`beat ${n}: unknown state ${b.state}`);
    const wc = words(b.text).length;
    if (wc < 5 || wc > 16) problems.push(`beat ${n}: ${wc} words (want 6-14)`);
    if (!words(b.text).some((x) => bare(x) === bare(b.verb))) problems.push(`beat ${n}: verb "${b.verb}" not in its text`);
    if (!MOVES.includes(b.move)) problems.push(`beat ${n}: move ${b.move}`);
    const nextState = i + 1 < plan.beats.length ? plan.beats[i + 1].state : plan.end?.state;
    if (b.adds) {
      if (has(b.state, b.adds)) problems.push(`beat ${n} adds "${b.adds}" but its own state ${b.state} already shows it (it must appear on its word)`);
      if (!has(nextState, b.adds)) problems.push(`beat ${n} adds "${b.adds}" but the next state ${nextState} doesn't list it in parts`);
    }
    if (i > 0) {
      const p = plan.beats[i - 1];
      if (p.state === b.state && boxJump(normBox(p.box), normBox(b.box)).dist < 0.06 && Math.abs(normBox(p.box).w - normBox(b.box).w) < 0.08) problems.push(`beats ${i} and ${n}: same state and nearly the same framing`);
    }
    if (b.sound?.key === "custom" && !String(b.sound.text ?? "").trim()) problems.push(`beat ${n}: custom sound without a description`);
    if (b.card?.text && !words(b.text).some((x) => bare(x) === bare(b.card.word))) problems.push(`beat ${n}: card word "${b.card.word}" not in its text`);
  });
  if (!states.has(plan.end?.state)) problems.push(`end: unknown state ${plan.end?.state}`);
  else if (states.get(plan.end.state).problem) problems.push(`end state ${plan.end.state} still shows the problem (problem must be false)`);
  // script shape
  const text = plan.beats.map((b) => b.text.trim()).join(" ");
  const total = words(text).length;
  const [lo, hi] = opts.wordRange ?? [targetWords(lengthSec) * 0.8, targetWords(lengthSec) * 1.2];
  if (total < lo || total > hi) problems.push(`narration ${total} words (want ~${targetWords(lengthSec)})`);
  const sents = sentencesOf(text);
  const lens = sents.map((s) => words(s).length);
  const avg = total / Math.max(1, sents.length);
  if (avg > 20) problems.push(`sentences average ${avg.toFixed(1)} words (want 15-19)`);
  lens.forEach((l, i) => { if (l > 30) problems.push(`sentence ${i + 1} has ${l} words (max 30): "${sents[i].slice(0, 60)}..."`); });
  const low = text.toLowerCase();
  const buts = (low.match(/\bbut\b/g) ?? []).length;
  const names = (low.match(/\b(this|that) is (called )?(a|an|the)\b/g) ?? []).length;
  if (buts < r.buts[0] || buts > r.buts[1] + 1) problems.push(`${buts} "But" loops (want ${r.buts[0]}-${r.buts[1]})`);
  if (names < r.names[0] || names > r.names[1] + 1) problems.push(`${names} "This is a" names (want ${r.names[0]}-${r.names[1]})`);
  if (!/^if you\b/i.test(plan.beats[0].text.trim()) || !/\byou have (a|an)\b/i.test(plan.beats.slice(0, 2).map((b) => b.text).join(" "))) problems.push(`the hook must be "If you ..., you have a ..."`);
  if (!/congratulations/i.test(plan.beats.at(-1).text)) problems.push(`the last beat must end "Congratulations, you have built a ..."`);
  // surprises
  const sp = Array.isArray(plan.surprises) ? plan.surprises : [];
  if (sp.length < r.surprises[0]) problems.push(`${sp.length} surprises (want ${r.surprises[0]}-${r.surprises[1]})`);
  if (sp.length && Math.min(...sp.map((s) => s.beat)) > r.firstSurpriseBeat - 1) problems.push(`the first surprise is in beat ${Math.min(...sp.map((s) => s.beat)) + 1} (must be in the first ${r.firstSurpriseBeat})`);
  const mythFrom = Math.floor(w.beats * r.mythFrom);
  if (!sp.some((s) => s.kind === "myth" && s.beat >= mythFrom) && !narrationHasMyth(plan, mythFrom)) problems.push(`no myth-bust ("That X is not Y, it is Z") in the last part`);
  sp.forEach((s) => { if (s.beat < 0 || s.beat >= w.beats) problems.push(`surprise "${s.text.slice(0, 40)}" points at beat ${s.beat}`); });
  // used ideas
  const used = usedIdeas.map(norm).filter(Boolean);
  for (const m of plan.mechanisms ?? []) if (used.includes(norm(m))) problems.push(`mechanism "${m}" was already explained in an earlier video`);
  return problems;
}

/** Normalises a plan that passed planProblems. */
export function normalizePlan(plan) {
  return {
    ...plan,
    life: String(plan.life ?? "").trim(),
    states: plan.states.map((s, i) => ({ ...s, change: i === 0 ? "" : s.change, parts: s.parts ?? [], checks: (s.checks ?? []).slice(0, 5) })),
    beats: plan.beats.map((b) => ({
      ...b, box: normBox(b.box), edit: String(b.edit ?? "").trim(), ongoing: String(b.ongoing ?? "").trim(), adds: String(b.adds ?? "").trim(),
      sound: b.sound?.key ? { key: b.sound.key, text: String(b.sound.text ?? "").trim(), at: b.sound.at === "start" ? "start" : "verb", whole: Boolean(b.sound.whole) } : null,
      card: b.card?.text ? { text: String(b.card.text).trim().toUpperCase(), word: String(b.card.word).trim() } : null,
    })),
    end: { ...plan.end, box: normBox(plan.end.box), edit: String(plan.end.edit ?? "").trim() },
  };
}

/** Repairs the bookkeeping, checks the plan and returns a normalised copy, or throws with the reasons. */
export function validatePlan(input, lengthSec, usedIdeas = [], opts = {}) {
  const plan = repairStructure(input);
  const problems = planProblems(plan, lengthSec, usedIdeas, opts);
  if (problems.length) throw Object.assign(new Error(`PLAN_INVALID: ${problems.join("; ")}`), { problems });
  return normalizePlan(plan);
}

export const narrationText = (plan) => plan.beats.map((b) => b.text.trim()).join(" ");

/** The plan context the vision check gets: the narration, the named elements and the actions. */
export function visionContext(plan) {
  const parts = [...new Set(plan.states.flatMap((s) => s.parts ?? []))];
  return [
    `Narration: ${narrationText(plan)}`,
    `Named elements: ${parts.join(", ")}${plan.life ? `, ${plan.life}` : ""}`,
    `Actions: ${plan.beats.map((b) => b.action).filter(Boolean).join("; ")}`,
  ].join("\n").slice(0, 3000);
}

/**
 * The keyframes and the clips between them. One keyframe at the start of each beat plus the end frame.
 * A beat whose framing jumps far (boxJump.far) is routed through a wider "via" keyframe:
 * two clips, A = action then pull back to the via frame (60% of the beat), B = push in to the next frame (40%).
 */
export function framesOf(plan) {
  const base = [
    ...plan.beats.map((b, i) => ({ id: `k${i}`, beat: i, state: b.state, box: b.box, show: b.show, edit: b.edit })),
    { id: `k${plan.beats.length}`, beat: plan.beats.length, state: plan.end.state, box: plan.end.box, show: plan.end.show, edit: plan.end.edit },
  ];
  const frames = [...base];
  const segments = [];
  plan.beats.forEach((b, i) => {
    const from = base[i], to = base[i + 1];
    const jump = boxJump(from.box, to.box);
    if (!jump.far) { segments.push({ beat: i, from: from.id, to: to.id, part: "whole", frac: 1 }); return; }
    // the wider frame covering both, cropped from the state that already shows any new part
    const left = Math.min(from.box.x, to.box.x), top = Math.min(from.box.y, to.box.y);
    const right = Math.max(from.box.x + from.box.w, to.box.x + to.box.w), bottom = Math.max(from.box.y + from.box.w, to.box.y + to.box.w);
    const wv = Math.min(1, Math.max(right - left, bottom - top) * 1.05);
    const via = { id: `v${i}`, beat: i, state: b.adds ? to.state : from.state, box: normBox({ x: (left + right) / 2 - wv / 2, y: (top + bottom) / 2 - wv / 2, w: wv }), show: `a wider view taking in both: ${from.show}; and ${to.show}`, edit: "", via: true };
    frames.push(via);
    segments.push({ beat: i, from: from.id, to: via.id, part: "a", frac: 0.6 }, { beat: i, from: via.id, to: to.id, part: "b", frac: 0.4 });
  });
  return { frames, segments };
}

// ---------- prompts ----------

export function masterPrompt(plan) {
  const s = plan.states[0];
  return [
    STYLE_BLOCK,
    `The scene: ${plan.world}`,
    `The cutaway: ${plan.cutaway}`,
    s.description,
    "Elevated three-quarter view, wide lens. The subject and the cut-away section fill about 70% of the frame.",
    WATER_RULES,
    NEVER,
  ].join("\n");
}

export function statePrompt(plan, i, fix = "") {
  const s = plan.states[i];
  return [
    "Same image, same camera, same composition, same buildings and surroundings, same style. Change only this:",
    s.change,
    `The result: ${s.description}`,
    s.checks?.length ? `It must be true in the result: ${s.checks.join("; ")}.` : "",
    fix ? `The last attempt got this wrong, fix it: ${fix}` : "",
    WATER_RULES,
    NEVER,
  ].filter(Boolean).join("\n");
}

export function masterPromptWithFix(plan, fix) {
  const s = plan.states[0];
  return [masterPrompt(plan), s.checks?.length ? `It must be true in the image: ${s.checks.join("; ")}.` : "", fix ? `The last attempt got this wrong, fix it: ${fix}` : ""].filter(Boolean).join("\n");
}

export function keyframeEditPrompt(edit) {
  return ["Same image, same framing, same style; keep everything identical except this one change:", edit, WATER_RULES, NEVER].join("\n");
}

const MOVE_COPY = {
  "push-in": "pushes in",
  "pull-out": "pulls back",
  follow: "follows the moving water or air",
  arc: "arcs smoothly",
  hold: "keeps drifting slowly",
};

/**
 * One clip (a segment of a beat). verbAtSec: when the verb lands, on the clip's own clock.
 * Part "a" of a far jump: action, then pull back to the wider frame. Part "b": push in to the next frame.
 */
export function clipPrompt(plan, seg, { clipSec, verbAtSec, toShow }) {
  const b = plan.beats[seg.beat];
  const state = plan.states.find((s) => s.id === b.state) ?? plan.states[0];
  const life = plan.life ? ` ${plan.life} moves naturally where it appears.` : "";
  const ongoing = b.ongoing ? `The whole time, from the first frame to the last: ${b.ongoing}.` : "";
  const parts = [STYLE_BLOCK, `The scene: ${plan.world} ${state.description}${life}`];
  if (seg.part === "b") {
    parts.push(`The camera smoothly pushes in over the whole clip to: ${toShow}. ${ongoing}`.trim());
  } else {
    const moveSec = seg.part === "a" ? 1.0 : b.move === "hold" ? 0 : 0.7;
    const driftUntil = Math.max(0.5, clipSec - moveSec).toFixed(1);
    const at = Math.max(0.2, Math.min(clipSec - moveSec - 0.2, verbAtSec ?? clipSec / 2)).toFixed(1);
    parts.push(`First frame: ${b.show}.`, `At about ${at} seconds: ${b.action}.`);
    if (ongoing) parts.push(ongoing);
    parts.push(moveSec
      ? `The camera drifts slowly until ${driftUntil} seconds; in the last ${moveSec} seconds it ${seg.part === "a" ? "pulls back" : MOVE_COPY[b.move]} smoothly to: ${toShow}.`
      : `The camera drifts slowly the whole time, ending on: ${toShow}.`);
  }
  parts.push("The camera is still drifting slowly at the very end. One continuous shot, no cuts.", WATER_RULES, "Silent: no music, no voices.", NEVER);
  let text = parts.join("\n");
  if (text.length > 2000) text = parts.filter((p) => p !== WATER_RULES).join("\n");
  return text.slice(0, 2000);
}
