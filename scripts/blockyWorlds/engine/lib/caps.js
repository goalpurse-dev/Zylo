// Blocky Worlds CAPABILITIES (CAPABILITIES agent, 2026-11-06): the vocabulary, the schema and the pure maths of the
// target-video capabilities (the turtle target: rebuild-plan.json engineGaps). Pure, Node + browser; the page side is
// page/capsLayer.js (+ page/kit/tether.js, page/kit/siege.js, page/kit/backTown.js, page/kit/fxCaps.js,
// page/cameraMoves.js). Everything is a function of (shot time, seed): any frame renders the same alone (chunks).
//
// Timeline fields (CONTRACT.md addendum "Capabilities"), all optional, all on a shot unless said:
//   move: "tilt_up" | "orbit" | "flyover" | "fpv" | "top_down" | "low_hero"     or { type, deg?, from?, to?, height? }
//         the camera move on the shot's focus (a giant, the world, a crowd, a person)
//   tethers: [{ from: ANCHOR, to: ANCHOR, kind: chain|rope|cable|bridge, state: taut|slack|swing|snap|fire,
//               at?: 0-1 (snap moment / fire start), until?: 0-1 (fire: the hook lands), thick?: m, sag?: 0-1, hook? }]
//   siege:   [{ kind: cannon|ballista|catapult, at: ANCHOR, place?: ground|wall|back|army, aim: ANCHOR, fireAt?: 0-1,
//               flight?: s, payload?: ball|bolt|hook|rock, chain?: true (a hook trailing a chain), count?: 1-12, scale? }]
//   fx:      [{ kind: sound_rings|shield_dome|leaf_burst|debris|dust|sparks, at: ANCHOR, to?: ANCHOR, t0?, t1?, size? }]
//   acts:    [{ kind: eat_tree|nuzzle|headbutt, giant: id, to?: id|ANCHOR, at?: 0-1 }]
//   grade:   "flashback"                      the memory look (washed sepia, soft vignette)
//   tilt:    { deg: 4-30, slide?: true, at?: 0-1 }   the world tips (camera roll ramps in; crowds slide downhill)
// Timeline level:
//   giants[id].backTown / worlds[id].backTown: { style: village|town|city|castle, landmarks?: [school|grocery|hospital|
//     bakery|townhall|tower...], lit?, seed?, density?: 0.3-1.5, walls? }  a town or a lit castle-city on ANY creature
//   ANCHOR: "giant:<id>.<part>" | "world.<part>" (part: head|jaw|neck|body|back|tail|leg0-leg7|front|rear|left|right)
//           | "actor:<id>" | "crowd:<i>" | "siege:<i>" | "spot:<name>" | [x, y, z]   (+ an offset: { at, off: [x,y,z] })

export const MOVES = Object.freeze(["tilt_up", "orbit", "flyover", "fpv", "top_down", "low_hero"]);
export const TETHER_KINDS = Object.freeze(["chain", "rope", "cable", "bridge"]);
export const TETHER_STATES = Object.freeze(["taut", "slack", "swing", "snap", "fire"]);
export const SIEGE_KINDS = Object.freeze(["cannon", "ballista", "catapult"]);
export const SIEGE_PLACES = Object.freeze(["ground", "wall", "back", "army"]);
export const PAYLOADS = Object.freeze(["ball", "bolt", "hook", "rock"]);
export const FX_KINDS = Object.freeze(["sound_rings", "shield_dome", "leaf_burst", "debris", "dust", "sparks"]);
export const ACT_KINDS = Object.freeze(["eat_tree", "nuzzle", "headbutt"]);
export const GRADES = Object.freeze(["flashback"]);
export const TOWN_STYLES = Object.freeze(["village", "town", "city", "castle"]);
export const LANDMARKS = Object.freeze(["school", "grocery", "hospital", "bakery", "townhall", "library", "firehouse", "tower", "castle"]);
export const ANCHOR_PARTS = Object.freeze(["head", "jaw", "neck", "body", "back", "tail", "front", "rear", "left", "right", "leg0", "leg1", "leg2", "leg3", "leg4", "leg5", "leg6", "leg7"]);
export const CAPS_SFX = Object.freeze({ snap: "chain_snap", fire: "cannon_fire", impact: "impact_boom", horn: "horn_blast", hook: "hook_clank", chomp: "big_chomp" });

