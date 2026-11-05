// M3: the crash sweep (the owner's rule of 2026-11-05): zero crashes before any paid run, and run after every new feature.
// Free. Three sets, each through the pipeline's own code:
//   1. the kept real failures (m3/failures): the planner replayed on the real run's recorded replies (m3/replayPlan.mjs)
//   2. the saved real plans (m3/sweep/plans): the plan checks, the timeline, the page, a few rendered stills
//   3. variations of those plans that use every planner option, one option at a time on every plan, plus random
//      combinations of all of them (settings, outlines, effects, designed parts good and broken, the Add line, shots,
//      beats, event words, the main subject, the cut, bad numbers)
// A CRASH is what would fail a run: an error out of the pipeline, or a page that renders no frames. A BUG is one an
// optional feature met and skipped (bookkeeping.js soft, the page's [cutaway-bug] lines): logged, never a failed run.
//   node m3/crashSweep.mjs --proto PROTO [--renders 120] [--combos 4] [--seed 7] [--out DIR] [--no-replays]
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url)), M2 = path.join(here, "../m2");
const argv = process.argv.slice(2), a = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) { const k = argv[i].slice(2); a[k] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true; }
const PROTO = path.resolve(a.proto), OUT = path.resolve(a.out ?? path.join(PROTO, "..", "crash_sweep")), RENDERS = Number(a.renders ?? 120), COMBOS = Number(a.combos ?? 4);
fs.mkdirSync(OUT, { recursive: true });
// --jobs N: N processes, each a share of the plans (its own page and output folder), merged into one report
if (Number(a.jobs) > 1 && a.shard == null) {
  const N = Number(a.jobs), { spawn } = await import("node:child_process");
  const rest = argv.filter((x, i) => !(x === "--jobs" || argv[i - 1] === "--jobs" || x === "--out" || argv[i - 1] === "--out"));
  const codes = await Promise.all(Array.from({ length: N }, (_, k) => new Promise((res) => {
    const c = spawn(process.execPath, [fileURLToPath(import.meta.url), ...rest, "--shard", `${k}/${N}`, "--out", path.join(OUT, `shard${k}`), ...(k ? ["--no-replays"] : [])], { stdio: ["ignore", "pipe", "ignore"] });
    c.stdout.on("data", (d) => { for (const l of String(d).split("\n")) if (/^\[sweep\]/.test(l)) console.log(`[shard ${k}] ${l}`); });
    c.on("close", res);
  })));
  const parts = Array.from({ length: N }, (_, k) => JSON.parse(fs.readFileSync(path.join(OUT, `shard${k}`, "sweep.json"), "utf8")));
  const sum = (key) => parts.reduce((s, p) => s + (p.summary[key] ?? 0), 0), bugs = new Map();
  for (const p of parts) for (const b of p.bugs) if (!bugs.has(b.bug)) bugs.set(b.bug, b.first);
  const summary = { replays: sum("replays"), replayCrashes: sum("replayCrashes"), plans: sum("plans"), options: parts[0].summary.options, variants: sum("variants"), rendered: sum("rendered"), crashes: sum("crashes"), bugsSkipped: bugs.size, seconds: Math.max(...parts.map((p) => p.summary.seconds)) };
  // (a render with no frames and no page error, with four Chromes starting at once on the laptop, is run again alone:
  // only if it fails alone too is it a crash; 4 of 4 such in the sweep of 2026-11-05 rendered fine alone)
  const crashes = [];
  for (const c of parts.flatMap((p) => p.crashes)) {
    const m = /^(.+?) \/ (.+)$/.exec(c.where);
    if (m && /only 0 of 3 frames/.test(c.error)) {
      const variant = m[2].replace(/^combo: /, ""), r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), "--proto", PROTO, "--out", path.join(OUT, "alone"), "--no-replays", "--only", m[1], "--combo", variant === "as saved" ? "" : variant], { encoding: "utf8", timeout: 600000 });
      if (/"crashes":0/.test(r.stdout ?? "")) { console.log(`[sweep] ${c.where}: rendered fine alone (a laptop start-up miss, not a crash)`); continue; }
    }
    crashes.push(c);
  }
  fs.writeFileSync(path.join(OUT, "sweep.json"), JSON.stringify({ summary, crashes, bugs: [...bugs].map(([bug, first]) => ({ bug, first })), items: parts.flatMap((p) => p.items), replays: parts.flatMap((p) => p.replays) }, null, 1));
  console.log(`SWEEP ${JSON.stringify(summary)}`);
  for (const c of crashes.slice(0, 25)) console.log(`CRASH ${c.where}: ${String(c.error).slice(0, 300)}`);
  process.exit(crashes.length || codes.some((x) => x !== 0 && x !== 1) ? 1 : 0);
}
const SHARD = a.shard ? String(a.shard).split("/").map(Number) : [0, 1];
const imp = (f) => import(pathToFileURL(path.join(M2, f)).href);
const { layoutRules } = await imp("layoutRules.js"), { solveLayout } = await imp("solver.js"), { compile } = await imp("compile.mjs");
const { draftWords } = await imp("plan.js"), { preparePage } = await imp("make.mjs"), { RUN_BUGS } = await imp("bookkeeping.js");
const { RIG_SHAPES, RIG_MOVES } = await imp("rig.js");

