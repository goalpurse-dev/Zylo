// Blocky Worlds EPIC (EPIC agent): a city on / inside a giant creature, with the buildSet return shape
// (sets/index.js): { root, spots { center, left, right, back, far, door, + horizon, head, tail }, indoor, camDir, views,
// bounds, rig, update(t), blockers, giant, sway(t) }.
//   buildCreatureWorld(spec, ctx)    spec: { creature: "turtle", view: "inside" | "on" | "outside", size: 120, seed,
//                                     water?: true (outside: a sea instead of fields) }  — or the BUILDER's validated
//                                     world spec ({ kind: "creature_world", creature: { species, scale, city } })
//   buildCreatureOutside(spec, ctx)  the creature walking (or swimming) across a landscape, its town on its back
// Layout (as every set): the camera stands at +z and looks down -z; the group at "center"; "far" deep in the scene.
//   inside:  a long cavern under the shell / ribs, a main street of blocky houses down the middle toward the mouth
//            (the door spot), skylight gaps in the shell with light shafts, hanging lanterns; the whole world sways
//            and tilts with the creature's walk cycle (update(t)).
//   on:      the town on the shell / back, the creature's head ahead (-z), the land far below sliding past, the sway.
//   outside: fields / sea, hills, trees; the giant walks across from left to right in front of the camera.
// The giant (page/kit/giants.js) is in set.giant; the engine may animate it per shot (shot.giants with id "world").
import { makeKit, glowList, mergeStatic } from "./util.js";
import { preloadEnv } from "../lighting.js";
import { attachDresser } from "./themes.js"; // SETS-V2
import { makeGiant, animateGiant, giantSurface } from "../kit/giants.js";
import { makeTown, townLayout } from "../kit/town.js";
import { gaitOf, prng, giantFootfalls } from "../../lib/epic.js";
// WORLD-LOOK 2026-11-06: the realistic forest world (page/kit/nature.js), the dense town on the creature
// (page/kit/backTown.js), the street-level places in that town (page/sets/backStreet.js), the foreground rule and the
// fog guard per frame (S.afterCamera, called by the engine once the camera is set)
import { makeNature, makeDust } from "../kit/nature.js";
import { plasticize, PLASTIC_LOOK, toyColour } from "../kit/plastic.js";
// PLASTIC-WORLD: a creature's inside palette in toy colours (clean saturated plates / skin, no olive / beige)
const toyPal = (a) => (PLASTIC_LOOK ? a.map((c) => toyColour(c, { minSat: 0.4, minVal: 0.4 })) : a);
import { walkable, groundUnder } from "../ground.js";
import { addBackTown, backSurface } from "../kit/backTown.js";
import { addPlaces } from "./backStreet.js";

const TAU = Math.PI * 2;

/** the creature world's own spec from either shape (ours, or the builder's creature_world spec) */
export function normCreatureSpec(spec = {}) {
  const c = spec.creature;
  const kind = typeof c === "string" ? c : c?.species ?? spec.kind_creature ?? (spec.kind && spec.kind !== "creature_world" ? spec.kind : "turtle");
  const view = spec.view ?? (c?.city === "inside" ? "inside" : c?.city === "on" ? "on" : "inside");
  const size = Number(spec.size ?? c?.scale) || 120;
  const bt = spec.backTown && typeof spec.backTown === "object" ? spec.backTown : null;
  return { kind, view, size: Math.max(30, Math.min(200, size)), seed: spec.seed ?? 11, water: spec.water ?? kind === "whale", lit: !!spec.lit, name: spec.name ?? `${view} the ${kind}`, town: spec.town?.style ? spec.town : { style: bt?.style ?? spec.townStyle ?? "town", landmarks: bt?.landmarks ?? null, density: bt?.density ?? 1 }, bible: spec.bible?.buildings ? spec.bible : spec.bible?.town ?? null, colors: spec.colors ?? spec.bible?.creature?.colors ?? null, rig: spec.rig ?? null, villain: !!(spec.villain || spec.role === "villain" || spec.role === "threat") }; // (re-normalising keeps the town + bible)
  // rig: "animal" asks the animal kit's realistic quadruped (page/kit/giants.js animalRigFor)
}

export async function buildCreatureWorld(rawSpec, ctx) {
  const spec = normCreatureSpec(rawSpec);
  await preloadEnv(ctx.THREE);
  // SETS-V2: every place on / in the creature dressed with its theme preset (page/sets/themes.js)
  const S = spec.view === "outside" ? await buildCreatureOutside(spec, ctx) : spec.view === "on" || spec.view === "street" ? await buildOn(spec, ctx) : await buildInside(spec, ctx);
  plasticize(S.root); // PLASTIC-WORLD 2026-11-10: the safety net (no photo map, plastic roughness, no beige) over the whole world
  return attachDresser(S, ctx);
}

// ------------------------------------------------------------------------------------------------ shared pieces
/**
 * WORLD-LOOK: what the camera must see clearly this frame: the focus person, the focus giant, or the world's creature.
 * -> { pos, height, radius } | null
 */
export function sightSubject(shot, S, where = {}, epic = null) {
  const f = String(shot?.focus ?? "");
  const box = (g) => { const b = new (S.THREE.Box3)().setFromObject(g); const c = b.getCenter(new (S.THREE.Vector3)()); return { pos: new (S.THREE.Vector3)(c.x, b.min.y, c.z), height: b.max.y - b.min.y, radius: Math.max(b.max.x - b.min.x, b.max.z - b.min.z) / 2 }; };
  // GATE 2026-11-09: a close shot of a person keeps the line to the FACE clear (the grass in front of Tobin's close-up)
  if (where[f]) return { pos: where[f].clone(), height: 1.7, radius: 0.6, close: ["closeup", "medium", "over_shoulder"].includes(shot?.camera) };
  if (f.startsWith("giant:") && epic?.GIANTS?.[f.slice(6)]?.visible) return box(epic.GIANTS[f.slice(6)]);
  if (S.giant && S.giant.visible !== false && S.giantView === "outside") return box(S.giant);
  const first = (shot?.actors ?? []).map((a) => where[a.id]).find(Boolean);
  return first ? { pos: first.clone(), height: 1.7, radius: 0.8 } : null;
}
/**
 * the fog guard: the subject is never washed out by haze. The fog starts at least 1.4 x the subject's distance (and
 * ends 3 x past its start), so a 120 m creature 300 m away keeps its colours against the ground (owner: "the wolf wide
 * shot was too blue and foggy, the wolf a blob")
 */
export function fogGuard(fog, dist, base) {
  if (!fog || !base) return null;
  const near = Math.max(base.near, dist * 1.4), far = Math.max(base.far, near * 3);
  fog.near = near; fog.far = far; return { near, far };
}
/**
 * WORLD-FIX-2 2026-11-07 (lead review: "street day / night: a plank between the camera and the person, half hidden";
 * "school day: a blank wall, the camera inside a building"): the street-level line-of-sight rule for people shots.
 * 1. the camera never stands inside a building of the town (S.solidAt, the plan's houses + landmarks): it steps toward
 *    the subject until it is out;
 * 2. nothing of the set between the lens and the subject's legs / chest / face: a place prop (deck rail, stair rail,
 *    rooftop plank: userData.placeProp) is hidden for the shot, anything else (a house) moves the camera in front of it.
 * Decided once per shot (rays are not cheap in a town of instanced houses), applied every frame; the lens widens to keep
 * the framing when the camera moved in.
 */
