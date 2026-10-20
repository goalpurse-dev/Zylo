// Cutaway Explainer: the run, one small step at a time.
//
// advance(state, deps) moves a run forward without ever waiting long: it
// submits Runware tasks, polls each pending one once, and returns the new
// state. The caller saves it and calls again a few seconds later (the edge
// function per browser tick, the local runner in a loop). Pure apart from deps.
//
// Steps: plan (+ critic) -> voice -> wide (+ vision check each) -> approval (STOP: the user approves) ->
//        keyframes -> clips -> sound -> render -> done   (or failed)
//
// deps = {
//   planVideo({topic, lengthSec, usedIdeas}) -> {plan, costUsd, critic}
//   synthesize({text}) -> {audioBase64, spoken:[{w,s,e}], costUsd}   (null = no voice: script only)
//   saveAudio(base64) -> url
//   checkImage({imageUrl, description, checks}) -> {pass, fix, checks, costUsd}   (null = no vision check)
//   send(tasks[]) -> {status, body}            Runware transport
//   crop({imageUrl, box}) -> {image, h}        9:16 crop as a URL or data URI, and its height in px
//   keep(url, name) -> url                     copy a provider URL to our storage (identity on the local runner)
//   sfx({cacheKey, text, seconds}) -> {url, costUsd, cached}   a sound effect, from the cache or made and cached
//   startRender(job) -> handle;  checkRender(handle) -> {state:"pending"|"done"|"error", url?, message?}
//   planCode() -> the user's profiles.plan_code, read when the render job is built (the end card, endCard.js)
// }

import { clipTimings, cueTimeline, evenBeats, placeBeats, spokenSeconds, upscaleFactor, voiceTempo, wordsToFit } from "./beats.js";
import { clipPrompt, framesOf, keyframeEditPrompt, masterPromptWithFix, narrationText, statePrompt, visionContext } from "./planner.js";
import { clipTask, imageTask, poll, submit, upscaleTask } from "./runware.js";
import { cueCacheKey, cueRequest, LEVELS } from "./sound.js";
import { endCardFor } from "./endCard.js";

export const STEPS = Object.freeze(["plan", "voice", "wide", "approval", "keyframes", "clips", "sound", "render", "done"]);
const MAX_ATTEMPTS = 2; // one retry per task, never more (no auto-retry loops)
// The plan step is one attempt: planVideo already retries a malformed planner reply once, then runs the critic rounds.
const PLAN_ATTEMPTS = 1;

/**
 * removeWatermark is only the user's request; whether the end card is really dropped is decided from the plan
 * when the render job is built (stepRender), never from this flag alone.
 * @param {{topic: string, lengthSec: number, soundEffects?: boolean, removeWatermark?: boolean, usedIdeas?: string[]}} input
 */
export function newRun({ topic, lengthSec, soundEffects = true, removeWatermark = false, usedIdeas = [] }) {
  return { topic, lengthSec, soundEffects, removeWatermark: removeWatermark === true, usedIdeas, step: "plan", attempts: {}, costs: {}, plan: null, voice: null, timing: null, wide: [], keyframes: [], clips: [], sounds: [], render: null, finalUrl: null, error: null };
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
    if (s.step === "sound") return await stepSound(s, deps);
    if (s.step === "render") return await stepRender(s, deps);
    return s; // approval, done, failed: nothing to do
  } catch (e) {
    return fail(s, e instanceof Error ? e.message : String(e));
  }
}

async function stepPlan(s, deps) {
  s.attempts.plan = (s.attempts.plan ?? 0) + 1;
  try {
    const { plan, costUsd, critic } = await deps.planVideo({ topic: s.topic, lengthSec: s.lengthSec, usedIdeas: s.usedIdeas ?? [] });
    addCost(s, "plan", costUsd);
    s.plan = plan;
    s.critic = critic ?? null;
    s.narration = narrationText(plan);
    s.step = "voice";
  } catch (e) {
    addCost(s, "plan", e?.costUsd);
    s.planErrors = [...(s.planErrors ?? []), e.message];
    // Keep each round's problems (not the raw outputs: they are large; the local runner saves those itself).
    s.planTrace = [...(s.planTrace ?? []), (e.trace ?? []).map((t) => ({ stage: t.stage, problems: t.problems }))];
    if (s.attempts.plan >= PLAN_ATTEMPTS) return fail(s, e.message);
  }
  return s;
}

