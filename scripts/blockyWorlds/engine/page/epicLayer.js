// Blocky Worlds EPIC (EPIC agent): the engine's EPIC layer. page/engine.js loads it only when a timeline uses EPIC
// fields (CONTRACT.md addendum "EPIC stories") and calls these hooks; everything EPIC lives here and in the kit:
//   page/kit/giants.js, page/kit/crowd.js, page/kit/town.js, page/sets/creatureWorld.js, page/cameraEpic.js, lib/epic.js
//
//   const E = await makeEpicLayer({ THREE, scene, tl, ctx })   ctx = the sets' build ctx { THREE, scene, renderer, gltf, tex }
//   E.buildSet(name)            "creature:<id>" -> a creature world set (tl.worlds[id]); E.buildCreatureWorld for worldspec.js
//   E.problems()                schema problems (lib/epic.js validateEpic)
//   E.ownsFocus(shot)           true when the camera / focus is an EPIC one (giant, crowd, world, EPIC camera type)
//   E.place(shot, lt, S)        shows + places + animates this shot's giants and crowds (before the camera)
//   E.frame(shot, lt, S, where, camera, frameShot)  frames the camera for EPIC shots (returns true when it did)
//   E.after(shot, lt, S, camera) the beat's camera shake, crowd poses (they need the camera for LOD), giant LOD
//   E.posOf(id)                 a giant's current position (people can face it: facing "<giant id>")
import { makeGiant, animateGiant, updateGiantLOD } from "/page/kit/giants.js";
import { makeCrowd, updateCrowd, crowdExtent } from "/page/kit/crowd.js";
import { buildCreatureWorld } from "/page/sets/creatureWorld.js";
import { frameEpic, applyShake, EPIC_CAMERA_TYPES } from "/page/cameraEpic.js";
import { validateEpic, beatPlan, beatProgress, CROWD_MOTION, EPIC_SPOTS } from "/lib/epic.js";
// 2026-11-06 (CAPABILITIES): tethers, siege, back towns, camera moves, fx, acts, grade, tilt (page/capsLayer.js)
import { makeCapsLayer } from "/page/capsLayer.js";
import { usesCaps, usesCapsTimeline } from "/lib/caps.js";

/** does this timeline use EPIC fields? (the engine loads the layer only then) */
export const usesEpic = (tl) => !!(tl.giants || tl.worlds || (tl.shots ?? []).some((s) => s.giants?.length || s.crowds?.length || s.world || s.beat || /^creature:/.test(s.set ?? "") || EPIC_CAMERA_TYPES.includes(s.camera) || usesCaps(s)) || usesCapsTimeline(tl));
export { EPIC_CAMERA_TYPES, EPIC_SPOTS };

const MAP_STD = { wide: "establish", insert: "establish", low: "giant_close", medium: "giant_close", closeup: "giant_close", over_shoulder: "hero_low" };

/**
 * WORLD-FIX 2026-11-07: keep the camera out of (and off) a giant's geometry. 14 rays from the lens: an odd number of
 * crossings straight up = inside; any hit nearer than minD = touching. The camera steps away from the near hits (or back
 * from its aim when inside), still aimed where it was, up to 10 steps. -> the number of steps taken
 */
export function clearGeometry(THREE, camera, obj, minD = 2, { parity = true } = {}) {
  const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1], [1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1], [-1, 1, 1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1]].map((d) => new THREE.Vector3(...d).normalize());
  const ok = (h) => h.object.isMesh && h.object.visible !== false && h.object.material?.visible !== false;
  const box = new THREE.Box3().setFromObject(obj); if (box.isEmpty()) return 0;
  const aim = camera.userData.epicAim?.clone() ?? camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(20).add(camera.position);
  const rc = new THREE.Raycaster(); let steps = 0;
  for (; steps < 10; steps++) {
    const p = camera.position;
    if (!box.clone().expandByScalar(minD).containsPoint(p)) break;
    rc.set(p, DIRS[2]); rc.far = Infinity;
    const inside = parity && rc.intersectObject(obj, true).filter(ok).length % 2 === 1;
    rc.far = minD;
    const push = new THREE.Vector3(); let near = Infinity;
    for (const d of DIRS) { rc.set(p, d); const h = rc.intersectObject(obj, true).find(ok); if (h) { near = Math.min(near, h.distance); push.addScaledVector(d, -(minD - h.distance + 0.2)); } }
    if (!inside && near >= minD) break;
    if (inside || push.lengthSq() < 1e-6) { const back = p.clone().sub(aim); if (back.lengthSq() < 1e-6) back.set(0, 1, 0); push.copy(back.normalize().multiplyScalar(Math.max(minD, (box.max.y - box.min.y) * 0.12))); }
    p.add(push); camera.lookAt(aim); camera.updateMatrixWorld();
  }
  return steps;
}