const losMemo = new Map();
function streetSight(S, THREE, camera, shot, subj) {
  camera.updateMatrixWorld();
  const c0 = camera.getWorldPosition(new THREE.Vector3());
  // keyed by the shot + where the camera and the subject stand (to 0.5 m): the engine may hand a fresh shot object per frame
  const key = `${shot.start}|${shot.place ?? ""}|${[...c0.toArray(), ...subj.pos.toArray()].map((v) => Math.round(v * 2)).join(",")}`;
  if (S._losShot !== key) { for (const o of S._losHidden ?? []) o.visible = true; S._losHidden = []; S._losShot = key; }
  const target = (k) => subj.pos.clone().add(new THREE.Vector3(0, subj.height * k, 0));
  let memo = losMemo.get(key);
  if (!memo) {
    memo = { k: 0, hide: [] };
    const c = c0.clone(), mid = target(0.6);
    // 1. inside a building: step toward the subject
    for (let i = 0; i < 40 && S.solidAt?.(c); i++) c.lerp(mid, 0.06);
    // 2. the rays
    const vis = (o) => { for (let p = o; p; p = p.parent) if (p.visible === false) return false; return true; };
    for (let pass = 0; pass < 4; pass++) {
      let worst = null;
      for (const kk of [0.3, 0.6, 0.92]) {
        const q = target(kk), dir = q.clone().sub(c), L = dir.length(); dir.normalize();
        const hit = new THREE.Raycaster(c, dir, 0.05, Math.max(0.1, L - 0.45)).intersectObject(S.root, true).find((h) => h.object.isMesh && !h.object.isPoints && vis(h.object) && !memo.hide.includes(h.object) && h.object.material?.visible !== false && !h.object.material?.transparent);
        if (hit && (!worst || hit.distance < worst.hit.distance)) worst = { hit, L, dir };
      }
      if (!worst) break;
      const o = worst.hit.object;
      if (o.userData.placeProp) { memo.hide.push(o); continue; }
      if (worst.hit.distance > worst.L * 0.8) break; // right at the subject (a wall behind a hand): leave it
      c.addScaledVector(worst.dir, worst.hit.distance + 0.5);
    }
    // 2b. PLANNER-FIX 2026-11-07 (turtle lines 1, 13, 27, 42: big brown shell blocks / a wall filling the frame's edge):
    // nothing of the set within ~3 m of the lens anywhere in the frame (not only on the line to the subject): a place
    // prop is hidden, anything else (shell plates, a house corner, the ground) moves the camera in toward the subject
    camera.updateMatrixWorld();
    const NDC = [[-0.85, -0.85], [0, -0.85], [0.85, -0.85], [-0.85, -0.35], [0.85, -0.35], [-0.85, 0.35], [0.85, 0.35], [0, -0.5]];
    const dirs = NDC.map(([x, y]) => new THREE.Vector3(x, y, 0.5).unproject(camera).sub(c0).normalize());
    for (let pass = 0; pass < 4; pass++) {
      const toMid = mid.clone().sub(c), dm = toMid.length();
      if (dm < 1.2) break;
      const near = Math.min(5.5, dm * 0.5);
      let closest = null;
      for (const d of dirs) {
        const hit = new THREE.Raycaster(c, d, 0.02, near).intersectObject(S.root, true).find((h) => h.object.isMesh && !h.object.isPoints && vis(h.object) && !memo.hide.includes(h.object) && h.object.material?.visible !== false && !h.object.material?.transparent);
        if (hit && (!closest || hit.distance < closest.distance)) closest = hit;
      }
      if (!closest) break;
      if (closest.object.userData.placeProp) { memo.hide.push(closest.object); continue; }
      c.addScaledVector(toMid.normalize(), Math.min(dm - 1.2, near - closest.distance + 0.6));
    }
    const d0 = c0.distanceTo(mid);
    memo.k = d0 > 1e-3 ? Math.min(0.75, 1 - c.distanceTo(mid) / d0) : 0;
    // 3. never skimming the ground: on a slope (the dome near its rim) the uphill ground stood a hand under the lens and
    // filled the frame (school day: a brown slab); the camera rises to 1.5 m over the ground under it and re-aims
    const cl = c0.clone().lerp(mid, memo.k), gy = S.surface?.(cl.x, cl.z);
    memo.up = gy != null && cl.y < gy + 1.5 ? gy + 1.5 - cl.y : 0;
    if (losMemo.size > 200) losMemo.clear();
    losMemo.set(key, memo);
  }
  for (const o of memo.hide) if (o.visible) { o.visible = false; S._losHidden.push(o); }
  if (memo.up > 0.05) { camera.position.y += memo.up; camera.lookAt(target(0.5)); camera.updateMatrixWorld(); }
  if (memo.k > 0.01) {
    const mid = target(0.6), L0 = c0.distanceTo(mid);
    camera.position.lerp(mid, memo.k); // the camera is a child of the scene: world = local
    const L1 = camera.position.distanceTo(mid);
    // capped at 60 (PLANNER-FIX 2026-11-07: at 78 the wide lens pulled the shell plates into the frame corners, turtle line 1)
    camera.fov = Math.min(Math.max(60, camera.fov), 2 * Math.atan(Math.tan((camera.fov * Math.PI) / 360) * L0 / Math.max(L1, 0.3)) * 180 / Math.PI);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
}
function lookHooks(S, ctx, nature) {
  let lastFog = null, base = null, baseExp = null, lastExp = null;
  S.THREE = ctx.THREE;
  S.afterCamera = (camera, shot, where, epic) => {
    const subj = sightSubject(shot, S, where, epic);
    nature?.sight(camera, subj);
    if (S.places && subj && (shot?.actors ?? []).length) streetSight(S, ctx.THREE, camera, shot, subj);
    const fog = ctx.scene?.fog;
    if (fog !== lastFog) { lastFog = fog; base = fog ? { near: fog.near, far: fog.far } : null; }
    if (fog && base && subj) { camera.updateMatrixWorld(); fogGuard(fog, camera.getWorldPosition(new ctx.THREE.Vector3()).distanceTo(subj.pos), base); }
    // WORLD-FIX 2026-11-07: the interiors (room, classroom) under the outdoor sun rig were blown out: a lower exposure there
    const rr = ctx.renderer; if (rr) { if (rr.toneMappingExposure !== lastExp) baseExp = rr.toneMappingExposure; lastExp = baseExp * (S.indoor ? 0.6 : S.places ? 0.84 : 1); rr.toneMappingExposure = lastExp; } // WORLD-FIX-2: street level a touch lower (owner: washed out)
    return subj;
  };
}
/** fields, hills, trees and far mountains (or the sea) around the origin; returns the group (moves when walking) */
function landscape(K, ctx, { water = false, seed = 3, radius = 1600, treeCount = 260, clear = null } = {}) {
  const { THREE } = ctx;
  const g = new THREE.Group(); g.name = "landscape";
  const R = prng(seed * 7 + 1);
  if (water) {
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(radius * 3, radius * 3), new THREE.MeshStandardMaterial({ color: "#2f7fb8", roughness: 0.18, metalness: 0.1 }));
    sea.rotation.x = -Math.PI / 2; sea.receiveShadow = true; g.add(sea);
    // a sandy shore with grass far behind (so the horizon is not empty)
    const sand = new THREE.Mesh(new THREE.BoxGeometry(radius * 3, 2, 260), K.pbr("coast_sand_01", { repeat: [120, 10], tint: "#f6e6c0" })); sand.position.set(0, -0.6, -radius * 0.55); sand.receiveShadow = true; g.add(sand);
  } else {
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(radius * 3, radius * 3), K.pbr("leafy_grass", { repeat: [radius / 6, radius / 6], tint: "#86c856", normal: 0.6 }));
    grass.rotation.x = -Math.PI / 2; grass.receiveShadow = true; g.add(grass);
    // a dirt road across (the giant's path) for scale
    const road = new THREE.Mesh(new THREE.PlaneGeometry(radius * 3, 14), K.pbr("brown_mud_dry", { repeat: [radius / 4, 2], tint: "#e0c9a0" }));
    road.rotation.x = -Math.PI / 2; road.position.set(0, 0.03, -10); road.receiveShadow = true; g.add(road);
  }
  // rolling hills (big soft blocks) and far mountains (cones) in the haze
  const hillM = new THREE.MeshStandardMaterial({ color: water ? "#6aae48" : "#5f9e3a", roughness: 1 });
  for (let k = 0; k < 26; k++) {
    const a = R() * TAU, d = radius * (0.35 + R() * 0.45), s = 60 + R() * 120;
    if (Math.abs(Math.sin(a)) > 0.85 && Math.cos(a) > 0 && d < radius * 0.5) continue;
    const h = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10, 0, TAU, 0, Math.PI / 2), hillM); h.scale.set(s * 1.6, s * 0.35, s); h.position.set(Math.sin(a) * d, -1, -Math.abs(Math.cos(a)) * d - 120); h.receiveShadow = true; g.add(h);
  }
  const mtnM = new THREE.MeshStandardMaterial({ color: "#6c8bb0", roughness: 1 }), snowM = new THREE.MeshStandardMaterial({ color: "#f4f8ff", roughness: 0.9 });
  for (let k = 0; k < 14; k++) {
    const x = (k - 6.5) * radius * 0.28 + (R() - 0.5) * 120, z = -radius * (0.95 + R() * 0.3), h = 260 + R() * 360;
    const m = new THREE.Mesh(new THREE.ConeGeometry(h * 0.9, h, 5), mtnM); m.position.set(x, h / 2 - 10, z); m.rotation.y = R(); g.add(m);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(h * 0.27, h * 0.3, 5), snowM); cap.position.set(x, h * 0.85 - 10, z); cap.rotation.y = m.rotation.y; g.add(cap);
  }
  // trees: instanced blocky trees, big ones (~10 m) so they read against a 100 m giant
  if (!water || true) {
    const trees = [];
    for (let k = 0; k < treeCount; k++) {
      const x = (R() - 0.5) * radius * 1.4, z = -R() * radius * 0.9 + 60;
      if (clear && clear(x, z)) continue;
      if (water && z > -radius * 0.5) continue;
      trees.push({ x, y: 0, z, s: 1.6 + R() * 1.8 });
    }
    g.add(makeTown([], { trees, seed }));
  }
  return g;
}