let seed = Number(a.seed ?? 7); const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = (xs) => xs[Math.floor(rnd() * xs.length)];
const clone = (x) => JSON.parse(JSON.stringify(x));
const result = { replays: [], items: [], crashes: [], bugs: new Map() };
const addBug = (b, where) => { const k = String(b).slice(0, 200); if (!result.bugs.has(k)) result.bugs.set(k, where); };

// ---------- 1. the kept real failures, replayed ----------
if (!a["no-replays"]) {
  const F = path.join(here, "failures");
  for (const d of fs.readdirSync(F).filter((x) => fs.existsSync(path.join(F, x, "case.json")))) {
    const r = spawnSync(process.execPath, [path.join(here, "replayPlan.mjs"), path.join(F, d)], { encoding: "utf8", timeout: 300000 });
    const line = (r.stdout ?? "").split("\n").find((l) => l.startsWith("RESULT ")), res = line ? JSON.parse(line.slice(7)) : { error: `no result (exit ${r.status}): ${(r.stderr ?? "").slice(-300)}` };
    for (const m of (r.stderr ?? "").match(/bug \(ours, skipped\): [^\n]+/g) ?? []) addBug(m.replace(/^bug \(ours, skipped\): /, ""), `replay ${d}`);
    result.replays.push({ case: d, error: res.error ?? null, pending: res.pending ?? null });
    if (res.error) result.crashes.push({ where: `replay ${d}`, error: res.error });
  }
}

