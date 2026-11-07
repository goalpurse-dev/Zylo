// node --test dev/storyPatterns.test.mjs   (STORY-PATTERNS 2026-11-07: the story + continuity layer: shotlib/story.mjs
// free stats, guarded paid run with a FAKE provider, lib/storyPatterns.js prompt block + plan check). No paid calls.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { storyReport, storyPatternsForPrompt, loadStoryPatterns, roleOfShot, DEFAULT_PATTERNS, BEATS, SEQ_ROLES, CATEGORY_ROLE } from "../lib/storyPatterns.js";
import { segmentBeats, computeStats, aggregate, placeholderPatterns, fixtureDescriptions, namesIn, scrubNames, runPaid, requestPrice, analysisPrompt, analysisSchema, synthSchema, writePatternsFile, quant, MODELS, STORY_VERSION } from "../../shotlib/story.mjs";
import { LIBRARY_CATEGORIES } from "../../shotlib/describe.mjs";
import { DIRECTOR_SYSTEM } from "../lib/director/design.js";
import { planVideo, estimateWords } from "../plan.mjs";
import { directStory } from "../lib/director/index.js";

const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// a small reference-like video: 14 lines over 42 s, 3 shots a line, one named neighbour ("Bramble")
const TEXTS = [
  "In this town, everyone lives on the back of a giant turtle.", "You see, the turtle never stops walking.", "Old Bramble sells bread from a shell plate.",
  "The kids ride the tail to school.", "But me, I'm the only one who can hear it.", "My dad says it's just the wind.",
  "Until one night, the turtle stopped.", "Something huge rose out of the sea.", "Everyone ran to the shell edge.",
  "That's when I found out the turtle was scared.", "So I grabbed my whistle and climbed to its head.", "I blew as hard as I could.",
  "The monster sank back into the dark.", "Now the turtle walks, and I still keep my whistle.",
];
export function fixtureVideo(id = "v1") {
  const lines = TEXTS.map((text, i) => ({ n: i + 1, t0: i * 3, t1: i * 3 + 3, text }));
  const shots = [];
  for (let i = 0; i < lines.length * 3; i++) shots.push({ n: i + 1, t0: i, t1: i + 1, dur: 1, move: { family: i % 2 ? "push_in" : "track" }, lines: [Math.floor(i / 3) + 1] });
  return { id, sh: { version: 2, video: id, duration: 42, shots, lines } };
}

test("segmentBeats: beat words in order, shares where the words are missing, every line in exactly one beat", () => {
  const { sh } = fixtureVideo();
  const b = segmentBeats(sh.lines, sh.duration);
  assert.deepEqual(b.map((x) => x.beat), BEATS);
  const at = Object.fromEntries(b.map((x) => [x.beat, x]));
  assert.equal(at.me.from, 4); assert.equal(at.me.method, "words");
  assert.equal(at.until.from, 6); assert.equal(at.discovery.from, 9); assert.equal(at.climax.from, 10); assert.equal(at.closer.from, 13);
  let covered = 0; for (const x of b) covered += x.to - x.from;
  assert.equal(covered, sh.lines.length);
  const plain = segmentBeats(sh.lines.map((l) => ({ ...l, text: "Words." })), 42);
  assert.ok(plain.slice(2).every((x) => x.method === "share") && plain.at(-1).to === 14, "no beat words: shares on the time line");
  assert.deepEqual(segmentBeats([]), []);
});