/** a canvas texture of shell plates (dark seams) for the inside of a shell */
function plateTexture(THREE, base, seam, seed) {
  const c = document.createElement("canvas"); c.width = c.height = 512; const p = c.getContext("2d");
  const R = prng(seed);
  p.fillStyle = seam; p.fillRect(0, 0, 512, 512);
  const cell = 128;
  for (let y = -1; y < 5; y++) for (let x = -1; x < 5; x++) {
    const ox = x * cell + (y % 2 ? cell / 2 : 0), oy = y * cell * 0.86;
    const col = new THREE.Color(base).multiplyScalar(0.85 + R() * 0.3);
    p.fillStyle = `#${col.getHexString()}`;
    p.beginPath();
    for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU + Math.PI / 6; p.lineTo(ox + Math.cos(a) * cell * 0.52, oy + Math.sin(a) * cell * 0.52); }
    p.closePath(); p.fill();
    p.strokeStyle = "rgba(255,255,255,0.10)"; p.lineWidth = 5; p.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
/** a soft light shaft: an open cone, additive, bright at the top fading to the floor */
function shaftMat(THREE, color) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { col: { value: new THREE.Color(color) }, k: { value: 0.2 } },
    vertexShader: "varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = uv.y; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }",
    fragmentShader: "uniform vec3 col; uniform float k; varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float edge = pow(clamp(abs(dot(vN, vV)), 0.0, 1.0), 1.5); float a = k * edge * pow(clamp(vY, 0.0, 1.0), 1.6); gl_FragColor = vec4(col * a, a); }",
  });
}
/** the walk sway of a creature: { roll, pitch, bob } at time t (pure, from its gait) */
export function creatureSway(kind, size, t, amount = 1) {
  const g = gaitOf(kind, kind === "whale" ? "swim" : "walk", size), c = t * g.cadence * TAU;
  if (kind === "turtle") amount *= 0.7; // WORLD-FIX 2026-11-07: the owner asked for a ~30 % calmer turtle
  return { roll: 0.022 * amount * Math.sin(c), pitch: 0.008 * amount * Math.sin(c * 2 + 0.6), bob: 0.25 * amount * Math.abs(Math.sin(c)) };
}

