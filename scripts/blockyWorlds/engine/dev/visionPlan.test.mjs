// node --test dev/visionPlan.test.mjs   (lib/vision on a REAL planned timeline: the turtle/wolf script, the mock story
// director, planVideo, the real pre-render checks as the re-plan guard; the mock judge and a fake renderer: no network,
// no Chrome). After the review the timeline must be at least as clean as before (the PERMANENT RULE's checks never
// get a new problem from a review fix).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as plan from "../plan.mjs";
import { directStory } from "../lib/director/index.js";
import { reviewForPrepare, checksFor, judgeFromConfig } from "../lib/vision/index.js";
import { lineRequirements } from "../lib/vision/requirements.js";

const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const exists = (rel) => fs.existsSync(path.join(ENGINE, rel));
const TW = JSON.parse(fs.readFileSync(path.join(ENGINE, "dev", "scripts", "turtle_wolf.json"), "utf8"));
const direction = await directStory({ script: TW, idea: TW.idea, provider: "mock", exists });
const words = plan.estimateWords(TW);
const fresh = () => plan.planVideo({ script: TW, words, idea: TW.idea, lengthSec: 90, direction, exists });
const fakeStills = { async renderTimeline(tl, picks) { return { stills: picks.map((p) => ({ ...p, jpeg: Buffer.from([0xff, 0xd8]), w: 432, h: 768, file: null, ms: 0 })), loadMs: 0, ms: 0 }; } };

test("requirements of a real plan: every line, who / place / time from the production list", () => {
  const tl = fresh();
  const r = lineRequirements(tl, { script: TW });
  assert.equal(r.length, TW.lines.length);
  assert.ok(r.every((x) => x.shots.length >= 1), "every line has a shot");
  assert.ok(r.filter((x) => x.place).length >= r.length / 2);
});

test("review on a real plan: never adds a pre-render check problem, never throws, records every pass", async () => {
  const tl = fresh();
  const check = checksFor(plan, TW);
  const before = check(tl).length;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bw-review-plan-"));
  const rv = await reviewForPrepare({ tl, script: TW, premise: TW.idea?.premise ?? null, config: { provider: "mock" }, plan, dir, stills: fakeStills });
  assert.ok(rv.report, rv.summary?.error);
  assert.ok(check(tl).length <= before, `checks: ${before} before, ${check(tl).length} after`);
  assert.ok(rv.report.passes.length >= 1);
  assert.ok(fs.existsSync(path.join(dir, "shot-review.json")));
  for (let i = 1; i < tl.shots.length; i++) assert.ok(Math.abs(tl.shots[i].start - tl.shots[i - 1].end) < 1e-6, `shots tile at ${i}`);
  assert.equal(rv.costUsd, 0);
});

test("the review is off unless configured; a paid provider without a key is off too", () => {
  assert.equal(judgeFromConfig({}, { apiKey: null }), null);
  assert.equal(judgeFromConfig({ provider: "anthropic" }, { apiKey: null }), null);
  assert.equal(judgeFromConfig({ provider: "mock" }).name, "mock");
  assert.equal(judgeFromConfig({ provider: "haiku" }, { apiKey: "k" }).model, "claude-haiku-5-5");
  assert.equal(judgeFromConfig({ provider: "sonnet" }, { apiKey: "k" }).model, "claude-sonnet-5-5");
});
