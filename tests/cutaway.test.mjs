import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { PRICE_ROWS, PRICES, totalCredits, USD_PER_CREDIT, planCostUsd, videoCostUsd, BASIS, LENGTHS } from "../supabase/functions/_shared/cutaway/pricing.js";
import { validatePlan, planProblems, planWarnings, shapeProblems, framesOf, clipPrompt, narrationText, normBox, targetWords, boxJump } from "../supabase/functions/_shared/cutaway/planner.js";
import { placeBeats, clipTimings, voiceTempo, wordsToFit, cropPixels, upscaleFactor, evenBeats, cueTimeline } from "../supabase/functions/_shared/cutaway/beats.js";
import { alignmentWords } from "../supabase/functions/_shared/cutaway/voice.js";
import { clipTask, parseReply } from "../supabase/functions/_shared/cutaway/runware.js";
import { cueCacheKey, cueRequest } from "../supabase/functions/_shared/cutaway/sound.js";
import { checkImage } from "../supabase/functions/_shared/cutaway/llm.js";
import { advance, approve, newRun, regenerateWide, renderJob, progressOf, visionFailures, visionUnchecked, refundsFor, userMessage } from "../supabase/functions/_shared/cutaway/engine.js";
import { buildAss, captionWord, finalArgs, atempoChain, gainFor } from "../render-worker/src/cutawayFinalPlan.mjs";
import { freshSuggestions, isKitTopic, KIT_TOPICS } from "../src/data/cutawayTopics.js";
import { canRemoveEndCard, endCardFor, END_CARD } from "../supabase/functions/_shared/cutaway/endCard.js";

// ---------- a 30 s plan like the planner returns (10 beats, 5 states) ----------

