// M2: writes the two golden layouts (landfill.json, french_drain.json) from the approved hand-built timelines
// (anim_full.js, anim_drain.js). Each cue word is found by its time in the approved times file, so the saved layout
// names the word itself ({w, n}) and re-renders the same video. Run once; the JSON files are what is kept.
//   node m2/layouts/makeGolden.mjs <research/seamless-niche dir>
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const R = process.argv[2] ?? "C:/Users/Public/Zylo/research/seamless-niche";
const load = (f) => JSON.parse(fs.readFileSync(path.join(R, f), "utf8"));

function anchors(words, times) {
  return (k, o = 0) => {
    const t = times[k];
    const i = words.findIndex((w) => w.s === t);
    if (i < 0) throw new Error(`no word at ${k} = ${t}`);
    const n = words.slice(0, i + 1).filter((w) => w.w === words[i].w).length;
    return o ? { w: words[i].w, n, o } : { w: words[i].w, n };
  };
}
const ABS = (v) => ({ abs: v });
const MARK = (m, o = 0) => (o ? { mark: m, o } : { mark: m });

function cueList() {
  const cues = [];
  const ramp = (p, c, a, b, amp = 1, e = "lin") => cues.push({ p, c, a, b, amp, e });
  const dur = (p, c, a, d, amp = 1, e = "back") => cues.push({ p, c, a, d, amp, e });
  const step = (p, c, a, amp = 1) => cues.push({ p, c, a, amp, e: "step" });
  return { cues, ramp, dur, step };
}

