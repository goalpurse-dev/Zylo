// node --test dev/builder.test.mjs   (lib/builder: specs, the library, resolveNeeds with the free mock, apply + re-check)
// No network, no Chrome (the still renderer is stubbed here; dev/builderRender.test.mjs renders for real).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { validateBlueprint, validateWorld, normName, LIMITS } from "../lib/builder/spec.js";
import { memoryCache, fileCache, snapshotCache } from "../lib/builder/cache.js";
import { resolveNeeds, cardOf, makePurse, buildableNeed } from "../lib/builder/resolve.js";
import { mockProvider, MOCK_OBJECTS, MOCK_WORLDS } from "../lib/builder/mock.js";
import { needsFromTimeline, applyResolved } from "../lib/builder/apply.js";
import { makeBuilder } from "../lib/builder/index.js";
import { blueprintSchema, worldSchema, objectPrompt, OBJECT_SYSTEM, WORLD_SYSTEM, EXAMPLES, worstCaseUsd, costOf, anthropicProvider, tokensFor, MAX_TOKENS } from "../lib/builder/design.js";
import { planVideo, checkTimeline, checkSubjects, checkVisuals, worldNeedOf } from "../plan.mjs";

const still = async () => ({ jpeg: Buffer.from("jpeg"), file: null, w: 768, h: 768 });
const need = (name, kind = "object", extra = {}) => ({ id: `n-${kind}-${name}`, kind, name, phrase: name, line: 0, lineText: `the ${name}`, ...extra });
const noKit = { has: () => null };

// ------------------------------------------------------------------------------------------ specs
test("blueprint: limits, clamps, bad colours, unknown shapes / fields, cycles; never throws", () => {
  const parts = Array.from({ length: 130 }, (_, i) => ({ id: `p${i}`, shape: "box", size: [1, 1, 1], pos: [0, 0.5, 0], color: "#ff0000" }));
  const v = validateBlueprint({ name: "x", parts });
  assert.equal(v.blueprint.parts.length, LIMITS.parts);
  assert.ok(v.problems.some((p) => /only the first 120/.test(p)));
  const w = validateBlueprint({ name: "y", height: 1e9, evil: "<script>", parts: [
    { id: "a", shape: "blob", size: [999, -5, "x"], pos: [1e6, 0, 0], color: "red", material: "lava", parent: "b" },
    { id: "b", shape: "sphere", size: [1, 1, 1], color: "#0F0", parent: "a" },
    { id: "b", shape: "torus", size: [1, 1, 0.2], color: "#123456", __proto__: { hacked: true } },
  ], labels: [{ part: "nope", text: "HI" }, { part: "a", text: "" }, { part: "a", text: "A VERY LONG LABEL THAT GOES ON AND ON", face: "up" }], anims: [{ part: "a", kind: "explode" }, { part: "b", kind: "spin", speed: 99 }] });
  const [a, b, c] = w.blueprint.parts;
  assert.equal(w.blueprint.height, LIMITS.objectHeight[1]);
  assert.equal(a.shape, "box"); assert.equal(a.color, "#9aa4ad"); assert.equal(a.material, "matte");
  assert.deepEqual(a.size, [30, 0.02, 0.3]); assert.equal(a.pos[0], LIMITS.pos);
  assert.equal(b.color, "#00ff00");
  assert.ok(!("parent" in a) || !("parent" in b), "the parent cycle is broken");
  assert.notEqual(c.id, "b", "a duplicate id is renamed");
  assert.equal(w.blueprint.labels.length, 1); assert.equal(w.blueprint.labels[0].text.length, LIMITS.textLen); assert.equal(w.blueprint.labels[0].face, "front");
  assert.equal(w.blueprint.anims.length, 1); assert.equal(w.blueprint.anims[0].speed, 6);
  assert.ok(!("evil" in w.blueprint));
  for (const junk of [null, undefined, 42, "x", [], { parts: "no" }, { parts: [null, 1, "a"] }]) {
    const r = validateBlueprint(junk);
    assert.ok(Array.isArray(r.blueprint.parts) && r.problems.length > 0);
  }
});

