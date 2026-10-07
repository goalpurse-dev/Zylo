// AI Fruit Story v2 worker engine (stage 3b): offline replay of Runware
// replies against an in-memory database with the same rules as the SQL.
import test from "node:test";
import assert from "node:assert/strict";
import { createEngine, TIMING } from "../supabase/functions/_shared/fruit/engine.js";
import { webhookToken } from "../supabase/functions/_shared/fruit/runware.js";
import { createMemoryDb } from "./helpers/fruitMemoryStore.mjs";

const IMG = (taskUUID, cost = 0.0337) => ({ data: [{ taskType: "imageInference", taskUUID, imageURL: `https://im.runware.ai/${taskUUID}.jpg`, cost }] });
const CLIP = (taskUUID, cost = 0.405) => ({ data: [{ taskType: "videoInference", taskUUID, status: "success", videoURL: `https://vm.runware.ai/${taskUUID}.mp4`, cost }] });
const ACK = (taskUUID) => ({ data: [{ taskType: "imageInference", taskUUID }] });
const ERR = (taskUUID, code, message) => ({ errors: [{ code, message, taskUUID }] });

function setup({ balance = 1000, paidOff = false, submit, poll, storeFails = false } = {}) {
  const db = createMemoryDb({ balance });
  const sent = [];
  const stored = [];
  let n = 0;
  const engine = createEngine({
    store: db.store,
    runware: {
      submit: async (env) => { sent.push(env); return submit ? submit(env, sent.length) : { httpStatus: 200, body: ACK(env.taskUUID) }; },
      poll: async (taskUUID) => (poll ? poll(taskUUID) : { httpStatus: 200, body: { data: [] } }),
    },
    media: { store: async ({ path }) => { if (storeFails) throw new Error("storage down"); stored.push(path); return `https://cdn.test/${path}`; } },
    env: { FRUIT_PAID_CALLS: paidOff ? "off" : "", webhookBase: "https://fn.test/fruit-worker", webhookSecret: "s3cret" },
    now: () => db.clock(),
    uuid: () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
    log: { error() {} },
  });
  return { db, engine, sent, stored };
}

const pictures = (db, storyId, credits = 3) =>
  db.chargeStep(storyId, { from: ["draft"], to: "pictures", items: [...db.scenes.values()].filter((s) => s.story_id === storyId).map((s) => ({ scene_id: s.id, kind: "image", credits, request: { taskType: "imageInference", model: "google:nano-banana@2-lite", positivePrompt: `scene ${s.idx}` } })) });

test("happy path: submit exactly the stored request, webhook completes, story ready, cost captured", async () => {
  const { db, engine, sent, stored } = setup();
  const storyId = db.addStory({ sceneCount: 3 });
  pictures(db, storyId);
  assert.equal(db.balance, 991);
  await engine.kick({ storyId });
  assert.equal(sent.length, 3);
  for (const env of sent) {
    assert.match(env.positivePrompt, /^scene \d$/);                        // byte-for-byte from the job
    assert.equal(env.deliveryMethod, "async");
    assert.equal(env.webhookURL, `https://fn.test/fruit-worker?action=webhook&t=${await webhookToken("s3cret", env.taskUUID)}`);
  }
  for (const env of sent) assert.equal(await engine.onResult(env.taskUUID, IMG(env.taskUUID)), "completed");
  assert.equal(db.stories.get(storyId).status, "pictures_ready");
  assert.deepEqual([...db.scenes.values()].map((s) => s.image_status), ["ready", "ready", "ready"]);
  assert.equal(stored.length, 3);
  assert.ok(stored.every((p) => p.startsWith(`fruit/user-1/${storyId}/`)));
  assert.equal([...db.jobs.values()].reduce((s, j) => s + j.cost_usd, 0).toFixed(4), "0.1011");
  assert.equal(db.balance, 991);
  assert.ok(db.calls.every((c) => c.done?.ok === true), "every call records its result");
  assert.ok(db.calls.every((c) => !/[?&]t=[0-9a-f]{64}/.test(JSON.stringify(c.request))), "webhook token never logged");
});

