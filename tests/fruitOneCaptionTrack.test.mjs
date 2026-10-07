// An AI Fruit Story video has exactly ONE caption track: the one the final
// video draws. Ported from Blocky Stories on 2026-10-08 (owner's request),
// where the first real story showed two caption lines at once: the video
// model (Wan) drew its own subtitles into 2 of 4 clips, although the clip
// prompt forbids them, and the final video drew its captions on top. Fruit's
// clip prompt and clip check were the same, so the fault was here too.
//
//   1. Prevent: the Wan request also carries a negative prompt against drawn text.
//   2. Detect: the clip check looks at two frames from the middle of the line; a
//      clip with drawn words is made again once, at our cost, and the remade
//      clip is looked at again (never made a third time).
//   3. Guarantee: a clip that still carries drawn words gets NO caption of ours
//      in the final video, so there is never more than one line on screen.
// And the downloaded MP4 is the file the player shows.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createEngine, REMAKE_NOTE } from "../supabase/functions/_shared/fruit/engine.js";
import { NO_DRAWN_TEXT, clipTask } from "../supabase/functions/_shared/fruit/clips.js";
import { CLIP_FRAME_PURPOSE, DRAWN_TEXT_PROBLEM, checkPicture, checkPrompt, checkSchema, verdictOf } from "../supabase/functions/_shared/fruit/pictureCheck.js";
import { FRAME_SCRIPT, checkClipFrame, framePath, speechFramesPath } from "../supabase/functions/_shared/fruit/clipCheck.js";
import { buildFinalJob, scenesWithDrawnText } from "../supabase/functions/_shared/fruit/final.js";
import { createMemoryDb } from "./helpers/fruitMemoryStore.mjs";

const read = (rel) => fs.readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const CLIP = (taskUUID) => ({ data: [{ taskType: "videoInference", taskUUID, status: "success", videoURL: `https://vm.runware.ai/${taskUUID}.mp4`, cost: 0.2 }] });
const ACK = (taskUUID) => ({ data: [{ taskType: "videoInference", taskUUID }] });
const expected = [{ name: "Mia Mango", fruit: "mango" }, { name: "Rick Radish", fruit: "radish" }];
const clean = (over = {}) => ({
  characters: [{ name: "Mia Mango", visible: true, hasFruitHead: true }, { name: "Rick Radish", visible: true, hasFruitHead: true }],
  mainFigures: 2, backgroundFigures: 0, humanHeads: 0, humanHair: false, duplicates: [], readableText: "",
  speakerHeadPercent: 0, speakerShownTo: "unknown", drawnText: "", notes: "", ...over,
});

test("1. prevent: the Wan clip request says 'no drawn text' in its negative prompt too; the other tiers are unchanged", () => {
  const args = { prompt: "p", imageUrl: "https://example.test/scene.jpg", aspect: "9:16", durationSec: 5 };
  const wan = clipTask({ quality: "v2", ...args });
  assert.equal(wan.negativePrompt, NO_DRAWN_TEXT);
  assert.match(NO_DRAWN_TEXT, /subtitles, captions/);
  assert.ok(NO_DRAWN_TEXT.length <= 500, "Wan takes at most 500 characters there");
  assert.ok(!("negativePrompt" in clipTask({ quality: "v3", ...args })) && !("negativePrompt" in clipTask({ quality: "v4", ...args })));
  // The clip prompt itself still forbids them.
  assert.match(read("supabase/functions/_shared/fruit/clips.js"), /No subtitles, captions or on-screen text\./);
});

