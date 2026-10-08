// Blocky Stories: the failure drills (owner, 2026-10-08), simulated: no provider is called and nothing is
// paid. Each drill must end in a finished step or a full refund, never in a stuck story:
//   1. the provider answers with an error            5. the final-video machine fails or never answers
//   2. the provider never finishes (a timeout)       6. a double click on a paid button
//   3. the callback never arrives                    7. the tab is closed in the middle of a story
//   4. the callback arrives twice
// The engine runs on the in-memory store with a stand-in provider; the clock is moved by hand.
import test from "node:test";
import assert from "node:assert/strict";
import { createEngine, TIMING } from "../supabase/functions/_shared/blocky/engine.js";
import { FINAL_TIMEOUT_MIN, storyUpdateForReport } from "../supabase/functions/_shared/blocky/final.js";
import { MESSAGES } from "../supabase/functions/_shared/blocky/errors.js";
import { createMemoryDb } from "./helpers/blockyMemoryStore.mjs";

const IMG = (taskUUID, cost = 0.0344) => ({ data: [{ taskType: "imageInference", taskUUID, imageURL: `https://im.runware.ai/${taskUUID}.jpg`, cost }] });
const CLIP = (taskUUID, cost = 0.19) => ({ data: [{ taskType: "videoInference", taskUUID, status: "success", videoURL: `https://vm.runware.ai/${taskUUID}.mp4`, cost }] });
const ACK = (taskUUID) => ({ data: [{ taskType: "imageInference", taskUUID }] });
const ERR = (taskUUID, code, message) => ({ errors: [{ code, message, taskUUID }] });

function setup({ submit, poll, onCompleted } = {}) {
  const db = createMemoryDb({ balance: 1000 });
  const sent = [];
  let n = 0;
  const engine = createEngine({
    store: db.store,
    runware: {
      submit: async (env) => { sent.push(env); return submit ? submit(env, sent.length) : { httpStatus: 200, body: ACK(env.taskUUID) }; },
      poll: async (taskUUID) => (poll ? poll(taskUUID) : { httpStatus: 200, body: { data: [] } }),
    },
    media: { store: async ({ path }) => `https://cdn.test/${path}` },
    env: { BLOCKY_PAID_CALLS: "", webhookBase: "https://fn.test/blocky-worker", webhookSecret: "s3cret" },
    ...(onCompleted ? { onCompleted } : {}),
    now: () => db.clock(),
    uuid: () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
    log: { error() {} },
  });
  return { db, engine, sent };
}
const scenesOf = (db, storyId) => [...db.scenes.values()].filter((s) => s.story_id === storyId);
const pictures = (db, storyId, credits = 3) => db.chargeStep(storyId, { from: ["draft"], to: "pictures", items: scenesOf(db, storyId).map((s) => ({ scene_id: s.id, kind: "image", credits, request: { taskType: "imageInference", model: "google:nano-banana@2-lite", positivePrompt: `scene ${s.idx}` } })) });
const clips = (db, storyId, credits = 12) => db.chargeStep(storyId, { from: ["pictures_ready"], to: "animating", items: scenesOf(db, storyId).map((s) => ({ scene_id: s.id, kind: "clip", credits, request: { taskType: "videoInference", model: "xai:grok-imagine@video-1.5-lite", positivePrompt: `clip ${s.idx}` } })) });

/** Never stuck: the story is at a step the user can act on, no job is waiting or running, and every job either made its picture or clip or was refunded in full. */
function assertNotStuck(db, storyId, { finished }) {
  const story = db.stories.get(storyId);
  assert.ok(["pictures_ready", "clips_ready"].includes(story.status), `the story rests at a step the user can act on (it is "${story.status}")`);
  const jobs = [...db.jobs.values()].filter((j) => j.story_id === storyId);
  for (const j of jobs) assert.ok(j.status === "succeeded" || (j.status === "failed" && j.refunded_at), `job ${j.id} is ${j.status}`);
  const charged = db.ledger.filter((l) => l.op === "charge").reduce((s, l) => s + l.credits, 0);
  const refunded = db.ledger.filter((l) => l.op === "refund").reduce((s, l) => s + l.credits, 0);
  const kept = jobs.filter((j) => j.status === "succeeded").reduce((s, j) => s + j.credits, 0);
  assert.equal(charged - refunded, kept, "the user paid for exactly what was made");
  assert.equal(db.balance, 1000 - kept, "and the balance says the same");
  assert.equal(jobs.filter((j) => j.status === "succeeded").length, finished, `${finished} made`);
}

