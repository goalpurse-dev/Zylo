// Style test page: ?clip=turtle | wolf. window.ready, window.renderAt(t) -> ms, window.frameData(q), window.stats.
import * as THREE from "three";
import { makeRenderer, makePost } from "/page/post.js";
import { applyLight, preloadEnv } from "/page/lighting.js";
import { makePerson, posePerson } from "/page/kit/people.js";
import { addBackTown } from "/page/kit/backTown.js";
import { A, loadGltf, rng, makeGround, partsOf, boundsOf, instanced, placeMat, makeImpostor, makeGrass, makeDust, makeDebris, groundH } from "./world.js";
import { makeTurtle, walkTurtle, turtleFootfalls } from "./turtle.js";
import { makeWolf } from "./wolf.js";
import { placeShot } from "./shots.js";
const SHOTS = {
  turtle: [
    { t0: 0, t1: 1.0, from: [-12, 35, -18], to: [-11, 35.5, -8], look0: [0, 22, 10], look1: [0, 22, 17], fov0: 55, fov1: 54 },
    { t0: 1.0, t1: 2.0, from: [-24, 3, 62], to: [-19, 4.6, 55], look0: [0, 14, 22], look1: [0, 15, 23], fov0: 46, fov1: 45 },
    { t0: 2.0, t1: 3.0, from: [-44, 3, 24], to: [-42, 4.2, 9], look0: [0, 12.5, 14], look1: [0, 13.5, 3], fov0: 54 },
    { t0: 3.0, t1: 3.5, from: [-52, 5, 72], to: [-50, 5.6, 66], look0: [0, 12, 8], look1: [0, 12.5, 10], fov0: 50 },
    { t0: 3.5, t1: 5.01, from: [-18, 9, 50], to: [-13, 11.5, 42], look0: [0, 13, 25], look1: [0, 13.5, 26], fov0: 44, fov1: 42 },
  ],
};

const Q = new URLSearchParams(location.search);
const CLIP = Q.get("clip") ?? "turtle";
const W = +(Q.get("w") ?? 1080), H = +(Q.get("h") ?? 1920);

