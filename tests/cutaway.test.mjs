import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PRICE_ROWS, PRICES, totalCredits, USD_PER_CREDIT, planCostUsd, videoCostUsd, BASIS } from "../supabase/functions/_shared/cutaway/pricing.js";
import { validatePlan, keyframesOf, clipPrompt, narrationText, normBox, targetWords } from "../supabase/functions/_shared/cutaway/planner.js";
import { placeBeats, clipTimings, voiceTempo, cropPixels, upscaleFactor, evenBeats } from "../supabase/functions/_shared/cutaway/beats.js";
import { alignmentWords } from "../supabase/functions/_shared/cutaway/voice.js";
import { clipTask, parseReply } from "../supabase/functions/_shared/cutaway/runware.js";
import { advance, approve, newRun, regenerateWide, renderJob, progressOf } from "../supabase/functions/_shared/cutaway/engine.js";
import { buildAss, captionWord, finalArgs, atempoChain } from "../render-worker/src/cutawayFinalPlan.mjs";

// ---------- a plan like the planner returns (15 s: 5 beats, 4 states) ----------

const beatTexts = [
  "Put a roof on a house and the rain pours straight off the edge.",
  "It hammers the ground right against your walls and soaks in.",
  "It soaks down to your foundation and cracks it open wide.",
  "So you hang a channel along the roof edge to catch it all.",
  "And a pipe down the corner carries it away from your walls.",
];
const verbs = ["pours", "hammers", "cracks", "hang", "carries"];
function samplePlan() {
  return {
    title: "How a rain gutter works",
    facts: [{ claim: "Roof runoff next to a wall saturates soil", check: "Water concentrates at the drip line" }],
    world: "A two-storey cream house with a terracotta roof on a striped lawn.",
    cutaway: "The ground is cut along the front wall, exposing soil and the foundation.",
    states: [
      { id: "W0", label: "Sunny master", description: "Sunny, no gutter.", change: "" },
      { id: "W1", label: "Rain", description: "Heavy rain, runoff curtain.", change: "make it rain" },
      { id: "W2", label: "Gutter in rain", description: "Gutter and downspout carry the water.", change: "add a gutter" },
      { id: "W3", label: "Sun", description: "Sun out, dry soil.", change: "stop the rain" },
    ],
    beats: beatTexts.map((text, i) => ({
      text, verb: verbs[i], state: i < 3 ? "W1" : "W2", box: { x: 0.1 * i, y: 0.2, w: i === 0 ? 1 : 0.45 },
      show: `view ${i}`, edit: i === 1 ? "the ground along the wall is dark and wet" : "", action: `action ${i}`, overlay: "arrows", move: i === 2 ? "pull-out" : "push-in",
    })),
    end: { state: "W3", box: { x: 0, y: 0, w: 1 }, show: "the sunny house with its gutter", edit: "" },
  };
}

// ---------- pricing ----------

test("prices are 2x our cost, rounded up to whole credits", () => {
  for (const s of [15, 30]) {
    assert.equal(PRICES.plan.byLength[s], Math.ceil((planCostUsd(s) * BASIS.markup) / USD_PER_CREDIT));
    assert.ok(PRICES.video.byLength[s] * USD_PER_CREDIT >= videoCostUsd(s) * 2);
  }
  assert.equal(totalCredits(15), 55);
  assert.equal(totalCredits(30), 94);
});

test("the per-second video row gives the same credits as pricing.js", () => {
  for (const s of [15, 30]) assert.equal(Math.ceil(PRICES.video.creditsPerSecond * s), PRICES.video.byLength[s]);
});

test("the migration's tool_prices rows match pricing.js", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20261106100000_cutaway_explainer.sql", import.meta.url), "utf8");
  for (const row of PRICE_ROWS) {
    const line = sql.split("\n").find((l) => l.includes(`'${row.tool_key}'`) && l.trim().startsWith("("));
    assert.ok(line, `no row for ${row.tool_key}`);
    if (row.flat_credits != null) assert.match(line, new RegExp(`'${row.tool_key}', NULL, ${row.flat_credits},`));
    else assert.match(line, new RegExp(`'${row.tool_key}', ${row.credits_per_second}, NULL, ARRAY\\[15, 30\\]`));
  }
});