// ------------------------------------------------------------------------------------------------ INSIDE
function buildInside(spec0, ctx) {
  const { THREE } = ctx;
  // the inside holds a whole town: its cavern is never smaller than a 110 m creature's (turtle run 1620fc3e: a 30 m
  // turtle made a 6 x 4 m cavern; houses poked through the shell, the camera stood outside it in the fog)
  const spec = { ...spec0, size: Math.max(110, spec0.size) };
  const root = new THREE.Group(); root.name = `creature:inside:${spec.kind}`;
  const world = new THREE.Group(); root.add(world); // sways
  const K = makeKit(ctx, world), { solid, pbr } = K;
  const R = prng(spec.seed * 13 + 5);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const glow = glowList();
  const haze = (k, toward = "#a8c4c8") /* SETS-V2: was #e8d8a0 (beige) */ => `#${new THREE.Color(pal[5]).lerp(new THREE.Color(toward), k).getHexString()}`;
  // the cavern: half-ellipsoid, length L along z, half-width A, height Hh (a big turtle: ~100 x 64 x 30 m)
  // 2026-11-06 (turtle run 7b4c0d8b): the old cavern (half-width 0.3 x size, 0.24 x size high = 36 x 29 m for a 120 m
  // turtle) put the shell far above 8 m houses: every kid-height medium / closeup shot showed only houses and a sandy
  // floor, i.e. "a normal street". Now the shell is low and close (it shows above the houses in every framing), the
  // houses are low cottages, the floor is the creature's own scaly skin and the haze is the shell's colour, not sky.
  const L = spec.size * 0.85, A = spec.size * 0.19, Hh = spec.size * 0.13, Zc = -L * 0.38;
  // [shell plate, plate seam, bone, skin floor, skin seam, cavern haze]
  const pal = toyPal({ turtle: ["#5b8a2e", "#1f3314", "#cfd8b8", "#6f8a4a", "#4a5a30", "#3e5a4a"] /* SETS-V2: greener floor + cooler haze (#3 "inside too beige") */, whale: ["#c96b7a", "#5a2430", "#f0c0b0", "#d98a8f", "#8a3c48", "#6a3038"], elephant: ["#8a7a8a", "#3a2f3a", "#e0c8b8", "#9a8e8e", "#5a4e50", "#4a4048"], snail: ["#b0632e", "#4a2410", "#f0d8a8", "#c69a6a", "#7a5030", "#5a3a20"] }[spec.kind] ?? ["#7a6a4a", "#2a2018", "#e8d6a0", "#a08a68", "#5e4c34", "#4a3e2c"]);
  // the shell: plates on the inside, a back-side half ellipsoid
  const tex = plateTexture(THREE, pal[0], pal[1], spec.seed); tex.repeat.set(10, 4);
  const shellM = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75, side: THREE.BackSide, color: "#ffffff" });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 24, 0, TAU, 0, Math.PI / 2), shellM);
  dome.scale.set(A, Hh, L / 2); dome.position.set(0, 0, Zc); dome.receiveShadow = true; world.add(dome);
  // ribs: blocky bone arches every ~10 m
  const ribM = solid(pal[2], { roughness: 0.6 });
  const nRib = Math.floor(L / 11), ribs = [];
  for (let k = 0; k <= nRib; k++) {
    const z = Zc + L / 2 - 6 - k * (L - 12) / nRib, q = 1 - ((z - Zc) / (L / 2)) ** 2; if (q <= 0.05) continue;
    const a = A * Math.sqrt(q) * 0.985, h = Hh * Math.sqrt(q) * 0.985;
    for (let s = 0; s <= 18; s++) {
      const th = (s / 18) * Math.PI, x = Math.cos(th) * a, y = Math.sin(th) * h;
      const m = K.rbx(2.2, 1.6, 1.8, 0.3, ribM, { x, y, z, rz: th - Math.PI / 2 });
      m.lookAt(0, 0, z); m.rotateY(Math.PI / 2);
      m.userData.static = false; ribs.push(m); // GATE 2026-11-09: never merged, so one near the lens can hide (S.afterCamera)
    }
  }
  // the floor: the belly (warm sand-coloured), the main street (pavement) down the middle to the mouth
  // no normal map on the big belly floor: its derivative-based normal gave a NaN pixel under a camera shake (2026-11-05)
  // the belly floor: the creature's own skin (big scales), a worn plank road down the middle (no sand, no pavement)
  const skin = plateTexture(THREE, pal[3], pal[4], spec.seed + 3); skin.repeat.set(A / 4, L / 4);
  const skinM = new THREE.MeshStandardMaterial({ map: skin, roughness: 0.9, color: "#ffffff" });
  K.plane(A * 2.2, L * 1.1, skinM, { y: 0, z: Zc });
  K.plane(7, L * 0.95, pbr("brown_mud_dry", { repeat: [2, L / 3], tint: "#c9a477" }), { y: 0.02, z: Zc + 2 });
  for (const sx of [-1, 1]) K.bx(0.4, 0.22, L * 0.95, solid(pal[4], { roughness: 0.9 }), { x: sx * 3.6, y: 0.1, z: Zc + 2 });
  // fleshy ridges along the walls (where the shell meets the belly): the floor visibly curves up into the shell
  const ridgeM = solid(pal[4], { roughness: 0.85 });
  for (const sx of [-1, 1]) for (let k = 0; k < 14; k++) {
    const z = Zc + L * 0.46 - k * (L * 0.92) / 13, q = 1 - ((z - Zc) / (L / 2)) ** 2; if (q <= 0.08) continue;
    const x = sx * A * Math.sqrt(q) * 0.9;
    K.rbx(6, 3 + (k % 3), 9, 1.2, ridgeM, { x, y: 1, z });
  }
  // the town: houses facing the street on both sides (instanced; textured plaster), trees and lamps
  const inside = (x, z) => { const q = 1 - (x / (A * 0.86)) ** 2 - ((z - Zc) / (L / 2 * 0.9)) ** 2; return q > 0.15 ? 0 : null; };
  const houses = townLayout({ surface: inside, region: { x0: -A, x1: A, z0: Zc - L / 2, z1: 14 }, count: 70, seed: spec.seed, street: { axis: "z", half: 4.2 }, size: [5, 7], tall: [3.2, 5], minGap: 1.0 });
  // keep the camera end (z > 8) and the mouth clear
  const keep = houses.filter((h) => h.z < 6 || Math.abs(h.x) > 14);
  const trees = [], lamps = [];
  for (let z = 8; z > Zc - L / 2 + 14; z -= 13) { lamps.push({ x: -4.9, y: 0, z }, { x: 4.9, y: 0, z: z - 6.5 }); }
  for (let k = 0; k < 30; k++) { const x = (R() - 0.5) * A * 1.5, z = Zc + (R() - 0.5) * L * 0.8; if (Math.abs(x) < 7 || inside(x, z) == null) continue; if (keep.some((h) => Math.hypot(h.x - x, h.z - z) < Math.hypot(h.w, h.d) / 2 + 2)) continue; trees.push({ x, y: 0, z, s: 0.8 + R() * 0.4 }); }
  const town = makeTown(keep, { seed: spec.seed, tex: ctx.tex, trees, lamps, lit: false }); world.add(town);
  // skylights: gaps in the shell (bright glowing ovals) + light shafts down to the street + warm spot lights
  const sky = [], shafts = [], spots = [];
  const skyM = new THREE.MeshStandardMaterial({ color: "#fff6dc", emissive: "#fff2c8", emissiveIntensity: 3, side: THREE.DoubleSide, fog: false });
  const sM = shaftMat(THREE, "#ffe7b0");
  const holes = [[-0.25, 0.32], [0.3, 0.1], [-0.05, -0.25], [0.28, -0.5], [-0.3, -0.62]];
  for (const [fx, fz] of holes) {
    const z = Zc + fz * L, x = fx * A, q = 1 - (x / A) ** 2 - ((z - Zc) / (L / 2)) ** 2; if (q <= 0.1) continue;
    const y = Hh * Math.sqrt(q) * 0.99;
    const hole = new THREE.Mesh(new THREE.CircleGeometry(1, 6), skyM); hole.scale.set(4.5, 3.2, 1); hole.position.set(x, y, z); hole.lookAt(x * 0.2, 0, z); world.add(hole); sky.push(hole);
    // the shaft: a cone from the hole to the floor, slanted a little (the sun is not straight up)
    const tx = x * 0.55 + 3, tz = z + 6, len = Math.hypot(x - tx, y, z - tz);
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 7.5, len, 20, 1, true), sM);
    cone.position.set((x + tx) / 2, y / 2, (z + tz) / 2); cone.lookAt(tx, 0, tz); cone.rotateX(Math.PI / 2); cone.rotateX(Math.PI); world.add(cone); shafts.push(cone);
    spots.push({ from: V(x, y - 1, z), to: V(tx, 0, tz) });
  }
  // the mouth: a bright opening at the far end (the door spot), the outside glowing through
  const mouthZ = Zc - L / 2 + 1.5;
  const mouth = new THREE.Mesh(new THREE.CircleGeometry(1, 24, 0, Math.PI), new THREE.MeshBasicMaterial({ color: "#fff4d8", fog: false }));
  mouth.scale.set(A * 0.42, Hh * 0.55, 1); mouth.position.set(0, 0.05, mouthZ); world.add(mouth);
  const mouthGlow = new THREE.Mesh(new THREE.CircleGeometry(1, 24, 0, Math.PI), new THREE.MeshBasicMaterial({ color: "#ffd890", transparent: true, opacity: 0.35, fog: false, depthWrite: false }));
  mouthGlow.scale.set(A * 0.55, Hh * 0.7, 1); mouthGlow.position.set(0, 0.05, mouthZ + 0.6); world.add(mouthGlow);
  // hanging lanterns on chains from the ribs (they swing against the sway)
  const lanterns = [];
  const lanternM = new THREE.MeshStandardMaterial({ color: "#ffe9b0", emissive: "#ffb347", emissiveIntensity: 2.2, roughness: 0.4 });
  glow.add(lanternM, { day: 1.4, night: 3.5, warm: 2.2 });
  for (let k = 0; k < 7; k++) {
    const z = 6 - k * 11, x = (k % 2 ? 1 : -1) * 2.2, q = 1 - (x / A) ** 2 - ((z - Zc) / (L / 2)) ** 2; if (q <= 0.1) continue;
    const top = Hh * Math.sqrt(q) * 0.97, hang = Math.min(top - 7, 10 + R() * 6);
    const p = new THREE.Group(); p.position.set(x, top, z); world.add(p);
    const chain = new THREE.Mesh(new THREE.BoxGeometry(0.08, hang, 0.08), solid("#3a3a40")); chain.position.y = -hang / 2; p.add(chain);
    const lan = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.2, 0.9), lanternM); lan.position.y = -hang - 0.6; p.add(lan);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.25, 1.1), solid("#3a3a40")); cap.position.y = -hang + 0.1; p.add(cap);
    lanterns.push(p);
  }
  // dust motes in the light (points)
  const nd = 500, pos = new Float32Array(nd * 3);
  for (let i = 0; i < nd; i++) pos.set([(R() - 0.5) * A * 1.4, R() * Hh * 0.8, Zc + (R() - 0.5) * L * 0.8], i * 3);
  const dg = new THREE.BufferGeometry(); dg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: "#fff1c8", size: 2.5, sizeAttenuation: false, transparent: true, opacity: 0.6, depthWrite: false })); world.add(dust);

  const S = {
    root, indoor: false, giantView: "inside", creature: spec.kind,
    spots: { center: V(0, 0, 0), left: V(-2.4, 0, 0.4), right: V(2.4, 0, 0.4), back: V(0, 0, -4.5), far: V(0, 0, -36), door: V(0, 0, mouthZ + 8), horizon: V(0, 0, mouthZ), head: V(0, 0, mouthZ), tail: V(0, 0, 14) },
    camDir: V(0, 0, 1), views: {},
    bounds: [new THREE.Box3(V(-A * 0.7, 0.3, Zc - L * 0.45), V(A * 0.7, Hh * 0.55, 24))],
    blockers: [],
    rig: {
      enclosed: true,
      shadow: { center: [0, 0, -18], half: 46, far: 260, map: 4096 },
      sunDir: { day: [12, 60, -18], night: [-12, 60, -18], warm: [20, 40, -30] },
      sunScale: { day: 0.6, night: 0.15, warm: 0.5 }, envScale: { all: 0 },
      hemi: PLASTIC_LOOK ? { day: ["#dce8ff", "#5aa04a", 0.9], night: ["#4a6ae0", "#1a2458", 0.6], warm: ["#ffe0c0", "#5a6a4a", 0.6] } : { day: ["#dce8ff", "#4a5a30", 0.8], night: ["#3a5090", "#120c08", 0.4], warm: ["#ffd8b0", "#4a3a30", 0.5] } /* SETS-V2: cool sky fill (was beige-orange) */,
      fog: { day: [haze(0.4), 45, L * 1.6], night: ["#141a18", 25, L * 1.0], warm: [haze(0.25, "#ffb070"), 45, L * 1.5] },
      exposure: { day: 0.8, night: 1.1, warm: 0.74 }, // SETS-V2: night readable, the warm ending not blown
      practicals: (mode) => {
        const out = [];
        for (const s of spots.slice(0, 3)) { const l = new THREE.SpotLight(mode === "night" ? "#9fb6ff" : "#fff4e4", mode === "night" ? 160 : 450, 80, 0.5, 0.7, 1.4); /* GATE 2026-11-09: was 300 / 900 (#3: the shell street floor washed white) */ l.position.copy(s.from); l.target.position.copy(s.to); l.castShadow = false; out.push(l); }
        const ml = new THREE.SpotLight("#ffe0a8", mode === "night" ? 160 : 700, L, 0.55, 0.8, 1.2); /* GATE 2026-11-09: was 300 / 1500 */ ml.position.set(0, Hh * 0.3, mouthZ - 2); ml.target.position.set(0, 0, 0); out.push(ml);
        const warm = new THREE.PointLight("#ffb860", mode === "night" ? 45 : 40, 40, 1.6); /* GATE 2026-11-09: was 140 / 60 (#3: white faces in the shell street at night) */ warm.position.set(0, 6, -2); out.push(warm);
        return out;
      },
      onLight: (mode) => { glow.apply(mode); town.userData.setLit(mode !== "day", mode === "night" ? 1 : 0.6); skyM.emissiveIntensity = mode === "night" ? 0.6 : 3; skyM.emissive.set(mode === "night" ? "#8fa8ff" : mode === "warm" ? "#ffe0c0" : "#eef4ff"); sM.uniforms.k.value = mode === "night" ? 0.06 : 0.2; dust.material.opacity = mode === "night" ? 0.15 : 0.3; mouth.material.color.set(mode === "night" ? "#30406a" : mode === "warm" ? "#ffb060" : "#ffe9c0"); },
    },
    sway(t) { return creatureSway(spec.kind, spec.size, t); },
    update(t) {
      const s = creatureSway(spec.kind, spec.size, t);
      world.rotation.set(s.pitch, 0, s.roll); world.position.y = s.bob;
      for (const [i, l] of lanterns.entries()) { l.rotation.z = -s.roll * 3 + 0.02 * Math.sin(t * 1.3 + i); l.rotation.x = -s.pitch * 3; }
      dust.rotation.y = t * 0.004;
    },
    town, giant: null, mount: world, groundY: 0,
    actorMount: () => world, // ATTACH 2026-11-07: people + scene objects sway with the cavern floor (they stood still while it rocked)
    // GATE 2026-11-09 (#3 establish shots in the shell: a bone arch filled the foreground): rib blocks within 7 m of the
    // lens are hidden for the frame
    afterCamera(camera) { camera.updateMatrixWorld(); const c = camera.getWorldPosition(new THREE.Vector3()), p = new THREE.Vector3(); for (const r of ribs) r.visible = r.getWorldPosition(p).distanceTo(c) > 14; return null; },
  };
  mergeStatic(THREE, world);
  return S;
}