test("2. detect: the clip check gets a second picture (two frames from the middle of the line) and one more question", async () => {
  // Only clip checks with the second picture ask it; a scene picture's check is unchanged.
  assert.ok(!("drawnText" in checkSchema().properties) && !/drawnText/.test(checkPrompt(expected, { speaker: "Mia Mango" })));
  assert.ok(checkSchema({ speech: true }).required.includes("drawnText"));
  assert.match(checkPrompt(expected, { speech: true }), /drawnText: every question above is about the FIRST picture\. A SECOND picture is attached: two earlier moments of the same clip, side by side, taken while the line is being spoken\./);
  // The verdict: words the model drew fail the clip, whatever the last frame looks like.
  const bad = verdictOf(clean({ drawnText: "Table for two,\nMarco?" }), expected, { missingOk: true });
  assert.equal(bad.ok, false);
  assert.ok(bad.problems[0].startsWith(DRAWN_TEXT_PROBLEM));
  assert.equal(verdictOf(clean({ drawnText: "" }), expected, { missingOk: true }).ok, true);
  assert.equal(verdictOf(clean({ drawnText: "-" }), expected, { missingOk: true }).ok, true, "a stray mark is not words");
  // Through the check: both pictures are sent, the speech one second, and the call is logged with the verdict.
  const logged = [];
  const admin = { from: () => ({ insert: async (row) => { logged.push(row); return {}; } }) };
  let sent;
  const v = await checkClipFrame({
    admin, apiKey: "k", frameUrl: "https://cdn.test/last.jpg", speechUrl: "https://cdn.test/speech.jpg", expected, ids: { job_id: "j1", attempt: 1 },
    fetchLlm: async (req) => { sent = req; return { data: clean({ drawnText: "It was a client dinner" }), costUsd: 0.002, httpStatus: 200, usage: {} }; },
  });
  assert.deepEqual(sent.user.filter((p) => p.type === "input_image").map((p) => p.image_url), ["https://cdn.test/last.jpg", "https://cdn.test/speech.jpg"]);
  assert.ok(sent.schema.required.includes("drawnText"));
  assert.equal(v.ok, false);
  assert.ok(v.problems[0].startsWith(DRAWN_TEXT_PROBLEM), "not blamed on the last frame");
  assert.equal(logged[0].purpose, CLIP_FRAME_PURPOSE);
  assert.equal(logged[0].attempt, 1, "the attempt is logged, so the final video can tell which clip the check was for");
  assert.ok(logged[0].response.verdict.problems[0].startsWith(DRAWN_TEXT_PROBLEM));
  // Without the second picture (an older frame, a failed upload) the check still runs as before.
  const plain = await checkPicture({ admin, apiKey: "k", imageUrl: "https://cdn.test/last.jpg", expected, purpose: CLIP_FRAME_PURPOSE, ids: {}, fetchLlm: async (req) => { assert.equal(req.user.filter((p) => p.type === "input_image").length, 1); return { data: clean(), costUsd: 0.001, httpStatus: 200, usage: {} }; } });
  assert.equal(plain.ok, true);
});

test("2. detect: the frame machine also takes two frames from the middle of the clip, to their own file", () => {
  assert.equal(framePath("u", "s", "j", 2), "fruit/u/s/j-a2-last.jpg");
  assert.equal(speechFramesPath("u", "s", "j", 2), "fruit/u/s/j-a2-speech.jpg");
  // The script the machine runs: 30% and 60% of the clip, side by side, uploaded to the second address.
  assert.match(FRAME_SCRIPT, /String\(length \* 0\.3\)[^]*String\(length \* 0\.6\)[^]*hstack=inputs=2/);
  assert.match(FRAME_SCRIPT, /job\.speechUploadUrl/);
  // fruit-worker asks for both and passes both to the check, with the attempt.
  const worker = read("supabase/functions/fruit-worker/index.ts");
  assert.match(worker, /speechFramesPath\(job\.user_id, job\.story_id, job\.id, job\.attempt\)/);
  assert.match(worker, /speechUrl: frame\.speechPath \?/);
  assert.match(worker, /job_id: job\.id, attempt: job\.attempt \}/);
});

