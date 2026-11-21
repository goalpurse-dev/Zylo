// In This Town, 2026-11-21 fixes after two live failures (28f2be8b VOICE_CUT, 2120c23d DIRECTOR_FAILED). Free: no paid
// call (ElevenLabs is faked with local ffmpeg tones), no Blender, no model.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const { chunkLines, chunkedVoice, chunkEndProblem, CHUNK } = await import("../scripts/blockyWorlds/studio/voiceChunks.mjs");
const { visionRuleProblems, isCreature, creatureTease } = await import("../scripts/blockyWorlds/blenderKit/director.mjs");
const { thrownError } = await import("../scripts/blockyWorlds/blenderKit/workerSteps.mjs");

// the 28f2be8b script's shape: 25 lines, 1,227 characters
const LINES = [
  ["rule", "And I just paid for my whole town's bread, power and hammers."], ["rule", "You see, in this town, everybody goes to work every single day."],
  ["tour", "Kevin gets up at four and bakes rolls at the bakery."], ["tour", "Linda sits in her office all day, typing numbers."], ["tour", "Even my grandma works. She fixes roofs, high above the street."],
  ["hero", "Except me. I stay in bed and build my online business."], ["hero", "Mom shouted, go to work already!"], ["hero", "I said, Mom, I've been working for three hours."],
  ["hero", "She said a bed does not count as an office."], ["hero", "Then she pulled the plug on my wifi."], ["hero", "So I kept going on Grandma's phone."],
  ["hero", "Grandma never noticed, because she was up on the roof."], ["turn", "One week later, the whole town ran out of money."], ["turn", "The bakery had no flour. Kevin stared into empty sacks."],
  ["turn", "The office had no power. Linda's screen went black."], ["turn", "Grandma was hammering a roof with a spoon."], ["turn", "The mayor stood in the plaza and shouted, who can pay for this?"],
  ["climax", "I got out of bed for the first time since Tuesday."], ["climax", "I paid for the flour, the power and a new hammer for Grandma."], ["climax", "The mayor gave me a medal. Kevin cried."],
  ["climax", "Linda asked how I did it. I told her my secret."], ["closer", "Now everyone in town uses it. Nobody bakes, types or fixes roofs."], ["closer", "And now I'm the only one who goes to work every day."],
  ["closer", "Because nobody is baking the bread anymore."],
].map(([part, text]) => ({ part, text }));

test("chunks: whole lines, in order, ~400 characters, every line once", () => {
  const ch = chunkLines(LINES);
  assert.deepEqual(ch.flat(), LINES.map((_, i) => i));
  assert.ok(ch.length >= 3 && ch.length <= 5, `${ch.length} chunks`);
  for (const c of ch) assert.ok(c.map((i) => LINES[i].text).join("\n").length <= CHUNK.maxChars || c.length === 1);
  // one very long line stays alone; empty lines are skipped
  assert.deepEqual(chunkLines([{ text: "x".repeat(600) }, { text: "" }, { text: "short" }]), [[0], [2]]);
});

// a fake take: a tone as long as the words, the alignment of every word (cut = the last words squeezed at the end, silent)
function fakeTake(dir, text, { cut = false } = {}) {
  const words = text.split(/\s+/).filter(Boolean);
  const per = 0.3, speak = words.length * per;
  const total = cut ? speak * 0.7 : speak + 0.2;
  const f = path.join(dir, `tone_${Math.random().toString(36).slice(2)}.mp3`);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", `sine=frequency=330:sample_rate=44100:duration=${total.toFixed(3)}`, "-ac", "1", "-c:a", "libmp3lame", "-b:a", "128k", f]);
  const spoken = words.map((w, i) => {
    if (cut && i >= words.length - 2) return { w, s: +(total - 0.001).toFixed(3), e: +(total - 0.001).toFixed(3) };
    return { w, s: +(i * per).toFixed(3), e: +(i * per + per * 0.8).toFixed(3) };
  });
  return { audioBase64: fs.readFileSync(f).toString("base64"), spoken, costUsd: +(text.length * 0.0002 * 0.44).toFixed(5) };
}

