import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PRICE_ROWS, PRICES, totalCredits, USD_PER_CREDIT, planCostUsd, videoCostUsd, BASIS, LENGTHS } from "../supabase/functions/_shared/cutaway/pricing.js";
import { validatePlan, planProblems, planWarnings, shapeProblems, framesOf, clipPrompt, narrationText, normBox, targetWords, boxJump } from "../supabase/functions/_shared/cutaway/planner.js";
import { placeBeats, clipTimings, voiceTempo, cropPixels, upscaleFactor, evenBeats, cueTimeline } from "../supabase/functions/_shared/cutaway/beats.js";
import { alignmentWords } from "../supabase/functions/_shared/cutaway/voice.js";
import { clipTask, parseReply } from "../supabase/functions/_shared/cutaway/runware.js";
import { cueCacheKey, cueRequest } from "../supabase/functions/_shared/cutaway/sound.js";
import { advance, approve, newRun, regenerateWide, renderJob, progressOf, visionFailures, refundsFor, userMessage } from "../supabase/functions/_shared/cutaway/engine.js";
import { buildAss, captionWord, finalArgs, atempoChain } from "../render-worker/src/cutawayFinalPlan.mjs";
import { freshSuggestions, TOPIC_SUGGESTIONS } from "../src/data/cutawayTopics.js";

// ---------- a 30 s plan like the planner returns (10 beats, 5 states) ----------

const BEATS = [
  ["If you dig a pit and throw your trash in, you have a dump.", "dump", "W0", { x: 0, y: 0, w: 1 }, "", { key: "dirt", text: "", at: "verb", whole: false }],
  ["But it stinks, the rats move in, and the rain washes it away.", "stinks", "W0", { x: 0.3, y: 0.4, w: 0.5 }, "", { key: "rain", text: "", at: "start", whole: true }],
  ["The dirty water soaks down and poisons the well next door.", "soaks", "W0", { x: 0.2, y: 0.5, w: 0.45 }, "", { key: "", text: "", at: "verb", whole: false }],
  ["So you line the pit with clay and a thick plastic sheet.", "line", "W0", { x: 0.1, y: 0.3, w: 0.6 }, "liner", { key: "custom", text: "a heavy plastic sheet unrolling into a pit", at: "verb", whole: false }],
  ["This is a liner, and it keeps the trash juice out of the ground.", "liner", "W1", { x: 0.25, y: 0.35, w: 0.5 }, "", { key: "", text: "", at: "verb", whole: false }],
  ["But the trash still rots and fills the pit with hidden gas.", "gas", "W2", { x: 0.2, y: 0.3, w: 0.6 }, "", { key: "", text: "", at: "verb", whole: false }],
  ["So you bury pipes that pull the gas out and burn it.", "burn", "W2", { x: 0.4, y: 0.5, w: 0.45 }, "gas pipes", { key: "flame", text: "", at: "verb", whole: false }],
  ["That bad smell is not rot, it is gas you can turn into power.", "power", "W3", { x: 0.3, y: 0.4, w: 0.5 }, "", { key: "motor_hum", text: "", at: "verb", whole: true }],
  ["Cover every layer with dirt each night, and plant grass on top.", "grass", "W3", { x: 0, y: 0, w: 1 }, "grass cap", { key: "machine", text: "", at: "start", whole: false }],
  ["Congratulations, you have built a landfill that barely rots at all.", "landfill", "W4", { x: 0.1, y: 0.1, w: 0.8 }, "", { key: "", text: "", at: "verb", whole: false }],
];
const PARTS = [["pit"], ["pit", "liner"], ["pit", "liner", "trash"], ["pit", "liner", "trash", "gas pipes"], ["pit", "liner", "trash", "gas pipes", "grass cap"]];
function samplePlan() {
  return {
    title: "How a landfill works",
    facts: [{ claim: "Sealed landfills have little oxygen, so trash decomposes very slowly", check: "Garbage Project digs found readable decades-old newspapers" }],
    mechanisms: ["landfill liner", "landfill gas collection"],
    surprises: [
      { beat: 1, kind: "gross", text: "it stinks and the rats move in", number: "" },
      { beat: 4, kind: "fact", text: "newspapers stay readable for decades", number: "40 YEARS" },
      { beat: 7, kind: "myth", text: "the smell is gas you can burn for power", number: "" },
    ],
    life: "a garbage truck",
    world: "A green valley with a town at the back and a big soil cross-section in front.",
    cutaway: "The ground is cut through the middle of the pit.",
    states: PARTS.map((parts, i) => ({ id: `W${i}`, label: `state ${i}`, description: `scene ${i}`, change: i ? `add ${parts.at(-1)}` : "", parts, problem: i < 4, checks: [`it shows the ${parts.at(-1)}`] })),
    beats: BEATS.map(([text, verb, state, box, adds, sound], i) => ({
      text, verb, state, box, adds, sound, show: `view ${i}`, edit: i === 2 ? "the soil under the pit is dark and wet" : "", action: `action ${i}`, ongoing: i === 1 ? "rain keeps falling" : "", overlay: "arrows", move: "push-in",
      card: i === 4 ? { text: "40 YEARS", word: "liner" } : { text: "", word: "" },
    })),
    end: { state: "W4", box: { x: 0, y: 0, w: 1 }, show: "the grassy hill with the gas plant", edit: "" },
  };
}