// ================= the landfill =================
function landfill() {
  const A = anchors(load("m1/voice_tests/voice_final_eric.words.json"), load("work/m1full_v2/times.json"));
  const PIT = { x0: -5, x1: 5, z0: -8, depth: 6 };
  const CT = 0.5, LTA = 0.16;
  const FLOOR = -5.5 + LTA, BAGH = 1.6, COVER = 0.32;
  const L1 = FLOOR, C1 = L1 + BAGH, L2 = C1 + COVER, C2 = L2 + BAGH, CAP0 = C2 + COVER;
  const IX0 = -4.5 + LTA, IX1 = 4.5 - LTA, IZ0 = -7.5 + LTA, IZ1 = 0;
  const GX = -2.6, GZ = -4.6, PZ = -0.06;
  const pn = (ch, mat, size, anchor, pos, axis, extra = {}) => ({ ch, mat, size, anchor, pos, axis, ...extra });

  const parts = [
    { id: "dig", kind: "dig", params: { clumps: 150, margin: 0.6, endY: 1.0, arc: 4.2, uvFlip: true, mound: { x: 9.6, z: -11.8, rx: 2, rz: 1.625, flat: 0.5, base: 0.05, gain: 2.6, sx: 1.15, sy: 1, sz: 1 } } },
    { id: "pit", kind: "panels", params: { panels: [
      pn("clayFloor", "clay", [10, CT, 8], [0, 0, 1], [0, -6 + CT / 2, -8], "z"),
      pn("clayWalls", "clay", [10, 6, CT], [0, 1, 0], [0, -6, -8 + CT / 2], "y"),
      pn("clayWalls", "clay", [CT, 6, 8], [0, 1, 0], [-5 + CT / 2, -6, -4], "y"),
      pn("clayWalls", "clay", [CT, 6, 8], [0, 1, 0], [5 - CT / 2, -6, -4], "y"),
      pn("linerBack", "liner", [9, 5.5, LTA], [0, -1, 0], [0, 0, -7.5 + LTA / 2], "y"),
      pn("linerSides", "liner", [LTA, 5.5, 7.5], [0, -1, 0], [-4.5 + LTA / 2, 0, -3.75], "y"),
      pn("linerSides", "liner", [LTA, 5.5, 7.5], [0, -1, 0], [4.5 - LTA / 2, 0, -3.75], "y"),
      pn("linerFloor", "liner", [9, LTA, 7.5], [0, 0, 1], [0, -5.5 + LTA / 2, -7.5], "z"),
      pn("linerLips", "liner", [10.6, LTA, 1.1], [0, 0, 1], [0, LTA / 2, -8.6], "z", { vis: 0.001 }),
      pn("linerLips", "liner", [1.1, LTA, 8], [-1, 0, 0], [-4.5, LTA / 2, -4], "x", { vis: 0.001 }),
      pn("linerLips", "liner", [1.1, LTA, 8], [1, 0, 0], [4.5, LTA / 2, -4], "x", { vis: 0.001 }),
      pn("linerLips", "linerRim", [10.8, 0.06, 0.07], [0, 0, 0], [0, LTA + 0.03, -8.62], null, { vis: 0.001, r: 0.02 }),
      pn("linerLips", "linerRim", [0.07, 0.06, 8], [0, 0, 0], [-5.62, LTA + 0.03, -4], null, { vis: 0.001, r: 0.02 }),
      pn("linerLips", "linerRim", [0.07, 0.06, 8], [0, 0, 0], [5.62, LTA + 0.03, -4], null, { vis: 0.001, r: 0.02 }),
      pn("cover1", "soilCover", [IX1 - IX0, COVER, IZ1 - IZ0], [0, 0, 1], [0, C1 + COVER / 2, IZ0], "z", { r: 0.06 }),
      pn("cover2", "soilCover", [IX1 - IX0, COVER, IZ1 - IZ0], [0, 0, 1], [0, C2 + COVER / 2, IZ0], "z", { r: 0.06 }),
      pn("capSoil", "soilCover", [10, -CAP0 + 0.02, 8.4], [0, 0, 1], [0, CAP0 / 2 + 0.01, -8.4], "z", { r: 0.08 }),
      pn("capGrass", "grass", [10.8, 0.28, 8.6], [0, 0, 1], [0, 0.14, -8.6], "z", { r: 0.14, uv: [2.7, 2.2] }),
    ] } },
    { id: "bags1", kind: "bags", params: { area: { x0: IX0, x1: IX1, z0: IZ0, z1: IZ1 }, h: BAGH, grid: [5, 4], n0: 0, y0: -6, stagger: 0.035, dur: 0.6, fromTruck: { part: "truck", x: 0, y: 2.8, dz: 3.8 }, liftStagger: { up: 0.008, down: 0.012 } } },
    { id: "bags2", kind: "bags", params: { area: { x0: IX0, x1: IX1, z0: IZ0, z1: IZ1 }, h: BAGH, grid: [5, 4], n0: 3, y0: L2, stagger: 0.03, dur: 0.55, fromAbove: { xScale: 0.6, y: 7 } } },
    { id: "truck", kind: "dumpTruck", params: { x: 0 }, base: { z: -40, load: 1 } },
    { id: "drainPipe", kind: "pipeRun", params: { path: [[-4.3, -5.55, PZ], [4.7, -5.55, PZ], [7.6, -5.55, PZ], [7.6, 0.35, PZ], [8.7, 0.35, PZ]], r: 0.24, radial: 24, jointR: 0.29, mat: "pipeWhite" } },
    { id: "tank", kind: "tank", params: { pos: [9.9, 0, -0.9], r: 1.3, h: 2.6, bands: [0.5, 2.0], mat: "tankBlue" } },
    { id: "juice", kind: "pipeRunFlow", params: { pipe: "drainPipe", count: 14, size: 0.13, speed: 3.2, dz: 0.22, mat: "juice" } },
    { id: "newspaper", kind: "sheet", params: { masthead: "THE DAILY NEWS", date: "JUNE 3, 1952", headline: "NEW HIGHWAY OPENS", from: [0.3, L2 + 0.6, -1.4], to: [0.3, 1.0, -1.1], sink: 3.4 } },
    { id: "gasPipe", kind: "riser", params: { x: GX, z: GZ, y0: FLOOR, y1: 3.0, r: 0.2, radial: 20, mat: "metal" } },
    { id: "wellhead", kind: "boxPop", params: { size: [0.85, 0.5, 0.85], pos: [GX, 3.2, GZ], r: 0.1, mat: "chassis" } },
    { id: "flare", kind: "flare", params: { pos: [GX, 3.45, GZ], intensity: 30 } },
    { id: "bubbles", kind: "bubbles", params: { x0: IX0, x1: IX1, z: -0.15, y0: L1, y1: C2, count: 46, speed: 0.35 } },
    { id: "generator", kind: "machine", params: { pos: [-8.4, 0, -11.6], rotY: 0.5 } },
    { id: "gasLine", kind: "pipeRun", params: { path: [[GX, 0.2, GZ - 0.6], [GX, 0.2, -10.4], [-7.2, 0.2, -11.0]], r: 0.15, radial: 16, joints: false, mat: "metal" } },
    { id: "fence", kind: "fence", params: { x0: -6.2, x1: 6.2, step: 1.55, zBack: -9.6, sideStart: 1.55, zFront: -0.6, railZ: -5.1, stagger: 0.025 } },
    { id: "youngTrees", kind: "youngTrees", params: { trees: [[-8.0, -3.6, 0.55], [8.2, -6.8, 0.6], [-7.4, -11.4, 0.5]], stagger: 0.12 } },
    { id: "sign", kind: "sign", params: { at: [0.0, 0.25, -2.2], rotY: 0.3, scale: 1.5, postsReceiveShadow: true } },
    { id: "seepArrows", kind: "arrows", params: { list: [-2.0, 0, 2.0].flatMap((x) => [0, 1].map((k) => ({ at: [x, -6.6, 0.35], dir: [0, -1], travel: 3.6, phase: k * 0.5 + (x === 0 ? 0.25 : 0) }))), opts: { scale: 1.25, speed: 0.9 } } },
    { id: "seepFlow", kind: "seepFlow", params: { count: 70, width: 4.4, y0: -6.2, fall: 6.2, floor: -11.2 } },
    { id: "linerOutline", kind: "outline", params: { points: [[-4.92, 0.1, 0.06], [-4.92, -5.92, 0.06], [4.92, -5.92, 0.06], [4.92, 0.1, 0.06]], opts: { r: 0.11 } } },
    { id: "leak", kind: "soilLeak", params: { x1: 3.0, x2: 1.4, murkX: 0 }, base: { y1: -6, y2: -6 } },
    { id: "light", kind: "light", params: {} },
  ];

  const { cues, ramp, dur, step } = cueList();
  ramp("dig", "dig", A("dig", 0.02), A("dig", 1.0));
  ramp("pit", "clayFloor", A("lay", 0.02), A("lay", 0.45), 1, "out");
  ramp("pit", "clayWalls", A("lay", 0.25), A("lay", 0.8), 1, "out");
  const L0 = -0.35;
  ramp("pit", "linerBack", A("plastic", L0), A("plastic", L0 + 0.45), 1, "out");
  ramp("pit", "linerSides", A("plastic", L0 + 0.15), A("plastic", L0 + 0.6), 1, "out");
  ramp("pit", "linerFloor", A("plastic", L0 + 0.4), A("plastic", L0 + 0.85), 1, "out");
  ramp("pit", "linerLips", A("plastic", L0 + 0.75), A("plastic", L0 + 1.05), 1, "back");
  ramp("pit", "cover1", A("sealed"), A("sealed", 0.6), 1, "out");
  ramp("pit", "cover2", A("buried", -0.3), A("buried", 0.3), 1, "out");
  ramp("pit", "capSoil", A("cap", -0.35), A("cap", 0.3), 1, "out");
  ramp("pit", "capGrass", A("cap", -0.15), A("cap", 0.5), 1, "out");
  // bags: layer 1 poured from the truck, lifted out of the way for the clay and for the liner; layer 2 dropped in
  const LIFT = 2.6;
  step("bags1", "drop", A("throw", 0.2));
  ramp("bags1", "lift", A("so", 0.02), A("so", 0.35), LIFT, "out");
  ramp("bags1", "lift", A("lay", 0.8), A("lay", 1.2), -LIFT + CT, "in2");
  ramp("bags1", "lift", A("add"), A("add", 0.35), LIFT, "out");
  ramp("bags1", "lift", A("plastic", L0 + 1.05), A("plastic", L0 + 1.45), -LIFT + LTA, "in2");
  step("bags2", "drop", A("rots", -0.25));
  ramp("truck", "z", ABS(0), ABS(1.0), -12.6 + 40, "out");
  ramp("truck", "z", A("landfill", 0.6), A("landfill", 2.8), -36, "inOut");
  ramp("truck", "tip", A("throw", 0.02), A("throw", 0.45), 0.75, "inOut");
  ramp("truck", "tip", A("landfill", -0.1), A("landfill", 0.5), -0.75, "inOut");
  step("truck", "load", A("throw", 0.25), -1);
  ramp("drainPipe", "grow", A("pipe", -0.05), A("drains", 0.55), 1, "inOut");
  dur("tank", "pop", A("tank", -0.1), 0.4);
  ramp("juice", "on", A("drains", 0.3), A("drains", 0.6));
  ramp("juice", "on", A("tank", 1.6), A("tank", 2.0), -1);
  ramp("newspaper", "up", A("newspaper", -0.1), A("newspaper", 0.6), 1, "out");
  ramp("newspaper", "down", A("but2", -0.1), A("but2", 0.4), 1, "in2");
  dur("newspaper", "pop", A("newspaper", -0.1), 0.45);
  ramp("light", "dip", A("decades", -0.05), A("decades", 0.35), 1, "bump");
  ramp("light", "dip", A("decades", 0.4), A("decades", 0.8), 1, "bump");
  ramp("bubbles", "on", A("but2", 0.2), A("but2", 0.6));
  ramp("bubbles", "on", A("cap", -0.4), A("cap"), -1);
  ramp("gasPipe", "grow", A("pipe2", -0.05), A("carries", 0.6), 1, "inOut");
  dur("wellhead", "pop", A("carries", 0.55), 0.3);
  dur("flare", "pop", A("flame", -0.05), 0.4);
  ramp("gasLine", "grow", A("electricity", -0.5), A("electricity", 0.3), 1, "inOut");
  dur("generator", "pop", A("electricity", 0.15), 0.4);
  dur("fence", "pop", A("fence", -0.1), 0.3);
  step("fence", "rails", A("fence", 0.45));
  dur("youngTrees", "pop", A("trees", -0.25), 0.45);
  step("sign", "pop", MARK("signPop"));
  // the explainer layer: seep arrows (seep 1, then seep 2 on "not enough"), murky flow, the liner outline
  ramp("seepArrows", "on", A("leaks", -0.05), A("leaks", 0.2));
  ramp("seepArrows", "on", A("so", -0.1), A("so", 0.25), -1);
  ramp("seepArrows", "on", A("not"), A("not", 0.2), 0.8);
  ramp("seepArrows", "on", A("add", -0.1), A("add", 0.2), -0.8);
  ramp("seepFlow", "on", A("leaks", 0.1), A("leaks", 0.5));
  ramp("seepFlow", "on", A("so"), A("lay", 0.3), -1);
  ramp("linerOutline", "on", A("liner", -0.05), A("liner", 0.15));
  ramp("linerOutline", "on", A("liner", 0.6), A("pipe", 0.2), -1);
  // the seeps in the soil and the murky groundwater
  ramp("leak", "y1", A("leaks"), A("groundwater", 0.1), -5.3, "out");
  step("leak", "a1", A("leaks"), 0.9);
  ramp("leak", "a1", A("so", 0.05), A("lay", 0.6), -0.9);
  ramp("leak", "y2", A("not"), A("add"), -3.6, "out");
  step("leak", "a2", A("not"), 0.85);
  ramp("leak", "a2", A("plastic"), A("sheet", 0.3), -0.85);
  cues.push({ p: "leak", c: "murk", a: A("groundwater", -0.1), d: 100, amp: 900, e: "lin" });
  step("leak", "murkA", A("groundwater", -0.1), 0.9);
  ramp("leak", "murkA", A("so", 0.05), A("lay", 0.6), -0.9);

  const HOME = [[13.0, 10.8, 33.5], [0.2, 2.3, -9.0]];
  const key = (at, pos, tgt, only) => (only ? { at, pos, tgt, only } : { at, pos, tgt });
  const keys = [
    key(ABS(0), ...HOME),
    key(A("landfill", 0.3), [12.6, 10.4, 32.2], [0.2, 2.0, -8.8]),
    key(A("leaks", 0.2), [11.6, 1.6, 28.5], [0.0, -9.6, -4.0]),
    key(A("drink", 0.25), [11.3, 1.3, 27.6], [0.0, -9.9, -4.0]),
    key(A("lay", 0.4), [12.8, 10.2, 31.0], [0.2, 1.9, -8.4]),
    key(A("not", 0.25), [11.8, 3.6, 28.8], [0.0, -7.4, -4.0]),
    key(A("add", 0.35), [12.4, 9.8, 30.0], [0.2, 1.7, -8.2]),
    key(A("this", -0.12), [12.0, 9.5, 29.0], [0.2, 1.6, -8.0]),
    key(A("this", 0.6), [5.6, 4.6, 27.5], [-0.2, -2.6, -4.4]),
    key(A("pipe", -0.05), [5.4, 4.4, 26.8], [-0.2, -2.7, -4.5]),
    key(A("drains", 0.5), [14.5, 4.6, 28.5], [5.4, -1.8, -3.0]),
    key(A("tank", 0.9), [14.7, 4.8, 28.0], [5.6, -1.7, -3.0]),
    key(A("sealed", 0.6), [10.5, 6.8, 27.0], [0.0, -2.4, -5.0]),
    key(A("buried", 0.4), [10.2, 6.6, 26.2], [0.0, -2.2, -5.0]),
    key(A("newspaper", 0.5), [3.8, 2.4, 14.8], [0.2, -3.0, -2.4]),
    key(A("readable", 0.9), [3.6, 2.3, 14.2], [0.2, -3.0, -2.4]),
    key(A("but2", 0.5), [12.6, 10.2, 31.0], [0.0, 1.2, -8.2]),
    key(A("flame", 0.4), [9.6, 9.4, 28.5], [-1.6, 1.4, -8.6]),
    key(A("electricity", 0.5), [7.4, 10.2, 29.0], [-3.2, 1.0, -9.6]),
    key(A("add2", 0.2), [12.4, 11.0, 32.0], [0.2, 1.6, -8.8]),
    key(A("congrats", 0.1), [13.6, 12.0, 34.5], [0.3, 1.5, -9.0]),
    key(MARK("signPop", 0.1), [15.2, 14.0, 38.8], [0.3, 1.5, -9.2], "end"),
    key(MARK("lengthEnd"), [10.5, 9.6, 30.0], [0.0, 2.6, -4.0], "end"),
    key(MARK("lengthNoEnd"), [16.0, 15.2, 41.0], [0.4, 1.4, -9.4], "noend"),
  ];
  return { key: "landfill", title: "How a landfill works", anchorMatch: "exact", world: { cut: PIT }, parts, cues, camera: { keys }, audio: {
    cards: [{ text: "37 YEARS", at: A("readable"), d: 1.8 }, { text: "480 LANDFILLS", at: A("electricity"), d: 1.8 }],
    sfx: [{ lib: "dirt", at: A("throw", 0.25), d: 1.2 }, { lib: "drip", at: A("leaks"), d: 1.3 }, { lib: "water_rush", at: A("drains"), d: 1.4 }, { lib: "flame", at: A("flame"), d: 1.3 }],
    chimes: [A("this"), A("readable"), A("electricity"), A("congrats")],
  } };
}

