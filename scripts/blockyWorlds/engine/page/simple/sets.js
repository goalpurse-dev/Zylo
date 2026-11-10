// Blocky Worlds SIMPLE LOOK sets (production; the engine loads this module instead of page/sets/index.js when
// timeline.look === "simple"). Same contract (CONTRACT.md): SETS, buildSet(name, ctx) -> { root, spots, indoor, ... },
// applyLight(name, ctx) -> { dispose() }.
// Lighting (the approved test): ONE sun with soft shadows (PCF soft, a tight shadow box round what the camera looks
// at: sharp on close-ups) + a hemisphere sky light; no fog; night = a deep blue sky, glowing windows and the nearest
// street lamps lit (point lights); dusk / dawn / warm = the same rig, warmer.
import * as THREE from "three";
import { tuneOf, mat } from "./common.js";
import { buildStreet } from "./town.js";
import { buildBedroom, buildSchool, buildWoods } from "./rooms.js";

export const SETS = ["street", "bedroom", "school", "woods"];
const BUILD = { street: buildStreet, bedroom: buildBedroom, school: buildSchool, woods: buildWoods };

export async function buildSet(name, ctx) {
  const b = BUILD[name];
  if (!b) throw new Error(`simple buildSet: unknown set "${name}" (${SETS.join(" | ")})`);
  const S = b({ tl: ctx.tl ?? null });
  S.name = name;
  S.blockers = [...(S.blockers ?? [])];
  if (ctx.scene && !S.root.parent) ctx.scene.add(S.root);
  // the sun's shadow box follows what the camera looks at (tight = sharp on close-ups), after every framing
  S.afterCamera = (camera, shot, where) => {
    const sun = S.__sun; if (!sun) return;
    const f = where?.[shot?.focus] ?? null;
    const c = camera.getWorldPosition(new THREE.Vector3()), d = camera.getWorldDirection(new THREE.Vector3());
    const at = f ? f.clone() : c.clone().addScaledVector(d, shot?.camera === "wide" ? 12 : 4);
    at.y = 0;
    const half = c.y > 8 ? 70 : ({ closeup: 7, medium: 11, over_shoulder: 12, low: 14, insert: 12, wide: 26 }[shot?.camera] ?? (S.shadow?.half ?? 30));
    const T = sun.userData.tune;
    sun.target.position.copy(at); sun.position.copy(at).add(new THREE.Vector3(...T.sunDir).normalize().multiplyScalar(80));
    Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 1, far: 200 });
    sun.shadow.camera.updateProjectionMatrix(); sun.target.updateMatrixWorld();
    // the nearest lamps light up at night (a fixed pool of point lights: no shader recompiles between shots)
    const pool = S.__points ?? [];
    if (pool.length) { const near = [...(S.lamps ?? [])].sort((a, b) => a.distanceToSquared(at) - b.distanceToSquared(at)); pool.forEach((p, i) => { p.intensity = S.__night && near[i] ? p.userData.on : 0; if (near[i]) p.position.copy(near[i]); }); }
  };
  return S;
}

/** the light of a shot on a simple place: sky, hemisphere, the one sun, the lamps at night */
export function applyLight(name, ctx) {
  const { scene, renderer, set } = ctx;
  const T = tuneOf(name), night = !!T.night || name === "dusk";
  const added = [];
  const add = (o, parent = scene) => { parent.add(o); added.push(o); return o; };
  if (set?.sky) {
    set.sky.uniforms.top.value.set(T.skyTop); set.sky.uniforms.hor.value.set(T.skyHor);
    set.sky.cloudM.color.set(T.cloud[0]); set.sky.cloudM.emissiveIntensity = T.cloud[1];
  }
  const prev = { fog: scene.fog, background: scene.background, environment: scene.environment, exposure: renderer.toneMappingExposure };
  scene.fog = null; scene.environment = null; scene.background = new THREE.Color(T.skyHor);
  const hemi = add(new THREE.HemisphereLight(T.hemi[0], set?.indoor ? "#cbbfa8" : T.hemi[1], T.hemi[2] * (set?.indoor ? 1.15 : 1))); // indoors a neutral bounce: never a green ceiling
  const sun = add(new THREE.DirectionalLight(T.sun[0], T.sun[1] * (set?.indoor ? 0.75 : 1)));
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  sun.userData.tune = T;
  const c = set?.spots?.center ?? new THREE.Vector3();
  sun.target.position.set(c.x, 0, c.z); sun.position.copy(sun.target.position).add(new THREE.Vector3(...T.sunDir).normalize().multiplyScalar(80));
  const half = set?.shadow?.half ?? 40;
  Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 1, far: 200 });
  sun.shadow.camera.updateProjectionMatrix();
  add(sun.target);
  // indoors: a soft key from the window side + the room light (the sun alone leaves a room flat)
  if (set?.indoor) { const fill = add(new THREE.PointLight(night ? "#ffcf8a" : "#fff6e6", night ? 9 : 6, 14, 1.4)); fill.position.set(0.5, 2.5, 1.5); }
  const points = [];
  if (!set?.indoor) for (let i = 0; i < 6; i++) { const p = add(new THREE.PointLight("#ffd98a", 0, 16, 1.6)); p.userData.on = 22; points.push(p); }
  else for (const l of set?.lamps ?? []) { const p = add(new THREE.PointLight("#ffcf73", night ? 6 : 0, 6, 1.5)); p.position.copy(l); }
  if (set) { set.__sun = sun; set.__points = points; set.__night = night; }
  renderer.toneMappingExposure = T.exposure;
  set?.onLight?.(name);
  void hemi; void mat;
  return {
    name,
    dispose() {
      for (const o of added) o.parent?.remove(o);
      sun.shadow.map?.dispose();
      scene.fog = prev.fog; scene.background = prev.background; scene.environment = prev.environment;
      renderer.toneMappingExposure = prev.exposure;
      if (set) { set.__sun = null; set.__points = []; }
    },
  };
}
