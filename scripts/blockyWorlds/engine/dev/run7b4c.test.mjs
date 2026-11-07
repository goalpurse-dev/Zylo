// Regression: the real run 7b4c0d8b ("The Quiet Kid and the Turtle's Drums", 2026-11-05): a story that lives inside a
// giant turtle showed plain streets, a school hallway and a bedroom; "Grandpa. His wrist" made a man "Grandpa His",
// "Totally bare." a kid "Totally", "the baker" a second Baker; the night ran into a daylight climax; and its prepare ran
// on a leftover worker of the image before. Free: the stored director list + the take's word timings
// (dev/scripts/run7b4c0d8b.json), fake RunPod / callbacks, no paid call.
//   node --test dev/run7b4c.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as plan from "../plan.mjs";
import * as kit from "../page/kit/objects.js";
import { directStory, mockProduction, validateProduction } from "../lib/director/index.js";
import { carryClock } from "../lib/direction.js";
import { validateEpic } from "../lib/epic.js";
import { titleMatchOk, cleanName, nameWordOk } from "../lib/names.js";
import { preRenderChecks, checkFailure, runJob, staleBuild, buildOf } from "../runpod/worker.mjs";
import { staleWorkers, retireStale } from "../runpod/retire.mjs";
import { buildId, FLY_TOML } from "../runpod/buildContext.mjs";
import { openingRule, openingProblems } from "../lib/opening.js";
import { meaningPass } from "../lib/meaning.js";
import { notInHand, covers, OBJECT_CATALOG } from "../lib/visuals.js";
import { genderLook, lookFor } from "../page/kit/people.js";
import { retryOf } from "../../../../supabase/functions/_shared/blockyWorlds/render.js";

const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const R = JSON.parse(fs.readFileSync(path.join(ENGINE, "dev", "scripts", "run7b4c0d8b.json"), "utf8"));
const script = { title: R.title, lines: R.lines };
const words = R.words.map(([word, start, end]) => ({ word, start, end }));
const exists = (rel) => fs.existsSync(path.join(ENGINE, rel));
const idea = { opener: R.lines[0].text, title: R.title, topic: R.topic };

let TL = null;
async function timeline() {
  if (TL) return TL;
  const direction = await directStory({ script, idea, exists, provider: { direct: async () => ({ data: R.production, costUsd: 0 }) } });
  TL = plan.planVideo({ script, words, idea, lengthSec: R.lengthSec, direction, exists });
  return TL;
}

// ------------------------------------------------------------------ 1. the turtle world, every shot
test("run 7b4c0d8b: every shot is in the turtle (no plain street / school / bedroom), cards included", async () => {
  const tl = await timeline();
  assert.ok(tl.worlds?.turtle_inside && tl.worlds?.turtle_outside);
  const plain = tl.shots.filter((s) => !/^creature:/.test(s.set));
  assert.deepEqual(plain.map((s) => `${s.start} ${s.set} ${s.camera}`), []);
  for (const s of tl.shots.filter((x) => x.camera === "insert")) assert.match(s.set, /^creature:turtle_/, `card at ${s.start}`);
  assert.deepEqual(plan.checkTimeline(tl), []);
  assert.deepEqual(validateEpic(tl), []);
});

test("checkTimeline: a plain set in a story that lives in a creature fails; staysInTheWorld fixes it", async () => {
  const tl = structuredClone(await timeline());
  tl.shots[3].set = "bedroom"; delete tl.shots[3].worldBase;
  assert.ok(plan.checkTimeline(tl).some((p) => /plain set bedroom/.test(p)));
  plan.staysInTheWorld(tl.shots, tl.worlds);
  assert.match(tl.shots[3].set, /^creature:/);
  assert.equal(tl.shots[3].worldBase, "bedroom");
  // a giant only crossing the land (no inside / on world): the town stays a plain set
  const shots = [{ set: "street", line: 0, camera: "wide" }, { set: "creature:w", line: 1, camera: "wide" }];
  plan.staysInTheWorld(shots, { w: { creature: "wolf", view: "outside" } });
  assert.equal(shots[0].set, "street");
});