async function stepVoice(s, deps) {
  let placed;
  if (!deps.synthesize) {
    // No voice in this setup: even beats; the user records the script.
    s.voice = null;
    placed = evenBeats(s.plan.beats, s.lengthSec);
  } else {
    s.attempts.voice = (s.attempts.voice ?? 0) + 1;
    try {
      const { audioBase64, spoken, costUsd } = await deps.synthesize({ text: s.narration });
      addCost(s, "voice", costUsd);
      // Too long for the length? The planner cuts words (once); the audio is never sped up.
      const fit = wordsToFit(spoken, s.lengthSec);
      if (fit != null && deps.trimScript && !s.trimmed) {
        const { plan, costUsd: trimCost } = await deps.trimScript({ plan: s.plan, maxWords: fit, lengthSec: s.lengthSec, usedIdeas: s.usedIdeas ?? [] });
        addCost(s, "plan", trimCost);
        s.trimmed = { from: s.narration.split(/\s+/).length, to: fit, spokenSec: Math.round(spokenSeconds(spoken) * 10) / 10 };
        s.plan = plan;
        s.narration = narrationText(plan);
        s.attempts.voice -= 1; // the re-voice of the shorter script is not a retry
        return s;
      }
      const tempo = voiceTempo(spoken);
      const url = await deps.saveAudio(audioBase64);
      s.voice = { url, tempo, words: spoken.map((w) => ({ w: w.w, s: round(w.s / tempo), e: round(w.e / tempo) })) };
      placed = placeBeats(s.plan.beats, spoken, tempo);
    } catch (e) {
      if (s.attempts.voice >= MAX_ATTEMPTS) return fail(s, e.message);
      return s;
    }
  }
  const { frames, segments } = framesOf(s.plan);
  s.timing = { placed, segments, clips: clipTimings(placed, segments), lengthSec: round(placed[placed.length - 1].end) };
  s.timeline = cueTimeline(s.plan, placed, s.voice?.words ?? []);
  s.frames = frames;
  // Every prompt states its own checklist, so the vision check asks for nothing the image wasn't told.
  s.wide = s.plan.states.map((st, i) => ({ id: st.id, label: st.label, status: "pending", attempts: 0, prompt: i === 0 ? masterPromptWithFix(s.plan, "") : statePrompt(s.plan, i) }));
  s.step = "wide";
  return s;
}

/** Wide images in order: each state is an edit of the one before it; each is checked against its checklist. */
async function stepWide(s, deps) {
  const i = s.wide.findIndex((w) => w.status !== "done");
  if (i < 0) { s.step = "approval"; return s; }
  const w = s.wide[i];
  if (w.status === "pending") {
    w.attempts += 1;
    const references = i === 0 ? [] : [s.wide[i - 1].url];
    const prompt = w.fix ? (i === 0 ? masterPromptWithFix(s.plan, w.fix) : statePrompt(s.plan, i, w.fix)) : (w.prompt ?? (i === 0 ? masterPromptWithFix(s.plan, "") : statePrompt(s.plan, i)));
    const { taskUUID, early } = await submit(deps.send, imageTask({ prompt, references }));
    Object.assign(w, { taskUUID, status: "submitted" });
    if (early) await finishWide(s, w, early, deps);
    return s;
  }
  if (w.status === "submitted") {
    await finishWide(s, w, await poll(deps.send, w.taskUUID), deps);
    return s;
  }
  if (w.status === "checking") await checkWide(s, i, deps);
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
  w.status = deps.checkImage ? "checking" : "done";
}