test("blueprint: the hand-written examples and mocks are clean", () => {
  for (const bp of [...EXAMPLES, ...Object.values(MOCK_OBJECTS)]) assert.deepEqual(validateBlueprint(bp).problems, [], bp.name);
  for (const w of Object.values(MOCK_WORLDS)) assert.deepEqual(validateWorld(w).problems, [], w.name);
});

test("world spec: defaults, enums, nested blueprints validated, never throws", () => {
  const { spec, problems } = validateWorld({ kind: "spaceship", ground: { material: "cheese" }, enclosure: { type: "moon" }, palette: ["#fff", "nope", "#000000"], props: [{ spot: "under", blueprint: { parts: [{ shape: "box", size: [1, 1, 1], color: "#fff" }] } }, { kit: "" }], landmark: { parts: [] } });
  assert.equal(spec.kind, "outdoor"); assert.equal(spec.ground.material, "dirt"); assert.equal(spec.enclosure.type, "sky");
  assert.deepEqual(spec.palette, ["#ffffff", "#000000"]);
  assert.equal(spec.props.length, 1); assert.equal(spec.props[0].spot, "scatter");
  assert.equal(spec.landmark, null);
  assert.ok(problems.length >= 4);
  for (const junk of [null, "x", { props: 5, light: "bright" }]) assert.ok(validateWorld(junk).spec.ground);
});

test("schemas: structured-output safe (no maxItems / min / max), prompts carry the style + examples", () => {
  const s = JSON.stringify([blueprintSchema(), worldSchema()]);
  assert.doesNotMatch(s, /maxItems|minItems|minimum|maximum/);
  assert.match(OBJECT_SYSTEM, /LOCKED LOOK/); assert.match(OBJECT_SYSTEM, /fire hydrant/); assert.match(WORLD_SYSTEM, /inside_creature/);
  assert.match(objectPrompt({ need: need("ladder"), feedback: "make the rungs bigger" }), /make the rungs bigger/);
  assert.ok(worstCaseUsd("claude-sonnet-5-5", "design", "object") > 0.05 && worstCaseUsd("claude-haiku-5-5", "vision", "object") < 0.01);
  assert.equal(costOf("claude-sonnet-5-5", { input_tokens: 1e6, output_tokens: 1e6 }), 12);
});

// ------------------------------------------------------------------------------------------ the library
test("library: lookup by name, alias, singular / plural; the first save wins", async () => {
  assert.equal(normName("The Ladders"), "ladder"); assert.equal(normName("robot_dentists"), "robot dentist"); assert.equal(normName("boxes"), "box"); assert.equal(normName("glass"), "glass"); assert.equal(normName("wolves"), "wolf");
  for (const cache of [memoryCache(), fileCache(fs.mkdtempSync(path.join(os.tmpdir(), "bw-lib-")))]) {
    const a = await cache.save({ kind: "object", name: "robot dentist", aliases: ["dentist robot", "robo dentists"], blueprint: MOCK_OBJECTS["robot dentist"], still: Buffer.from("x") });
    assert.ok(a.id);
    assert.equal((await cache.lookup("object", ["Robot Dentists"]))?.id, a.id);
    assert.equal((await cache.lookup("object", ["robo dentist"]))?.id, a.id);
    assert.equal((await cache.lookup("object", ["nope", "the dentist robot"]))?.id, a.id);
    assert.equal(await cache.lookup("world", ["robot dentist"]), null, "kinds are separate");
    const b = await cache.save({ kind: "object", name: "Robot dentist", aliases: [], blueprint: {} });
    assert.equal(b.id, a.id);
    await cache.used(a.id);
    if (cache.name === "file") { assert.ok(fs.existsSync(path.join(cache.dir, a.still_path))); assert.equal((await cache.lookup("object", ["robot dentist"])).uses, 1); }
  }
  const saved = [];
  const snap = snapshotCache([{ id: "old", kind: "world", name: "cave town", aliases: [], blueprint: {} }], { onSave: async (r) => saved.push(r.name) });
  assert.equal((await snap.lookup("world", ["cave towns"])).id, "old");
  await snap.save({ kind: "object", name: "kazoo", aliases: [], blueprint: {} });
  assert.deepEqual(saved, ["kazoo"]); assert.equal(snap.added.length, 1);
});