/** does a shot use any capability field? (the engine loads the EPIC layer for it) */
export const usesCaps = (s) => !!(s && (s.move || s.tethers?.length || s.siege?.length || s.fx?.length || s.acts?.length || s.grade || s.tilt));
export const usesCapsTimeline = (tl) => (tl?.shots ?? []).some(usesCaps) || Object.values(tl?.giants ?? {}).some((g) => g?.backTown) || Object.values(tl?.worlds ?? {}).some((w) => w?.backTown);

// ------------------------------------------------------------------------------------------------ deterministic maths
export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
export function hash01(n) { let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b) >>> 0; x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35) >>> 0; x ^= x >>> 16; return x / 4294967296; }

/** an anchor string -> { type, id, part } (null when it is a position) */
export function parseAnchor(a) {
  if (a && typeof a === "object" && !Array.isArray(a) && a.at != null) return { ...parseAnchor(a.at), off: Array.isArray(a.off) ? a.off : null };
  if (Array.isArray(a)) return a.length === 3 && a.every(Number.isFinite) ? { type: "pos", pos: a } : null;
  const s = String(a ?? "");
  let m = s.match(/^giant:([\w-]+)(?:\.(\w+))?$/); if (m) return { type: "giant", id: m[1], part: m[2] ?? "body" };
  m = s.match(/^world(?:\.(\w+))?$/); if (m) return { type: "giant", id: "world", part: m[1] ?? "body" };
  m = s.match(/^(actor|crowd|siege|spot):([\w-]+)$/); if (m) return { type: m[1], id: m[1] === "crowd" || m[1] === "siege" ? Number(m[2]) : m[2] };
  return null;
}

/**
 * tetherState(state, u, opts) -> { sag, swing, tension, broken, breakK, reach, jolt }
 *   u: shot fraction 0-1. sag: 0 (straight) .. 1 (a deep hang) as a fraction of the span; swing: lateral sway (fraction
 *   of span); tension: 0-1 vibration amount; broken: past the snap; breakK: 0-1 time since the snap (for the recoil);
 *   reach: 0-1 how far the line has paid out (fire); jolt: 0-1 the catch / snap kick (camera shake + SFX at its start)
 */
export function tetherState(state, u, { at = 0.55, until = null, sag = null, seed = 1, dur = 2 } = {}) {
  u = clamp01(u);
  const base = { sag: sag ?? 0.04, swing: 0, tension: 0, broken: false, breakK: 0, reach: 1, jolt: 0 };
  switch (state) {
    case "slack": return { ...base, sag: sag ?? 0.16, swing: 0.01 * Math.sin(u * dur * 2.1 + seed) };
    case "swing": return { ...base, sag: sag ?? 0.12, swing: 0.09 * Math.sin(u * dur * 2.6 + seed) * (0.6 + 0.4 * Math.cos(u * dur * 0.7)) };
    case "fire": {
      const t0 = at ?? 0.1, t1 = until ?? Math.min(0.95, t0 + 0.45);
      const reach = smooth((u - t0) / Math.max(1e-3, t1 - t0)), landed = u >= t1;
      const after = landed ? (u - t1) * dur : 0;
      // flying: the line trails low behind the hook; landed: a jolt, then it pulls taut
      return { ...base, reach: u < t0 ? 0 : reach, sag: landed ? (sag ?? 0.04) + 0.1 * Math.exp(-after * 3) : 0.1 + 0.12 * reach, jolt: landed ? Math.exp(-after * 6) : 0, tension: landed ? 0.4 * Math.exp(-after * 3) : 0 };
    }
    case "snap": {
      const k = u < at ? u / Math.max(1e-3, at) : 1;
      if (u < at) return { ...base, sag: (sag ?? 0.035) * (1 - 0.7 * k), tension: k * k, jolt: 0 };
      const bt = (u - at) * dur; // seconds since the snap
      return { ...base, broken: true, breakK: clamp01(bt / 1.2), sag: 0, tension: 0, jolt: Math.exp(-bt * 5), bt };
    }
    default: return { ...base, sag: sag ?? 0.035, tension: 0.15 };
  }
}

