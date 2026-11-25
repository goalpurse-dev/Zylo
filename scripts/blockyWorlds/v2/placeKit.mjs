// IN THIS TOWN v2, NIGHT BUILD: ONE KIT FOR EVERY PLACE (towns, side sets): load + expand the data, the FREE checks
// (stageCheck's spot / sightline / framing checks + the place's own: big spot clear, background spots, lanes), the
// camera solver (solveCams' method, any place), and the place's python payload for set_v2.py.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkStage, span } from "./stageCheck.mjs";
import { BODY_R, MIN_GAP, H, CREATURE_R } from "./stageA.mjs";
import { expand, obstaclesOf } from "./places/prefabs.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SOLVED_DIR = path.join(HERE, "places", "solved");
const d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export async function allPlaces() {
  const out = {};
  await import("./places/bigthings.mjs");
  for (const f of ["towns.mjs", "sidesets.mjs"]) {
    const p = path.join(HERE, "places", f);
    if (!fs.existsSync(p)) continue;
    const m = await import(`./places/${f}`);
    Object.assign(out, m.TOWNS ?? {}, m.SIDESETS ?? {});
  }
  return out;
}

/** a place, expanded: prims + obstacles (+ a base stage's own obstacles), solved cameras when saved */
export function loadPlace(P0, { solved = true, extraItems = [] } = {}) {
  const sid = P0.id.split("+")[0];
  const prims = expand([...(P0.items ?? []), ...extraItems]);
  const obstacles = [...(P0.base_obstacles ?? []), ...obstaclesOf(prims)];
  const sf = path.join(SOLVED_DIR, `${sid}.json`);
  const cameras = solved && fs.existsSync(sf) ? { ...P0.cameras, ...JSON.parse(fs.readFileSync(sf, "utf8")) } : P0.cameras;
  return { ...P0, prims, obstacles, cameras, deck: P0.deck ?? { x0: -999, x1: -998, y0: -999, y1: -998 } };
}

const footDist = (p, o) => {
  if (o.cyl) return Math.max(0, d2(p, o.cyl) - o.cyl[2]);
  const [x0, x1, y0, y1] = o.box;
  return Math.hypot(Math.max(x0 - p[0], 0, p[0] - x1), Math.max(y0 - p[1], 0, p[1] - y1));
};
const tall = (o, z) => (o.box ? o.box[5] : o.cyl[3]) > z + 0.5 && (o.box ? o.box[4] : 0) < z + H.adult;

/** the place's free checks: stageCheck + its own; returns problems (a place passes with none) */
export function checkPlace(S) {
  const out = [...checkStage(S).problems];
  const walls = S.obstacles;
  // the big spot: an empty circle (nothing standing in it, no person spot inside it)
  if (S.big && !S.big_filled) {
    for (const o of walls) if (tall(o, S.big.at[2]) && footDist(S.big.at, o) < S.big.r) out.push(`big spot: ${o.n} stands inside it (${footDist(S.big.at, o).toFixed(1)} < ${S.big.r})`);
    for (const [k, s] of Object.entries(S.spots)) if (d2(s.at, S.big.at) < S.big.r + BODY_R - 0.01) out.push(`big spot: person spot ${k} is inside it`);
  }
  // background people: clear of walls and of every person spot
  for (const [k, b] of Object.entries(S.background ?? {})) {
    for (const o of walls) if (tall(o, b.at[2]) && footDist(b.at, o) < BODY_R) out.push(`background ${k}: ${footDist(b.at, o).toFixed(2)} from ${o.n}`);
    for (const [j, s] of Object.entries(S.spots)) if (d2(b.at, s.at) < MIN_GAP) out.push(`background ${k}: too close to spot ${j}`);
  }
  // driving cars never cross a person spot
  for (const p of S.prims.filter((q) => q.move && q.t === "box" && q.s[0] > 5)) {
    const xs = [p.at[0], p.at[0] + p.move[0]], ys = [p.at[1], p.at[1] + p.move[1]];
    for (const [k, s] of Object.entries(S.spots)) {
      const dx = Math.max(Math.min(...xs) - p.s[0] / 2 - s.at[0], 0, s.at[0] - Math.max(...xs) - p.s[0] / 2), dy = Math.max(Math.min(...ys) - p.s[1] / 2 - s.at[1], 0, s.at[1] - Math.max(...ys) - p.s[1] / 2);
      if (Math.hypot(dx, dy) < BODY_R) out.push(`a driving car crosses spot ${k}`);
    }
  }
  // towns never look empty: every wide and aerial camera sees at least 5 background people (owner 2026-11-25)
  if (S.kind === "town") for (const [ck, c] of Object.entries(S.cameras)) {
    if (!["wide", "top"].includes(c.shot)) continue;
    const n = Object.values(S.background ?? {}).filter((b) => { const sp = span(c, b.at, 0.6, 0, 3.2); return sp && sp[0] > 0.03 && sp[1] < 0.97 && sp[2] > 0.03 && sp[3] < 0.97; }).length;
    if (n < 5) out.push(`camera ${ck}: ${n} background people in frame (at least 5)`);
  }
  // the counts the night build asks for
  const cams = Object.values(S.cameras);
  if (S.kind === "town" && !S.cams_filtered) {
    if (cams.length < 8 || cams.length > 12) out.push(`${cams.length} cameras (8-12 wanted)`);
    if (cams.filter((c) => c.aerial).length < 2) out.push("fewer than 2 aerial cameras");
    const nb = Object.keys(S.background ?? {}).length;
    if (nb < 6) out.push(`${nb} background spots (6 or more wanted)`);
  }
  return out;
}

