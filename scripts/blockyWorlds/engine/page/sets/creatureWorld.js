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
import { makeGiant, animateGiant, giantSurface } from "../kit/giants.js";
import { makeTown, townLayout } from "../kit/town.js";
import { gaitOf, prng } from "../../lib/epic.js";

const TAU = Math.PI * 2;

/** the creature world's own spec from either shape (ours, or the builder's creature_world spec) */
export function normCreatureSpec(spec = {}) {
  const c = spec.creature;
  const kind = typeof c === "string" ? c : c?.species ?? spec.kind_creature ?? (spec.kind && spec.kind !== "creature_world" ? spec.kind : "turtle");
  const view = spec.view ?? (c?.city === "inside" ? "inside" : c?.city === "on" ? "on" : "inside");
  const size = Number(spec.size ?? c?.scale) || 120;
  return { kind, view, size: Math.max(30, Math.min(200, size)), seed: spec.seed ?? 11, water: spec.water ?? kind === "whale", lit: !!spec.lit, name: spec.name ?? `${view} the ${kind}` };
}

export async function buildCreatureWorld(rawSpec, ctx) {
  const spec = normCreatureSpec(rawSpec);
  await preloadEnv(ctx.THREE);
  if (spec.view === "outside") return buildCreatureOutside(spec, ctx);
  if (spec.view === "on") return buildOn(spec, ctx);
  return buildInside(spec, ctx);
}

// ------------------------------------------------------------------------------------------------ shared pieces
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
  const haze = (k, toward = "#e8d8a0") => `#${new THREE.Color(pal[5]).lerp(new THREE.Color(toward), k).getHexString()}`;
  // the cavern: half-ellipsoid, length L along z, half-width A, height Hh (a big turtle: ~100 x 64 x 30 m)
  // 2026-11-06 (turtle run 7b4c0d8b): the old cavern (half-width 0.3 x size, 0.24 x size high = 36 x 29 m for a 120 m
  // turtle) put the shell far above 8 m houses: every kid-height medium / closeup shot showed only houses and a sandy
  // floor, i.e. "a normal street". Now the shell is low and close (it shows above the houses in every framing), the
  // houses are low cottages, the floor is the creature's own scaly skin and the haze is the shell's colour, not sky.
  const L = spec.size * 0.85, A = spec.size * 0.19, Hh = spec.size * 0.13, Zc = -L * 0.38;
  // [shell plate, plate seam, bone, skin floor, skin seam, cavern haze]
  const pal = { turtle: ["#5b8a2e", "#1f3314", "#e8d6a0", "#a39a62", "#6b6236", "#4d5a2c"], whale: ["#c96b7a", "#5a2430", "#f0c0b0", "#d98a8f", "#8a3c48", "#6a3038"], elephant: ["#8a7a8a", "#3a2f3a", "#e0c8b8", "#9a8e8e", "#5a4e50", "#4a4048"], snail: ["#b0632e", "#4a2410", "#f0d8a8", "#c69a6a", "#7a5030", "#5a3a20"] }[spec.kind] ?? ["#7a6a4a", "#2a2018", "#e8d6a0", "#a08a68", "#5e4c34", "#4a3e2c"];
  // the shell: plates on the inside, a back-side half ellipsoid
  const tex = plateTexture(THREE, pal[0], pal[1], spec.seed); tex.repeat.set(10, 4);
  const shellM = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75, side: THREE.BackSide, color: "#ffffff" });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 24, 0, TAU, 0, Math.PI / 2), shellM);
  dome.scale.set(A, Hh, L / 2); dome.position.set(0, 0, Zc); dome.receiveShadow = true; world.add(dome);
  // ribs: blocky bone arches every ~10 m
  const ribM = solid(pal[2], { roughness: 0.6 });
  const nRib = Math.floor(L / 11);
  for (let k = 0; k <= nRib; k++) {
    const z = Zc + L / 2 - 6 - k * (L - 12) / nRib, q = 1 - ((z - Zc) / (L / 2)) ** 2; if (q <= 0.05) continue;
    const a = A * Math.sqrt(q) * 0.985, h = Hh * Math.sqrt(q) * 0.985;
    for (let s = 0; s <= 18; s++) {
      const th = (s / 18) * Math.PI, x = Math.cos(th) * a, y = Math.sin(th) * h;
      const m = K.rbx(2.2, 1.6, 1.8, 0.3, ribM, { x, y, z, rz: th - Math.PI / 2 });
      m.lookAt(0, 0, z); m.rotateY(Math.PI / 2);
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
      hemi: { day: ["#ffe2b8", "#5a4028", 0.85], night: ["#3a4a80", "#120c08", 0.3], warm: ["#ffcf9a", "#5a3a20", 0.5] },
      fog: { day: [haze(0.4), 45, L * 1.6], night: ["#141a18", 25, L * 1.0], warm: [haze(0.25, "#ffb070"), 45, L * 1.5] },
      exposure: { day: 0.8, night: 0.95, warm: 0.8 },
      practicals: (mode) => {
        const out = [];
        for (const s of spots.slice(0, 3)) { const l = new THREE.SpotLight(mode === "night" ? "#9fb6ff" : "#ffe2a8", mode === "night" ? 300 : 900, 80, 0.5, 0.7, 1.4); l.position.copy(s.from); l.target.position.copy(s.to); l.castShadow = false; out.push(l); }
        const ml = new THREE.SpotLight("#ffe0a8", mode === "night" ? 300 : 1500, L, 0.55, 0.8, 1.2); ml.position.set(0, Hh * 0.3, mouthZ - 2); ml.target.position.set(0, 0, 0); out.push(ml);
        const warm = new THREE.PointLight("#ffb860", mode === "night" ? 140 : 60, 40, 1.6); warm.position.set(0, 6, -2); out.push(warm);
        return out;
      },
      onLight: (mode) => { glow.apply(mode); town.userData.setLit(mode !== "day", mode === "night" ? 1 : 0.6); skyM.emissiveIntensity = mode === "night" ? 0.6 : 3; skyM.emissive.set(mode === "night" ? "#8fa8ff" : "#fff2c8"); sM.uniforms.k.value = mode === "night" ? 0.06 : 0.2; dust.material.opacity = mode === "night" ? 0.15 : 0.6; mouth.material.color.set(mode === "night" ? "#30406a" : mode === "warm" ? "#ffb060" : "#ffe9c0"); },
    },
    sway(t) { return creatureSway(spec.kind, spec.size, t); },
    update(t) {
      const s = creatureSway(spec.kind, spec.size, t);
      world.rotation.set(s.pitch, 0, s.roll); world.position.y = s.bob;
      for (const [i, l] of lanterns.entries()) { l.rotation.z = -s.roll * 3 + 0.02 * Math.sin(t * 1.3 + i); l.rotation.x = -s.pitch * 3; }
      dust.rotation.y = t * 0.004;
    },
    town, giant: null, mount: world, groundY: 0,
  };
  mergeStatic(THREE, world);
  return S;
}

