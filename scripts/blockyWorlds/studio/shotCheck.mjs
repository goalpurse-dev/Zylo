// STUDIO MODE: the free Node pre-check of every shot (no render, no money). Each shot's code is validated
// (studio/validate.mjs), then run in a fresh vm context against a STUB api at several times of the cut (vm timeout
// 200 ms: a guard on top of the validator's loop rules). It reports:
//   errors      validation errors, runtime errors, unknown people / props / animals / assets, a missing camera() call
//   motion      the camera's travel over the cut (pos + look metres + fov degrees * 0.05): must be > MIN_MOVE
//   midMove     the camera already moving at frame 0 (its change between frame 0 and frame 1 > MIN_STEP)
// -> { [shotId]: { ok, errors, motion, midMove, cam0, cam1 } }
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { validateShotCode } from "./validate.mjs";
import { API_NAMES, POSES, FACES, ANIMALS, ANIMAL_ACTIONS } from "./shotApi.js";
import { houseInfo, roomPoint, placePoint, streetPoint, W } from "./world.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MIN_MOVE = 0.25, MIN_STEP = 0.004;
/** the board's prop kit names, read from page/simple/boardProps.js (the kit owner's file; read-only) */
export function kitProps() {
  const src = fs.readFileSync(path.join(HERE, "../engine/page/simple/boardProps.js"), "utf8");
  return [...src.matchAll(/^  ([a-z_]+): \(g\)/gm)].map((m) => m[1]);
}
const PROPS = new Set(kitProps());

/** where the board stages a person by its mark (approximate copy of page/simple/board.js), for the stub's pos() */
function stagedAt(where, homes, loc) {
  const w = String(where ?? "");
  if (w.startsWith("window:")) { const [, h, k] = w.split(":"); const hi = houseInfo(homes, h); if (hi) { const c = hi.win[Number(k) || 0]; return [c[0], c[1] - 1.4, c[2] - 0.75]; } }
  if (/^street:\d$/.test(w)) return streetPoint(Number(w.slice(7)));
  if (w.startsWith("room:") && /^room:/.test(loc)) { const m = W.ROOM_MARKS[w.slice(5)] ?? W.ROOM_MARKS.center; return roomPoint(homes, loc.slice(5), m[0], 0, m[1]) ?? [0, 0, 0]; }
  if (w.startsWith("place:") && /^place:/.test(loc)) return placePoint(loc.slice(6), w.slice(6)) ?? [0, 0, 0];
  return [0, 0, 0];
}

