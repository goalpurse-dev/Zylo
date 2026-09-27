// deno-lint-ignore-file no-explicit-any
// Phase 2a / 2a-fix Beat Director — offline tests (zero API spend): word
// stream, timing, cut points, windows, CLAUSE CHUNKS, validators, auto-split
// + concept fill, the director loop (stub + recorded cassettes), cost cap.
import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import {
  buildWordStream, syntheticTimings, realTimings, planWindows, buildBibleIndex, validateWindowBeats, buildChunks, chunkWindows,
  chunkRangesToWords, autoSplitBeats, assembleBeats, validatePlan, planStats, runBeatDirector, anthropicModelCall, beatTiming,
  parseBeatsOutput, normalizeBeat, buildBeatSchema, windowUserPrompt, directorSystemPrompt, conceptNotStill, markRewrites, expandBeat, fillUserPrompt, isSoft, windowAllowances, defaultMotion, copyPlantMotion, contentIssues, namedThings, wrongEraViewer, fixViewerEras, balanceWarnings, listedNouns, missingViewer, retimePlan, SYNTHETIC_WPM, CHUNK_MAX_WORDS, type ModelCall,
} from "../../supabase/functions/_shared/stickman/beatDirector.ts";
import { installCassettePlayer } from "../../supabase/functions/_shared/stickman/cassette.ts";
import { validateBible, isSoftBibleError } from "../../supabase/functions/_shared/stickman/productionBible.ts";
import { youContexts } from "../../supabase/functions/_shared/stickman/viewerEra.ts";
import { wordsPerMinuteFor, wordsPerMinuteForProfile, measuredWpm, VOICE_CALIBRATIONS, UNCALIBRATED_VOICES, DEFAULT_NARRATION_SPEED } from "../../src/lib/voicePace.ts";
import { alignmentToWords } from "../../supabase/functions/_shared/ttsAlignment.ts";
import { estimateForLength } from "../../src/pages/workspace/long-form/lengthEstimates.js";

const mvr = JSON.parse(await Deno.readTextFile(new URL("../fixtures/stickman/scripts/format-myth-vs-reality-vikings.json", import.meta.url)));
const segments = mvr.script_document.narrationSegments.map((s: any) => ({ id: s.id, text: s.text }));

const bible = {
  visualPremise: "A myth-busting doodle of Viking helmets.",
  hero: { exists: false },
  recurringCharacters: [],
  roleArchetypes: [{ id: "viewer", role: "the viewer" }, { id: "viking_warrior", role: "a Viking warrior" }],
  world: { settingFamilies: ["Viking battlefield", "Museum hall", "Opera stage"] },
  objectLanguage: [{ id: "horned_helmet", canonicalDescription: "a helmet with two curved horns" }, { id: "iron_cap", canonicalDescription: "a plain rounded iron helmet" }],
};
const callback = { key: "two long curved horns", plantSegmentId: "seg1", payoffSegmentId: "seg14" };
const stream = buildWordStream(segments);
const index = buildBibleIndex(bible);

/* ============================ Word stream + timing ============================ */

Deno.test("word stream: every word indexed once, text reassembles exactly, synthetic pace ~145 wpm", () => {
  assertEquals(stream.timingSource, "synthetic");
  assertEquals(stream.words.map((w) => w.word).join(" "), stream.scriptText);
  const speechMs = stream.words.reduce((sum, w) => sum + (w.endMs - w.startMs), 0);
  const wpm = stream.words.length / (speechMs / 60_000);
  assert(Math.abs(wpm - SYNTHETIC_WPM) / SYNTHETIC_WPM < 0.05, `speech rate ${wpm.toFixed(1)} wpm`);
  for (let i = 1; i < stream.words.length; i++) assert(stream.words[i].startMs >= stream.words[i - 1].endMs, "monotonic");
});

Deno.test("synthetic timing: sentence ends pause longer than commas, which pause longer than nothing", () => {
  const w = syntheticTimings([{ id: "a", text: "One two, three four. Five six" }]);
  const gap = (i: number) => w[i + 1].startMs - w[i].endMs;
  assert(gap(3) > gap(1) && gap(1) > gap(0) && gap(0) === 0);
});

Deno.test("real timing: aligned word times are used; a mismatched segment falls back proportionally", () => {
  const segs = [{ id: "a", text: "You wake up." }, { id: "b", text: "It is dark outside now." }];
  const narration = [
    { segmentId: "a", startSeconds: 0, endSeconds: 1.2, words: [{ word: "You", start: 0, end: 0.3 }, { word: "wake", start: 0.3, end: 0.7 }, { word: "up.", start: 0.7, end: 1.2 }] },
    { segmentId: "b", startSeconds: 1.5, endSeconds: 3.5, words: [{ word: "It's", start: 1.5, end: 2 }] },
  ];
  const words = realTimings(segs, narration)!;
  assertEquals(words.slice(0, 3).map((w) => [w.startMs, w.endMs]), [[0, 300], [300, 700], [700, 1200]]);
  assertEquals([words[3].startMs, words.at(-1)!.endMs], [1500, 3500]);
  assertEquals(buildWordStream(segs, narration).timingSource, "real");
  assertEquals(buildWordStream(segs, [narration[0]]).timingSource, "synthetic");
});