// ---------- 2 + 3. the saved plans and their variations ----------
const plans = fs.readdirSync(path.join(here, "sweep", "plans")).filter((f) => f.endsWith(".json") && (!a.only || f.startsWith(a.only))).filter((_, i) => i % SHARD[1] === SHARD[0]).map((f) => ({ name: f.replace(/\.json$/, ""), ...JSON.parse(fs.readFileSync(path.join(here, "sweep", "plans", f), "utf8")) }));
const mainOf = (L) => L.parts.find((p) => p.main) ?? L.parts.find((p) => p.kind === "rig") ?? L.parts.find((p) => !["light", "sign", "rain"].includes(p.kind));
const midBeat = (L) => L.beats?.[Math.floor((L.beats?.length ?? 1) / 2)] ?? (L.beats = [{ s: "hook", do: [] }])[0];
const nameBeat = (L) => L.beats?.find((b) => b.s === "name") ?? midBeat(L);
const rigNode = (L) => { const r = L.parts.find((p) => p.kind === "rig"); return r ? `${r.id}.${r.params?.nodes?.[0]?.id ?? "x"}` : "nope.x"; };
const box = (size, at, extra = {}) => ({ shape: "box", size, at, ...extra });
// one designed part with every shape and every move, sensible values
const megaRig = () => ({ id: "swRig", kind: "rig", params: { name: "sweep machine", pos: [6, 0.12, -1.5], nodes: [
  { id: "base", at: [0, 0, 0], shapes: [box([1.2, 0.1, 1], [0, 0.05, 0])], moves: [{ name: "spinA", type: "spin", axis: "y", turns: 1 }] },
  ...RIG_SHAPES.map((sh, i) => ({ id: `n${i}`, parent: "base", at: [((i % 6) - 2.5) * 0.18, 0.15 + Math.floor(i / 6) * 0.2, 0], shapes: [{ shape: sh, size: [0.15, 0.15, 0.15], r: 0.08, h: 0.15, w: 0.05, at: [0, 0.05, 0], path: [[0, 0, 0], [0, 0.1, 0]], from: [0, 0, 0], to: [0, 0.1, 0], file: "furniture/kitchenStove.glb" }],
    moves: [{ name: `m${i}`, type: RIG_MOVES[i % RIG_MOVES.length], axis: "y", of: "base", to: [0, 0.1, 0], angle: 30, path: [[0, 0, 0], [0, 0.1, 0]], box: { size: [0.1, 0.1, 0.1], at: [0, 0, 0] }, from: 0, to2: 9, k: 1.4 }, ...(sh === "flame" ? [{ name: `b${i}`, type: "burn" }] : [])] })),
] } });
// a designed part made badly every way the planner might
const badRig = () => ({ id: "swBad", kind: "rig", params: { name: "bad", pos: ["x", null, -1], scale: -2, nodes: [
  { id: "a", at: [0, 0, 0], shapes: [{ shape: "box", size: [NaN, -1, 1e9] }, { shape: "nope" }, { shape: "tube", path: [] }, { shape: "flame" }, { shape: "model" }], moves: [{ name: "f", type: "follow", of: "missing" }, { name: "c", type: "crank", of: "a" }, { type: "spin" }, { name: "show", type: "slide" }, { name: "z", type: "fill" }, { name: "q", type: "count" }] },
  { id: "a", parent: "ghost", at: "nope", shapes: null, moves: "x" }, { id: "b", parent: "b", shapes: [{ shape: "gear", teeth: -3 }] },
] } });
const FX_TYPES = ["blast", "crash", "crack", "collapse", "fire", "smoke", "drip", "splash", "spark", "frost", "swirl", "motes", "bogus"];
const OPTIONS = {
  backdrop: [null, "street", "park", "garage", "room", "carwash", "kitchen", "workshop"].map((t) => [`backdrop ${t ?? "yard"}`, (L) => { if (!t) delete L.world.backdrop; else { L.world.backdrop = { type: t }; Object.assign(L.world, { house: false, worker: false, moreTrees: false, road: false }); } }]),
  outline: [
    ["outline none", (L) => { L.parts = L.parts.filter((p) => p.kind !== "outline"); }],
    ["outline points", (L) => { L.parts.push({ id: "swOut", kind: "outline", params: { points: [[-1, 0.1, 0.1], [-1, 2, 0.1], [1, 2, 0.1], [1, 0.1, 0.1]], opts: { closed: true } } }); nameBeat(L).do.push({ p: "swOut", v: "show" }); }],
    ["outline of main", (L) => { L.parts.push({ id: "swOut", kind: "outline", params: { of: mainOf(L)?.id } }); nameBeat(L).do.push({ p: "swOut", v: "show" }); }],
    ["outline of node", (L) => { L.parts.push({ id: "swOut", kind: "outline", params: { of: rigNode(L) } }); nameBeat(L).do.push({ p: "swOut", v: "show" }); }],
    ["outline of missing", (L) => { L.parts.push({ id: "swOut", kind: "outline", params: { of: "ghost.part" } }); nameBeat(L).do.push({ p: "swOut", v: "show" }); }],
    ["outline empty", (L) => { L.parts.push({ id: "swOut", kind: "outline", params: { points: [] } }); nameBeat(L).do.push({ p: "swOut", v: "show" }); }],
    ["outline bad points", (L) => { L.parts.push({ id: "swOut", kind: "outline", params: { points: [[1, 2], "x", null] } }); nameBeat(L).do.push({ p: "swOut", v: "show" }); }],
  ],
  fx: [...FX_TYPES.map((t) => [`fx ${t}`, (L) => { L.parts.push({ id: "swFx", kind: "fx", params: { type: t, at: [0, 1, 0.1], size: 1 } }); midBeat(L).do.push({ p: "swFx", v: ["blast", "crash", "crack", "collapse"].includes(t) ? "go" : "start" }); }]),
    ["fx no params", (L) => { L.parts.push({ id: "swFx", kind: "fx" }); midBeat(L).do.push({ p: "swFx", v: "go" }); }],
    ["fx bad verb", (L) => { L.parts.push({ id: "swFx", kind: "fx", params: { type: "blast", at: [NaN, 1, 0], size: 0 } }); midBeat(L).do.push({ p: "swFx", v: "explode" }); }]],
  rig: [["rig every shape and move", (L) => { L.parts.push(megaRig()); midBeat(L).do.push({ p: "swRig", v: "show" }, { p: "swRig", v: "spinA" }); }],
    ["rig made badly", (L) => { L.parts.push(badRig()); midBeat(L).do.push({ p: "swBad", v: "show" }, { p: "swBad", v: "f" }); }],
    ["rig main and scaled", (L) => { const r = megaRig(); r.main = true; r.params.scale = 2.5; L.parts.forEach((p) => delete p.main); L.parts.push(r); midBeat(L).do.push({ p: "swRig", v: "show" }); }]],
  finish: [["finish removed", (L) => { L.beats = L.beats.filter((b) => b.s !== "finish"); }], ["finish empty", (L) => { const f = L.beats.find((b) => b.s === "finish"); if (f) f.do = []; }],
    ["finish unknown part", (L) => { const f = L.beats.find((b) => b.s === "finish") ?? midBeat(L); f.do.push({ p: "ghost", v: "show", w: "Add" }); }]],
  shots: [["shots none", (L) => { for (const b of L.beats) { delete b.shots; delete b.shot; } }], ["shot unknown", (L) => { midBeat(L).shots = [{ focus: ["ghost"] }]; }],
    ["shot bad piece", (L) => { midBeat(L).shots = [{ focus: [`${mainOf(L)?.id}.nonode`] }]; }], ["shot hero missing", (L) => { nameBeat(L).shots = [{ hero: true, focus: ["ghost"] }]; }], ["shot home", (L) => { midBeat(L).shots = [{ focus: "home" }]; }]],
  beats: [["do unknown part", (L) => { midBeat(L).do.push({ p: "ghost", v: "show" }); }], ["do unknown verb", (L) => { const m = mainOf(L); midBeat(L).do.push({ p: m?.id, v: "teleport" }); }],
    ["do word not said", (L) => { const m = mainOf(L); midBeat(L).do.push({ p: m?.id, v: "show", w: "zebra" }); }], ["shows unknown", (L) => { midBeat(L).shows = { p: "ghost", does: "?" }; }],
    ["beat with no sentence", (L) => { L.beats.push({ s: "extra9", do: [], shots: [{ focus: ["ghost"] }] }); }]],
  words: [["event words", (L, S) => { const s = S[Math.floor(S.length / 2)]; s.text = `${s.text.replace(/[.!?]$/, "")}, then it explodes, cracks, floods, burns, leaks, melts, freezes and spins.`; }],
    ["negated events", (L, S) => { const s = S[Math.floor(S.length / 2)]; s.text = `${s.text.replace(/[.!?]$/, "")}, but it never explodes and only burns when lit.`; }],
    ["finish words odd", (L, S) => { const f = S.find((s) => s.role === "finish"); if (f) f.text = "Add, and, a, the."; }]],
  main: [["main none", (L) => { L.parts.forEach((p) => delete p.main); }], ["main two", (L) => { L.parts.filter((p) => !["light", "sign"].includes(p.kind)).slice(0, 2).forEach((p) => (p.main = true)); }]],
  cut: [["cut missing", (L) => { delete L.world.cut; }], ["cut odd", (L) => { L.world.cut = { x0: 3, x1: -3, z0: 1, depth: -2 }; }], ["cut shallow", (L) => { L.world.shallow = true; }]],
  numbers: [["numbers broken", (L) => { const p = L.parts.find((q) => q.params?.pos); if (p) p.params.pos = [NaN, "y", undefined]; const q = L.parts.find((x) => x.params?.path); if (q) q.params.path = [[1, 2, 3]]; }]],
};
const ALL = Object.entries(OPTIONS).flatMap(([group, vals]) => vals.map(([name, fn]) => ({ group, name, fn })));