function stubApi({ t, dur, night, homes, shot, cast, assets, rec }) {
  const P = {};
  for (const p of shot.people ?? []) P[p.id] = stagedAt(p.where, homes, shot.loc);
  const num = (x, name) => { if (x != null && !Number.isFinite(Number(x))) rec.errors.add(`${name} is not a number`); };
  const pt = (a, name) => { if (!Array.isArray(a) || a.length < 3 || a.some((x) => !Number.isFinite(Number(x)))) { rec.errors.add(`${name} needs an [x, y, z] point`); return false; } return true; };
  const api = {
    t, dur, k: Math.min(1, t / dur), night, p: {},
    ease: (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); }, lerp: (a, b, k) => a + (b - a) * k, clamp: (x, a, b) => Math.min(b, Math.max(a, x)),
    mix: (p, q, k) => (pt(p, "mix") && pt(q, "mix") ? [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k, p[2] + (q[2] - p[2]) * k] : [0, 0, 0]),
    add: (p, d) => (pt(p, "add") ? [p[0] + (d?.[0] ?? 0), p[1] + (d?.[1] ?? 0), p[2] + (d?.[2] ?? 0)] : [0, 0, 0]),
    wave: (f, a, ph = 0) => a * Math.sin(2 * Math.PI * f * t + ph),
    orbit: (c, r, ang, h) => (pt(c, "orbit") ? [c[0] + r * Math.sin(ang), (c[1] ?? 0) + h, c[2] + r * Math.cos(ang)] : [0, 0, 0]),
    house: (o) => { const h = houseInfo(homes, o); if (!h) rec.errors.add(`house("${o}"): no such home (homes: ${Object.keys(homes).join(", ")})`); return h ?? houseInfo(homes, Object.keys(homes)[0]) ?? { x: 0, z: 0, door: [0, 0, 0], front: [0, 0, 0], curb: [0, 0, 0], win: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]] }; },
    room: (o, x = 0, y = 0, z = 0) => { const r = roomPoint(homes, o, x, y, z); if (!r) rec.errors.add(`room("${o}"): no such home`); return r ?? [0, y, 0]; },
    place: (n, m = "center") => { const r = placePoint(n, m); if (!r) rec.errors.add(`place("${n}"): unknown place`); return r ?? [0, 0, 0]; },
    street: (n) => streetPoint(n),
    pos: (id) => { if (!cast[id]) rec.errors.add(`pos("${id}"): not in the cast`); return P[id] ?? [0, 0, 0]; },
    head: (id) => { if (!cast[id]) rec.errors.add(`head("${id}"): not in the cast`); const p = P[id] ?? [0, 0, 0]; return [p[0], p[1] + 1.55, p[2]]; },
    person(id, o = {}) {
      if (!cast[id]) rec.errors.add(`person("${id}"): not in the cast (${Object.keys(cast).join(", ")})`);
      if (o.at && pt(o.at, `person(${id}).at`)) P[id] = o.at;
      if (o.pose && !POSES.includes(o.pose)) rec.errors.add(`pose "${o.pose}" is not a pose`);
      if (o.face && !FACES.includes(o.face)) rec.errors.add(`face "${o.face}" is not a face`);
      if (o.hold && !PROPS.has(o.hold)) rec.errors.add(`hold "${o.hold}" is not a kit prop`);
      num(o.yaw, "yaw"); rec.people.add(id); rec.ent[`p:${id}`] = P[id]; const pi = (rec.info[id] ??= {}); if (o.pose && o.pose !== "stand") pi.pose ??= o.pose; if (o.face) pi.face ??= o.face; if (o.hold) pi.hold ??= o.hold;
    },
    hide: () => {},
    monster(o = {}) { if (o.at) pt(o.at, "monster.at"); rec.monster = true; rec.ent.m = o.at ?? [0, 0, 0]; if (o.state && o.state !== "lurk") rec.active = true; },
    asset(name, params = {}) {
      if (!assets[name]) { rec.errors.add(`asset "${name}" is not defined`); return; }
      if (params.at) pt(params.at, `asset(${name}).at`); rec.assets.add(name); rec.ent[`a:${name}#${rec.nAsset = (rec.nAsset ?? 0) + 1}`] = params.at ?? [0, 0, 0];
      if (rec.depth > 0) { rec.errors.add("an asset may not draw another asset"); return; }
      const sub = stubApi({ t, dur, night, homes, shot, cast, assets, rec }); sub.p = params; rec.depth++;
      try { vm.runInNewContext(`(function (api, Math) { "use strict";\n${assets[name]}\n})(api, Math)`, { api: sub, Math }, { timeout: 200 }); }
      catch (e) { rec.errors.add(`asset ${name} runtime: ${String(e.message ?? e).slice(0, 160)}`); }
      finally { rec.depth--; }
    },
    prop(name, o = {}) { if (!PROPS.has(name)) rec.errors.add(`prop "${name}" is not a kit prop (build it from blocks or an asset)`); if (o.at) pt(o.at, `prop(${name}).at`); rec.props.add(name); },
    animal(species, o = {}) { rec.ent[`n:${species}#${rec.nAnimal = (rec.nAnimal ?? 0) + 1}`] = o.at ?? [0, 0, 0]; if (o.action && !["idle", "sit", "sleep"].includes(o.action)) rec.active = true; if (!ANIMALS.includes(species)) rec.errors.add(`animal "${species}" is not in the kit`); if (o.action && !ANIMAL_ACTIONS.includes(o.action)) rec.errors.add(`animal action "${o.action}" unknown`); if (o.at) pt(o.at, "animal.at"); rec.animals.add(species); },
    block(size, at, c, o = {}) { pt(size, "block size"); pt(at, "block at"); rec.prims++; if ((o?.glow ?? 0) >= 1) rec.glow++; },
    ball(r, at, c, o = {}) { num(r, "ball r"); pt(at, "ball at"); rec.prims++; if ((o?.glow ?? 0) >= 1) rec.glow++; },
    cyl(a, b, h, at, c, o = {}) { pt(at, "cyl at"); rec.prims++; if ((o?.glow ?? 0) >= 1) rec.glow++; },
    camera(c = {}) { if (pt(c.pos, "camera.pos") && pt(c.look, "camera.look")) rec.cam = { pos: c.pos.map(Number), look: c.look.map(Number), fov: Number(c.fov ?? 50), roll: Number(c.roll ?? 0) }; },
    shake: () => {},
  };
  for (const k of API_NAMES) if (!(k in api)) throw new Error(`stub api misses ${k}`);
  return api;
}

const camDelta = (a, b) => (!a || !b ? 0 : Math.hypot(...a.pos.map((x, i) => x - b.pos[i])) + Math.hypot(...a.look.map((x, i) => x - b.look[i])) * 0.5 + Math.abs(a.fov - b.fov) * 0.05 + Math.abs(a.roll - b.roll));