test("per-story concurrency: at most 6 in flight (a 30 s story in one wave), the rest start as others finish", async () => {
  const { db, engine, sent } = setup();
  const storyId = db.addStory({ sceneCount: 8 });
  pictures(db, storyId);
  await engine.kick({ storyId });
  assert.equal(sent.length, 6);
  await engine.onResult(sent[0].taskUUID, IMG(sent[0].taskUUID));
  assert.equal(sent.length, 7);                                             // completion kicks the next one
});

test("duplicate and late webhooks change nothing", async () => {
  const { db, engine, sent, stored } = setup();
  const storyId = db.addStory({ sceneCount: 1 });
  pictures(db, storyId);
  await engine.kick({ storyId });
  const T = sent[0].taskUUID;
  assert.equal(await engine.onResult(T, IMG(T)), "completed");
  assert.equal(await engine.onResult(T, IMG(T)), "ignored");
  assert.equal(await engine.onResult("unknown-task", IMG("unknown-task")), "ignored");
  assert.equal(stored.length, 1);
  assert.equal([...db.jobs.values()][0].cost_usd, 0.0337);
});

test("provider busy: retried with backoff and a fresh taskUUID, then refunded once after 3 attempts", async () => {
  const { db, engine, sent } = setup({ submit: (env) => ({ httpStatus: 429, body: ERR(env.taskUUID, "rateLimitExceeded", "Too many requests") }) });
  const storyId = db.addStory({ sceneCount: 1 });
  pictures(db, storyId);
  await engine.kick({ storyId });
  const job = [...db.jobs.values()][0];
  assert.equal(job.status, "queued");
  assert.equal(job.attempt, 1);
  await engine.kick({ storyId });
  assert.equal(sent.length, 1, "not before the backoff");
  db.advance(TIMING.retryDelaysSec[0] + 1);
  await engine.kick({ storyId });
  db.advance(TIMING.retryDelaysSec[1] + 1);
  await engine.kick({ storyId });
  assert.equal(sent.length, 3);
  assert.equal(new Set(sent.map((e) => e.taskUUID)).size, 3, "fresh taskUUID per attempt");
  assert.equal(job.status, "failed");
  assert.equal(job.error_code, "PROVIDER_BUSY");
  assert.equal(db.balance, 1000, "refunded");
  assert.equal(db.ledger.filter((l) => l.op === "refund").length, 1);
  assert.equal(db.stories.get(storyId).status, "pictures_ready");
  assert.equal([...db.scenes.values()][0].image_status, "failed");
});

test("content policy on a clip: no retry, CLIP_BLOCKED, refunded", async () => {
  const { db, engine } = setup({ submit: (env) => ({ httpStatus: 400, body: ERR(env.taskUUID, "contentModerationFailed", "Flagged by safety filter") }) });
  const storyId = db.addStory({ sceneCount: 1, status: "pictures_ready" });
  const [scene] = [...db.scenes.values()];
  db.chargeStep(storyId, { from: ["pictures_ready"], to: "animating", items: [{ scene_id: scene.id, kind: "clip", credits: 25, request: { taskType: "videoInference", positivePrompt: "x" } }] });
  await engine.kick({ storyId });
  const job = [...db.jobs.values()][0];
  assert.equal(job.error_code, "CLIP_BLOCKED");
  assert.equal(job.attempt, 1);
  assert.equal(db.balance, 1000);
  assert.equal(db.stories.get(storyId).status, "clips_ready");
});

