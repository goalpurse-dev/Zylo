// Blocky Stories backend (stage 3b): pure modules, offline.
import test from "node:test";
import assert from "node:assert/strict";
import { LIMITS } from "../supabase/functions/_shared/blocky/limits.js";
import { LIMITS as UI_LIMITS } from "../src/components/viral-tools/blocky-stories/api/limits.js";
import { BLOCKY_MODELS, videoModel } from "../supabase/functions/_shared/blocky/models.js";
import { BUFFER_SEC, clipDurationSec, estimateSpeechSec, maxWordsFor } from "../supabase/functions/_shared/blocky/duration.js";
import { validateCreateStory, validateSeriesPlan, validateEditInstruction, validateScenePrompt, validateId } from "../supabase/functions/_shared/blocky/validation.js";
import { stepBlocker, toStory, episodeStatuses, spentFromLedger } from "../supabase/functions/_shared/blocky/storyState.js";
import { planStep, NOT_READY_BUILDERS } from "../supabase/functions/_shared/blocky/steps.js";
import { fromDbError, errorBody, BlockyError } from "../supabase/functions/_shared/blocky/errors.js";
import { buildEnvelope, parseRunware, redactEnvelope, sameToken, webhookToken } from "../supabase/functions/_shared/blocky/runware.js";
import { ROSTER } from "../scripts/blocky/roster.mjs";

// Library rows as blocky_characters holds them: no age, no gender.
const CHARACTERS = ROSTER.map((a) => ({ id: a.id, name: a.name, tag: a.tag, role: a.role, face: a.face, look: a.look, voice_style: a.voice, ref_image_url: `https://example.test/${a.id}.jpg` }));

const LIB = new Map(CHARACTERS.map((c) => [c.id, c]));
const base = { quality: "v2", aspect: "9:16", lengthSec: 30 };

test("server limits equal the UI limits", () => {
  assert.deepEqual({ ...LIMITS }, { ...UI_LIMITS });
});

test("every tier's tool key and sizes are what tool_prices allows", () => {
  assert.equal(BLOCKY_MODELS.image.toolKey, "image:blocky-story");
  assert.deepEqual(BLOCKY_MODELS.image.sizes["9:16"], [768, 1376]);
  for (const q of ["v2", "v3", "v4"]) {
    assert.equal(videoModel(q).toolKey, `video:blocky-story-${q}`);
    assert.deepEqual(videoModel(q).sizes["9:16"], [720, 1280]);
  }
  assert.deepEqual(videoModel("v4").durations, [4, 6, 8]);
  assert.equal(videoModel("v2").durations[0], 4);
  assert.equal(videoModel("v2").durations.at(-1), 15);
});

test("clip duration: speech + buffer, snapped UP to an allowed length, never shorter", () => {
  const seedance = videoModel("v2").durations;
  const veo = videoModel("v4").durations;
  assert.equal(clipDurationSec("Tonight has to be perfect.", seedance), 4);               // 5 words ≈ 1.9 s
  assert.equal(clipDurationSec("Work was crazy, sorry I'm late, the train just sat there forever.", seedance), 6);
  assert.equal(clipDurationSec("Work was crazy, sorry I'm late, the train just sat there forever.", veo), 6);
  const twelve = "one two three four five six seven eight nine ten eleven twelve";
  assert.equal(clipDurationSec(twelve, veo), 6);                                           // 4.6 + 0.8 = 5.4 → 6
  for (const line of ["Hi.", twelve, `${twelve}, ${twelve}`, "Wait… what?! No, no, no."]) {
    for (const allowed of [seedance, veo]) {
      let d;
      try { d = clipDurationSec(line, allowed); } catch { continue; }
      assert.ok(d >= estimateSpeechSec(line) + BUFFER_SEC, `${line} fits in ${d}s`);
      assert.ok(allowed.includes(d));
      const smaller = allowed.filter((x) => x < d).at(-1);
      if (smaller) assert.ok(smaller < estimateSpeechSec(line) + BUFFER_SEC, "not longer than needed");
    }
  }
  assert.throws(() => clipDurationSec(Array(30).fill("word").join(" "), veo), /LINE_TOO_LONG/);
  assert.equal(maxWordsFor(veo), 18);
});

