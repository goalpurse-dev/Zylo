// node --test dev/builderFix2.test.mjs   (BUILDER-FIX-2, 2026-11-09: from the BUILDS run's ledger)
//   A. the names a built thing is saved under (names.js) + the library match needs the head noun (cache.js)
//   B. the free connectivity check / repair of a blueprint (connect.js) before the still + the paid vision check
//   C. buildableNeed: "-ing" nouns ("shell opening") are things, not verbs
// No network, no Chrome, no paid call.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanAliases, aliasProblem, sameThing, parseName } from "../lib/builder/names.js";
import { memoryCache, snapshotCache } from "../lib/builder/cache.js";
import { checkConnected, repairBlueprint, partBoxes, boxesTouch } from "../lib/builder/connect.js";
import { validateBlueprint } from "../lib/builder/spec.js";
import { resolveNeeds, buildableNeed } from "../lib/builder/resolve.js";
import { MOCK_OBJECTS, MOCK_WORLDS } from "../lib/builder/mock.js";
import { EXAMPLES, OBJECT_SYSTEM } from "../lib/builder/design.js";

// ------------------------------------------------------------------------------------------ A. names
// the designer aliases the BUILDS run saved (scratchpad/builds/library/index.json), long look phrases shortened
const LEDGER_NAMES = {
  "brass bell tower": ["bell tower", "brass bell tower", "bell towers", "tower", "belfry", "clock tower", "the tower", "a tall cream plaster bell tower with a terracotta pointed roof and an open belfry at the top"],
  "clock tower": ["clock tower", "clock towers", "clocktower", "bell tower", "town clock", "tower", "a tall old cream stone clock tower with a big white clock face"],
  curtain: ["curtain", "curtains", "drapes", "window curtain", "window", "a window with thick heavy curtains on a rod, drawn half open"],
  "cart of pumpkins": ["cart of pumpkins", "pumpkin cart", "pumpkins cart", "hand cart", "wooden cart", "cart", "pumpkins", "wheelbarrow of pumpkins"],
  "Odette's cottage": ["Odette's cottage", "cottage", "ground floor cottage", "little house", "ground-level house", "cottages", "Odette's house"],
  "tall stilt houses with coin gauges": ["stilt house", "stilt houses", "tall stilt house", "stilt", "stilts", "coin gauge", "coin gauges", "house on a stilt", "timber house"],
  "big main pipe": ["big main pipe", "main pipe", "big pipe", "brass pipe", "pipes", "thick pipe"],
  "Dirt Fee slot": ["dirt fee slot", "dirt fee box", "coin slot", "fee slot", "coin box"],
};

test("names: only names of THAT thing are saved (head noun or a true synonym, no other objects, no long phrases)", () => {
  const keep = Object.fromEntries(Object.entries(LEDGER_NAMES).map(([n, a]) => [n, cleanAliases(n, a).map((x) => x.toLowerCase())]));
  assert.deepEqual(keep["brass bell tower"], ["bell tower", "belfry"]);
  assert.deepEqual(keep["clock tower"], ["clocktower"]);
  assert.deepEqual(keep.curtain, ["drapes"]);
  assert.deepEqual(keep["cart of pumpkins"], ["pumpkin cart"]);
  assert.deepEqual(keep["Odette's cottage"], []);
  assert.ok(keep["tall stilt houses with coin gauges"].includes("stilt house"));
  for (const [n, k] of Object.entries(keep)) for (const a of k) {
    assert.ok(a.split(" ").length <= 5 && a.length <= 40, `${n}: "${a}" is a long phrase`);
    assert.ok(!/^(tower|cart|cottage|window|pumpkins?|stilts?|coin gauges?|clock tower|bell tower|coin slot)$/.test(a) || (n === "brass bell tower" && a === "bell tower"), `${n}: "${a}" kept`);
  }
  assert.match(aliasProblem("brass bell tower", "clock tower"), /another object/);
  assert.match(aliasProblem("cart of pumpkins", "cart"), /too generic/);
  assert.match(aliasProblem("curtain", "window"), /another thing/);
  assert.match(aliasProblem("curtain", "a window with thick heavy curtains on a rod, drawn half open"), /long phrase/);
  assert.deepEqual(cleanAliases("decorative wallet", ["wallet", "fancy wallet", "purse"]), ["wallet", "fancy wallet"]);
  assert.deepEqual(cleanAliases("robot dentist", ["dentist robot", "dentist", "robot"]), ["dentist robot"]);
  assert.equal(parseName("tiny glasses-shaped bell").head, "bell");
  assert.deepEqual(parseName("tiny glasses-shaped bell").mods, ["glass"]);
});

