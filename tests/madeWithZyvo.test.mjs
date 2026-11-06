// Made with Zyvo (Home): the picks file and the rules that decide what shows.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { showcaseTemplates, flatVideos, feedOrder } from "../src/components/home-v2/madeWithZyvo/showcaseData.js";
import { claim, release, stopAll, playingCount, MAX_PLAYING } from "../src/components/home-v2/madeWithZyvo/playerPool.js";

const data = JSON.parse(fs.readFileSync(new URL("../src/data/communityShowcase.json", import.meta.url), "utf8"));
const NOW = Date.parse("2026-11-06T12:00:00Z");

test("the picks file: every template has a real route, at least 3 unique videos, valid dates", () => {
  const app = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  const files = new Set();
  for (const t of data.templates) {
    assert.ok(t.id && t.name && t.desc && t.path.startsWith("/workspace/"), t.id);
    assert.ok(!Number.isNaN(Date.parse(t.addedAt)), `${t.id} addedAt`);
    assert.ok(t.videos.length >= 3, `${t.id} has ${t.videos.length} videos`);
    for (const v of t.videos) {
      assert.match(v.file, /^[a-z0-9-]+$/);
      assert.ok(!files.has(v.file), `duplicate ${v.file}`);
      files.add(v.file);
    }
    // the route exists in the app (constants like CUTAWAY_PATH count by their value's file)
    const slug = t.path.split("/").pop();
    assert.ok(app.includes(t.path) || fs.readdirSync(new URL("../src/data/", import.meta.url)).some((f) => fs.readFileSync(new URL(`../src/data/${f}`, import.meta.url), "utf8").includes(`"${t.path}"`)), `route ${slug}`);
  }
});

test("hidden names and switched-off templates never show; newest first", () => {
  const list = showcaseTemplates(data, { base: "B", hidden: ["Clay Rescue"], off: ["blocky-stories"], now: NOW });
  assert.ok(!list.some((t) => t.name === "Clay Rescue"));
  assert.ok(!list.some((t) => t.id === "blocky-stories"));
  for (let i = 1; i < list.length; i++) assert.ok(Date.parse(list[i - 1].addedAt) >= Date.parse(list[i].addedAt));
  assert.equal(list[0].id, "cutaway-explainer");
  assert.equal(list[0].videos[0].src, "B/cutaway-explainer-1.mp4");
  assert.equal(list[0].videos[0].poster, "B/cutaway-explainer-1.webp");
});

test("a template with no videos stays hidden", () => {
  const d = { templates: [...data.templates, { id: "x", name: "X", path: "/workspace/x", desc: "x", addedAt: "2026-11-05", videos: [] }] };
  assert.ok(!showcaseTemplates(d, { now: NOW }).some((t) => t.id === "x"));
});

test("the viewer list keeps each video's template", () => {
  const list = showcaseTemplates(data, { now: NOW });
  const flat = flatVideos(list);
  assert.equal(flat.length, list.reduce((n, t) => n + t.videos.length, 0));
  assert.equal(flat[0].template.id, list[0].id);
});

test("the All feed: every video once, first row one per template, templates spread out", () => {
  const list = showcaseTemplates(data, { now: NOW });
  const feed = feedOrder(list);
  const total = list.reduce((n, t) => n + t.videos.length, 0);
  assert.equal(feed.length, total);
  assert.equal(new Set(feed.map((v) => v.id)).size, total);
  assert.deepEqual(feed.slice(0, list.length).map((v) => v.template.id), list.map((t) => t.id));
  // never three in a row from the same template
  for (let i = 2; i < feed.length; i++) {
    assert.ok(!(feed[i].template.id === feed[i - 1].template.id && feed[i].template.id === feed[i - 2].template.id), `run at ${i}`);
  }
});

test("at most 3 videos play; the oldest is told to stop", () => {
  stopAll();
  const stopped = [];
  for (const id of ["a", "b", "c", "d"]) claim(id, () => stopped.push(id));
  assert.equal(playingCount(), MAX_PLAYING);
  assert.deepEqual(stopped, ["a"]);
  release("b");
  assert.equal(playingCount(), 2);
  stopAll();
  assert.deepEqual(stopped, ["a", "c", "d"]);
});