test("validateEpic: a creature world the page can't build as asked is a problem (never a silent default)", () => {
  const tl = { shots: [{ start: 0, end: 1, set: "creature:a", camera: "wide" }, { start: 1, end: 2, set: "creature:b", camera: "wide" }], worlds: { a: { creature: "turtle" }, b: { view: "inside" } } };
  const bad = validateEpic(tl);
  assert.ok(bad.some((p) => /world "a": view/.test(p)), bad.join(" | "));
  assert.ok(bad.some((p) => /world "b": creature missing/.test(p)), bad.join(" | "));
  assert.ok(validateEpic({ shots: [{ start: 0, end: 1, set: "creature:x", camera: "wide" }], worlds: {} }).some((p) => /not in timeline.worlds/.test(p)));
});

test("run 7b4c0d8b: the pre-render checks pass on the replanned timeline", async () => {
  const tl = await timeline();
  const bad = checkFailure(preRenderChecks(plan, tl, script, kit));
  assert.equal(bad, null, bad?.message);
});

test("the opening: the world first (the turtle from outside), no sign / card / badge in the first 10 s", async () => {
  const tl = await timeline();
  const s0 = tl.shots[0];
  assert.equal(s0.set, "creature:turtle_outside"); assert.equal(s0.camera, "establish"); assert.equal(s0.focus, "world");
  assert.ok(s0.giants?.some((g) => g.id === "world"));
  for (const s of tl.shots.filter((x) => x.start < 10)) {
    assert.ok(s.camera !== "insert" && !s.insert, `card at ${s.start}`);
    assert.ok(![s.marker, ...(s.markers ?? [])].some((m) => m?.kind === "icon"), `badge at ${s.start}`);
  }
  assert.ok(tl.shots.some((s) => s.start < 10 && (s.actors ?? []).length >= 2), "people living there");
  assert.deepEqual(openingProblems(tl.shots), []);
  // checkTimeline fails a card in the window; openingRule moves a card whose line runs past 10 s instead of dropping it
  const bad = structuredClone(tl);
  Object.assign(bad.shots[2], { camera: "insert", focus: "insert", insert: { kind: "card", text: "DRUM" }, actors: [] });
  assert.ok(plan.checkTimeline(bad).some((p) => /in the first 10 s/.test(p)));
  const shots = [
    { start: 0, end: 2, line: 0, camera: "wide", set: "street", actors: [] },
    { start: 2, end: 3, line: 1, camera: "insert", insert: { kind: "card", text: "DRUM" }, set: "street" },
    { start: 3, end: 9, line: 1, camera: "medium", set: "street" },
    { start: 9, end: 13, line: 1, camera: "medium", set: "street" },
    { start: 13, end: 30, line: 2, camera: "wide", set: "street" },
  ];
  openingRule(shots, { starts: [0, 2, 3, 9, 10.5, 11.8, 12.5] });
  // NO CARDS (owner, PERMANENT 2026-11-07): the card never moves later; its thing is unshown on the shot it went into
  assert.deepEqual(shots.map((s) => [s.start, s.end, s.camera]), [[0, 2, "wide"], [2, 9, "medium"], [9, 13, "medium"], [13, 30, "wide"]]);
  assert.deepEqual(shots[1].unshown, ["drum"]);
  assert.ok(plan.checkTimeline(bad).some((p) => /NO CARDS, ever/.test(p)), "a card anywhere fails the check");
  assert.deepEqual(openingProblems(shots), []);
});

// ------------------------------------------------------------------ 2. names
test("names: pronouns / sentence ends / quantifiers never become (part of) a name", async () => {
  assert.equal(titleMatchOk("Grandpa", ". ", "His"), false);
  assert.equal(titleMatchOk("Grandpa", ". ", "Joe"), false, "a period after a non-abbreviation title ends the sentence");
  assert.equal(titleMatchOk("Mrs", ". ", "Oddy"), true);
  assert.equal(titleMatchOk("Baker", " ", "Bell"), true);
  assert.equal(cleanName("Grandpa His"), "Grandpa");
  assert.equal(cleanName("Everyone"), "");
  assert.ok(!nameWordOk("Totally") && nameWordOk("Nell"));
  const tl = await timeline();
  const names = Object.values(tl.cast).map((c) => c.name);
  for (const bad of ["Grandpa His", "Totally", "Everyone", "Baker"]) assert.ok(!names.includes(bad), `${bad} in ${names.join(", ")}`);
  assert.ok(names.includes("Grandpa") && names.includes("Mrs. Oddy") && names.includes("Baker Bell"));
  assert.equal(tl.visualWorld.gender.oddy, "f");
  // the mock director (the old worker's fallback) and the real director's cast clean-up
  const mock = mockProduction({ script: { lines: [{ text: "I live with Grandpa. His wrist ticks." }, { text: "My wrist is silent. Totally bare." }] }, idea: {} });
  assert.ok(!mock.cast.some((c) => /\bHis\b/.test(c.name)), JSON.stringify(mock.cast));
  const v = validateProduction({ cast: [{ id: "his", name: "Grandpa His", kind: "human", role: "elder" }], lines: [] }, { lineCount: 0 });
  assert.equal(v.production.cast.find((c) => c.id === "his").name, "Grandpa");
});