/** run one shot (or asset) body at time t; returns the record */
function runAt(code, ctx, t) {
  const rec = { errors: new Set(), people: new Set(), props: new Set(), animals: new Set(), assets: new Set(), prims: 0, monster: false, cam: null, depth: 0, info: {}, glow: 0, ent: {}, active: false };
  const api = stubApi({ ...ctx, t, rec });
  try { vm.runInNewContext(`(function (api, Math) { "use strict";\n${code}\n})(api, Math)`, { api, Math }, { timeout: 200 }); }
  catch (e) { rec.errors.add(`runtime at t=${t.toFixed(2)}: ${String(e.message ?? e).slice(0, 160)}`); }
  if (rec.prims > 150) rec.errors.add(`${rec.prims} primitives (max 150 a frame)`);
  return rec;
}

/** every shot of a studio plan: { [id]: { ok, errors, motion, midMove } } */
export function checkShots({ shots, assets = {}, homes, cast, timing }) {
  const out = {};
  // assets first: validated (they run inside a shot's frame, with the same api)
  const assetErr = {};
  for (const [name, code] of Object.entries(assets)) { const v = validateShotCode(code); if (!v.ok) assetErr[name] = v.errors; }
  for (const s of shots) {
    const errors = [];
    const v = validateShotCode(s.code);
    if (!v.ok) { out[s.id] = { ok: false, errors: v.errors.map((e) => `code: ${e}`), motion: 0, midMove: false }; continue; }
    const dur = Math.max(0.05, timing?.[s.id]?.dur ?? 1.2), night = ["night", "dusk"].includes(s.light);
    // only VALID asset code is ever run (an invalid one is reported, never executed)
    const ctx = { dur, night, homes, shot: s, cast, assets: Object.fromEntries(Object.entries(assets).filter(([n]) => !assetErr[n])) };
    const f = 1 / 24, times = [0, f, dur / 2, Math.max(f, dur - f)];
    const recs = times.map((t) => runAt(s.code, ctx, t));
    for (const r of recs) for (const e of r.errors) if (!errors.includes(e)) errors.push(e);
    for (const name of new Set(recs.flatMap((r) => [...r.assets]))) if (assetErr[name]) errors.push(`asset ${name}: ${assetErr[name][0]}`);
    if (recs.some((r) => !r.cam)) errors.push("camera() is not called every frame");
    const motion = camDelta(recs[0].cam, recs[3].cam), step = camDelta(recs[0].cam, recs[1].cam);
    if (recs[0].cam && motion < MIN_MOVE) errors.push(`the camera barely moves (${motion.toFixed(2)} over the cut; every shot needs a move > ${MIN_MOVE})`);
    if (recs[0].cam && step < MIN_STEP) errors.push("the camera is still at frame 0 (start the move already in motion: e.g. use 0.25 + 0.75 * k)");
    // the SHOT MIX data (studio/shotMix.mjs): is someone / something DOING something (an act, an action pose, an
    // animal action, the creature acting, anything that moves over 0.25 m in the cut), and where the camera looks
    const moved = Object.keys(recs[0].ent).some((k) => recs[3].ent[k] && Math.hypot(...recs[0].ent[k].map((v, i) => v - recs[3].ent[k][i])) > 0.25);
    const posed = Object.values(Object.assign({}, ...recs.map((r) => r.info))).some((x) => x.pose && !["stand", "sit", "sleep"].includes(x.pose)) || (s.people ?? []).some((p) => p.pose && !["stand", "sit", "sleep"].includes(p.pose));
    const doing = (s.acts ?? []).length > 0 || posed || moved || recs.some((r) => r.active);
    const motionOnly = errors.length > 0 && errors.every((e) => /barely moves|still at frame 0/.test(e)); // a still camera: the adapter's safety push can save it
    out[s.id] = { ok: errors.length === 0, motionOnly, doing, look: recs[2].cam?.look ?? null, animalsDrawn: recs.some((r) => r.nAnimal), errors: errors.slice(0, 8), motion: +motion.toFixed(3), midMove: step >= MIN_STEP, people: [...new Set(recs.flatMap((r) => [...r.people]))], info: Object.assign({}, ...recs.slice().reverse().map((r) => r.info)), props: [...new Set(recs.flatMap((r) => [...r.props]))], animals: [...new Set(recs.flatMap((r) => [...r.animals]))], assets: [...new Set(recs.flatMap((r) => [...r.assets]))], monster: recs.some((r) => r.monster) };
  }
  return out;
}

/** an asset's own check: validated, runs in the stub, how many glowing parts it draws (a creature needs a face that reads
 *  at night: at least 2 glowing parts, its eyes) -> { ok, errors, glow, prims } */
export function assetInfo(code, { homes = {}, cast = {} } = {}) {
  const v = validateShotCode(code);
  if (!v.ok) return { ok: false, errors: v.errors, glow: 0, prims: 0 };
  const rec = runAt(code, { dur: 1, night: true, homes, shot: { people: [] }, cast, assets: {} }, 0.5);
  return { ok: rec.errors.size === 0, errors: [...rec.errors], glow: rec.glow, prims: rec.prims };
}