// ------------------------------------------------------------------------------------------ resolveNeeds
test("resolve: kit hit, library hit, design + pass (saved to the library)", async () => {
  const cache = memoryCache([{ id: "lib1", kind: "object", name: "kazoo", aliases: ["kazoos"], blueprint: {} }]);
  const prov = mockProvider();
  const kit = { has: (n) => (n.name === "ladder" ? "ladder" : null) };
  const { results, report } = await resolveNeeds([need("ladder"), need("kazoos"), need("robot dentist")], { provider: prov, cache, render: still, kit });
  assert.equal(results["n-object-ladder"].source, "kit");
  assert.equal(results["n-object-kazoos"].source, "cache"); assert.equal(results["n-object-kazoos"].asset.id, "lib1");
  const r = results["n-object-robot dentist"];
  assert.equal(r.source, "built"); assert.equal(r.attempts, 1); assert.ok(r.asset.blueprint.parts.length > 10);
  assert.ok(await cache.lookup("object", ["robot dentists"]), "saved for the next video");
  assert.equal(prov.calls.design, 1); assert.equal(prov.calls.vision, 1);
  assert.equal(report.kit, 1); assert.equal(report.cached, 1); assert.equal(report.built, 1); assert.equal(report.cards, 0);
});

test("resolve: design + vision fail + retry with the fix + pass", async () => {
  const seen = [];
  const prov = mockProvider({ failVision: { "robot dentist": 1 } });
  const wrapped = { ...prov, designObject: (a) => { seen.push(a.feedback); return prov.designObject(a); } };
  const { results } = await resolveNeeds([need("robot dentist")], { provider: wrapped, cache: memoryCache(), render: still, kit: noKit });
  const r = results["n-object-robot dentist"];
  assert.equal(r.source, "built"); assert.equal(r.attempts, 2);
  assert.equal(seen[0], null); assert.match(seen[1], /key feature bigger/);
  assert.equal(r.verdicts[0].ok, false); assert.equal(r.verdicts[1].ok, true);
});

test("resolve: three failed designs -> a picture card (never a failed run); errors and refusals too", async () => {
  const prov = mockProvider({ throwOn: ["broken toaster"] });
  const { results, report } = await resolveNeeds([need("kazoo"), need("broken toaster"), need("inside a moon base", "world")], { provider: prov, cache: memoryCache(), render: still, kit: noKit });
  for (const id of ["n-object-kazoo", "n-object-broken toaster", "n-world-inside a moon base"]) {
    assert.equal(results[id].source, "card", id); assert.equal(results[id].attempts, 3, id);
    assert.equal(results[id].card.kind, "card"); assert.ok(results[id].card.text.length > 0);
  }
  assert.equal(results["n-object-kazoo"].card.text, "KAZOO");
  assert.equal(report.cards, 3);
  // a still renderer that throws, a vision that throws: still a card, no throw
  const bad = await resolveNeeds([need("ladder")], { provider: mockProvider(), cache: memoryCache(), render: async () => { throw new Error("no GPU"); }, kit: noKit });
  assert.equal(bad.results["n-object-ladder"].source, "card");
  // the builder off: kit / library only
  const off = await resolveNeeds([need("ladder")], { provider: null, cache: memoryCache(), render: still, kit: noKit });
  assert.equal(off.results["n-object-ladder"].source, "card"); assert.match(off.results["n-object-ladder"].reason, /off/);
});

