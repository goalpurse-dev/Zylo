// node --test dev/builderRender.test.mjs   (headless Chrome, free: the builder's browser side)
// Every world enclosure type builds and renders (lib/builder/still.mjs -> page/still.html), a blueprint renders, a junk
// blueprint renders what it can without throwing, and the real engine page renders a timeline with built assets.
// Stills: out/dev/builder/smoke/
import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeStillRenderer } from "../lib/builder/still.mjs";
import { MOCK_OBJECTS, MOCK_WORLDS } from "../lib/builder/mock.js";
import { renderStills } from "../render.mjs";

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "out", "dev", "builder", "smoke");
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const r = await makeStillRenderer({ outDir: OUT });
after(() => r.close());

const bright = (jpeg) => jpeg.length > 15000; // a real picture, not a blank frame
const WORLDS = {
  cave: { name: "cave town", kind: "enclosure", ground: { material: "rock", color: "#9a8a7a", shape: "rocky" }, enclosure: { type: "cave", pattern: "rock", color: "#8a7a6a", opening: "hole", glow: "#fff2c8" }, palette: ["#e0a050", "#6a8a9a"], particles: "dust", light: { base: "day", ambient: 1 }, props: [{ kit: "lamp", spot: "side_left", count: 1 }] },
  room: { name: "dentist's office", kind: "indoor", ground: { material: "tiles", color: "#e8f0f4", shape: "flat" }, enclosure: { type: "room", pattern: "panels", color: "#bfe3f0", color2: "#ffffff", opening: "window" }, palette: ["#2e86de", "#ffffff"], particles: "none", light: { base: "day", ambient: 1.2 }, props: [], landmark: MOCK_OBJECTS["robot dentist"] },
  underwater: { name: "underwater town", kind: "enclosure", ground: { material: "sand", color: "#e8d6a0", shape: "hilly" }, enclosure: { type: "underwater" }, palette: ["#ff8a5c", "#3fb8a0", "#ffd166"], particles: "bubbles", light: { base: "day", tint: "#9fe0ff" }, props: [] },
  space: { name: "on the moon", kind: "outdoor", ground: { material: "moon", color: "#b8b8c0", shape: "rocky" }, enclosure: { type: "space" }, palette: ["#4f8ad9", "#ffffff"], particles: "none", light: { base: "day" }, props: [] },
  sky: { name: "giant mushroom forest", kind: "outdoor", ground: { material: "grass", color: "#9fd36a", shape: "hilly" }, enclosure: { type: "sky" }, palette: ["#ff5e57", "#ffd166", "#6c5ce7"], particles: "spores", light: { base: "warm" }, props: [], landmark: { name: "mushroom", height: 9, parts: [{ id: "stem", shape: "cylinder", size: [1.2, 4, 1.2], pos: [0, 2, 0], color: "#fff6e3" }, { id: "cap", shape: "sphere", size: [6, 3, 6], pos: [0, 4.6, 0], color: "#ff5e57", material: "plastic" }] } },
  turtle: MOCK_WORLDS["inside a giant turtle"],
};

for (const [k, spec] of Object.entries(WORLDS)) {
  test(`world "${k}" (${spec.enclosure.type}) builds and renders in 9:16`, async () => {
    const s = await r.render("world", spec, { name: `world-${k}` });
    assert.equal(s.w, 432); assert.equal(s.h, 768);
    assert.ok(bright(s.jpeg), `${k}: ${s.jpeg.length} bytes`);
    assert.deepEqual(s.problems.filter((p) => !/kit objects/.test(p)), [], s.problems.join("; "));
  });
}

test("a blueprint renders; a junk blueprint renders what it can and never throws", async () => {
  const ok = await r.render("object", MOCK_OBJECTS["robot dentist"], { name: "object-robot" });
  assert.ok(bright(ok.jpeg)); assert.deepEqual(ok.problems, []);
  const junk = await r.render("object", { name: "junk", parts: [{ shape: "blob", size: "x", color: "nope" }, null, { id: "a", shape: "torus", size: [1, 1, 0.9], color: "#ff00ff", parent: "zzz" }], labels: [{ part: "a", text: "OK" }], anims: [{ part: "q", kind: "explode" }] }, { name: "object-junk" });
  assert.ok(junk.jpeg.length > 5000);
  assert.ok(junk.problems.length >= 3, junk.problems.join("; "));
  const empty = await r.render("object", null, { name: "object-empty" });
  assert.ok(empty.problems.length > 0);
});

test("the engine page renders a timeline with a built world and a built object (timeline.assets)", async () => {
  const tl = {
    version: 1, fps: 24, width: 1080, height: 1920, duration: 2.4, title: "smoke",
    cast: { me: { role: "kid", name: "Pip", seed: 3 } }, monster: null,
    assets: { w1: { kind: "world", name: "inside a giant turtle", spec: MOCK_WORLDS["inside a giant turtle"] }, o1: { kind: "object", name: "robot dentist", blueprint: MOCK_OBJECTS["robot dentist"] } },
    shots: [
      { start: 0, end: 1.2, line: 0, part: "rule", set: "world:w1", light: "day", camera: "wide", focus: "me", actors: [{ id: "me", spot: "center", pose: "look_up", expr: "surprised", facing: "camera" }], seed: 1 },
      { start: 1.2, end: 2.4, line: 1, part: "tour", set: "world:w1", light: "night", camera: "medium", focus: "object", actors: [{ id: "me", spot: "left", pose: "point", expr: "happy", facing: "camera" }], objects: [{ name: "robot dentist", asset: "o1", spot: "right", facing: "camera" }], seed: 2 },
    ],
    captions: [{ word: "inside", start: 0, end: 1.2 }, { word: "dentist", start: 1.2, end: 2.4 }], audio: { voice: "voice.wav", music: "music.wav" },
  };
  const p = path.join(OUT, "engine-timeline.json");
  fs.writeFileSync(p, JSON.stringify(tl));
  const files = await renderStills({ timelinePath: p, times: [0.5, 1.8], outPrefix: path.join(OUT, "engine") });
  for (const f of files) assert.ok(bright(fs.readFileSync(f)), f);
});
