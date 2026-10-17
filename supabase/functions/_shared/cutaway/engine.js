// Cutaway Explainer: the run, one small step at a time.
//
// advance(state, deps) moves a run forward without ever waiting long: it
// submits Runware tasks, polls each pending one once, and returns the new
// state. The caller saves it and calls again a few seconds later (the edge
// function per browser tick, the local runner in a loop). Pure apart from deps.
//
// Steps: plan -> voice -> wide -> approval (STOP: the user approves) ->
//        keyframes -> clips -> render -> done   (or failed)
//
// deps = {
//   planVideo({topic, lengthSec}) -> {plan, costUsd}
//   synthesize({text}) -> {audioBase64, spoken:[{w,s,e}], costUsd}   (null = no voice: script only)
//   saveAudio(base64) -> url
//   send(tasks[]) -> {status, body}            Runware transport
//   crop({imageUrl, box}) -> {image, h}        9:16 crop as a URL or data URI, and its height in px
//   keep(url, name) -> url                     copy a provider URL to our storage (identity on the local runner)
//   startRender(job) -> handle;  checkRender(handle) -> {state:"pending"|"done"|"error", url?, message?}
// }

import { clipTimings, evenBeats, placeBeats, upscaleFactor, voiceTempo } from "./beats.js";
import { clipPrompt, keyframeEditPrompt, keyframesOf, masterPrompt, narrationText, statePrompt } from "./planner.js";
import { clipTask, imageTask, poll, submit, upscaleTask } from "./runware.js";

export const STEPS = Object.freeze(["plan", "voice", "wide", "approval", "keyframes", "clips", "render", "done"]);
const MAX_ATTEMPTS = 2; // one retry per task, never more (no auto-retry loops)

export function newRun({ topic, lengthSec }) {
  return { topic, lengthSec, step: "plan", attempts: {}, costs: {}, plan: null, voice: null, timing: null, wide: [], keyframes: [], clips: [], render: null, finalUrl: null, error: null };
}

const clone = (s) => JSON.parse(JSON.stringify(s));
const addCost = (s, stage, usd) => { s.costs[stage] = Number(((s.costs[stage] ?? 0) + (Number(usd) || 0)).toFixed(5)); };
const fail = (s, message) => { s.error = message; s.failedAt = s.step; s.step = "failed"; return s; };

export async function advance(input, deps) {
  const s = clone(input);
  try {
    if (s.step === "plan") return await stepPlan(s, deps);
    if (s.step === "voice") return await stepVoice(s, deps);
    if (s.step === "wide") return await stepWide(s, deps);
    if (s.step === "keyframes") return await stepKeyframes(s, deps);
    if (s.step === "clips") return await stepClips(s, deps);
    if (s.step === "render") return await stepRender(s, deps);
    return s; // approval, done, failed: nothing to do
  } catch (e) {
    return fail(s, e instanceof Error ? e.message : String(e));
  }
}

async function stepPlan(s, deps) {
  s.attempts.plan = (s.attempts.plan ?? 0) + 1;
  try {
    const { plan, costUsd } = await deps.planVideo({ topic: s.topic, lengthSec: s.lengthSec });
    addCost(s, "plan", costUsd);
    s.plan = plan;
    s.narration = narrationText(plan);
    s.step = "voice";
  } catch (e) {
    addCost(s, "plan", e?.costUsd);
    if (s.attempts.plan >= MAX_ATTEMPTS) return fail(s, e.message);
  }
  return s;
}

async function stepVoice(s, deps) {
  if (!deps.synthesize) {
    // No voice in this setup: even beats; the user records the script.
    s.voice = null;
    s.timing = timingFrom(s.plan, evenBeats(s.plan.beats, s.lengthSec));
  } else {
    s.attempts.voice = (s.attempts.voice ?? 0) + 1;
    try {
      const { audioBase64, spoken, costUsd } = await deps.synthesize({ text: s.narration });
      addCost(s, "voice", costUsd);
      const tempo = voiceTempo(spoken);
      const url = await deps.saveAudio(audioBase64);
      s.voice = { url, tempo, words: spoken.map((w) => ({ w: w.w, s: round(w.s / tempo), e: round(w.e / tempo) })) };
      s.timing = timingFrom(s.plan, placeBeats(s.plan.beats, spoken, tempo));
    } catch (e) {
      if (s.attempts.voice >= MAX_ATTEMPTS) return fail(s, e.message);
      return s;
    }
  }
  s.wide = s.plan.states.map((st, i) => ({ id: st.id, label: st.label, status: "pending", attempts: 0, prompt: i === 0 ? masterPrompt(s.plan) : statePrompt(s.plan, i) }));
  s.step = "wide";
  return s;
}