/** a point on the line at s (0 at the start, 1 at the end): straight lerp minus the parabolic sag, plus a lateral swing */
export function tetherPoint(a, b, s, st, lat = [1, 0, 0]) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const drop = st.sag * L * 4 * s * (1 - s), sw = st.swing * L * Math.sin(Math.PI * s);
  return [a[0] + (b[0] - a[0]) * s + lat[0] * sw, a[1] + (b[1] - a[1]) * s - drop, a[2] + (b[2] - a[2]) * s + lat[2] * sw];
}

/**
 * snapHalf(anchor, breakPt, s, k, L): a broken half hangs from its anchor and whips down: the free end swings from
 * the break point toward straight down under the anchor (k 0..1 eased with a bounce). s: 0 at the anchor, 1 at the end.
 */
export function snapHalf(anchor, brk, s, k, len) {
  const e = 1 - Math.exp(-k * 4.5) * Math.cos(k * 9); // whip with an overshoot
  const hang = [anchor[0], anchor[1] - len, anchor[2]];
  const end = [brk[0] + (hang[0] - brk[0]) * e, brk[1] + (hang[1] - brk[1]) * e, brk[2] + (hang[2] - brk[2]) * e];
  const mid = 0.25 * (1 - e) * len;
  return [anchor[0] + (end[0] - anchor[0]) * s, anchor[1] + (end[1] - anchor[1]) * s - mid * 4 * s * (1 - s), anchor[2] + (end[2] - anchor[2]) * s];
}

/** flying links / debris: piece i of n bursting from a point at time bt (s) after the burst; gravity 9.8 * g */
export function burstPiece(i, n, bt, { seed = 1, speed = 12, up = 0.6, g = 1, spin = 6, size = 1 } = {}) {
  const r = (k) => hash01(seed * 7919 + i * 131 + k * 31);
  const th = r(1) * Math.PI * 2, ph = (r(2) * 0.9 + 0.1) * up * Math.PI / 2;
  const v = speed * (0.5 + r(3) * 0.8) * size;
  const vx = Math.cos(th) * Math.cos(ph) * v, vy = Math.sin(ph) * v + speed * 0.3 * size, vz = Math.sin(th) * Math.cos(ph) * v;
  const t = Math.max(0, bt);
  return { x: vx * t, y: vy * t - 0.5 * 9.8 * g * size * t * t, z: vz * t, rx: r(4) * spin * t, ry: r(5) * spin * t, s: 1 - clamp01((t - 1.4) / 0.6) };
}

/**
 * siegeTiming(spec, dur) -> { fireAt, flight, impactAt } in shot seconds. The flight time scales with the distance
 * (dist m) when not given; the impact always lands inside the shot when it can.
 */
export function siegeTiming({ fireAt = 0.2, flight = null } = {}, dur = 2, dist = 60) {
  const f0 = clamp01(fireAt) * dur;
  const fl = flight ?? Math.min(Math.max(0.35, dist / 90), Math.max(0.35, dur - f0 - 0.25));
  return { fireAt: f0, flight: fl, impactAt: f0 + fl };
}