// ---------- pricing ----------

test("lengths are 30 s (default) and 60 s", () => {
  assert.deepEqual([...LENGTHS], [30, 60]);
});

test("prices are at least 2x our cost, in whole credits", () => {
  for (const s of LENGTHS) {
    assert.equal(PRICES.plan.byLength[s], Math.ceil((planCostUsd(s) * BASIS.markup) / USD_PER_CREDIT));
    assert.ok(PRICES.video.byLength[s] * USD_PER_CREDIT >= videoCostUsd(s) * 2, `video ${s}`);
  }
  assert.equal(totalCredits(30), 128);
  assert.equal(totalCredits(60), 229);
});

test("the migration's tool_prices rows match pricing.js", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20261106100000_cutaway_explainer.sql", import.meta.url), "utf8");
  for (const row of PRICE_ROWS) {
    const line = sql.split("\n").find((l) => l.includes(`'${row.tool_key}'`) && l.trim().startsWith("("));
    assert.ok(line, `no row for ${row.tool_key}`);
    if (row.flat_credits != null) assert.match(line, new RegExp(`'${row.tool_key}', NULL, ${row.flat_credits},`));
    else assert.match(line, new RegExp(`'${row.tool_key}', ${row.credits_per_second}, NULL, ARRAY\\[30, 60\\]`));
  }
  assert.match(sql, /length_sec IN \(30, 60\)/);
});

// ---------- topics ----------

test("topic suggestions skip what the user already made", () => {
  assert.equal(TOPIC_SUGGESTIONS.length, 20);
  const fresh = freshSuggestions(["Dam", "skyscraper"], 3);
  assert.deepEqual(fresh.map((t) => t.topic), ["Sewage treatment plant", "Tunnel under a river", "Electricity to your outlet"]);
});

// ---------- plan checks ----------

test("a good plan passes and is normalised", () => {
  const p = validatePlan(samplePlan(), 30);
  assert.equal(p.beats.length, 10);
  assert.equal(p.beats[0].sound.key, "dirt");
  assert.equal(p.beats[2].sound, null);
  assert.equal(p.beats[4].card.text, "40 YEARS");
  for (const b of p.beats) assert.ok(b.box.w >= 0.4 && b.box.x + b.box.w <= 1 && b.box.y + b.box.w <= 1);
  assert.equal(narrationText(p).split(" ").length, BEATS.map((b) => b[0]).join(" ").split(" ").length);
  assert.ok(Math.abs(narrationText(p).split(" ").length - targetWords(30)) < targetWords(30) * 0.2);
});