function timingFrom(plan, placed) {
  const clips = clipTimings(placed);
  return { placed, clips, lengthSec: round(placed[placed.length - 1].end) };
}

/** Wide images in order: each state is an edit of the one before it (R: "edit wide"). */
async function stepWide(s, deps) {
  const i = s.wide.findIndex((w) => w.status !== "done");
  if (i < 0) { s.step = "approval"; return s; }
  const w = s.wide[i];
  if (w.status === "pending") {
    w.attempts += 1;
    const references = i === 0 ? [] : [s.wide[i - 1].url];
    const { taskUUID, early } = await submit(deps.send, imageTask({ prompt: w.prompt, references }));
    w.taskUUID = taskUUID;
    w.status = "submitted";
    if (early) await finishWide(s, w, early, deps);
    return s;
  }
  const r = await poll(deps.send, w.taskUUID);
  await finishWide(s, w, r, deps);
  return s;
}

async function finishWide(s, w, r, deps) {
  if (r.state === "pending") return;
  addCost(s, "wide", r.cost);
  if (r.state === "error") {
    if (w.attempts >= MAX_ATTEMPTS) { fail(s, `Wide image ${w.id}: ${r.message}`); return; }
    w.status = "pending";
    return;
  }
  w.url = await deps.keep(r.url, `wide-${w.id}-${w.attempts}.jpg`);
  w.status = "done";
}

/** The user's "Regenerate" on wide image i: it and every later state (each is an edit of the one before). */
export function regenerateWide(input, i) {
  const s = clone(input);
  if (s.step !== "approval" || !s.wide[i]) throw new Error("REGENERATE_NOT_ALLOWED");
  for (let k = i; k < s.wide.length; k++) Object.assign(s.wide[k], { status: "pending", attempts: 0, taskUUID: null, url: null });
  s.step = "wide";
  return s;
}

/** The user's "Looks good -> make video". */
export function approve(input) {
  const s = clone(input);
  if (s.step !== "approval") throw new Error("APPROVE_NOT_ALLOWED");
  s.keyframes = keyframesOf(s.plan).map((k) => ({ ...k, stage: "crop", attempts: 0 }));
  s.step = "keyframes";
  return s;
}

/** Keyframes: crop the approved wide image -> faithful upscale -> the small close-up edit (if any). */
async function stepKeyframes(s, deps) {
  let crops = 0; // the edge runtime has ~2 s of CPU per request: a few crops per call
  for (const k of s.keyframes) {
    if (k.stage === "done") continue;
    if (k.stage === "crop") {
      if (crops >= (deps.maxCropsPerTick ?? Infinity)) continue;
      crops += 1;
      const source = s.wide.find((w) => w.id === k.state) ?? s.wide[0];
      const { image, h } = await deps.crop({ imageUrl: source.url, box: k.box });
      const { taskUUID, early } = await submit(deps.send, upscaleTask({ image, factor: upscaleFactor(h) }));
      Object.assign(k, { stage: "upscale", taskUUID, attempts: k.attempts + 1 });
      if (early) await finishKeyframe(s, k, early, deps);
      continue;
    }
    if (k.stage === "edit-pending") {
      const { taskUUID, early } = await submit(deps.send, imageTask({ prompt: keyframeEditPrompt(k.edit), references: [k.upscaledUrl] }));
      Object.assign(k, { stage: "edit", taskUUID, editAttempts: (k.editAttempts ?? 0) + 1 });
      if (early) await finishKeyframe(s, k, early, deps);
      continue;
    }
    await finishKeyframe(s, k, await poll(deps.send, k.taskUUID), deps);
    if (s.step === "failed") return s;
  }
  if (s.keyframes.every((k) => k.stage === "done")) {
    s.clips = s.plan.beats.map((_, i) => ({ index: i, status: "pending", attempts: 0 }));
    s.step = "clips";
  }
  return s;
}

