// THE STORY SHAPE (owner 2026-11-15): rule -> life under it -> the one kid -> but one day -> the crisis -> a twist ->
// cliffhanger / holy-twist ending, in every writer's prompt + a free check (advisory "Shape:" notes)
import test from "node:test";
import assert from "node:assert/strict";
import { STORY_SHAPE, SHAPE_PREFIX, storyShapeBlock, storyShapeProblems } from "../supabase/functions/_shared/blockyWorlds/storyShape.js";
import { patternNotes } from "../supabase/functions/_shared/blockyWorlds/patternBank.js";
import { hybridChecks } from "../supabase/functions/_shared/blockyWorlds/hybrid.js";

const L = (xs) => ({ title: "t", lines: xs.map((text) => ({ part: "tour", text })) });
const GOOD = L([
  "And I just caught a falling bank with one hand!",
  "You see, in this town, every laugh makes you grow.",
  "Mr. Pike laughed at a pun and now he waters roofs.",
  "Grandma giggled once and her hat lives in the clouds.",
  "Then there's me. I never laugh, so I'm the smallest kid in town.",
  "But one day, Grandpa read me his joke book.",
  "I laughed so hard I popped bigger than the school.",
  "A cement truck lost its brakes and everyone screamed.",
  "It ran straight toward the bank, faster and faster.",
  "The bank started to fall over the whole town.",
  "Then I noticed something: my laugh made me big enough.",
  "I caught it one inch above the ground.",
  "Now everyone tells me jokes... but who will make me stop?",
]);

test("the shape is seven parts in the owner's order, and every writer's notes lead with it", () => {
  assert.deepEqual(STORY_SHAPE.map((p) => p.id), ["rule", "life", "kid", "oneday", "crisis", "twist", "ending"]);
  const block = storyShapeBlock();
  let at = -1;
  for (const p of STORY_SHAPE) { const i = block.indexOf(p.name); assert.ok(i > at, `${p.name} in order`); at = i; }
  assert.match(block, /result-first hook/);
  assert.match(block, /You see, in this town/);
  for (const k of ["plan", "lines"]) assert.ok(patternNotes(k).startsWith(block), `${k} notes start with the shape`);
  assert.ok(!patternNotes("ideas").includes("THE STORY SHAPE"), "the idea engine keeps its own notes");
});

test("a story with the whole shape passes the shape check", () => {
  assert.deepEqual(storyShapeProblems(GOOD), []);
});

test("the shape check names each missing part (advisory notes, never hard)", () => {
  const flat = L([
    "And I just caught a falling bank!",
    "You see, in this town, every laugh makes you grow.",
    "Mr. Pike laughed and now he waters roofs.",
    "Grandma giggled and her hat lives in the clouds.",
    "The baker smiles all day long.",
    "We all like the town a lot.",
    "The mayor gives a speech.",
    "The end of the day is nice.",
    "We go home and sleep.",
  ]);
  const p = storyShapeProblems(flat);
  for (const k of ["THE ONE KID", "BUT ONE DAY", "THE CRISIS", "A TWIST", "the ending is closed"]) assert.ok(p.some((x) => x.includes(k)), k);
  assert.ok(p.every((x) => x.startsWith(SHAPE_PREFIX)));
  const c = hybridChecks({ script: flat, lengthSec: 60 });
  assert.ok(c.advisory.some((x) => x.startsWith(SHAPE_PREFIX)), "the hybrid checks carry the shape notes");
  assert.ok(!c.hard.some((x) => x.startsWith(SHAPE_PREFIX)), "never a hard (paid) rewrite on their own");
});

test("short scripts are not judged on shape", () => {
  assert.deepEqual(storyShapeProblems(L(["a", "b", "c"])), []);
});
