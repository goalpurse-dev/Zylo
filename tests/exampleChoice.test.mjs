import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_EXAMPLES, EXAMPLE_CARDS, ONBOARDING_EXAMPLES } from "../src/data/onboardingExamples.js";
import { exampleByKey, examplesFor } from "../src/lib/exampleChoice.js";

// The new-user tutorial shows premade example videos, matched to the survey (owner, 2026-11-19): nothing is generated.
const root = fileURLToPath(new URL("..", import.meta.url));
const GOALS = ["faceless", "longform", "business", "exploring"];

test("the list: unique keys, every field the tutorial needs, files that exist", () => {
  const keys = ONBOARDING_EXAMPLES.map((e) => e.key);
  assert.equal(new Set(keys).size, keys.length, "two examples share a key");
  for (const e of ONBOARDING_EXAMPLES) {
    for (const f of ["key", "title", "niche", "video", "poster", "makeLink"]) assert.ok(typeof e[f] === "string" && e[f], `${e.key}: ${f} missing`);
    assert.ok(Number.isFinite(e.credits) && e.credits > 0, `${e.key}: credits`);
    assert.ok(Array.isArray(e.goals) && e.goals.every((g) => GOALS.includes(g)), `${e.key}: unknown survey answer in goals`);
    for (const f of ["video", "poster", "loop"]) {
      if (!e[f] || /^https?:/.test(e[f])) continue;
      assert.ok(existsSync(join(root, "public", e[f])), `${e.key}: ${e[f]} is not in /public`);
    }
  }
  for (const k of DEFAULT_EXAMPLES) assert.ok(keys.includes(k), `default ${k} is not in the list`);
});

test("every survey answer gets a full row of examples, the best match first", () => {
  for (const g of GOALS) {
    const row = examplesFor([g]);
    assert.equal(row.length, EXAMPLE_CARDS, g);
    assert.ok(row[0].goals.includes(g), `${g}: first card doesn't match`);
    assert.equal(new Set(row.map((e) => e.key)).size, row.length, `${g}: repeats`);
  }
});

test("no answers or unknown answers: the defaults", () => {
  assert.deepEqual(examplesFor([]).map((e) => e.key), DEFAULT_EXAMPLES.slice(0, EXAMPLE_CARDS));
  assert.deepEqual(examplesFor(["nope"]).map((e) => e.key), DEFAULT_EXAMPLES.slice(0, EXAMPLE_CARDS));
  assert.deepEqual(examplesFor(null).map((e) => e.key), DEFAULT_EXAMPLES.slice(0, EXAMPLE_CARDS));
});

test("a row mixes kinds of video when it can", () => {
  const row = examplesFor(["faceless"]);
  assert.ok(new Set(row.map((e) => e.niche)).size >= 2, "all cards are the same kind of video");
});

test("the example tutorial generates nothing, says it's an example, and prices from the deal file", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(join(root, "src/components/onboarding/ExampleTutorial.jsx"), "utf8");
  assert.ok(!/startFreePreview|cutawayServer|cutaway-api/.test(src), "the example tutorial must not start a render");
  assert.match(src, /Example made with Zyvo/);
  assert.match(src, /An example video made with Zyvo/);
  assert.match(src, /Make your own like this/);
  assert.match(src, /launchDealPrice\(/, "the first month's price comes from _shared/launchDeal.js");
  assert.match(src, /launchDealForViewer\(/, "the deal disappears by itself when it ends");
  const page = readFileSync(join(root, "src/pages/onboarding/FirstVideo.jsx"), "utf8");
  assert.match(page, /<ExampleTutorial /);
});

test("a broken line in the list is skipped, and a lookup never comes back empty", () => {
  const list = [{ key: "a", title: "A", video: "" }, { key: "b", title: "B", video: "/b.mp4", goals: ["business"], niche: "x" }];
  assert.deepEqual(examplesFor(["business"], { list, defaults: [], count: 3 }).map((e) => e.key), ["b"]);
  assert.equal(exampleByKey("a", { list, defaults: ["b"] }).key, "b");
  assert.equal(exampleByKey("cutaway_landfill").key, "cutaway_landfill");
  assert.equal(exampleByKey("gone").key, DEFAULT_EXAMPLES[0]);
});
