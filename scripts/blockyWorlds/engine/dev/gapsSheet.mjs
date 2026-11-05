// GAPS agent (2026-11-05): contact sheets of every new action pose, giant behaviour and animal motion, rendered by the
// real engine (headless Chrome, free) from hand-made timelines, so the engine's own placing (hug pairs, riders on their
// mount, hiders behind a thing) is what is shown.
//   node dev/gapsSheet.mjs [poses|giants|animals|monsters|all] [--only name,name]
// -> out/gaps/<set>/timeline.json, stills, out/gaps/<set>_sheet*.jpg
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { sheet } from "./integrationSheet.mjs";

const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ENGINE, "out", "gaps");
const a = process.argv.slice(2);
const which = a.find((x) => !x.startsWith("--")) ?? "all";
const only = a.includes("--only") ? a[a.indexOf("--only") + 1].split(",") : null;

const CAST = { me: { role: "kid", name: "Pip", seed: 3 }, mom: { role: "adult", name: "Mom", seed: 8 }, dad: { role: "adult", name: "Dad", seed: 21 }, gran: { role: "elder", name: "Gran", seed: 5 } };
const A = (id, pose, o = {}) => ({ id, spot: "center", pose, expr: o.expr ?? "happy", facing: o.facing ?? "camera", hold: o.hold ?? null, ...(o.spot ? { spot: o.spot } : {}) });

// [name, shot fields, times (shot-local seconds)]
const POSE_SHOTS = [
  ["hug kid+mom", { camera: "medium", focus: "me", actors: [A("me", "hug", { facing: "mom", spot: "left" }), A("mom", "hug", { facing: "me", spot: "right" })] }, [0.6]],
  ["hug gran+dad", { camera: "medium", focus: "dad", actors: [A("gran", "hug", { facing: "dad", spot: "left" }), A("dad", "hug", { facing: "gran", spot: "right" })] }, [1.2]],
  ["climb", { camera: "medium", focus: "me", actors: [A("me", "climb", { facing: "away", expr: "excited" })] }, [0.4, 2.2]],
  ["push (car)", { camera: "medium", focus: "dad", actors: [A("dad", "push", { facing: "right", spot: "left", expr: "angry" })], objects: [{ name: "car", spot: "right", facing: "left" }] }, [0.7]],
  ["eat", { camera: "medium", focus: "me", actors: [A("me", "eat")] }, [0.2, 0.7]],
  ["fall", { camera: "medium", focus: "dad", actors: [A("dad", "fall", { expr: "surprised" })] }, [0.2, 1.4]],
  ["jump", { camera: "medium", focus: "me", actors: [A("me", "jump", { expr: "excited" })] }, [0.3, 0.6]],
  ["ride (horse)", { camera: "wide", focus: "me", actors: [A("me", "ride", { expr: "excited" })], objects: [{ name: "horse", spot: "center" }] }, [0.6]],
  ["ride (cow)", { camera: "medium", focus: "gran", actors: [A("gran", "ride")], objects: [{ name: "cow", spot: "center" }] }, [0.6]],
  ["hide (car)", { camera: "medium", focus: "me", actors: [A("me", "hide", { expr: "scared", spot: "left" })], objects: [{ name: "car", spot: "center" }] }, [1.0, 2.6]],
  ["hide (alone)", { camera: "medium", focus: "me", actors: [A("me", "hide", { expr: "scared" })] }, [0.9]],
  ["throw", { camera: "medium", focus: "me", actors: [A("me", "throw", { facing: "right", expr: "excited" })] }, [0.3, 0.6, 1.0]],
  ["fly", { camera: "medium", focus: "me", actors: [A("me", "fly", { facing: "left", expr: "excited" })] }, [0.8]],
  ["swim", { camera: "medium", focus: "dad", actors: [A("dad", "swim", { facing: "right" })] }, [0.6]],
  ["build", { camera: "medium", focus: "mom", actors: [A("mom", "build", { facing: "camera" })] }, [0.3, 3.5]],
  ["dig", { camera: "medium", focus: "dad", actors: [A("dad", "dig", { facing: "left" })] }, [0.55, 1.25]],
  ["dance", { camera: "medium", focus: "me", actors: [A("me", "dance", { spot: "left", expr: "excited" }), A("mom", "dance", { spot: "right", expr: "happy" })] }, [0.3, 0.8]],
  ["kick", { camera: "medium", focus: "me", actors: [A("me", "kick", { facing: "right" })] }, [0.3, 0.75, 1.1]],
  ["fight", { camera: "medium", focus: "dad", actors: [A("dad", "fight", { expr: "angry" })] }, [0.15]],
  ["drive", { camera: "medium", focus: "mom", actors: [A("mom", "drive", { facing: "left" })] }, [0.7]],
];