/** The vision check: a failure regenerates the image once with the fix; a second failure is flagged for the user. */
async function checkWide(s, i, deps) {
  const w = s.wide[i];
  const st = s.plan.states[i];
  const v = await deps.checkImage({ imageUrl: w.url, description: st.description, checks: st.checks ?? [], plan: visionContext(s.plan) });
  addCost(s, "vision", v.costUsd);
  w.vision = { pass: v.pass, fix: v.fix, checks: v.checks, attempt: w.attempts, emptyReplies: v.emptyReplies ?? 0 };
  const failed = (v.checks ?? []).filter((c) => !c.ok).map((c) => c.check);
  // The vision log: every verdict, with its reason, so false alarms can be counted.
  s.visionLog = [...(s.visionLog ?? []), { image: w.id, attempt: w.attempts, verdict: v.pass === null ? "unchecked" : v.pass ? "pass" : "fail", failedChecks: failed, fix: v.fix, emptyReplies: v.emptyReplies ?? 0, url: w.url }];
  w.history = [...(w.history ?? []), { url: w.url, pass: v.pass, fix: v.fix }];
  // An empty reply is never a fail: the image is kept as "unchecked" and shown to the user as such.
  if (v.pass || v.pass === null) { w.status = "done"; return; }
  if (w.attempts < MAX_ATTEMPTS) { Object.assign(w, { status: "pending", fix: v.fix, taskUUID: null }); return; }
  w.status = "done"; // kept, but flagged: the approval screen shows it, and the local runner stops
}

/**
 * Users never pay for a failure on our side: a failed run refunds every charge not refunded yet, at any stage.
 * Since the 3D prices (2026-10-21) the whole video is one "video" charge taken at Generate, so a failure in
 * planning refunds it too. charges: [{stage: "plan"|"regenerate"|"video", credits, refunded?}]. Returns the
 * indexes to refund.
 */
export function refundsFor(state, charges = []) {
  if (state?.step !== "failed") return [];
  const stages = ["plan", "regenerate", "video"];
  return charges.map((c, i) => (stages.includes(c.stage) && !c.refunded ? i : -1)).filter((i) => i >= 0);
}

/** What the user is told when a run fails (the technical reason stays in state.error for us). */
export function userMessage(state) {
  if (state?.step !== "failed") return null;
  if (state.failedAt === "plan") return "We couldn't plan a good video for this topic. Your credits were returned. Try another topic, or describe this one differently.";
  if (["voice", "wide", "approval"].includes(state.failedAt)) return "Something went wrong on our side while making the images. Your credits were returned. Please try again.";
  return "Something went wrong on our side while making the video. Your credits were returned. Please try again.";
}

export const visionFailures = (s) => (s.wide ?? []).filter((w) => w.vision && w.vision.pass === false);
export const visionUnchecked = (s) => (s.wide ?? []).filter((w) => w.vision && w.vision.pass === null);

/** The user's "Regenerate" on wide image i: it and every later state (each is an edit of the one before). */
export function regenerateWide(input, i) {
  const s = clone(input);
  if (s.step !== "approval" || !s.wide[i]) throw new Error("REGENERATE_NOT_ALLOWED");
  // prompt: null -> rebuilt from the (possibly corrected) plan
  for (let k = i; k < s.wide.length; k++) Object.assign(s.wide[k], { status: "pending", attempts: 0, taskUUID: null, url: null, fix: "", vision: null, prompt: null });
  s.step = "wide";
  return s;
}

/** The user's "Looks good -> make video". */
export function approve(input) {
  const s = clone(input);
  if (s.step !== "approval") throw new Error("APPROVE_NOT_ALLOWED");
  s.keyframes = s.frames.map((k) => ({ ...k, stage: "crop", attempts: 0 }));
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
    s.clips = s.timing.segments.map((seg, i) => ({ index: i, ...seg, status: "pending", attempts: 0 }));
    s.step = "clips";
  }
  return s;
}

async function finishKeyframe(s, k, r, deps) {
  if (r.state === "pending") return;
  addCost(s, "keyframes", r.cost);
  if (r.state === "error") {
    const tries = k.stage === "edit" ? k.editAttempts : k.attempts;
    if (tries >= MAX_ATTEMPTS) { fail(s, `Keyframe ${k.id}: ${r.message}`); return; }
    k.stage = k.stage === "edit" ? "edit-pending" : "crop";
    return;
  }
  if (k.stage === "upscale") {
    k.upscaledUrl = await deps.keep(r.url, `key-${k.id}-up.jpg`);
    if (k.edit) { k.stage = "edit-pending"; return; }
    k.url = k.upscaledUrl;
    k.stage = "done";
    return;
  }
  k.url = await deps.keep(r.url, `key-${k.id}.jpg`);
  k.stage = "done";
}

const frameById = (s, id) => s.keyframes.find((k) => k.id === id);