test("a lost submit is polled, then sent again; a success after a network error still completes", async () => {
  let calls = 0;
  const { db, engine, sent } = setup({
    submit: () => { calls += 1; if (calls === 1) throw new Error("network reset"); return { httpStatus: 200, body: { data: [] } }; },
    poll: () => ({ httpStatus: 200, body: { data: [] } }),
  });
  const storyId = db.addStory({ sceneCount: 1 });
  pictures(db, storyId);
  await engine.kick({ storyId });
  const job = [...db.jobs.values()][0];
  assert.equal(job.status, "submitting");
  db.advance(TIMING.leaseSec + 1);
  await engine.reconcile();                                                 // provider doesn't know it → requeued
  assert.equal(job.status, "queued");
  db.advance(TIMING.retryDelaysSec[0] + 1);
  await engine.kick({ storyId });
  assert.equal(sent.length, 2);
  const T = sent[1].taskUUID;
  assert.equal(await engine.onResult(T, IMG(T)), "completed");
  assert.equal(db.balance, 997);
});

test("polling picks up a finished clip when the webhook never arrives", async () => {
  const { db, engine } = setup({ poll: (T) => ({ httpStatus: 200, body: CLIP(T) }) });
  const storyId = db.addStory({ sceneCount: 1, status: "pictures_ready" });
  const [scene] = [...db.scenes.values()];
  db.chargeStep(storyId, { from: ["pictures_ready"], to: "animating", items: [{ scene_id: scene.id, kind: "clip", credits: 25, request: { taskType: "videoInference", positivePrompt: "x" } }] });
  await engine.kick({ storyId });
  db.advance(TIMING.pollAfterSec.clip + 1);
  const report = await engine.reconcile();
  assert.equal(report.finalized, 1);
  assert.equal(scene.clip_status, "ready");
  assert.equal(db.stories.get(storyId).status, "clips_ready");
  assert.equal([...db.jobs.values()][0].cost_usd, 0.405);
});

test("a job that never finishes is refunded with PROVIDER_TIMEOUT", async () => {
  const { db, engine } = setup({ poll: (T) => ({ httpStatus: 200, body: { data: [{ taskUUID: T, status: "processing" }] } }) });
  const storyId = db.addStory({ sceneCount: 1 });
  pictures(db, storyId);
  await engine.kick({ storyId });
  db.advance(TIMING.pollAfterSec.image + 1);
  await engine.reconcile();
  assert.equal([...db.jobs.values()][0].status, "submitted");
  db.advance(TIMING.giveUpAfterSec.image);
  await engine.reconcile();
  assert.equal([...db.jobs.values()][0].error_code, "PROVIDER_TIMEOUT");
  assert.equal(db.balance, 1000);
});

test("storage outage: the result is kept and stored later; refunded if it never recovers", async () => {
  const { db, engine, sent } = setup({ storeFails: true });
  const storyId = db.addStory({ sceneCount: 1 });
  pictures(db, storyId);
  await engine.kick({ storyId });
  const T = sent[0].taskUUID;
  assert.equal(await engine.onResult(T, IMG(T)), "store_retry");
  const job = [...db.jobs.values()][0];
  assert.equal(job.status, "provider_done");
  assert.equal(job.cost_usd, 0.0337);
  db.advance(TIMING.storeGiveUpSec + 1);
  await engine.reconcile();
  assert.equal(job.status, "failed");
  assert.equal(job.cost_usd, 0.0337, "cost counted once");
  assert.equal(db.balance, 1000);
});

test("kill switch: nothing is sent, everything is refunded", async () => {
  const { db, engine, sent } = setup({ paidOff: true });
  const storyId = db.addStory({ sceneCount: 2 });
  pictures(db, storyId);
  await engine.kick({ storyId });
  assert.equal(sent.length, 0);
  assert.deepEqual([...db.jobs.values()].map((j) => j.error_code), ["PAID_CALLS_DISABLED", "PAID_CALLS_DISABLED"]);
  assert.equal(db.balance, 1000);
});

test("a whole step is charged at once or not at all", () => {
  const { db } = setup({ balance: 5 });
  const storyId = db.addStory({ sceneCount: 2 });
  assert.throws(() => pictures(db, storyId), /INSUFFICIENT_CREDITS/);
  assert.equal(db.balance, 5);
  assert.equal(db.jobs.size, 0);
  assert.equal(db.stories.get(storyId).status, "draft");
});