test("computeStats: free stats without descriptions (pace per beat), full story stats with fixture descriptions", () => {
  const v = fixtureVideo();
  const s0 = computeStats(v);
  assert.equal(s0.hasDescriptions, false);
  assert.ok(s0.perBeat.tour.meanShot === 1 && !("establish" in s0));
  const desc = fixtureDescriptions(v.sh);
  // the fixture follows describe.mjs's schema (every category is a library category with a role)
  for (const d of Object.values(desc.shots)) { assert.ok(LIBRARY_CATEGORIES.includes(d.libraryCategory)); assert.ok(SEQ_ROLES.includes(CATEGORY_ROLE[d.libraryCategory])); }
  // force a clear story: anchor wides at 0, 10, 20, 30 s; a kid on screen on first-person lines
  for (const n of [1, 11, 21, 31]) Object.assign(desc.shots[n], { distance: "extreme_wide", who: "creature_only", libraryCategory: "establishing" });
  Object.assign(desc.shots[13], { who: "people_only", subject: "a kid in a red hoodie", action: "listens at the shell" });
  const s = computeStats({ ...v, desc });
  assert.equal(s.described, 42);
  assert.equal(s.establish.shotsToWide, 1);
  assert.equal(s.wides.count >= 4, true);
  assert.ok(s.wides.maxGapSec <= 12);
  assert.ok(s.characters.narrator.onScreenShots >= 1, "a kid on a first-person line is the narrator on screen");
  assert.ok(s.characters.roles.find((r) => r.role === "kid").cues.includes("red"));
  assert.ok(Array.isArray(s.sequences.trigrams) && s.arc.length >= 5);
  // the stats are numbers + generic labels: no line text in them
  assert.ok(!JSON.stringify(s).includes("Bramble"));
});

test("aggregate + placeholderPatterns: measured ranges and support counts; no reference text", () => {
  const vids = ["a", "b", "c"].map((id, k) => { const v = fixtureVideo(id); return computeStats({ ...v, desc: fixtureDescriptions(v.sh, k + 1) }); });
  const m = aggregate(vids);
  assert.equal(m.described, 3);
  assert.ok(m.perBeat.climax.meanShot.p50 === 1 && m.perBeat.climax.creatureShare);
  assert.ok(m.sequences.overall.every((x) => x.support >= 1 && x.support <= 3));
  const P = placeholderPatterns(m);
  assert.ok(P.recurringWide.everySecMax >= 6 && P.arc.length === 7);
  assert.ok(P.beatTemplates.every((t) => BEATS.includes(t.beat) && t.sequence.every((r) => SEQ_ROLES.includes(r))));
  const none = placeholderPatterns(aggregate([computeStats(fixtureVideo())]));
  assert.ok(/defaults until the shot descriptions/.test(none.note));
  assert.deepEqual(quant([3, 1, 2]), { p10: 1.2, p25: 1.5, p50: 2, p75: 2.5, p90: 2.8, n: 3 });
});

test("names guard: names found in transcripts are scrubbed; the patterns file refuses to be written with a leak", () => {
  const names = namesIn(TEXTS);
  assert.ok(names.includes("Bramble") && !names.includes("Until") && !names.includes("I"));
  const { value, leaks } = scrubNames({ a: ["Bramble sells bread", { b: "a neighbour" }] }, names);
  assert.equal(leaks, 1); assert.equal(value.a[0], "[name] sells bread");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "story-"));
  const file = path.join(dir, "p.json");
  assert.equal(writePatternsFile({ measured: {}, patterns: { characters: [{ rule: "Bramble returns" }] }, source: "t", names, file }).written, false);
  assert.ok(!fs.existsSync(file));
  assert.equal(writePatternsFile({ measured: {}, patterns: { characters: [{ rule: "the neighbour returns" }] }, source: "t", names, file }).written, true);
  assert.equal(loadStoryPatterns({ file }).patterns.characters[0].rule, "the neighbour returns");
});