test("resolve: the money cap -> cards (the worst cases in flight always fit; a need waits, then stops); the design cap", async () => {
  // worst $0.2 a need (design 0.1 + vision 0.1), actual $0.1: under $0.25 only one fits at a time; after it, $0.1 spent
  // + $0.2 worst > $0.25 with nothing in flight -> the rest are cards
  const prov = { ...mockProvider({ costUsd: 0.05 }), worstCase: () => 0.1 };
  const { results, report } = await resolveNeeds([need("ladder"), need("robot dentist"), need("giant heart")], { provider: prov, cache: memoryCache(), render: still, kit: noKit, budget: { maxUsd: 0.25 } });
  const srcs = Object.values(results).map((r) => r.source).sort();
  assert.deepEqual(srcs, ["built", "card", "card"]);
  assert.match(Object.values(results).find((r) => r.source === "card").reason, /money cap/);
  assert.ok(report.costUsd <= 0.25);
  // with $0.45 the waiting needs get their turn as the first ones settle: all three built, never over the cap
  const more = await resolveNeeds([need("ladder"), need("robot dentist"), need("giant heart")], { provider: prov, cache: memoryCache(), render: still, kit: noKit, budget: { maxUsd: 0.45 } });
  assert.deepEqual(Object.values(more.results).map((r) => r.source), ["built", "built", "built"]);
  assert.ok(more.report.costUsd <= 0.45);
  const few = await resolveNeeds([need("ladder"), need("robot dentist")], { provider: mockProvider(), cache: memoryCache(), render: still, kit: noKit, budget: { maxDesigns: 1 } });
  assert.deepEqual(Object.values(few.results).map((r) => r.source).sort(), ["built", "card"]);
});

test("resolve: needs run in parallel; the time cap -> card; one design per distinct thing", async () => {
  const prov = mockProvider({ delayMs: 120 });
  let t = Date.now();
  const { results, report } = await resolveNeeds([need("ladder"), need("robot dentist"), need("giant heart"), { ...need("ladders"), id: "dup" }], { provider: prov, cache: memoryCache(), render: still, kit: noKit });
  const ms = Date.now() - t;
  assert.ok(ms < 700, `parallel: ${ms} ms for 3 x (design 120 + vision 120)`);
  assert.equal(prov.calls.design, 3, "ladder and ladders share one design");
  assert.equal(results.dup.source, "built"); assert.equal(report.built, 4);
  t = Date.now();
  const slow = await resolveNeeds([need("ladder")], { provider: mockProvider({ delayMs: 400 }), cache: memoryCache(), render: still, kit: noKit, budget: { maxMs: 150 } });
  assert.equal(slow.results["n-object-ladder"].source, "card"); assert.match(slow.results["n-object-ladder"].reason, /time cap/);
  assert.ok(Date.now() - t < 350);
});

test("purse: realistic estimate + worst cases in flight; waits instead of giving up; never over the cap", async () => {
  const p = makePurse({ maxUsd: 0.25, parallel: 3 });
  const c = { est: 0.027, worst: 0.08, min: 0.055 };
  const g = [p.tryAcquire(c), p.tryAcquire(c), p.tryAcquire(c)];
  assert.ok(g.every(Boolean), "three need-sized worst cases fit under $0.25");
  assert.equal(p.tryAcquire(c), null, "a fourth waits (parallel limit)");
  const waiting = p.acquire(c, Date.now() + 1000);
  p.release(g[0], 0.02);
  const g4 = await waiting; assert.ok(g4.worst > 0, "it starts once one settles");
  for (const x of [g[1], g[2], g4]) p.release(x, 0.025);
  assert.ok(Math.abs(p.spent - 0.095) < 1e-9);
  // near the end: $0.2 spent, $0.05 left -> below the smallest ceiling, nothing in flight: stop (no overspend)
  const q = makePurse({ maxUsd: 0.25 }); const a = q.tryAcquire({ est: 0.2, worst: 0.2 }); q.release(a, 0.2);
  assert.deepEqual(await q.acquire(c), { stop: "worst" });
  // $0.18 spent: the realistic estimate fits and a SMALLER ceiling (>= min) is granted
  const r = makePurse({ maxUsd: 0.25 }); r.release(r.tryAcquire({ est: 0.18, worst: 0.18 }), 0.18);
  const s = await r.acquire(c); assert.ok(s.worst >= c.min && s.worst <= 0.07 + 1e-9, JSON.stringify(s));
});

