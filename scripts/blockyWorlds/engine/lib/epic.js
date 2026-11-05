// Blocky Worlds EPIC stories (EPIC agent): the pure, deterministic core shared by the browser modules
// (page/kit/giants.js, page/kit/crowd.js, page/cameraEpic.js, page/sets/creatureWorld.js) and Node (planner, SFX,
// tests). No three.js, no I/O, no Math.random(): every value depends only on its inputs (frames depend on (timeline, t)).
//
//   formationSlots(formation, count, opts)     -> [{ x, z, row, col, phase, jitter }] crowd places (metres, local)
//   crowdMotion(action, t, slot, opts)          -> per-character motion at shot time t (offset, yaw, gait, arms, jump)
//   gaitOf(kind, action), giantFootfalls(...)   -> giant walk timing (cadence, stride) and the moments feet hit the ground
//   shake(preset, t, opts)                      -> camera shake { x, y, z, pitch, yaw, roll } (deterministic)
//   BEATS, beatPlan(type, dur, opts)            -> action-beat data: who moves where, the shake, the SFX cue names
//   validateEpicShot(shot, tl), validateEpic(tl) -> problems (schema of the EPIC timeline fields, CONTRACT addendum)
//   epicSfxCandidates(tl)                       -> SFX candidates in lib/sfx.js sfxCandidates() shape
//   EPIC_SFX_TIMING                             -> [dur, anchor, gainDb] of the EPIC sounds (kept equal to audio/sfxEpic.mjs)

// ------------------------------------------------------------------------------------------------ vocabulary
export const GIANT_KINDS = Object.freeze(["turtle", "whale", "elephant", "snail", "wolf", "bear", "dragon", "dog", "cat", "frog", "crab", "giant_human", "generic"]);
export const GIANT_ACTIONS = Object.freeze(["idle", "walk", "run", "stomp", "roar", "attack", "swim", "hit", "fall"]);
// the builder's vocabulary (lib/builder/spec.js CROWD_FORMATIONS / CROWD_ACTIONS) is a subset: both are accepted
export const FORMATIONS = Object.freeze(["block", "line", "wedge", "scatter", "ring", "march", "column"]);
export const CROWD_ACTIONS = Object.freeze(["stand", "march", "charge", "run", "flee", "cheer", "fight", "wave"]);
export const CROWD_KINDS = Object.freeze(["soldier", "townsfolk", "knight", "wolf_soldier"]);
export const WORLD_VIEWS = Object.freeze(["inside", "on", "outside"]);
export const SHAKES = Object.freeze(["none", "impact", "stomp", "rumble", "roar", "fall"]);
export const EPIC_CAMERAS = Object.freeze(["establish", "hero_low", "track", "aerial", "giant_close", "duel", "behind_army"]);
export const BEAT_TYPES = Object.freeze(["chase", "attack", "impact", "fall", "stomp", "roar", "charge", "flee", "cheer", "march", "swim_away"]);
export const EPIC_SPOTS = Object.freeze(["center", "left", "right", "back", "far", "door", "near", "giant_left", "giant_right", "horizon", "shell", "tail", "head"]);

// ------------------------------------------------------------------------------------------------ small helpers
const TAU = Math.PI * 2;
/** a seeded generator (same algorithm as lib/rng.js, kept local so this file has no imports) */
export function prng(seed = 1) {
  let a = (Number(seed) >>> 0) || 1;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let x = a; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}
const hash01 = (n) => { let x = (Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b) >>> 0); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35) >>> 0; x ^= x >>> 16; return x / 4294967296; };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (p) => { p = clamp(p, 0, 1); return p * p * (3 - 2 * p); };
const r3 = (v) => Math.round(v * 1000) / 1000;

// ------------------------------------------------------------------------------------------------ formations
/**
 * formationSlots(formation, count, { spacing = 1.3, seed = 1, aspect = 1.6, cols }) -> slots
 * Local frame: the crowd faces +z (like people.js), the front row has the largest z; x is across. Slots are centred
 * on the origin (mean x = 0, mean z = 0 within rounding). Each slot: { x, z, row, col, phase (0-1, gait offset),
 * jitter (0-1, per-character variety) }. Deterministic for (formation, count, opts).
 */
