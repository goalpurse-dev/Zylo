// Cutaway Explainer: the plan (script + beats + wide states) and every prompt
// built from it. Pure: no network, no runtime APIs (Deno and node both import it).
// Method: research/seamless-niche/TEST1_REVIEW.md (rules R1-R21).

import { NEVER, OVERLAYS, STYLE_BLOCK, WATER_RULES } from "./style.js";
import { workFor } from "./pricing.js";

export const MOVES = Object.freeze(["push-in", "pull-out", "follow", "arc", "hold"]);
export const MIN_BOX = 0.4; // crops narrower than 40% of the wide image get soft (TEST1_REVIEW.md)

/** Words the narration should have: ~228 wpm once the stitch has sped the voice up. */
export const targetWords = (lengthSec) => Math.round(lengthSec * 3.8);

export const PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "facts", "world", "cutaway", "states", "beats", "end"],
  properties: {
    title: { type: "string" },
    facts: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["claim", "check"], properties: { claim: { type: "string" }, check: { type: "string" } } },
    },
    world: { type: "string" },
    cutaway: { type: "string" },
    states: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["id", "label", "description", "change"],
        properties: { id: { type: "string" }, label: { type: "string" }, description: { type: "string" }, change: { type: "string" } },
      },
    },
    beats: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        required: ["text", "verb", "state", "box", "show", "edit", "action", "overlay", "move"],
        properties: {
          text: { type: "string" },
          verb: { type: "string" },
          state: { type: "string" },
          box: { type: "object", additionalProperties: false, required: ["x", "y", "w"], properties: { x: { type: "number" }, y: { type: "number" }, w: { type: "number" } } },
          show: { type: "string" },
          edit: { type: "string" },
          action: { type: "string" },
          overlay: { type: "string", enum: Object.keys(OVERLAYS) },
          move: { type: "string", enum: [...MOVES] },
        },
      },
    },
    end: {
      type: "object", additionalProperties: false, required: ["state", "box", "show", "edit"],
      properties: {
        state: { type: "string" },
        box: { type: "object", additionalProperties: false, required: ["x", "y", "w"], properties: { x: { type: "number" }, y: { type: "number" }, w: { type: "number" } } },
        show: { type: "string" },
        edit: { type: "string" },
      },
    },
  },
};

export const PLANNER_SYSTEM = `You plan short vertical "cutaway explainer" videos: one continuous camera move through a 3D cutaway diorama that shows how something works.

STEP 1 — FACTS. Before writing, list every mechanism the video will claim in "facts" (claim + why it is true). Only use mechanisms that are physically correct and commonly accepted. If something is a simplification, keep it honest.

STEP 2 — NARRATION. Second person, short sentences, this formula:
  "If you [naive first step], you have a [thing]." -> "But [concrete failure the viewer can picture]." -> "So you [add one real part]." (repeat) -> "This is a [real term]." -> "Congratulations, you have built a [thing]."
For a 15 s video you may compress: hook, one or two problem/fix rounds, the name, the closer. Use plain words a 12-year-old knows.

STEP 3 — BEATS. Split the narration into beats. Each beat is one clause of about 3 seconds with exactly ONE visible change (R2). For each beat give:
  text     the exact words of that clause (all beats joined = the whole narration, in order, nothing left out)
  verb     the one word in text where the change must happen on screen (R5), copied exactly
  state    the id of the wide image this beat's first frame is cropped from
  box      the crop of that wide image for the beat's FIRST frame: x, y = top-left, w = width, all as fractions of the wide image (the crop keeps 9:16, so its height fraction equals w). w between 0.4 and 1. When something is named it must fill 25-50% of the frame (R7): use a close crop on it.
  show     what is visible in that first frame, concretely
  edit     a small close-up change to apply to the crop (e.g. "the ground along the wall is dark and wet"), or "" if the crop is right as it is
  action   what happens during the beat, landing on the verb (one action only)
  overlay  one explainer overlay built into the scene (R11): ${Object.entries(OVERLAYS).map(([k, v]) => `${k} = ${v}`).join("; ")}
  move     how the camera gets to the NEXT beat's first frame in the last 0.6-0.8 s: push-in, pull-out, follow (ride along with moving water/air/current), arc, or hold (R6, R8)
Then "end": the final frame (state, box, show, edit) — the solved, calm result shown wide or medium (R3).

STEP 4 — WORLD AND STATES.
  world    one paragraph describing the diorama in physical detail (buildings, materials, colours, surroundings), restated in every prompt
  cutaway  where the cut plane runs: it must run RIGHT THROUGH the part the story is about, so the problem, the cause and the fix are visible in one frame (R9)
  states   the wide images, in order. states[0] is the master (id "W0"): describe it fully in "description"; "change" = "". Each later state is an EDIT of the previous one: "change" says only what changes (weather, a new part, a crack), "description" says the full resulting scene. Use exactly the number of states asked for. A beat that adds a new part starts from a state WITHOUT the part, and the next beat's first frame (or "end") comes from a state WITH it, so the part appears on screen during the beat that names it (R13).

RULES
- The camera never travels along an empty surface (R8). Big moves go through a wider framing or follow the moving thing.
- The wide master is tight: the subject and the cutaway fill about 70% of the frame (R10).
- Water: ${WATER_RULES}
- Nothing new for more than one beat without an action, overlay or prop appearing (R12).
- The last beats must show the fix working, and "end" shows the solved state (R1, R3).`;