test("script lines are kept EXACTLY as written; the cast is the speakers", () => {
  const script = [{ speakerId: "vex", line: "Tonight has to be perfect.  " }, { speakerId: "noob", line: "  Work was crazy — sorry!" }];
  const v = validateCreateStory({ ...base, source: "script", script }, LIB);
  assert.deepEqual(v.script, script);
  assert.deepEqual(v.castIds, ["vex", "noob"]);
  assert.equal(v.lengthSec, 8);                        // 4 s + 4 s, derived from the lines
});

test("script validation: speakers, empty lines, too long for the tier", () => {
  const four = ["vex", "noob", "lux", "taz"].map((speakerId) => ({ speakerId, line: "Hello there." }));
  assert.throws(() => validateCreateStory({ ...base, source: "script", script: four }, LIB), /at most 3/);
  assert.throws(() => validateCreateStory({ ...base, source: "script", script: [{ speakerId: "vex", line: "Hi." }] }, LIB), /at least two lines/);
  assert.throws(() => validateCreateStory({ ...base, source: "script", script: [{ speakerId: "nobody", line: "Hi." }, { speakerId: "vex", line: "Hey." }] }, LIB), /character library/);
  const long = Array(19).fill("word").join(" ");
  assert.doesNotThrow(() => validateCreateStory({ ...base, source: "script", script: [{ speakerId: "vex", line: long }, { speakerId: "noob", line: "Ok." }] }, LIB));
  assert.throws(() => validateCreateStory({ ...base, quality: "v4", source: "script", script: [{ speakerId: "vex", line: long }, { speakerId: "noob", line: "Ok." }] }, LIB), /under 18 words/);
});