export function formationSlots(formation, count, opts = {}) {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  const sp = Math.max(0.6, Number(opts.spacing) || 1.3), R = prng((opts.seed ?? 1) * 7919 + n);
  const f = FORMATIONS.includes(formation) ? formation : "block";
  const out = [];
  const push = (x, z, row, col) => out.push({ x, z, row, col, phase: R(), jitter: R() });
  if (f === "block" || f === "march" || f === "column") {
    // block: wider than deep (aspect); march / column: a narrow column, 4-8 wide
    const cols = opts.cols ?? (f === "block" ? Math.max(1, Math.round(Math.sqrt(n * (opts.aspect ?? 1.6)))) : clamp(Math.round(Math.sqrt(n) / 2), 4, 8));
    const rows = Math.ceil(n / cols);
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / cols), col = i % cols, inRow = row === rows - 1 ? n - row * cols : cols;
      push((col - (inRow - 1) / 2) * sp, -row * sp * (f === "block" ? 1 : 1.15), row, col);
    }
  } else if (f === "line") {
    const per = opts.cols ?? Math.min(n, 40), rows = Math.ceil(n / per);
    for (let i = 0; i < n; i++) { const row = Math.floor(i / per), col = i % per, inRow = row === rows - 1 ? n - row * per : per; push((col - (inRow - 1) / 2) * sp + (row % 2) * sp * 0.5, -row * sp, row, col); }
  } else if (f === "wedge") {
    // row r holds 2r+1 characters; the tip leads (front, largest z)
    let i = 0, row = 0;
    while (i < n) { const k = Math.min(2 * row + 1, n - i); for (let c = 0; c < k; c++, i++) push((c - (k - 1) / 2) * sp, -row * sp, row, c); row++; }
  } else if (f === "ring") {
    // concentric rings, ~sp apart around each ring, facing inward is up to the caller (yaw is per action)
    let i = 0, ring = 0;
    while (i < n) { const rad = (ring + 2) * sp * 1.2, k = Math.min(n - i, Math.max(6, Math.floor((TAU * rad) / sp))); for (let c = 0; c < k; c++, i++) { const a = (c / k) * TAU + ring * 0.3; push(Math.sin(a) * rad, Math.cos(a) * rad, ring, c); } ring++; }
  } else { // scatter: a disc, dart-throwing with a minimum distance (bounded tries, deterministic)
    const rad = Math.sqrt(n) * sp * 0.75 + sp, min2 = (sp * 0.8) ** 2;
    for (let i = 0; i < n; i++) {
      let x = 0, z = 0;
      for (let tries = 0; tries < 30; tries++) {
        const a = R() * TAU, d = Math.sqrt(R()) * rad; x = Math.sin(a) * d; z = Math.cos(a) * d;
        if (!out.some((o) => (o.x - x) ** 2 + (o.z - z) ** 2 < min2)) break;
      }
      push(x, z, 0, i);
    }
  }
  // centre on the origin and add a little per-character jitter so ranks never look like a grid of clones
  const jit = f === "scatter" || f === "ring" ? 0 : (opts.jitter ?? 0.12) * sp;
  const mx = out.reduce((s, o) => s + o.x, 0) / Math.max(1, out.length), mz = out.reduce((s, o) => s + o.z, 0) / Math.max(1, out.length);
  for (const o of out) { o.x = r3(o.x - mx + (o.jitter - 0.5) * jit); o.z = r3(o.z - mz + (hash01(o.row * 977 + o.col) - 0.5) * jit); }
  return out;
}
/** half extents of a formation: { halfW, halfD } (for camera framing and spot fitting) */
export function formationExtent(slots) {
  if (!slots.length) return { halfW: 0, halfD: 0 };
  let w = 0, d = 0; for (const s of slots) { w = Math.max(w, Math.abs(s.x)); d = Math.max(d, Math.abs(s.z)); }
  return { halfW: w + 0.5, halfD: d + 0.5 };
}