/** solve one camera (solveCams' method): keep its direction, height and lens; find the closest distance and the aim
 *  height where its people pass the framing + sightline checks. Wides, aerials and fixed cameras are kept. */
export function solveCam(S, ck, c) {
  if (["wide", "top"].includes(c.shot) || c.fixed || !c.people.length) return c;
  const heads = c.people.map((k) => { const a = S.spots[k].at; return [a[0], a[1], a[2] + H.kid - 0.45]; });
  const C = [0, 1, 2].map((i) => heads.reduce((s, h) => s + h[i], 0) / heads.length);
  const az = [c.loc[0] - C[0], c.loc[1] - C[1]], al = Math.hypot(...az); az[0] /= al; az[1] /= al;
  const near = (o) => { const b = o.box ?? [o.cyl[0] - o.cyl[2], o.cyl[0] + o.cyl[2], o.cyl[1] - o.cyl[2], o.cyl[1] + o.cyl[2]]; const R = 32; return b[1] > C[0] - R && b[0] < C[0] + R && b[3] > C[1] - R && b[2] < C[1] + R; };
  const S1 = { ...S, spots: Object.fromEntries(c.people.map((k) => [k, S.spots[k]])), creature_spots: c.creature ? { [c.creature]: S.creature_spots[c.creature] } : {}, obstacles: S.obstacles.filter(near) };
  let best = null;
  for (let i = 0; i < 110; i++) {
    const d = 2.5 + i * 0.25;
    for (let tz = -1; tz <= 12; tz += 0.25) {
      const cam = { ...c, loc: [C[0] + az[0] * d, C[1] + az[1] * d, c.loc[2]], tgt: [C[0], C[1], tz] };
      if (checkStage({ ...S1, cameras: { [ck]: cam } }).problems.some((p) => p.startsWith(`camera ${ck}:`))) continue;
      const hs = c.people.map((k) => span(cam, S.spots[k].at, 0.6, H.kid - 0.95, H.kid)).filter(Boolean);
      const vs = hs.map((s) => (s[2] + s[3]) / 2), hf = Math.max(...hs.map((s) => s[3] - s[2]));
      // the head's share of the frame height by shot size (measured on the first sheet: closest-possible was far too big)
      const goal = { close: 0.15, medium: 0.085, two: 0.075, low: 0.09, over_shoulder: 0.09 }[c.shot] ?? 0.085;
      const score = Math.abs(vs.reduce((a, b) => a + b, 0) / vs.length - 0.32) + 4 * Math.abs(hf - goal);
      if (!best || score < best.score) best = { score, cam };
    }
  }
  if (!best) return null;
  const r = (v) => v.map((x) => +x.toFixed(2));
  return { ...c, loc: r(best.cam.loc), tgt: r(best.cam.tgt) };
}

export function solvePlace(P0) {
  const S = loadPlace(P0, { solved: false });
  const solved = {}, notes = [];
  for (const [ck, c] of Object.entries(S.cameras)) {
    const s = solveCam(S, ck, c);
    if (!s) { notes.push(`camera ${ck}: no solution`); solved[ck] = c; } else solved[ck] = s;
  }
  fs.mkdirSync(SOLVED_DIR, { recursive: true });
  fs.writeFileSync(path.join(SOLVED_DIR, `${P0.id}.json`), JSON.stringify(solved, null, 1));
  return notes;
}

/** what set_v2.py needs of a place (no functions, no derived checks) */
export function placePayload(S) {
  const { id, name, kind, sky, base, prims, spots, creature_spots, background, cameras, big, ground, walls_col, indoor, light, states } = S;
  return { id, name, kind, sky, base: base ?? null, states: states ?? null, prims, spots, creature_spots: creature_spots ?? {}, background: background ?? {}, cameras, big: big ?? null, ground: ground ?? null, indoor: !!indoor, light: light ?? null };
}

// node scripts/blockyWorlds/v2/placeKit.mjs [--solve] [ids...]   -> the free checks of the places (exit 1 on a problem)
if (process.argv[1]?.endsWith("placeKit.mjs")) {
  const argv = process.argv.slice(2), places = await allPlaces();
  const ids = argv.filter((a) => !a.startsWith("--"));
  let bad = 0;
  for (const id of ids.length ? ids : Object.keys(places)) {
    if (!places[id]) { console.log(`${id}: unknown`); bad++; continue; }
    if (argv.includes("--solve")) for (const n of solvePlace(places[id])) console.log(`${id}: ${n}`);
    const S = loadPlace(places[id]);
    const pr = checkPlace(S);
    console.log(`${id}: ${S.prims.length} shapes, ${S.obstacles.length} obstacles, ${Object.keys(S.spots).length} spots, ${Object.keys(S.cameras).length} cameras -> ${pr.length ? `${pr.length} PROBLEM(S)\n  - ${pr.join("\n  - ")}` : "ok"}`);
    if (pr.length) bad++;
  }
  process.exit(bad ? 1 : 0);
}
void CREATURE_R;