async function main() {
  const renderer = makeRenderer(W, H); document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, W / H, 0.3, 3000);
  await preloadEnv(THREE);

  // ---- vegetation sources (CC0 Poly Haven)
  const [tree, fir, fern, rocks, boulder, logm, stump] = await Promise.all(["island_tree_02", "fir_sapling", "fern_02", "rock_moss_set_01", "boulder_01", "dead_tree_trunk", "tree_stump_01"].map((n) => loadGltf(`${A}/${n}/${n}.gltf`)));
  const treeParts = partsOf(tree.scene), firParts = partsOf(fir.scene, { tint: "#c8d8b0" }), fernParts = partsOf(fern.scene), rockParts = partsOf(rocks.scene), boulderParts = partsOf(boulder.scene), logParts = partsOf(logm.scene), stumpParts = partsOf(stump.scene);
  const tb = boundsOf(treeParts), fb = boundsOf(firParts);
  const treeH = tb.max.y - tb.min.y, firH = fb.max.y - fb.min.y;
  const treeImp = makeImpostor(renderer, treeParts), firImp = makeImpostor(renderer, firParts);
  window.stats = { treeH, firH, treeTris: treeParts.reduce((s, p) => s + (p.geometry.index ? p.geometry.index.count / 3 : 0), 0) };

  const ctx = CLIP === "turtle" ? await turtleClip() : await wolfClip();

  async function turtleClip() {
    const walk = { start: new THREE.Vector3(-14, 0, 0), yaw: Math.PI / 2, v: 3.4, P: 2.5, duty: 0.68, lift: 2.8 };
    const X = (t) => walk.start.x + walk.v * t;
    const turtle = makeTurtle(); scene.add(turtle);
    walkTurtle(turtle, 0, walk);
    // the town on its back (our blocky kit): a fake host with the dome surface backTown.js expects
    turtle.userData.unit = 1; turtle.userData.joints = { body: turtle.userData.body }; turtle.userData.params = { body: { w: 26, len: 34, y: 13, h: 6 }, shell: { kind: "dome", h: 9.5 }, back: {}, plan: "turtle" };
    addBackTown(turtle, { style: "village", seed: 7, density: 1.6 });
    const R = rng(4), avoidCam = (x, z) => z > 9 && z < 90 && x > -40 && x < X(5) + 90;
    // forest: real trees in the middle distance, impostors behind, saplings/firs mixed in
    const near = [], firNear = [], far = [], firFar = [];
    for (let i = 0; i < 2600; i++) {
      const x = -260 + R() * 560, z = -330 + R() * 400;
      if (z > -16 && z < 16 && x > -40 && x < 140) continue; // the turtle's lane (its own smash trees go here)
      if (avoidCam(x, z)) continue;
      if (z > 70) continue;
      const d = Math.hypot(x - X(2.5) - 10, z - 34), isFir = R() < 0.35;
      const s = isFir ? (9 + R() * 8) / firH : (11 + R() * 7) / treeH;
      const m = placeMat(x, z, s, R() * 6.28, 0.08, R);
      (d < 95 ? (isFir ? firNear : near) : (isFir ? firFar : far)).push(m);
    }
    scene.add(instanced(treeParts, near), instanced(firParts, firNear), instanced(treeImp, far, { cast: false }), instanced(firImp, firFar, { cast: false }));
    // the trees in its path: separate objects that fall when the shell front reaches them
    const smash = [];
    const path = [[13, 7], [22, -9], [29, -12], [36, -6], [43, -10], [50, -4]];
    for (const [x, z] of path) {
      const g = instanced(treeParts, [new THREE.Matrix4()]); const s = (12 + R() * 4) / treeH;
      const o = new THREE.Group(); o.add(g); o.scale.setScalar(s); o.position.set(x, groundH(x, z) - 0.3, z); o.rotation.y = R() * 6; scene.add(o);
      const tHit = (x - 24 - walk.start.x) / walk.v; // shell front (z ~ +24 local) reaches the trunk
      const dir = new THREE.Vector3(1, 0, -0.45).normalize();
      smash.push({ o, tHit, dir, x, z });
    }
    // rocks, logs, ferns, stumps
    const rockM = [], boulderM = [], fernM = [], logM = [], stumpM = [];
    for (let i = 0; i < 900; i++) {
      const x = X(2.5) - 70 + R() * 150, z = -60 + R() * 110;
      if ((z > -13 && z < 13 && x > -30 && x < 70 && R() < 0.8) || z > 10) continue;
      const k = R();
      if (k < 0.06) rockM.push(placeMat(x, z, 0.8 + R() * 1.4, R() * 6.28, 0.3, R));
      else if (k < 0.09) boulderM.push(placeMat(x, z, 0.4 + R() * 0.7, R() * 6.28, 0.3, R));
      else if (k < 0.11) logM.push(placeMat(x, z, 1.5 + R(), R() * 6.28, 0, R));
      else if (k < 0.13) stumpM.push(placeMat(x, z, 1.5 + R(), R() * 6.28, 0, R));
      else fernM.push(placeMat(x, z, 1.6 + R() * 1.8, R() * 6.28, 0.2, R));
    }
    scene.add(instanced(rockParts, rockM), instanced(boulderParts, boulderM), instanced(fernParts, fernM), instanced(logParts, logM), instanced(stumpParts, stumpM));
    scene.add(makeGround(900, 300, (x, z) => (Math.abs(z) < 16 && x > -60 && x < 90 ? 0.9 - Math.abs(z) / 30 : 0)));
    scene.add(makeGrass({ center: new THREE.Vector3(X(2.5) + 10, 0, 20), radius: 75, count: 140000, seed: 3, avoid: (x, z) => Math.abs(z) < 11 && x > -40 && x < 90 }));
    // dust: every footfall, a big cloud at the front, and each smashed tree
    const falls = turtleFootfalls(turtle, -1, 6, walk);
    const bursts = falls.map((f) => ({ t0: f.t, pos: f.pos, n: f.front ? 12 : 6, spread: 3.5, rise: 1.4, size: 5, dur: 0.5, alpha: 0.4 }));
    for (const s of smash) bursts.push({ t0: s.tHit + 0.5, pos: new THREE.Vector3(s.x + 3, 0, s.z), n: 22, spread: 4, rise: 2.4, size: 8, dur: 0.9, alpha: 0.6, color: "#a89880", dir: { x: 1.5, z: 0 } });
    const dust = makeDust(bursts); scene.add(dust.group);
    const debris = makeDebris(smash.map((s) => ({ t0: s.tHit + 0.2, pos: new THREE.Vector3(s.x, groundH(s.x, s.z), s.z), n: 60, h: 12, dir: { x: 4, z: 0 } }))); scene.add(debris.group);
    // our blocky people for scale: running away from it
    const people = [0, 1, 2, 3].map((i) => { const p = makePerson({ id: `run${i}`, seed: 30 + i, role: i === 3 ? "kid" : "adult" }); p.scale.multiplyScalar(1.15); scene.add(p); return p; });
    applyLight("day", { THREE, scene, renderer, set: { root: scene, rig: { shadow: { center: [X(2.5) + 5, 0, 5], half: 70, far: 320, map: 4096 }, fog: { day: ["#b4cde4", 140, 1100] }, sunDir: { day: [30, 42, 40] }, sunScale: { day: 0.62 }, exposure: { day: 0.72 } } } });
    return {
      update(t) {
        walkTurtle(turtle, t, walk);
        for (const s of smash) {
          const k = Math.max(0, Math.min(1, (t - s.tHit) / 1.6)), e = k * k * (3 - 2 * k) * 1.45 + Math.max(0, t - s.tHit) * 0.02;
          const ax = new THREE.Vector3(s.dir.z, 0, -s.dir.x).normalize();
          s.o.quaternion.setFromAxisAngle(ax, Math.min(1.45, e)); s.o.position.x = s.x + Math.max(0, t - s.tHit) * (t > s.tHit ? 2.2 : 0) * (1 - k * 0.5);
        }
        dust.update(t); dust.group.visible = !Q.has("nodust"); debris.update(t);
        people.forEach((p, i) => { const x = X(t) + 34 + i * 2.5 + t * 2.4, z = 14 + i * 2.6; p.position.set(x, groundH(x, z), z); p.rotation.y = Math.PI / 2 + 0.25; posePerson(p, "run", t + i * 0.3); });
                placeShot(camera, SHOTS.turtle, t, { position: turtle.position, yaw: walk.yaw }); if (Q.has("debug")) { camera.position.set(X(t) + 50, 45, 80); camera.lookAt(X(t) + 5, 10, 0); } camera.updateProjectionMatrix();
      },
    };
  }

  async function wolfClip() {
    const R = rng(8);
    const wolf = await makeWolf(renderer, 46); scene.add(wolf.root);
    const v = 4.8, yaw = -Math.PI / 2 + 0.38; // walking left, turned a little towards the camera
    const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), start = new THREE.Vector3(18, 0, -4);
    // the lit castle-city on its back (our kit), on a host that follows the spine
    const host = new THREE.Group(); scene.add(host);
    const deck = new THREE.Group(); host.add(deck);
    const b = wolf.back; // { w, len, y }
    host.userData = { unit: 1, joints: { body: deck }, params: { body: { w: b.w, len: b.len, h: 0.1, y: 0 }, shell: { kind: "none" }, back: {}, plan: "quadruped" } };
    deck.position.y = b.y - 0.05 - 0.05;
    const hh = wolf.size.y, ll = wolf.size.z, by = wolf.restSpine.y + b.y, bw = b.w;
    window.stats.wolf = { hh, ll, by, bw };
    const wshots = [
      { t0: 0, t1: 1.0, from: [52, 46, 250], to: [36, 42, 196], look0: [0, hh * 0.5, 0], fov0: 42 },
      { t0: 1.0, t1: 2.0, from: [8, hh * 0.58, ll * 0.5 + 52], to: [2, hh * 0.68, ll * 0.5 + 33], look0: [0, hh * 0.78, ll * 0.4], look1: [0, hh * 0.8, ll * 0.4], fov0: 50, fov1: 48 },
      { t0: 2.0, t1: 3.0, from: [128, hh * 0.52, 44], to: [108, hh * 0.62, -14], look0: [0, hh * 0.55, 6], look1: [0, hh * 0.58, -4], fov0: 50 },
      { t0: 3.0, t1: 5.01, from: [bw * 0.5 + 6, by + 4, -ll * 0.36], to: [bw * 0.5 + 22, by + 24, -ll * 0.18], look0: [-2, by + 22, -ll * 0.05], look1: [-6, by + 30, ll * 0.1], fov0: 62, fov1: 60 },
    ];
    addBackTown(host, { style: "castle", seed: 11, lit: true, density: 1.6 });
    // forest: the wolf wades through it
    const near = [], firNear = [], far = [], firFar = [];
    for (let i = 0; i < 6000; i++) {
      const x = -420 + R() * 840, z = -380 + R() * 760;
      const isFir = R() < 0.4, s = isFir ? (11 + R() * 9) / firH : (12 + R() * 8) / treeH;
      const m = placeMat(x, z, s, R() * 6.28, 0.08, R);
      const d = Math.hypot(x - 0, z - 30); if (Math.hypot(x + 40, z - 100) < 30) continue;
      (d < 110 ? (isFir ? firNear : near) : (isFir ? firFar : far)).push(m);
    }
    scene.add(instanced(treeParts, near), instanced(firParts, firNear), instanced(treeImp, far, { cast: false }), instanced(firImp, firFar, { cast: false }));
    scene.add(makeGround(1000, 260));
    // a rocky knoll in front with two of our people looking up at it
    const knoll = new THREE.Vector3(-40, 0, 96);
    scene.add(instanced(rockParts, [placeMat(knoll.x, knoll.z, 4, 0.4, 0, R), placeMat(knoll.x + 6, knoll.z - 3, 3, 2, 0, R)]));
    scene.add(makeGrass({ center: knoll, radius: 22, count: 30000, seed: 5 }));
    const people = [0, 1].map((i) => { const p = makePerson({ id: `w${i}`, seed: 50 + i, role: "adult" }); p.scale.multiplyScalar(1.15); scene.add(p); return p; });
    applyLight("night", { THREE, scene, renderer, set: { root: scene, rig: { shadow: { center: [0, 0, 0], half: 80, far: 360, map: 4096 }, fog: { night: ["#2a4a8a", 80, 700] }, sunScale: { night: 2.4 }, hemiScale: { night: 2.2 }, exposure: { night: 1.15 }, moonAt: [-0.5, 0.45, -0.75] } } });
    // a brighter "TV night" sky, like the target
    scene.traverse((o) => { if (o.material?.uniforms?.zen) { o.material.uniforms.zen.value.set("#0d2a78"); o.material.uniforms.hor.value.set("#3d6fc4"); } });
    return {
      update(t) {
        const pos = start.clone().addScaledVector(fwd, v * t);
        wolf.pose(t, pos, yaw);
        const sp = wolf.spineWorld(); host.position.copy(sp); host.rotation.set(0, yaw, 0); host.rotateX(wolf.pitch()); // ride the back
        people.forEach((p, i) => { const x = knoll.x - 3 + i * 2.2, z = knoll.z + 4 + i; p.position.set(x, groundH(x, z) + 0.1, z); p.rotation.y = Math.PI + 0.5; posePerson(p, i ? "point" : "look_up", t); });
        placeShot(camera, wshots, t, { position: wolf.root.position, yaw });
      },
    };
  }

  const post = makePost({ renderer, scene, camera, W, H, query: Q });
  post.setLight(CLIP === "turtle" ? "day" : "night");
  // a softer grade than the blocky look: realistic textures don't need the punch
  const grade = post.composer.passes[post.composer.passes.length - 1].uniforms;
  grade.sat.value = CLIP === "turtle" ? 1.18 : 1.1; grade.con.value = 1.08;
  ctx.update(0); post.render(); // warm shaders
  window.renderAt = (t) => { const t0 = performance.now(); ctx.update(t); post.render(); const gl = renderer.getContext(); gl.finish(); return { ms: performance.now() - t0, tris: renderer.info.render.triangles, calls: renderer.info.render.calls }; };
  window.frameData = (q = 0.9) => renderer.domElement.toDataURL("image/jpeg", q);
  window.ready = true;
}
main().catch((e) => { console.error(e); window.engineError = String(e?.stack ?? e); });