// ------------------------------------------------------------------------------------------------ crowd motion
/** per action: forward speed (m/s), gait cycles per second, lean, whether the ranks keep step */
export const CROWD_MOTION = Object.freeze({
  stand: { speed: 0, cadence: 0, lean: 0, inStep: false },
  march: { speed: 1.5, cadence: 1.0, lean: 0.03, inStep: true },
  charge: { speed: 4.6, cadence: 1.55, lean: 0.28, inStep: false },
  run: { speed: 4.2, cadence: 1.5, lean: 0.22, inStep: false },
  flee: { speed: 4.0, cadence: 1.5, lean: 0.2, inStep: false },
  cheer: { speed: 0, cadence: 2.0, lean: -0.05, inStep: false },
  fight: { speed: 0, cadence: 1.3, lean: 0.12, inStep: false },
  wave: { speed: 0, cadence: 1.6, lean: 0, inStep: false },
});
/**
 * crowdMotion(action, t, slot, { speed, delay }) -> { dx, dz, yaw, bob, legSwing, armL, armR, lean, jump, weapon }
 *   dx/dz: offset from the slot (local frame, metres); yaw: added heading (radians, 0 = +z); legSwing: hip angle
 *   (radians, + = right leg forward); armL / armR: shoulder pitch (radians, negative = raised forward/up);
 *   jump: feet height (m); weapon: 0 = upright, 1 = levelled forward (spears in a charge).
 * Ranks start one after another (the front first) in a charge/flee, so the crowd stretches out naturally.
 */
export function crowdMotion(action, t, slot = { phase: 0, jitter: 0.5, row: 0 }, opts = {}) {
  const a = CROWD_MOTION[action] ? action : "stand", M = CROWD_MOTION[a];
  const ph = M.inStep ? 0 : slot.phase ?? 0, jit = slot.jitter ?? 0.5;
  const delay = opts.delay ?? (a === "charge" || a === "flee" || a === "run" ? (slot.row ?? 0) * 0.08 + jit * 0.15 : 0);
  const tt = Math.max(0, t - delay);
  const speed = (opts.speed ?? M.speed) * (M.inStep ? 1 : 0.88 + jit * 0.24);
  const cyc = (tt * M.cadence + ph) * TAU;
  const o = { dx: 0, dz: 0, yaw: 0, bob: 0, legSwing: 0, armL: 0, armR: 0, lean: M.lean, jump: 0, weapon: 0 };
  // accelerate into the run over 0.4 s (no instant teleport-speed at the cut)
  const dist = speed > 0 ? speed * (tt - 0.2 * (1 - Math.exp(-tt / 0.2))) : 0;
  switch (a) {
    case "stand": o.bob = 0.008 * Math.sin((t * 0.9 + ph) * TAU); o.armL = o.armR = 0.04 * Math.sin((t * 0.5 + ph) * TAU); break;
    case "march": o.dz = dist; o.legSwing = 0.42 * Math.sin(cyc); o.armL = 0.35 * Math.sin(cyc); o.armR = -0.35 * Math.sin(cyc); o.bob = 0.035 * Math.abs(Math.sin(cyc)); break;
    case "charge": case "run":
      o.dz = dist; o.legSwing = 0.8 * Math.sin(cyc); o.armL = -0.7 + 0.25 * Math.sin(cyc); o.armR = a === "charge" ? -1.05 : -0.6 * Math.sin(cyc);
      o.bob = 0.09 * Math.abs(Math.sin(cyc)); o.weapon = a === "charge" ? smooth(tt / 0.35) : 0; break;
    case "flee": {
      // turn around (the first 0.25 s) and scatter a little sideways
      const side = (jit - 0.5) * 0.9;
      o.yaw = Math.PI + side * smooth(tt / 0.3);
      o.dz = -dist * Math.cos(side); o.dx = -dist * Math.sin(side) * -1;
      o.legSwing = 0.8 * Math.sin(cyc); o.armL = -2.5 + 0.3 * Math.sin(cyc * 1.1); o.armR = -2.5 + 0.3 * Math.sin(cyc * 0.9 + 1);
      o.bob = 0.08 * Math.abs(Math.sin(cyc)); break;
    }
    case "cheer": { const j = Math.max(0, Math.sin(cyc)); o.jump = 0.22 * j * (0.7 + 0.6 * jit); o.armL = -2.7 + 0.35 * Math.sin(cyc * 1.5); o.armR = -2.7 + 0.35 * Math.sin(cyc * 1.5 + 1.3); break; }
    case "fight": { const s = Math.sin(cyc); o.dz = 0.25 * Math.max(0, s); o.armR = -1.6 + 1.1 * Math.max(0, s); o.armL = -0.9; o.legSwing = 0.3 * s; o.weapon = 0.6 + 0.4 * Math.max(0, s); break; }
    case "wave": o.armR = -2.6 + 0.0; o.armL = 0.05; o.bob = 0.01 * Math.sin(cyc); o.wave = 0.45 * Math.sin(cyc * 1.5); break;
  }
  for (const k of Object.keys(o)) o[k] = r3(o[k]);
  return o;
}