test("runPaid (FAKE provider): guarded, incremental, stops at the cap and on the first failure, scrubs names", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "story-"));
  const patternsFile = path.join(dir, "storyPatterns.json");
  const mk = (id) => { const v = fixtureVideo(id); fs.mkdirSync(path.join(dir, id)); return { ...v, dir: path.join(dir, id), desc: fixtureDescriptions(v.sh) }; };
  const videos = [mk("a"), mk("b"), { ...fixtureVideo("c"), desc: null }];   // c: descriptions not done
  const calls = [];
  const answer = { worldEstablishing: { how: "Bramble's bakery wide", shotsUntilClear: 2, firstRoles: ["establish"] }, patterns: ["wide, then a reaction"] };
  const fake = { call: async (req) => { calls.push(req); return req.schema === undefined ? null : { data: req.model && req.system.includes("merge") ? { recurringWide: { rule: "a wide every 10 s", everySecMin: 8, everySecMax: 12, support: 2 } } : answer, costUsd: 0.001 }; } };
  await assert.rejects(runPaid({ videos, provider: fake, maxUsd: 0, dir, patternsFile, log: () => {} }));
  const log = [];
  const r = await runPaid({ videos, provider: fake, maxUsd: 1, names: namesIn(TEXTS), dir, patternsFile, log: (x) => log.push(x), allowPartial: false });
  assert.equal(r.analysed, 2);
  assert.ok(log.some((l) => /skip c: shot descriptions not complete/.test(l)));
  const saved = JSON.parse(fs.readFileSync(path.join(dir, "a", "story-analysis.json"), "utf8"));
  assert.equal(saved.version, STORY_VERSION); assert.equal(saved.scrubbedNames, 1);
  assert.ok(saved.analysis.worldEstablishing.how.startsWith("[name]"));
  assert.ok(calls.every((c) => c.model === MODELS.haiku && c.maxTokens > 0 && c.schema));
  assert.ok(/synthesis waits: 1 video/.test(log.join("\n")), "the synthesis waits for every analysis");
  // incremental: a second run analyses nothing; --allow-partial synthesises into the patterns file
  calls.length = 0;
  const r2 = await runPaid({ videos, provider: fake, maxUsd: 1, names: namesIn(TEXTS), dir, patternsFile, log: () => {}, allowPartial: true, synthModel: MODELS.haiku });
  assert.equal(calls.filter((c) => c.system.includes("You study ONE")).length, 1, "only c (partial) is analysed now");
  assert.ok(r2.synthesised);
  const pf = JSON.parse(fs.readFileSync(patternsFile, "utf8"));
  assert.ok(/synthesis/.test(pf.source) && pf.patterns.recurringWide.everySecMax === 12);
  // the cap: the worst case of the next request is checked BEFORE it is sent
  const v2 = [mk("d")];
  const r3 = await runPaid({ videos: v2, provider: fake, maxUsd: 0.0001, dir, patternsFile, log: () => {} });
  assert.equal(r3.analysed, 0); assert.match(r3.stopped, /^cap/);
  // a failure stops the run (no paid retry)
  let n = 0;
  const failing = { call: async () => { n++; throw Object.assign(new Error("anthropic 500"), { costUsd: 0.0002 }); } };
  const r4 = await runPaid({ videos: [mk("e"), mk("f")], provider: failing, maxUsd: 1, dir, patternsFile, log: () => {} });
  assert.equal(n, 1); assert.match(r4.stopped, /request failed/); assert.equal(r4.spent, 0.0002);
});

test("price: Haiku per-video requests cost fractions of a cent; the schemas are strict JSON schemas", () => {
  const v = fixtureVideo(), desc = fixtureDescriptions(v.sh), stats = computeStats({ ...v, desc });
  const content = analysisPrompt({ sh: v.sh, desc, stats });
  assert.ok(content.includes("[climax]") && content.includes("|"));
  const p = requestPrice(MODELS.haiku, 9000, "analysis");
  assert.ok(p.typicalUsd < 0.003 && p.worstUsd < 0.006 && p.worstUsd > p.typicalUsd);
  assert.ok(requestPrice(MODELS.sonnet, 80000, "synth").worstUsd >= 19 * requestPrice(MODELS.haiku, 80000, "synth").worstUsd);
  // Haiku's long-prompt rate above 100K tokens
  assert.ok(requestPrice(MODELS.haiku, 120000, "synth").typicalUsd > 0.05);
  for (const s of [analysisSchema(), synthSchema()]) assert.equal(s.additionalProperties, false);
});