test("looks: a woman never has a beard, a man never a skirt; nothing else of the look moves", () => {
  for (let seed = 0; seed < 300; seed++) {
    const f = lookFor({ role: "adult", seed, gender: "f" }), m = lookFor({ role: "elder", seed, gender: "m" }), n = lookFor({ role: "adult", seed });
    assert.equal(f.beard, null);
    assert.ok(["long", "ponytail", "bun"].includes(f.hair));
    assert.ok(!["skirt", "dress"].includes(m.bottom) && !["ponytail", "bun"].includes(m.hair));
    assert.equal(f.skin, n.skin); assert.equal(f.top, n.top);
  }
  assert.deepEqual(genderLook({ hair: "short", beard: "#000", bottom: "pants", acc: [] }, null, 1), { hair: "short", beard: "#000", bottom: "pants", acc: [] });
});

// ------------------------------------------------------------------ 3. the story clock
test("the clock: 'one night' carries to 'at dawn' (warm), never a daylight climax in between", async () => {
  const tl = await timeline();
  const lightOf = (i) => tl.shots.find((s) => s.line === i)?.light;
  for (let i = 20; i <= 44; i++) assert.equal(lightOf(i), "night", `line ${i}: ${R.lines[i].text}`);
  assert.equal(lightOf(45), "warm", R.lines[45].text);
  // the mock list itself, and the pure pass over a real director's list
  const p = mockProduction({ script, idea: {} });
  assert.equal(p.lines[40].light, "night");
  const lines = [{ light: "night" }, { light: "day" }, { light: "day" }, { light: "day" }];
  assert.equal(carryClock(lines, ["one night", "boots", "before dawn they came", "at dawn it was quiet"]), 3);
  assert.deepEqual(lines.map((l) => l.light), ["night", "night", "night", "warm"]);
});

// ------------------------------------------------------------------ 4. stale workers
test("worker: an image older than the job's minBuild answers STALE_WORKER before any work", async () => {
  assert.equal(staleBuild("20261105T200000-aaaaaaaaaaaa", "20261106T120000-bbbbbbbbbbbb") != null, true);
  assert.equal(staleBuild("20261106T120000-bbbbbbbbbbbb", "20261106T120000-bbbbbbbbbbbb"), null);
  assert.equal(staleBuild("20261107T000000-cccccccccccc", "20261106T120000-bbbbbbbbbbbb"), null, "newer is fine (the server deploy may lag)");
  assert.equal(staleBuild(null, "20261106T120000-bbbbbbbbbbbb"), null, "a repo checkout (dev, dry run)");
  assert.equal(staleBuild("20261105T200000-aaaaaaaaaaaa", null), null);
  assert.equal(buildOf(ENGINE), null, "the repo has no BUILD_ID (only an image does)");
  const events = [];
  const before = fs.readdirSync(os.tmpdir()).filter((f) => f.startsWith("bw-prepare-")).length;
  const r = await runJob({ role: "prepare", minBuild: "20261106T120000-bbbbbbbbbbbb", prepare: { voice: { put: "x" } } }, { build: "20261105T200000-aaaaaaaaaaaa", post: async (e, d) => events.push([e, d.code]) });
  assert.equal(r.ok, false); assert.equal(r.code, "STALE_WORKER");
  assert.deepEqual(events, [["failed", "STALE_WORKER"]]);
  assert.equal(fs.readdirSync(os.tmpdir()).filter((f) => f.startsWith("bw-prepare-")).length, before, "no temp folder: nothing started");
  const handler = fs.readFileSync(path.join(ENGINE, "runpod", "handler.py"), "utf8");
  assert.match(handler, /\("NO_GPU", "STALE_WORKER"\)/, "handler.py retires a stale worker");
});