test("names: a library match needs the head noun and the asset's defining nouns ('clock tower' never gets the bell tower)", () => {
  const yes = [["bell tower", "brass bell tower"], ["belfry", "brass bell tower"], ["brass pipes", "big main pipe"], ["pumpkin cart", "cart of pumpkins"], ["Odette's cottage", "Odettes cottage"], ["stilt house", "tall stilt houses with coin gauges"], ["curtains", "curtain"], ["dentist robot", "robot dentist"], ["ladders", "ladder"]];
  const no = [["clock tower", "brass bell tower"], ["bell tower", "clock tower"], ["cart", "cart of pumpkins"], ["pumpkins", "cart of pumpkins"], ["cottage", "Odette's cottage"], ["window", "curtain"], ["coin slot", "Dirt Fee slot"], ["bell", "croissant bell"], ["croissant bell", "tiny glasses-shaped bell"], ["tower", "brass bell tower"]];
  for (const [r, n] of yes) assert.equal(sameThing(r, n), true, `${r} -> ${n}`);
  for (const [r, n] of no) assert.equal(sameThing(r, n), false, `${r} -> ${n}`);
});

test("library: rows saved before the fix (broad keys) no longer match the wrong thing; new saves carry clean keys", async () => {
  // the BUILDS run's bell tower, saved with its designer aliases as keys
  const legacy = { id: "bell", kind: "object", name: "brass bell tower", aliases: LEDGER_NAMES["brass bell tower"], keys: ["brass bell tower", "bell tower", "tower", "belfry", "clock tower"], blueprint: {} };
  for (const cache of [memoryCache([legacy]), snapshotCache([legacy])]) {
    assert.equal(await cache.lookup("object", ["clock tower", "a tall old cream stone clock tower"]), null, "the clock tower request never takes the bell tower");
    assert.equal(await cache.lookup("object", ["tower"]), null, "a bare tower request never takes the bell tower");
    assert.equal((await cache.lookup("object", ["bell towers"]))?.id, "bell");
    assert.equal((await cache.lookup("object", ["belfry"]))?.id, "bell");
  }
  const c = memoryCache();
  const r = await c.save({ kind: "object", name: "cart of pumpkins", aliases: LEDGER_NAMES["cart of pumpkins"], blueprint: {} });
  assert.deepEqual(r.keys, ["cart of pumpkin", "pumpkin cart"]);
  assert.equal(await c.lookup("object", ["cart"]), null);
  assert.equal((await c.lookup("object", ["pumpkin carts"]))?.id, r.id);
});

test("resolve: a built thing is saved without need.phrase and without the designer's broad names", async () => {
  const bp = validateBlueprint(EXAMPLES[1]).blueprint;
  const provider = {
    name: "fake", designModel: "fake",
    designObject: async () => ({ data: { ...JSON.parse(JSON.stringify(EXAMPLES[1])), name: "clock tower", aliases: ["clock tower", "tower", "bell tower", "clocktower", "a tall old cream stone clock tower with a big clock"] }, costUsd: 0.01 }),
    vision: async () => ({ data: { ok: true, confidence: 0.9, reads_as: "clock tower", fix: "" }, costUsd: 0.001 }),
  };
  void bp;
  const cache = memoryCache();
  const need = { id: "n1", kind: "object", name: "clock tower", phrase: "a tall old cream stone clock tower with a big white clock face near the top" };
  const { results } = await resolveNeeds([need], { provider, cache, render: async () => ({ jpeg: Buffer.from("x"), file: null }), budget: { maxUsd: 1 } });
  assert.equal(results.n1.source, "built");
  assert.deepEqual(cache.list[0].aliases, ["clocktower"]);
  assert.ok(!cache.list[0].keys.some((k) => k.split(" ").length > 5));
});