test("resolve: the measured typical cost lets 5 needs run under $0.25 (the dog run carded 4 of 5); actual spend under the cap", async () => {
  // the dog run's shape: worst $0.13 a need under the old ceilings; actual ~$0.027 a need
  const m = mockProvider({ costUsd: 0.0135, delayMs: 20 });
  const base = { ...m, vision: async () => { await new Promise((r) => setTimeout(r, 20)); return { data: { ok: true, confidence: 0.9, reads_as: "it" }, costUsd: 0.0135 }; } };
  const prov = { ...base, worstCase: (k, s) => (s === "vision" ? 0.0155 : 0.065), typicalCase: (k, s) => (s === "vision" ? 0.005 : 0.022), minCase: (k, s) => (s === "vision" ? 0.0155 : 0.045) };
  const names = ["ladder", "robot dentist", "giant heart", "kazoo", "garden hose"];
  const { results, report } = await resolveNeeds(names.map((n) => need(n)), { provider: prov, cache: memoryCache(), render: still, kit: noKit, budget: { maxUsd: 0.25 } });
  const reasons = Object.values(results).map((r) => r.reason ?? "");
  assert.ok(!reasons.some((x) => /money cap/.test(x)), reasons.join(" | "));
  assert.ok(report.costUsd <= 0.25);
  // the old worst cases ($0.099 + $0.032) with a typical estimate: still never over the cap, the rest wait or stop
  const old = { ...base, worstCase: (k, s) => (s === "vision" ? 0.032 : 0.099), typicalCase: (k, s) => (s === "vision" ? 0.005 : 0.022) };
  const o = await resolveNeeds(names.map((n) => need(n)), { provider: old, cache: memoryCache(), render: still, kit: noKit, budget: { maxUsd: 0.25 } });
  assert.ok(o.report.costUsd <= 0.25);
  assert.ok(Object.values(o.results).filter((r) => r.source === "built").length >= 4, "waiting instead of giving up builds most of them");
});

test("buildableNeed: only concrete things are designed (the test runs paid for 'nos', 'bite', 'block', 'soggy', 'dusty')", async () => {
  for (const w of ["nos", "bite", "block", "soggy", "dusty", "the town's nose", "Biscuit", "running", "something"]) assert.equal(buildableNeed({ kind: "object", name: w }).ok, false, w);
  for (const w of ["lunchbox", "dusty plaque", "faded dog collar", "cracked bell tower", "festival lanterns on a line", "cat", "giant tooth", "garden hose", "ladder"]) assert.equal(buildableNeed({ kind: "object", name: w }).ok, true, w);
  assert.equal(buildableNeed({ kind: "world", name: "the town" }).ok, true);
  const prov = mockProvider();
  const { results } = await resolveNeeds([need("bite"), need("soggy")], { provider: prov, cache: memoryCache(), render: still, kit: noKit });
  assert.equal(prov.calls.design, 0, "no paid design for a word that is no thing");
  assert.match(results["n-object-bite"].reason, /not a buildable thing/);
});

