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
