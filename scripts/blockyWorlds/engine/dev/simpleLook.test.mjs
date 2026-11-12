// SIMPLE LOOK (2026-11-10): the planner's look + pacing, the simple audio cues, the word director harness, the bundle.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { planVideo, LOOK, checkTimeline, checkVisuals, checkSubjects } from "../plan.mjs";
import { estimateWords } from "../lib/planText.js";
import { paceReport, pacePass } from "../lib/wordTiming.js";
import { simpleCues, ruleKeyWord, pauseReport, AUDIO_SIMPLE } from "../lib/audioPlan.js";
import { validateWordDirection, applyWordDirection, fakeWordDirector, estimateWordDirector, wordDirectorSchema } from "../lib/wordDirector.js";
import { makeBundle } from "./simple/bundle.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = { title: "The Kid Who Never Blinks", lines: [
  { part: "rule", text: "In this town, there's one rule. Never look out your window after dark." },
  { part: "tour", text: "Dottie Pell has forty curtains bulging off her house like a cloud." },
  { part: "me", text: "There's me, Nell, with zero curtains and one sock." },
  { part: "until", text: "One night a wild wind ripped off every curtain, and everyone screamed." },
  { part: "climax", text: "I walked outside and looked right at it. I did not blink." },
  { part: "closer", text: "Grandpa says I'm the rudest thing in town, and I laughed." },
] };
const plan = (o = {}) => planVideo({ script: SCRIPT, words: estimateWords(SCRIPT, 222), idea: { mood: "funny" }, ...o });