// ---------- plan ----------

test("validatePlan accepts a good plan and clamps crop boxes", () => {
  const p = validatePlan(samplePlan(), 15);
  assert.equal(p.beats.length, 5);
  for (const b of p.beats) assert.ok(b.box.w >= 0.4 && b.box.x + b.box.w <= 1 && b.box.y + b.box.w <= 1);
  assert.equal(keyframesOf(p).length, 6);
  assert.equal(narrationText(p).split(" ").length, beatTexts.join(" ").split(" ").length);
});

test("validatePlan rejects a verb that isn't in its beat, and a wrong beat count", () => {
  const bad = samplePlan();
  bad.beats[0].verb = "floods";
  assert.throws(() => validatePlan(bad, 15), /verb "floods"/);
  const short = samplePlan();
  short.beats.pop();
  assert.throws(() => validatePlan(short, 15), /beats: 4/);
});

test("normBox keeps a 9:16 crop inside the image and never under 40% wide", () => {
  assert.deepEqual(normBox({ x: 0.9, y: 0.9, w: 0.1 }), { x: 0.6, y: 0.6, w: 0.4 });
  assert.equal(targetWords(15), 57);
});

test("clip prompts restate the scene, land the verb, and move only at the end", () => {
  const p = validatePlan(samplePlan(), 15);
  const text = clipPrompt(p, 1, { clipSec: 3, verbAtSec: 0.4 });
  assert.match(text, /two-storey cream house/);
  assert.match(text, /At about 0\.4 seconds: action 1/);
  assert.match(text, /in the last 0\.7 seconds it pushes in quickly to the next view: view 2/);
  assert.ok(text.length <= 2000);
});

// ---------- timing ----------

function fakeSpoken(texts, wps = 3) {
  const out = [];
  let t = 0.1;
  for (const w of texts.join(" ").split(" ")) { out.push({ w, s: t, e: t + 0.25 }); t += 1 / wps; }
  return out;
}

test("the voice is sped up to ~238 wpm, never above 1.45x, never slowed", () => {
  const t = voiceTempo(fakeSpoken(beatTexts, 3)); // ~180 wpm -> ~1.32
  assert.ok(t > 1.3 && t < 1.34, String(t));
  assert.equal(voiceTempo(fakeSpoken(beatTexts, 1.5)), 1.45);
  assert.equal(voiceTempo(fakeSpoken(beatTexts, 6)), 1);
});

test("beats start on their first word and the verb time is inside the beat", () => {
  const spoken = fakeSpoken(beatTexts, 3);
  const placed = placeBeats(validatePlan(samplePlan(), 15).beats, spoken, 1.3);
  assert.equal(placed[0].start, 0);
  for (let i = 1; i < placed.length; i++) assert.equal(placed[i].start, placed[i - 1].end);
  for (const p of placed) assert.ok(p.verbAt >= 0 && p.verbAt <= p.duration);
  const clips = clipTimings(placed);
  for (const [i, c] of clips.entries()) {
    assert.ok(Number.isInteger(c.clipSec) && c.clipSec >= 2);
    assert.ok(Math.abs(c.clipSec / c.speed - placed[i].duration) < 0.01);
  }
  assert.equal(evenBeats(beatTexts, 15)[4].end, 15);
});

test("ElevenLabs character alignment becomes words", () => {
  const a = { characters: [..."Hi you"], character_start_times_seconds: [0, 0.1, 0.2, 0.3, 0.4, 0.5], character_end_times_seconds: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6] };
  assert.deepEqual(alignmentWords(a), [{ w: "Hi", s: 0, e: 0.2 }, { w: "you", s: 0.3, e: 0.6 }]);
});

test("crops are 9:16 whole pixels inside the image; small crops upscale 4x", () => {
  const c = cropPixels({ x: 0.5, y: 0.5, w: 0.45 }, 768, 1376);
  assert.ok(c.x + c.w <= 768 && c.y + c.h <= 1376);
  assert.ok(Math.abs(c.h / c.w - 16 / 9) < 0.02);
  assert.equal(upscaleFactor(c.h), 4);
  assert.equal(upscaleFactor(1365), 2);
});