function timeline(rows, extra = {}) {
  let t = 0;
  const shots = rows.map(([name, f], i) => {
    const d = Math.max(4, ...(rowsTimes(rows[i]))) ;
    const s = { start: t, end: t + d, line: i, part: "tour", set: f.set ?? "street", light: f.light ?? "day", camera: f.camera, focus: f.focus, actors: f.actors ?? [], monsterState: f.monsterState ?? null, insert: null, marker: null, seed: 7 + i, ...(f.objects ? { objects: f.objects } : {}), ...(f.giants ? { giants: f.giants } : {}), name };
    delete s._giant; t += d; return s;
  });
  return { version: 1, fps: 24, width: 1080, height: 1920, duration: t, title: "GAPS sheet", cast: CAST, monster: extra.monster ?? null, shots, captions: [], audio: {}, ...extra };
}
function rowsTimes(r) { return (r[2] ?? [1]).map((x) => x + 0.5); }

function render(set, rows, extra = {}, cols = 5) {
  rows = only ? rows.filter((r) => only.some((o) => r[0].startsWith(o))) : rows;
  if (!rows.length) return;
  const dir = path.join(OUT, set); fs.mkdirSync(dir, { recursive: true });
  const tl = timeline(rows, extra);
  const tlPath = path.join(dir, "timeline.json");
  fs.writeFileSync(tlPath, JSON.stringify(tl, null, 1));
  const times = [], labels = [];
  tl.shots.forEach((s, i) => { for (const lt of rows[i][2] ?? [1]) { times.push(+(s.start + lt).toFixed(2)); labels.push(`${rows[i][0]} t${lt}`); } });
  const p = spawnSync(process.execPath, ["render.mjs", tlPath, path.join(dir, "s.mp4"), "--stills", times.join(",")], { cwd: ENGINE, encoding: "utf8", maxBuffer: 1 << 26 });
  if (p.status !== 0) { console.log(p.stdout.slice(-1500), p.stderr.slice(-3000)); throw new Error(`render failed (${set})`); }
  const items = times.map((t, i) => ({ label: labels[i], file: path.join(dir, `s-${t}.jpg`) }));
  const per = 15;
  for (let k = 0; k * per < items.length; k++) console.log(sheet(path.join(OUT, `${set}_sheet${k + 1}.jpg`), cols, items.slice(k * per, (k + 1) * per)));
}

if (which === "poses" || which === "all") render("poses", POSE_SHOTS);
export { timeline, render, A, CAST };

// ---------------- giants: every new behaviour on a few body plans, and the species families' looks
const G = (kind, action, o = {}) => ({ kind, action, camera: o.camera ?? "establish", size: o.size ?? 30, t: o.t ?? [1.6], light: o.light });
const GIANT_ROWS = [
  G("ghost", "reach"), G("giant", "reach"), G("moose", "reach"), G("octopus", "reach"),
  G("bear", "sleep", { t: [2.0] }), G("owl", "sleep", { t: [2.0] }), G("goblin", "sleep", { t: [2.0] }), G("turtle", "sleep", { t: [2.0] }),
  G("ghost", "lurk", { light: "night" }), G("goblin", "lurk"), G("shark", "lurk"),
  G("giant", "reveal", { t: [0.3, 1.6] }), G("octopus", "reveal", { t: [1.6] }),
  G("bear", "carry"), G("giant", "carry"), G("owl", "carry"), G("whale", "carry"),
  G("moose", "eat"), G("goblin", "eat"), G("owl", "eat"),
  G("owl", "fly"), G("dragon", "fly"), G("ghost", "fly"),
  G("bear", "climb"), G("giant", "climb"), G("wolf", "howl"), G("dog", "dig"), G("goblin", "flee"),
];
const LOOK_ROWS = ["ghost", "shadow", "owl", "crow", "shark", "goldfish", "goblin", "troll", "yeti", "snowman", "robot", "alien", "octopus", "squid", "moose", "rabbit", "giraffe", "pigeon", "scarecrow", "hamster"].map((k) => G(k, "idle", { t: [1.0] }));
function giantRows(list) {
  return list.map((g, i) => {
    const id = `g${i}`;
    return [`${g.kind} ${g.action}`, { camera: g.camera, focus: `giant:${id}`, light: g.light, giants: [{ id, spot: "far", action: g.action, facing: "camera" }], _giant: [id, { kind: g.kind === "giant" ? "giant_human" : g.kind, size: g.size, ...(["turtle", "whale", "elephant", "snail", "wolf", "bear", "dragon", "dog", "cat", "frog", "crab", "giant"].includes(g.kind) ? {} : { params: {} }), ...(g.kind === "turtle" || g.kind === "whale" ? { town: false } : {}) }] }, g.t];
  });
}
function giantTimeline(rows) { return { giants: Object.fromEntries(rows.map((r) => r[1]._giant)) }; }
if (which === "giants" || which === "all") { const r = giantRows(GIANT_ROWS); render("giants", r, giantTimeline(r)); }
if (which === "looks" || which === "all") { const r = giantRows(LOOK_ROWS); render("looks", r, giantTimeline(r)); }