Deno.test("windows: 150-250 words, contiguous, full coverage, ending on sentence ends", () => {
  const wins = planWindows(stream);
  assertEquals([wins[0].startWord, wins.at(-1)!.endWord], [0, stream.words.length - 1]);
  for (let i = 1; i < wins.length; i++) assertEquals(wins[i].startWord, wins[i - 1].endWord + 1);
  for (const w of wins.slice(0, -1)) assert(/[.!?]["')\]]?$/.test(stream.words[w.endWord].word));
});

Deno.test("bible index: archetypes are cast; settings get deterministic ids", () => {
  assertEquals(index.cast.map((c) => c.id), ["viewer", "viking_warrior"]);
  assertEquals(index.settings.map((s) => s.id), ["setting_viking_battlefield", "setting_museum_hall", "setting_opera_stage"]);
  assertEquals(buildBibleIndex(structuredClone(bible)), index);
});

/* ============================ Clause chunks ============================ */

const chunksOf = (text: string) => {
  const s = buildWordStream([{ id: "a", text }]);
  return buildChunks(s, 0, s.words.length - 1).map((c) => c.text);
};

Deno.test("chunks: split at commas and before and/but/so/because/which/when (both sides >= 3 words); sentence ends always end a chunk", () => {
  assertEquals(chunksOf("You grip the shield tight, and the horns catch the firelight. They look terrifying today."),
    ["You grip the shield tight,", "and the horns catch the firelight.", "They look terrifying today."]);
  assertEquals(chunksOf("Archaeologists dug for a century but found very few helmets at all."),
    ["Archaeologists dug for a century", "but found very few helmets at all."]);
  assertEquals(chunksOf("So what?"), ["So what?"], "short sentences stay whole");
});

Deno.test("chunks: never split inside a number, a date, a proper name, or a quoted title", () => {
  const dated = chunksOf("On June 28th, 1914, a car rolled past slowly in Sarajevo, Bosnia, and nobody moved.");
  assert(dated.some((c) => c.includes("June 28th, 1914")), JSON.stringify(dated));
  assert(dated.some((c) => c.includes("Sarajevo, Bosnia")), JSON.stringify(dated));
  const titled = chunksOf('Richard Wagner staged "The Ring, the Gold, and the Horns" in Bayreuth for weeks on end.');
  assert(titled.some((c) => c.includes('"The Ring, the Gold, and the Horns"')), JSON.stringify(titled));
  const big = chunksOf("It weighed 1,300 pounds, which is more than a small car weighs today.");
  assert(big.some((c) => c.includes("1,300 pounds")), JSON.stringify(big));
});

Deno.test("chunks: a clause over 12 words is split at a natural break or the midpoint", () => {
  const long = chunksOf("The bronze is thin decorative almost delicate and far too fragile for any real fighting at all in battle ever.");
  assert(long.every((c) => c.split(" ").length <= CHUNK_MAX_WORDS), JSON.stringify(long));
  const noBreaks = chunksOf("Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho.");
  assert(noBreaks.length === 2 && noBreaks.every((c) => c.split(" ").length <= CHUNK_MAX_WORDS), JSON.stringify(noBreaks));
});

Deno.test("chunks on the real script: contiguous, cover everything, <= 12 words, mostly 4-12 words", () => {
  const wins = chunkWindows(stream, planWindows(stream));
  const all = wins.flatMap((w) => w.chunks);
  assertEquals(all.map((c) => c.index), all.map((_, i) => i));
  assertEquals(all.map((c) => c.text).join(" "), stream.scriptText);
  for (let i = 1; i < all.length; i++) assertEquals(all[i].startWord, all[i - 1].endWord + 1);
  assert(all.every((c) => c.wordCount <= CHUNK_MAX_WORDS));
  const inRange = all.filter((c) => c.wordCount >= 4).length / all.length;
  const med = [...all.map((c) => c.wordCount)].sort((a, b) => a - b)[Math.floor(all.length / 2)];
  console.log(`real script: ${stream.words.length} words -> ${all.length} chunks, median ${med} words, ${Math.round(inRange * 100)}% >= 4 words`);
  assert(inRange > 0.85);
});

/* ============================ Stub director (chunk ranges) ============================ */

const TREAT = ["STORY_SCENE", "OBJECT_DETAIL", "REACTION", "COMPARISON", "SYMBOLIC"];
const CAMS = ["WIDE", "CLOSE_UP", "MEDIUM", "OVERHEAD"];
const contract = (i: number, overrides: any = {}) => ({
  visualConcept: `Stub visual ${i}`, userSummary: `Stub summary ${i}`, treatment: TREAT[i % TREAT.length],
  // Alternating subject (viewer / nobody) so stub runs never trip the subject-run rule.
  subjects: i % 2 ? [] : [{ castId: "viewer", presence: "full", action: "looks", expression: "curious" }],
  settingId: "setting_museum_hall", propIds: i % 2 ? [] : ["iron_cap"],
  composition: { camera: CAMS[i % CAMS.length], framing: "centered" },
  motionIntent: { camera: "slow push-in", subject: "turns head", environment: "still", weight: "light" },
  ...overrides,
});
const windows = chunkWindows(stream, planWindows(stream));
const windowOf = (user: string) => windows[Number(user.match(/WINDOW (\d+)/)![1]) - 1];

// Deterministic director: pairs chunks while the pair stays <= 5 s.
const stubDirector: ModelCall = async ({ user }) => {
  const win = windowOf(user);
  if (user.includes("NEEDS CONTRACT")) {
    const ranges = [...user.matchAll(/NEEDS CONTRACT C(\d+)\.\.C(\d+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
    return { input: { beats: ranges.map(([s, e], i) => ({ startChunk: s, endChunk: e, ...contract(i + 7, { composition: { camera: "EXTREME_CLOSE_UP", framing: "fill" } }) })) }, usage: { inputTokens: 500, outputTokens: 200, cacheReadTokens: 0, cacheWriteTokens: 0 } };
  }
  const beats: any[] = [];
  let k = 0;
  while (k < win.chunks.length) {
    const a = win.chunks[k];
    const b = win.chunks[k + 1];
    const pair = b && b.endMs - a.startMs <= 5000;
    beats.push({ startChunk: a.index, endChunk: pair ? b.index : a.index, ...contract(beats.length) });
    k += pair ? 2 : 1;
  }
  return { input: { beats }, usage: { inputTokens: 1000, outputTokens: 500, cacheReadTokens: 0, cacheWriteTokens: 0 } };
};

Deno.test("director (stub): full plan covers the script exactly with small beats", async () => {
  const res: any = await runBeatDirector({ segments, bible, callback, callModel: stubDirector });
  assert(res.ok, JSON.stringify(res.issues));
  assertEquals(res.beats.map((b: any) => b.narrationText).join(" "), stream.scriptText);
  assert(res.stats.wordsPerBeat.max <= 24);
  assert(res.beats.every((b: any) => b.durationMs <= 6500));
  assert(res.stats.castUsed.viewer > res.beats.length / 3);
});

/* ============================ Validators ============================ */

const win0 = windows[0];
async function goodWindow() {
  const raw = (await stubDirector({ system: "", user: `WINDOW 1`, schema: null, toolName: "x" })).input.beats.map(normalizeBeat);
  // Same order as the pipeline: chunk ranges -> words -> code auto-split/merge.
  return autoSplitBeats(chunkRangesToWords(raw, win0).beats, win0, stream).beats;
}

Deno.test("validator: a clean window passes", async () => {
  // Clean = no HARD issues (stub concepts are placeholders, so SOFT content checks may fire).
  assertEquals(validateWindowBeats(await goodWindow(), win0, stream, index, null).filter((i) => !isSoft(i)), []);
});

Deno.test("chunk ranges: gaps, overlaps and bad chunk numbers are HARD", () => {
  const ok = [{ startChunk: 0, endChunk: 1 }, { startChunk: 2, endChunk: win0.chunks.at(-1)!.index }];
  assertEquals(chunkRangesToWords(ok, win0).issues, []);
  assert(chunkRangesToWords([{ startChunk: 0, endChunk: 1 }, { startChunk: 3, endChunk: win0.chunks.at(-1)!.index }], win0).issues.some((i) => i.code === "gap"));
  assert(chunkRangesToWords([{ startChunk: 0, endChunk: 1 }, { startChunk: 1, endChunk: win0.chunks.at(-1)!.index }], win0).issues.some((i) => i.code === "overlap"));
  assert(chunkRangesToWords([{ startChunk: 0, endChunk: 9999 }], win0).issues.some((i) => i.code === "chunk_range_invalid"));
});

Deno.test("validator: invented ids, long SHORT_TEXT, text rate and HOLD rate are HARD", async () => {
  const beats = await goodWindow();
  beats[0].subjects = [{ castId: "ghost", presence: "full", action: "", expression: "" }];
  beats[1].settingId = "setting_moon";
  beats[2].propIds = ["laser"];
  beats[3].textIntent = { mode: "SHORT_TEXT", text: "this text is far too long" };
  for (const b of beats.slice(4, 12)) b.textIntent = { mode: "SHORT_TEXT", text: "793 AD" };
  for (const b of beats.slice(12, 16)) b.flags = { punch: false, hold: true, reason: "breathe" };
  const codes = validateWindowBeats(beats, win0, stream, index, null).map((i) => i.code);
  for (const c of ["unknown_cast", "unknown_setting", "unknown_prop", "short_text_too_long", "short_text_rate", "hold_rate"]) assert(codes.includes(c), c);
});

Deno.test("validator: identical adjacent beats are HARD unless HOLD or CALLBACK (also across windows)", async () => {
  const beats = await goodWindow();
  beats[1] = { ...beats[1], ...contract(0) };
  assert(validateWindowBeats(beats, win0, stream, index, null).some((i) => i.code === "adjacent_identical"));
  beats[1].flags = { punch: false, hold: true, reason: "hold on the reveal" };
  assert(!validateWindowBeats(beats, win0, stream, index, null).some((i) => i.code === "adjacent_identical"));
  const fresh = await goodWindow();
  assert(validateWindowBeats(fresh, win0, stream, index, { ...fresh[0] }).some((i) => i.code === "adjacent_identical"));
});

Deno.test("plan validator: coverage and exact text", async () => {
  const v = validatePlan(assembleBeats(await goodWindow(), stream), stream);
  assert(v.hard.some((i) => i.code === "coverage_end") && v.hard.some((i) => i.code === "text_mismatch"));
});

/* ============================ Auto-split ============================ */

Deno.test("auto-split: a beat over 6.5 s (or over 3 chunks) is split at chunk boundaries; extra parts need a fresh contract", () => {
  const all = win0.chunks;
  const whole = chunkRangesToWords([{ startChunk: all[0].index, endChunk: all.at(-1)!.index, ...contract(0) }], win0).beats.map(normalizeBeat);
  const { beats, needFill, splits } = autoSplitBeats(whole, win0, stream);
  assertEquals(splits, 1);
  assert(beats.length > 10 && needFill.length >= beats.length - 2);
  assertEquals(beats[0].visualConcept, "Stub visual 0", "first part keeps the parent contract");
  assert(beats.slice(1).every((b: any) => !b.visualConcept && b.parentConcept === "Stub visual 0"));
  for (const b of beats) {
    const t = beatTiming(stream, b.startWord, b.endWord);
    assert(t.endMs - t.startMs <= 6500 && b.endChunk - b.startChunk + 1 <= 3);
  }
  assertEquals(beats.map((b: any) => stream.words.slice(b.startWord, b.endWord + 1).map((w) => w.word).join(" ")).join(" "), all.map((c) => c.text).join(" "));
});

Deno.test("auto-split: a HOLD with a reason up to 9 s is kept", () => {
  const pair = win0.chunks.slice(0, 3);
  const b = chunkRangesToWords([{ startChunk: pair[0].index, endChunk: pair[2].index, ...contract(0), flags: { punch: false, hold: true, reason: "let it land" } }], { ...win0, chunks: pair }).beats.map(normalizeBeat);
  const dur = beatTiming(stream, b[0].startWord, b[0].endWord);
  const res = autoSplitBeats(b, { ...win0, chunks: pair }, stream);
  assertEquals(res.splits, dur.endMs - dur.startMs <= 9000 ? 0 : 1);
});

Deno.test("director: over-long beats are auto-split and the new parts filled by ONE batched call per window", async () => {
  const prompts: string[] = [];
  const lazy: ModelCall = async (req) => {
    prompts.push(req.user);
    if (req.user.includes("NEEDS CONTRACT")) return stubDirector(req);
    const win = windowOf(req.user);
    const beats: any[] = [];
    for (let k = 0; k < win.chunks.length; k += 3) beats.push({ startChunk: win.chunks[k].index, endChunk: win.chunks[Math.min(k + 2, win.chunks.length - 1)].index, ...contract(beats.length) });
    return { input: { beats }, usage: { inputTokens: 1000, outputTokens: 500, cacheReadTokens: 0, cacheWriteTokens: 0 } };
  };
  const res: any = await runBeatDirector({ segments, bible, callback, callModel: lazy });
  assert(res.ok, JSON.stringify(res.issues?.slice(0, 3)));
  assert(res.stats.autoSplits > 0);
  assertEquals(prompts.filter((p) => p.includes("NEEDS CONTRACT")).length, windows.length, "one fill call per window");
  assertStringIncludes(prompts.find((p) => p.includes("NEEDS CONTRACT"))!, "never duplicate the original beat's image idea");
  assert(res.beats.every((b: any) => b.durationMs <= 6500));
});

/* ============================ Repair, resume, cost cap ============================ */

Deno.test("director: a failing window gets ONE repair with the exact issues, then fails clearly", async () => {
  let calls = 0;
  const prompts: string[] = [];
  const bad: ModelCall = async (req) => {
    if (!req.user.includes("NEEDS CONTRACT")) calls += 1;
    prompts.push(req.user);
    const res = await stubDirector(req);
    res.input.beats[0].subjects = [{ castId: "ghost", presence: "full", action: "", expression: "" }];
    return res;
  };
  const res: any = await runBeatDirector({ segments, bible, callback, callModel: bad });
  assertEquals([res.ok, res.errorCode, calls], [false, "WINDOW_VALIDATION_FAILED", 2]);
  assertStringIncludes(prompts.filter((p) => !p.includes("NEEDS CONTRACT"))[1], 'castId "ghost" is not in the bible');
});

Deno.test("director: yields between windows and resumes to the identical plan, one call per window", async () => {
  let fullCalls = 0;
  const full: any = await runBeatDirector({ segments, bible, callback, callModel: async (req) => { fullCalls += 1; return stubDirector(req); } });
  let calls = 0;
  const counting: ModelCall = async (req) => { calls += 1; return stubDirector(req); };
  let r: any = await runBeatDirector({ segments, bible, callback, callModel: counting, shouldYield: () => true });
  assertEquals(r.resume.nextWindow, 1);
  while (r.yielded) r = await runBeatDirector({ segments, bible, callback, callModel: counting, resume: r.resume, shouldYield: () => true });
  assert(r.ok);
  assertEquals(calls, fullCalls);
  assertEquals(r.beats.map((b: any) => [b.startWord, b.endWord]), full.beats.map((b: any) => [b.startWord, b.endWord]));
});

Deno.test("cost cap: the director refuses a call that could exceed the cap", async () => {
  let calls = 0;
  const counting: ModelCall = async (req) => { calls += 1; return stubDirector(req); };
  const res: any = await runBeatDirector({ segments, bible, callback, callModel: counting, maxCostUsd: 0.2, costOf: (u: any) => u.calls * 0.05 });
  assertEquals(res.errorCode, "COST_CAP");
  assert(calls >= 1 && calls < windows.length);
});

/* ============================ Recorded paid runs through the new chunking ============================ */

// The last recorded output that parses (run 1's repair output was malformed).
function recordedBeats(fixture: any) {
  const outs = fixture.cassette.entries.map((e: any) => parseBeatsOutput(e.response.content.find((b: any) => b.type === "tool_use").input).beats);
  return outs.filter((b: any[]) => b.length).at(-1);
}

// Re-cut a recorded word-range plan onto chunks: each chunk joins the recorded
// beat that contains its first word; then code auto-split applies.
function rechunk(fixture: any) {
  const s = buildWordStream(fixture.segments);
  const win = chunkWindows(s, planWindows(s))[0];
  const rec = recordedBeats(fixture);
  const owner = (w: number) => rec.findIndex((b: any) => w >= b.startWord && w <= b.endWord);
  const groups: any[] = [];
  for (const c of win.chunks) {
    const o = owner(c.startWord);
    if (o === -1) continue;
    const last = groups.at(-1);
    if (last && last.owner === o) last.endChunk = c.index;
    else groups.push({ owner: o, startChunk: c.index, endChunk: c.index, ...normalizeBeat(rec[o]) });
  }
  const covered = groups.at(-1).endChunk;
  const cw = { ...win, chunks: win.chunks.filter((c) => c.index <= covered) };
  const mapped = chunkRangesToWords(groups, cw).beats;
  const split = autoSplitBeats(mapped, cw, s);
  const beats = assembleBeats(split.beats, s);
  return { recorded: rec, beats, stats: planStats(beats.map((b) => ({ ...b, contract: { treatment: b.contract.treatment ?? "FILL", ...b.contract } }))), chunks: cw.chunks.length, splits: split.splits, needFill: split.needFill.length, stream: s };
}

for (const name of ["myth-vs-reality.run1-failed", "myth-vs-reality.run2-failed"]) {
  Deno.test(`recorded ${name}: window 1 re-cut onto clause chunks + auto-split has no beat over 6.5 s`, async () => {
    const fixture = JSON.parse(await Deno.readTextFile(new URL(`../fixtures/stickman/beats/${name}.json`, import.meta.url)));
    const r = rechunk(fixture);
    const recDur = r.recorded.map((b: any) => { const t = beatTiming(r.stream, b.startWord, b.endWord); return t.endMs - t.startMs; });
    const words = r.beats.map((b) => b.endWord - b.startWord + 1).sort((a, b) => a - b);
    const durs = r.beats.map((b) => b.durationMs).sort((a, b) => a - b);
    console.log(`${name}: recorded ${r.recorded.length} beats (max ${(Math.max(...recDur) / 1000).toFixed(1)}s, ${recDur.filter((d: number) => d > 6500).length} over 6.5s) -> ${r.chunks} chunks -> ${r.beats.length} beats after auto-split (${r.splits} split, ${r.needFill} need a fill), words/beat median ${words[Math.floor(words.length / 2)]} max ${words.at(-1)}, duration median ${(durs[Math.floor(durs.length / 2)] / 1000).toFixed(1)}s min ${(durs[0] / 1000).toFixed(1)}s max ${(durs.at(-1)! / 1000).toFixed(1)}s`);
    assert(r.beats.every((b) => b.durationMs <= 6500));
  });
}

Deno.test("run 1: no-cast bible — schema forbids subjects; placeholders stripped; malformed string output is a clear repair note", async () => {
  const run1 = JSON.parse(await Deno.readTextFile(new URL("../fixtures/stickman/beats/myth-vs-reality.run1-failed.json", import.meta.url)));
  const idx = buildBibleIndex(run1.bible);
  assertEquals(idx.cast.length, 0);
  assertEquals(buildBeatSchema(idx).properties.b.items.properties.cast.maxItems, 0);
  assertEquals(normalizeBeat({ subjects: [{ castId: "__none__" }], propIds: ["__none__", "gjermundbu_helmet"], settingId: "__none__" }).subjects, []);
  const secondOutput = run1.cassette.entries[1].response.content.find((b: any) => b.type === "tool_use").input;
  assertStringIncludes(parseBeatsOutput(secondOutput).error!, "not a valid JSON array");
  assertStringIncludes(directorSystemPrompt(idx, run1.bible, run1.callback), "CLAUSE CHUNKS");
});

Deno.test("window prompt: chunks with start time, duration and word count", () => {
  const p = windowUserPrompt(stream, win0, []);
  assertStringIncludes(p, `C0 [0.0s,`);
  assert(/C\d+ \[\d+\.\ds, \d+\.\ds long, \d+w(, pairs to \d+\.\ds)?\]/.test(p));
  assertStringIncludes(p, ", pairs to ");
});

/* ============================ Recorded confirmation run ============================ */

const recordedUrl = new URL("../fixtures/stickman/beats/myth-vs-reality.recorded.json", import.meta.url);
let recorded: any = null;
try {
  recorded = JSON.parse(await Deno.readTextFile(recordedUrl));
} catch { /* not recorded yet */ }

Deno.test({
  name: "recorded Sonnet 5 confirmation run replays offline to the same beats",
  ignore: !recorded?.result?.ok,
  fn: async () => {
    // Main calls replay in order; fills are answered by chunk from the recorded
    // fills (the newer quality rules send more beats to the fill — the ones the
    // recording never saw keep their beat, which never changes ranges).
    const entries = recorded.cassette.entries.map((e: any) => ({ user: e.request.messages[0].content as string, b: e.response.content.find((x: any) => x.type === "tool_use").input.b }));
    const mains = entries.filter((e: any) => !e.user.includes("NEEDS CONTRACT"));
    const fillsByWindow = new Map<string, any[]>();
    for (const e of entries.filter((x: any) => x.user.includes("NEEDS CONTRACT"))) {
      const w = e.user.match(/^WINDOW (\d+)/)![1];
      fillsByWindow.set(w, [...(fillsByWindow.get(w) ?? []), ...e.b]);
    }
    let m = 0;
    const replay: ModelCall = async (req) => {
      if (!req.user.includes("NEEDS CONTRACT")) return { input: { b: mains[m++].b }, usage: USAGE_R };
      const want = new Set([...req.user.matchAll(/NEEDS CONTRACT C(\d+)\.\./g)].map((x) => Number(x[1])));
      return { input: { b: (fillsByWindow.get(req.user.match(/^WINDOW (\d+)/)![1]) ?? []).filter((b: any) => want.has(b.s)) }, usage: USAGE_R };
    };
    const res: any = await runBeatDirector({ segments: recorded.segments, bible: recorded.bible, narration: null, callback: recorded.callback, callModel: replay, hookSingleChunk: false });
    assertEquals(res.ok, true);
    assertEquals(res.beats.map((b: any) => [b.startWord, b.endWord]), recorded.result.ranges);
    console.log(`run 5 plan under the POLISH rules: soft warnings ${JSON.stringify(res.stats.softWarnings)}; plan warn [${res.validation.warn.map((w: any) => w.code).join(", ")}]; viewer era swaps ${res.stats.viewerSwaps}; cast ${res.stats.castPct}%`);
  },
});
const USAGE_R = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };

/* ============================ Confirmation run 3 (failed) — offline proof of the fix ============================ */

Deno.test("run 3: window 1 from the real recording now PASSES — sizing held, and framing-level progressions are not 'identical'", async () => {
  const run3 = JSON.parse(await Deno.readTextFile(new URL("../fixtures/stickman/beats/myth-vs-reality.run3-failed.json", import.meta.url)));
  const s = buildWordStream(run3.segments);
  const win = chunkWindows(s, planWindows(s))[0];
  const idx = buildBibleIndex(run3.bible);
  assert(idx.cast.some((c) => c.id === "viewer") && idx.cast.length >= 4, "rebuilt bible has a viewer + archetypes");
  const out = (i: number) => parseBeatsOutput(run3.cassette.entries[i].response.content.find((b: any) => b.type === "tool_use").input).beats.map(normalizeBeat);
  for (const [main, fill] of [[0, 1], [2, 3]]) {
    const split = autoSplitBeats(chunkRangesToWords(out(main), win).beats, win, s, { hookSingleChunk: false });
    const fills = out(fill);
    const beats = split.beats.map((b: any, i: number) => split.needFill.includes(i) ? { ...fills.find((f: any) => f.startChunk === b.startChunk), startChunk: b.startChunk, endChunk: b.endChunk, startWord: b.startWord, endWord: b.endWord } : b);
    // Attempt 1 is correctly repaired for its real issue (9 SHORT_TEXT > 7
    // allowed); the repaired attempt — which the live run failed ONLY on
    // false "identical" flags — now validates clean.
    // (subject_run is newer than this recording — see the "NEW rules" test below.)
    const codes = [...new Set(validateWindowBeats(beats, win, s, idx, null).map((i) => i.code).filter((c) => c !== "subject_run" && c !== "concept_not_still"))];
    assertEquals(codes.filter((c) => !isSoft({ code: c, message: "" })), [], `attempt ${main}: no HARD issues`);
    assertEquals(codes.includes("short_text_rate"), main === 0, `attempt ${main}: SHORT_TEXT rate`);
    const durs = beats.map((b: any) => { const t = beatTiming(s, b.startWord, b.endWord); return t.endMs - t.startMs; });
    const words = beats.map((b: any) => b.endWord - b.startWord + 1).sort((a: number, b: number) => a - b);
    console.log(`run 3 attempt ${main}: ${beats.length} beats, words median ${words[Math.floor(words.length / 2)]} max ${words.at(-1)}, ${(Math.min(...durs) / 1000).toFixed(1)}-${(Math.max(...durs) / 1000).toFixed(1)}s, cast ${[...new Set(beats.flatMap((b: any) => (b.subjects ?? []).map((x: any) => x.castId)))].join(",")}`);
  }
});

Deno.test("adjacency: same camera but different framing is a new composition; identical framing still fails", () => {
  const a = { treatment: "POV", composition: { camera: "CLOSE_UP", framing: "helmet horns in profile" }, subjects: [], settingId: null, flags: {} };
  const b1 = { ...a, composition: { camera: "CLOSE_UP", framing: "pull back, wind streaks" } };
  const b2 = { ...a, composition: { camera: "CLOSE_UP", framing: "Helmet horns in profile." } };
  const w = { index: 0, startWord: 0, endWord: 1 };
  const s = buildWordStream([{ id: "a", text: "One two three four five six seven eight nine ten." }]);
  const mk = (x: any, st: number, en: number) => ({ ...x, visualConcept: "v", startWord: st, endWord: en, flags: { punch: true, hold: false, reason: "test" } });
  const codes = (b: any) => validateWindowBeats([mk(a, 0, 4), mk(b, 5, 9)], { ...w, endWord: 9 }, s, buildBibleIndex({}), null).map((i) => i.code);
  assert(!codes(b1).includes("adjacent_identical"));
  assert(codes(b2).includes("adjacent_identical"));
});

/* ============================ Full-plan rules: frozen moment, subject variety, era viewers, compact wire ============================ */

Deno.test("frozen moment: motion/sequence/sound words are flagged; the still rewrite is not", () => {
  for (const c of ["the silhouette morphs across a painting", "a helmet transforms", "the horn turns into a costume", "he becomes a legend", "a sword, then a shield", "a sequence of posters", "horns whistling past", "the sound of drums", "you hear a crash", "the cry echoes"]) assert(conceptNotStill(c), c);
  for (const c of ["three frames side by side: a painting, a movie poster and a party costume, each showing the same horned figure", "a museum case with an iron cap", "a thenar muscle diagram"]) assertEquals(conceptNotStill(c), null, c);
  assertStringIncludes(directorSystemPrompt(index, bible, callback), `No transformations, sequences, sounds or "then"`);
});

const look = (id: string | null, k: number, extra: any = {}) => ({ treatment: TREAT[k % 5], composition: { camera: CAMS[k % 4], framing: `f${k}` }, subjects: id ? [{ castId: id }] : [], propIds: [], settingId: null, visualConcept: `v${k}`, flags: {}, ...extra });

Deno.test("subject variety: a 3rd beat in a row on the same subject is HARD (unless HOLD/CALLBACK), also across windows", async () => {
  const beats = (await goodWindow()).map((b: any, k: number) => ({ ...b, ...look(k % 3 === 2 ? null : "viking_warrior", k) }));
  assert(!validateWindowBeats(beats, win0, stream, index, null).some((i) => i.code === "subject_run"), "2 in a row is fine");
  beats[2] = { ...beats[2], subjects: [{ castId: "viking_warrior" }] };
  assert(validateWindowBeats(beats, win0, stream, index, null).some((i) => i.code === "subject_run" && i.beat === 3));
  beats[2].treatment = "CALLBACK";
  assert(!validateWindowBeats(beats, win0, stream, index, null).some((i) => i.code === "subject_run" && i.beat === 3));
  const fresh = (await goodWindow()).map((b: any, k: number) => ({ ...b, ...look(k === 0 ? "viking_warrior" : null, k + 10) }));
  const prev = [look("viking_warrior", 1), look("viking_warrior", 2)];
  assert(validateWindowBeats(fresh, win0, stream, index, prev).some((i) => i.code === "subject_run" && i.beat === 1));
  // A prop is the primary object when nobody is on screen.
  const props = [look(null, 1, { propIds: ["horned_helmet"] }), look(null, 2, { propIds: ["horned_helmet"] })];
  assert(validateWindowBeats(fresh.map((b: any, k: number) => k === 0 ? { ...b, subjects: [], propIds: ["horned_helmet"] } : b), win0, stream, index, props).some((i) => i.code === "subject_run"));
});

Deno.test("rewrites ride the window's ONE fill call (no full-window repair): non-still concepts and subject runs", async () => {
  const prompts: string[] = [];
  const warrior = [{ castId: "viking_warrior", presence: "full", action: "", expression: "" }];
  const director: ModelCall = async (req) => {
    prompts.push(req.user);
    if (req.user.includes("NEEDS CONTRACT")) {
      const ranges = [...req.user.matchAll(/NEEDS CONTRACT C(\d+)\.\.C(\d+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
      // Compact wire format, as the live model returns it.
      return { input: { b: ranges.map(([s, e], i) => ({ s, e, v: `still frame ${i}`, u: "fixed", t: "SYMBOLIC", c: "EXTREME_CLOSE_UP", f: `fill ${i}`, m: "hold | none | dust", w: "light" })) }, usage: { inputTokens: 500, outputTokens: 200, cacheReadTokens: 0, cacheWriteTokens: 0 } };
    }
    const res = await stubDirector(req);
    res.input.beats[1].visualConcept = "the silhouette morphs across a painting, a poster and a costume";
    for (const k of [3, 4, 5]) res.input.beats[k] = { ...res.input.beats[k], subjects: warrior };
    return res;
  };
  const res: any = await runBeatDirector({ segments, bible, callback, callModel: director });
  assert(res.ok, JSON.stringify(res.issues?.slice(0, 3)));
  assertEquals(res.repairs, 0, "no full-window repair");
  assertEquals(prompts.filter((p) => p.includes("NEEDS CONTRACT")).length, windows.length, "one fill call per window");
  const fill = prompts.find((p) => p.includes("NEEDS CONTRACT"))!;
  assertStringIncludes(fill, `"morphs" — make it one frozen still image`);
  assertStringIncludes(fill, `3rd beat in a row on "viking_warrior"`);
  assert(res.stats.rewrites >= windows.length * 2);
  assert(!res.beats.some((b: any) => conceptNotStill(b.contract.visualConcept)));
  assert(!res.validation.warn.some((w: any) => w.code === "concept_not_still"));
  const fixed = res.beats.find((b: any) => b.contract.visualConcept.startsWith("still frame"));
  assertEquals(fixed.contract.motionIntent, { camera: "hold", subject: "none", environment: "dust", weight: "light" });
});

Deno.test("compact wire beat expands to the full contract; the long format passes through", () => {
  const b = normalizeBeat({ s: 4, e: 5, v: "a viking grips a round shield", u: "Shield wall", t: "STORY_SCENE", c: "MEDIUM", f: "low angle", m: "slow push-in | grips shield | rain", w: "medium", cast: [{ id: "viewer_viking", p: "PRIMARY", a: "grips shield", x: "tense" }], set: "setting_viking_battlefield", txt: { m: "SHORT_TEXT", t: "793 AD" }, hold: "let it land" });
  assertEquals([b.startChunk, b.endChunk, b.composition, b.motionIntent.subject, b.subjects[0].castId, b.textIntent, b.flags], [4, 5, { camera: "MEDIUM", framing: "low angle" }, "grips shield", "viewer_viking", { mode: "SHORT_TEXT", text: "793 AD" }, { punch: false, hold: true, reason: "let it land" }]);
  const long = { startChunk: 1, endChunk: 1, visualConcept: "x" };
  assertEquals(expandBeat(long), long);
});

Deno.test("era-bound viewers: each viewer_* avatar is a cast id, and the prompt tells the director to match the era", () => {
  const eraBible = { ...bible, roleArchetypes: [{ id: "viewer_viking", role: "the viewer as a Viking raider" }, { id: "viewer_modern", role: "the viewer today" }, { id: "viking_warrior", role: "a Viking warrior" }] };
  const idx = buildBibleIndex(eraBible);
  assert(["viewer_viking", "viewer_modern"].every((id) => idx.cast.some((c) => c.id === id)));
  assert(buildBeatSchema(idx).properties.b.items.properties.cast.items.properties.id.enum.includes("viewer_modern"));
  assertStringIncludes(directorSystemPrompt(idx, eraBible, callback), "viewer avatar whose era/context matches the line");
});

Deno.test("run 3 window 1 under the NEW rules: which beats get rewritten (what changed)", async () => {
  const run3 = JSON.parse(await Deno.readTextFile(new URL("../fixtures/stickman/beats/myth-vs-reality.run3-failed.json", import.meta.url)));
  const s = buildWordStream(run3.segments);
  const win = chunkWindows(s, planWindows(s))[0];
  const idx = buildBibleIndex(run3.bible);
  const out = (i: number) => parseBeatsOutput(run3.cassette.entries[i].response.content.find((b: any) => b.type === "tool_use").input).beats.map(normalizeBeat);
  const split = autoSplitBeats(chunkRangesToWords(out(2), win).beats, win, s);
  const fills = out(3);
  const beats = split.beats.map((b: any, i: number) => split.needFill.includes(i) ? { ...fills.find((f: any) => f.startChunk === b.startChunk), startChunk: b.startChunk, endChunk: b.endChunk, startWord: b.startWord, endWord: b.endWord } : b);
  const before = validateWindowBeats(beats, win, s, idx, null).map((i) => `${i.code}@${i.beat}`);
  const concepts = beats.map((b: any) => b.visualConcept);
  const marked = markRewrites(beats, null);
  console.log(`run 3 w1 new rules: ${beats.length} beats; HARD before rewrites [${before.join(", ")}]; rewritten in the fill call: ${marked.length}`);
  for (const k of marked) console.log(`  Beat ${k + 1}: ${beats[k].fixReason} | was: ${concepts[k]}`);
  assert(marked.some((k) => /morph/i.test(concepts[k])), "the morph beat is rewritten");
});

/* ============================ Run 4 (failed full-plan attempt) — offline proof of the fixes ============================ */

const run4 = JSON.parse(await Deno.readTextFile(new URL("../fixtures/stickman/beats/myth-vs-reality.run4-failed.json", import.meta.url)));
const run4Out = (i: number) => run4.cassette.entries[i].response.content.find((b: any) => b.type === "tool_use").input.b;

Deno.test("run 4: the bible that caused it is now rejected — viewer duplicated as HERO, and an object filed as an archetype", () => {
  const errors = validateBible(run4.bible, run4.segments.map((s: any) => s.text).join(" "));
  assert(errors.some((e) => e.startsWith("VIEWER_DUPLICATED_AS_HERO")), errors.join("; "));
  assert(errors.some((e) => e.startsWith("ARCHETYPE_NOT_A_PERSON:theatrical_horned_helmet")), errors.join("; "));
  // Polish check false positive: a person whose role mentions props is still a person.
  const designer = { ...run4.bible, roleArchetypes: [{ id: "19c_stage_designer", role: "a 19th-century stage designer who made the prop horned helmets", canonicalAppearance: "waistcoat, sketchbook", usedFor: "opera origin" }] };
  assert(!validateBible(designer).some((e) => e.startsWith("ARCHETYPE_NOT_A_PERSON")));
  const modern = { id: "viewer_modern", role: "the viewer today", canonicalAppearance: "same stickman in a hoodie and jeans", usedFor: "present-day lines" };
  const fixed = { ...run4.bible, continuityMode: "ENSEMBLE", hero: { ...run4.bible.hero, exists: false, canonicalAppearance: "" }, roleArchetypes: [...run4.bible.roleArchetypes.filter((a: any) => a.id !== "theatrical_horned_helmet"), modern] };
  const after = validateBible(fixed, run4.segments.map((s: any) => s.text).join(" "));
  assert(!after.some((e) => /VIEWER|ARCHETYPE_NOT/.test(e)), after.join("; "));
});

Deno.test("run 4: the repair's subject-run rewrite now tells the fill WHICH subject to avoid and shows neighbours' cast", () => {
  const s = buildWordStream(run4.segments);
  const win = chunkWindows(s, planWindows(s))[0];
  const idx = buildBibleIndex(run4.bible);
  const split = autoSplitBeats(chunkRangesToWords(run4Out(2).map((b: any) => normalizeBeat(b, idx)), win).beats, win, s);
  const marked = markRewrites(split.beats, null);
  const needFill = split.beats.map((b: any, i: number) => (b.needsFill ? i : -1)).filter((i: number) => i >= 0);
  const prompt = fillUserPrompt(s, win, split.beats, needFill);
  assert(marked.length > 0);
  assertStringIncludes(prompt, `its main subject must NOT be "hero"`);
  assert(/context C\d+\.\.C\d+ .*\[hero\]/.test(prompt), "neighbours show their cast");
  // The recorded fill put "hero" back — the same HARD failure the live run hit, now caught by name.
  const fills = run4Out(3).map((b: any) => normalizeBeat(b, idx));
  const beats = split.beats.map((b: any, i: number) => needFill.includes(i) ? { ...(fills.find((f: any) => f.startChunk === b.startChunk) ?? b), startChunk: b.startChunk, endChunk: b.endChunk, startWord: b.startWord, endWord: b.endWord } : b);
  assert(validateWindowBeats(beats, win, s, idx, null).some((i) => i.code === "subject_run"));
});

Deno.test("run 4: settings go over the wire as S-numbers (a slug id was ~15 output tokens per beat) and expand back", () => {
  const idx = buildBibleIndex(run4.bible);
  const schema = buildBeatSchema(idx);
  assertEquals(schema.properties.b.items.properties.set.enum.slice(0, 2), ["S1", "S2"]);
  assertEquals(normalizeBeat({ s: 0, e: 0, v: "x", set: "S2" }, idx).settingId, idx.settings[1].id);
  assertEquals(normalizeBeat(run4Out(0)[0], idx).settingId, run4Out(0)[0].set, "recorded full ids still pass through");
  const sys = directorSystemPrompt(idx, run4.bible, run4.callback);
  assertStringIncludes(sys, `"id":"S1"`);
  // What the recorded output spent on setting ids alone.
  const beats = [0, 1, 2, 3].flatMap((i) => run4Out(i));
  const setChars = beats.reduce((n: number, b: any) => n + (b.set ? b.set.length : 0), 0);
  const allChars = beats.reduce((n: number, b: any) => n + JSON.stringify(b).length, 0);
  console.log(`run 4 output: ${beats.length} beats, ${Math.round(allChars / beats.length)} chars/beat, setting ids ${Math.round((setChars / allChars) * 100)}% of output chars`);
});

/* ============================ Final attempt: SOFT rules never fail a paid run; motion written by code ============================ */

const USAGE = { inputTokens: 500, outputTokens: 200, cacheReadTokens: 0, cacheWriteTokens: 0 };

Deno.test("SOFT: a subject run the fill can't fix is KEPT with a per-beat warning — no full-window repair, plan ok", async () => {
  const prompts: string[] = [];
  const warrior = [{ castId: "viking_warrior", presence: "full", action: "", expression: "" }];
  const stubborn: ModelCall = async (req) => {
    prompts.push(req.user);
    if (req.user.includes("NEEDS CONTRACT")) {
      // The fill ignores the note and returns the same subject (what run 4's fill did).
      const ranges = [...req.user.matchAll(/NEEDS CONTRACT C(\d+)\.\.C(\d+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
      return { input: { b: ranges.map(([s, e], i) => ({ s, e, v: `the warrior again ${i}`, t: "STORY_SCENE", c: "LOW_ANGLE", f: `again ${i}`, cast: [{ id: "viking_warrior", a: "stands" }] })) }, usage: USAGE };
    }
    const res = await stubDirector(req);
    for (const k of [3, 4, 5]) res.input.beats[k] = { ...res.input.beats[k], subjects: warrior };
    return res;
  };
  const res: any = await runBeatDirector({ segments, bible, callback, callModel: stubborn });
  assert(res.ok, JSON.stringify(res.issues?.slice(0, 3)));
  assertEquals(res.repairs, 0);
  assertEquals(prompts.length, windows.length * 2, "one main + one fill call per window, nothing else");
  assert(res.stats.softWarnings.subject_run >= windows.length);
  assert(res.beats.some((b: any) => b.warnings.some((w: any) => w.code === "subject_run")));
  assert(res.beats.every((b: any) => Array.isArray(b.warnings)));
});

Deno.test("HARD stays HARD: unknown ids still get one full repair, then fail (never kept as a warning)", async () => {
  let calls = 0;
  const bad: ModelCall = async (req) => { if (!req.user.includes("NEEDS CONTRACT")) calls += 1; const r = await stubDirector(req); r.input.beats[0].settingId = "setting_moon"; return r; };
  const res: any = await runBeatDirector({ segments, bible, callback, callModel: bad });
  assertEquals([res.ok, res.errorCode, calls], [false, "WINDOW_VALIDATION_FAILED", 2]);
  assert(res.issues.every((i: any) => !isSoft(i)));
  for (const c of ["subject_run", "adjacent_identical", "concept_not_still", "short_text_too_long", "short_text_rate", "hold_rate"]) assert(isSoft({ code: c, message: "" }), c);
  for (const c of ["gap", "overlap", "too_long", "too_short", "unknown_cast", "unknown_setting", "unknown_prop", "chunk_range_invalid", "malformed_output", "missing_concept", "fill_missing"]) assert(!isSoft({ code: c, message: "" }), c);
});

Deno.test("SOFT: SHORT_TEXT over the allowance and identical neighbours are sent to the fill, not a repair", async () => {
  const beats = (await goodWindow()).map((b: any) => ({ ...b, textIntent: { mode: "SHORT_TEXT", text: "793 AD" } }));
  beats[1] = { ...beats[1], ...contract(0), textIntent: { mode: "NO_TEXT", text: null } };
  const allowed = windowAllowances(stream, win0).text;
  markRewrites(beats, null, allowed);
  const reasons = beats.map((b: any) => b.fixReason ?? "");
  assert(reasons.some((r: string) => r.includes("identical to the previous beat")));
  assertEquals(reasons.filter((r: string) => r.includes("too many SHORT_TEXT")).length, beats.filter((b: any) => b.textIntent?.mode === "SHORT_TEXT").length - allowed);
});

Deno.test("motion: the model no longer writes it — code defaults per treatment; CALLBACK copies the plant's motion", async () => {
  const schema: any = buildBeatSchema(index);
  assert(!("m" in schema.properties.b.items.properties) && !schema.properties.b.items.required.includes("m"));
  assert(!directorSystemPrompt(index, bible, callback).includes("MOTION —"));
  assertEquals(normalizeBeat({ s: 0, e: 0, v: "x", t: "STAT_CARD", c: "FLAT_GRAPHIC", f: "card" }).motionIntent.camera, "hold");
  assertEquals(normalizeBeat({ s: 0, e: 0, v: "x", t: "POV", c: "POV", f: "shield rim" }).motionIntent.camera, "slow push-in");
  assertEquals(normalizeBeat({ s: 0, e: 0, v: "x", t: "ESTABLISHING", c: "WIDE", f: "valley" }).motionIntent.camera, "slow pan");
  assertEquals(normalizeBeat({ s: 0, e: 0, v: "x", t: "REACTION", c: "MEDIUM", f: "face" }).motionIntent.camera, "subtle push-in");
  assertEquals(defaultMotion("POV").source, "default");
  // Recorded runs that still carried m/w keep their motion.
  assertEquals(normalizeBeat(run4Out(0)[0]).motionIntent.camera, "camera surges forward");
  const plan = [normalizeBeat({ s: 0, e: 0, v: "horns", t: "POV", c: "CLOSE_UP", f: "horns", motif: "plant" }), normalizeBeat({ s: 1, e: 1, v: "horns again", t: "CALLBACK", c: "CLOSE_UP", f: "horns", motif: "payoff" })];
  plan[0].motionIntent = { camera: "whip pan", subject: "horns glint", environment: "none", weight: "medium", source: "model" };
  copyPlantMotion(plan);
  assertEquals([plan[1].motionIntent.camera, plan[1].motionIntent.source], ["whip pan", "plant"]);
});

Deno.test("run 4 replayed under the final rules: window 1 is ACCEPTED (soft issues -> warnings) where the live run FAILED, and the new wire is smaller", async () => {
  const s = buildWordStream(run4.segments);
  const idx = buildBibleIndex(run4.bible);
  const calls: string[] = [];
  // Window 1's recorded outputs in order: main 0 -> fill 1 -> repair main 2 -> fill 3
  // (fills matched by chunk; rewrites the recording never saw keep their beat).
  const mains = [0, 2];
  const fills = [1, 3];
  const replay: ModelCall = async (req) => {
    const isFill = req.user.includes("NEEDS CONTRACT");
    calls.push(isFill ? "fill" : "main");
    if (!req.user.startsWith("WINDOW 1")) throw new Error("stop after window 1");
    if (!isFill) return { input: { b: run4Out(mains.shift()!) }, usage: USAGE };
    const want = new Set([...req.user.matchAll(/NEEDS CONTRACT C(\d+)\.\./g)].map((m) => Number(m[1])));
    return { input: { b: run4Out(fills.shift()!).filter((b: any) => want.has(b.s)) }, usage: USAGE };
  };
  const res: any = await runBeatDirector({ segments: run4.segments, bible: run4.bible, callback: run4.callback, callModel: replay, shouldYield: () => true });
  assert(res.yielded, JSON.stringify(res.issues ?? res).slice(0, 400));
  // Attempt 0 had real HARD errors (an archetype id used as a prop — the bible fix removes that); the repair is now accepted.
  assertEquals(calls, ["main", "fill", "main", "fill"]);
  const w1 = res.resume.accepted;
  const warns: Record<string, number> = {};
  for (const b of w1) for (const w of b.warnings ?? []) warns[w.code] = (warns[w.code] ?? 0) + 1;
  assert(warns.subject_run > 0, "the live run's failing issue is now a warning");
  console.log(`run 4 window 1 under final rules: ACCEPTED ${w1.length} beats after the one HARD repair (live: FAILED on subject_run) — soft warnings ${JSON.stringify(warns)}`);

  // Output size: the recorded beats re-encoded in the new wire (no m/w, S-number settings).
  const recorded = [0, 1, 2, 3].flatMap((i) => run4Out(i));
  const tokens = [0, 1, 2, 3].reduce((n, i) => n + run4.cassette.entries[i].response.usage.output_tokens, 0);
  const oldChars = recorded.reduce((n: number, b: any) => n + JSON.stringify(b).length, 0);
  const alias = new Map(idx.settings.map((x, i) => [x.id, `S${i + 1}`]));
  const newChars = recorded.reduce((n: number, b: any) => { const { m: _m, w: _w, ...rest } = b; return n + JSON.stringify({ ...rest, ...(b.set ? { set: alias.get(b.set) ?? b.set } : {}) }).length; }, 0);
  const perBeatOld = tokens / recorded.length;
  const perBeatNew = perBeatOld * (newChars / oldChars);
  console.log(`output tokens/beat: recorded ${perBeatOld.toFixed(0)} -> new wire ~${perBeatNew.toFixed(0)} (${Math.round((1 - newChars / oldChars) * 100)}% smaller)`);
  assert(perBeatNew < perBeatOld * 0.85);
});

/* ============================ POLISH: scene idea quality (proved on run 5's real beats) ============================ */

const mvrText = segments.map((s: any) => s.text).join(" ");
const eraBible = { ...bible, roleArchetypes: [{ id: "viewer_viking", role: "the viewer as a Viking raider" }, { id: "viewer_modern", role: "the viewer today" }, { id: "archaeologist", role: "an archaeologist" }] };
const eraIndex = buildBibleIndex(eraBible);
const beatOn = (phrase: string, extra: any) => {
  const at = stream.words.findIndex((_, i) => stream.words.slice(i, i + phrase.split(" ").length).map((w) => w.word).join(" ") === phrase);
  assert(at >= 0, phrase);
  return { startWord: at, endWord: at + phrase.split(" ").length - 1, treatment: "STORY_SCENE", composition: { camera: "MEDIUM", framing: "x" }, subjects: [], propIds: [], textIntent: { mode: "NO_TEXT", text: null }, flags: {}, ...extra };
};

Deno.test("POLISH 1: the script has 'you' lines in two eras; run 5's bible (viewer_viking only) is now rejected", () => {
  const ctx = youContexts(mvrText);
  assertEquals([...ctx.keys()].sort(), ["modern", "past"]);
  const errors = validateBible(recorded.bible, mvrText);
  assert(errors.some((e) => e.startsWith("VIEWER_CONTEXT_MISSING:modern")), errors.join("; "));
  const withModern = { ...recorded.bible, roleArchetypes: [...recorded.bible.roleArchetypes, { id: "viewer_modern", role: "the viewer today", canonicalAppearance: "hoodie, jeans", usedFor: "present-day lines" }] };
  assert(!validateBible(withModern, mvrText).some((e) => e.startsWith("VIEWER_CONTEXT")));
});

Deno.test("POLISH 1: a present-day line with the Viking avatar is flagged, and code swaps in viewer_modern (no model call)", () => {
  const b = beatOn("Next time you see those curving", { subjects: [{ castId: "viewer_viking" }], visualConcept: "Viewer's eye catches curving horns on distant object" });
  assertStringIncludes(wrongEraViewer(b, stream, eraIndex)!, `use "viewer_modern"`);
  assertEquals(fixViewerEras([b], stream, eraIndex), 1);
  assertEquals(b.subjects[0].castId, "viewer_modern");
  const battle = beatOn("You're gripping a shield,", { subjects: [{ castId: "viewer_viking" }], visualConcept: "x" });
  assertEquals(wrongEraViewer(battle, stream, eraIndex), null);
  assertStringIncludes(windowUserPrompt(stream, windows.find((w) => w.chunks.some((c) => c.text.includes("lunchbox")))!, []), "(present day)");
});

Deno.test("POLISH 2-3,5: run 5's real concepts — undeclared text, abstract restatements, ungrounded names, new motion words", () => {
  const codes = (narr: string, v: string, extra: any = {}) => contentIssues({ visualConcept: v, subjects: [], propIds: [], textIntent: { mode: "NO_TEXT", text: null }, ...extra }, narr).map((c) => c.code);
  assert(codes("In 1876, composer Richard Wagner's opera cycle", "Marquee reads Bayreuth 1876, opera house facade at night").includes("undeclared_text"));
  assert(!codes("In 1876, composer Richard Wagner's opera cycle", "Marquee reads Bayreuth 1876, opera house facade at night", { textIntent: { mode: "SHORT_TEXT", text: "Bayreuth, 1876" } }).includes("undeclared_text"));
  // A lone "?" over a head is a drawn symbol, not undeclared text (Phase 4a).
  assert(!codes("So did any Viking ever strap on horns?", "Viewer viking pauses mid-stride, question mark over head").includes("undeclared_text"));
  assert(codes("rewrite an entire culture's history in our heads.", "A single wrong picture rewrites a whole culture's history").includes("abstract_concept"));
  assert(!codes("x", "An archaeologist holds a history book", { subjects: [{ castId: "archaeologist" }] }).includes("abstract_concept"));
  assert(codes("But archaeologists digging across Scandinavia for over a century", "Archaeologist kneels at empty digsite, few helmets found").includes("ungrounded_name"));
  assert(!codes("But archaeologists digging across Scandinavia", "Archaeologist kneels at a dig on a Scandinavian hillside").includes("ungrounded_name"));
  for (const v of ["The wrong picture spreads outward", "priest and Viking raider merge into one blurred silhouette", "Dusty museum basement door swings open", "figure strides through a stage curtain", "A single wrong picture rewrites history"]) assert(conceptNotStill(v), v);
  assertEquals(namedThings("It feels obvious. It's on flags, beer labels, football helmets."), [], "sentence starts and common nouns are not names");
});

Deno.test("POLISH 4: same primary subject max 3 in any 8 beats; balance warnings (cast >= 55%, SYMBOLIC <= 15%, OBJECT_DETAIL <= 20%)", async () => {
  const seq = ["a", null, "a", null, "a", null, "a"].map((id, k) => look(id ? "viking_warrior" : null, k));
  const beats = (await goodWindow()).slice(0, 7).map((b: any, k: number) => ({ ...b, ...seq[k] }));
  const issues = validateWindowBeats(beats, win0, stream, index, null);
  assert(issues.some((i) => i.code === "subject_repeat" && i.beat === 7), JSON.stringify(issues.filter(isSoft).map((i) => `${i.code}@${i.beat}`)));
  assert(!issues.some((i) => i.code === "subject_repeat" && i.beat! < 7));
  const plan = recorded.beats.map((b: any) => ({ ...b, contract: b.contract, warnings: [] }));
  const warn = balanceWarnings(plan).map((w) => w.code);
  assertEquals(warn, ["cast_share_low", "symbolic_share_high", "object_detail_share_high"], "run 5 misses all three");
});

Deno.test("POLISH 6-7: no pairing hints in the first 30 s; maxWindows directs a partial plan (check runs) without coverage failures", async () => {
  const p = windowUserPrompt(stream, win0, []);
  const hookLines = p.split("\n").filter((l) => /^C\d+ \[(\d+\.\d)s/.test(l) && Number(l.match(/^C\d+ \[(\d+\.\d)s/)![1]) < 30);
  assert(hookLines.length > 3 && hookLines.every((l) => !l.includes("pairs to")));
  const res: any = await runBeatDirector({ segments, bible, callback, callModel: stubDirector, maxWindows: 1 });
  assert(res.ok, JSON.stringify(res.issues?.slice(0, 2)));
  assertEquals([res.stats.partial, res.stats.windowsDirected], [true, 1]);
  assertEquals(res.beats.at(-1).endWord, win0.endWord);
});

Deno.test("cost cap near: soft rewrites are dropped from the fill (kept as warnings) instead of failing the run", async () => {
  const morphing: ModelCall = async (req) => {
    const r = await stubDirector(req);
    if (!req.user.includes("NEEDS CONTRACT")) for (const b of r.input.beats) b.visualConcept = "a helmet morphs into a costume";
    return r;
  };
  const res: any = await runBeatDirector({ segments, bible, callback, callModel: morphing, maxWindows: 1, maxCostUsd: 0.06, costOf: (u: any) => u.calls * 0.04 });
  assert(res.ok, JSON.stringify(res.issues?.slice(0, 2)));
  assert(res.stats.rewritesDropped > 0);
  assert(res.stats.softWarnings.concept_not_still >= res.stats.rewritesDropped);
});

Deno.test("bible: classification checks are SOFT (warn after the repair, never 422); structural ones stay HARD", () => {
  for (const e of ["ARCHETYPE_NOT_A_PERSON:x (\"a prop\") — move", "VIEWER_DUPLICATED_AS_HERO — the viewer", "VIEWER_ERA_UNCLEAR:modern — x"]) assert(isSoftBibleError(e), e);
  for (const e of ["VIEWER_CONTEXT_MISSING:modern — x", "VIEWER_AVATAR_MISSING — x", "NO_CAST_FOR_SCRIPT_WITH_PEOPLE — x", "DUPLICATE_ID:viewer_viking", "ROLE_ARCHETYPE_MISSING_APPEARANCE:x", "EMPTY_VISUAL_PREMISE"]) assert(!isSoftBibleError(e), e);
  // Two era avatars whose labels don't read as "modern": a label problem (SOFT), not a missing avatar (HARD).
  const two = { ...recorded.bible, roleArchetypes: [...recorded.bible.roleArchetypes, { id: "viewer_2026", role: "the viewer in a hoodie", canonicalAppearance: "hoodie", usedFor: "x" }] };
  const errs = validateBible(two, mvrText);
  assert(errs.some((e) => e.startsWith("VIEWER_ERA_UNCLEAR:modern")) && !errs.some((e) => e.startsWith("VIEWER_CONTEXT_MISSING")), errs.join("; "));
  const dup = { ...recorded.bible, roleArchetypes: [...recorded.bible.roleArchetypes, recorded.bible.roleArchetypes[0]] };
  assert(validateBible(dup).some((e) => e.startsWith("DUPLICATE_ID:")));
});

/* ============================ Phase 2b: review fixes, re-timing, real timing by default ============================ */

const polishW1 = JSON.parse(await Deno.readTextFile(new URL("../fixtures/stickman/beats/myth-vs-reality.polish-w1.json", import.meta.url)));
const w1Beat = (n: number) => polishW1.beats[n - 1];
const w1Stream = buildWordStream(polishW1.segments);
const w1Index = buildBibleIndex(polishW1.bible);
const asBeat = (n: number) => ({ ...w1Beat(n).contract, startWord: w1Beat(n).startWord, endWord: w1Beat(n).endWord });

Deno.test("2b-0: listed nouns must be shown — window-1 beat 15 ('flags, beer labels, football helmets' -> a shrug) is flagged", () => {
  assertEquals(listedNouns("It feels obvious. It's on flags, beer labels, football helmets."), ["flags", "labels", "helmets"]);
  assertEquals(listedNouns("horns on a lunchbox or a mascot,"), ["lunchbox", "mascot"]);
  assertEquals(listedNouns("dug out of a burial mound in Norway in 1943,"), [], "no list, no flag");
  assertEquals(listedNouns("the horns curving up from the sides like a bull's."), []);
  assert(contentIssues(asBeat(15), w1Beat(15).narrationText).some((c) => c.code === "ungrounded_list"));
  assert(!contentIssues({ ...asBeat(15), visualConcept: "A flag, a beer bottle label and a football helmet, each with horns" }, w1Beat(15).narrationText).some((c) => c.code === "ungrounded_list"));
});

Deno.test("2b-0: 'you' lines need the matching viewer; a CROWD needs a group — window-1 beats 8 and 12", () => {
  // Beat 8 "This is the image burned into your head." showed only an archaeologist.
  assertStringIncludes(missingViewer(asBeat(8), w1Stream, w1Index)!, "include \"viewer_");
  // Beat 30 "Why trust one helmet?" has no "you" -> no requirement; beat 26 already shows viewer_modern.
  assertEquals(missingViewer(asBeat(26), w1Stream, w1Index), null);
  // Present-day "you" line wants viewer_modern specifically.
  const lunch = beatOn("Next time you see those curving", { subjects: [{ castId: "archaeologist" }], visualConcept: "x" });
  assertStringIncludes(missingViewer(lunch, stream, eraIndex)!, "\"viewer_modern\"");
  // Beat 12: CROWD with only viewer_viking.
  assert(contentIssues(asBeat(12), w1Beat(12).narrationText).some((c) => c.code === "crowd_without_group"));
  assert(!contentIssues({ ...asBeat(12), subjects: [{ castId: "viking_warrior_archetype" }] }, "x").some((c) => c.code === "crowd_without_group"));
});

Deno.test("2b-0: hook — a multi-chunk beat starting in the first 30 s is split into single chunks (HOLD exempt, re-timing opt-out)", () => {
  // A legal pair (<= 6 s, both chunks >= 1.8 s) inside the first 30 s.
  const k = win0.chunks.findIndex((c, i) => { const n = win0.chunks[i + 1]; return n && c.startMs < 25_000 && n.endMs - c.startMs <= 6000 && c.endMs - c.startMs >= 1800 && n.endMs - n.startMs >= 1800; });
  assert(k >= 0);
  const pair = { ...win0, chunks: win0.chunks.slice(k, k + 2) };
  const two = chunkRangesToWords([{ startChunk: pair.chunks[0].index, endChunk: pair.chunks[1].index, ...contract(0) }], pair).beats.map(normalizeBeat);
  const res = autoSplitBeats(two, pair, stream);
  assertEquals(res.beats.map((b: any) => [b.startChunk, b.endChunk]), pair.chunks.map((c) => [c.index, c.index]));
  assertEquals(res.needFill, [1], "the split-off chunk needs a fresh concept");
  assertEquals(autoSplitBeats(two, pair, stream, { hookSingleChunk: false }).beats.length, 1);
});

// A stand-in "real" narration: synthetic timings stretched per segment (the
// real ElevenLabs fixture replaces this once it exists).
function fakeNarration(segs: { id: string; text: string }[], stretch: (segIndex: number) => number) {
  const words = syntheticTimings(segs);
  let offset = 0;
  return segs.map((s, k) => {
    const ws = words.filter((w) => w.segmentId === s.id);
    const f = stretch(k);
    const base = ws[0].startMs;
    const out = ws.map((w) => ({ word: w.word, start: (offset + (w.startMs - base) * f) / 1000, end: (offset + (w.endMs - base) * f) / 1000 }));
    offset = out[out.length - 1].end * 1000 + 300;
    return { segmentId: s.id, startSeconds: out[0].start, endSeconds: out[out.length - 1].end, words: out };
  });
}

Deno.test("2b-4: real timings are the default when a narration covers the script; synthetic only as a recorded fallback", () => {
  const narr = fakeNarration(segments, () => 1.1);
  const real = buildWordStream(segments, narr);
  assertEquals([real.timingSource, real.timingNote], ["real", undefined]);
  assert(real.words.at(-1)!.endMs > stream.words.at(-1)!.endMs, "stretched timings are used");
  const partial = buildWordStream(segments, narr.slice(1));
  assertEquals([partial.timingSource, partial.timingNote], ["synthetic", "NARRATION_DOES_NOT_COVER_SCRIPT"]);
  assertEquals(buildWordStream(segments, null).timingNote, undefined);
});

Deno.test("2b-3: re-timing keeps word ranges, reports drift, and fixes out-of-bounds beats by code (split parts -> needsConcept)", () => {
  // Slow segment 3 way down so some beats exceed 6.5 s; speed segment 5 up so some drop under 1.8 s.
  const narr = fakeNarration(recorded.segments, (k) => (k === 2 ? 1.9 : k === 4 ? 0.45 : 1));
  const r = retimePlan(recorded.beats, recorded.segments, narr);
  assert(r.outOfBounds.length > 0);
  assert(r.stats.splits > 0 && r.stats.needsConcept > 0);
  // Anything still over 6.5 s is a single chunk (no chunk boundary to split at) — reported, not hidden.
  const over = r.stats.stillOutOfBounds.filter((n: number) => r.beats[n - 1].durationMs > 6500);
  assert(over.every((n: number) => r.beats[n - 1].contract.chunkRange[0] === r.beats[n - 1].contract.chunkRange[1]), JSON.stringify(over));
  assertEquals(r.beats.map((b) => b.narrationText).join(" "), buildWordStream(recorded.segments).scriptText, "exact text, full coverage");
  assert(r.beats.filter((b) => b.contract.needsConcept).every((b) => typeof b.contract.conceptFrom === "string"));
  // Partial plans (window 1) re-time too.
  const w = retimePlan(polishW1.beats, polishW1.segments, fakeNarration(polishW1.segments, () => 1));
  assertEquals(w.beats.at(-1)!.endWord, polishW1.beats.at(-1).endWord);
});

const narrationFixture = (() => { try { return JSON.parse(Deno.readTextFileSync(new URL("../fixtures/stickman/audio/myth-vs-reality/narration.json", import.meta.url))); } catch { return null; } })();
Deno.test({
  name: "2b-3: the REAL narration fixture re-times the frozen plan (runs once the one ElevenLabs narration exists)",
  ignore: !narrationFixture,
  fn: () => {
    const r = retimePlan(recorded.beats, recorded.segments, narrationFixture);
    assertEquals(buildWordStream(recorded.segments, narrationFixture).timingSource, "real");
    assertEquals(r.beats.map((b) => b.narrationText).join(" "), buildWordStream(recorded.segments).scriptText);
  },
});

/* ============================ Phase 2c: measured voice pace + real-timing chunks ============================ */

Deno.test("2c: voice pace — measured (voice, model, speed) rows win; unmeasured voices fall back to 145 and say so", () => {
  const josh = { voiceId: "TxGEqnHWrfWFTfGW9XjX", voiceModel: "eleven_flash_v2_5" };
  assertEquals(wordsPerMinuteFor({ ...josh, speed: 0.92 }), { wordsPerMinute: 119, calibrated: true, source: VOICE_CALIBRATIONS[0].source });
  assertEquals(wordsPerMinuteFor({ ...josh, speed: 1.0 }).wordsPerMinute, 146.6);
  assertEquals(wordsPerMinuteFor(josh).wordsPerMinute, 146.6, "default speed is 1.0");
  assertEquals(DEFAULT_NARRATION_SPEED, 1.0);
  for (const v of UNCALIBRATED_VOICES) assertEquals(wordsPerMinuteFor({ voiceId: v.voiceId, voiceModel: "eleven_flash_v2_5", speed: 1 }), { wordsPerMinute: 145, calibrated: false, source: "fallback WORDS_PER_MINUTE" });
  assertEquals(wordsPerMinuteFor({ ...josh, speed: 1.1 }).calibrated, false, "unmeasured speed of a measured voice is NOT guessed");
  assertEquals(wordsPerMinuteForProfile({ voice_id: josh.voiceId, voice_model: josh.voiceModel, voice_settings: null }).wordsPerMinute, 146.6);
  assertEquals(wordsPerMinuteForProfile({ voice_id: josh.voiceId, voice_model: josh.voiceModel, voice_settings: { speed: 0.92 } }).wordsPerMinute, 119);
});

Deno.test("2c: measuredWpm reproduces the fixtures (full narration 119 at 0.92, sample 146.6 at 1.0)", async () => {
  const words = JSON.parse(await Deno.readTextFile(new URL("../fixtures/stickman/audio/myth-vs-reality/words.json", import.meta.url)));
  assertEquals(Math.round(measuredWpm(words.map((w: any) => ({ start: w.startMs / 1000, end: w.endMs / 1000 })))), 119);
  const sampleDir = new URL("../fixtures/stickman/audio/pace-samples/josh-flash_v2_5-speed-1.00/", import.meta.url);
  const alignment = JSON.parse(await Deno.readTextFile(new URL("alignment.raw.json", sampleDir)));
  const meta = JSON.parse(await Deno.readTextFile(new URL("meta.json", sampleDir)));
  assertEquals(measuredWpm(alignmentToWords(alignment)), meta.wpm);
  assertEquals(meta.wpm, 146.6);
});

Deno.test("2c: UI length estimate and synthetic timings use the selected voice's pace", () => {
  assertEquals(estimateForLength(10).estimatedWords, 1450, "fallback 145");
  assertEquals(estimateForLength(10, 146.6).estimatedWords, 1466);
  assertEquals(estimateForLength(10, 119).estimatedWords, 1190);
  const slow = syntheticTimings(segments, 119).at(-1)!.endMs;
  const fast = syntheticTimings(segments, 146.6).at(-1)!.endMs;
  assert(slow > fast * 1.15, `${slow} vs ${fast}`);
  assertEquals(buildWordStream(segments, null, 119).words.at(-1)!.endMs, slow);
});

const realNarration = JSON.parse(await Deno.readTextFile(new URL("../fixtures/stickman/audio/myth-vs-reality/narration.json", import.meta.url)));

Deno.test("2c: with real timings the chunker cuts by measured duration — no chunk over 6.5 s, ranges/names/dates never split", () => {
  const real = buildWordStream(recorded.segments, realNarration);
  const chunks = chunkWindows(real, planWindows(real)).flatMap((w) => w.chunks);
  assertEquals(chunks.map((c) => c.text).join(" "), real.scriptText);
  assertEquals(chunks.filter((c) => c.endMs - c.startMs > 6500).map((c) => c.text), []);
  const has = (t: string) => chunks.some((c) => c.text.includes(t));
  for (const t of ["793 to 1066", "900 to 1100 BCE", "Alex Raymond", "Flash Gordon", "Roberta Frank", "Old Norse"]) assert(has(t), t);
  // Extra split words: "In 1939, cartoonist Alex Raymond drew the horned warrior in his Flash Gordon comics."
  assert(chunks.some((c) => c.text === "in his Flash Gordon comics."), chunks.filter((c) => c.text.includes("Flash")).map((c) => c.text).join(" | "));
  // Synthetic chunking is unchanged (recorded runs keep their chunk indices).
  assertEquals(chunkWindows(buildWordStream(recorded.segments), planWindows(buildWordStream(recorded.segments))).flatMap((w) => w.chunks).length, 142);
});

Deno.test("2c: re-timing on real chunk boundaries leaves NO beat out of bounds on the frozen plan (14 split -> needsConcept)", () => {
  const r = retimePlan(recorded.beats, recorded.segments, realNarration);
  assertEquals(r.stats.stillOutOfBounds, []);
  assertEquals(r.stats.realChunksOver6500, []);
  assert(r.stats.needsConcept >= r.outOfBounds.length - 2);
  const old = retimePlan(recorded.beats, recorded.segments, realNarration, { boundaries: "plan" });
  assert(old.stats.stillOutOfBounds.length > 0, "the plan's own synthetic boundaries could not fix everything");
});