test("the planner's look is the simple look; the pacing pins shots to words, ~1.4 s, every shot moving, checks clean", () => {
  assert.equal(LOOK, "simple");
  const tl = plan();
  assert.equal(tl.look, "simple");
  const r = paceReport(tl);
  assert.equal(r.onWords, 1);
  assert.equal(r.moving, 1);
  assert.ok(r.avg <= 1.6, `avg ${r.avg}`);
  assert.equal(checkTimeline(tl).length, 0);
  assert.equal(checkVisuals(tl, SCRIPT).length, 0);
  assert.equal(checkSubjects(tl).length, 0);
  for (const s of tl.shots) for (const a of s.actors ?? []) {
    if (a.faces) { assert.equal(a.faces[0].at, 0); for (let i = 1; i < a.faces.length; i++) assert.ok(a.faces[i].at > a.faces[i - 1].at); }
    if (a.poses) assert.equal(a.poses[0].pose, "stand");
  }
});
test("pace: off keeps the planner's cuts; a second pass keeps the checks clean", () => {
  const off = plan({ pace: false });
  assert.equal(off.pacing, undefined);
  const tl = plan();
  const chk = (t) => ({ timeline: checkTimeline(t).length, visuals: checkVisuals(t, SCRIPT).length, subjects: checkSubjects(t).length });
  pacePass(tl, { check: chk });
  assert.deepEqual(chk(tl), { timeline: 0, visuals: 0, subjects: 0 });
});
test("audio: one low boom on the rule's key word, almost no other sound; the pause report", () => {
  const tl = plan();
  assert.equal(ruleKeyWord(tl).word.toLowerCase().replace(/\W/g, ""), "never");
  const cues = simpleCues(tl, [{ t: 1, at: 1.1, name: "whoosh_1", gainDb: -2 }, { t: 20, at: 20.1, name: "sneeze", gainDb: -6 }, { t: 22, at: 22, name: "sneeze", gainDb: -6 }]);
  assert.equal(cues.filter((c) => c.name === "impact").length, 1);
  assert.ok(!cues.some((c) => c.name.startsWith("whoosh")));
  assert.ok(cues.length <= 1 + AUDIO_SIMPLE.maxStoryCues);
  const p = pauseReport([{ start: 0, end: 0.3 }, { start: 0.4, end: 0.7 }, { start: 1.2, end: 1.4 }]);
  assert.equal(p.over, 1); assert.equal(p.maxGap, 0.5);
});
test("word director: the schema, validation never throws, the shots tile the video on words, the estimate", () => {
  const tl = plan();
  assert.ok(wordDirectorSchema().properties.shots);
  const bad = validateWordDirection({ shots: [{ startWord: 5, set: "moon", light: "x", target: "nobody", move: "static", distance: 99, actors: [{ id: "ghost" }] }] }, { tl });
  assert.equal(bad.shots[0].startWord, 0); assert.equal(bad.shots[0].distance, 30); assert.ok(bad.problems.length >= 4);
  assert.deepEqual(validateWordDirection(null, { tl }).shots, []);
  const v = validateWordDirection(fakeWordDirector(tl), { tl });
  const wd = applyWordDirection(tl, v);
  assert.equal(wd.shots[0].start, 0);
  for (let i = 1; i < wd.shots.length; i++) assert.ok(Math.abs(wd.shots[i].start - wd.shots[i - 1].end) < 1e-6);
  assert.equal(wd.shots.at(-1).end, tl.duration);
  assert.ok(wd.shots.every((s) => s.cam && s.camMove.type !== "static"));
  const e = estimateWordDirector({ tl });
  assert.ok(e.usd > 0.005 && e.usd < 0.2, `usd ${e.usd}`);
});
test("bundle: a module importing a stubbed one ships too (its import rewritten)", () => {
  const code = makeBundle({ timeline: { shots: [], captions: [] }, files: ["/page/engine.js"] });
  assert.match(code, /"\/page\/capsLayer\.js"/);
  assert.match(code, /bundle stub: page\/post\.js/);
  assert.ok(fs.existsSync(path.join(here, "../page/simple/people.js")));
});
test("the viral pace (2026-11-12): sound words get our effects, pace stats, the cut pass hits 50-60 cuts a minute", async () => {
  const { soundWordCues, SOUND_SFX, SOUND_MISSING } = await import("../lib/audioPlan.js");
  const { paceStats } = await import("../voice/eleven.mjs");
  const { cutPass, cutStats, PACE } = await import("../lib/storyboard.js");
  const { SFX } = await import("../audio/sfx.mjs"), { SFX_EPIC } = await import("../audio/sfxEpic.mjs");
  for (const n of Object.values(SOUND_SFX)) assert.ok(SFX[n] || SFX_EPIC[n], n);
  for (const w of SOUND_MISSING) assert.equal(SOUND_SFX[w], undefined, w);
  const words = "Boom! The door flew open. Knock. Knock. Meow!".split(" ");
  const captions = words.map((w, i) => ({ word: w, start: i * 0.25, end: i * 0.25 + 0.2 }));
  const r = soundWordCues({ captions, lines: [{ start: 0, end: 1.2 }, { start: 1.25, end: 2 }] }, { lines: [{ text: "Boom! The door flew open.", sfx: ["boom"] }, { text: "Knock. Knock. Meow!", sfx: ["knock", "knock", "meow"] }] });
  assert.deepEqual(r.cues.map((c) => [c.name, c.at]), [["impact", 0], ["knock", 1.25], ["knock", 1.5]]);
  assert.deepEqual(r.missing, ["meow"]);
  assert.deepEqual(paceStats(captions), { wpm: 246, first15: 8, maxPause: 0.05, firstWord: 0 });
  // 60 s of 3-second board shots -> quick cuts, the first by 0.6 s, none over the max, none under the min
  const shots = Array.from({ length: 20 }, (_, i) => ({ start: i * 3, end: i * 3 + 3, camera: "wide", board: { loc: "street", cam: "street_wide", acts: [], people: [] } }));
  const cut = cutPass(shots), st = cutStats({ shots: cut, duration: 60 });
  assert.equal(st.firstCut, PACE.firstCutSec);
  assert.ok(st.cutsPerMin >= 50 && st.cutsPerMin <= 60, JSON.stringify(st));
  assert.ok(st.first15 >= 14 && st.first15 <= 18, JSON.stringify(st));
  for (const s of cut) assert.ok(s.end - s.start >= PACE.minShot - 1e-6 && s.end - s.start <= PACE.maxShot + 1e-6);
  for (let i = 2; i < cut.length; i++) assert.ok(!(cut[i].camera === cut[i - 1].camera && cut[i].camera === cut[i - 2].camera), `shot ${i}`);
});