// the pipeline after planning, as a paid run takes it: the plan checks, the timeline on draft words, the page
function pipeline(L, S) {
  const roles = S.map((s) => s.role); L.roles = roles; L.key = `crash_sweep_${SHARD[0]}`;
  let layout = L;
  if (!layout.codeShots && !layout.camera) layout = layoutRules(layout).layout;
  solveLayout(layout, S);
  const words = draftWords(S), tl = compile(layout, words, words.at(-1).e + 0.1, { roles });
  return { layout, tl };
}
function render(layout, tl) {
  preparePage({ layout, tl, proto: PROTO });
  const dir = path.join(OUT, "frames"); fs.rmSync(dir, { recursive: true, force: true });
  const L = tl.marks?.lengthEnd ?? 10, times = [0.5, L * 0.5, Math.max(0.6, L - 1)].map((t) => t.toFixed(2)).join(",");
  const shoot = () => { const r = spawnSync(process.execPath, [path.join(PROTO, "m2", "stills.mjs"), `m2_${layout.key}.html`, dir, times], { cwd: PROTO, encoding: "utf8", timeout: 180000 }); return `${r.stdout ?? ""}\n${r.stderr ?? ""}`; };
  let outText = shoot();
  // (no frames and no page error: Chrome did not start, four starting at once; once more before calling it a crash)
  if (!/page error/.test(outText) && !(fs.existsSync(dir) && fs.readdirSync(dir).some((f) => f.endsWith(".png")))) outText = shoot();
  if (a.verbose) console.log(outText.split("\n").filter((l) => /page|rror/.test(l)).slice(0, 12).join("\n"));
  const frames = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".png")).length : 0;
  return { frames, pageErrors: (outText.match(/page error: [^\n]+/g) ?? []), bugs: (outText.match(/\[cutaway-bug\][^\n]+/g) ?? []) };
}