test("prompt and idea validation", () => {
  assert.throws(() => validateCreateStory({ ...base, source: "prompt", prompt: "short", castIds: ["vex"] }, LIB), /sentence or two/);
  assert.throws(() => validateCreateStory({ ...base, source: "prompt", prompt: "x".repeat(1001), castIds: ["vex"] }, LIB), /under 1000/);
  assert.throws(() => validateCreateStory({ ...base, source: "prompt", prompt: "A long enough idea.", castIds: ["vex", "noob", "lux", "taz"] }, LIB), /1 to 3/);
  assert.throws(() => validateCreateStory({ ...base, lengthSec: 22, source: "prompt", prompt: "A long enough idea.", castIds: ["vex"] }, LIB), /length/);
  const idea = validateCreateStory({ ...base, source: "idea", ideaId: "x" }, LIB, () => ({ castIds: ["vex", "noob", "lux"] }));
  assert.deepEqual(idea.castIds, ["vex", "noob", "lux"]);
  assert.throws(() => validateCreateStory({ ...base, source: "idea", ideaId: "gone" }, LIB, () => null), /isn't available/);
  assert.throws(() => validateCreateStory({ ...base, quality: "v9", source: "prompt" }, LIB), /V2, V3 or V4/);
});

test("series, edit, prompt and id validation", () => {
  assert.throws(() => validateSeriesPlan({ concept: "A fake admin takes over the server", castIds: ["taz"], episodeCount: 5 }, LIB), /2 to 5/);
  assert.throws(() => validateSeriesPlan({ concept: "A fake admin takes over the server", castIds: ["taz", "kodo"], episodeCount: 12 }, LIB), /3 to 10/);
  assert.equal(validateEditInstruction("  make it night "), "make it night");
  assert.throws(() => validateEditInstruction(" "), /what should change/);
  assert.throws(() => validateScenePrompt("x".repeat(2501)), /2500/);
  assert.throws(() => validateId("not-a-uuid"), (e) => e.code === "NOT_FOUND");
});

test("step rules follow the contract's status machine", () => {
  const scenes = [{ imageStatus: "ready", clipStatus: "none" }, { imageStatus: "failed", clipStatus: "none" }];
  assert.equal(stepBlocker("pictures", { status: "draft" }, scenes), null);
  assert.match(stepBlocker("pictures", { status: "pictures" }, scenes), /already/);
  assert.match(stepBlocker("animate", { status: "pictures_ready" }, scenes), /needs a picture/);
  assert.equal(stepBlocker("animate", { status: "pictures_ready" }, [scenes[0]]), null);
  assert.match(stepBlocker("edit", { status: "animating" }, scenes, scenes[0]), /after animating/);
  assert.match(stepBlocker("edit", { status: "pictures" }, scenes, { imageStatus: "generating" }), /still being made/);
  assert.equal(stepBlocker("reclip", { status: "final_ready" }, scenes, { clipStatus: "ready" }), null);
  assert.match(stepBlocker("final", { status: "clips_ready" }, [{ clipStatus: "failed" }]), /needs a clip/);
});

test("rows map to the exact contract Story shape", () => {
  const row = { id: "s1", title: "T", cast_ids: ["vex"], quality: "v2", length_sec: 15, aspect: "9:16", status: "draft", final_status: "none", final_url: null, final_trimmed_sec: "0.00", final_captions: true, final_trimmed_per_clip: [], final_error: null, created_at: "2026-09-27T00:00:00Z", series_id: null };
  const scenes = [{ id: "b", idx: 1, title: "", speaker_id: "vex", line: "Two.", present_ids: ["vex"], duration_sec: 4, image_status: "queued", image_url: null, image_prompt: "", clip_status: "none", clip_url: null, error: null },
    { id: "a", idx: 0, title: "", speaker_id: "vex", line: "One.", present_ids: ["vex"], duration_sec: 4, image_status: "queued", image_url: null, image_prompt: "", clip_status: "none", clip_url: null, error: null }];
  const s = toStory(row, scenes);
  assert.deepEqual(Object.keys(s).sort(), ["aspect", "castIds", "castRoles", "createdAt", "final", "id", "lengthSec", "quality", "scenes", "spentCredits", "status", "title"]);
  assert.equal(toStory(row, scenes, spentFromLedger([{ operation: "charge", credits: 24 }, { operation: "charge", credits: 30 }, { operation: "refund", credits: 30 }, { operation: "charge", credits: 165 }])).spentCredits, 189, "charges minus refunds");
  assert.deepEqual(s.scenes.map((x) => x.line), ["One.", "Two."]);
  assert.deepEqual(Object.keys(s.scenes[0]).sort(), ["clipStatus", "clipUrl", "durationSec", "error", "id", "imageCheck", "imagePrompt", "imageStatus", "imageUrl", "index", "line", "presentIds", "speakerId", "title"]);
  assert.deepEqual(s.scenes[0].imageCheck, { status: "none", notes: null, freeRegenerate: false });
  assert.equal(s.final.trimmedSec, 0);
});

test("episodes unlock in order", () => {
  const eps = [1, 2, 3].map((n) => ({ number: n, title: `E${n}`, summary: "", cliffhanger: "", story_id: n === 1 ? "s1" : null }));
  assert.deepEqual(episodeStatuses(eps, new Map([["s1", "final_ready"]])).map((e) => e.status), ["made", "next", "locked"]);
  assert.deepEqual(episodeStatuses(eps, new Map([["s1", "clips_ready"]])).map((e) => e.status), ["next", "locked", "locked"]);
});

test("paid steps refuse until their stage is switched on; builders must keep saved == sent", () => {
  const story = { status: "draft", quality: "v2", scenes: [] };
  const scenes = [{ id: "a", imageStatus: "queued", clipStatus: "none" }];
  assert.throws(() => planStep("pictures", { story, scenes, library: LIB, builders: NOT_READY_BUILDERS }), (e) => e.code === "STAGE_NOT_READY");
  const good = { picture: () => ({ prompt: "P", request: { positivePrompt: "P" }, priceInput: { width: 768, height: 1376 } }) };
  const plan = planStep("pictures", { story, scenes, library: LIB, builders: good });
  assert.deepEqual(plan.items.map((i) => [i.scene_id, i.kind, i.tool_key, i.prompt]), [["a", "image", "image:blocky-story", "P"]]);
  assert.deepEqual(plan.from, ["draft"]);
  const lying = { picture: () => ({ prompt: "P", request: { positivePrompt: "P, plus extra" }, priceInput: {} }) };
  assert.throws(() => planStep("pictures", { story, scenes, library: LIB, builders: lying }), /saved==sent/);
});

test("database errors become friendly codes; raw text never reaches the user", () => {
  assert.equal(fromDbError({ message: "INSUFFICIENT_CREDITS" }).code, "INSUFFICIENT_CREDITS");
  assert.equal(fromDbError({ message: "PLAN_UPGRADE_REQUIRED: generative" }).message, "This needs the Generative plan.");
  assert.equal(fromDbError({ message: "WRONG_STATUS: story is pictures" }).code, "WRONG_STATUS");
  const leak = errorBody(fromDbError({ message: 'relation "secret_table" does not exist' }));
  assert.equal(leak.code, "SERVER_FAILED");
  assert.doesNotMatch(leak.message, /secret_table/);
  assert.deepEqual(errorBody(new BlockyError("VALIDATION", "Pick 1 to 3 characters.")), { ok: false, code: "VALIDATION", message: "Pick 1 to 3 characters." });
});

// Fixtures modeled on Runware's documented response shapes; stages 3d/3e add
// real recorded responses.
test("Runware replies are normalized: success, pending, errors, content policy", () => {
  const T = "11111111-1111-4111-8111-111111111111";
  assert.deepEqual(parseRunware({ data: [{ taskType: "imageInference", taskUUID: T, imageURL: "https://im.runware.ai/x.jpg", cost: 0.0337 }] }, T),
    { state: "success", url: "https://im.runware.ai/x.jpg", cost: 0.0337 });
  assert.equal(parseRunware({ data: [{ taskType: "videoInference", taskUUID: T, status: "processing" }] }, T).state, "pending");
  assert.equal(parseRunware({ data: [{ taskType: "videoInference", taskUUID: T }] }, T).state, "accepted");
  const busy = parseRunware({ errors: [{ code: "rateLimitExceeded", message: "Too many requests", taskUUID: T }] }, T, 429);
  assert.equal(busy.retryable, true);
  const policy = parseRunware({ errors: [{ code: "contentModerationFailed", message: "Prompt flagged by safety filter", taskUUID: T }] }, T, 400);
  assert.deepEqual([policy.contentPolicy, policy.retryable], [true, false]);
  assert.equal(parseRunware(null, T, 503).retryable, true);
  assert.equal(parseRunware({ errors: [{ code: "invalidDuration", message: "duration must be one of 4, 6, 8", taskUUID: T }] }, T, 400).retryable, false);
  assert.equal(parseRunware({ data: [] }, T).state, "unknown");
});

test("the envelope adds only transport fields; logs never contain the webhook token", async () => {
  const request = { taskType: "imageInference", model: "google:nano-banana@2-lite", positivePrompt: "P", width: 768, height: 1376 };
  const env = buildEnvelope(request, { taskUUID: "u", webhookURL: "https://x/blocky-worker?action=webhook&t=SECRET" });
  assert.deepEqual(Object.keys(env).filter((k) => !(k in request)).sort(), ["deliveryMethod", "includeCost", "taskUUID", "webhookURL"]);
  for (const k of Object.keys(request)) assert.equal(env[k], request[k]);
  assert.doesNotMatch(JSON.stringify(redactEnvelope(env)), /SECRET/);
  const t1 = await webhookToken("s3cret", "u");
  assert.equal(t1, await webhookToken("s3cret", "u"));
  assert.notEqual(t1, await webhookToken("s3cret", "v"));
  assert.ok(sameToken(t1, t1) && !sameToken(t1, t1.slice(1) + "0"));
});