test("server: a STALE_WORKER try is retried on another worker and not counted as a failed try", () => {
  const now = Date.parse("2026-11-06T12:00:00Z");
  const j = (attempt, code, ago) => ({ role: "prepare", idx: 0, attempt, state: "failed", error_code: code, finished_at: new Date(now - ago * 1000).toISOString() });
  assert.equal(retryOf([j(1, "STALE_WORKER", 5)], "prepare", now).do, "wait");
  assert.deepEqual(retryOf([j(1, "STALE_WORKER", 60)], "prepare", now), { do: "dispatch", attempt: 2 });
  // prepare has 2 tries: one real failure + stale ones still leave a try
  assert.equal(retryOf([j(1, "RENDER_FAILED", 60), j(2, "STALE_WORKER", 60)], "prepare", now).do, "dispatch");
  assert.equal(retryOf([1, 2, 3, 4, 5].map((a) => j(a, "STALE_WORKER", 60)), "prepare", now).do, "fail", "capped like NO_GPU");
});

test("setup: every worker not on the new template + image is terminated, then it waits until none is left", async () => {
  const NEW = { templateId: "zgm9yzlviz", image: "img@sha256:eed7" };
  let workers = [
    { id: "old1", templateId: "rvi77mhbzt", imageName: "img@sha256:a5af", desiredStatus: "RUNNING" },
    { id: "old2", templateId: "rvi77mhbzt", imageName: "img@sha256:a5af", desiredStatus: "EXITED" },
    { id: "new1", templateId: "zgm9yzlviz", imageName: "img@sha256:eed7", desiredStatus: "RUNNING" },
    { id: "gone", templateId: "rvi77mhbzt", imageName: "img@sha256:a5af", desiredStatus: "TERMINATED" },
  ];
  assert.deepEqual(staleWorkers(workers, NEW).map((w) => w.id), ["old1", "old2"]);
  const terminated = [], polls = [];
  const api = {
    workers: async () => { polls.push(1); return workers; },
    // RunPod takes a poll to drop them
    terminate: async (id) => { terminated.push(id); setTimeout(() => {}, 0); workers = workers.map((w) => (w.id === id ? { ...w, desiredStatus: polls.length >= 2 ? "TERMINATED" : w.desiredStatus } : w)); },
  };
  let t = 0;
  const r = await retireStale({ api, endpointId: "gm9", ...NEW, sleep: async (ms) => { t += ms; workers = workers.map((w) => (terminated.includes(w.id) ? { ...w, desiredStatus: "TERMINATED" } : w)); }, now: () => t, log: () => {} });
  assert.deepEqual(r.retired.sort(), ["old1", "old2"]);
  assert.ok(!terminated.includes("new1"));
  // a worker RunPod never drops: setup stops loudly (no switch reported as done)
  const stuck = { workers: async () => [{ id: "old9", templateId: "x", imageName: "y", desiredStatus: "RUNNING" }], terminate: async () => {} };
  let t2 = 0;
  await assert.rejects(retireStale({ api: stuck, endpointId: "gm9", ...NEW, timeoutMs: 30000, pollMs: 10000, sleep: async (ms) => { t2 += ms; }, now: () => t2, log: () => {} }), /old workers still alive.*old9/);
});