test("content policy on a clip: ONE safe rewrite keeping the exact line, then refund if refused again", async () => {
  let n = 0;
  const { db, engine, sent } = setup({ submit: (env) => (++n <= 2 ? { httpStatus: 400, body: ERR(env.taskUUID, "contentModerationFailed", "Flagged by safety filter") } : { httpStatus: 200, body: ACK(env.taskUUID) }) });
  const storyId = db.addStory({ sceneCount: 1, status: "pictures_ready" });
  const [scene] = [...db.scenes.values()];
  db.chargeStep(storyId, { from: ["pictures_ready"], to: "animating", items: [{ scene_id: scene.id, kind: "clip", credits: 25, request: { taskType: "videoInference", positivePrompt: 'Rick says: "You are fired."' } }] });
  const rewrites = [];
  const eng2 = (await import("../supabase/functions/_shared/fruit/engine.js")).createEngine({
    store: db.store, media: { store: async ({ path }) => path },
    runware: { submit: async (env) => { sent.push(env); return n++ < 2 ? { httpStatus: 400, body: ERR(env.taskUUID, "contentModerationFailed", "Flagged") } : { httpStatus: 200, body: ACK(env.taskUUID) }; }, poll: async () => ({ httpStatus: 200, body: { data: [] } }) },
    env: {}, now: () => db.clock(), log: { error() {} },
    rewriteClip: async (job) => { rewrites.push(job.id); db.calls.push({ job: job.id, purpose: "clip_rewrite" }); return { ...job.request, positivePrompt: 'In a cartoon office, Rick says: "You are fired."' }; },
  });
  n = 0;
  await eng2.kick({ storyId });
  const job = [...db.jobs.values()][0];
  assert.equal(rewrites.length, 1);
  assert.equal(job.status, "queued");
  assert.equal(job.request.positivePrompt, 'In a cartoon office, Rick says: "You are fired."');
  assert.equal(scene.clip_prompt, job.request.positivePrompt, "saved == sent after the rewrite");
  await eng2.kick({ storyId });                                           // refused again: no second rewrite
  assert.equal(rewrites.length, 1);
  assert.equal(job.error_code, "CLIP_BLOCKED");
  assert.equal(db.balance, 1000);
});

test("a clip that finally fails on its model is re-sent once on the fallback model, then completes", async () => {
  const { createEngine: make } = await import("../supabase/functions/_shared/fruit/engine.js");
  const db = createMemoryDb();
  const sent = [];
  const eng = make({
    store: db.store, media: { store: async ({ path }) => path }, env: {}, now: () => db.clock(), log: { error() {} },
    uuid: (() => { let i = 0; return () => `00000000-0000-4000-8000-${String(++i).padStart(12, "0")}`; })(),
    runware: { submit: async (env) => { sent.push(env); return env.model === "wan" ? { httpStatus: 400, body: ERR(env.taskUUID, "invalidInput", "unsupported frame") } : { httpStatus: 200, body: ACK(env.taskUUID) }; }, poll: async () => ({ httpStatus: 200, body: { data: [] } }) },
    fallbackClip: (req) => (req.model === "wan" ? { ...req, model: "seedance" } : null),
  });
  const storyId = db.addStory({ sceneCount: 1, status: "pictures_ready" });
  const [scene] = [...db.scenes.values()];
  db.chargeStep(storyId, { from: ["pictures_ready"], to: "animating", items: [{ scene_id: scene.id, kind: "clip", credits: 30, request: { taskType: "videoInference", model: "wan", positivePrompt: "p" } }] });
  await eng.kick({ storyId });
  const job = [...db.jobs.values()][0];
  assert.equal(job.request.model, "seedance");
  assert.equal(job.status, "queued");
  await eng.kick({ storyId });
  assert.deepEqual(sent.map((e) => e.model), ["wan", "seedance"]);
  const T = sent[1].taskUUID;
  assert.equal(await eng.onResult(T, CLIP(T)), "completed");
  assert.equal(db.balance, 970, "charged once at the tier price, no refund");
});