async function finishKeyframe(s, k, r, deps) {
  if (r.state === "pending") return;
  addCost(s, "keyframes", r.cost);
  if (r.state === "error") {
    const tries = k.stage === "edit" ? k.editAttempts : k.attempts;
    if (tries >= MAX_ATTEMPTS) { fail(s, `Keyframe ${k.index + 1}: ${r.message}`); return; }
    k.stage = k.stage === "edit" ? "edit-pending" : "crop";
    return;
  }
  if (k.stage === "upscale") {
    k.upscaledUrl = await deps.keep(r.url, `key-${k.index}-up.jpg`);
    if (k.edit) { k.stage = "edit-pending"; return; }
    k.url = k.upscaledUrl;
    k.stage = "done";
    return;
  }
  k.url = await deps.keep(r.url, `key-${k.index}.jpg`);
  k.stage = "done";
}

/** Clips: all at once. First frame = keyframe N, last frame = keyframe N+1 (the same file at every join). */
async function stepClips(s, deps) {
  for (const c of s.clips) {
    if (c.status === "done") continue;
    if (c.status === "pending") {
      c.attempts += 1;
      const t = s.timing.clips[c.index];
      c.prompt = clipPrompt(s.plan, c.index, { clipSec: t.clipSec, verbAtSec: t.verbAtSec });
      const { taskUUID } = await submit(deps.send, clipTask({ prompt: c.prompt, firstUrl: s.keyframes[c.index].url, lastUrl: s.keyframes[c.index + 1].url, durationSec: t.clipSec }));
      Object.assign(c, { status: "submitted", taskUUID });
      continue;
    }
    const r = await poll(deps.send, c.taskUUID);
    if (r.state === "pending") continue;
    addCost(s, "clips", r.cost);
    if (r.state === "error") {
      if (c.attempts >= MAX_ATTEMPTS) return fail(s, `Clip ${c.index + 1}: ${r.message}`);
      c.status = "pending";
      continue;
    }
    c.url = await deps.keep(r.url, `clip-${c.index}.mp4`);
    c.status = "done";
  }
  if (s.clips.every((c) => c.status === "done")) s.step = "render";
  return s;
}

/** What the stitch needs (render-worker/src/cutawayFinal.mjs). */
export function renderJob(s) {
  return {
    clips: s.clips.map((c) => ({ url: c.url, speed: s.timing.clips[c.index].speed, dropFirstFrame: c.index > 0 })),
    voice: s.voice ? { url: s.voice.url, tempo: s.voice.tempo } : null,
    captions: s.voice ? s.voice.words : [],
    lengthSec: s.timing.lengthSec,
    width: 1080, height: 1920, fps: 24,
  };
}

async function stepRender(s, deps) {
  if (!s.render) {
    s.render = { handle: await deps.startRender(renderJob(s)), startedAt: new Date().toISOString() };
    return s;
  }
  const r = await deps.checkRender(s.render.handle);
  if (r.state === "pending") return s;
  if (r.state === "error") return fail(s, `Final video: ${r.message}`);
  addCost(s, "render", r.costUsd);
  s.finalUrl = r.url;
  s.step = "done";
  return s;
}

function round(v) { return Math.round(v * 1000) / 1000; }

/** Progress for the UI: the four visible stages and how far each is. */
export function progressOf(s) {
  const doneCount = (list, ok) => list.filter(ok).length;
  const order = ["plan", "voice", "wide", "approval", "keyframes", "clips", "render", "done"];
  const at = order.indexOf(s.step === "failed" ? s.failedAt : s.step);
  const state = (from, to) => (at > to ? "done" : at >= from ? (s.step === "failed" ? "failed" : "active") : "waiting");
  return {
    script: { state: state(0, 1) },
    images: { state: s.step === "approval" ? "review" : state(2, 3), done: doneCount(s.wide, (w) => w.status === "done"), total: s.wide.length || null },
    clips: { state: state(4, 5), done: doneCount(s.clips, (c) => c.status === "done") + 0, total: s.clips.length || null, keyframesDone: doneCount(s.keyframes, (k) => k.stage === "done"), keyframesTotal: s.keyframes.length || null },
    final: { state: state(6, 7) },
  };
}