// ------------------------------------------------------------------------------------------------ ON (the town on its back)
function buildOn(spec, ctx) {
  const { THREE } = ctx;
  const root = new THREE.Group(); root.name = `creature:on:${spec.kind}`;
  const world = new THREE.Group(); root.add(world);
  const K = makeKit(ctx, world);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const giant = makeGiant({ kind: spec.kind, size: spec.size, town: false, seed: spec.seed });
  giant.rotation.y = Math.PI; // head toward -z (ahead of the camera)
  const surf0 = giantSurface(giant);
  const surf = (x, z) => surf0(-x, -z); // rotated 180 degrees
  // the centre spot: a clear point on the back, a bit toward the tail (the head is ahead), on the street
  const zc = spec.kind === "turtle" ? spec.size * 0.12 : spec.kind === "snail" ? 0 : spec.size * 0.08;
  const y0 = surf(0, zc) ?? spec.size * 0.4;
  giant.position.set(0, -y0, -zc);
  world.add(giant);
  // our own town on the back with a street along z through the centre spot (the giant's surface, shifted)
  const s2 = (x, z) => { const y = surf(x, z + zc); return y == null ? null : y - y0; };
  const u = giant.userData.unit, b = giant.userData.params.body;
  const reg = { x0: -b.w * 0.6 * u, x1: b.w * 0.6 * u, z0: -b.len * 0.6 * u - zc, z1: b.len * 0.6 * u - zc };
  const flatEnough = spec.kind === "turtle" ? (x, z) => { const a = (b.w / 2) * u, c = (b.len / 2) * u; return (x / a) ** 2 + ((z + zc) / c) ** 2 > 0.6 ? null : s2(x, z); } : s2;
  const houses = townLayout({ surface: flatEnough, region: reg, count: 60, seed: spec.seed + 1, street: { axis: "z", half: 4.2 }, size: [5.5, 8], tall: [4, 7], minGap: 0.8 }).filter((h) => h.z < 5 || Math.abs(h.x) > 12);
  const lamps = [], trees = [];
  for (let z = 4; z > reg.z0; z -= 12) { const y = flatEnough(-4.4, z); if (y != null) lamps.push({ x: -4.4, y, z }); const y2 = flatEnough(4.4, z - 6); if (y2 != null) lamps.push({ x: 4.4, y: y2, z: z - 6 }); }
  const town = makeTown(houses, { seed: spec.seed + 1, tex: ctx.tex, lamps, trees });
  world.add(town);
  // a cobbled street strip that follows the shell (a few segments)
  const streetM = K.pbr("concrete_pavement", { repeat: [3, 3], tint: "#efe9df" });
  for (let z = 10; z > reg.z0; z -= 4) { const y = flatEnough(0, z); if (y == null) continue; const yN = flatEnough(0, z - 4) ?? y; const seg = K.bx(8, 0.3, 4.3, streetM, { y: (y + yN) / 2 - 0.1, z: z - 2, keep: true }); seg.rotation.x = Math.atan2(yN - y, 4); }
  // the land far below, sliding past as the creature walks (the landscape moves +z)
  const land = landscape(K, ctx, { water: spec.water, seed: spec.seed, treeCount: 320 });
  land.position.y = -y0;
  root.add(land);
  const gait = gaitOf(spec.kind, spec.water ? "swim" : "walk", spec.size);
  const spotY = (x, z) => flatEnough(x, z) ?? 0;
  const S = {
    root, indoor: false, giantView: "on", creature: spec.kind,
    spots: { center: V(0, spotY(0, 0), 0), left: V(-2.4, spotY(-2.4, 0.4), 0.4), right: V(2.4, spotY(2.4, 0.4), 0.4), back: V(0, spotY(0, -5), -5), far: V(0, spotY(0, -30), -30), door: V(0, spotY(0, -14), -14), horizon: V(0, -y0, -600), head: (giant.updateMatrixWorld(true), giant.localToWorld(giant.userData.focus.clone()).setX(0)), tail: V(0, spotY(0, 10), 10) },
    camDir: V(0, 0, 1), views: {},
    bounds: [new THREE.Box3(V(-30, -y0 + 1, -80), V(30, 60, 30))],
    blockers: [],
    rig: { shadow: { center: [0, 0, -20], half: 60, far: 400, map: 4096 }, fog: { day: ["#9cc6ee", 200, 2600], night: ["#16244c", 60, 600], warm: ["#f0a06a", 200, 2600] }, onLight: (mode) => town.userData.setLit(mode !== "day", mode === "night" ? 1 : 0.6) },
    sway(t) { return creatureSway(spec.kind, spec.size, t); },
    update(t) {
      const s = creatureSway(spec.kind, spec.size, t);
      world.rotation.set(s.pitch, 0, s.roll); world.position.y = s.bob * 0.5;
      animateGiant(giant, spec.water ? "swim" : "walk", t);
      land.position.z = (t * gait.speed) % 1200; land.rotation.z = -s.roll * 0.3;
    },
    town, giant, mount: world, groundY: -y0, surface: (x, z) => flatEnough(x, z),
  };
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
  const giant = spec.kind === "none" ? null : makeGiant({ kind: spec.kind, size: spec.size, town: true, seed: spec.seed, tex: ctx.tex });
  if (giant) root.add(giant);
  const dist = spec.size * 1.1;
  const land = landscape(K, ctx, { water: spec.water, seed: spec.seed, clear: (x, z) => (Math.abs(z + dist) < spec.size * 0.6 && Math.abs(x) < spec.size * 2.5) || (z > -dist - spec.size * 0.6 && Math.abs(x) < spec.size * 3) });
  root.add(land);
  const action = spec.water ? "swim" : "walk";
  const gait = gaitOf(spec.kind, action, spec.size);
  const sink = spec.water ? spec.size * 0.12 : 0;
  // it walks across and a little toward the camera (a 3/4 view reads better than a profile); slow on screen
  const yaw = Math.PI / 2 - 0.6, dirX = Math.sin(yaw), dirZ = Math.cos(yaw);
  const giantPath = (t) => V(-spec.size * 0.15 + dirX * gait.speed * t * 0.3, -sink, -dist + dirZ * gait.speed * t * 0.3);
  const S = {
    root, indoor: false, giantView: "outside", creature: spec.kind,
    spots: { center: V(0, 0, 0), left: V(-3, 0, 0.5), right: V(3, 0, 0.5), back: V(0, 0, -6), far: V(0, 0, -dist), door: V(0, 0, -dist * 0.7), horizon: V(0, 0, -1400), head: V(spec.size * 0.4, (giant?.userData.height ?? 30) * 0.6, -dist), tail: V(-spec.size * 0.5, 0, -dist) },
    camDir: V(0, 0, 1), views: {},
    bounds: [new THREE.Box3(V(-dist * 3, 0.3, -dist * 4), V(dist * 3, dist * 2, dist * 3))],
    blockers: [],
    rig: { shadow: giant ? { center: [0, 0, -dist], half: spec.size * 0.85, far: spec.size * 6, map: 4096 } : { center: [0, 0, -40], half: 70, far: 400, map: 4096 }, // the haze starts far and the exposure is a touch lower: the opening aerial was washed out (run 7b4c0d8b stills)
      fog: { day: ["#a9cdee", 1600, 9000], warm: ["#f0a06a", 1400, 8000], night: ["#16244c", 260, 1800] }, exposure: { day: 0.8, warm: 0.8 }, envScale: { all: 0.35 }, hemiScale: { day: 0.75 }, sunDir: { day: [30, 40, 34], warm: [42, 11, -6], night: [-30, 50, -20] }, onLight: (mode) => giant?.userData.town?.userData.setLit(mode !== "day", mode === "night" ? 1.2 : 0.7) },
    giantPath,
    // lt (the shot's own time, engine.js): the giant starts each shot at the same place behind the group. With the
    // video time it walked out of the frame after ~40 s (turtle run 7b4c0d8b: an empty field at 53 s and 82 s).
    update(t, lt) {
      if (!giant) return;
      giant.position.copy(giantPath(Number.isFinite(lt) ? lt : t)); giant.rotation.y = yaw; // walking left to right, angled toward the camera
      animateGiant(giant, action, t);
    },
    giant, town: giant?.userData.town ?? null, mount: root, groundY: 0,
  };
  S.spots.giant_left = V(-spec.size * 0.9, 0, -dist); S.spots.giant_right = V(spec.size * 0.9, 0, -dist);
  if (giant && !spec.water) addCoastStage(S, { spec, ctx, K, land, giant, dist, gait, yaw, giantPath });
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
function addCoastStage(S, { spec, ctx, K, land, giant, dist, gait, yaw, giantPath }) {
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
  const grassM = new THREE.MeshStandardMaterial({ color: "#6fae45", roughness: 0.95 });
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
  const sand = new THREE.Mesh(new THREE.BoxGeometry(s * 0.35, 1, 6000), new THREE.MeshStandardMaterial({ color: "#e9d3a0", roughness: 1 })); sand.position.set(shoreX - s * 0.1, 0.2, 0); coast.add(sand);
  // the grass in front of / behind the hill on the land side (the plain fields' trees would stand in the sea)
  const flat = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshStandardMaterial({ color: "#78b84e", roughness: 1 })); flat.rotation.x = -Math.PI / 2; flat.position.set(shoreX - 3000, 0, 0); coast.add(flat);
  const mtnM = new THREE.MeshStandardMaterial({ color: "#6c8bb0", roughness: 1 });
  for (let k = 0; k < 6; k++) { const h = 220 + k * 40, m = new THREE.Mesh(new THREE.ConeGeometry(h * 0.9, h, 5), mtnM); m.position.set(-900 + k * 260, h / 2 - 10, -1500 - (k % 2) * 200); coast.add(m); }
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
    coast.visible = !!cur; land.visible = !cur;
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