/** An engine whose frame check answers from `verdicts` (one per attempt, in order). */
function clipEngine(verdicts) {
  const db = createMemoryDb({ balance: 1000 });
  const sent = [];
  const frameChecks = [];
  let n = 0;
  const engine = createEngine({
    store: db.store,
    runware: { submit: async (env) => { sent.push(env); return { httpStatus: 200, body: ACK(env.taskUUID) }; }, poll: async () => ({ httpStatus: 200, body: { data: [] } }) },
    media: { store: async ({ path }) => `https://cdn.test/${path}` },
    env: { FRUIT_PAID_CALLS: "", webhookBase: "https://fn.test/fruit-worker", webhookSecret: "s3cret" },
    checkClipWords: async () => ({ ok: true, problems: [] }),
    requestClipFrame: async (job) => ({ path: `frames/${job.id}-a${job.attempt}-last.jpg`, speechPath: `frames/${job.id}-a${job.attempt}-speech.jpg`, callId: null }),
    checkClipFrame: async (job, frame) => { frameChecks.push({ attempt: job.attempt, speechPath: frame.speechPath }); return verdicts[frameChecks.length - 1]; },
    now: () => db.clock(),
    uuid: () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
    log: { error() {} },
  });
  const storyId = db.addStory({ sceneCount: 1, status: "pictures_ready" });
  const [scene] = [...db.scenes.values()];
  db.chargeStep(storyId, { from: ["pictures_ready"], to: "animating", items: [{ scene_id: scene.id, kind: "clip", credits: 25, request: { taskType: "videoInference", model: "wan", positivePrompt: "p", duration: 5 } }] });
  return { db, engine, sent, frameChecks, storyId, job: () => [...db.jobs.values()][0], scene: () => [...db.scenes.values()][0] };
}
const DRAWN = { ok: false, problems: [`${DRAWN_TEXT_PROBLEM} ("Table for two, Marco?")`] };
const FINE = { ok: true, problems: [] };

test("2. a clip with drawn subtitles is made again once at our cost, and the new clip is looked at again", async () => {
  const t = clipEngine([DRAWN, FINE]);
  await t.engine.kick({ storyId: t.storyId });
  assert.equal(await t.engine.onResult(t.sent[0].taskUUID, CLIP(t.sent[0].taskUUID)), "frame_pending", "waits for its frames");
  assert.equal(await t.engine.onClipFrame(t.job().id, true), "remade");
  assert.ok(t.job().error.startsWith(REMAKE_NOTE) && t.job().error.includes(DRAWN_TEXT_PROBLEM));
  assert.notEqual(t.scene().clip_status, "ready", "the user never sees the clip with two captions: it goes straight back to being made");
  assert.equal(t.sent.length, 2, "one remake");
  assert.equal(t.db.balance, 975, "the user paid for one clip");
  // The remade clip: its frames are checked too, so the final video knows what it carries.
  assert.equal(await t.engine.onResult(t.sent[1].taskUUID, CLIP(t.sent[1].taskUUID)), "frame_pending");
  assert.equal(await t.engine.onClipFrame(t.job().id, true), "completed");
  assert.deepEqual(t.frameChecks.map((c) => c.attempt), [1, 2]);
  assert.ok(t.frameChecks.every((c) => /-speech\.jpg$/.test(c.speechPath)), "the check is given the mid-line frames");
  assert.equal(t.scene().clip_status, "ready");
});

test("2. a remade clip that STILL has drawn subtitles is kept (never a third clip), and its check is on record", async () => {
  const t = clipEngine([DRAWN, DRAWN]);
  await t.engine.kick({ storyId: t.storyId });
  await t.engine.onResult(t.sent[0].taskUUID, CLIP(t.sent[0].taskUUID));
  assert.equal(await t.engine.onClipFrame(t.job().id, true), "remade");
  await t.engine.onResult(t.sent[1].taskUUID, CLIP(t.sent[1].taskUUID));
  assert.equal(await t.engine.onClipFrame(t.job().id, true), "completed");
  assert.equal(t.sent.length, 2, "made twice, never three times");
  assert.equal(t.frameChecks.length, 2);
  assert.equal(t.db.balance, 975);
});