// ------------------------------------------------------------------------------------------------ ON (the town on its back)
async function buildOn(spec, ctx) {
  const { THREE } = ctx;
  const root = new THREE.Group(); root.name = `creature:${spec.view}:${spec.kind}`;
  const world = new THREE.Group(); root.add(world);
  const K = makeKit(ctx, world);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const giant = makeGiant({ kind: spec.kind, size: spec.size, town: false, seed: spec.seed, colors: spec.colors ?? undefined, rig: spec.rig ?? undefined, villain: spec.villain });
  giant.rotation.y = Math.PI; // head toward -z (ahead of the camera)
  // WORLD-LOOK: the SAME dense town as every other view of this creature (page/kit/backTown.js), on its own surface
  const town = addBackTown(giant, { style: spec.town.style, landmarks: spec.town.landmarks ?? undefined, density: spec.town.density, seed: spec.seed, tex: ctx.tex, bible: spec.bible });
  const plan = town.userData.plan;
  const surf0 = backSurface(giant).surf;
  const surf = (x, z) => surf0(-x, -z); // rotated 180 degrees
  // the centre spot: on the main street (x 0), a bit toward the tail (the head is ahead)
  const reg = plan.region;
  const zc = -(reg.z0 + reg.z1) / 2 + (reg.z1 - reg.z0) * 0.1;
  const y0 = surf(0, zc) ?? surf0(0, 0) ?? spec.size * 0.4;
  giant.position.set(0, -y0, -zc);
  world.add(giant);
  // ATTACH 2026-11-07 (owner: "FLOATING PEOPLE: everything on a creature must be attached to it and move with it"):
  // the CARRIER: a group whose transform is, every frame, where the town is now relative to where it was at rest (its
  // holder on the creature's back joint). Everything placed in rest coordinates (the spots, people, scene objects,
  // crowds, the street-level places' decks / stairs / rooftop) goes in it and rides the walk exactly: the world's sway,
  // the body's bob, pitch and roll. (People used to stand in the scene at fixed heights while the town rocked under them.)
  const carrier = new THREE.Group(); carrier.name = "creatureCarrier"; carrier.matrixAutoUpdate = false; root.add(carrier);
  const holder = town.parent, _rootInv = new THREE.Matrix4();
  root.updateMatrixWorld(true);
  const holderRestInv = new THREE.Matrix4().copy(root.matrixWorld).invert().multiply(holder.matrixWorld).invert();
  const syncCarrier = () => { root.updateMatrixWorld(true); _rootInv.copy(root.matrixWorld).invert(); carrier.matrix.copy(_rootInv).multiply(holder.matrixWorld).multiply(holderRestInv); carrier.matrixWorldNeedsUpdate = true; carrier.updateMatrixWorld(true); };
  const flatEnough = (x, z) => { const y = surf(x, z + zc); return y == null ? null : y - y0; };
  // the land far below, sliding past as the creature walks (the landscape moves +z)
  const nature = spec.water ? null : await makeNature(ctx, { seed: spec.seed, center: { x: 0, z: -200 }, flatR: 400, nearR: 260, grass: 0, ferns: 600, underR: 200, clear: (x, z) => Math.abs(x) < spec.size * 0.5 && z > -spec.size * 1.2 && z < spec.size * 0.6 });
  const land = nature ? nature.group : landscape(K, ctx, { water: spec.water, seed: spec.seed, treeCount: 320 });
  land.position.y = -y0;
  root.add(land);
  const gait = gaitOf(spec.kind, spec.water ? "swim" : "walk", spec.size);
  // ATTACH: the walkable surface (carrier = rest coordinates) under (x, z): the street blocks where there is a street,
  // else the creature's own back (never a roof or a wall top). Rays down onto those meshes, memoised on a 0.5 m grid,
  // bilinear between the grid points; pose-independent (the meshes ride the carrier), so the same every frame
  // ATTACH-2: only what rides the town's own joint is ground (a mesh on the head, a wing, a leg or the tail moves under a
  // memoised point: the eagle's crowd stood on its wings, 1-4 m in the air a frame later); a back with a deck
  // (backTown.js backDeckMesh: a bird, a frog) stands on the deck and the streets only, never on the lumpy body
  const townJ = giant.userData.townJoint ?? giant.userData.joints?.body, jointSet = new Set(Object.values(giant.userData.joints ?? {}).flat().filter((j) => j?.isObject3D));
  const ridesTownJoint = (o) => { for (let p = o.parent; p && p !== giant; p = p.parent) if (jointSet.has(p)) return p === townJ; return false; };
  const groundMeshes = [], hasDeck = !!town.userData.deck;
  giant.traverse((o) => { if (!o.isMesh) return; for (let p = o; p && p !== giant; p = p.parent) if (p === town.parent) { if (/^(mainStreet|sideStreets|backStreet|porches|backDeck)$/.test(o.name)) groundMeshes.push(o); return; } if (!hasDeck && walkable(o) && ridesTownJoint(o)) groundMeshes.push(o); }); // the same rule as the check (page/ground.js): no cut-out feathers / glass
  const memo = new Map(), rc = new THREE.Raycaster(), GS = 0.5, _n = new THREE.Vector3(), _m = new THREE.Matrix4();
  const NONE = { y: null, key: null, ny: 0, prop: false };
  // one grid point: { y (carrier = rest coordinates), key (which surface: mesh + instance), ny (its normal's up), prop }
  const rayP = (x, z) => {
    const key = x * 100003 + z; if (memo.has(key)) return memo.get(key);
    const top = (flatEnough(x, z) ?? 0) + 8;
    const o = carrier.localToWorld(V(x, top, z)), d = V(0, -1, 0).transformDirection(carrier.matrixWorld);
    rc.set(o, d); rc.far = 20;
    let out = NONE;
    for (const h of rc.intersectObjects(groundMeshes, false)) {
      let hidden = false; for (let p = h.object; p && p !== root; p = p.parent) if (p.visible === false) { hidden = true; break; }
      if (hidden || (h.object.userData.placeProp && !walkable(h.object))) continue;
      let ny = 1;
      if (h.face) { _n.copy(h.face.normal); if (h.instanceId != null) { h.object.getMatrixAt(h.instanceId, _m); _n.transformDirection(_m); } _n.transformDirection(h.object.matrixWorld); ny = _n.dot(V(0, 1, 0).transformDirection(carrier.matrixWorld)); }
      if (ny < 0.35) continue; // a wall's side / a kerb face seen edge-on: not ground (the check's rule)
      out = { y: carrier.worldToLocal(h.point.clone()).y, key: `${h.object.id}:${h.instanceId ?? ""}`, ny, prop: !!h.object.userData.placeProp };
      break;
    }
    memo.set(key, out); return out;
  };
  const rayY = (x, z) => rayP(x, z).y;
  // the check's own view of a crowd point (page/ground.js groundUnder: every walkable mesh of the creature and the
  // places, the surface nearest the feet within 0.9 m above): the crowd character stands only where that is the same
  // ground (no wall walkway, crate, step or tree root over / beside it). Memoised on a 0.25 m grid (rest coordinates)
  const clearMemo = new Map();
  const clearAt = (x0, z0) => {
    const xk = Math.round(x0 * 4) / 4, zk = Math.round(z0 * 4) / 4, key = `${xk},${zk}`; if (clearMemo.has(key)) return clearMemo.get(key);
    const y = walkY(xk, zk, false);
    const hit = y == null ? null : groundUnder(THREE, [giant, carrier], carrier.localToWorld(V(xk, y, zk)), { above: 1.0, below: 0.5, maxUp: 0.9 });
    const ok = !!hit && Math.abs(carrier.worldToLocal(hit.point.clone()).y - y) < 0.025;
    clearMemo.set(key, ok); return ok;
  };
  // strict (crowds): only where the back is really there at all four grid points, one surface (no step, no prop), flat
  // enough to stand a crowd on, and clear for the check; else null (the character is left out, never left floating)
  const walkY = (x, z, strict = false) => {
    const i = Math.floor(x / GS), k = Math.floor(z / GS), fx = x / GS - i, fz = z / GS - k;
    const P4 = [rayP(i * GS, k * GS), rayP((i + 1) * GS, k * GS), rayP(i * GS, (k + 1) * GS), rayP((i + 1) * GS, (k + 1) * GS)], c = P4.map((p) => p.y);
    if (c.some((v) => v == null)) return strict ? null : c.find((v) => v != null) ?? flatEnough(x, z);
    // a step (a street block edge, a kerb) between the grid points: the nearest point, never a ramp through it. One
    // surface (the same mesh / block) is interpolated however steep (the snail's shell)
    const oneSurface = P4.every((p) => p.key === P4[0].key);
    if (!oneSurface && Math.max(...c) - Math.min(...c) > 0.06) return strict ? null : c[(fx < 0.5 ? 0 : 1) + (fz < 0.5 ? 0 : 2)];
    if (strict && P4.some((p) => p.prop || p.ny < 0.8)) return null;
    const y = (c[0] * (1 - fx) + c[1] * fx) * (1 - fz) + (c[2] * (1 - fx) + c[3] * fx) * fz;
    if (strict && !clearAt(x, z)) return null;
    return y;
  };
  const trees = (plan.trees ?? []).map((t) => ({ x: -t.x, z: -t.z - zc, s: t.s ?? 1 })), nearTree = (x, z) => trees.some((t) => Math.hypot(t.x - x, t.z - z) < 1.3 * t.s); // plan (giant root) -> rest coordinates, as toWorld below
  const spotY = (x, z) => walkY(x, z) ?? (flatEnough(x, z) ?? 0) + 0.15; // WORLD-FIX-2: on the street blocks (their top is 0.15 above the surface), not in them
  const S = {
    root, indoor: false, giantView: spec.view, creature: spec.kind,
    spots: { center: V(0, spotY(0, 0), 0), left: V(-2.4, spotY(-2.4, 0.4), 0.4), right: V(2.4, spotY(2.4, 0.4), 0.4), back: V(0, spotY(0, -5), -5), far: V(0, spotY(0, -30), -30), door: V(0, spotY(0, -14), -14), horizon: V(0, -y0, -600), head: (giant.updateMatrixWorld(true), giant.localToWorld(giant.userData.focus.clone()).setX(0)), tail: V(0, spotY(0, 10), 10) },
    camDir: V(0, 0, 1), views: {},
    bounds: [new THREE.Box3(V(-60, -y0 + 1, -120), V(60, 80, 40))],
    blockers: [],
    rig: { shadow: { center: [0, 0, -20], half: 60, far: 400, map: 4096 }, fogDist: { day: [260, 3200], warm: [260, 3000], dusk: [220, 2400], dawn: [220, 2600], night: [120, 1100] }, onLight: (mode) => town.userData.setLit(mode !== "day", { night: 1, dusk: 0.8, dawn: 0.5, warm: 0.6 }[mode] ?? 0) },
    sway(t) { return creatureSway(spec.kind, spec.size, t, S.tiltK ?? 1); },
    update(t) {
      const s = creatureSway(spec.kind, spec.size, t, S.tiltK ?? 1); // shot.onCreature.walkTilt / tiltDeg (setPlace)
      world.rotation.set(s.pitch, 0, s.roll); world.position.y = s.bob * 0.5;
      animateGiant(giant, spec.water ? "swim" : "walk", t);
      // WORLD-FIX-2: the walk cycle bobs the body (the town rides it) up to ~0.6 m on a 120 m turtle, while the people
      // stand at fixed heights: they sank into the street to the knees ("street night"). The giant is held so its
      // body stays at rest height; the gentle rock is the world's sway above
      const bj = giant.userData.joints?.body, br = bj && giant.userData.rest?.get(bj);
      giant.position.y = -y0 - (bj && br ? (bj.position.y - br.p.y) * (giant.userData.unit ?? 1) : 0);
      land.position.z = (t * gait.speed) % 1200; land.rotation.z = -s.roll * 0.3;
      syncCarrier();
    },
    // ATTACH: people + scene objects ride the carrier (indoors: the room, far below, stands still); crowds ride it too
    // (epic layer: S.mount) and stand on the walkable surface under each of them; other giants stay on the land
    town, giant, mount: carrier, giantMount: root, carrier, actorMount: () => (S.indoor ? null : carrier), crowdsOnSurface: true, groundY: -y0, surface: (x, z) => walkY(x, z),
    crowdSurface: (x, z) => (S.inBuilding?.(x, z) || nearTree(x, z) ? null : walkY(x, z, true)), // a crowd character inside a house footprint is left out
  };
  // the street-level places in the same town (deck, stairs, rooftop, school yard, a room, a classroom)
  addPlaces(S, { ctx, K, world: carrier, giant, town, plan, surface: flatEnough, toWorld: (x, y, z) => V(-x, y - y0, -z - zc), seed: spec.seed });
  // ATTACH-2: the places' decks, steps, crates and rails (rest coordinates, on the carrier) are ground too: a crowd
  // character never stands in or half on one (walkY strict leaves a prop's cells out); people may stand on a deck
  carrier.traverse((o) => { if (o.isMesh && o.userData.placeProp) groundMeshes.push(o); }); // shown + opaque: asked per hit
  const setPlace0 = S.setPlace; // a place shows / hides its own props: the memoised ground is measured again per place
  let placeNow = null; // the engine calls setPlace every frame: clear only when the place really changes
  if (setPlace0) S.setPlace = (...a) => { const r = setPlace0(...a), n = S.camDir.toArray().join() + S.spots.center.toArray().join(); if (n !== placeNow) { placeNow = n; memo.clear(); clearMemo.clear(); } return r; };
  lookHooks(S, ctx, nature);
  return S;
}