/** Clips: all at once. First frame = one keyframe, last frame = the next (the same file at every join). */
async function stepClips(s, deps) {
  for (const c of s.clips) {
    if (c.status === "done") continue;
    if (c.status === "pending") {
      c.attempts += 1;
      const t = s.timing.clips[c.index];
      const to = frameById(s, c.to);
      c.prompt = clipPrompt(s.plan, c, { clipSec: t.clipSec, verbAtSec: t.verbAtSec, toShow: to.show });
      const { taskUUID } = await submit(deps.send, clipTask({ prompt: c.prompt, firstUrl: frameById(s, c.from).url, lastUrl: to.url, durationSec: t.clipSec }));
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
  if (s.clips.every((c) => c.status === "done")) {
    s.sounds = s.soundEffects && deps.sfx ? s.timeline.sfx.map((cue, i) => ({ index: i, ...cue, status: "pending", attempts: 0 })) : [];
    s.step = "sound";
  }
  return s;
}

/** Sound effects: each cue from the cache, or made once and cached. A cue that fails twice is dropped, not fatal. */
async function stepSound(s, deps) {
  for (const cue of s.sounds) {
    if (cue.status !== "pending") continue;
    cue.attempts += 1;
    try {
      const req = cueRequest({ key: cue.key, text: cue.text, seconds: cue.duration ? Math.min(6, Math.max(1.5, cue.duration)) : 2.5 });
      const cacheKey = await cueCacheKey({ key: cue.key, text: req.text, seconds: req.seconds });
      const r = await deps.sfx({ cacheKey, text: req.text, seconds: req.seconds });
      addCost(s, "sound", r.costUsd);
      Object.assign(cue, { url: r.url, cached: r.cached, cacheKey, status: "done" });
    } catch (e) {
      if (cue.attempts >= MAX_ATTEMPTS) Object.assign(cue, { status: "dropped", error: e.message });
    }
    return s; // one cue per tick
  }
  s.step = "render";
  return s;
}

/**
 * What the renderer needs (render-worker/src/cutawayFinal.mjs). planCode is read on the server when the job is
 * built; without it the end card stays on.
 */
export function renderJob(s, { planCode = null } = {}) {
  const on = s.soundEffects !== false;
  return {
    endCard: endCardFor(planCode, s.removeWatermark === true),
    clips: s.clips.map((c) => ({ url: c.url, speed: s.timing.clips[c.index].speed, dropFirstFrame: c.index > 0 })),
    voice: s.voice ? { url: s.voice.url, tempo: s.voice.tempo } : null,
    captions: s.voice ? s.voice.words : [],
    cards: s.timeline?.cards ?? [],
    chimes: on ? (s.timeline?.chimes ?? []) : [],
    sfx: on ? (s.sounds ?? []).filter((c) => c.status === "done").map((c) => ({ url: c.url, start: c.start, duration: c.duration, soft: Boolean(c.soft) })) : [],
    levels: LEVELS,
    lengthSec: s.timing.lengthSec,
    width: 1080, height: 1920, fps: 24,
  };
}

async function stepRender(s, deps) {
  if (!s.render) {
    // the plan is read now, at render time (a downgrade since the start keeps the end card on)
    const planCode = deps.planCode ? await deps.planCode().catch(() => null) : null;
    const job = renderJob(s, { planCode });
    s.endCard = job.endCard;
    s.render = { handle: await deps.startRender(job), startedAt: new Date().toISOString() };
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
  const doneCount = (list, ok) => (list ?? []).filter(ok).length;
  const order = ["plan", "voice", "wide", "approval", "keyframes", "clips", "sound", "render", "done"];
  const at = order.indexOf(s.step === "failed" ? s.failedAt : s.step);
  const state = (from, to) => (at > to ? "done" : at >= from ? (s.step === "failed" ? "failed" : "active") : "waiting");
  return {
    script: { state: state(0, 1) },
    images: { state: s.step === "approval" ? "review" : state(2, 3), done: doneCount(s.wide, (w) => w.status === "done"), total: s.wide?.length || null, flagged: visionFailures(s).length },
    clips: { state: state(4, 5), done: doneCount(s.clips, (c) => c.status === "done"), total: s.clips?.length || null, keyframesDone: doneCount(s.keyframes, (k) => k.stage === "done"), keyframesTotal: s.keyframes?.length || null },
    final: { state: state(6, 8) },
  };
}