// --------------------------------------------------------------------------------------- our plans vs the patterns
const sh = (start, end, x = {}) => ({ start, end, camera: "medium", focus: "group", set: "creature:t_on", light: "day", actors: [], ...x });
test("storyReport: a plan that follows the patterns scores 1; a flat plan gets each story rule", () => {
  const good = { duration: 40, shots: [
    sh(0, 2, { camera: "establish", focus: "world", part: "rule", giants: [{ id: "world", action: "walk" }] }),
    sh(2, 4, { part: "tour", camera: "aerial", focus: "world" }), sh(4, 6, { part: "tour", actors: [{ id: "baker", pose: "stand" }] }), sh(6, 8, { part: "tour", camera: "insert", insert: { kind: "card" } }),
    sh(8, 10, { part: "me", camera: "closeup", actors: [{ id: "me", pose: "stand" }] }), sh(10, 12, { part: "me", camera: "establish", focus: "world" }),
    sh(12, 14, { part: "until", monsterState: { state: "lurk" } }), sh(14, 16, { part: "until", monsterState: { state: "reveal" } }), sh(16, 18, { part: "until", actors: [{ id: "me", pose: "scared" }] }), sh(18, 20, { part: "until", camera: "wide", shake: "big" }),
    sh(20, 22, { part: "discovery", camera: "closeup", actors: [{ id: "me", pose: "look_up" }] }), sh(22, 24, { part: "discovery", camera: "establish" }),
    sh(24, 26, { part: "climax", beat: { type: "attack" } }), sh(26, 28, { part: "climax", beat: { type: "impact" } }), sh(28, 30, { part: "climax", actors: [{ id: "me", pose: "cheer" }] }), sh(30, 32, { part: "climax", camera: "aerial" }),
    sh(32, 36, { part: "closer", camera: "wide", actors: [{ id: "me", pose: "stand" }] }), sh(36, 40, { part: "closer", camera: "establish" }),
  ] };
  const P = { ...DEFAULT_PATTERNS };
  const g = storyReport(good, P);
  assert.deepEqual(g.problems, []); assert.equal(g.score, 1);
  assert.equal(g.metrics.firstWideShot, 1);
  assert.equal(g.metrics.beatSequences.climax, "full");
  const flat = { duration: 40, shots: Array.from({ length: 20 }, (_, i) => sh(i * 2, i * 2 + 2, { part: BEATS[Math.min(6, Math.floor(i / 3))], camera: "duel", actors: [{ id: "baker", pose: "stand" }] })) };
  const f = storyReport(flat, P), rules = new Set(f.problems.map((p) => p.rule));
  for (const r of ["S1 world established", "S2 recurring wide", "S3 beat sequence", "S5 narrator intro", "S5 character intro"]) assert.ok(rules.has(r), r);
  assert.ok(f.score < 0.5);
  assert.equal(roleOfShot(sh(0, 1, { shake: "big" })), "consequence");
  assert.doesNotThrow(() => storyReport({}));
});

test("director prompt carries the STORY PATTERNS block; planVideo stores tl.story (advisory)", async () => {
  assert.ok(DIRECTOR_SYSTEM.includes("STORY PATTERNS (plan the WHOLE video"));
  const block = storyPatternsForPrompt();
  assert.ok(block.length / 3.6 < 1000, "the block stays compact");
  assert.ok(!/Bramble/.test(block));
  // the committed patterns file loads and contains no reference line text
  const p = loadStoryPatterns({ fresh: true });
  assert.ok(p.patterns && p.patternsOnly);
  const exists = (rel) => fs.existsSync(path.join(ENGINE, rel));
  const TW = JSON.parse(fs.readFileSync(path.join(ENGINE, "dev", "scripts", "turtle_wolf.json"), "utf8"));
  const direction = await directStory({ script: TW, idea: TW.idea, provider: "mock", exists });
  const tl = planVideo({ script: TW, words: estimateWords(TW), idea: TW.idea, lengthSec: 90, direction, exists });
  assert.ok(tl.story && Array.isArray(tl.story.problems) && tl.story.metrics.shots === tl.shots.length);
  assert.ok(tl.story.score == null || (tl.story.score >= 0 && tl.story.score <= 1));
});