// ------------------------------------------------------------------------------------------------ giants: gait
/** per kind/action: gait cycles per second at a 60 m reference size (bigger = slower: cadence ~ 1/sqrt(size)), stride (body lengths per cycle), feet */
const GAITS = {
  quadruped: { walk: [0.42, 0.45, 4], run: [0.8, 0.9, 4], stomp: [0.55, 0, 1] },
  biped: { walk: [0.55, 0.38, 2], run: [0.95, 0.7, 2], stomp: [0.6, 0, 1] },
  swimmer: { swim: [0.3, 0.6, 0], walk: [0.3, 0.6, 0] },
  slider: { walk: [0.25, 0.12, 0] },
};
export const PLAN_OF = Object.freeze({ turtle: "quadruped", elephant: "quadruped", bear: "quadruped", dog: "quadruped", cat: "quadruped", dragon: "quadruped", frog: "quadruped", crab: "quadruped", generic: "quadruped", whale: "swimmer", snail: "slider", wolf: "biped", giant_human: "biped" });
/** { cadence (cycles/s), stride (m per cycle), feet } for a giant of `kind` (or plan) and size (m) doing `action` */
export function gaitOf(kind, action = "walk", size = 60) {
  const plan = GAITS[kind] ? kind : PLAN_OF[kind] ?? "quadruped";
  const g = GAITS[plan][action] ?? GAITS[plan].walk ?? [0.4, 0.4, 0];
  const k = Math.sqrt(60 / Math.max(5, size));
  return { plan, cadence: r3(g[0] * k), stride: r3(g[1] * size), feet: g[2], speed: r3(g[0] * k * g[1] * size) };
}
/**
 * giantFootfalls(kind, action, t0, t1, { size, phase }) -> [t] the moments a foot hits the ground in [t0, t1)
 * (for stomp SFX and stomp shakes). Quadrupeds land two feet per half cycle (diagonal pairs), bipeds one per half cycle,
 * "stomp" one big hit per cycle at 60 % of the cycle (after the raise).
 */
export function giantFootfalls(kind, action, t0, t1, opts = {}) {
  const g = gaitOf(kind, action, opts.size ?? 60), ph = opts.phase ?? 0, out = [];
  if (!g.feet || !(t1 > t0) || !g.cadence) return out;
  const per = action === "stomp" ? 1 : 2, at = action === "stomp" ? 0.6 : 0.25;
  const step = 1 / (g.cadence * per);
  for (let k = Math.floor((t0 * g.cadence + ph) * per) - 1; ; k++) {
    const t = (k / per + at / per - ph) / g.cadence;
    if (t >= t1) break;
    if (t >= t0 - 1e-9) out.push(r3(t));
    if (out.length > 400) break;
  }
  void step;
  return out;
}