// ------------------------------------------------------------------------------------------------ OUTSIDE
/**
 * buildCreatureOutside(spec, ctx): the giant crossing the land (or sea) left -> right, ~0.9 x size in front of the
 * camera's group. set.giantPath(t) -> its position; set.update(t) moves + animates it (walk / swim).
 */
export async function buildCreatureOutside(rawSpec, ctx) {
  const spec = normCreatureSpec({ ...rawSpec, view: "outside" });
  await preloadEnv(ctx.THREE);
  const { THREE } = ctx;
  const root = new THREE.Group(); root.name = `creature:outside:${spec.kind}`;
  const K = makeKit(ctx, root);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  // creature "none": just the land (a battlefield / a giant's walk with no creature-city in it)
  const giant = spec.kind === "none" ? null : makeGiant({ kind: spec.kind, size: spec.size, town: true, seed: spec.seed, tex: ctx.tex, colors: spec.colors ?? undefined, rig: spec.rig ?? undefined, villain: spec.villain });
  if (giant) root.add(giant);
  // WORLD-LOOK: the dense town on its back (the same one the "on" / "street" views stand in)
  if (giant) addBackTown(giant, { style: spec.town.style, landmarks: spec.town.landmarks ?? undefined, density: spec.town.density, seed: spec.seed, tex: ctx.tex, bible: spec.bible });
  const dist = spec.size * 1.1;
  const yaw = Math.PI / 2 - 0.6, dirX = Math.sin(yaw), dirZ = Math.cos(yaw);
  // the realistic forest (page/kit/nature.js): no trees in the creature's lane (its path) or where the people stand;
  // everything else frames it, and the sight-line rule keeps the line from the camera to it clear every frame
  const p0x = -spec.size * 0.15, p0z = -dist;
  const lane = (x, z) => { const ux = x - p0x, uz = z - p0z, along = ux * dirX + uz * dirZ, off = Math.abs(ux * dirZ - uz * dirX); return along > -spec.size * 2.6 && along < spec.size * 3 && off < spec.size * 0.42; };
  const people = (x, z) => Math.hypot(x, z) < 24; // GATE 2026-11-09: was 14 (#3: 30 m crowns overhung the close-ups of Tobin)
  // FRAMING-FIX 2026-11-08: the rival giants' spots (giant_left / giant_right, pushed back a little by the epic layer)
  // are clearings too: the 25 m wolf beside the turtle stood among 30 m trees, hidden in every shot on it
  const rivals = (x, z) => [-1, 1].some((k) => Math.hypot(x - k * spec.size * 0.9, z + dist + spec.size * 0.08) < Math.max(34, spec.size * 0.32));
  const nature = spec.water ? null : await makeNature(ctx, { seed: spec.seed, center: { x: 0, z: -dist * 0.6 }, flatR: Math.max(300, spec.size * 2.6), nearR: Math.max(240, dist + spec.size * 1.3), farR: 1600, trees: 15000, treeScale: Math.min(1.8, Math.max(1, spec.size / 70)), groundTile: 14, ferns: 2200, clear: (x, z) => lane(x, z) || people(x, z) || rivals(x, z), noGrass: (x, z) => lane(x, z) && Math.hypot(x, z) > 30, grassCenter: { x: 0, z: -10 }, grassR: 40, grass: 40000, hardClear: (x, z) => Math.hypot(x, z) < 24, lawn: (x, z) => { const d = Math.hypot(x, z); return d < 8 ? 0 : d < 16 ? 0.45 : 1; }, /* GATE 2026-11-09: a short lawn where the people stand (no clumps over a close-up face) */ /* WORLD-FIX 2026-11-07: a DENSE forest of big trees (the style test), the grass carpet only near the lens (far blades speckled), a larger ground tile */ dirt: (x, z) => (lane(x, z) ? 0.8 : 0) });
  const land = nature ? nature.group : landscape(K, ctx, { water: spec.water, seed: spec.seed, clear: (x, z) => (Math.abs(z + dist) < spec.size * 0.6 && Math.abs(x) < spec.size * 2.5) || (z > -dist - spec.size * 0.6 && Math.abs(x) < spec.size * 3) });
  root.add(land);
  const action = spec.water ? "swim" : "walk";
  const gait = gaitOf(spec.kind, action, spec.size);
  const sink = spec.water ? spec.size * 0.12 : 0;
  // it walks across and a little toward the camera (a 3/4 view reads better than a profile); slow on screen
  const giantPath = (t) => V(-spec.size * 0.15 + dirX * gait.speed * t * 0.3, -sink, -dist + dirZ * gait.speed * t * 0.3);
  const S = {
    root, indoor: false, giantView: "outside", creature: spec.kind,
    spots: { center: V(0, 0, 0), left: V(-3, 0, 0.5), right: V(3, 0, 0.5), back: V(0, 0, -6), far: V(0, 0, -dist), door: V(0, 0, -dist * 0.7), horizon: V(0, 0, -1400), head: V(spec.size * 0.4, (giant?.userData.height ?? 30) * 0.6, -dist), tail: V(-spec.size * 0.5, 0, -dist) },
    camDir: V(0, 0, 1), views: {},
    bounds: [new THREE.Box3(V(-dist * 3, 0.3, -dist * 4), V(dist * 3, dist * 2, dist * 3))],
    blockers: [],
    rig: { shadow: giant ? { center: [0, 0, -dist], half: spec.size * 0.85, far: spec.size * 6, map: 4096 } : { center: [0, 0, -40], half: 70, far: 400, map: 4096 }, // the haze starts far and the exposure is a touch lower: the opening aerial was washed out (run 7b4c0d8b stills)
      // WORLD-LOOK: fog colour from the light (lighting.js timeLook), distances here, far enough that the creature keeps
      // its contrast (the per-frame fog guard pushes it further when the camera backs off)
      fogDist: { day: [700, 5200], warm: [600, 4600], dusk: [450, 3600], dawn: [500, 3800], night: [320, 2200] }, exposure: { day: 0.8, warm: 0.8 }, envScale: { all: 0.35 }, hemiScale: { day: 0.75, night: 1.6 }, sunScale: { night: 1.5 }, sunDir: { day: [30, 40, 34], warm: [42, 11, -6], night: [-30, 50, -20], dusk: [40, 8, -20], dawn: [-40, 9, 20] }, onLight: (mode) => { const k = { night: 1.2, dusk: 0.9, dawn: 0.6, warm: 0.7 }[mode] ?? 0; giant?.userData.town?.userData.setLit(k > 0, k); giant?.userData.backTown?.userData.setLit(k > 0, k); } },
    giantPath,
    // lt (the shot's own time, engine.js): the giant starts each shot at the same place behind the group. With the
    // video time it walked out of the frame after ~40 s (turtle run 7b4c0d8b: an empty field at 53 s and 82 s).
    update(t, lt) {
      if (!giant) return;
      giant.position.copy(giantPath(Number.isFinite(lt) ? lt : t)); giant.rotation.y = yaw; // walking left to right, angled toward the camera
      animateGiant(giant, action, t);
      dustAt(Number.isFinite(lt) ? lt : t);
    },
    giant, town: giant?.userData.town ?? null, mount: root, groundY: 0,
  };
  S.spots.giant_left = V(-spec.size * 0.9, 0, -dist); S.spots.giant_right = V(spec.size * 0.9, 0, -dist);
  // WORLD-LOOK: puffy grey dust at every footfall (deterministic in the shot time: the last ~5 s of footfalls fill a
  // fixed pool of burst slots, each at a foot)
  const slots = giant && !spec.water ? Array.from({ length: 20 }, () => ({ t0: -99, pos: V(0, 0, 0), n: 7, spread: spec.size * 0.035, rise: spec.size * 0.012, size: spec.size * 0.07, dur: 0.4, alpha: 0.55 })) : [];
  const dustPool = slots.length ? makeDust(THREE, slots, { seed: spec.seed }) : null;
  if (dustPool) root.add(dustPool.group);
  const feet = giant ? (giant.userData.joints?.legs ?? []).filter(Boolean).slice(0, 4) : [];
  function dustAt(lt) {
    if (!dustPool) return;
    dustPool.group.visible = !!feet.length && !S.coast?.active;
    if (!dustPool.group.visible) return;
    const falls = giantFootfalls(spec.kind, action, Math.max(0, lt - 5), lt + 1e-3, { size: spec.size }).slice(-slots.length);
    giant.updateMatrixWorld(true);
    slots.forEach((b) => { b.t0 = -99; });
    falls.forEach((tf, i) => { const b = slots[i], fp = feet[i % feet.length].getWorldPosition(V(0, 0, 0)); b.t0 = tf; b.pos.set(fp.x, 0, fp.z); });
    dustPool.update(lt);
  }
  lookHooks(S, ctx, nature);
  if (giant && !spec.water) addCoastStage(S, { spec, ctx, K, land, giant, dist, gait, yaw, giantPath, nature });
  return S;
}