// ================= the French drain =================
function frenchDrain() {
  const A = anchors(load("m2drain/voice/voice_final.words.json"), load("work/m2drain/times.json"));
  const TR = { x0: -11.4, x1: 0.8, z0: -2.0, z1: 0, depth: 3.6 };
  const GRAV_TOP = -0.45, CAP_Y = -0.38, PZ = -0.06;
  const inTr = (x0, x1) => ({ x0: TR.x0 + 0.02 + x0, x1: TR.x1 - 0.02 - x1 });
  const win = (p, c, a, b, f) => { cues.push({ p, c, a: { ...a, o: (a.o ?? 0) - f / 2 }, b: { ...a, o: (a.o ?? 0) + f / 2 }, amp: 1, e: "lin" }); cues.push({ p, c, a: { ...b, o: (b.o ?? 0) - f / 2 }, b: { ...b, o: (b.o ?? 0) + f / 2 }, amp: -1, e: "lin" }); };

  const parts = [
    { id: "light", kind: "light", params: { storm: true } },
    { id: "foundation", kind: "box", params: { mat: "concrete", size: [11.2, 3.38, 6.77], pos: [-5.5, -3.2 + 3.38 / 2, -5.365], r: 0.03, receiveShadow: true } },
    { id: "dig", kind: "dig", params: { clumps: 170, mound: { x: 4.8, z: -5.4, rx: 1.9, rz: 1.5, h: 1.25 } } },
    { id: "trenchWater", kind: "water", params: { box: { ...inTr(0, 0), z0: TR.z0 + 0.02, z1: -0.01, y0: -TR.depth, y1: -1.2 }, gravel: "gravel", mat: "water" } },
    { id: "puddles", kind: "puddles", params: { list: [[2.6, -4.6, 1.3, 0.9], [-12.9, -4.8, 1.0, 0.8], [1.9, -7.4, 0.9, 0.6]], rise: [0.3, 0.2], fall: [0.2, 0] } },
    { id: "rain", kind: "rain", params: { x0: -20, x1: 14, z0: -18, z1: -0.1, yTop: 20, yBot: -0.4, count: 1300, width: 0.02, opacity: 0.36 } },
    { id: "eave", kind: "stream", params: { x0: -11.3, x1: 0.4, z: -1.5, yTop: 6.3, yBot: -2.4, count: 230 } },
    { id: "pressure", kind: "arrows", params: { list: [-9.5, -7.0, -4.5, -2.0].map((x, i) => ({ at: [x, -1.12, -0.25], dir: [0, -1], travel: 1.2, phase: i * 0.25 })), opts: { flat: true, scale: 1.55 } } },
    { id: "crack", kind: "crack", params: { points: [[-4.7, 0.17, -1.955], [-4.35, -0.3, -1.955], [-4.72, -0.85, -1.955], [-4.2, -1.4, -1.955], [-4.5, -2.0, -1.955], [-4.0, -2.7, -1.955], [-4.25, -3.3, -1.955]], r: 0.075 } },
    { id: "gravel", kind: "gravel", params: { box: { ...inTr(0, 0), z0: TR.z0 + 0.02, z1: 0, y0: -TR.depth, y1: GRAV_TOP }, faceBox: { ...inTr(0.02, 0.02), y0: -TR.depth, y1: GRAV_TOP, z0: TR.z0 + 0.05, z1: 0.04 }, pourBox: { ...inTr(0.2, 0.2), z0: TR.z0 + 0.2, z1: -0.25 }, pourFrom: 6.5, pourCount: 260, water: "trenchWater", waterTop: -1.2, waterSpan: 2.4, drainDrop: 1.25, mat: "gravel", pebbleMat: "pebbles" } },
    { id: "drainPipe", kind: "pipe", params: { path: [[TR.x0 + 0.3, -2.55, PZ], [0.55, -2.9, PZ]], opts: { r: 0.3, color: "#f4f3ee", perforated: true, holeSpacing: 0.62 } } },
    { id: "outlet", kind: "pipe", params: { path: [[0.55, -2.9, PZ], [1.7, -3.3, PZ], [3.9, -4.45, PZ]], opts: { r: 0.3, color: "#f4f3ee" } } },
    { id: "flowIn", kind: "pipeFlow", params: { pipe: "drainPipe", opts: { count: 22, size: 0.11, offset: [0, 0, 0.33] }, speed: 3.4 } },
    { id: "flowOut", kind: "pipeFlow", params: { pipe: "outlet", opts: { count: 10, size: 0.11, offset: [0, 0, 0.33] }, speed: 3.4 } },
    { id: "soakPit", kind: "soakPit", params: { box: { x0: 3.4, x1: 6.1, y0: -6.1, y1: -3.85, z0: -2.4, z1: 0.015 }, faceBox: { x0: 3.4, x1: 6.1, y0: -6.1, y1: -3.85, z0: -2.3, z1: 0.04 }, mat: "gravelPit", pebbleMat: "pebblesPit" }, base: { wetY: -6.1 } },
    { id: "seep", kind: "arrows", params: { list: [-9.6, -7.2, -4.8, -2.4, -0.2].map((x, i) => ({ at: [x, -1.15, 0.42], dir: [0, -1], travel: 1.25, phase: i * 0.2 })), opts: { scale: 0.95 } } },
    { id: "soakArrows", kind: "arrows", params: { list: [4.15, 5.35].map((x, i) => ({ at: [x, -6.5, 0.4], dir: [0, -1], travel: 2.4, phase: i * 0.5 })), opts: { scale: 1.05 } } },
    { id: "trenchOutline", kind: "outline", params: { points: [[TR.x0 - 0.12, 0.12, 0.12], [TR.x0 - 0.12, -TR.depth - 0.12, 0.12], [TR.x1 + 0.12, -TR.depth - 0.12, 0.12], [TR.x1 + 0.12, 0.12, 0.12]] } },
    { id: "fabric", kind: "wrap", params: { box: { ...inTr(0, 0), y0: -TR.depth + 0.0, y1: GRAV_TOP, z0: TR.z0 + 0.03, z1: 0.012 }, opts: { thick: 0.13, sides: ["back", "floor", "top"], along: "x", stagger: 0.14, dur: 0.45 }, mat: "fabric" } },
    { id: "mud", kind: "drops", params: { x0: TR.x0, x1: TR.x1, count: 22, fromY: 0.7, landY: CAP_Y + 0.06, z: 0.16, mat: "mud" } },
    { id: "capSoil", kind: "wipe", params: { box: { ...inTr(0, 0), y0: CAP_Y, y1: -0.05, z0: TR.z0 + 0.02, z1: 0 }, mat: "soilCover", axis: "x", r: 0.04 } },
    { id: "capGrass", kind: "wipe", params: { box: { x0: TR.x0 - 0.15, x1: TR.x1 + 0.15, y0: -0.18, y1: 0.09, z0: TR.z0 - 0.05, z1: 0 }, mat: "grass", axis: "x", r: 0.08, uvScale: 0.25 } },
    { id: "bushes", kind: "shrubs", params: { list: [[-10.3, -1.0, 0.9], [-8.6, -0.9, 1.0], [-7.0, -1.05, 0.85], [-2.9, -0.95, 0.95], [-1.1, -1.0, 0.9]], stagger: 0.09 } },
    { id: "flag", kind: "flag", params: { at: [3.1, 0, -1.9] } },
    { id: "book", kind: "book", params: { w: 1.9, h: 2.5, bg: "#7a2f24", book: true, spine: "#4d1c15", lines: [
      { text: "FARM", font: "bold 74px Georgia, serif", color: "#f2d58e", y: 150 }, { text: "DRAINAGE", font: "bold 66px Georgia, serif", color: "#f2d58e", y: 232 },
      { rule: true, y: 270, color: "#f2d58e" }, { text: "H. F. FRENCH", font: "bold 44px Georgia, serif", color: "#f2d58e", y: 380 }, { text: "1859", font: "bold 56px Georgia, serif", color: "#f2d58e", y: 560 }], from: [3.0, -0.8, -1.7], to: [3.0, 3.0, -1.7], rot: [-0.12, -0.32, 0.02] } },
    { id: "sign", kind: "sign", params: { at: [-1.4, 0.08, -0.85], rotY: 0.22, scale: 1.3 } },
    { id: "lawn", kind: "lawnWet", params: {} },
    { id: "wetBand", kind: "wetBand", params: { cx: (TR.x0 + TR.x1) / 2, halfW: (TR.x1 - TR.x0) / 2 + 0.3, bottom: -TR.depth - 0.6 } },
    { id: "soak", kind: "soak", params: { x0: 3.4, x1: 6.1, top: -6.1 }, base: { front: -6.1 } },
  ];

  const { cues, ramp, dur, step } = cueList();
  ramp("light", "storm", A("but1", -0.1), A("but1", 0.5), 1, "inOut");
  ramp("light", "storm", A("wrap"), A("and1", 0.4), -1, "inOut");
  ramp("dig", "dig", A("dig", 0.02), A("dig", 1.0));
  ramp("dig", "refill", A("add"), A("add", 0.8));
  ramp("rain", "on", A("but1"), A("but1", 0.4), 1, "out");
  ramp("rain", "on", A("wrap"), A("mud", 0.3), -1);
  ramp("eave", "on", A("roof", -0.1), A("roof", 0.25));
  ramp("eave", "on", A("wrap", -0.2), A("wrap", 0.4), -1);
  ramp("lawn", "amount", A("but1", 0.3), A("walls"), 0.9);
  ramp("lawn", "amount", A("mud"), A("add"), -0.9);
  ramp("puddles", "rise", A("dumps"), A("walls"), 1, "out");
  ramp("puddles", "fall", A("wrap"), A("and1", 0.5), 1, "inOut");
  // the trench water: a trickle from the eave, then the ditch floods; it sinks into the gravel, then drains away
  ramp("trenchWater", "flood", A("dumps"), A("ditch", -0.1), 0.22);
  ramp("trenchWater", "flood", A("ditch", -0.05), A("floods", 0.45), 0.78, "out");
  step("trenchWater", "gone", A("seeps", 0.3));
  ramp("gravel", "fill", A("fill", 0.1), A("gravel1", 0.55));
  ramp("gravel", "lift", A("so2", 0.02), A("so2", 0.36), 2.6, "out");
  ramp("gravel", "lift", A("gravel2", -0.15), A("gravel2", 0.22), -2.6, "in2");
  ramp("gravel", "squash", A("gravel2", 0.22), A("gravel2", 0.48), 0.04, "bump");
  ramp("gravel", "drain", A("seeps", 0.2), A("away", 0.4), 1, "inOut");
  ramp("gravel", "pour", A("fill"), A("gravel1", 0.5));
  win("pressure", "on", A("pushes", -0.05), A("so1", -0.1), 0.3);
  ramp("crack", "grow", A("cracks", -0.05), A("cracks", 0.35), 1, "out");
  ramp("wetBand", "amount", A("walls", -0.4), A("floods", 0.6), 0.75);
  ramp("wetBand", "amount", A("away"), A("and1", 1.0), -0.75);
  ramp("drainPipe", "grow", A("pipe", -0.1), A("holes", 0.15));
  ramp("outlet", "grow", A("slopes", -0.05), A("downhill", 0.45), 1, "inOut");
  ramp("soakPit", "grow", A("slopes", 0.25), A("downhill", 0.5), 1, "out");
  ramp("flowIn", "on", A("seeps", 0.1), A("seeps", 0.5));
  ramp("flowIn", "on", A("mud"), A("and1"), -1);
  ramp("flowOut", "on", A("downhill"), A("downhill", 0.4));
  ramp("flowOut", "on", A("mud"), A("and1"), -1);
  win("seep", "on", A("seeps", -0.05), A("wrap", -0.1), 0.3);
  ramp("soakPit", "wetY", A("away", -0.1), A("away", 0.9), 2.25, "out");
  ramp("soakPit", "wetY", A("mud"), A("and1", 1.5), -2.25 * 0.6);
  step("soakPit", "wetOn", A("away", -0.1));
  ramp("soak", "front", A("away", 0.2), A("and1", 0.8), -4.6, "out");
  ramp("soak", "on", A("away", 0.1), A("away", 0.5));
  ramp("soak", "on", A("henry"), A("add"), -1);
  win("soakArrows", "on", A("away", 0.2), A("and1", 0.3), 0.3);
  win("trenchOutline", "on", A("french1", -0.05), A("seeps", 0.15), 0.25);
  step("fabric", "start", A("wrap", 0.05));
  ramp("mud", "fall", A("mud", -0.1), A("mud", 0.35));
  ramp("mud", "gone", A("and1", -0.1), A("and1", 0.3));
  step("flag", "show", A("french2", -0.1));
  step("flag", "cross", A("not"));
  step("flag", "gone", A("it1", -0.05));
  step("book", "up", A("henry", -0.05));
  step("book", "down", A("add"));
  ramp("capSoil", "grow", A("add", 0.05), A("grass", 0.2), 1, "out");
  ramp("capGrass", "grow", A("grass", -0.05), A("top", 0.1), 1, "out");
  step("bushes", "start", A("top", -0.05));
  step("sign", "pop", MARK("signPop"));

  const OFF = [15.5, 10.5, 50], HOME_T = [-3.5, 1.0, -4.0];
  const LOW = [12, 4.5, 40], HIGH = [10, 21, 34];
  const K = (at, tgt, f, off = OFF, only) => { const k = { at, pos: tgt.map((v, i) => v + off[i] * f), tgt }; if (only) k.only = only; return k; };
  const keys = [
    K(ABS(0.0), HOME_T, 1.0),
    K(A("drain", 0.2), HOME_T, 0.97),
    K(A("but1", 0.35), [-3.5, 2.4, -4.0], 0.9),
    K(A("walls"), [-3.5, 2.2, -4.0], 0.87),
    K(A("ditch", 0.3), [-4.8, -1.4, -1.4], 0.66, HIGH),
    K(A("pushes"), [-4.8, -1.4, -1.4], 0.62, HIGH),
    K(A("cracks", 0.35), [-4.4, -0.9, -1.8], 0.45, [12, 9, 40]),
    K(A("so1", 0.35), [-4.0, -1.2, -2.5], 0.7),
    K(A("bottom", 0.3), [-4.0, -1.4, -2.5], 0.66),
    K(A("so2", 0.3), [-3.5, -2.0, -2.0], 0.6),
    K(A("holes", 0.1), [-2.6, -2.7, -0.3], 0.22, LOW),
    K(A("gravel2", 0.2), [-2.6, -2.7, -0.3], 0.21, LOW),
    K(A("this", 0.45), [-4.5, -1.6, -2.0], 0.62),
    K(A("seeps", 0.4), [-4.3, -1.8, -2.0], 0.6),
    K(A("slopes", 0.3), [1.8, -3.6, -1.2], 0.5),
    K(A("away", 0.6), [2.6, -4.6, -1.2], 0.48),
    K(A("wrap", 0.3), [-4.0, -1.0, -2.4], 0.6),
    K(A("mud", 0.6), [-4.0, -1.0, -2.4], 0.58),
    K(A("and1", 0.35), [2.6, -1.2, -2.2], 0.38),
    K(A("henry", 0.2), [2.7, -1.2, -2.1], 0.37),
    K(A("n1859", 0.6), [2.7, -1.2, -2.1], 0.355),
    K(A("n1859", 1.32), [2.7, -1.2, -2.1], 0.35),
    K(A("add", 0.65), HOME_T, 0.95),
    K(A("congrats", 0.1), HOME_T, 1.0),
    K(MARK("signPop", 0.1), [-3.2, 1.2, -4.2], 1.18, OFF, "end"),
    K(MARK("lengthEnd"), [-1.6, 2.4, -1.2], 0.72, OFF, "end"),
    K(MARK("lengthNoEnd"), [-3.2, 1.2, -4.2], 1.25, OFF, "noend"),
  ];
  const world = { cut: { x0: TR.x0, x1: TR.x1, z0: TR.z0, depth: TR.depth }, house: [-5.5, 0, -5.35], porch: false, trees: [[-14.5, -9.5], [13.5, -5.2, 0.9]], road: [8.5, 0.01, -57], roots: { pad: 0.8, to: 7 }, rocksAvoid: [[-12, 7, -7, -2.4]] };
  return { key: "french_drain", title: "How a French drain works", anchorMatch: "exact", world, parts, cues, camera: { keys }, audio: {
    cards: [{ text: "600 GALLONS", at: A("n600"), d: 1.8 }, { text: "300 LB", at: A("n300"), d: 1.8 }, { text: "1859", at: A("n1859"), d: 1.3 }],
    sfx: [{ lib: "dirt", at: A("dig", 0.05), d: 1.2 }, { lib: "water_rush", at: A("ditch", -0.05), d: 1.4 }, { lib: "dirt", at: A("fill", 0.15), d: 1.2 }, { lib: "drip", at: A("seeps"), d: 1.3 }, { lib: "water_rush", at: A("downhill"), d: 1.4 }],
    chimes: [A("n600"), A("n300"), A("this"), A("n1859"), A("congrats")],
    rain: { from: A("but1"), to: A("mud", 0.6), underDb: 24 },
  } };
}

for (const L of [landfill(), frenchDrain()]) {
  const f = path.join(here, `${L.key}.json`);
  fs.writeFileSync(f, JSON.stringify(L, null, 1));
  console.log(f, `${L.parts.length} parts, ${L.cues.length} cues, ${L.camera.keys.length} camera keys`);
}