/** the projectile on its arc at time t (s): null before the shot, the hit point after the impact */
export function ballistic(from, to, t, { fireAt, flight }, apex = null) {
  if (t < fireAt) return null;
  const u = clamp01((t - fireAt) / flight);
  const d = Math.hypot(to[0] - from[0], to[2] - from[2]);
  const h = apex ?? Math.max(4, d * 0.18);
  const y = from[1] + (to[1] - from[1]) * u + h * 4 * u * (1 - u);
  return { pos: [from[0] + (to[0] - from[0]) * u, y, from[2] + (to[2] - from[2]) * u], u, landed: u >= 1, vy: (to[1] - from[1]) + h * 4 * (1 - 2 * u) };
}

/** camera-move parameters for a shot (deterministic per seed) */
export function moveSpec(move, seed = 1) {
  const m = typeof move === "string" ? { type: move } : { ...(move ?? {}) };
  const dir = hash01(seed * 53 + 7) < 0.5 ? -1 : 1;
  return { type: m.type, deg: m.deg ?? (m.type === "orbit" ? 70 * dir : 0), from: m.from ?? 0.02, to: m.to ?? 1.0, height: m.height ?? null, dir };
}

// ------------------------------------------------------------------------------------------------ schema
const isObj = (x) => x && typeof x === "object" && !Array.isArray(x);
const anchorOk = (a) => !!parseAnchor(a);
const frac = (x) => x == null || (Number.isFinite(x) && x >= 0 && x <= 1);

/** problems of one shot's capability fields (strings; empty = fine) */
export function validateCapsShot(s, tl = {}, i = 0) {
  const bad = [], at = `shot ${i}`;
  const giantOk = (a) => { const p = parseAnchor(a); if (!p) return false; if (p.type === "giant" && p.id !== "world" && !isObj(tl.giants?.[p.id])) return false; if (p.type === "giant" && p.id === "world" && !/^creature:/.test(s.set ?? "")) return false; return true; };
  if (s.move != null) { const m = typeof s.move === "string" ? s.move : s.move?.type; if (!MOVES.includes(m)) bad.push(`${at}: unknown move "${m}" (${MOVES.join(", ")})`); }
  for (const [k, x] of (s.tethers ?? []).entries()) {
    if (!isObj(x)) { bad.push(`${at}: tethers[${k}] is not an object`); continue; }
    if (!anchorOk(x.from) || !giantOk(x.from)) bad.push(`${at}: tethers[${k}] bad anchor from ${JSON.stringify(x.from)}`);
    if (!anchorOk(x.to) || !giantOk(x.to)) bad.push(`${at}: tethers[${k}] bad anchor to ${JSON.stringify(x.to)}`);
    if (x.kind != null && !TETHER_KINDS.includes(x.kind)) bad.push(`${at}: tethers[${k}] kind "${x.kind}" (${TETHER_KINDS.join(", ")})`);
    if (x.state != null && !TETHER_STATES.includes(x.state)) bad.push(`${at}: tethers[${k}] state "${x.state}" (${TETHER_STATES.join(", ")})`);
    if (!frac(x.at) || !frac(x.until)) bad.push(`${at}: tethers[${k}] at / until must be 0-1`);
  }
  for (const [k, x] of (s.siege ?? []).entries()) {
    if (!isObj(x)) { bad.push(`${at}: siege[${k}] is not an object`); continue; }
    if (!SIEGE_KINDS.includes(x.kind)) bad.push(`${at}: siege[${k}] kind "${x.kind}" (${SIEGE_KINDS.join(", ")})`);
    if (!anchorOk(x.at) || !giantOk(x.at)) bad.push(`${at}: siege[${k}] bad anchor at ${JSON.stringify(x.at)}`);
    if (x.aim != null && (!anchorOk(x.aim) || !giantOk(x.aim))) bad.push(`${at}: siege[${k}] bad aim ${JSON.stringify(x.aim)}`);
    if (x.place != null && !SIEGE_PLACES.includes(x.place)) bad.push(`${at}: siege[${k}] place "${x.place}" (${SIEGE_PLACES.join(", ")})`);
    if (x.payload != null && !PAYLOADS.includes(x.payload)) bad.push(`${at}: siege[${k}] payload "${x.payload}" (${PAYLOADS.join(", ")})`);
    if (!frac(x.fireAt)) bad.push(`${at}: siege[${k}] fireAt must be 0-1`);
    if (x.count != null && !(Number.isInteger(x.count) && x.count >= 1 && x.count <= 12)) bad.push(`${at}: siege[${k}] count 1-12`);
  }
  for (const [k, x] of (s.fx ?? []).entries()) {
    if (!isObj(x) || !FX_KINDS.includes(x.kind)) { bad.push(`${at}: fx[${k}] kind "${x?.kind}" (${FX_KINDS.join(", ")})`); continue; }
    if (!anchorOk(x.at) || !giantOk(x.at)) bad.push(`${at}: fx[${k}] bad anchor at ${JSON.stringify(x.at)}`);
    if (x.to != null && (!anchorOk(x.to) || !giantOk(x.to))) bad.push(`${at}: fx[${k}] bad anchor to ${JSON.stringify(x.to)}`);
  }
  for (const [k, x] of (s.acts ?? []).entries()) {
    if (!isObj(x) || !ACT_KINDS.includes(x.kind)) { bad.push(`${at}: acts[${k}] kind "${x?.kind}" (${ACT_KINDS.join(", ")})`); continue; }
    if (x.giant !== "world" && !isObj(tl.giants?.[x.giant])) bad.push(`${at}: acts[${k}] giant "${x.giant}" is not in timeline.giants`);
    if (x.kind !== "eat_tree" && x.to == null) bad.push(`${at}: acts[${k}] ${x.kind} needs "to" (the other giant)`);
  }
  if (s.grade != null && !GRADES.includes(s.grade)) bad.push(`${at}: grade "${s.grade}" (${GRADES.join(", ")})`);
  if (s.tilt != null && !(isObj(s.tilt) && Number.isFinite(s.tilt.deg) && Math.abs(s.tilt.deg) <= 40)) bad.push(`${at}: tilt needs { deg: -40..40 }`);
  return bad;
}