const clipStep = (db, storyId) => {
  const [scene] = [...db.scenes.values()].filter((x) => x.story_id === storyId);
  db.chargeStep(storyId, { from: ["pictures_ready"], to: "animating", items: [{ scene_id: scene.id, kind: "clip", credits: 25, request: { taskType: "videoInference", model: "wan", positivePrompt: "p" } }] });
};

test("a result fetched by the reconciler is marked as a poll (so missed webhooks show up)", async () => {
  const { db, engine, sent } = setup({ poll: (T) => ({ httpStatus: 200, body: CLIP(T) }) });
  const storyId = db.addStory({ sceneCount: 1, status: "pictures_ready" });
  clipStep(db, storyId);
  await engine.kick({ storyId });
  db.advance(100);
  await engine.reconcile();
  const job = [...db.jobs.values()][0];
  assert.equal(job.status, "succeeded");
  assert.equal(job.result._via, "poll");
  assert.equal(sent.length, 1);
});

test("stall check: a clip Runware lost is sent again once after 4 min, then refunded with a clear message", async () => {
  const { db, engine, sent } = setup({ poll: () => ({ httpStatus: 200, body: { data: [] } }) });   // Runware: no such task
  const storyId = db.addStory({ sceneCount: 1, status: "pictures_ready" });
  clipStep(db, storyId);
  await engine.kick({ storyId });
  db.advance(120);
  await engine.reconcile();
  assert.equal(sent.length, 1, "at 2 min: not stalled yet, keep waiting");
  db.advance(130);                      // 250 s
  await engine.reconcile();
  let job = [...db.jobs.values()][0];
  assert.equal(job.status, "queued", "lost after 4 min: queued again");
  db.advance(60);
  await engine.reconcile();
  assert.equal(sent.length, 2, "sent once more");
  assert.notEqual(sent[1].taskUUID, sent[0].taskUUID);
  db.advance(250);
  await engine.reconcile();
  job = [...db.jobs.values()][0];
  assert.equal(job.status, "failed");
  assert.equal(job.error_code, "PROVIDER_TIMEOUT");
  assert.match(job.error, /refunded your credits. Tap Retry/);
  assert.equal(sent.length, 2, "never a third send");
  assert.equal(db.balance, 1000, "refunded");
});

// 2026-10-07: given up on at 30 min (it was 12). On 6-7 Oct Runware delivered six clips after the 12-minute refund.
test("stall check: a clip Runware is still rendering is NOT sent twice; refunded at 30 min", async () => {
  const { db, engine, sent } = setup({ poll: (T) => ({ httpStatus: 200, body: { data: [{ taskType: "videoInference", taskUUID: T, status: "processing" }] } }) });
  const storyId = db.addStory({ sceneCount: 1, status: "pictures_ready" });
  clipStep(db, storyId);
  await engine.kick({ storyId });
  assert.equal(TIMING.giveUpAfterSec.clip, 30 * 60);
  for (let t = 0; t < 29; t++) { db.advance(60); await engine.reconcile(); }
  assert.equal(sent.length, 1, "still rendering at 29 min: no second send, no refund");
  assert.equal([...db.jobs.values()][0].status, "submitted");
  db.advance(70);
  await engine.reconcile();
  assert.equal([...db.jobs.values()][0].error_code, "PROVIDER_TIMEOUT");
  assert.equal(db.balance, 1000);
});