test("drill 1, the provider answers with an error: tried again, then refunded in full", async () => {
  const { db, engine, sent } = setup({ submit: (env) => ({ httpStatus: 500, body: ERR(env.taskUUID, "internalServerError", "boom") }) });
  const storyId = db.addStory({ sceneCount: 2 });
  pictures(db, storyId);
  for (let i = 0; i < 6; i++) { await engine.kick({ storyId }); db.advance(TIMING.retryDelaysSec.at(-1) + 1); }
  assert.ok(sent.length >= 4, "each picture was tried more than once");
  assertNotStuck(db, storyId, { finished: 0 });
  assert.deepEqual(scenesOf(db, storyId).map((s) => s.image_status), ["failed", "failed"], "each scene says it failed and can be made again");
  // An error on one picture only: the others are made and kept.
  const mixed = setup({ submit: (env, n) => (n === 1 || env.positivePrompt === "scene 0" ? { httpStatus: 500, body: ERR(env.taskUUID, "internalServerError", "boom") } : { httpStatus: 200, body: ACK(env.taskUUID) }) });
  const s2 = mixed.db.addStory({ sceneCount: 3 });
  pictures(mixed.db, s2);
  for (let i = 0; i < 6; i++) {
    await mixed.engine.kick({ storyId: s2 });
    for (const env of mixed.sent.filter((e) => e.positivePrompt !== "scene 0")) await mixed.engine.onResult(env.taskUUID, IMG(env.taskUUID));
    mixed.db.advance(TIMING.retryDelaysSec.at(-1) + 1);
  }
  assertNotStuck(mixed.db, s2, { finished: 2 });
});

test("drill 2, the provider never finishes: given up on after the wait, refunded in full", async () => {
  const { db, engine } = setup({ poll: (T) => ({ httpStatus: 200, body: { data: [{ taskUUID: T, status: "processing" }] } }) });
  const storyId = db.addStory({ sceneCount: 2, status: "pictures_ready" });
  clips(db, storyId);
  await engine.kick({ storyId });
  db.advance(TIMING.pollAfterSec.clip + 1);
  await engine.reconcile();
  assert.equal(db.stories.get(storyId).status, "animating", "still waiting while the provider says it is working");
  db.advance(TIMING.giveUpAfterSec.clip + 1);
  await engine.reconcile();
  assertNotStuck(db, storyId, { finished: 0 });
  assert.ok([...db.jobs.values()].every((j) => j.error_code === "PROVIDER_TIMEOUT"));
  assert.match(MESSAGES.PROVIDER_TIMEOUT, /refunded your credits/);
});

test("drill 3, the callback never arrives: the sweep asks the provider itself and finishes the step", async () => {
  const { db, engine } = setup({ poll: (T) => ({ httpStatus: 200, body: CLIP(T) }) });
  const storyId = db.addStory({ sceneCount: 3, status: "pictures_ready" });
  clips(db, storyId);
  await engine.kick({ storyId });
  db.advance(TIMING.pollAfterSec.clip + 1);
  await engine.reconcile();
  assertNotStuck(db, storyId, { finished: 3 });
  assert.equal(db.stories.get(storyId).status, "clips_ready");
});