// ---------- Runware ----------

test("clip task: first + last frame, 720p, audio off, no width/height", () => {
  const t = clipTask({ prompt: "x", firstUrl: "a", lastUrl: "b", durationSec: 3 });
  assert.equal(t.model, "prunaai:p-video@2");
  assert.deepEqual(t.inputs.frameImages, [{ image: "a", frame: "first" }, { image: "b", frame: "last" }]);
  assert.equal(t.settings.audio, false);
  assert.equal(t.resolution, "720p");
  assert.equal(t.width, undefined);
  assert.equal(t.duration, 3);
});

test("Runware replies: success, pending, error", () => {
  assert.deepEqual(parseReply({ data: [{ taskUUID: "t", imageURL: "u", cost: 0.03 }] }, "t"), { state: "success", url: "u", cost: 0.03 });
  assert.equal(parseReply({ data: [] }, "t").state, "pending");
  assert.equal(parseReply({ errors: [{ taskUUID: "t", message: "content moderation" }] }, "t").contentPolicy, true);
});

// ---------- the engine, end to end on fakes ----------

function fakeDeps() {
  const tasks = new Map();
  const log = [];
  return {
    log,
    planVideo: async () => ({ plan: validatePlan(samplePlan(), 15), costUsd: 0.05 }),
    synthesize: async ({ text }) => ({ audioBase64: "AAAA", spoken: fakeSpoken([text], 3), costUsd: 0.01 }),
    saveAudio: async () => "https://store/voice.mp3",
    send: async (batch) => {
      const t = batch[0];
      if (t.taskType === "getResponse") {
        const known = tasks.get(t.taskUUID);
        return { status: 200, body: { data: [{ taskUUID: t.taskUUID, status: "success", ...(known.taskType === "videoInference" ? { videoURL: `https://rw/${t.taskUUID}.mp4` } : { imageURL: `https://rw/${t.taskUUID}.jpg` }), cost: 0.01 }] } };
      }
      tasks.set(t.taskUUID, t);
      log.push(t);
      return { status: 200, body: { data: [{ taskUUID: t.taskUUID, status: "processing" }] } };
    },
    crop: async ({ imageUrl }) => ({ image: `${imageUrl}#crop`, h: 610 }),
    keep: async (url) => url,
    startRender: async (job) => ({ job }),
    checkRender: async () => ({ state: "done", url: "https://store/final.mp4", costUsd: 0.004 }),
  };
}

async function runUntil(state, deps, stop, max = 200) {
  let s = state;
  for (let i = 0; i < max && !stop(s); i++) s = await advance(s, deps);
  return s;
}

test("engine: plan -> voice -> wide images -> STOPS for approval", async () => {
  const deps = fakeDeps();
  const s = await runUntil(newRun({ topic: "rain gutter", lengthSec: 15 }), deps, (x) => x.step === "approval" || x.step === "failed");
  assert.equal(s.step, "approval", s.error);
  assert.equal(s.wide.length, 4);
  // each state after the master is an edit of the previous image
  const images = deps.log.filter((t) => t.taskType === "imageInference");
  assert.equal(images[0].inputs, undefined);
  for (let i = 1; i < 4; i++) assert.deepEqual(images[i].inputs.referenceImages, [s.wide[i - 1].url]);
  assert.ok(s.voice.tempo > 1);
  // nothing past approval runs on its own
  const again = await advance(s, deps);
  assert.equal(again.step, "approval");
  assert.equal(progressOf(again).images.state, "review");
});

test("engine: regenerate redoes that image and the later ones only", async () => {
  const deps = fakeDeps();
  const s = await runUntil(newRun({ topic: "rain gutter", lengthSec: 15 }), deps, (x) => x.step === "approval");
  const r = regenerateWide(s, 2);
  assert.deepEqual(r.wide.map((w) => w.status), ["done", "done", "pending", "pending"]);
  const back = await runUntil(r, deps, (x) => x.step === "approval");
  assert.equal(back.wide[1].url, s.wide[1].url);
  assert.notEqual(back.wide[2].url, s.wide[2].url);
});