test("design: the ceilings fit three needs under $0.25; a grant shrinks max_tokens; costOf survives usage null", async () => {
  const worstNeed = worstCaseUsd("claude-sonnet-5-5", "design", "object") + worstCaseUsd("claude-sonnet-5-5", "vision", "object");
  assert.ok(3 * worstNeed <= 0.25, `worst a need $${worstNeed}`);
  assert.equal(costOf("claude-sonnet-5-5", null), 0);
  assert.ok(tokensFor("claude-sonnet-5-5", "design", "object", 0.045) < MAX_TOKENS.object);
  let sent = null;
  const fetchFn = async (url, init) => { sent = JSON.parse(init.body); return { ok: true, status: 200, json: async () => ({ model: "claude-sonnet-5-5", stop_reason: "end_turn", usage: { input_tokens: 10, output_tokens: 10 }, content: [{ type: "text", text: JSON.stringify(MOCK_OBJECTS.ladder) }] }) }; };
  const p = anthropicProvider({ apiKey: "fake", fetchFn });
  await p.designObject({ need: need("ladder") }); assert.equal(sent.max_tokens, MAX_TOKENS.object);
  await p.designObject({ need: need("ladder"), maxUsd: 0.045 }); assert.ok(sent.max_tokens < MAX_TOKENS.object && sent.max_tokens >= 2500, String(sent.max_tokens));
  assert.ok(p.typicalCase("object", "design") < p.worstCase("object", "design"));
});

test("cardOf: a clear card of that very thing", () => {
  assert.deepEqual(cardOf(need("kazoo")), { kind: "card", text: "KAZOO", icon: "🎺" });
  assert.equal(cardOf(need("inside a giant turtle", "world")).icon, "🐢");
});

// ------------------------------------------------------------------------------------------ the planner's needs + apply
const SCRIPT = { title: "The Shell", lines: [
  { part: "rule", text: "In this world, we all live inside a giant turtle." },
  { part: "tour", text: "Every morning Grandpa plays the kazoo for the whole town." },
  { part: "tour", text: "The doctor checks everyone's teeth at noon." },
  { part: "closer", text: "And the turtle never stops walking." }] };
const IDEA = { title: "The Shell", opener: SCRIPT.lines[0].text, setting: "inside something giant (an animal, a store, a tower)", mood: "funny" };
const checks = (tl) => [...checkTimeline(tl), ...checkSubjects(tl).map((x) => x.problem)];

test("worldNeedOf: settings the 4 sets fit -> none; giant / underwater / cave / unknown -> a world", () => {
  assert.equal(worldNeedOf(SCRIPT, IDEA).name, "inside a giant turtle");
  assert.equal(worldNeedOf(SCRIPT, { setting: "suburb street" }), null);
  assert.equal(worldNeedOf(SCRIPT, { setting: "school (hallway, cafeteria, classroom, stage)" }), null);
  assert.equal(worldNeedOf({ lines: [{ text: "In this town, the tide comes in twice a day." }] }, { setting: "underwater or submarine" }).name, "underwater town");
  assert.equal(worldNeedOf({ lines: [{ text: "In this town, nobody sees the sun." }] }, { setting: "underground or cave town" }).name, "cave town");
  assert.equal(worldNeedOf({ lines: [{ text: "In this world, a dentist's office is the whole town." }] }, { setting: "a dentist's office" }).name, "a dentist's office");
  assert.equal(worldNeedOf({ lines: [{ text: "In this world, we live on the moon." }] }, {}).name, "on the moon");
});

test("planner: a card for a noun and an unfitting setting become needs; the plan is clean without them", () => {
  const tl = planVideo({ script: SCRIPT, idea: IDEA });
  assert.deepEqual(checks(tl), []);
  const kinds = tl.needs.map((n) => `${n.kind}:${n.name}`);
  assert.ok(kinds.includes("object:kazoo") && kinds.includes("world:inside a giant turtle"), kinds.join(", "));
  assert.ok(tl.shots.some((s) => s.need?.id) && tl.shots.some((s) => s.world));
});