// ------------------------------------------------------------------------------------------ B. connectivity
const P = (id, shape, size, pos, extra = {}) => ({ id, shape, size, pos, rot: [0, 0, 0], color: "#d4a017", material: "metal", ...extra });
// The croissant bell and the glasses bell of the BUILDS run (their blueprints were not kept: the run saved only the
// built ones; these rebuild what the stills show: the hook stack hangs ~10% of the height above the bell)
export const CROISSANT_BELL = {
  name: "croissant bell", height: 0.9, parts: [
    P("beam", "box", [0.9, 0.08, 0.12], [0, 1.0, 0], { material: "wood", color: "#e8a060" }),
    P("hook_ring", "torus", [0.12, 0.12, 0.03], [0, 0.9, 0], { color: "#20c0b0" }),
    P("cap", "roundedBox", [0.12, 0.08, 0.1], [0, 0.8, 0], { color: "#20c0b0" }),
    P("crown", "box", [0.06, 0.04, 0.06], [0, 0.74, 0]),
    P("body_mid", "sphere", [0.36, 0.3, 0.3], [0, 0.45, 0]),
    P("body_l", "sphere", [0.26, 0.24, 0.24], [-0.25, 0.4, 0]), P("body_r", "sphere", [0.26, 0.24, 0.24], [0.25, 0.4, 0]),
    P("tip_l", "sphere", [0.18, 0.16, 0.18], [-0.42, 0.28, 0]), P("tip_r", "sphere", [0.18, 0.16, 0.18], [0.42, 0.28, 0]),
    P("clapper_rod", "cylinder", [0.03, 0.12, 0.03], [0, 0.24, 0]), P("clapper", "sphere", [0.08, 0.08, 0.08], [0, 0.16, 0], { color: "#20c0b0" }),
  ], anims: [{ part: "body_mid", kind: "swing", axis: "z", amount: 6, speed: 0.8 }],
};
export const GLASSES_BELL = {
  name: "tiny glasses-shaped bell", height: 0.4, parts: [
    P("lens_l", "torus", [0.26, 0.26, 0.05], [-0.21, 0.2, 0]), P("lens_r", "torus", [0.26, 0.26, 0.05], [0.21, 0.2, 0]),
    P("glass_l", "cylinder", [0.2, 0.02, 0.2], [-0.21, 0.2, 0], { rot: [90, 0, 0], material: "glass", color: "#bfe8ff" }),
    P("glass_r", "cylinder", [0.2, 0.02, 0.2], [0.21, 0.2, 0], { rot: [90, 0, 0], material: "glass", color: "#bfe8ff" }),
    P("bridge", "box", [0.12, 0.04, 0.04], [0, 0.24, 0]),
    P("temple_l", "box", [0.1, 0.03, 0.03], [-0.39, 0.28, -0.03], { color: "#ff7a50" }), P("temple_r", "box", [0.1, 0.03, 0.03], [0.39, 0.28, -0.03], { color: "#ff7a50" }),
    P("stem_low", "cylinder", [0.025, 0.1, 0.025], [0, 0.36, 0]),
    P("hook_ring", "torus", [0.07, 0.07, 0.02], [0, 0.44, 0], { color: "#20c0b0" }),
    P("stem_top", "cylinder", [0.025, 0.1, 0.025], [0, 0.52, 0], { color: "#20c0b0" }),
    P("clapper_rod", "cylinder", [0.02, 0.08, 0.02], [0, 0.185, 0.03], { color: "#ff7a50" }), P("clapper", "sphere", [0.07, 0.07, 0.07], [0, 0.12, 0.03], { color: "#ff5020" }),
  ], anims: [],
};
// the mock robot dentist's raised arm as it was before 2026-11-09 (rot signs backwards: the drill and its tip came apart)
const OLD_ROBOT = (() => {
  const r = JSON.parse(JSON.stringify(MOCK_OBJECTS["robot dentist"]));
  for (const p of r.parts) if (p.id === "arm_r") p.rot = [-60, 0, 20]; else if (p.id === "drill" || p.id === "drill_tip") p.rot = [-60, 0, 0];
  return r;
})();
const V = (raw) => validateBlueprint(raw).blueprint;
const shift = (raw, ids, d) => ({ ...raw, parts: raw.parts.map((p) => (ids.includes(p.id) ? { ...p, pos: p.pos.map((v, i) => v + d[i]) } : p)) });