test("engine: after approval, keyframes -> clips (same file at every join) -> render -> done", async () => {
  const deps = fakeDeps();
  const s = await runUntil(newRun({ topic: "rain gutter", lengthSec: 15 }), deps, (x) => x.step === "approval");
  const done = await runUntil(approve(s), deps, (x) => x.step === "done" || x.step === "failed");
  assert.equal(done.step, "done", done.error);
  assert.equal(done.finalUrl, "https://store/final.mp4");
  const clips = deps.log.filter((t) => t.taskType === "videoInference");
  assert.equal(clips.length, 5);
  for (let i = 1; i < clips.length; i++) assert.equal(clips[i].inputs.frameImages[0].image, clips[i - 1].inputs.frameImages[1].image);
  // only the keyframe with an edit got an edit call
  const edits = deps.log.filter((t) => t.taskType === "imageInference" && t.inputs?.referenceImages?.[0]?.includes("rw/") && t.positivePrompt.startsWith("Same image, same framing"));
  assert.equal(edits.length, 1);
  const job = renderJob(done);
  assert.equal(job.clips[0].dropFirstFrame, false);
  assert.ok(job.clips.slice(1).every((c) => c.dropFirstFrame));
  assert.ok(job.captions.length > 40);
  assert.ok(Object.values(done.costs).every((v) => v >= 0));
});

test("engine: without a voice the beats are even and the script is kept for recording", async () => {
  const deps = { ...fakeDeps(), synthesize: null };
  const s = await runUntil(newRun({ topic: "rain gutter", lengthSec: 15 }), deps, (x) => x.step === "approval");
  assert.equal(s.voice, null);
  assert.equal(s.timing.placed[4].end, 15);
  assert.ok(s.narration.startsWith("Put a roof"));
});

test("engine: a task that fails twice fails the run (one retry, no loop)", async () => {
  const deps = fakeDeps();
  deps.send = async (batch) => ({ status: 200, body: { errors: [{ taskUUID: batch[0].taskUUID, message: "boom" }] } });
  const s = await runUntil(newRun({ topic: "rain gutter", lengthSec: 15 }), deps, (x) => x.step === "failed", 50);
  assert.equal(s.step, "failed");
  assert.equal(s.failedAt, "wide");
});

// ---------- the stitch ----------

test("final ffmpeg: drops the duplicate first frame after clip 1, speed-fits, 24 fps, voice tempo", () => {
  const args = finalArgs({ clipFiles: ["a.mp4", "b.mp4"], speeds: [1, 1.25], voiceFile: "v.mp3", tempo: 1.3, assFile: "c.ass", fontsDir: "fonts", lengthSec: 6, output: "o.mp4" });
  const fc = args[args.indexOf("-filter_complex") + 1];
  assert.match(fc, /\[0:v\]setpts=\(PTS-STARTPTS\)\/1\.0000,fps=24/);
  assert.match(fc, /\[1:v\]select='gte\(n\\,1\)',setpts=\(PTS-STARTPTS\)\/1\.2500/);
  assert.match(fc, /subtitles=c\.ass:fontsdir=fonts/);
  assert.match(fc, /\[2:a\]atempo=1\.3000,apad/);
  assert.equal(args[args.indexOf("-r") + 1], "24");
  assert.equal(atempoChain(2.5), "atempo=2,atempo=1.2500");
});

test("captions: one capitalised word at a time, centred at 52%", () => {
  assert.equal(captionWord("pours,"), "Pours");
  const ass = buildAss({ words: [{ w: "if", s: 0, e: 0.2 }, { w: "you", s: 0.3, e: 0.5 }] });
  assert.match(ass, /Dialogue: 0,0:00:00\.00,0:00:00\.30,Word,,0,0,0,,\{\\pos\(540,998\)\}If/);
  assert.match(ass, /0:00:00\.75,Word,,0,0,0,,\{\\pos\(540,998\)\}You/);
});