test("the chunked voice: a cut chunk is made again ALONE, eleven_v3 once more then multilingual v2; never a failure; joined with gaps", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "itt-voice-"));
  const narrator = { model: "eleven_v3", voiceId: "8VJBrRk4O7tFoB5kqxa6", voiceName: "Scruffy Duck", outputFormat: "mp3_44100_128", settings: {} };
  const groups = chunkLines(LINES);
  const lastChunk = groups.at(-1).map((i) => LINES[i].text).join("\n");
  const calls = [];
  // the last chunk (the one with the story's ending) comes out cut on eleven_v3 every time, fine on v2
  const synth = async ({ text, narrator: n }) => { calls.push({ model: n.model, last: text === lastChunk }); return fakeTake(dir, text, { cut: text === lastChunk && n.model === "eleven_v3" }); };
  const checks = [], booked = [], logs = [];
  const r = await chunkedVoice({ lines: LINES, outDir: dir, apiKey: "k", narrator, synth, check: (u) => checks.push(u), book: (u) => booked.push(u), log: (m) => logs.push(m) });
  // every chunk once, the cut one 2x on v3 + 1x on v2 (alone: no other chunk was made again)
  assert.equal(calls.filter((c) => !c.last).length, groups.length - 1);
  assert.deepEqual(calls.filter((c) => c.last).map((c) => c.model), ["eleven_v3", "eleven_v3", "eleven_multilingual_v2"]);
  assert.equal(r.fallbacks, 1);
  assert.equal(r.retakes, 2);
  assert.equal(r.cut, 0);
  assert.equal(checks.length, calls.length);         // the caps checked before every paid call
  assert.equal(booked.length, calls.length);         // and every call booked
  assert.ok(logs.some((m) => /cut on eleven_v3/.test(m)));
  // the one-take format for pace.mjs: take.json + voice.mp3, every word, timings in order, inside the audio
  const take = JSON.parse(fs.readFileSync(path.join(dir, "take.json"), "utf8"));
  const nWords = LINES.map((l) => l.text).join(" ").split(/\s+/).length;
  assert.equal(take.spoken.length, nWords);
  for (let i = 1; i < take.spoken.length; i++) assert.ok(take.spoken[i].s >= take.spoken[i - 1].s, `word ${i} in order`);
  const dur = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path.join(dir, "voice.mp3")]).toString());
  assert.ok(take.spoken.at(-1).e <= dur + 0.06, `last word ${take.spoken.at(-1).e} inside ${dur}`);
  assert.ok(take.spoken.at(-1).e - take.spoken.at(-1).s > 0.1, "the last word has a real length");
  // the real pace step runs on it unchanged
  const { processTake } = await import("../scripts/blockyWorlds/studio/pace.mjs");
  const v = await processTake({ outDir: dir });
  assert.equal(v.words.length, nWords);
  assert.ok(v.duration > 5);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("the chunked voice: every try cut -> the least-cut take is used, never a throw; every call failing -> VOICE_FAILED", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "itt-voice-"));
  const narrator = { model: "eleven_v3", voiceId: "8VJBrRk4O7tFoB5kqxa6", voiceName: "Scruffy Duck", outputFormat: "mp3_44100_128", settings: {} };
  const lines = LINES.slice(0, 3);
  const r = await chunkedVoice({ lines, outDir: dir, apiKey: "k", narrator, synth: async ({ text }) => fakeTake(dir, text, { cut: true }) });
  assert.equal(r.cut, 1);
  assert.equal(r.chunks[0].tries.length, 4);
  assert.ok(fs.existsSync(path.join(dir, "voice.mp3")));
  await assert.rejects(chunkedVoice({ lines, outDir: dir, apiKey: "k", narrator, synth: async () => { throw new Error("VOICE_FAILED: 503"); } }), (e) => e.code === "VOICE_FAILED");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("the chunk end check catches the live cut (the last words squeezed into the end, zero length)", () => {
  const words = [{ w: "Because", s: 0, e: 0.3 }, { w: "nobody", s: 0.35, e: 0.6 }, { w: "baking", s: 1.0, e: 1.0 }, { w: "anymore.", s: 1.0, e: 1.0 }];
  assert.match(chunkEndProblem({ words, duration: 1.0 }), /no length/);
  assert.equal(chunkEndProblem({ words: [{ w: "Hi", s: 0, e: 0.3 }, { w: "there.", s: 0.35, e: 0.7 }], duration: 0.9 }), null);
});