// ------------------------------------------------------------------------------------------------ camera shake
/** presets: amplitude (rotation rad, position m), frequency (Hz), decay (s), repeat period (s, stomps) */
export const SHAKE_PRESETS = Object.freeze({
  none: { rot: 0, pos: 0, hz: 0, decay: 1 },
  impact: { rot: 0.045, pos: 0.12, hz: 17, decay: 0.32 },
  stomp: { rot: 0.022, pos: 0.07, hz: 13, decay: 0.24, period: 1.4 },
  rumble: { rot: 0.006, pos: 0.02, hz: 7, decay: 0, continuous: true },
  roar: { rot: 0.012, pos: 0.03, hz: 21, decay: 0, span: 1.6 },
  fall: { rot: 0.06, pos: 0.16, hz: 11, decay: 0.55 },
});
/** smooth deterministic noise in [-1, 1]: three incommensurate sines with hashed phases */
function wobble(t, hz, seed) {
  const p1 = hash01(seed * 3 + 1) * TAU, p2 = hash01(seed * 3 + 2) * TAU, p3 = hash01(seed * 3 + 3) * TAU;
  return (Math.sin(t * hz * TAU + p1) * 0.55 + Math.sin(t * hz * 1.73 * TAU + p2) * 0.3 + Math.sin(t * hz * 2.91 * TAU + p3) * 0.15);
}
/**
 * shake(preset, t, { at = 0, seed = 1, scale = 1, dur, period }) -> { x, y, z, pitch, yaw, roll, k }
 * t: shot-local time; at: the hit time (impact/stomp/fall: nothing before it; stomp repeats every `period`).
 * k: the envelope (0-1), handy for tests and for a matching flash/dust. Zero when preset is none/unknown.
 */
export function shake(preset, t, opts = {}) {
  const P = SHAKE_PRESETS[preset] ?? SHAKE_PRESETS.none, seed = opts.seed ?? 1, scale = opts.scale ?? 1, at = opts.at ?? 0;
  let k = 0;
  if (!P.hz) k = 0;
  else if (P.continuous) { const d = opts.dur ?? 1e9; k = smooth(t / 0.3) * smooth((d - t) / 0.3); }
  else if (P.span) { const u = t - at; k = u < 0 ? 0 : smooth(u / 0.15) * smooth((P.span - u) / 0.4); }
  else if (P.period || opts.period) {
    const per = opts.period ?? P.period, u = t - at;
    if (u >= 0) { const local = u % per; k = Math.exp(-local / P.decay) * smooth(local / 0.02); }
  } else { const u = t - at; k = u < 0 ? 0 : Math.exp(-u / P.decay) * smooth(u / 0.02); }
  k *= scale;
  const z = { x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0, k: r3(k) };
  if (k <= 1e-5) return z;
  z.x = r3(P.pos * k * wobble(t, P.hz, seed));
  z.y = r3(P.pos * k * wobble(t, P.hz * 1.1, seed + 11));
  z.z = r3(P.pos * 0.5 * k * wobble(t, P.hz * 0.9, seed + 23));
  z.pitch = +(P.rot * k * wobble(t, P.hz, seed + 37)).toFixed(5);
  z.yaw = +(P.rot * 0.7 * k * wobble(t, P.hz * 1.2, seed + 41)).toFixed(5);
  z.roll = +(P.rot * 0.8 * k * wobble(t, P.hz * 0.8, seed + 53)).toFixed(5);
  return z;
}

// ------------------------------------------------------------------------------------------------ action beats
/**
 * Beat data. Roles are filled by the shot (giants[] / crowds[] / actors[] with matching `role`):
 *   move: { from, to } spots (EPIC_SPOTS) or "here"; ease over [t0, t1] (fractions of the shot)
 *   action: the giant / crowd action during the beat
 * shake: { preset, at (fraction of the shot) }; sfx: [{ name, at (fraction), loop? }]; camera: suggested EPIC camera.
 */
