// Blocky Worlds CAPABILITIES (2026-11-06): the capability layer the EPIC layer (page/epicLayer.js) calls. It owns the
// shot fields of lib/caps.js (move, tethers, siege, fx, acts, grade, tilt) and the back towns (giants[id].backTown,
// worlds[id].backTown, and on its own a town on a creature world seen from outside that has none).
//   const C = makeCapsLayer({ THREE, scene, tl, ctx })
//   C.decorateGiant(g, spec)      after makeGiant: a back town when asked (spec.backTown) or spec.town on a town-less kind
//   C.decorateWorld(S, spec)      after a creature world is built: the same for its own giant (S.giant)
//   C.place(shot, lt, S, live)    after the EPIC place: giant acts (nuzzle / headbutt / eat a tree), lights, visibility
//   C.frame(shot, lt, S, ctxE, info) -> true when the shot's `move` framed the camera (instead of frameEpic)
//   C.after(shot, lt, S, camera, live, where)  tethers, siege fire, fx, the flashback grade, the tilt, caps shakes
//   C.problems()                  lib/caps.js validateCaps
import { makeTether, updateTether } from "/page/kit/tether.js";
import { makeSiege, aimSiege, animateSiege, muzzleOf, makeShotFx, makeBurst, updateBurst } from "/page/kit/siege.js";
import { addBackTown } from "/page/kit/backTown.js";
import { makeSoundRings, updateSoundRings, makeShieldDome, updateShieldDome, makeBlockTree, makeVignette, updateVignette } from "/page/kit/fxCaps.js";
import { applyMove } from "/page/cameraMoves.js";
import { applyShake } from "/page/cameraEpic.js";
import { POST } from "/page/post.js";
import { validateCaps, parseAnchor, tetherState, siegeTiming, ballistic, MOVES, usesCaps, smooth, clamp01 } from "/lib/caps.js";

export { usesCaps, MOVES };

const PART_JOINT = { head: "head", jaw: "jaw", neck: "neck", body: "body", back: "body", tail: "tail" };