const items = [];
// --combo "a + b + c": that one combination of options on the --only plan(s) (to reproduce a crash the sweep found)
if (typeof a.combo === "string") for (const p of plans) items.push({ plan: p.name, variant: `combo: ${a.combo}`, fns: a.combo.split(" + ").map((n) => ALL.find((o) => o.name === n.trim())).filter(Boolean) });
else for (const p of plans) {
  items.push({ plan: p.name, variant: "as saved", fns: [] });
  for (const o of ALL) items.push({ plan: p.name, variant: o.name, fns: [o] });
  for (let c = 0; c < COMBOS; c++) { const fns = Object.values(OPTIONS).map((vals) => (rnd() < 0.6 ? null : pick(vals))).filter(Boolean).map(([name, fn]) => ({ name, fn })); items.push({ plan: p.name, variant: `combo: ${fns.map((f) => f.name).join(" + ") || "none"}`, fns }); }
}
// which ones are also rendered: every saved plan as saved, each option on two plans, then combinations up to the budget
const renderSet = new Set(typeof a.combo === "string" ? items.map((_, i) => i) : []); let k = 0;
items.forEach((it, i) => { if (it.variant === "as saved") renderSet.add(i); });
for (const o of ALL) for (const p of (SHARD[1] > 1 ? [plans[k++ % plans.length]] : [plans[k++ % plans.length], plans[k++ % plans.length]])) { const i = items.findIndex((x) => x.plan === p.name && x.variant === o.name); if (i >= 0) renderSet.add(i); }
items.forEach((it, i) => { if (it.variant.startsWith("combo") && renderSet.size < Math.ceil(RENDERS / SHARD[1]) + plans.length + ALL.length * (SHARD[1] > 1 ? 1 : 2)) renderSet.add(i); });

if (a["no-render"]) renderSet.clear();
const t0 = Date.now();
items.forEach((it, i) => {
  if (a.variant && it.variant !== a.variant) return;
  const p = plans.find((x) => x.name === it.plan), L = clone(p.layout), S = clone(p.sentences);
  const t1 = Date.now(), before = RUN_BUGS.length, row = { plan: it.plan, variant: it.variant, crash: null, bugs: 0, rendered: false };
  try {
    for (const f of it.fns) f.fn(L, S);
    const { layout, tl } = pipeline(L, S);
    if (renderSet.has(i)) {
      const r = render(layout, tl); row.rendered = true;
      for (const b of r.bugs) addBug(b.replace(/^\[cutaway-bug\] /, "page: "), `${it.plan} / ${it.variant}`);
      row.bugs += r.bugs.length;
      if (r.pageErrors.length || r.frames < 3) row.crash = `page: ${r.pageErrors[0] ?? `only ${r.frames} of 3 frames`}`;
    }
  } catch (e) { row.crash = String(e?.stack ?? e).split("\n").slice(0, 4).join(" | "); }
  row.ms = Date.now() - t1;
  for (const b of RUN_BUGS.slice(before)) addBug(b, `${it.plan} / ${it.variant}`);
  row.bugs += RUN_BUGS.length - before;
  if (row.crash) result.crashes.push({ where: `${it.plan} / ${it.variant}`, error: row.crash });
  result.items.push(row);
  if (i % 50 === 0) console.log(`[sweep] ${i + 1}/${items.length} (${((Date.now() - t0) / 1000).toFixed(0)} s, ${result.crashes.length} crashes)`);
});

const summary = {
  replays: result.replays.length, replayCrashes: result.replays.filter((r) => r.error).length,
  plans: plans.length, options: ALL.length, variants: items.length, rendered: result.items.filter((r) => r.rendered).length,
  crashes: result.crashes.length, bugsSkipped: result.bugs.size, seconds: Math.round((Date.now() - t0) / 1000),
};
fs.writeFileSync(path.join(OUT, "sweep.json"), JSON.stringify({ summary, crashes: result.crashes, bugs: [...result.bugs].map(([b, where]) => ({ bug: b, first: where })), items: result.items, replays: result.replays }, null, 1));
console.log(`SWEEP ${JSON.stringify(summary)}`);
for (const c of result.crashes.slice(0, 25)) console.log(`CRASH ${c.where}: ${c.error.slice(0, 300)}`);
for (const [b, w] of [...result.bugs].slice(0, 40)) console.log(`BUG (skipped) ${b.slice(0, 160)}  [first: ${w}]`);
process.exit(result.crashes.length ? 1 : 0);