test("drill 4, the callback arrives twice (and once more, late): counted once, charged once, paid for once", async () => {
  const { db, engine, sent } = setup();
  const storyId = db.addStory({ sceneCount: 2 });
  pictures(db, storyId);
  await engine.kick({ storyId });
  for (const env of sent) {
    assert.equal(await engine.onResult(env.taskUUID, IMG(env.taskUUID)), "completed");
    assert.notEqual(await engine.onResult(env.taskUUID, IMG(env.taskUUID)), "completed", "the second one changes nothing");
  }
  await engine.onResult(sent[0].taskUUID, ERR(sent[0].taskUUID, "internalServerError", "late and wrong"));
  assertNotStuck(db, storyId, { finished: 2 });
  assert.equal([...db.jobs.values()].reduce((s, j) => s + j.cost_usd, 0).toFixed(4), "0.0688", "our cost is counted once per picture");
  assert.equal(db.ledger.filter((l) => l.op === "refund").length, 0);
});

test("drill 5, the final-video machine fails, or never answers: the story goes back to its clips, and the final video is free to try again", () => {
  // The machine reports a failure.
  const failed = storyUpdateForReport({ ok: false }, null, MESSAGES.FINAL_FAILED);
  assert.deepEqual(failed, { status: "clips_ready", final_status: "failed", final_error: MESSAGES.FINAL_FAILED });
  assert.match(MESSAGES.FINAL_FAILED, /free, so just try again/);
  // The machine never starts or never answers: the sweep gives up on it after FINAL_TIMEOUT_MIN and writes the same.
  assert.ok(FINAL_TIMEOUT_MIN > 0 && FINAL_TIMEOUT_MIN <= 30, `a silent machine is given up on after ${FINAL_TIMEOUT_MIN} minutes`);
  // Nothing was charged for the final video, so there is nothing to refund; the clips are kept.
  assert.equal("credits" in failed, false);
  // And a good report finishes the story.
  assert.equal(storyUpdateForReport({ ok: true, trimmedSec: 1.2, trimmedPerClip: [0.6, 0.6] }, "https://cdn.test/final.mp4", "").status, "final_ready");
});

test("drill 6, a double click on a paid button: one charge, one set of jobs", async () => {
  const { db, engine, sent } = setup();
  const storyId = db.addStory({ sceneCount: 3 });
  pictures(db, storyId);
  assert.throws(() => pictures(db, storyId), /WRONG_STATUS/, "the second click finds the story already past the step");
  assert.equal(db.balance, 991, "charged once");
  assert.equal([...db.jobs.values()].length, 3);
  await engine.kick({ storyId });
  await engine.kick({ storyId });
  assert.equal(sent.length, 3, "and a second start sends nothing twice");
  for (const env of sent) await engine.onResult(env.taskUUID, IMG(env.taskUUID));
  assertNotStuck(db, storyId, { finished: 3 });
  // Not enough credits for the whole step: nothing is charged and nothing is queued.
  const poor = createMemoryDb({ balance: 5 });
  const s2 = poor.addStory({ sceneCount: 3 });
  assert.throws(() => pictures(poor, s2), /INSUFFICIENT_CREDITS/);
  assert.deepEqual([poor.balance, poor.jobs.size, poor.stories.get(s2).status], [5, 0, "draft"]);
});

test("drill 7, the tab is closed in the middle of a story: the server finishes the step by itself, and the final video is started", async () => {
  const finalsStarted = [];
  // Nothing from the browser after the click: only the provider's callbacks and the sweep.
  const { db, engine, sent } = setup({ poll: (T) => ({ httpStatus: 200, body: CLIP(T) }), onCompleted: async (job) => { if (job.kind === "clip" && db.stories.get(job.story_id).status === "clips_ready") finalsStarted.push(job.story_id); } });
  const storyId = db.addStory({ sceneCount: 3 });
  pictures(db, storyId);
  await engine.kick({ storyId });
  for (const env of sent) await engine.onResult(env.taskUUID, IMG(env.taskUUID));   // the provider's callbacks
  assert.equal(db.stories.get(storyId).status, "pictures_ready", "the pictures are there when the user comes back");
  clips(db, storyId);
  await engine.kick({ storyId });
  db.advance(TIMING.pollAfterSec.clip + 1);
  await engine.reconcile();   // the sweep, every 20 seconds while anything is in flight
  assertNotStuck(db, storyId, { finished: 6 });
  assert.deepEqual(finalsStarted, [storyId], "the last clip starts the final video without a click");
});