export function makeCapsLayer({ THREE, scene, tl, ctx }) {
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const shotKey = (s) => tl.shots.indexOf(s);
  const OBJ = new Map(); // shot index -> { tethers: [], siege: [], fx: [], trees: [] } built lazily, reused
  const towns = [];
  let vignette = null, gradeOn = false;

  function decorateGiant(g, spec = {}) {
    if (!g) return null;
    const want = spec.backTown ?? (spec.town === true && !g.userData.town ? { style: "town" } : null);
    if (!want) return null;
    const t = addBackTown(g, { ...(want === true ? {} : want), seed: want.seed ?? spec.seed ?? 5, tex: ctx.tex });
    towns.push(t); return t;
  }
  function decorateWorld(S, spec = {}) {
    if (!S?.giant) return null;
    if (S.giant.userData.backTown) return S.giant.userData.backTown; // WORLD-LOOK: creatureWorld.js already built its (dense) town
    // a story that lives on a creature always shows its town on it: the asked back town, else one on its own when the
    // creature's kind carries none (a wolf, a bear, a bird...)
    const want = spec.backTown ?? (spec.view === "outside" && !S.giant.userData.town && spec.town !== false ? { style: "town" } : null);
    if (!want) return null;
    const t = addBackTown(S.giant, { ...(want === true ? {} : want), seed: want.seed ?? spec.seed ?? 5, tex: ctx.tex });
    towns.push(t); return t;
  }

  // ---------------------------------------------------------------------------------------------- anchors
  function giantObj(id, S, live) {
    if (id === "world") return S.giant && S.giant.visible !== false ? S.giant : null;
    return live?.giants.get(id)?.g ?? null;
  }
  function jointPos(g, part) {
    g.updateMatrixWorld(true);
    const J = g.userData.joints, u = g.userData;
    const leg = /^leg(\d)$/.exec(part);
    let o = null;
    if (leg) o = J.knees?.[Number(leg[1])] ?? J.legs?.[Number(leg[1])] ?? null;
    else if (part === "tail") o = Array.isArray(J.tail) ? J.tail[J.tail.length - 1] : J.tail;
    else o = J[PART_JOINT[part] ?? "body"] ?? null;
    if (part === "back") { const p = g.localToWorld(V(0, u.height * 0.98, 0)); return p; }
    if (["front", "rear", "left", "right"].includes(part)) {
      const l = u.length / 2, w = u.width / 2, y = u.height * 0.5;
      const loc = { front: V(0, y, l * 0.9), rear: V(0, y, -l * 0.9), left: V(w * 0.9, y, 0), right: V(-w * 0.9, y, 0) }[part];
      return g.localToWorld(loc);
    }
    if (!o) return g.localToWorld(V(0, u.height * 0.5, 0));
    const p = o.getWorldPosition(V());
    if (leg) p.y = Math.max(g.position.y + u.height * 0.06, p.y - (u.unit ?? 1) * 0.6); // the ankle, a little above the foot
    return p;
  }
  function anchorPos(a, S, live, where, siegeObjs = []) {
    const p = parseAnchor(a); if (!p) return null;
    let out = null;
    if (p.type === "pos") out = V(...p.pos);
    else if (p.type === "giant") { const g = giantObj(p.id, S, live); out = g ? jointPos(g, p.part) : null; }
    else if (p.type === "actor") out = where?.[p.id] ? where[p.id].clone().setY(where[p.id].y + 1.0) : null;
    else if (p.type === "crowd") { const L = live?.crowds?.[p.id]; out = L ? L.origin.clone().setY(L.origin.y + 1.2) : null; }
    else if (p.type === "siege") out = siegeObjs[p.id] ? muzzleOf(siegeObjs[p.id].w, V()) : null;
    else if (p.type === "spot") out = S.spots?.[p.id]?.isVector3 ? S.spots[p.id].clone() : null;
    if (out && p.off) out.add(V(...p.off));
    return out;
  }
  const sizeHint = (S, live) => { let m = 0; for (const { g } of live?.giants?.values() ?? []) m = Math.max(m, g.userData.size); if (S.giant) m = Math.max(m, S.giant.userData.size); return m || 20; };

  // ---------------------------------------------------------------------------------------------- per-shot objects
  function objsFor(shot, S, live) {
    const k = shotKey(shot);
    if (OBJ.has(k)) return OBJ.get(k);
    const big = sizeHint(S, live), o = { tethers: [], siege: [], fx: [], trees: [], bursts: [] };
    for (const t of shot.tethers ?? []) { const g = makeTether({ kind: t.kind ?? "chain", thick: t.thick ?? Math.max(0.12, Math.min(2.4, big / 140)), hook: !!(t.hook ?? t.state === "fire") }); g.visible = false; scene.add(g); o.tethers.push({ spec: t, g }); }
    for (const s of shot.siege ?? []) {
      const n = s.count ?? 1, sc = s.scale ?? Math.max(1, Math.min(6, big / 40));
      for (let i = 0; i < n; i++) {
        const w = makeSiege(s.kind, { scale: sc }); w.visible = false; scene.add(w);
        const fx = makeShotFx({ payload: s.payload ?? (s.kind === "catapult" ? "rock" : s.kind === "ballista" ? "bolt" : "ball"), size: sc * (s.payload === "hook" ? 0.8 : 1), smoke: s.kind === "cannon" }); fx.group.visible = false; scene.add(fx.group);
        const chain = s.payload === "hook" || s.chain ? makeTether({ kind: "chain", thick: Math.max(0.12, sc * 0.16), hook: true }) : null; if (chain) { chain.visible = false; scene.add(chain); }
        o.siege.push({ spec: s, i, n, w, fx, chain });
      }
    }
    for (const f of shot.fx ?? []) {
      let g = null;
      if (f.kind === "sound_rings") g = makeSoundRings({ size: f.size ?? 1 });
      else if (f.kind === "shield_dome") g = makeShieldDome({ radius: f.size ?? 1 });
      else g = makeBurst({ kind: f.kind === "leaf_burst" ? "leaves" : f.kind === "debris" ? "impact" : f.kind, size: f.size ?? Math.max(0.6, big / 60) });
      g.visible = false; scene.add(g); o.fx.push({ spec: f, g });
    }
    for (const a of shot.acts ?? []) if (a.kind === "eat_tree") { const tr = makeBlockTree({ height: 12 }); tr.visible = false; scene.add(tr); const leaves = makeBurst({ kind: "leaves", size: 1 }); leaves.visible = false; scene.add(leaves); o.trees.push({ spec: a, tr, leaves }); }
    OBJ.set(k, o);
    return o;
  }
  function hideAll() {
    for (const o of OBJ.values()) { for (const x of o.tethers) x.g.visible = false; for (const x of o.siege) { x.w.visible = false; x.fx.group.visible = false; if (x.chain) x.chain.visible = false; } for (const x of o.fx) x.g.visible = false; for (const x of o.trees) { x.tr.visible = false; x.leaves.visible = false; } }
  }

  // ---------------------------------------------------------------------------------------------- place (before the camera)
  function place(shot, lt, S, live) {
    hideAll();
    const night = shot.light === "night";
    for (const t of towns) t.userData.setLit?.(night);
    const dur = shot.end - shot.start;
    for (const a of shot.acts ?? []) {
      const me = live.giants.get(a.giant) ?? (a.giant === "world" && S.giant ? { g: S.giant, pos: S.giant.position.clone() } : null);
      if (!me) continue;
      const g = me.g, at = (a.at ?? 0.5) * dur;
      if (a.kind === "nuzzle" || a.kind === "headbutt") {
        const other = typeof a.to === "string" && !a.to.includes(":") && !a.to.includes(".") ? giantObj(a.to, S, live) : null;
        const tgt = other ? jointPos(other, other.userData.joints.head && a.part !== "shell" ? (a.part ?? "head") : "body") : anchorPos(a.to, S, live, null);
        if (!tgt) continue;
        if (other && a.part === "shell") tgt.y = other.position.y + other.userData.height * 0.7;
        // face the target, then slide along the heading so the head touches it (a headbutt lunges in at `at`)
        const yaw = Math.atan2(tgt.x - g.position.x, tgt.z - g.position.z); g.rotation.set(0, yaw, 0); g.updateMatrixWorld(true);
        const head = jointPos(g, "head"), fwd = V(Math.sin(yaw), 0, Math.cos(yaw));
        const gap = V(tgt.x - head.x, 0, tgt.z - head.z).dot(fwd);
        let reach = gap - g.userData.unit * 0.3;
        if (a.kind === "headbutt") { const u = (lt - at) / 0.35; reach += u < 0 ? -g.userData.unit * 2.5 * smooth(lt / Math.max(0.2, at)) : -g.userData.unit * 2.5 * (1 - smooth(u * 3)) ; }
        g.position.addScaledVector(fwd, reach); me.pos.copy(g.position);
        const J = g.userData.joints;
        if (J.head) { J.head.rotation.x += 0.18; if (a.kind === "nuzzle") J.head.rotation.z += 0.12 * Math.sin(lt * 3.2); }
        if (J.neck) J.neck.rotation.x += 0.12;
        if (J.lids && a.kind === "nuzzle") for (const l of [].concat(J.lids)) if (l?.scale) l.scale.y = Math.max(0.15, l.scale.y * 0.3);
      }
    }
    return { at: lt };
  }

  // ---------------------------------------------------------------------------------------------- the move
  function frame(shot, lt, S, ctxE, info = {}) {
    if (!shot.move) return false;
    const g = info.giant ?? null;
    if (g) {
      const yaw = g.rotation.y; ctxE.forward = V(Math.sin(yaw), 0, Math.cos(yaw));
      const J = g.userData.joints; if (J.head) { g.updateMatrixWorld(true); ctxE.head = J.head.getWorldPosition(V()); const hb = new THREE.Box3(); J.head.traverse((o) => { if (o.isMesh && o.visible !== false) hb.expandByObject(o); }); if (!hb.isEmpty()) { ctxE.head = hb.getCenter(V()); ctxE.headTop = hb.max.y; ctxE.headR = hb.getSize(V()).length() / 2; } } // WORLD-FIX: the head's own box (the joint is the neck pivot)
      // the town on its back is the top of a tilt-up / the floor of a fly-through
      if (g.userData.backTown || g.userData.town) { const b = new THREE.Box3().setFromObject(g.userData.backTown ?? g.userData.town); if (!b.isEmpty()) ctxE.focusHeight = Math.max(ctxE.focusHeight ?? 0, b.max.y - ctxE.focus.y); }
    }
    // WORLD-LOOK: on_back stands on the town's wall walkway (page/kit/backTown.js), in world space
    const bt = g?.userData.backTown ?? (S.giant?.userData.backTown ?? null);
    if (bt?.userData.walkway?.length) { bt.updateMatrixWorld(true); const nm = new THREE.Matrix3().getNormalMatrix(bt.matrixWorld); ctxE.walkway = bt.userData.walkway.map((w) => ({ p: bt.localToWorld(V(w.x, w.y, w.z)), dir: V(Math.sin(w.ry), 0, Math.cos(w.ry)).applyMatrix3(nm).normalize(), out: V(w.out[0], 0, w.out[1]).applyMatrix3(nm).normalize() })); }
    // WORLD-FIX: what can block the on-back view (the town and the creature it stands on)
    if (ctxE.walkway?.length) ctxE.occluders = [bt, g ?? S.giant].filter(Boolean);
    applyMove(shot.move, ctxE);
    return true;
  }

  // ---------------------------------------------------------------------------------------------- after (the camera is set)
  function after(shot, lt, S, camera, live, where = {}) {
    const dur = shot.end - shot.start, seed = shot.seed ?? 1;
    const any = usesCaps(shot);
    // the flashback grade: the post chain's grade for this light, washed out and warm; restored on other shots
    const post = globalThis.engineDebug?.post, gp = post?.composer?.passes?.find((p) => p.uniforms?.sat && p.uniforms?.warm);
    if (shot.grade === "flashback") {
      // capped (PLANNER-FIX 2026-11-07, dog line 18: sat x0.38 + contrast x0.92 left a flat beige frame): a memory tint, never a wash
      if (gp) { const P = POST[shot.light] ?? POST.day; gp.uniforms.sat.value = P.sat * 0.68; gp.uniforms.con.value = Math.max(P.con, 1.04); gp.uniforms.warm.value = Math.min(0.07, Math.max(P.warm, 0.05)); gradeOn = true; }
      if (!vignette) { vignette = makeVignette(); scene.add(vignette); }
    } else if (gradeOn && gp) { const P = POST[shot.light] ?? POST.day; gp.uniforms.sat.value = P.sat; gp.uniforms.con.value = P.con; gp.uniforms.warm.value = P.warm; gradeOn = false; }
    if (vignette) vignette.visible = false;
    for (const L of live?.crowds ?? []) L.grp.position.set(0, 0, 0);
    if (!any) return null;
    const o = objsFor(shot, S, live);
    let shakeAt = null, shakePreset = null;
    const kick = (t, preset) => { if (t <= lt && (shakeAt == null || t > shakeAt)) { shakeAt = t; shakePreset = preset; } };
    // siege first (a hook's chain and "siege:<i>" anchors need the weapons placed)
    const big = sizeHint(S, live);
    for (const x of o.siege) {
      const s = x.spec;
      const base = anchorPos(s.at, S, live, where); if (!base) continue;
      const aim = s.aim != null ? anchorPos(s.aim, S, live, where) : base.clone().add(V(0, 0, -60));
      if (!aim) continue;
      // a row of weapons (count) side by side, across the line of fire
      const dir = V(aim.x - base.x, 0, aim.z - base.z); const dist = dir.length(); dir.normalize();
      const lat = V(dir.z, 0, -dir.x), spacing = 4.5 * x.w.userData.scale;
      const p = base.clone().addScaledVector(lat, (x.i - (x.n - 1) / 2) * spacing);
      if (s.place === "back" || s.place === "wall") p.y = base.y; // on a creature's back / a wall top: the anchor's height
      x.w.position.copy(p);
      const timing = siegeTiming({ fireAt: (s.fireAt ?? 0.2) + x.i * 0.06, flight: s.flight }, dur, dist);
      const pitch = Math.atan2(aim.y - p.y + dist * 0.25, dist);
      aimSiege(x.w, Math.atan2(dir.x, dir.z), pitch);
      animateSiege(x.w, lt, timing);
      x.w.visible = true;
      const from = muzzleOf(x.w, V()), to = aim.clone().addScaledVector(lat, (x.i - (x.n - 1) / 2) * spacing * 0.5);
      x.fx.group.visible = true;
      const r = x.fx.update(lt, { from, to, timing, seed: seed + x.i * 13 });
      kick(timing.fireAt, "impact");
      if (timing.impactAt <= dur) kick(timing.impactAt, big > 40 ? "rumble" : "impact");
      if (x.chain) {
        // the hook pulls a chain from the weapon: flying on the arc, then caught and taut
        const hp = r.projPos ?? (lt >= timing.impactAt ? to : null);
        if (hp) {
          const after = Math.max(0, lt - timing.impactAt);
          const st = r.projPos ? { sag: 0.07, swing: 0, tension: 0, reach: 1 } : { sag: 0.035 + 0.1 * Math.exp(-after * 3), swing: 0, tension: 0.4 * Math.exp(-after * 3), reach: 1 };
          x.chain.visible = true; updateTether(x.chain, from, to, st, { hookPos: hp, seed });
        }
      }
    }
    const siegeObjs = o.siege;
    for (const x of o.tethers) {
      const t = x.spec;
      const a = anchorPos(t.from, S, live, where, siegeObjs), b = anchorPos(t.to, S, live, where, siegeObjs);
      if (!a || !b) continue;
      const st = tetherState(t.state ?? "taut", lt / dur, { at: t.at ?? (t.state === "fire" ? 0.1 : 0.55), until: t.until ?? null, sag: t.sag ?? null, seed, dur });
      let hookPos = null;
      if ((t.state ?? "taut") === "fire" && st.reach < 1) {
        const t0 = (t.at ?? 0.1) * dur, t1 = (t.until ?? Math.min(0.95, (t.at ?? 0.1) + 0.45)) * dur;
        const bp = ballistic([a.x, a.y, a.z], [b.x, b.y, b.z], lt, { fireAt: t0, flight: Math.max(0.05, t1 - t0) });
        hookPos = bp ? V(...bp.pos) : a.clone();
      }
      x.g.visible = true;
      updateTether(x.g, a, b, st, { hookPos, seed: seed + 5 });
      if (t.state === "snap") kick((t.at ?? 0.55) * dur, "impact");
      if (t.state === "fire") kick((t.until ?? Math.min(0.95, (t.at ?? 0.1) + 0.45)) * dur, "impact");
    }
    for (const x of o.fx) {
      const f = x.spec, a = anchorPos(f.at, S, live, where, siegeObjs); if (!a) continue;
      x.g.visible = true;
      if (f.kind === "sound_rings") { const b = (f.to != null ? anchorPos(f.to, S, live, where, siegeObjs) : null) ?? a.clone().add(V(0, 0, -20)); updateSoundRings(x.g, lt, a, b, { t0: (f.t0 ?? 0.1) * dur, t1: (f.t1 ?? 1) * dur, speed: f.speed ?? 14 }); }
      else if (f.kind === "shield_dome") {
        const p = parseAnchor(f.at), host = p?.type === "giant" ? giantObj(p.id, S, live) : null;
        const R = f.size ?? (host ? Math.max(host.userData.length, host.userData.width) * 0.62 : 30);
        x.g.scale.set(R, R * 0.62, R);
        if (host) { x.g.position.copy(host.position); x.g.position.y = host.position.y + host.userData.height * 0.35; x.g.rotation.y = host.rotation.y; } else x.g.position.copy(a);
        updateShieldDome(x.g, lt, { hitAt: f.hitAt != null ? f.hitAt * dur : null, appear: (f.t0 ?? 0) * dur });
      } else { x.g.position.copy(a); updateBurst(x.g, lt - (f.t0 ?? 0) * dur, { seed: seed + 21 }); if ((f.t0 ?? 0) * dur <= lt && f.kind === "debris") kick((f.t0 ?? 0) * dur, "impact"); }
    }
    for (const x of o.trees) {
      const a = x.spec, me = live.giants.get(a.giant) ?? (a.giant === "world" && S.giant ? { g: S.giant } : null); if (!me) continue;
      const g = me.g, at = (a.at ?? 0.5) * dur, H = Math.max(6, g.userData.height * 0.3);
      // the tree stands just in front of the mouth; at the bite it tips into the jaws and shrinks away, leaves burst
      const head = jointPos(g, "jaw"), yaw = g.rotation.y, fwd = V(Math.sin(yaw), 0, Math.cos(yaw));
      const groundY = g.position.y;
      const base = head.clone().addScaledVector(fwd, g.userData.unit * 0.2); base.y = groundY;
      const k = smooth((lt - at) / 0.4);
      x.tr.visible = k < 0.999; x.tr.scale.setScalar((H / 12) * (1 - 0.85 * k));
      x.tr.position.copy(base).lerp(head.clone().setY(head.y - H * 0.6), k);
      x.tr.rotation.set(0, yaw, 0); x.tr.rotateX(-0.25 * smooth(lt / Math.max(0.2, at)) - 0.9 * k);
      x.leaves.visible = true; x.leaves.userData.size = Math.max(1, H / 10); x.leaves.position.copy(head); updateBurst(x.leaves, lt - at, { seed: seed + 31 });
    }
    // the tilt: the world tips (the camera rolls) and the crowds slide downhill
    let roll = 0;
    if (shot.tilt) {
      const k = smooth((lt / dur - (shot.tilt.at ?? 0.1)) / 0.35); roll = (shot.tilt.deg * Math.PI / 180) * k;
      if (shot.tilt.slide !== false) {
        const right = V(1, 0, 0).applyQuaternion(camera.quaternion).setY(0).normalize().multiplyScalar(Math.sign(shot.tilt.deg) || 1);
        const ts = Math.max(0, lt - ((shot.tilt.at ?? 0.1) + 0.15) * dur), d = 0.5 * 9.8 * Math.sin(Math.abs(roll)) * ts * ts;
        for (const L of live?.crowds ?? []) L.grp.position.copy(right).multiplyScalar(d);
      }
      kick((shot.tilt.at ?? 0.1) * dur, "rumble");
    }
    if (roll) { camera.rotateZ(roll); camera.updateMatrixWorld(); }
    // caps shakes (only when the shot's own beat / shake did not shake already)
    let s = null;
    if (shakeAt != null && !(shot.beat?.shake || shot.shake)) s = applyShake(camera, shakePreset, lt, { at: shakeAt, seed, dur });
    if (shot.grade === "flashback" && vignette) updateVignette(vignette, camera, 0); // off (PLANNER-FIX 2026-11-07, dog line 18: the full-frame overlay rendered as a flat beige wash; the capped grade alone marks the memory)
    return s;
  }

  return { decorateGiant, decorateWorld, place, frame, after, problems: () => validateCaps(tl), towns };
}