const BEATS = [
  ["If you dig a pit for trash, you have a dump.", "dump", "W0", { x: 0, y: 0, w: 1 }, "", { key: "dirt", text: "", at: "verb", whole: false }],
  ["But it stinks, and the rain washes it away.", "stinks", "W0", { x: 0.3, y: 0.4, w: 0.5 }, "", { key: "rain", text: "", at: "start", whole: true }],
  ["The dirty water soaks down into your well.", "soaks", "W0", { x: 0.2, y: 0.5, w: 0.45 }, "", { key: "", text: "", at: "verb", whole: false }],
  ["So you line the pit with thick plastic.", "line", "W0", { x: 0.1, y: 0.3, w: 0.6 }, "liner", { key: "custom", text: "a heavy plastic sheet unrolling into a pit", at: "verb", whole: false }],
  ["This is a liner, and it holds the juice.", "liner", "W1", { x: 0.25, y: 0.35, w: 0.5 }, "", { key: "", text: "", at: "verb", whole: false }],
  ["But the trash still rots into hidden gas.", "gas", "W2", { x: 0.2, y: 0.3, w: 0.6 }, "", { key: "", text: "", at: "verb", whole: false }],
  ["So you bury pipes and burn it.", "burn", "W2", { x: 0.4, y: 0.5, w: 0.45 }, "gas pipes", { key: "flame", text: "", at: "verb", whole: false }],
  ["That smell is not rot, it is power.", "power", "W3", { x: 0.3, y: 0.4, w: 0.5 }, "", { key: "motor_hum", text: "", at: "verb", whole: true }],
  ["Cover each layer with dirt and grass.", "grass", "W3", { x: 0, y: 0, w: 1 }, "grass cap", { key: "machine", text: "", at: "start", whole: false }],
  ["Congratulations, you have built a landfill.", "landfill", "W4", { x: 0.1, y: 0.1, w: 0.8 }, "", { key: "", text: "", at: "verb", whole: false }],
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

test("topic suggestions are kit topics only, skip what the user already made, ready ones first", () => {
  assert.equal(KIT_TOPICS[0].topic, "Landfill");
  assert.ok(KIT_TOPICS[0].ready);
  const fresh = freshSuggestions(["landfill", "Septic tank"], 3);
  assert.deepEqual(fresh.map((t) => t.topic), ["Swimming pool", "Water well", "French drain"]);
  assert.ok(isKitTopic("swimming pool"));
  assert.ok(!isKitTopic("Nuclear power plant"));
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

test("the voice is never sped up; a voiceover that runs long asks the planner to cut words", () => {
  assert.equal(voiceTempo(fakeSpoken(BEATS.map((b) => b[0]), 1.5)), 1);
  const fits = fakeSpoken(BEATS.map((b) => b[0]), 3); // 77 words at 3/s: ~25.7 s
  assert.equal(wordsToFit(fits, 30), null);
  const long = fakeSpoken(BEATS.map((b) => b[0]), 2); // ~38.5 s for a 30 s video
  const keep = wordsToFit(long, 30);
  assert.ok(keep < 77 && keep > 50, String(keep));
  assert.equal(targetWords(30, 170), 82);
});

test("engine: a voiceover that runs long is trimmed once, re-voiced, never sped up", async () => {
  const deps = fakeDeps();
  let voiced = 0;
  deps.synthesize = async ({ text }) => { voiced += 1; return { audioBase64: "AAAA", spoken: fakeSpoken([text], voiced === 1 ? 2 : 3), costUsd: 0.02 }; };
  let asked = null;
  deps.trimScript = async ({ plan, maxWords }) => { asked = maxWords; return { plan, costUsd: 0.01 }; };
  const s = await runUntil(newRun({ topic: "landfill", lengthSec: 30 }), deps, (x) => x.step === "approval");
  assert.ok(asked > 0 && asked < 77);
  assert.equal(voiced, 2);
  assert.equal(s.voice.tempo, 1);
  assert.ok(s.trimmed);
  assert.equal(renderJob({ ...s, clips: [], timing: s.timing }).voice.tempo, 1);
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
  assert.ok(Math.abs(t.cards[0].s - at("liner", 30)) < 0.01);
  // "That smell is not" is not a name: no chime there
  assert.ok(!t.chimes.some((c) => Math.abs(c - at("that", 50)) < 0.01));
  // sparse: never two effects within 6 s; short ones are 1.4 s; rain is the soft long one
  for (let i = 1; i < t.sfx.length; i++) assert.ok(t.sfx[i].start - t.sfx[i - 1].start >= 6, "6 s apart");
  assert.ok(t.sfx.length >= 2 && t.sfx.length < 6);
  for (const c of t.sfx) assert.ok(c.key === "rain" ? c.soft : c.duration === 1.4 && !c.soft, c.key);
});

test("sound: rain on its own is long and soft; the first effect wins a 6 s window", () => {
  const plan = validatePlan(samplePlan(), 30);
  plan.beats[0].sound = null;
  const spoken = fakeSpoken(BEATS.map((b) => b[0]), 3);
  const placed = placeBeats(plan.beats, spoken, 1);
  const t = cueTimeline(plan, placed, spoken);
  const rain = t.sfx.find((c) => c.key === "rain");
  assert.ok(rain && rain.soft && rain.duration >= 1.5);
  assert.ok(!t.sfx.some((c) => c.key !== "rain" && c.start - rain.start < 6));
});

test("sound cache keys: library by key, custom by text and length", async () => {
  assert.equal(await cueCacheKey({ key: "rain", text: "", seconds: 3 }), "lib-rain");
  const a = await cueCacheKey({ key: "custom", text: "Plastic sheet unrolling", seconds: 2 });
  const b = await cueCacheKey({ key: "custom", text: "plastic sheet unrolling ", seconds: 2 });
  assert.equal(a, b);
  assert.match(a, /^cue-[0-9a-f]{20}$/);
  assert.equal(cueRequest({ key: "crack" }).seconds, 1.0);
  assert.equal(cueRequest({ key: "custom", text: "a long rumble", seconds: 5 }).seconds, 1.4, "custom cues are short too");
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
  assert.ok(done.sounds.length >= 2 && done.sounds.length < 6, "sparse");
  const job = renderJob(done);
  assert.equal(job.sfx.length, done.sounds.length);
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

// ---------- end card ("watermark") ----------

test("end card: only Pro and above may remove it; affiliates, starter, free and unknown plans keep it", () => {
  for (const code of ["free", "starter", "affiliate", "", null, "guest", "STARTER"]) assert.equal(canRemoveEndCard(code), false, String(code));
  for (const code of ["pro", "generative", "Pro", " generative "]) assert.equal(canRemoveEndCard(code), true, code);
  assert.equal(endCardFor("starter", true), true, "asking is not enough below Pro");
  assert.equal(endCardFor("pro", true), false);
  assert.equal(endCardFor("pro", false), true, "Pro keeps it unless asked");
  assert.equal(endCardFor(null, true), true, "no plan read -> it stays on");
  assert.match(END_CARD.line1, /Zyvo/);
  assert.equal(END_CARD.line2, "tryzyvo.com");
});

test("end card: decided from the plan read at render time, not from the request alone", async () => {
  const run = async (planCode, removeWatermark) => {
    const deps = fakeDeps();
    let jobSeen = null;
    deps.startRender = async (job) => { jobSeen = job; return { job }; };
    if (planCode !== undefined) deps.planCode = async () => planCode;
    const s = await runUntil(newRun({ topic: "landfill", lengthSec: 30, removeWatermark }), deps, (x) => x.step === "approval");
    const done = await runUntil(approve(s), deps, (x) => x.step === "done");
    return { job: jobSeen, done };
  };
  assert.equal((await run("starter", true)).job.endCard, true, "a starter account asking to remove it still gets it");
  const pro = await run("pro", true);
  assert.equal(pro.job.endCard, false);
  assert.equal(pro.done.endCard, false, "the decision is kept on the run");
  assert.equal((await run("pro", false)).job.endCard, true);
  assert.equal((await run(undefined, true)).job.endCard, true, "no plan reader -> on");
  assert.equal(renderJob({ ...pro.done, removeWatermark: true }).endCard, true, "renderJob without a plan keeps it on");
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

// ---------- the vision check ----------

function mockAnthropic(replies) {
  const real = globalThis.fetch;
  let n = 0;
  const seen = [];
  globalThis.fetch = async (_url, init) => {
    seen.push(JSON.parse(init.body));
    const input = replies[Math.min(n++, replies.length - 1)];
    return { ok: true, status: 200, json: async () => ({ usage: { input_tokens: 1000, output_tokens: 100 }, stop_reason: "tool_use", content: [{ type: "tool_use", input }] }) };
  };
  return { seen, calls: () => n, restore: () => { globalThis.fetch = real; } };
}

test("vision: an empty reply is re-run (max 2), never a fail; the plan and house style are in the prompt", async () => {
  const empty = { checks: [], pass: false, fix: "" };
  const good = { checks: [{ check: "a", ok: true, seen: "yes" }], pass: true, fix: "" };
  let m = mockAnthropic([empty, good]);
  let r = await checkImage({ apiKey: "k", imageUrl: "u", description: "d", checks: ["a"], plan: "Narration: gas flare burns" });
  m.restore();
  assert.equal(r.pass, true);
  assert.equal(r.emptyReplies, 1);
  assert.equal(m.calls(), 2);
  assert.match(JSON.stringify(m.seen[0]), /gas flare burns/);
  assert.match(m.seen[0].system[0].text, /cyan/);
  m = mockAnthropic([empty]);
  r = await checkImage({ apiKey: "k", imageUrl: "u", description: "d", checks: ["a"] });
  m.restore();
  assert.equal(r.pass, null, "still empty after 2 re-runs: unchecked, not failed");
  assert.equal(m.calls(), 3);
  // a reply that says pass but has a failed line is a fail
  m = mockAnthropic([{ checks: [{ check: "a", ok: false, seen: "no" }], pass: true, fix: "\"add a\"" }]);
  r = await checkImage({ apiKey: "k", imageUrl: "u", description: "d", checks: ["a"] });
  m.restore();
  assert.equal(r.pass, false);
  assert.equal(r.fix, "add a");
});

test("engine: an unchecked image is not a failure; every verdict is logged", async () => {
  const deps = fakeDeps();
  deps.checkImage = async ({ checks, plan }) => ({ pass: checks[0].includes("liner") ? null : true, fix: "", checks: [], costUsd: 0.01, emptyReplies: checks[0].includes("liner") ? 3 : 0, plan });
  const s = await runUntil(newRun({ topic: "landfill", lengthSec: 30 }), deps, (x) => x.step === "approval");
  assert.equal(visionFailures(s).length, 0);
  assert.equal(visionUnchecked(s).length, 1);
  assert.equal(s.visionLog.length, 5);
  assert.deepEqual(s.visionLog.map((v) => v.verdict), ["pass", "unchecked", "pass", "pass", "pass"]);
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

test("final ffmpeg: duplicate frame dropped, speed-fit, 24 fps, no voice stretch, gains from the voice's loudness", () => {
  const args = finalArgs({
    clipFiles: ["a.mp4", "b.mp4"], speeds: [1, 1.25], voiceFile: "v.mp3", assFile: "c.ass", fontsDir: "fonts",
    chimeFile: "chime.wav", chimes: [1.5, 4.25], chimeGainDb: -7.5,
    sfx: [{ file: "rain.mp3", start: 0.05, duration: 3, soft: true, gainDb: -18 }, { file: "crack.mp3", start: 2.3, duration: 4, gainDb: -22.5 }],
    lengthSec: 6, output: "o.mp4",
  });
  const fc = args[args.indexOf("-filter_complex") + 1];
  assert.match(fc, /\[1:v\]select='gte\(n\\,1\)',setpts=\(PTS-STARTPTS\)\/1\.2500/);
  assert.doesNotMatch(fc, /atempo/);
  assert.match(fc, /\[2:a\]aresample=44100/);
  assert.match(fc, /\[3:a\].*volume=-7\.5dB,asplit=2\[ch0\]\[ch1\]/);
  assert.match(fc, /\[4:a\]atrim=0:3\.000,afade=t=in:d=0\.80,afade=t=out:st=2\.000:d=1\.00,.*volume=-18dB,adelay=50:all=1\[fx0\]/);
  assert.match(fc, /\[5:a\]atrim=0:1\.400,afade=t=out:st=1\.150:d=0\.25,.*volume=-22\.5dB,adelay=2300:all=1\[fx1\]/, "short effects cut to 1.4 s");
  assert.equal(args[args.indexOf("rain.mp3") - 3], "-stream_loop", "only rain loops");
  assert.notEqual(args[args.indexOf("crack.mp3") - 3], "-stream_loop");
  assert.equal(atempoChain(2.5), "atempo=2,atempo=1.2500");
});

test("level fix: effects sit N dB under the voice's MEASURED loudness, whatever the file's own level", () => {
  assert.equal(gainFor({ voiceLufs: -18, soundLufs: -10, levelDb: -20 }), -28, "a loud file is turned down more");
  assert.equal(gainFor({ voiceLufs: -18, soundLufs: -40, levelDb: -20 }), 2, "a quiet file is turned up");
  assert.equal(gainFor({ voiceLufs: NaN, soundLufs: -10, levelDb: -20 }), -20);
  const mp3 = finalArgs({ voiceFile: "v.mp3", chimeFile: "c.wav", chimes: [1], sfx: [], lengthSec: 5, output: "m.mp3", audioOnly: true });
  assert.ok(!mp3.includes("[vout]") && mp3.includes("libmp3lame"));
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

// ---------- one switch for the whole template (no per-user flag) ----------

test("cutaway switch: on in local dev and Vercel previews, off in production unless VITE_CUTAWAY_ENABLED says so", async () => {
  const { cutawayEnabled } = await import("../src/data/cutawayExplainer.js");
  assert.equal(cutawayEnabled({ DEV: true }), true, "local dev");
  assert.equal(cutawayEnabled({ DEV: false, VITE_VERCEL_ENV: "preview" }), true, "Vercel preview");
  assert.equal(cutawayEnabled({ DEV: false, VITE_VERCEL_ENV: "production" }), false, "production build");
  assert.equal(cutawayEnabled({}), false, "a build outside Vercel");
  assert.equal(cutawayEnabled({ DEV: false, VITE_VERCEL_ENV: "production", VITE_CUTAWAY_ENABLED: "true" }), true, "explicit on");
  assert.equal(cutawayEnabled({ DEV: true, VITE_CUTAWAY_ENABLED: "false" }), false, "explicit off wins in dev");
  assert.equal(cutawayEnabled({ VITE_VERCEL_ENV: "preview", VITE_CUTAWAY_ENABLED: " FALSE " }), false, "explicit off wins on a preview");
});

test("cutaway switch: the page, the Short Form menu and the server all use it, and none reads a per-user flag", () => {
  const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  const page = read("src/pages/workspace/CutawayExplainer.jsx"), menu = read("src/components/workspace/CreateMenu.jsx"), server = read("supabase/functions/cutaway-api/index.ts");
  assert.match(page, /if \(!CUTAWAY_ENABLED\) return <Navigate/);
  assert.match(menu, /enabled: CUTAWAY_ENABLED,/);
  assert.match(server, /Deno\.env\.get\("CUTAWAY_ENABLED"\)/);
  assert.match(server, /if \(!CUTAWAY_ENABLED\) throw new ApiError/);
  for (const [name, src] of [["page", page], ["menu", menu], ["server", server]]) {
    assert.doesNotMatch(src, /CUTAWAY_FLAG|"cutaway_explainer"/, `${name} still refers to the old flag`);
  }
  assert.doesNotMatch(server, /user_feature_flags|global_feature_flags/, "server still reads a feature-flag table");
});

// ---------- who may generate: one rule for the page and the server ----------

test("access: signed out = guest, free/unknown plan = free, Starter and above (and affiliates) = paid, unread plan = unknown", async () => {
  const { accessFor, canGenerate, PAID_PLANS } = await import("../supabase/functions/_shared/cutaway/access.js");
  assert.deepEqual([...PAID_PLANS], ["starter", "pro", "generative", "affiliate"]);
  assert.equal(accessFor({ signedIn: false, planCode: "pro" }), "guest");
  assert.equal(accessFor({ signedIn: true, planCode: "free" }), "free");
  assert.equal(accessFor({ signedIn: true, planCode: "something-else" }), "free");
  assert.equal(accessFor({ signedIn: true, planCode: null }), "unknown", "a failed plan read never blocks; the server decides");
  for (const p of ["starter", "Pro", "generative", " affiliate "]) assert.equal(accessFor({ signedIn: true, planCode: p }), "paid", p);
  assert.equal(canGenerate(undefined), false);
  assert.equal(canGenerate("free"), false);
});

test("access: the server enforces the same rule on every action, before anything is charged", () => {
  const server = readFileSync(new URL("../supabase/functions/cutaway-api/index.ts", import.meta.url), "utf8");
  assert.match(server, /import \{ canGenerate \} from "\.\.\/_shared\/cutaway\/access\.js";/);
  assert.match(server, /if \(!canGenerate\(profile\?\.plan_code \?\? "free"\)\) throw new ApiError\("Cutaway Explainer is for paid plans\.", 402\);/);
  // every action goes through requireUser first: it is the first line of handle()
  assert.match(server, /async function handle\(req: Request\) \{\r?\n  const userId = await requireUser\(req\);/);
  assert.doesNotMatch(server, /PAID_PLANS/, "no second copy of the plan list in the server");
});

test("page: nothing pops up on load; guests get sign-up and free plans the upgrade popup only when they press Generate", () => {
  const page = readFileSync(new URL("../src/pages/workspace/CutawayExplainer.jsx", import.meta.url), "utf8");
  const builder = readFileSync(new URL("../src/components/viral-tools/cutaway-explainer/CutawayBuilder.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(page, /setPaywallOpen\(true\)|useState\(true\)/, "no popup opens by itself");
  assert.match(page, /<AuthModal\s+mode="signup"/);
  assert.match(page, /title="Cutaway Explainer is for paid plans"/);
  assert.match(page, /subtitle="Upgrade to make your own 3D explainer videos\."/);
  assert.match(page, /dropFeatures=\{\["Watermark-free exports"\]\}/, "Starter keeps the end card here, so that generic line is dropped");
  assert.match(page, /const DEV_AS = import\.meta\.env\.DEV \?/, "the ?as= state override exists only in local dev");
  assert.match(builder, /if \(access === "guest"\) \{ onSignUp\?\.\(\); return; \}/);
  assert.match(builder, /if \(access === "free"\) \{ onUpgrade\?\.\(\); return; \}/);
  assert.match(builder, /access === "guest" \? <>\s*Sign up to generate/);
});

test("examples: our two finished videos (with the end card) fill Recent Creations until the viewer has one of their own", async () => {
  const { EXAMPLES, recentOrExamples } = await import("../src/components/viral-tools/cutaway-explainer/api/cutawayApi.js");
  assert.deepEqual(EXAMPLES.map((e) => e.id), ["example-french-drain", "example-landfill"]);
  for (const e of EXAMPLES) {
    assert.equal(e.example, true); assert.equal(e.endCard, true); assert.equal(e.step, "done");
    assert.ok(existsSync(new URL(`../public${e.finalUrl}`, import.meta.url)), e.finalUrl);
    assert.ok(existsSync(new URL(`../public${e.poster}`, import.meta.url)), e.poster);
  }
  assert.equal(recentOrExamples([]), EXAMPLES);
  const mine = [{ id: "r1", topic: "septic tank" }];
  assert.equal(recentOrExamples(mine), mine, "as soon as they have a video, only theirs");
});