export function plannerUser({ topic, lengthSec }) {
  const w = workFor(lengthSec);
  return [
    `Topic: ${topic}`,
    `Length: ${lengthSec} seconds.`,
    `Narration: about ${targetWords(lengthSec)} words in total.`,
    `Beats: exactly ${w.beats}.`,
    `Wide states: exactly ${w.wideImages} (W0 = master, then W1, W2, ...).`,
  ].join("\n");
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export function normBox(box) {
  const w = clamp(Number(box?.w) || 1, MIN_BOX, 1);
  return { x: clamp(Number(box?.x) || 0, 0, 1 - w), y: clamp(Number(box?.y) || 0, 0, 1 - w), w };
}

export const words = (text) => String(text ?? "").trim().split(/\s+/).filter(Boolean);
const bare = (w) => w.toLowerCase().replace(/[^a-z0-9']/g, "");

/** Checks the LLM plan and returns a normalised copy, or throws with the reason. */
export function validatePlan(plan, lengthSec) {
  const w = workFor(lengthSec);
  const problems = [];
  if (!plan || typeof plan !== "object") throw new Error("PLAN_INVALID: not an object");
  if (!Array.isArray(plan.facts) || plan.facts.length === 0) problems.push("no facts");
  if (!Array.isArray(plan.states) || plan.states.length !== w.wideImages) problems.push(`states: ${plan.states?.length} (want ${w.wideImages})`);
  if (!Array.isArray(plan.beats) || plan.beats.length !== w.beats) problems.push(`beats: ${plan.beats?.length} (want ${w.beats})`);
  const ids = new Set((plan.states ?? []).map((s) => s.id));
  (plan.beats ?? []).forEach((b, i) => {
    if (!ids.has(b.state)) problems.push(`beat ${i + 1}: unknown state ${b.state}`);
    if (!words(b.text).length) problems.push(`beat ${i + 1}: no text`);
    if (!words(b.text).some((x) => bare(x) === bare(b.verb))) problems.push(`beat ${i + 1}: verb "${b.verb}" not in its text`);
    if (!MOVES.includes(b.move)) problems.push(`beat ${i + 1}: move ${b.move}`);
    if (!OVERLAYS[b.overlay]) problems.push(`beat ${i + 1}: overlay ${b.overlay}`);
  });
  if (!ids.has(plan.end?.state)) problems.push(`end: unknown state ${plan.end?.state}`);
  const total = (plan.beats ?? []).reduce((n, b) => n + words(b.text).length, 0);
  if (total < targetWords(lengthSec) * 0.7 || total > targetWords(lengthSec) * 1.3) problems.push(`narration ${total} words (want ~${targetWords(lengthSec)})`);
  if (problems.length) throw new Error(`PLAN_INVALID: ${problems.join("; ")}`);
  return {
    ...plan,
    states: plan.states.map((s, i) => ({ ...s, id: s.id, change: i === 0 ? "" : s.change })),
    beats: plan.beats.map((b) => ({ ...b, box: normBox(b.box), edit: String(b.edit ?? "").trim() })),
    end: { ...plan.end, box: normBox(plan.end.box), edit: String(plan.end.edit ?? "").trim() },
  };
}

export const narrationText = (plan) => plan.beats.map((b) => b.text.trim()).join(" ");

/** The keyframes: one at the start of each beat, plus the end frame. */
export function keyframesOf(plan) {
  return [
    ...plan.beats.map((b, i) => ({ index: i, state: b.state, box: b.box, show: b.show, edit: b.edit })),
    { index: plan.beats.length, state: plan.end.state, box: plan.end.box, show: plan.end.show, edit: plan.end.edit },
  ];
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

export function statePrompt(plan, i) {
  const s = plan.states[i];
  return [
    "Same image, same camera, same composition, same house and surroundings, same style. Change only this:",
    s.change,
    `The result: ${s.description}`,
    WATER_RULES,
    NEVER,
  ].join("\n");
}

export function keyframeEditPrompt(edit) {
  return [
    "Same image, same framing, same style; keep everything identical except this one change:",
    edit,
    WATER_RULES,
    NEVER,
  ].join("\n");
}

const MOVE_COPY = {
  "push-in": "pushes in quickly",
  "pull-out": "pulls back quickly",
  follow: "follows the moving water or air quickly",
  arc: "arcs smoothly",
  hold: "keeps drifting slowly",
};

/**
 * One clip: beat i, from keyframe i to keyframe i+1 (R2, R5, R6).
 * verbAtSec: when the verb lands, in seconds from the clip start (already scaled to the clip's own length).
 */
export function clipPrompt(plan, i, { clipSec, verbAtSec }) {
  const b = plan.beats[i];
  const next = i + 1 < plan.beats.length ? plan.beats[i + 1] : plan.end;
  const state = plan.states.find((s) => s.id === b.state) ?? plan.states[0];
  const moveSec = b.move === "hold" ? 0 : 0.7;
  const driftUntil = Math.max(0.5, clipSec - moveSec).toFixed(1);
  const at = Math.max(0.2, Math.min(clipSec - moveSec - 0.2, verbAtSec ?? clipSec / 2)).toFixed(1);
  const parts = [
    STYLE_BLOCK,
    `The scene: ${plan.world} ${state.description}`,
    `First frame: ${b.show}.`,
    `At about ${at} seconds: ${b.action}. Shown with ${OVERLAYS[b.overlay]}.`,
    moveSec
      ? `The camera drifts slowly until ${driftUntil} seconds; in the last ${moveSec} seconds it ${MOVE_COPY[b.move]} to the next view: ${next.show}.`
      : `The camera drifts slowly the whole time, ending on: ${next.show}.`,
    "The camera is still drifting slowly at the very end. One continuous shot, no cuts.",
    WATER_RULES,
    "Silent: no music, no voices.",
    NEVER,
  ];
  let text = parts.join("\n");
  if (text.length > 2000) text = parts.filter((p) => p !== WATER_RULES).join("\n");
  return text.slice(0, 2000);
}