// ------------------------------------------------------------------------------------------------ OUTSIDE: the coast stage
/**
 * 2026-11-06 (turtle run 1620fc3e: "spray the hill with the hose, mud, the turtle tips and slides down, splash into
 * the sea, floating at sunrise" showed the turtle walking on flat grass). The outside view gets a coast: a big hill
 * sloping down (left -> right) to the sea, the giant on it. shot.stage (lib/coast.js plans it, lib/epic.js checks it):
 *   { ground: "land" | "hill" | "sea", mud?: bool, fx?: ["spray", "splash"] }
 *   land: the plain fields (the default; no stage = land)      hill: the coast, the giant walking on the hill
 *   mud: the hill brown and shiny                               sea: the giant floating off the shore
 *   spray: water arcing from the first person's hand to the hill (S.stageAfter, once people stand)
 *   splash: the giant hits the water at the shore: white water bursting up and a ring spreading
 * The giant's action "slide" (lib/epic.js) on a hill: it slides down the slope on its belly toward the sea.
 * S.setStage(stage, lt, dur, action) -> after S.update (moves the giant); S.stageAfter(shot, lt, where) -> the spray.
 */
function addCoastStage(S, { spec, ctx, K, land, giant, dist, gait, yaw, giantPath, nature = null }) {
  const { THREE } = ctx, s = spec.size, V = (x, y, z) => new THREE.Vector3(x, y, z);
  const shoreX = s * 0.95, topX = -s * 2.4, H = s * 0.42, zc = -dist, halfD = dist * 0.92;
  const sm = (u) => { u = Math.min(1, Math.max(0, u)); return u * u * (3 - 2 * u); };
  /** the hill's height at (x, z): highest at the left, down to 0 at the shore, rounded off front and back */
  const hillY = (x, z) => H * sm((shoreX - x) / (shoreX - topX)) * sm(1.15 - Math.abs(z - zc) / halfD);
  const coast = new THREE.Group(); coast.name = "coast"; coast.visible = false; S.root.add(coast);
  // the hill: a displaced plane (grass, or mud)
  const gW = shoreX - topX + s * 0.6, geo = new THREE.PlaneGeometry(gW, halfD * 2.2, 90, 60); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, cx = (shoreX + topX) / 2 - s * 0.3;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i) + cx, z = pos.getZ(i) + zc; pos.setY(i, hillY(x, z) + 0.05); }
  geo.computeVertexNormals();
  const grassM = nature ? K.pbr("leafy_grass", { repeat: [(shoreX - topX + s * 0.6) / 8, (halfD * 2.2) / 8], tint: "#b8d08a", normal: 0.6 }) : new THREE.MeshStandardMaterial({ color: "#6fae45", roughness: 0.95 });
  const mudM = new THREE.MeshStandardMaterial({ color: "#6b4526", roughness: 0.18, metalness: 0.15 });
  const hill = new THREE.Mesh(geo, grassM); hill.position.set(cx, 0, zc); hill.receiveShadow = true; coast.add(hill);
  // mud streaks: darker glossy bands down the slope (only with mud)
  const streaks = new THREE.Group(); streaks.visible = false; coast.add(streaks);
  const wetM = new THREE.MeshStandardMaterial({ color: "#4a2e18", roughness: 0.08, metalness: 0.2 });
  for (let k = 0; k < 7; k++) {
    const z = zc + (k - 3) * s * 0.16, len = shoreX - topX, g2 = new THREE.PlaneGeometry(len, s * 0.05, 40, 1); g2.rotateX(-Math.PI / 2);
    const p2 = g2.attributes.position;
    for (let i = 0; i < p2.count; i++) { const x = p2.getX(i) + (shoreX + topX) / 2; p2.setY(i, hillY(x, p2.getZ(i) + z) + 0.3); }
    g2.computeVertexNormals();
    const m = new THREE.Mesh(g2, wetM); m.position.set((shoreX + topX) / 2, 0, z); streaks.add(m);
  }
  // the sea from the shore to the horizon, a sand strip along the shore
  const seaM = new THREE.MeshStandardMaterial({ color: "#2f7fb8", roughness: 0.12, metalness: 0.15 });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), seaM); sea.rotation.x = -Math.PI / 2; sea.position.set(shoreX + 3000, 0.6, 0); sea.receiveShadow = true; coast.add(sea);
  const sand = new THREE.Mesh(new THREE.BoxGeometry(s * 0.35, 1, 6000), new THREE.MeshStandardMaterial({ color: PLASTIC_LOOK ? "#ffd64f" : "#e9d3a0", roughness: 1 })); sand.position.set(shoreX - s * 0.1, 0.2, 0); coast.add(sand);
  // the grass in front of / behind the hill on the land side (the plain fields' trees would stand in the sea)
  // FRAMING-FIX 2026-11-08 (lead review: "the army on a flat green field with pastel triangle mountains"): no flat
  // pastel plane and no cone mountains here any more. The realistic forest (land = the nature group) stays visible on
  // the coast too; its plants are clipped off the hill's footprint and the sea (nature.clip), the hill wears the grass
  // texture. With a pastel fallback land (no nature) the old flat plane is kept, without mountains.
  if (!nature) { const flat = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshStandardMaterial({ color: "#78b84e", roughness: 1 })); flat.rotation.x = -Math.PI / 2; flat.position.set(shoreX - 3000, 0, 0); coast.add(flat); }
  const clipRegion = { xMin: topX - s * 0.6 - 6, zc, halfZ: halfD * 1.1 + 6, seaX: shoreX - s * 0.05 };
  // the spray: droplets on a parabola from a hand toward the hill; the splash: droplets bursting up + a foam ring
  const dropM = new THREE.MeshStandardMaterial({ color: "#cfeeff", emissive: "#9fd6ff", emissiveIntensity: 0.6, roughness: 0.2, transparent: true, opacity: 0.9 });
  const NS = 420, spray = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 6, 4), dropM, NS); spray.visible = false; spray.frustumCulled = false; S.root.add(spray);
  const NB = 420, splash = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: "#d8f0ff", emissiveIntensity: 0.35, roughness: 0.3 }), NB); splash.visible = false; splash.frustumCulled = false; S.root.add(splash);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 64), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.visible = false; S.root.add(ring);
  const R = prng(spec.seed * 31 + 7), seeds = Array.from({ length: Math.max(NS, NB) }, () => [R(), R(), R(), R()]);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
  const sink = giant.userData.height * 0.32;
  let cur = null;
  /** the slope angle under x (for tipping the giant) */
  const slopeAt = (x, z) => Math.atan2(hillY(x - 2, z) - hillY(x + 2, z), 4);
  S.coast = { hillY, shoreX, topX };
  S.setStage = (stage, lt = 0, dur = 1, action = null) => {
    cur = stage && stage.ground && stage.ground !== "land" ? stage : null;
    coast.visible = !!cur; land.visible = !cur || !!nature; nature?.clip(cur ? clipRegion : null); S.coast.active = !!cur;
    spray.visible = false; splash.visible = false; ring.visible = false;
    if (!cur) return;
    hill.material = cur.mud ? mudM : grassM; streaks.visible = !!cur.mud;
    const u = Math.min(1, Math.max(0, lt / Math.max(0.2, dur)));
    const fx = new Set(cur.fx ?? []);
    let x, z = zc + s * 0.05, y, pitch = 0, gy = Math.PI / 2; // the giant faces the sea (+x), side-on to the lens
    if (cur.ground === "sea") { x = shoreX + s * 0.9 + lt * gait.speed * 0.08; y = 0.6 - sink + 0.6 * Math.sin(lt * 1.2); gy = Math.PI / 2 - 0.35; }
    else if (fx.has("splash")) { x = shoreX + s * (0.15 + 0.45 * Math.min(1, u * 1.6)); y = Math.max(0.6 - sink, hillY(x, z)) - sink * Math.min(1, u * 2) * 0.5; pitch = 0.18 * (1 - u); }
    else if (action === "slide") { x = -s * 0.9 + (shoreX - s * 0.25 + s * 0.9) * (u * u * 0.85 + u * 0.15); y = hillY(x, z); pitch = slopeAt(x, z); }
    else { x = -s * 0.75 + lt * gait.speed * 0.1; y = hillY(x, z); pitch = action === "fall" ? slopeAt(x, z) + 0.2 * Math.min(1, u * 2) : slopeAt(x, z) * 0.6; }
    giant.position.set(x, y, z); giant.rotation.set(0, gy, 0); giant.rotateX(pitch);
    // the splash: white water flying up around the giant's front and falling back; a foam ring spreading
    if (fx.has("splash")) {
      const front = V(x + giant.userData.length * 0.45, 0.6, z), L = giant.userData.length;
      for (let i = 0; i < NB; i++) {
        const [a, b, c, d] = seeds[i], ang = a * Math.PI * 2, sp = (0.25 + b * 0.75) * L * 0.55, up = (0.5 + c) * L * 0.45, tt = Math.max(0, lt - d * 0.25);
        p.set(front.x + Math.cos(ang) * sp * tt * 0.8, 0.6 + up * tt - 0.5 * 30 * tt * tt * 0.35, front.z + Math.sin(ang) * sp * tt * 0.8);
        const k = p.y < 0.6 ? 0 : (0.4 + d) * L * 0.012 * (1 + c);
        m4.compose(p, q.identity(), sc.set(k, k, k)); splash.setMatrixAt(i, m4);
      }
      splash.instanceMatrix.needsUpdate = true; splash.visible = true;
      const rr = L * (0.3 + lt * 0.7); ring.scale.set(rr, rr, 1); ring.position.set(front.x, 0.75, front.z); ring.material.opacity = Math.max(0, 0.75 - lt * 0.25); ring.visible = true;
    }
  };
  /** the spray from the first person's hand (where: the engine's placed people) toward the hill, cycling */
  S.stageAfter = (shot, lt, where, camera = null) => {
    // the camera never ends inside the hill (the EPIC cameras measure from the flat ground: a hero_low on the giant
    // high on the slope stood inside it, a flat green frame): lifted above the slope and aimed at the giant again
    if (cur && camera) {
      camera.updateMatrixWorld();
      const c = camera.getWorldPosition(new THREE.Vector3()), gy = hillY(c.x, c.z);
      if (gy > 0.5 && c.y < gy + 1.5) { // only when it is in (or just over) the slope: people shots at its foot stay as framed
        const onGiant = shot.focus === "world" || /^giant:/.test(String(shot.focus ?? "")) || !(shot.actors ?? []).length;
        camera.position.y += gy + 1.5 - c.y + (onGiant ? giant.userData.height * 0.3 : 0);
        if (onGiant) camera.lookAt(giant.position.clone().setY(giant.position.y + giant.userData.height * 0.45));
        camera.updateMatrixWorld();
      }
    }
    // the splash: filmed from the beach, side-on, the white water and the sea in frame (an EPIC camera on the giant
    // high on the slope saw the shell close up, or stood inside the hill)
    if (cur && camera && (cur.fx ?? []).includes("splash")) {
      const L = giant.userData.length, gh = giant.userData.height, gp = giant.position;
      camera.position.set(gp.x + L * 0.55, 6 + gh * 0.15, gp.z + L * 1.35);
      camera.up.set(0, 1, 0); camera.lookAt(gp.x + L * 0.2, gh * 0.3, gp.z); camera.updateMatrixWorld();
    }
    if (!cur || !(cur.fx ?? []).includes("spray")) return;
    const id = (shot.actors ?? [])[0]?.id, at = id && where?.[id];
    if (!at) return;
    // across the frame (screen left, a little away from the lens): straight away from the lens it hid behind the sprayer
    const left = camera ? new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).setY(0).normalize().negate() : V(-1, 0, 0);
    const away = camera ? new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 2).setY(0).normalize().negate() : V(0, 0, -1);
    const dir = left.clone().multiplyScalar(0.3).addScaledVector(away, 1).normalize(), o = at.clone().add(V(0, 0.95, 0)).addScaledVector(left, 0.3).addScaledVector(away, 0.05);
    for (let i = 0; i < NS; i++) {
      const [a, b, c] = seeds[i], tau = ((lt * 1.3 + a) % 1) * 1.2, v = 4.5 + b * 1.2;
      p.copy(o).addScaledVector(dir, v * tau); p.y += 4.2 * tau - 4.9 * tau * tau; p.x += (c - 0.5) * 0.25 * tau; p.z += (b - 0.5) * 0.25 * tau;
      const k = p.y < 0 ? 0 : 0.8 + c * 0.8;
      m4.compose(p, q.identity(), sc.set(k, k, k)); spray.setMatrixAt(i, m4);
    }
    spray.instanceMatrix.needsUpdate = true; spray.visible = true;
  };
}