// ---------------- camera fixes (2026-11-05): the reported framings, before -> after
const CAM_ROWS = [
  ["over_shoulder furry reach", { camera: "over_shoulder", focus: "me", actors: [A("me", "scared", { expr: "scared", facing: "monster" })], monsterState: { spot: "far", state: "reach" } }, [1.2]],
  ["over_shoulder furry (near)", { camera: "over_shoulder", focus: "me", actors: [A("me", "scared", { expr: "scared", facing: "monster" })], monsterState: { spot: "back", state: "reveal" } }, [1.2]],
  ["bedroom wide", { set: "bedroom", camera: "wide", focus: "me", actors: [A("me", "talk", { spot: "left" })] }, [0.2, 2.5]],
  ["bedroom wide night", { set: "bedroom", light: "night", camera: "wide", focus: "me", actors: [A("me", "sleep", { spot: "center" })] }, [2.0]],
  ["street monster flee wide", { camera: "wide", focus: "monster", actors: [A("me", "point", { spot: "left", facing: "monster" })], monsterState: { spot: "far", state: "flee" } }, [1.0]],
  ["street lurk far wide", { camera: "wide", focus: "me", actors: [A("me", "look_up", { expr: "scared" })], monsterState: { spot: "far", state: "lurk" } }, [1.0]],
  ["woods lurk far wide", { set: "woods", light: "night", camera: "wide", focus: "me", actors: [A("me", "scared", { expr: "scared" })], monsterState: { spot: "far", state: "lurk" } }, [1.0]],
  ["on moose aerial", { set: "creature:moose_on", camera: "aerial", focus: "world", giants: [{ id: "world", action: "walk" }] }, [1.0]],
  ["on moose establish", { set: "creature:moose_on", camera: "establish", focus: "world", giants: [{ id: "world", action: "walk" }] }, [1.0]],
  ["on frog establish", { set: "creature:frog_on", camera: "establish", focus: "world", giants: [{ id: "world", action: "idle" }] }, [1.0]],
];
if (which === "cams" || which === "all") render("cams", CAM_ROWS, { monster: { type: "furry", name: "The Grump", glow: "#ffd84a" }, worlds: { moose_on: { creature: "moose", view: "on", size: 120, seed: 7 }, frog_on: { creature: "frog", view: "on", size: 100, seed: 9 } } });

// ---------------- animals (kit objects) moving: page/kit/motion.js
const AN = (name, state, t = [1.2]) => [`${name} ${state}`, { camera: "wide", focus: "object", objects: [{ name, spot: "center", state }] }, t];
const ANIMAL_ROWS = [AN("dog", "walk"), AN("cat", "run"), AN("pigeon", "fly"), AN("cat", "sleep", [2.0]), AN("fish", "swim"), AN("wolf", "howl"), AN("bear", "carry"), AN("moose", "eat"), AN("horse", "flee"), AN("duck", "sleep", [2.0])];
if (which === "animals" || which === "all") render("animals", ANIMAL_ROWS);