test("3. guarantee: the final video leaves its caption off a clip that carries drawn words", () => {
  const scenes = [{ id: "s1", clip_job_id: "j1" }, { id: "s2", clip_job_id: "j2" }, { id: "s3", clip_job_id: "j3" }, { id: "s4", clip_job_id: "j4" }];
  const jobs = [{ id: "j1", attempt: 2 }, { id: "j2", attempt: 1 }, { id: "j3", attempt: 2 }, { id: "j4", attempt: 2 }];
  const check = (job_id, attempt, problems, created_at) => ({ job_id, attempt, created_at, response: { verdict: { ok: !problems.length, problems } } });
  const drawn = [`${DRAWN_TEXT_PROBLEM} ("Freeze")`];
  const checks = [
    check("j1", 1, drawn, "2026-10-08T10:00:00Z"), check("j1", 2, [], "2026-10-08T10:02:00Z"),      // remade, and the new clip is clean
    check("j2", 1, [], "2026-10-08T10:00:00Z"),                                                     // clean from the start
    check("j3", 1, drawn, "2026-10-08T10:00:00Z"), check("j3", 2, drawn, "2026-10-08T10:02:00Z"),   // remade, still drawn
    check("j4", 1, drawn, "2026-10-08T10:00:00Z"),                                                  // remade, but the new clip was never checked
  ];
  assert.deepEqual([...scenesWithDrawnText(scenes, jobs, checks, DRAWN_TEXT_PROBLEM)].sort(), ["s3", "s4"]);
  assert.equal(scenesWithDrawnText(scenes, jobs, [], DRAWN_TEXT_PROBLEM).size, 0, "no checks on record: captions as usual");
  // A clip the user regenerated is a new job: the old job's checks no longer count.
  assert.equal(scenesWithDrawnText([{ id: "s3", clip_job_id: "j9" }], [{ id: "j9", attempt: 1 }], checks, DRAWN_TEXT_PROBLEM).size, 0);

  // What fruit-story-api does with it, and what the builder does with an empty caption.
  const api = read("supabase/functions/fruit-story-api/index.ts");
  assert.match(api, /scenesWithDrawnText\(ordered\.map\(\(s: any\) => \(\{ id: s\.id, clip_job_id: s\.clip_job_id \}\)\), clipJobs \?\? \[\], frameChecks \?\? \[\], DRAWN_TEXT_PROBLEM\)/);
  assert.match(api, /if \(drawn\.has\(ordered\[i\]\.id\)\) \{ c\.caption = ""; c\.drawnText = true; \}/);
  const builder = read("render-worker/src/fruitFinal.mjs");
  assert.match(builder, /const captionText = clip\.caption \?\? clip\.line;\s+if \(job\.captions && captionText\) \{/, "an empty caption draws nothing for that clip (and \"\" is kept: ?? only falls back for a missing one)");
  // The job itself: one line per clip, and nothing else that could draw text.
  const job = buildFinalJob({ story: { id: "st", aspect: "9:16" }, callId: "c", captions: true, uploadUrl: "u", callbackUrl: "cb", token: "t", scenes: [{ idx: 0, clip_status: "ready", clip_url: "https://cdn.test/1.mp4", line: "One." }, { idx: 1, clip_status: "ready", clip_url: "https://cdn.test/2.mp4", line: "Two." }] });
  assert.deepEqual(job.clips, [{ url: "https://cdn.test/1.mp4", line: "One." }, { url: "https://cdn.test/2.mp4", line: "Two." }]);
  assert.ok(!("overlays" in job), "no Part label or end card unless asked for");
});

test("the player and the download are the same file, and nothing is drawn over the player", () => {
  const view = read("src/components/viral-tools/ai-fruit-story-v2/workspace/FinalView.jsx");
  const flow = read("src/components/viral-tools/ai-fruit-story-v2/hooks/useFruitV2Flow.js");
  assert.match(view, /<video[^>]*\s+src=\{story\.final\.url\}/s, "the player shows the final file");
  assert.match(flow, /saveMediaToDevice\(\{ url: story\.final\.url, filename: `\$\{name\}\.mp4`/, "the download saves that same file");
  assert.doesNotMatch(view, /<track\b|scene\.line|\.line\}/, "no caption overlay or subtitle track on the player: captions live in the file only");
  // Captions on or off is a rebuild of the file, not an overlay.
  assert.match(read("supabase/functions/fruit-story-api/index.ts"), /startFinal\(ctx\.userId, storyId, \{ captions: ctx\.body\?\.captions !== false/);
});