export function validateCaps(tl) {
  const bad = [];
  for (const [id, g] of Object.entries(tl.giants ?? {})) if (g?.backTown) bad.push(...backTownProblems(g.backTown, `giant "${id}"`));
  for (const [id, w] of Object.entries(tl.worlds ?? {})) if (w?.backTown) bad.push(...backTownProblems(w.backTown, `world "${id}"`));
  (tl.shots ?? []).forEach((s, i) => bad.push(...validateCapsShot(s, tl, i)));
  return bad;
}
function backTownProblems(b, who) {
  if (b === true) return [];
  if (!isObj(b)) return [`${who}: backTown must be true or an object`];
  const bad = [];
  if (b.style != null && !TOWN_STYLES.includes(b.style)) bad.push(`${who}: backTown style "${b.style}" (${TOWN_STYLES.join(", ")})`);
  for (const l of b.landmarks ?? []) if (!LANDMARKS.includes(l)) bad.push(`${who}: backTown landmark "${l}" (${LANDMARKS.join(", ")})`);
  return bad;
}

/** the SFX cues a shot's capabilities ask for: [{ at: seconds into the shot, cue }] (lib/sfx.js may map them) */
export function capsSfxCues(s) {
  const dur = (s.end ?? 1) - (s.start ?? 0), out = [];
  for (const x of s.tethers ?? []) {
    if (x.state === "snap") out.push({ at: (x.at ?? 0.55) * dur, cue: CAPS_SFX.snap });
    if (x.state === "fire") out.push({ at: (x.until ?? Math.min(0.95, (x.at ?? 0.1) + 0.45)) * dur, cue: CAPS_SFX.hook });
  }
  for (const x of s.siege ?? []) { const tm = siegeTiming(x, dur); out.push({ at: tm.fireAt, cue: CAPS_SFX.fire }); if (tm.impactAt < dur) out.push({ at: tm.impactAt, cue: CAPS_SFX.impact }); }
  for (const x of s.fx ?? []) if (x.kind === "sound_rings") out.push({ at: (x.t0 ?? 0.1) * dur, cue: CAPS_SFX.horn });
  for (const x of s.acts ?? []) if (x.kind === "eat_tree") out.push({ at: (x.at ?? 0.5) * dur, cue: CAPS_SFX.chomp });
  return out.sort((a, b) => a.at - b.at);
}