// run 2120c23d's style sheet (the monster) and the shots the checker failed on "Monster named but not clearly visible"
const SHEET = [{ name: "Pip", role: "narrator", hero: true }, { name: "Mr. Harlow", role: "baker" }, { name: "Monster", role: "monster", outfit: "tall pale grey block figure, blank smooth head" }];

test("the monster rule FIXES, never fails: a hinted monster is not asked to fill the frame; a missed one is a CREATURE note", () => {
  const shots = [
    { id: 7, desc: "Mr. Harlow with his loaf in the BAKERY at midnight, moon in the window, Pip peeking, a faceless monster outside" },
    { id: 29, desc: "Pip frozen, face up close, faceless monster shadow" },
    { id: 48, desc: "A monster stopped right at the chalk line, Pip watching" },
    { id: 49, desc: "The monster tilts its head at Pip" },
    { id: 33, desc: "Mr. Harlow at the bakery door" },
  ];
  const answers = [
    { id: 7, people: ["Pip", "Mr. Harlow"] }, { id: 29, people: ["Pip"] },
    { id: 48, people: ["Pip"] },                       // the monster is not read: a CREATURE note
    { id: 49, people: ["Pip", "tall pale faceless figure"] }, // the checker's own words for the monster count as seen
    { id: 33, people: [] },                            // a person missing stays a real problem
  ];
  const out = visionRuleProblems({ shots, answers, styleSheet: SHEET });
  assert.equal(out[7], undefined);
  assert.equal(out[29], undefined);
  assert.match(out[48], /^CREATURE: Monster named but not readable: re-aim/);
  assert.equal(out[49], undefined);
  assert.match(out[33], /Mr\. Harlow named but not clearly visible/);
  assert.equal(isCreature(SHEET[2]), true);
  assert.equal(isCreature(SHEET[1]), false);
  assert.equal(isCreature({ name: "Gus", role: "narrator", hero: true }), false);
  assert.equal(creatureTease("Pip at the window, faceless monster silhouette on the lawn"), true);
  assert.equal(creatureTease("The monster tilts its head"), false);
});

test("a shot body with a flush first line (fix test b2f15139) is assembled valid; a syntax error belongs to its shot, never the header", async () => {
  const { assemble, shotAtLine } = await import("../scripts/blockyWorlds/blenderKit/director.mjs");
  const body = "I = zw_build('downtown_plaza', t0, t1, ZW_STORY_DRESS)\n    H = hero_c(t0, t1, 'joy')\n    if H:\n        H.pose(t0)\n    cam = Cam()";
  const text = assemble({ title: "t", header: "def hero_c(a, b, c):\n    return None", shots: [{ id: 1, w0: 0, w1: 3, desc: "d" }], bodies: { 1: body }, slug: "s" });
  const def = text.split("\n").findIndex((l) => l.startsWith("def s01("));
  assert.deepEqual(text.split("\n").slice(def + 1, def + 6), ["    I = zw_build('downtown_plaza', t0, t1, ZW_STORY_DRESS)", "    H = hero_c(t0, t1, 'joy')", "    if H:", "        H.pose(t0)", "    cam = Cam()"]);
  // a body that opens a block on its first line keeps its indent as it is
  const block = assemble({ title: "t", header: "", shots: [{ id: 2, w0: 0, w1: 1, desc: "d" }], bodies: { 2: "for i in range(2):\n    pass" }, slug: "s" });
  assert.ok(block.includes("    for i in range(2):\n        pass"));
  assert.equal(shotAtLine(text, def + 3), 1);
  assert.equal(shotAtLine(text, 3), null);
});

test("the worker keeps the pipeline's real error (2120c23d said only 'the director wrote no cut')", () => {
  const err = "file:///app/pipeline.mjs:634\n  if (!g.ok) throw ...\n\nError: the rules block the final: only 41% of the shots pass: stopped before the final render\n    at file:///app/pipeline.mjs:634:21 {\n  code: 'RULES'\n}\n\nNode.js v22";
  assert.match(thrownError(err), /^the rules block the final: only 41%/);
  assert.equal(thrownError("just some warning"), null);
});