export const BEATS = Object.freeze({
  chase: { roles: { chaser: { action: "run", move: { from: "far", to: "back", t0: 0, t1: 1 } }, target: { action: "run", move: { from: "back", to: "near", t0: 0, t1: 1 } } }, shake: { preset: "rumble", at: 0 }, sfx: [{ name: "giant_steps", at: 0, loop: true }], camera: "track" },
  attack: { roles: { attacker: { action: "attack", move: { from: "here", to: "toward_target", t0: 0.2, t1: 0.55, dist: 0.25 } }, target: { action: "hit", at: 0.55 } }, shake: { preset: "impact", at: 0.55 }, sfx: [{ name: "roar_big", at: 0.05 }, { name: "impact_big", at: 0.55 }], camera: "duel" },
  impact: { roles: { target: { action: "hit", at: 0.15 } }, shake: { preset: "impact", at: 0.15 }, sfx: [{ name: "impact_big", at: 0.15 }], camera: "establish" },
  fall: { roles: { faller: { action: "fall", at: 0 } }, shake: { preset: "fall", at: 0.7 }, sfx: [{ name: "whoosh_2", at: 0.1 }, { name: "giant_thud", at: 0.7 }], camera: "establish" },
  stomp: { roles: { giant: { action: "stomp" } }, shake: { preset: "stomp", at: 0.6 }, sfx: [{ name: "giant_stomp", at: 0.6 }], camera: "hero_low" },
  roar: { roles: { giant: { action: "roar" } }, shake: { preset: "roar", at: 0.15 }, sfx: [{ name: "roar_big", at: 0.12 }], camera: "giant_close" },
  charge: { roles: { army: { action: "charge", move: { from: "here", to: "forward", t0: 0, t1: 1 } } }, shake: { preset: "rumble", at: 0 }, sfx: [{ name: "army_charge", at: 0.05 }], camera: "track" },
  march: { roles: { army: { action: "march" } }, shake: { preset: "none", at: 0 }, sfx: [{ name: "army_march", at: 0, loop: true }], camera: "track" },
  flee: { roles: { crowd: { action: "flee" } }, shake: { preset: "rumble", at: 0 }, sfx: [{ name: "crowd_panic", at: 0.1 }], camera: "establish" },
  cheer: { roles: { crowd: { action: "cheer" } }, shake: { preset: "none", at: 0 }, sfx: [{ name: "crowd_cheer", at: 0.15 }], camera: "establish" },
  swim_away: { roles: { swimmer: { action: "swim", move: { from: "here", to: "horizon", t0: 0, t1: 1 } } }, shake: { preset: "none", at: 0 }, sfx: [{ name: "splash_big", at: 0.1 }], camera: "establish" },
});
/**
 * beatPlan(type, dur, { shake }) -> { type, shake: { preset, at (s) }, sfx: [{ name, at (s), dur? }], roles, camera }
 * dur: the shot length (s). shot.beat.shake may override the preset ("none" switches it off).
 */
export function beatPlan(type, dur, opts = {}) {
  const B = BEATS[type];
  if (!B) return null;
  const D = Math.max(0.1, Number(dur) || 1);
  const preset = opts.shake && SHAKES.includes(opts.shake) ? opts.shake : B.shake.preset;
  const atS = (f) => r3(clamp(f, 0, 1) * D);
  return {
    type, camera: B.camera,
    shake: { preset, at: atS(opts.at ?? B.shake.at) },
    sfx: B.sfx.map((s) => ({ name: s.name, at: atS(s.at), ...(s.loop ? { dur: r3(D - atS(s.at)) } : {}) })),
    roles: JSON.parse(JSON.stringify(B.roles)),
  };
}
/** position along a beat move at shot fraction u (0-1): eased 0..1 between t0 and t1 */
export const beatProgress = (move, u) => (move ? smooth((u - (move.t0 ?? 0)) / Math.max(1e-3, (move.t1 ?? 1) - (move.t0 ?? 0))) : 0);

// ------------------------------------------------------------------------------------------------ schema (CONTRACT addendum)
const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
/**
 * validateEpicShot(shot, tl) -> problems[] for the EPIC fields of one shot:
 *   shot.world  { kind: "creature", creature, view: inside|on|outside }   (or set "creature:<id>" with tl.worlds[id])
 *   shot.giants [{ id, kind?, size?, spot?|pos?, action, facing?, role? }]   (id in tl.giants)
 *   shot.crowds [{ kind, count, formation, action, spot?|area?, faction?, facing?, role? }]
 *   shot.beat   { type, shake?, at? }
 *   shot.camera may also be an EPIC camera (establish, hero_low, track, aerial, giant_close, duel)
 */