// ------------------------------------------------------------------------------------------------ the old gap kinds
// The turtle target's "can't express" notes (rebuild-plan.json engineGaps) and the director's gap details -> the
// capability that now meets them (lib/capabilities.js ids) and the timeline field that asks for it.
export const GAP_TO_CAPABILITY = Object.freeze([
  [/tilt.?up/i, "camera.move", "move:tilt_up"],
  [/orbit/i, "camera.move", "move:orbit"],
  [/fly.?through|first.?person|fpv/i, "camera.move", "move:fpv"],
  [/fly.?over/i, "camera.move", "move:flyover"],
  [/top.?down/i, "camera.move", "move:top_down"],
  [/bridge between/i, "tether", "tethers:bridge"],
  [/chain|rope|hook|tether|tie|tied|leash|cable/i, "tether", "tethers"],
  [/cannon|ballista|catapult|siege|fire[sd]? (?:at|a)|projectile|harpoon/i, "siege", "siege"],
  [/city on|town on|on the \w+'s back|skyscraper|castle city|back.?town/i, "world.backtown", "backTown"],
  [/eats? a tree|eat.*tree/i, "giant.act", "acts:eat_tree"],
  [/touching|nuzzle|forehead|headbutt/i, "giant.act", "acts:nuzzle"],
  [/shield|dome/i, "fx.caps", "fx:shield_dome"],
  [/sound.?wave|sound rings|horn/i, "fx.caps", "fx:sound_rings"],
  [/flashback|memory|earlier/i, "grade.flashback", "grade:flashback"],
  [/tilted|tips|slide down|people slide/i, "world.tilt", "tilt"],
  [/preset missing: (bird|deer|owl|eagle|moose|stag)/i, "giant", "giants.kind"],
]);
/** an old gap text -> { capability, field } (null when no new capability covers it) */
export function capabilityForGap(text) {
  for (const [re, capability, field] of GAP_TO_CAPABILITY) if (re.test(String(text ?? ""))) return { capability, field };
  return null;
}

// ------------------------------------------------------------------------------------------------ planner vocabulary
// The words of a line -> the capability fields a planner may add to its shot (plan.mjs / the director read this; pure).
//   suggestCaps(text, { giants: [ids], focus, set, hasCrowd }) -> { move?, tethers?, siege?, fx?, acts?, grade?, tilt? }
export const CAPS_WORDS = Object.freeze({
  tilt_up: /\b(towered|towers? over|rose up|stood up|looked up|up to (?:his|her|its|the) (?:head|top|towers?|city)|from (?:his|her|its) (?:feet|paws|legs)|taller than)\b/i,
  orbit: /\b(around (?:it|him|her|the)|circled|all sides|every (?:town|world)|in this world)\b/i,
  fpv: /\b(flew (?:down|through|over)|fly(?:ing)? through|zoomed (?:down|through)|raced down the street)\b/i,
  flyover: /\b(flew over|from above|below us|high above|the whole (?:town|city))\b/i,
  top_down: /\b(asleep|in (?:my|his|her) bed|lay|lying|fell (?:down|flat)|knocked (?:down|flat))\b/i,
  low_hero: /\b(stood (?:tall|alone|up to)|faced (?:him|her|it)|brave|hero)\b/i,
  snap: /\b(snapped|snap|broke (?:the|its|his|her)? ?(?:chain|rope|line)s?|chains? (?:broke|burst)|ropes? (?:broke|burst))\b/i,
  chain: /\b(chains?|chained|ropes?|roped|hooks?|hooked|tied|tethered|leash|shackled|cables?)\b/i,
  fired_line: /\b(threw (?:their|the) ropes?|fired (?:the |their )?hooks?|harpoons?|grappl)/i,
  cannon: /\b(cannons?|fired|fire!|blasted|shot at|boom)\b/i,
  ballista: /\b(ballistae?|ballistas|giant crossbows?|harpoon guns?)\b/i,
  catapult: /\b(catapults?|trebuchets?|hurled (?:rocks|boulders))\b/i,
  horn: /\b(horn|trumpet|whistle|blew (?:the|a|my) (?:horn|trumpet|whistle)|shouted|roared at)\b/i,
  shield: /\b(shield|dome|force field|barrier)\b/i,
  eat_tree: /\b(eats? (?:whole )?trees|ate (?:a |the |whole )?trees?|munch(?:ed|es)? (?:on )?(?:a |the )?trees?|chewed (?:a |the )?trees?)\b/i,
  nuzzle: /\b(nuzzled|pressed (?:his|her|its) (?:head|forehead|nose)|rubbed (?:his|her|its) head|hugged|cuddled)\b/i,
  headbutt: /\b(headbutt(?:ed)?|rammed|butted)\b/i,
  flashback: /\b(long ago|years ago|when (?:he|she|it|i|we) (?:was|were) (?:young|little|a pup|a baby|small)|remember(?:ed)?|back then|once,? long)\b/i,
  tilt: /\b(tipped|tilted|leaned|slid|slipped|sliding|rolled (?:down|over)|lurched)\b/i,
  bridge: /\b(bridge|ladder between|walked across to)\b/i,
});

export function suggestCaps(text, { giants = [], focus = null, set = "", hasCrowd = false } = {}) {
  const s = String(text ?? ""), W = CAPS_WORDS, out = {};
  const villain = giants.find((g) => g !== "world") ?? null;
  const onCreature = /^creature:/.test(set);
  const host = onCreature ? "world" : giants[0] ?? null;
  const at = (id, part) => (id === "world" ? `world.${part}` : `giant:${id}.${part}`);
  // the move: the strongest word wins (a person's line keeps its own framing unless it names a top-down / hero beat)
  const order = ["fpv", "tilt_up", "top_down", "flyover", "orbit", "low_hero"];
  for (const m of order) if (W[m].test(s)) {
    if ((m === "top_down" || m === "low_hero") || (focus && !String(focus).startsWith("giant:") && focus !== "world" && focus !== "crowd")) { if (m === "top_down" || m === "low_hero") { out.move = m; break; } continue; }
    if (giants.length || onCreature) { out.move = m; break; }
  }
  // lines and weapons
  if (villain && (W.chain.test(s) || W.snap.test(s) || W.fired_line.test(s))) {
    const state = W.snap.test(s) ? "snap" : W.fired_line.test(s) ? "fire" : "taut";
    const from = hasCrowd && state === "fire" ? "crowd:0" : host && host !== villain ? at(host, "neck") : [0, 0, 0];
    out.tethers = [{ from, to: at(villain, "leg0"), kind: /rope/i.test(s) ? "rope" : "chain", state, ...(state === "snap" ? { at: 0.45 } : {}) }];
  }
  const weapon = W.ballista.test(s) ? "ballista" : W.catapult.test(s) ? "catapult" : W.cannon.test(s) && /cannon|fire|blast|shot|boom/i.test(s) && (villain || host) ? "cannon" : null;
  if (weapon && (villain || host)) {
    const tgt = villain ?? host;
    out.siege = [{ kind: weapon, at: hasCrowd ? "crowd:0" : host && host !== tgt ? at(host, "back") : "spot:near", ...(!hasCrowd && host && host !== tgt ? { place: "back" } : hasCrowd ? { place: "army" } : {}), aim: at(tgt, "body"), ...(W.fired_line.test(s) || /hook/i.test(s) ? { payload: "hook", chain: true } : {}), count: hasCrowd ? 3 : 1 }];
  }
  // effects, acts, looks
  const fx = [];
  if (W.horn.test(s) && /horn|trumpet|whistle/i.test(s)) fx.push({ kind: "sound_rings", at: focus && !/^(giant:|world|crowd)/.test(focus) ? `actor:${focus}` : "spot:center", ...(villain ? { to: at(villain, "head") } : {}), t0: 0.1 });
  if (W.shield.test(s) && host) fx.push({ kind: "shield_dome", at: at(host, "body"), t0: 0.05 });
  if (fx.length) out.fx = fx;
  const acts = [];
  if (W.eat_tree.test(s) && (host || villain)) acts.push({ kind: "eat_tree", giant: host ?? villain, at: 0.5 });
  if ((W.nuzzle.test(s) || W.headbutt.test(s)) && villain && host && host !== villain) acts.push({ kind: W.headbutt.test(s) ? "headbutt" : "nuzzle", giant: villain, to: host, ...(onCreature ? { part: "shell" } : {}) });
  if (acts.length) out.acts = acts;
  if (W.flashback.test(s)) out.grade = "flashback";
  if (W.tilt.test(s) && onCreature) out.tilt = { deg: 14, at: 0.15, slide: true };
  if (W.bridge.test(s) && host && villain && host !== villain) out.tethers = [...(out.tethers ?? []), { from: at(host, "back"), to: at(villain, "back"), kind: "bridge", state: "slack" }];
  return out;
}

// ------------------------------------------------------------------------------------------------ the planner pass
// REBUILD agent (2026-11-06): plan.mjs runs this after the coast pass on every directed (EPIC) timeline.
//   capsPass(tl, { check, openUntil }) -> { added, reverted, opening }
//   Per shot, suggestCaps(the words spoken during THAT shot, its giants / focus / set / crowds) and Object.assign the
//   fields the shot does not have yet. Gates: picture cards / signs get nothing; a shot starting inside the opening
//   window (openUntil s, lib/opening.js) only gets a camera move (the opening rules own those shots); a field that
//   fails validateCapsShot or makes check(tl) (checkTimeline) report more problems is undone.
export function capsPass(tl, { check = null, openUntil = 0 } = {}) {
  const res = { added: 0, reverted: 0, opening: 0 };
  const shots = tl?.shots ?? [], caps = tl?.captions ?? [];
  if (!shots.length) return res;
  const count = () => (check ? check(tl).length : 0);
  let base = count();
  const FIELDS = ["move", "tethers", "siege", "fx", "acts", "grade", "tilt"];
  shots.forEach((s, i) => {
    if (s.camera === "insert" || s.insert) return;
    const text = caps.filter((c) => c.start >= s.start - 1e-6 && c.start < s.end - 1e-6).map((c) => c.word).join(" ");
    if (!text.trim()) return;
    const ids = (s.giants ?? []).map((g) => g.id).filter((id) => id === "world" || tl.giants?.[id]);
    let sug = suggestCaps(text, { giants: ids, focus: s.focus ?? null, set: s.set ?? "", hasCrowd: !!s.crowds?.length });
    if (s.start < openUntil - 1e-6) { sug = sug.move ? { move: sug.move } : {}; if (sug.move) res.opening++; }
    const add = Object.fromEntries(FIELDS.filter((k) => sug[k] != null && s[k] == null).map((k) => [k, sug[k]]));
    if (!Object.keys(add).length) return;
    Object.assign(s, add);
    const bad = validateCapsShot(s, tl, i).length > 0;
    const now = bad ? Infinity : count();
    if (bad || now > base) { for (const k of Object.keys(add)) delete s[k]; res.reverted++; return; }
    base = now; res.added++;
  });
  return res;
}