test("buildContext: a build id orders by time and names the content; fly.toml points at the staging app", () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "bw-buildid-"));
  try {
    fs.mkdirSync(path.join(d, "engine"), { recursive: true });
    fs.writeFileSync(path.join(d, "engine", "a.js"), "1");
    const a = buildId(d, { now: new Date("2026-11-06T12:00:00Z") });
    assert.match(a, /^20261106T120000-[0-9a-f]{12}$/);
    fs.writeFileSync(path.join(d, "engine", "BUILD_ID"), a);
    assert.equal(buildId(d, { now: new Date("2026-11-06T12:00:00Z") }), a, "BUILD_ID itself is not hashed");
    fs.writeFileSync(path.join(d, "engine", "a.js"), "2");
    assert.notEqual(buildId(d, { now: new Date("2026-11-06T12:00:00Z") }), a);
    assert.match(FLY_TOML, /app = "zyvo-cutaway-render-staging"/); assert.match(FLY_TOML, /primary_region = "fra"/); assert.match(FLY_TOML, /dockerfile = "Dockerfile"/);
    assert.match(fs.readFileSync(path.join(ENGINE, "runpod", "Dockerfile"), "utf8"), /COPY engine\/BUILD_ID/);
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

// ------------------------------------------------------------------ review C / D / E (human-eye review of the run)
const linesOfShots = (tl, i) => tl.shots.filter((s) => (s.lines ?? [s.line]).includes(i));

test("D: the army is on screen on every soldiers / boots / helmets / torches / marching line; the wolf leads it, big", async () => {
  const tl = await timeline();
  const ARMY = /\b(soldiers?|army|boots|helmets?|torch(es)?|marching|marched)\b/i;
  R.lines.forEach((l, i) => {
    if (!ARMY.test(l.text)) return;
    assert.ok(linesOfShots(tl, i).some((s) => (s.crowds ?? []).some((c) => /soldier/.test(c.kind))), `line ${i}: ${l.text}`);
  });
  assert.ok(tl.giants?.wolf, "the wolf is a giant");
  assert.ok(linesOfShots(tl, 1).some((s) => (s.giants ?? []).some((g) => g.id === "wolf")), "the wolf is in 'a wolf and his army'");
});

test("E: perception verbs and the army's gear never make a hand prop; absent is absent; a chair left behind is empty; carried off has its takers", async () => {
  assert.equal(notInHand("But I hear the boots before anyone else.", "boot"), true);
  assert.equal(notInHand("Wolf ears on every helmet.", "helmet"), true);
  assert.equal(notInHand("I grabbed the torch and ran.", "torch"), false);
  assert.equal(notInHand("I yanked open the drawer and grabbed the watch.", "watch"), false);
  const tl = await timeline();
  for (const i of [14, 22, 25, 26, 33]) for (const s of linesOfShots(tl, i)) {
    assert.ok(!(s.actors ?? []).some((a) => /boot|helmet|shoe|torch/.test(a.hold ?? "")), `line ${i}: ${JSON.stringify(s.actors)}`);
    assert.ok(!(s.objects ?? []).some((o) => o.name === "item" && ["shoe", "helmet"].includes(o.state)), `line ${i}: a loose boot / helmet`);
  }
  for (const s of linesOfShots(tl, 6)) assert.deepEqual(s.actors ?? [], [], "her chair: nobody sits in it");
  for (const s of linesOfShots(tl, 45)) assert.ok(!(s.actors ?? []).some((a) => /^town\d$/.test(a.id)) && !(s.crowds ?? []).some((c) => c.kind === "townsfolk"), "the street was empty");
  for (const s of linesOfShots(tl, 5)) {
    assert.ok(!(s.actors ?? []).some((a) => a.pose === "carry" && !a.hold), "no empty carry pose");
    assert.ok((s.crowds ?? []).some((c) => /soldier/.test(c.kind)), "the takers are there");
  }
  // "outside our door" plays inside the shell (no field with a DOOR badge)
  for (const s of linesOfShots(tl, 26)) assert.equal(s.set, "creature:turtle_inside");
  // meaningPass leaves a story without an army alone ("is carried off" by a monster)
  const shots = [{ line: 0, camera: "medium", set: "street", actors: [{ id: "me", pose: "carry", hold: null }] }];
  assert.equal(meaningPass(shots, [{ text: "Whatever crosses the stripe is carried off." }]), 0);
});

test("C: lookalikes and specks don't count (a street clock is no pocket watch, a far figure is no person)", async () => {
  assert.ok(!OBJECT_CATALOG.clock.aliases.includes("watch"));
  const key = { kind: "person", id: "grandpa", label: "Grandpa" };
  assert.equal(covers(key, { camera: "establish", focus: "world", actors: [{ id: "grandpa" }] }), false);
  assert.equal(covers(key, { camera: "hero_low", focus: "grandpa", actors: [{ id: "grandpa" }] }), true);
  assert.equal(covers(key, { camera: "medium", focus: "me", actors: [{ id: "grandpa" }] }), true);
  const tl = await timeline();
  // the watch lines: never a clock standing in; the watch is a builder need (or its card) until something builds it
  for (const i of [17, 36, 38, 47, 49]) for (const s of linesOfShots(tl, i)) assert.ok(!(s.objects ?? []).some((o) => o.name === "clock"), `line ${i}`);
  assert.ok(tl.needs.some((n) => n.name === "watch"), JSON.stringify(tl.needs.map((n) => n.name)));
});