export function validateEpicShot(s, tl = {}) {
  const bad = [];
  const at = `shot ${s.start}-${s.end}`;
  if (s.world != null) {
    if (!isObj(s.world)) bad.push(`${at}: world must be an object`);
    else {
      if (s.world.kind !== "creature") bad.push(`${at}: world.kind must be "creature"`);
      if (!GIANT_KINDS.includes(s.world.creature) && !(typeof s.world.creature === "string" && s.world.creature.length)) bad.push(`${at}: world.creature missing`);
      if (!WORLD_VIEWS.includes(s.world.view)) bad.push(`${at}: world.view "${s.world.view}" (${WORLD_VIEWS.join(", ")})`);
    }
  }
  if (/^creature:/.test(s.set ?? "") && !isObj(tl.worlds?.[s.set.slice(9)])) bad.push(`${at}: set "${s.set}" is not in timeline.worlds`);
  if (s.giants != null) {
    if (!Array.isArray(s.giants)) bad.push(`${at}: giants must be a list`);
    else s.giants.forEach((g, i) => {
      if (!isObj(g)) { bad.push(`${at}: giants[${i}] is not an object`); return; }
      if (g.id === "world") { if (!/^creature:/.test(s.set ?? "")) bad.push(`${at}: giant "world" (the creature the town lives on) needs a creature set`); }
      else if (!g.id || !isObj(tl.giants?.[g.id])) bad.push(`${at}: giant "${g.id}" is not in timeline.giants`);
      if (g.action != null && !GIANT_ACTIONS.includes(g.action)) bad.push(`${at}: giant "${g.id}" unknown action "${g.action}" (${GIANT_ACTIONS.join(", ")})`);
      if (g.spot != null && !EPIC_SPOTS.includes(g.spot)) bad.push(`${at}: giant "${g.id}" unknown spot "${g.spot}"`);
      if (g.pos != null && !(Array.isArray(g.pos) && g.pos.length === 3 && g.pos.every(Number.isFinite))) bad.push(`${at}: giant "${g.id}" pos must be [x, y, z]`);
    });
  }
  if (s.crowds != null) {
    if (!Array.isArray(s.crowds)) bad.push(`${at}: crowds must be a list`);
    else s.crowds.forEach((c, i) => {
      if (!isObj(c)) { bad.push(`${at}: crowds[${i}] is not an object`); return; }
      if (!CROWD_KINDS.includes(c.kind)) bad.push(`${at}: crowds[${i}] unknown kind "${c.kind}" (${CROWD_KINDS.join(", ")})`);
      if (!(Number.isInteger(c.count) && c.count >= 1 && c.count <= 2000)) bad.push(`${at}: crowds[${i}] count must be 1-2000`);
      if (c.formation != null && !FORMATIONS.includes(c.formation)) bad.push(`${at}: crowds[${i}] unknown formation "${c.formation}" (${FORMATIONS.join(", ")})`);
      if (c.action != null && !CROWD_ACTIONS.includes(c.action)) bad.push(`${at}: crowds[${i}] unknown action "${c.action}" (${CROWD_ACTIONS.join(", ")})`);
      if (c.spot != null && !EPIC_SPOTS.includes(c.spot)) bad.push(`${at}: crowds[${i}] unknown spot "${c.spot}"`);
    });
  }
  if (s.beat != null) {
    if (!isObj(s.beat) || !BEAT_TYPES.includes(s.beat.type)) bad.push(`${at}: unknown beat "${s.beat?.type}" (${BEAT_TYPES.join(", ")})`);
    else if (s.beat.shake != null && !SHAKES.includes(s.beat.shake)) bad.push(`${at}: unknown shake "${s.beat.shake}" (${SHAKES.join(", ")})`);
  }
  if (EPIC_CAMERAS.includes(s.camera) && !(s.giants?.length || s.crowds?.length || s.world || /^creature:/.test(s.set ?? ""))) bad.push(`${at}: EPIC camera "${s.camera}" needs giants, crowds or a creature world`);
  return bad;
}
/** every EPIC problem of a timeline (giant specs + each shot) */
export function validateEpic(tl) {
  const bad = [];
  for (const [id, g] of Object.entries(tl.giants ?? {})) {
    if (!isObj(g)) { bad.push(`giant "${id}" is not an object`); continue; }
    if (g.kind && !GIANT_KINDS.includes(g.kind) && !isObj(g.params)) bad.push(`giant "${id}": unknown kind "${g.kind}" without params (generic giants need params)`);
    if (g.size != null && !(g.size >= 5 && g.size <= 200)) bad.push(`giant "${id}": size ${g.size} m outside 5-200`);
  }
  for (const s of tl.shots ?? []) bad.push(...validateEpicShot(s, tl));
  return bad;
}