test("connect: the box maths follows the engine (rot signs, pivots, parents carried by anims)", () => {
  // +x rot tips a cylinder's top toward the front (+z)
  const [b] = partBoxes(V({ parts: [P("c", "cylinder", [0.1, 1, 0.1], [0, 0, 0], { rot: [90, 0, 0] })] }));
  assert.ok(Math.abs(b.max[2] - 0.5) < 1e-6 && Math.abs(b.max[1] - 0.05) < 1e-6);
  // a swing on a part with its pivot at the top keeps the top in place; the child moves with it
  const bp = V({ parts: [P("rod", "box", [0.1, 1, 0.1], [0, 0.5, 0], { pivot: [0, 1, 0] }), P("ball", "sphere", [0.3, 0.3, 0.3], [0, 0, 0], { parent: "rod" })], anims: [{ part: "rod", kind: "swing", axis: "z", amount: 30, speed: 0.25 }] });
  const at = partBoxes(bp, 1); // sin(2pi * 0.25) = 1: 30 degrees
  assert.ok(Math.abs(at[0].max[1] - 1) < 0.06, "the top stays at the hinge");
  assert.ok(Math.abs(at[1].c[0] - Math.sin(30 * Math.PI / 180)) < 1e-6, "the child swings with it");
  assert.ok(boxesTouch(at[0], at[1], 0.01));
});

// (the BUILDS run's 10 built things, checked by hand 2026-11-09: 9 whole after free repair of anims; the decorative
// wallet's two bottom gems float 0.05 m in front of its body, closed for free by repairBlueprint)
test("connect: every known-good blueprint passes (the prompt examples, the mock kit)", () => {
  for (const raw of [...EXAMPLES, ...Object.values(MOCK_OBJECTS), ...MOCK_WORLDS["inside a giant turtle"].props.map((p) => p.blueprint)]) {
    const c = checkConnected(V(raw));
    assert.equal(c.ok, true, `${raw.name}: ${c.fix}`);
  }
});