test("appears on its word: a part already in the beat's state, or missing from the next, is refused", () => {
  const early = samplePlan();
  early.beats[3].state = "W1"; // the liner is already there
  assert.ok(planProblems(early, 30).some((p) => /already shows it/.test(p)));
  const late = samplePlan();
  late.beats[4].state = "W0"; late.beats[4].box = { x: 0.5, y: 0.5, w: 0.5 }; // the next state lacks the liner
  assert.ok(planProblems(late, 30).some((p) => /doesn't list it/.test(p)));
});

test("the program does the bookkeeping: states for appearing parts, verbs, myth-bust in the narration", () => {
  const p = samplePlan();
  p.beats[3].state = "W1";              // the model put the liner beat in the state that already has the liner
  p.beats[4].state = "W0"; p.beats[4].box = { x: 0.5, y: 0.5, w: 0.5 }; // and the next beat in one without it
  p.beats[3].verb = "lines";            // "line" is in the text
  p.beats[0].adds = "pit";              // the pit is in the master: it can't appear
  p.surprises = p.surprises.filter((s) => s.kind !== "myth"); // the myth-bust is still in beat 8's words
  const fixed = validatePlan(p, 30);
  assert.equal(fixed.beats[3].state, "W0");
  assert.equal(fixed.beats[4].state, "W1");
  assert.equal(fixed.beats[3].verb, "line");
  assert.equal(fixed.beats[0].adds, "");
});

test("more appearing parts than image changes: the extra ones lose 'adds' with a warning, the plan still passes", () => {
  const p = samplePlan();
  p.beats[2].adds = "gas pipes";           // first shown in W3, but beat 6 also needs the W2 -> W3 step
  p.beats[5].adds = "trash";               // first shown in W2, already passed by beat 2's step
  const fixed = validatePlan(p, 30);
  assert.equal(fixed.beats[2].adds, "gas pipes");
  assert.equal(fixed.beats[2].state, "W2");
  assert.equal(fixed.beats[3].state, "W3");
  assert.equal(fixed.beats[6].adds, "", "its step is taken: dropped");
  assert.ok(planWarnings(fixed).some((w) => /"gas pipes" can't appear on its own word/.test(w) || /"liner" can't appear/.test(w)));
  // states never go backwards through the story
  const order = fixed.beats.map((b) => Number(b.state.slice(1)));
  for (let i = 1; i < order.length; i++) assert.ok(order[i] >= order[i - 1], `beat ${i + 1} goes back`);
});

test("script rules: long sentences, missing loops, late surprises, no myth-bust, used ideas", () => {
  const long = samplePlan();
  long.beats[1].text = "But it stinks and the rats move in and the rain washes it away and the wind blows it around the whole street";
  long.beats[2].text = "and the dirty water soaks down and poisons the well next door.";
  assert.ok(planProblems(long, 30).some((p) => /has \d+ words \(max 30\)|words \(want 8-14\)/.test(p)));
  const late = samplePlan();
  late.surprises = late.surprises.map((s) => ({ ...s, beat: Math.max(5, s.beat) }));
  assert.ok(planProblems(late, 30).some((p) => /first surprise is in beat/.test(p)));
  const noMyth = samplePlan();
  noMyth.surprises = noMyth.surprises.filter((s) => s.kind !== "myth");
  noMyth.beats[7].text = "Then the smell turns out to be gas you can turn into power.";
  assert.ok(planProblems(noMyth, 30).some((p) => /no myth-bust/.test(p)));
  assert.ok(planProblems(samplePlan(), 30, ["Landfill liner"]).some((p) => /already explained/.test(p)));
  const unnamed = samplePlan();
  unnamed.beats[9].text = "Congratulations, you have built a dump that barely rots at all.";
  unnamed.beats[9].verb = "dump";
  unnamed.beats[8].adds = "grass cap"; unnamed.beats[8].text = "Cover every layer with dirt each night, and plant seeds on top.";
  unnamed.beats[8].verb = "seeds";
  assert.ok(planWarnings(unnamed).some((p) => /appears but is never named/.test(p)), "a warning for the critic, not a failure");
  const sameFrame = samplePlan();
  sameFrame.beats[2].box = { ...sameFrame.beats[1].box };
  assert.ok(planProblems(sameFrame, 30).some((p) => /nearly the same framing/.test(p)));
  const stillBad = samplePlan();
  stillBad.states[4].problem = true;
  assert.ok(planProblems(stillBad, 30).some((p) => /still shows the problem/.test(p)));
});

test("normBox keeps a 9:16 crop inside the image and never under 40% wide", () => {
  assert.deepEqual(normBox({ x: 0.9, y: 0.9, w: 0.1 }), { x: 0.6, y: 0.6, w: 0.4 });
});

// ---------- no big jumps inside one clip ----------

test("a far jump goes through a wider frame: two clips, 60/40", () => {
  assert.equal(boxJump({ x: 0, y: 0, w: 0.4 }, { x: 0.6, y: 0.6, w: 0.4 }).far, true);
  assert.equal(boxJump({ x: 0.2, y: 0.2, w: 0.5 }, { x: 0.3, y: 0.3, w: 0.5 }).far, false);
  const plan = validatePlan(samplePlan(), 30);
  const near = framesOf(plan);
  assert.equal(near.segments.length, 10);
  plan.beats[1].box = { x: 0, y: 0, w: 0.4 };
  plan.beats[2].box = { x: 0.6, y: 0.6, w: 0.4 };
  const { frames, segments } = framesOf(plan);
  assert.ok(segments.length > 10);
  const split = segments.filter((s) => s.beat === 1);
  assert.deepEqual(split.map((s) => [s.from, s.to, s.frac]), [["k1", "v1", 0.6], ["v1", "k2", 0.4]]);
  const via = frames.find((f) => f.id === "v1");
  assert.ok(via.box.w >= 0.95);
  const placed = evenBeats(plan.beats, 30);
  const t = clipTimings(placed, segments).filter((c) => c.beat === 1);
  assert.ok(Math.abs(t[0].durationSec - 1.8) < 0.01 && Math.abs(t[1].durationSec - 1.2) < 0.01);
  assert.equal(t[1].verbAtSec, null);
  const promptB = clipPrompt(plan, split[1], { clipSec: t[1].clipSec, verbAtSec: null, toShow: "view 2" });
  assert.match(promptB, /pushes in over the whole clip to: view 2/);
  const promptA = clipPrompt(plan, split[0], { clipSec: 2, verbAtSec: 0.6, toShow: via.show });
  assert.match(promptA, /in the last 1 seconds it pulls back smoothly/);
  assert.match(promptA, /The whole time, from the first frame to the last: rain keeps falling/);
  assert.match(promptA, /a garbage truck moves naturally/);
});

// ---------- timing ----------

function fakeSpoken(texts, wps = 3) {
  const out = [];
  let t = 0.1;
  for (const w of texts.join(" ").split(" ")) { out.push({ w, s: t, e: t + 0.25 }); t += 1 / wps; }
  return out;
}

test("the voice is sped up to ~238 wpm, never above 1.45x, never slowed", () => {
  const t = voiceTempo(fakeSpoken(BEATS.map((b) => b[0]), 3));
  assert.ok(t > 1.3 && t < 1.34, String(t));
  assert.equal(voiceTempo(fakeSpoken(BEATS.map((b) => b[0]), 1.5)), 1.45);
  assert.equal(voiceTempo(fakeSpoken(BEATS.map((b) => b[0]), 6)), 1);
});

test("beats start on their first word; clips fit their share exactly", () => {
  const plan = validatePlan(samplePlan(), 30);
  const placed = placeBeats(plan.beats, fakeSpoken(BEATS.map((b) => b[0]), 3), 1.3);
  assert.equal(placed[0].start, 0);
  for (let i = 1; i < placed.length; i++) assert.equal(placed[i].start, placed[i - 1].end);
  for (const c of clipTimings(placed)) assert.ok(Math.abs(c.clipSec / c.speed - c.durationSec) < 0.01);
});

test("sound timeline: a chime on each name, card and Congratulations; cues on their action", () => {
  const plan = validatePlan(samplePlan(), 30);
  const spoken = fakeSpoken(BEATS.map((b) => b[0]), 4);
  const placed = placeBeats(plan.beats, spoken, 1);
  const t = cueTimeline(plan, placed, spoken);
  const at = (word, from = 0) => spoken.slice(from).find((w) => w.w.replace(/[^\w]/g, "").toLowerCase() === word).s;
  assert.ok(t.chimes.some((c) => Math.abs(c - at("this")) < 0.01), "This is a liner");
  assert.ok(t.chimes.some((c) => Math.abs(c - at("congratulations")) < 0.01));
  assert.equal(t.cards.length, 1);
  assert.equal(t.cards[0].text, "40 YEARS");
  assert.ok(Math.abs(t.cards[0].s - at("liner", 40)) < 0.01);
  // "That bad smell is not" is not a name: no chime there
  assert.ok(!t.chimes.some((c) => Math.abs(c - at("that", 60)) < 0.01));
  assert.equal(t.sfx.length, 6);
  const rain = t.sfx.find((c) => c.key === "rain");
  assert.ok(Math.abs(rain.start - (placed[1].start + 0.05)) < 0.01 && Math.abs(rain.duration - (placed[1].end - rain.start)) < 0.01);
  const flame = t.sfx.find((c) => c.key === "flame");
  assert.ok(Math.abs(flame.start - at("burn")) < 0.01 && flame.duration === null);
});

test("sound cache keys: library by key, custom by text and length", async () => {
  assert.equal(await cueCacheKey({ key: "rain", text: "", seconds: 3 }), "lib-rain");
  const a = await cueCacheKey({ key: "custom", text: "Plastic sheet unrolling", seconds: 2 });
  const b = await cueCacheKey({ key: "custom", text: "plastic sheet unrolling ", seconds: 2 });
  assert.equal(a, b);
  assert.match(a, /^cue-[0-9a-f]{20}$/);
  assert.equal(cueRequest({ key: "crack" }).seconds, 1.5);
});

test("ElevenLabs character alignment becomes words", () => {
  const a = { characters: [..."Hi you"], character_start_times_seconds: [0, 0.1, 0.2, 0.3, 0.4, 0.5], character_end_times_seconds: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6] };
  assert.deepEqual(alignmentWords(a), [{ w: "Hi", s: 0, e: 0.2 }, { w: "you", s: 0.3, e: 0.6 }]);
});

test("crops are 9:16 whole pixels inside the image; small crops upscale 4x", () => {
  const c = cropPixels({ x: 0.5, y: 0.5, w: 0.45 }, 768, 1376);
  assert.ok(c.x + c.w <= 768 && c.y + c.h <= 1376);
  assert.equal(upscaleFactor(c.h), 4);
});

// ---------- Runware ----------

test("clip task: first + last frame, 720p, audio off, no width/height", () => {
  const t = clipTask({ prompt: "x", firstUrl: "a", lastUrl: "b", durationSec: 3 });
  assert.equal(t.model, "prunaai:p-video@2");
  assert.deepEqual(t.inputs.frameImages, [{ image: "a", frame: "first" }, { image: "b", frame: "last" }]);
  assert.equal(t.settings.audio, false);
  assert.equal(t.width, undefined);
});

test("Runware replies: success, pending, error", () => {
  assert.deepEqual(parseReply({ data: [{ taskUUID: "t", imageURL: "u", cost: 0.03 }] }, "t"), { state: "success", url: "u", cost: 0.03 });
  assert.equal(parseReply({ data: [] }, "t").state, "pending");
});

// ---------- the engine, end to end on fakes ----------

function fakeDeps({ visionFails = {} } = {}) {
  const tasks = new Map();
  const log = [];
  const vision = [];
  return {
    log, vision,
    planVideo: async ({ usedIdeas }) => ({ plan: validatePlan(samplePlan(), 30, usedIdeas), costUsd: 0.12, critic: { before: ["x"], after: [] } }),
    synthesize: async ({ text }) => ({ audioBase64: "AAAA", spoken: fakeSpoken([text], 3), costUsd: 0.02 }),
    saveAudio: async () => "https://store/voice.mp3",
    checkImage: async ({ imageUrl, checks }) => {
      vision.push(imageUrl);
      const n = vision.filter((u) => u.includes(checks[0])).length;
      const failsLeft = visionFails[checks[0]] ?? 0;
      return { pass: n > failsLeft, fix: n > failsLeft ? "" : "the liner is missing", checks: [], costUsd: 0.01 };
    },
    send: async (batch) => {
      const t = batch[0];
      if (t.taskType === "getResponse") {
        const known = tasks.get(t.taskUUID);
        return { status: 200, body: { data: [{ taskUUID: t.taskUUID, status: "success", ...(known.taskType === "videoInference" ? { videoURL: `https://rw/${t.taskUUID}.mp4` } : { imageURL: `https://rw/${t.taskUUID}-${((known.positivePrompt ?? "").match(/it shows the [a-z ]+/) ?? [""])[0]}.jpg` }), cost: 0.01 }] } };
      }
      tasks.set(t.taskUUID, t);
      log.push(t);
      return { status: 200, body: { data: [{ taskUUID: t.taskUUID, status: "processing" }] } };
    },
    crop: async ({ imageUrl }) => ({ image: `${imageUrl}#crop`, h: 610 }),
    keep: async (url) => url,
    sfx: async ({ cacheKey }) => ({ url: `https://store/${cacheKey}.mp3`, costUsd: 0.02, cached: false }),
    startRender: async (job) => ({ job }),
    checkRender: async () => ({ state: "done", url: "https://store/final.mp4", costUsd: 0.004 }),
  };
}

async function runUntil(state, deps, stop, max = 400) {
  let s = state;
  for (let i = 0; i < max && !stop(s); i++) s = await advance(s, deps);
  return s;
}

test("engine: plan -> voice -> wide images (each vision-checked) -> STOPS for approval", async () => {
  const deps = fakeDeps();
  const s = await runUntil(newRun({ topic: "landfill", lengthSec: 30 }), deps, (x) => x.step === "approval" || x.step === "failed");
  assert.equal(s.step, "approval", s.error);
  assert.equal(s.wide.length, 5);
  assert.equal(deps.vision.length, 5);
  assert.ok(s.wide.every((w) => w.vision.pass));
  assert.equal(visionFailures(s).length, 0);
  const again = await advance(s, deps);
  assert.equal(again.step, "approval");
});

test("engine: a vision failure regenerates once with the fix; a second failure is flagged, not looped", async () => {
  const once = fakeDeps({ visionFails: { "it shows the liner": 1 } });
  const s1 = await runUntil(newRun({ topic: "landfill", lengthSec: 30 }), once, (x) => x.step === "approval");
  const w1 = s1.wide[1];
  assert.equal(w1.attempts, 2);
  assert.ok(w1.vision.pass);
  const fixPrompt = once.log.filter((t) => t.taskType === "imageInference").map((t) => t.positivePrompt).find((p) => /The last attempt got this wrong, fix it: the liner is missing/.test(p));
  assert.ok(fixPrompt);
  const twice = fakeDeps({ visionFails: { "it shows the liner": 5 } });
  const s2 = await runUntil(newRun({ topic: "landfill", lengthSec: 30 }), twice, (x) => x.step === "approval");
  assert.equal(s2.wide[1].attempts, 2);
  assert.equal(visionFailures(s2).length, 1);
  assert.equal(progressOf(s2).images.flagged, 1);
});

test("engine: used ideas reach the planner; regenerate redoes that image and the later ones", async () => {
  const deps = fakeDeps();
  let seen;
  deps.planVideo = async ({ usedIdeas }) => { seen = usedIdeas; return { plan: validatePlan(samplePlan(), 30), costUsd: 0.1 }; };
  const s = await runUntil(newRun({ topic: "landfill", lengthSec: 30, usedIdeas: ["S-bend trap"] }), deps, (x) => x.step === "approval");
  assert.deepEqual(seen, ["S-bend trap"]);
  const r = regenerateWide(s, 3);
  assert.deepEqual(r.wide.map((w) => w.status), ["done", "done", "done", "pending", "pending"]);
});

test("engine: after approval, keyframes -> clips (same file at every join) -> sound -> render -> done", async () => {
  const deps = fakeDeps();
  const s = await runUntil(newRun({ topic: "landfill", lengthSec: 30 }), deps, (x) => x.step === "approval");
  const done = await runUntil(approve(s), deps, (x) => x.step === "done" || x.step === "failed");
  assert.equal(done.step, "done", done.error);
  const clips = deps.log.filter((t) => t.taskType === "videoInference");
  assert.equal(clips.length, done.timing.segments.length);
  for (let i = 1; i < clips.length; i++) assert.equal(clips[i].inputs.frameImages[0].image, clips[i - 1].inputs.frameImages[1].image);
  assert.equal(done.sounds.length, 6);
  const job = renderJob(done);
  assert.equal(job.sfx.length, 6);
  assert.ok(job.chimes.length >= 3);
  assert.equal(job.cards[0].text, "40 YEARS");
  assert.ok(job.clips.slice(1).every((c) => c.dropFirstFrame));
  assert.ok(done.costs.sound > 0 && done.costs.vision > 0);
});

test("engine: sound effects off -> no cues, no chimes, voice only", async () => {
  const deps = fakeDeps();
  const s = await runUntil(newRun({ topic: "landfill", lengthSec: 30, soundEffects: false }), deps, (x) => x.step === "approval");
  const done = await runUntil(approve(s), deps, (x) => x.step === "done");
  const job = renderJob(done);
  assert.equal(job.sfx.length, 0);
  assert.equal(job.chimes.length, 0);
  assert.equal(job.cards.length, 1, "number cards stay: they are picture, not sound");
});

test("engine: a sound cue that fails twice is dropped, the video still finishes", async () => {
  const deps = fakeDeps();
  deps.sfx = async () => { throw new Error("SFX_FAILED: 500"); };
  const s = await runUntil(newRun({ topic: "landfill", lengthSec: 30 }), deps, (x) => x.step === "approval");
  const done = await runUntil(approve(s), deps, (x) => x.step === "done" || x.step === "failed");
  assert.equal(done.step, "done");
  assert.ok(done.sounds.every((c) => c.status === "dropped"));
  assert.equal(renderJob(done).sfx.length, 0);
});

test("engine: a task that fails twice fails the run (one retry, no loop)", async () => {
  const deps = fakeDeps();
  deps.send = async (batch) => ({ status: 200, body: { errors: [{ taskUUID: batch[0].taskUUID, message: "boom" }] } });
  const s = await runUntil(newRun({ topic: "landfill", lengthSec: 30 }), deps, (x) => x.step === "failed", 50);
  assert.equal(s.failedAt, "wide");
});

// ---------- users never pay for our failures ----------

test("refunds: a failed plan or image step refunds Generate + regenerates; a later failure refunds everything", () => {
  const charges = [{ stage: "plan", credits: 38 }, { stage: "regenerate", credits: 8 }, { stage: "video", credits: 90 }];
  assert.deepEqual(refundsFor({ step: "failed", failedAt: "plan" }, charges.slice(0, 1)), [0]);
  assert.deepEqual(refundsFor({ step: "failed", failedAt: "wide" }, charges.slice(0, 2)), [0, 1]);
  assert.deepEqual(refundsFor({ step: "failed", failedAt: "clips" }, charges), [0, 1, 2]);
  assert.deepEqual(refundsFor({ step: "failed", failedAt: "render" }, charges.map((c, i) => ({ ...c, refunded: i === 0 }))), [1, 2]);
  assert.deepEqual(refundsFor({ step: "done" }, charges), []);
  assert.match(userMessage({ step: "failed", failedAt: "plan" }), /couldn't plan .* credits were returned\. Try another topic/);
  assert.match(userMessage({ step: "failed", failedAt: "clips" }), /on our side .* credits were returned/);
  assert.equal(userMessage({ step: "done" }), null);
});

test("engine: a failed plan fails the run at once (no second plan attempt: planVideo retries inside)", async () => {
  const deps = fakeDeps();
  let calls = 0;
  deps.planVideo = async () => { calls += 1; throw Object.assign(new Error("PLAN_INVALID after the critic: x"), { costUsd: 0.2 }); };
  const s = await runUntil(newRun({ topic: "landfill", lengthSec: 30 }), deps, (x) => x.step === "failed", 10);
  assert.equal(calls, 1);
  assert.equal(s.failedAt, "plan");
  assert.equal(s.costs.plan, 0.2);
});

test("shape checks catch a malformed reply (the 95-beat plan)", () => {
  assert.deepEqual(shapeProblems(samplePlan(), 30), []);
  const broken = samplePlan();
  broken.beats = Array.from({ length: 95 }, () => broken.beats[0]);
  broken.states = Array.from({ length: 24 }, () => broken.states[0]);
  delete broken.facts;
  const p = shapeProblems(broken, 30);
  assert.ok(p.includes("beats: 95 (must be exactly 10)") && p.includes("states: 24 (must be exactly 5)") && p.includes("facts missing"));
  const noBox = samplePlan();
  noBox.beats[3].box = { x: 0.1 };
  assert.deepEqual(shapeProblems(noBox, 30), ["beat 4 malformed"]);
});

// ---------- the stitch ----------

test("final ffmpeg: duplicate frame dropped, speed-fit, 24 fps, voice tempo, chime and sfx mixed", () => {
  const args = finalArgs({
    clipFiles: ["a.mp4", "b.mp4"], speeds: [1, 1.25], voiceFile: "v.mp3", tempo: 1.3, assFile: "c.ass", fontsDir: "fonts",
    chimeFile: "chime.wav", chimes: [1.5, 4.25], sfx: [{ file: "rain.mp3", start: 0.05, duration: 3 }, { file: "crack.mp3", start: 2.3, duration: null }],
    levels: { sfxDb: -12, chimeDb: -14 }, lengthSec: 6, output: "o.mp4",
  });
  const fc = args[args.indexOf("-filter_complex") + 1];
  assert.match(fc, /\[1:v\]select='gte\(n\\,1\)',setpts=\(PTS-STARTPTS\)\/1\.2500/);
  assert.match(fc, /\[2:a\]atempo=1\.3000/);
  assert.match(fc, /\[3:a\].*volume=0\.1995,asplit=2\[ch0\]\[ch1\]/);
  assert.match(fc, /\[ch1\]adelay=4250:all=1/);
  assert.match(fc, /\[4:a\]atrim=0:3\.000,afade=t=out:st=2\.700:d=0\.3,.*volume=0\.2512,adelay=50:all=1\[fx0\]/);
  assert.match(fc, /\[5:a\]aresample.*adelay=2300:all=1\[fx1\]/);
  assert.match(fc, /\[voice\]\[chd0\]\[chd1\]\[fx0\]\[fx1\]amix=inputs=5:duration=longest:normalize=0/);
  assert.equal(args[args.indexOf("rain.mp3") - 3], "-stream_loop");
  assert.equal(atempoChain(2.5), "atempo=2,atempo=1.2500");
});

test("captions: one word at 52%; number cards at 30% with a pop", () => {
  assert.equal(captionWord("pours,"), "Pours");
  const ass = buildAss({ words: [{ w: "if", s: 0, e: 0.2 }], cards: [{ text: "= 6 CARS", s: 1.2, e: 3 }] });
  assert.match(ass, /Dialogue: 0,0:00:00\.00,0:00:00\.45,Word,,0,0,0,,\{\\pos\(540,998\)\}If/);
  assert.match(ass, /Dialogue: 1,0:00:01\.20,0:00:03\.00,Card,,0,0,0,,\{\\pos\(540,576\)\\fad\(80,220\).*\}= 6 CARS/);
  const white = buildAss({ words: [], cards: [{ text: "33 FT", s: 0, e: 1 }] });
  assert.match(white, /,CardWhite,,0,0,0,,.*\}33 FT/);
  assert.match(white, /Style: CardWhite,Lilita One,130,&H00FFFFFF/);
});