test("apply: built object + world go in, the checks stay clean; cards / fallback when not built", async () => {
  const kazoo = { name: "kazoo", height: 0.5, parts: [{ id: "body", shape: "cylinder", size: [0.1, 0.4, 0.1], pos: [0, 0.2, 0], rot: [0, 0, 0], color: "#ffd166", material: "metal" }] };
  const provider = { ...mockProvider(), designObject: async () => ({ data: kazoo, costUsd: 0 }) };
  const kit = (await import("../runpod/worker.mjs")).loadKit ? await (await import("../runpod/worker.mjs")).loadKit() : null;
  const tl = planVideo({ script: SCRIPT, idea: IDEA });
  const b = makeBuilder({ provider, cache: memoryCache(), render: still });
  const out = await b.buildFor(tl, { plan: { checkTimeline, checkSubjects }, kit });
  assert.deepEqual(checks(tl), [], "the narration check passes with the built things in");
  assert.deepEqual(checkVisuals(tl, SCRIPT), []);
  assert.ok(out.applied.some((a) => a.need === "kazoo") && out.applied.some((a) => a.kind === "world"), JSON.stringify(out));
  assert.ok(tl.shots.some((s) => (s.objects ?? []).some((o) => o.asset && tl.assets[o.asset].kind === "object")), "the kazoo stands in a shot");
  assert.ok(tl.shots.every((s) => !s.need && !s.world), "no planner markers left");
  assert.ok(tl.shots.some((s) => /^world:/.test(s.set)) && Object.values(tl.assets).some((a) => a.kind === "world"));
  assert.ok(!tl.shots.some((s) => s.insert?.text === "KAZOO"), "the card gave its time back");
  // the builder off: the plan stays exactly as planned (cards, the fallback set)
  const tl2 = planVideo({ script: SCRIPT, idea: IDEA });
  const off = await makeBuilder({ provider: null, cache: memoryCache(), render: still }).buildFor(tl2, { plan: { checkTimeline, checkSubjects }, kit });
  assert.deepEqual(checks(tl2), []);
  assert.ok(tl2.shots.some((s) => s.insert?.text === "KAZOO") && tl2.shots.every((s) => !/^world:/.test(s.set)) && !tl2.assets);
  assert.equal(off.cards.length, 2);
});

test("apply: a change that would break the narration check is undone (the card stays)", async () => {
  const tl = planVideo({ script: SCRIPT, idea: IDEA });
  const needs = needsFromTimeline(tl, {});
  const n = needs.find((x) => x.kind === "object");
  const results = { [n.id]: { source: "built", asset: { id: "a1", kind: "object", name: "kazoo", aliases: [], blueprint: { parts: [] } } } };
  let calls = 0;
  const r = applyResolved(tl, needs, results, { check: () => (calls++ ? ["made up problem"] : []) });
  assert.equal(r.reverted.length, 1); assert.equal(r.applied.length, 0);
  assert.ok(tl.shots.some((s) => s.insert?.text === "KAZOO") && !tl.assets);
});

test("apply: an object on screen the kit can't build is a need (never KIT_MISSING); unbuilt -> removed + badge / card", () => {
  const kit = { resolveObject: (x) => (x === "car" ? "car" : null) };
  const tl = { shots: [{ line: 0, set: "street", camera: "wide", focus: "me", actors: [{ id: "me", spot: "center" }], objects: [{ name: "golf_cart", spot: "left" }] }, { line: 1, set: "street", camera: "insert", focus: "object", actors: [], objects: [{ name: "bathtub", spot: "center" }] }] };
  const needs = needsFromTimeline(tl, { kit });
  assert.deepEqual(needs.map((x) => x.name), ["golf cart", "bathtub"]);
  const results = { [needs[0].id]: { source: "card", card: cardOf(needs[0]) }, [needs[1].id]: { source: "built", asset: { id: "tub", kind: "object", name: "bathtub", aliases: ["bath"], blueprint: { parts: [] } } } };
  applyResolved(tl, needs, results, {});
  assert.equal(tl.shots[0].objects.length, 0); assert.match(tl.shots[0].marker.text, /GOLF CART|CART/);
  assert.equal(tl.shots[1].objects[0].asset, "tub"); assert.equal(tl.assets.tub.kind, "object");
});