export async function makeEpicLayer({ THREE, scene, tl, ctx }) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  // giants: one each (tl.giants: { id: { kind, size, params?, armour?, town? } })
  const GIANTS = {};
  const caps = makeCapsLayer({ THREE, scene, tl, ctx });
  for (const [id, spec] of Object.entries(tl.giants ?? {})) {
    const g = makeGiant({ ...spec, id, tex: ctx.tex });
    caps.decorateGiant(g, spec); // a town / castle-city on its back when asked
    g.visible = false; scene.add(g); GIANTS[id] = g;
  }
  // crowds: built once per (kind, count, formation, faction, seed), reused by every shot that asks for the same crowd
  const CROWDS = new Map();
  const crowdKey = (c) => `${c.kind}|${c.count}|${c.formation ?? ""}|${c.faction ?? ""}|${c.seed ?? 3}`;
  const usedCrowds = new Map(); // key -> how many a single shot needs at once
  for (const s of tl.shots) { const n = new Map(); for (const c of s.crowds ?? []) { const k = crowdKey(c); n.set(k, (n.get(k) ?? 0) + 1); } for (const [k, v] of n) usedCrowds.set(k, Math.max(usedCrowds.get(k) ?? 0, v)); }
  for (const s of tl.shots) for (const c of s.crowds ?? []) {
    const k = crowdKey(c); if (CROWDS.has(k)) continue;
    const list = []; for (let i = 0; i < usedCrowds.get(k); i++) { const g = makeCrowd({ ...c, seed: (c.seed ?? 3) + i * 7 }); g.visible = false; scene.add(g); list.push(g); }
    CROWDS.set(k, list);
  }
  const allGiants = Object.values(GIANTS), allCrowds = [...CROWDS.values()].flat();
  const live = { giants: new Map(), crowds: [], beat: null, shotKey: null };

  /** a spot of the set by name (EPIC spots fall back to computed places for ordinary sets) */
  function spotOf(S, name, size = 30) {
    if (S.spots[name]?.isVector3) return S.spots[name].clone();
    const far = S.spots.far.clone(), lat = S.lateral ?? V(1, 0, 0), dep = S.depth ?? V(0, 0, -1);
    switch (name) {
      case "near": return S.spots.center.clone().addScaledVector(dep, -3);
      case "giant_left": return far.clone().addScaledVector(lat, -size * 0.7).addScaledVector(dep, size * 0.3);
      case "giant_right": return far.clone().addScaledVector(lat, size * 0.7).addScaledVector(dep, size * 0.3);
      case "horizon": return far.clone().addScaledVector(dep, 400);
      case "shell": case "head": case "tail": return S.spots.center.clone();
      default: return S.spots.center.clone();
    }
  }
  const yawFacing = (S, from, facing, camPos = null) => {
    const camDir = S.camDir ?? V(0, 0, 1);
    if (facing === "away") return Math.atan2(-camDir.x, -camDir.z);
    if (facing === "left") return Math.atan2(-camDir.z, camDir.x);
    if (facing === "right") return Math.atan2(camDir.z, -camDir.x);
    const tgt = GIANTS[facing] ? live.giants.get(facing)?.pos ?? GIANTS[facing].position : facing && S.spots[facing] ? S.spots[facing] : null;
    if (tgt) return Math.atan2(tgt.x - from.x, tgt.z - from.z);
    if (camPos) return Math.atan2(camPos.x - from.x, camPos.z - from.z);
    return Math.atan2(camDir.x, camDir.z);
  };

  function place(shot, lt, S) {
    const dur = shot.end - shot.start;
    for (const g of allGiants) g.visible = false;
    for (const c of allCrowds) c.visible = false;
    live.giants.clear(); live.crowds = [];
    const plan = shot.beat ? beatPlan(shot.beat.type, dur, shot.beat) : null; live.beat = plan;
    const u = lt / Math.max(1e-3, dur);
    const mount = S.mount ?? scene;
    // the world's own giant (outside / on views): shot.giants entry with id "world" sets its action
    const wEntry = (shot.giants ?? []).find((g) => g.id === "world");
    if (S.giant && wEntry) animateGiant(S.giant, wEntry.action ?? "idle", lt, { dur, hitAt: plan?.shake?.at ?? 0.6, at: plan?.shake?.at, landAt: plan?.shake?.at ?? 1.0 });
    // giants
    for (const e of shot.giants ?? []) {
      if (e.id === "world") continue;
      const g = GIANTS[e.id]; if (!g) continue;
      const role = plan?.roles?.[e.role] ?? null;
      const action = e.action ?? role?.action ?? "idle";
      let pos = e.pos ? V(...e.pos) : spotOf(S, e.spot ?? "far", g.userData.size);
      if (!e.pos && !["center", "near", "left", "right"].includes(e.spot ?? "far")) pos.addScaledVector(S.depth ?? V(0, 0, -1), g.userData.length * 0.25);
      pos.y = e.pos ? pos.y : (S.groundY ?? 0) + (e.y ?? 0);
      // moves: a beat role's move or the entry's own { to, t0, t1 }
      const mv = e.move ?? role?.move;
      if (mv && mv.to) {
        let to = null;
        if (mv.to === "toward_target") { const tgt = (shot.giants ?? []).find((x) => x.role === "target"); const tp = tgt ? (tgt.id === "world" ? S.giant?.position : live.giants.get(tgt.id)?.pos ?? spotOf(S, tgt.spot ?? "far")) : null; if (tp) to = pos.clone().lerp(V(tp.x, pos.y, tp.z), mv.dist ?? 0.25); }
        else if (mv.to !== "here" && mv.to !== "forward") to = spotOf(S, mv.to, g.userData.size);
        if (to) { to.y = pos.y; pos.lerp(to, beatProgress(mv, u)); }
      }
      // walking giants advance along their heading (gait speed), so feet do not slide
      const yaw = e.facing != null ? yawFacing(S, pos, e.facing) : yawFacing(S, pos, "camera");
      if ((action === "walk" || action === "run") && !mv) { const sp = g.userData.gait.speed * (action === "run" ? 2 : 1) * (e.speed ?? 1); pos.x += Math.sin(yaw) * sp * lt; pos.z += Math.cos(yaw) * sp * lt; }
      g.position.copy(pos); g.rotation.set(0, yaw, 0);
      const gm = S.giantMount ?? mount; if (g.parent !== gm) gm.add(g); // ATTACH: other giants stand on the land, not on the creature's carrier
      animateGiant(g, action, lt, { dur, hitAt: plan?.shake?.at ?? 0.6, at: role?.at != null ? role.at * dur : plan?.shake?.at, landAt: plan?.shake?.at ?? 1.0 });
      g.visible = true;
      live.giants.set(e.id, { g, pos: pos.clone(), action, yaw });
    }
    // crowds
    const used = new Map();
    for (const c of shot.crowds ?? []) {
      const k = crowdKey(c), n = used.get(k) ?? 0; used.set(k, n + 1);
      const grp = CROWDS.get(k)[n];
      const role = plan?.roles?.[c.role] ?? null;
      const action = c.action ?? role?.action ?? "stand";
      const origin = c.pos ? V(...c.pos) : spotOf(S, c.spot ?? "back");
      if (!c.pos && c.onGround) origin.y = S.groundY ?? 0;
      // a crowd at a spot stands BEHIND it (its front rank at the spot), never around the camera or the actors
      if (!c.pos && (c.spot ?? "back") !== "center") origin.addScaledVector(S.depth ?? V(0, 0, -1), crowdExtent(grp) * 0.85);
      const yaw = yawFacing(S, origin, c.facing ?? "camera");
      const cm = c.onGround && !c.onWorld ? S.giantMount ?? mount : mount; if (grp.parent !== cm) cm.add(grp); // ATTACH: an army on the land below stays on the land
      grp.visible = true;
      live.crowds.push({ grp, c, action, origin, yaw, speed: c.speed });
    }
    caps.place(shot, lt, S, live); // giant acts (nuzzle / headbutt / eat a tree), back-town lights
    return live;
  }

  /** the EPIC camera for a shot: returns true when it framed the camera */
  function frame(shot, lt, S, where, camera, actorH = {}) {
    const dur = shot.end - shot.start, seed = shot.seed ?? 1;
    let type = EPIC_CAMERA_TYPES.includes(shot.camera) ? shot.camera : null;
    const f = String(shot.focus ?? "");
    const fg = f.startsWith("giant:") ? f.slice(6) : null, fc = f === "crowd" || f.startsWith("crowd:"), fw = f === "world";
    if (!type && !(fg || fc || fw) && !shot.move) return false;
    if (!type) type = MAP_STD[shot.camera] ?? "establish";
    const firstGiant = [...live.giants.values()][0];
    const worldG = S.giant && S.giant.visible !== false ? { g: S.giant, pos: S.giant.position.clone() } : null;
    const giantInfo = (id) => (id === "world" ? worldG : live.giants.get(id)) ?? null;
    const gInfo = fg ? giantInfo(fg) : null;
    const anyGiant = gInfo ?? firstGiant ?? worldG;
    const ctxE = { THREE, camera, t: lt, dur, seed, side: S.camDir };
    const crowdAt = (i = 0) => {
      const L = live.crowds[i]; if (!L) return null;
      const M = CROWD_MOTION[L.action] ?? CROWD_MOTION.stand, sp = (L.speed ?? M.speed) * (L.action === "flee" ? -1 : 1);
      const d = sp * Math.max(0, lt - 0.2);
      return { pos: L.origin.clone().add(V(Math.sin(L.yaw) * d, 0, Math.cos(L.yaw) * d)), vel: V(Math.sin(L.yaw) * sp, 0, Math.cos(L.yaw) * sp), ext: crowdExtent(L.grp) };
    };
    if (fg && gInfo) { ctxE.focus = gInfo.pos.clone(); ctxE.focusHeight = gInfo.g.userData.height; ctxE.span = Math.max(gInfo.g.userData.length, gInfo.g.userData.width, gInfo.g.userData.height); }
    else if (fc) { const ci = f.startsWith("crowd:") ? Number(f.slice(6)) || 0 : 0; const ca = crowdAt(ci); ctxE.focus = ca?.pos ?? S.spots.center.clone(); ctxE.focusHeight = 2; ctxE.span = Math.max((ca?.ext ?? 10) * 1.6, type === "aerial" ? 44 : 8); ctxE.velocity = ca?.vel; }
    else if (fw && tl.worlds?.[String(S.name ?? "").slice(9)]?.view === "on") {
      // 2026-11-05 (GAPS): ON the creature's back the world shot is the town on it (seen from above its back), not the
      // whole creature from inside its own body
      ctxE.focus = S.spots.center.clone(); ctxE.focusHeight = 12; ctxE.span = 48;
    }
    else if (fw) { const g = worldG ?? anyGiant; ctxE.focus = g ? g.pos.clone() : S.spots.center.clone(); ctxE.focusHeight = g ? g.g.userData.height : 20; ctxE.span = g ? Math.max(g.g.userData.length, g.g.userData.height) * 1.1 : 60; }
    else if (where[f]) { ctxE.focus = where[f].clone(); ctxE.focusHeight = actorH[f] ?? 1.2; ctxE.kidHeight = actorH[f] ?? 1.2; ctxE.span = 4; }
    else { ctxE.focus = S.spots.center.clone(); ctxE.focusHeight = 2; ctxE.span = 20; }
    // the "other": the giant behind (hero_low), the second giant (duel)
    if (type === "hero_low" || type === "duel") {
      const others = [...live.giants.entries()].filter(([id]) => id !== fg).map(([, v]) => v);
      const o = type === "duel" ? (others[0] ?? worldG) : (anyGiant ?? null);
      if (o) { ctxE.other = o.pos.clone(); ctxE.otherHeight = o.g.userData.height; }
      if (type === "duel" && worldG && o !== worldG && !fg) { ctxE.focus = worldG.pos.clone(); ctxE.focusHeight = worldG.g.userData.height; }
    }
    if (type === "track" && anyGiant && !fg) { ctxE.other = anyGiant.pos.clone(); ctxE.otherHeight = anyGiant.g.userData.height; }
    // REBUILD 2026-11-06: tracking a giant (focus giant:<id> / the world from outside) with no army in focus
    if (type === "track" && !fc && (fg ? gInfo : fw && tl.worlds?.[String(S.name ?? "").slice(9)]?.view === "outside" ? worldG : null)) {
      const gi = fg ? gInfo : worldG, yaw = gi.yaw ?? gi.g.rotation.y;
      ctxE.giantTrack = true; ctxE.velocity = V(Math.sin(yaw), 0, Math.cos(yaw)); ctxE.focus = gi.pos.clone();
      ctxE.focusHeight = gi.g.userData.height; ctxE.span = Math.max(gi.g.userData.length, gi.g.userData.width, gi.g.userData.height); delete ctxE.other;
    }
    if (type === "track" && !ctxE.velocity) { const ca = crowdAt(0); if (ca) { ctxE.velocity = ca.vel; if (!fc) { ctxE.focus = ca.pos; ctxE.span = ca.ext * 1.6; } } }
    if (type === "giant_close" && (gInfo ?? anyGiant)) {
      const gi = gInfo ?? anyGiant; gi.g.updateMatrixWorld(true); const hj = gi.g.userData.joints.head; ctxE.focus = gi.pos.clone(); ctxE.focusHeight = gi.g.userData.height;
      // WORLD-FIX 2026-11-07 (lead: "turtle close = camera inside the head"): the head joint is the NECK pivot of the blocky
      // rigs (the head reaches ~2 m x unit forward of it): frame the head's own box (centre + size), not the pivot
      let hb = null; if (hj) { hb = new THREE.Box3(); hj.traverse((o) => { if (o.isMesh && o.visible !== false) hb.expandByObject(o); }); if (hb.isEmpty()) hb = null; }
      if (hj) ctxE.head = hb ? hb.getCenter(V(0, 0, 0)) : hj.getWorldPosition(V(0, 0, 0));
      if (hb) ctxE.headBox = hb.getSize(V(0, 0, 0)).length();
      // REBUILD 2026-11-06: a giant beside the world, or the world creature seen from outside: frame its face (the old
      // framing stood inside a long shell / body) (cameraEpic giant_close faceDir)
      if (ctxE.head && (gi !== worldG || tl.worlds?.[String(S.name ?? "").slice(9)]?.view === "outside")) { const fd = V(ctxE.head.x - gi.pos.x, 0, ctxE.head.z - gi.pos.z); if (fd.lengthSq() < 1) fd.set(Math.sin(gi.yaw ?? 0), 0, Math.cos(gi.yaw ?? 0)); ctxE.faceDir = fd.normalize(); ctxE.headSize = Math.max((gi.g.userData.height ?? 20) * 0.3, (ctxE.headBox ?? 0) * 1.25); }
    }
    // REBUILD 2026-11-06: hero_low on a giant with no person in focus: a low camera on the ground in front of the giant's
    // face looking up at it (the old framing stood the "kid" spot on the giant's own feet: the camera sat in its body)
    const heroGiant = type === "hero_low" ? (fg && gInfo ? gInfo : fw && worldG && tl.worlds?.[String(S.name ?? "").slice(9)]?.view === "outside" ? worldG : null) : null;
    if (heroGiant) {
      const gi = heroGiant, R = Math.max(gi.g.userData.length ?? 0, gi.g.userData.width ?? 0) / 2, yaw = gi.yaw ?? gi.g.rotation.y;
      const fwd = V(Math.sin(yaw), 0, Math.cos(yaw)), side = (S.camDir ?? V(0, 0, 1)).clone().setY(0).normalize();
      const dir = fwd.multiplyScalar(0.7).addScaledVector(side, 0.6).normalize();
      ctxE.focus = gi.pos.clone().addScaledVector(dir, R * 1.25 + 8); ctxE.focus.y = S.groundY ?? 0;
      ctxE.other = gi.pos.clone(); ctxE.otherHeight = gi.g.userData.height; ctxE.kidHeight = 1.2;
    }
    if (type === "behind_army") {
      // the army runs away from the lens toward its target: the attacked giant (role target / the world's creature / the first giant)
      const tgtE = (shot.giants ?? []).find((g) => g.role === "target"), tg = tgtE ? giantInfo(tgtE.id) : worldG ?? firstGiant;
      if (tg) { ctxE.other = tg.pos.clone(); ctxE.otherHeight = tg.g.userData.height; }
      const atkE = (shot.giants ?? []).find((g) => g.id !== "world" && (g.role === "attacker" || g.action === "attack")), at = atkE ? giantInfo(atkE.id) : null;
      if (at && at !== tg) ctxE.attacker = { pos: at.pos.clone(), h: at.g.userData.height };
      const ca = crowdAt(0); if (ca) { ctxE.focus = ca.pos; ctxE.velocity = ca.vel; ctxE.span = ca.ext * 1.6; }
    }
    // the creature's footprint (cameraEpic keeps establish / aerial outside it or above its top)
    { const gg = fg ? gInfo : fw ? (worldG ?? anyGiant) : null; if (gg) { ctxE.radius = Math.max(gg.g.userData.length ?? 0, gg.g.userData.width ?? 0) / 2; ctxE.top = gg.g.userData.height; ctxE.onBack = !!S.surface && fw; } }
    // a shot's camera move (tilt_up, orbit, flyover, fpv, top_down, low_hero) replaces the EPIC framing
    if (!caps.frame(shot, lt, S, ctxE, { giant: (fg ? gInfo?.g : fw ? (worldG ?? anyGiant)?.g : !where[f] ? anyGiant?.g : null) ?? null })) frameEpic(type, ctxE);
    // REBUILD 2026-11-06: never inside another giant (wolf, bear, bird...): out of its bounding box, sideways from its
    // centre, still aimed where it was (the world creature has its own ray guard below)
    for (const [, L] of live.giants) {
      if (!L.g.visible) continue;
      const box = new THREE.Box3().setFromObject(L.g), m = Math.max(1.5, (box.max.y - box.min.y) * 0.04);
      box.expandByScalar(m);
      if (!box.containsPoint(camera.position)) continue;
      // really inside a part (a ray straight up crosses the closed blocks an odd number of times) or pressed against
      // one (the first thing toward the aim is closer than ~3 % of the giant's height): only then move
      const meshes = (h) => h.object.isMesh && h.object.visible !== false;
      const upHits = new THREE.Raycaster(camera.position.clone(), V(0, 1, 0)).intersectObject(L.g, true).filter(meshes).length;
      const aimV = camera.userData.epicAim ? camera.userData.epicAim.clone().sub(camera.position) : V(0, 0, -1).applyQuaternion(camera.quaternion);
      const first = new THREE.Raycaster(camera.position.clone(), aimV.normalize()).intersectObject(L.g, true).find(meshes);
      if (!(upHits % 2 === 1 || (first && first.distance < Math.max(2, (box.max.y - box.min.y) * 0.03)))) continue;
      const c = box.getCenter(V(0, 0, 0)), d = V(camera.position.x - c.x, 0, camera.position.z - c.z);
      if (d.lengthSq() < 1e-4) d.copy(S.camDir ?? V(0, 0, 1));
      d.normalize();
      // out through the nearest side wall along d (never over the top: that looked down onto its back)
      const tx = d.x > 1e-6 ? (box.max.x - camera.position.x) / d.x : d.x < -1e-6 ? (box.min.x - camera.position.x) / d.x : Infinity;
      const tz = d.z > 1e-6 ? (box.max.z - camera.position.z) / d.z : d.z < -1e-6 ? (box.min.z - camera.position.z) / d.z : Infinity;
      camera.position.addScaledVector(d, Math.min(tx, tz) + 0.5);
      if (camera.userData.epicAim) camera.lookAt(camera.userData.epicAim);
      camera.updateMatrixWorld();
    }
    // inside the set's camera area (the cavern), never under the ground / the creature's back
    if (S.bounds?.length && !S.bounds.some((b) => b.containsPoint(camera.position))) { const q = S.bounds[0].clampPoint(camera.position, V(0, 0, 0)); camera.position.copy(q); if (camera.userData.epicAim) camera.lookAt(camera.userData.epicAim); camera.updateMatrixWorld(); }
    const gy = S.surface?.(camera.position.x, camera.position.z) ?? S.groundY ?? null;
    if (gy != null && camera.position.y < gy + 1.2) { camera.position.y = gy + 1.2; camera.updateMatrixWorld(); }
    // 2026-11-05 (GAPS): never inside the creature's body: a ray down onto it (a furry / generic back bulges above the
    // town's ground); the camera stays a few metres over it (more for the wide EPIC shots), still aimed where it was
    const onBack = (typeof shot.move === "string" ? shot.move : shot.move?.type) === "on_back"; // WORLD-LOOK: stands on the walkway on purpose
    const body = S.giant && S.giant.visible !== false && !onBack ? S.giant : null;
    if (body) {
      const top = new THREE.Box3().setFromObject(body).max.y;
      if (camera.position.y < top + 3) {
        const rc = new THREE.Raycaster(V(camera.position.x, top + 5, camera.position.z), V(0, -1, 0), 0, top + 5 - camera.position.y + 0.5);
        const hit = rc.intersectObject(body, true).find((h) => h.object.isMesh && h.object.visible !== false);
        const margin = ["establish", "aerial"].includes(type) ? Math.max(6, (ctxE.span ?? 20) * 0.12) : 2.5;
        if (hit && camera.position.y < hit.point.y + margin) { camera.position.y = hit.point.y + margin; if (camera.userData.epicAim) camera.lookAt(camera.userData.epicAim); camera.updateMatrixWorld(); }
      }
    }
    // WORLD-FIX 2026-11-07: the min-distance guard for EVERY giant camera (the lead: a close inside the head, an on-back
    // camera jammed against wall blocks): never inside, never within minD of any giant / the world creature / its town
    const objs = [...[...live.giants.values()].map((L) => L.g), S.giant].filter((g) => g && g.visible !== false);
    for (const g of objs) clearGeometry(THREE, camera, g, onBack ? 0.6 : Math.max(2, (g.userData.height ?? 20) * 0.05), { parity: !onBack }); // on the walkway the battlements are an arm away on purpose
    return true;
  }

  function after(shot, lt, S, camera, where = {}) {
    const dur = shot.end - shot.start;
    for (const L of live.crowds) updateCrowd(L.grp, lt, { action: L.action, origin: L.origin, yaw: L.yaw, camera, speed: L.speed, surface: (L.c.onWorld || (S.crowdsOnSurface && !L.c.onGround)) && S.surface ? S.crowdSurface ?? S.surface : null });
    for (const { g } of live.giants.values()) updateGiantLOD(g, camera);
    if (S.giant) updateGiantLOD(S.giant, camera);
    const preset = shot.beat?.shake ?? live.beat?.shake?.preset ?? shot.shake ?? null;
    let shaken = null;
    if (preset && preset !== "none") {
      const at = live.beat?.shake?.at ?? (shot.beat?.at != null ? shot.beat.at * dur : 0);
      shaken = applyShake(camera, preset, lt, { at, seed: shot.seed ?? 1, dur });
    }
    // 2026-11-06 (CAPABILITIES): tethers, siege fire, fx, the flashback grade, the tilt (after the shake: they need the final camera)
    const capsShake = caps.after(shot, lt, S, camera, live, where);
    return shaken ?? capsShake ?? null;
  }

  return {
    GIANTS, CROWDS,
    buildSet: async (name) => {
      const id = name.slice(9), spec = tl.worlds?.[id];
      if (!spec) throw new Error(`epic: set "${name}" is not in timeline.worlds`);
      const S = await buildCreatureWorld(tl.world ? { ...spec, bible: tl.world } : spec, ctx); S.name = name; // WORLD-LOOK: the world bible's town + creature colours
      // never a silent swap: the built world must be the asked view of the asked creature
      const want = { view: spec.view, creature: typeof spec.creature === "string" ? spec.creature : spec.creature?.species };
      if (S.giantView !== want.view || (want.creature && S.creature !== want.creature)) throw new Error(`epic: set "${name}" built ${S.creature} ${S.giantView}, asked ${want.creature} ${want.view}`);
      caps.decorateWorld(S, spec); // the town on its back (asked, or a town-less creature seen from outside)
      return S;
    },
    buildCreatureWorld: (spec, c) => buildCreatureWorld(spec, c ?? ctx),
    problems: () => [...validateEpic(tl), ...caps.problems()],
    ownsFocus: (shot) => EPIC_CAMERA_TYPES.includes(shot.camera) || /^(giant:|crowd)/.test(String(shot.focus ?? "")) || shot.focus === "world" || !!shot.move,
    place, frame, after,
    posOf: (id) => live.giants.get(id)?.pos ?? null,
    hideAll: () => { for (const g of allGiants) g.visible = false; for (const c of allCrowds) c.visible = false; },
  };
}