test("connect: the croissant / glasses bells' floating hooks are caught with a precise move; small gaps are closed for free", () => {
  for (const raw of [CROISSANT_BELL, GLASSES_BELL]) {
    const c = checkConnected(V(raw));
    assert.equal(c.ok, false, raw.name);
    const f = c.floating[0];
    assert.ok(f.ids.includes("hook_ring"), `${raw.name}: ${JSON.stringify(f)}`);
    assert.ok(f.move[1] < 0 && f.move[0] === 0 && f.move[2] === 0, "moved straight down");
    assert.match(c.fix, /hook_ring|stem_low|crown/); assert.match(c.fix, /float [\d.]+ m above/); assert.match(c.fix, /pos \[/);
    const r = repairBlueprint(V(raw));
    assert.equal(r.check.ok, true, `${raw.name}: ${r.check.fix}`);
    assert.equal(r.snapped.length, 1);
    // nothing else moved
    const moved = r.blueprint.parts.filter((p, i) => p.pos.some((v, k) => v !== V(raw).parts[i].pos[k])).map((p) => p.id);
    assert.deepEqual(moved.sort(), [...f.ids].sort());
  }
  // a big gap stays the designer's job: rejected with the fix text
  const far = shift(GLASSES_BELL, ["stem_low", "hook_ring", "stem_top"], [0, 0.4, 0]);
  const r = repairBlueprint(V(far));
  assert.equal(r.check.ok, false); assert.equal(r.snapped.length, 0);
  assert.match(r.check.fix, /"stem_low", "hook_ring", "stem_top" float 0\.[345]\d* m above "(bridge|lens_[lr])".*move them by \[/);
});

test("connect: a part turned the wrong way (the mock robot's arm, rot signs) is caught as a rot error, never shifted", () => {
  const c = checkConnected(V(OLD_ROBOT));
  assert.equal(c.ok, false);
  assert.match(c.fix, /"drill".*turned so it misses it.*positive x-rot tips a part's top toward the FRONT/);
  const r = repairBlueprint(V(OLD_ROBOT));
  assert.equal(r.snapped.length, 0); assert.equal(r.check.ok, false);
  assert.equal(checkConnected(V(MOCK_OBJECTS["robot dentist"])).ok, true, "the fixed mock robot is whole");
});

test("connect: an anim that pulls parts apart is caught (a bob on the bell leaves the hook) and dropped for free; a small hovering part may bob", () => {
  const bob = { ...CROISSANT_BELL, parts: repairBlueprint(V(CROISSANT_BELL)).blueprint.parts, anims: [{ part: "body_mid", kind: "bob", axis: "y", amount: 0.1, speed: 1 }] };
  const c = checkConnected(V(bob));
  assert.equal(c.ok, false); assert.equal(c.floating.length, 0);
  assert.match(c.fix, /the bob on "body_mid" pulls/);
  const r = repairBlueprint(V(bob));
  assert.deepEqual(r.droppedAnims, ['bob on "body_mid"']); assert.equal(r.check.ok, true); assert.equal(r.blueprint.anims.length, 0);
  // the same bob with the hook parts as children: they move together, nothing comes apart
  const kids = { ...bob, parts: bob.parts.map((p) => (["crown", "cap", "hook_ring", "beam", "clapper_rod", "clapper", "body_l", "body_r", "tip_l", "tip_r"].includes(p.id) ? { ...p, parent: "body_mid" } : p)) };
  assert.equal(checkConnected(V(kids)).ok, true);
  // a coin hovering over a big box is its motion
  const coin = V({ parts: [P("box", "box", [1, 1, 1], [0, 0.5, 0]), P("coin", "cylinder", [0.1, 0.02, 0.1], [0, 1.01, 0])], anims: [{ part: "coin", kind: "bob", axis: "y", amount: 0.2, speed: 1 }] });
  assert.equal(checkConnected(coin).ok, true);
});

test("resolve: a loose design is rejected BEFORE the still and the vision call; the designer gets the fix; a small gap is fixed for free", async () => {
  const calls = { design: 0, still: 0, vision: 0 }, feedbacks = [];
  const far = shift(GLASSES_BELL, ["stem_low", "hook_ring", "stem_top"], [0, 0.4, 0]);
  const provider = {
    name: "fake", designModel: "fake",
    designObject: async ({ feedback }) => { calls.design++; feedbacks.push(feedback); return { data: JSON.parse(JSON.stringify(calls.design === 1 ? far : CROISSANT_BELL)), costUsd: 0.01 }; },
    vision: async () => { calls.vision++; return { data: { ok: true, confidence: 0.9, reads_as: "a bell", fix: "" }, costUsd: 0.001 }; },
  };
  const render = async (kind, spec) => { calls.still++; render.last = spec; return { jpeg: Buffer.from("x"), file: null }; };
  const logs = [];
  const { results } = await resolveNeeds([{ id: "b", kind: "object", name: "croissant bell", phrase: "a croissant bell" }], { provider, cache: memoryCache(), render, budget: { maxUsd: 1, retries: 2 }, log: (m) => logs.push(m) });
  assert.equal(results.b.source, "built");
  assert.deepEqual(calls, { design: 2, still: 1, vision: 1 }, "the loose design never reached the still or the vision check");
  assert.match(feedbacks[1], /parts come apart: .*float .* m above "(bridge|lens_[lr])".*move them by/);
  assert.ok(results.b.verdicts[0].loose);
  assert.equal(results.b.failedDesigns[0].why, "loose parts");
  assert.equal(checkConnected(render.last).ok, true, "the still got the repaired (whole) bell");
  assert.ok(render.last.repaired.snapped.length === 1 && logs.some((l) => /repaired for free/.test(l)));
});

test("design prompt: the rot signs, the touching rule and the name rule are spelled out", () => {
  assert.match(OBJECT_SYSTEM, /\+x tips the\s+part's top toward the FRONT/);
  assert.match(OBJECT_SYSTEM, /EVERY PART TOUCHES/);
  assert.match(OBJECT_SYSTEM, /never\s+another object's name/);
});

// ------------------------------------------------------------------------------------------ C. -ing nouns
test("buildableNeed: an -ing NOUN is a thing ('shell opening' was refused as a verb); -ing verbs stay refused", () => {
  for (const w of ["shell opening", "the opening", "old building", "big painting", "wooden ceiling", "iron railing", "stair landing", "forest clearing", "flower offering", "cave drawing", "stone carving", "turtle shell openings"]) assert.equal(buildableNeed({ kind: "object", name: w }).ok, true, w);
  for (const w of ["running", "the dog running", "jumping", "biting", "crashing"]) assert.equal(buildableNeed({ kind: "object", name: w }).ok, false, w);
});
