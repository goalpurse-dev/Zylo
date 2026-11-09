// node --test dev/style.test.mjs   (REBUILD 2026-11-06: the style rules from the turtle target, lib/style.js)
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { motionPass, styleReport, STYLE } from "../lib/style.js";
import { planVideo, checkTimeline, estimateWords } from "../plan.mjs";
import { directStory } from "../lib/director/index.js";

const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cap = (word, start) => ({ word, start, end: start + 0.2 });
const shot = (start, end, x = {}) => ({ start, end, set: "creature:t_out", camera: "establish", focus: "world", giants: [{ id: "world", action: "idle" }], ...x });

test("motionPass: an idle giant walks unless its own words say it stops; a change that adds a check problem is undone", () => {
  const tl = { captions: [cap("The", 0.1), cap("turtle", 0.3), cap("froze.", 2.1)], shots: [shot(0, 2), shot(2, 4)] };
  assert.deepEqual(motionPass(tl), { moved: 1, reverted: 0 });
  assert.equal(tl.shots[0].giants[0].action, "walk");
  assert.equal(tl.shots[1].giants[0].action, "idle", "froze keeps it still");
  const t2 = { captions: [cap("Go", 0.1)], shots: [shot(0, 2)] };
  assert.deepEqual(motionPass(t2, { check: (x) => (x.shots[0].giants[0].action === "walk" ? ["bad"] : []) }), { moved: 0, reverted: 1 });
  assert.equal(t2.shots[0].giants[0].action, "idle");
  const t3 = { captions: [cap("Boom", 0.1)], shots: [shot(0, 2, { camera: "insert", insert: { kind: "card", text: "X" } })] };
  assert.equal(motionPass(t3).moved, 0, "a card is never touched");
});

test("styleReport: each mechanical rule fires on a bad plan and stays quiet on a target-like one", () => {
  // target-like: 1.2 s shots cut on word starts, the creature in every shot, all moving, day, close giant cameras
  const good = { duration: 36, lines: [{ text: "The turtle walks." }], captions: [], shots: [] };
  for (let i = 0; i < 30; i++) { good.captions.push(cap("w", i * 1.2)); good.shots.push(shot(i * 1.2, (i + 1) * 1.2, { light: "day", camera: i % 2 ? "giant_close" : "establish", giants: [{ id: "world", action: "walk" }], lines: [0], line: 0 })); }
  // (R9-R11, the shot grammar mix / crowds / faces, have their own tests: dev/shotGrammar.test.mjs; this giant-only plan is no mix example)
  assert.deepEqual(styleReport(good).problems.filter((p) => !/^R(9|10|11) /.test(p.rule)), []);
  // bad: 3 long shots, night, nothing moving, off-onset cuts, a person-only opener, an action verb carded
  const bad = { duration: 36, lines: [{ text: "Then he lunged." }, { text: "The end." }], captions: [cap("w", 0.3), cap("x", 5.3)], shots: [
    { start: 0, end: 12, set: "creature:t_on", camera: "medium", focus: "me", actors: [{ id: "me", pose: "stand" }], light: "night", line: 1 },
    { start: 12, end: 14, camera: "insert", insert: { kind: "card", text: "LUNGE" }, light: "night", line: 0 },
    { start: 14, end: 26, set: "creature:t_on", camera: "medium", focus: "me", actors: [{ id: "me", pose: "stand" }], light: "night", line: 1 },
    { start: 26, end: 36, set: "creature:t_on", camera: "medium", focus: "me", actors: [{ id: "me", pose: "stand" }], light: "night", line: 1 },
  ] };
  const rules = new Set(styleReport(bad).problems.map((p) => p.rule));
  for (const r of ["R1 opener", "R2 creature share", "R3 pace", "R4 verb not card", "R5 daylight", "R6 motion", "R7 cut on onsets"]) assert.ok(rules.has(r), r);
  assert.ok(STYLE.maxShot === 3.7 && STYLE.openerShots === 3);
  assert.doesNotThrow(() => styleReport({}));
});

test("planVideo: the style report is on every plan, the motion pass keeps the checks clean", async () => {
  const exists = (rel) => fs.existsSync(path.join(ENGINE, rel));
  const TW = JSON.parse(fs.readFileSync(path.join(ENGINE, "dev", "scripts", "turtle_wolf.json"), "utf8"));
  const direction = await directStory({ script: TW, idea: TW.idea, provider: "mock", exists });
  const tl = planVideo({ script: TW, words: estimateWords(TW), idea: TW.idea, lengthSec: 90, direction, exists });
  assert.deepEqual(checkTimeline(tl), []);
  assert.ok(tl.style?.metrics && Array.isArray(tl.style.problems));
  assert.ok(tl.direction.motion?.moved >= 1, "some idle giant now walks");
  const plain = planVideo({ script: TW, words: estimateWords(TW), idea: TW.idea, lengthSec: 90 });
  assert.ok(plain.style?.metrics, "plans without a director get the report too");
});