test("picture check: a failed picture is redrawn once at our cost; failing again it's kept with a warning", async () => {
  const { createEngine: make } = await import("../supabase/functions/_shared/fruit/engine.js");
  const db = createMemoryDb();
  const sent = [];
  const verdicts = [{ ok: false, problems: ["Piper Pine is drawn with a human head"] }, { ok: false, problems: ["Piper Pine is drawn with a human head"] }];
  const eng = make({
    store: db.store, media: { store: async ({ path }) => `https://cdn.test/${path}` }, env: {}, now: () => db.clock(), log: { error() {} },
    uuid: (() => { let i = 0; return () => `00000000-0000-4000-8000-${String(++i).padStart(12, "0")}`; })(),
    runware: { submit: async (env) => { sent.push(env); return { httpStatus: 200, body: ACK(env.taskUUID) }; }, poll: async () => ({ httpStatus: 200, body: { data: [] } }) },
    checkPicture: async () => verdicts.shift(),
  });
  const storyId = db.addStory({ sceneCount: 1 });
  pictures(db, storyId, 4);
  await eng.kick({ storyId });
  assert.equal(await eng.onResult(sent[0].taskUUID, IMG(sent[0].taskUUID)), "redrawn");
  const [scene] = [...db.scenes.values()];
  assert.equal(scene.image_status, "generating", "redrawn right away, same job");
  assert.equal(sent.length, 2, "sent again");
  assert.deepEqual(sent[1].positivePrompt, sent[0].positivePrompt);
  assert.equal(db.balance, 1000 - 4, "the user paid once");
  assert.equal(await eng.onResult(sent[1].taskUUID, IMG(sent[1].taskUUID)), "completed");
  assert.equal(scene.image_status, "ready");
  assert.equal(scene.image_check, "failed");
  assert.match(scene.image_check_notes, /human head/);
  assert.equal(sent.length, 2, "never a third draw");
  const job = [...db.jobs.values()][0];
  assert.ok(job.cost_usd > 0.06, "both draws are on our cost ledger");
});

test("picture check: a passing picture completes normally; a check that can't run never blocks", async () => {
  const { createEngine: make } = await import("../supabase/functions/_shared/fruit/engine.js");
  for (const check of [async () => ({ ok: true, problems: [] }), async () => { throw new Error("vision down"); }]) {
    const db = createMemoryDb();
    const sent = [];
    const eng = make({
      store: db.store, media: { store: async ({ path }) => path }, env: {}, now: () => db.clock(), log: { error() {} },
      uuid: (() => { let i = 0; return () => `00000000-0000-4000-8000-${String(++i).padStart(12, "0")}`; })(),
      runware: { submit: async (env) => { sent.push(env); return { httpStatus: 200, body: ACK(env.taskUUID) }; }, poll: async () => ({ httpStatus: 200, body: { data: [] } }) },
      checkPicture: check,
    });
    const storyId = db.addStory({ sceneCount: 1 });
    pictures(db, storyId, 4);
    await eng.kick({ storyId });
    assert.equal(await eng.onResult(sent[0].taskUUID, IMG(sent[0].taskUUID)), "completed");
    assert.equal(sent.length, 1);
  }
});

// 2026-10-07: a status read that fails says nothing about the clip.
test("a status read the provider fumbles (503, 429, a balance refusal) is 'no news': the clip is not sent again, and its result is still taken", async () => {
  let reads = 0;
  const { db, engine, sent } = setup({ poll: (T) => (++reads <= 6 ? { httpStatus: reads % 2 ? 503 : 402, body: { errors: [{ code: "insufficientCredits", message: "Insufficient credits" }] } } : { httpStatus: 200, body: CLIP(T) }) });
  const storyId = db.addStory({ sceneCount: 1, status: "pictures_ready" });
  clipStep(db, storyId);
  await engine.kick({ storyId });
  for (let t = 0; t < 7; t++) { db.advance(120); await engine.reconcile(); }
  assert.equal(sent.length, 1, "one paid clip, never a second under a new id");
  assert.equal(db.balance, 975, "not refunded while it was still being made");
  db.advance(120);
  await engine.reconcile();
  for (let t = 0; t < 4; t++) { db.advance(60); await engine.reconcile(); }
  const job = [...db.jobs.values()][0];
  assert.equal(job.status, "succeeded", "the clip arrived on the next good read");
  assert.equal(db.balance, 975, "paid for once");
});