// ------------------------------------------------------------------------------------------------ SFX
/** [dur, anchor, gainDb] of the EPIC sounds (audio/sfxEpic.mjs is the catalog; a test keeps the two equal) */
export const EPIC_SFX_TIMING = Object.freeze({
  giant_stomp: [1.9, 0.0, -2], giant_steps: [2.4, 0, -5], giant_thud: [2.2, 0.0, -2], impact_big: [2.0, 0.0, -2],
  roar_big: [2.6, 0.2, -4], army_march: [2.0, 0, -8], army_charge: [2.8, 0.15, -6], crowd_panic: [2.4, 0.1, -9],
  shield_clash: [0.9, 0.0, -6], rumble: [3.0, 0, -9], splash_big: [2.2, 0.05, -4], whale_call: [2.8, 0.3, -7],
});
/**
 * epicSfxCandidates(tl) -> [{ at, name, prio, why, dur? }] — the same shape as lib/sfx.js sfxCandidates(), so
 * sfxCues() can merge them and keep its sparseness rules (about 8 per 100 s, each sound once, never 2 within 1.2 s).
 * Sources: shot.beat (its sfx list), giants (first stomp / roar), crowds (march loop, charge yell, cheer, panic).
 */
export function epicSfxCandidates(tl) {
  const out = [];
  (tl.shots ?? []).forEach((s, i) => {
    const dur = s.end - s.start, prev = tl.shots[i - 1];
    if (s.beat && BEATS[s.beat.type]) {
      const p = beatPlan(s.beat.type, dur, s.beat);
      for (const c of p.sfx) out.push({ at: r3(s.start + c.at), name: c.name, prio: c.name === "impact_big" || c.name === "giant_thud" ? 9 : 7, why: `shot ${i}: beat ${s.beat.type}`, ...(c.dur ? { dur: Math.min(4.5, c.dur) } : {}) });
    }
    for (const g of s.giants ?? []) {
      const spec = tl.giants?.[g.id] ?? {}, kind = spec.kind ?? "generic";
      const was = (prev?.giants ?? []).find((x) => x.id === g.id)?.action;
      if ((g.action === "walk" || g.action === "run" || g.action === "stomp") && was !== g.action) {
        const f = giantFootfalls(kind, g.action, 0.15, dur, { size: spec.size ?? 60 });
        if (f.length) out.push({ at: r3(s.start + f[0]), name: g.action === "stomp" ? "giant_stomp" : "giant_steps", prio: g.action === "stomp" ? 8 : 5, why: `shot ${i}: ${g.id} ${g.action}s`, ...(g.action === "stomp" ? {} : { dur: Math.min(4.5, dur - f[0]) }) });
      }
      if (g.action === "roar" && was !== "roar") out.push({ at: r3(s.start + 0.2), name: "roar_big", prio: 8, why: `shot ${i}: ${g.id} roars` });
      if (g.action === "swim" && was !== "swim" && spec.kind === "whale") out.push({ at: r3(s.start + 0.3), name: "whale_call", prio: 5, why: `shot ${i}: the whale` });
    }
    for (const c of s.crowds ?? []) {
      const was = (prev?.crowds ?? []).some((x) => x.kind === c.kind && x.action === c.action);
      if (was) continue;
      const name = { march: "army_march", charge: "army_charge", cheer: "crowd_cheer", flee: "crowd_panic", fight: "shield_clash" }[c.action];
      if (name) out.push({ at: r3(s.start + (c.action === "march" ? 0 : 0.12)), name, prio: c.action === "charge" ? 7 : 5, why: `shot ${i}: ${c.count} ${c.kind} ${c.action}`, ...(c.action === "march" ? { dur: Math.min(4.5, dur) } : {}) });
    }
  });
  return out;
}
