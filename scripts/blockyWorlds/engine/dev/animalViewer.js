// ANIMAL VIEWER renders (dev only, 2026-11-07): the same grey studio as dev/animals.js, but driven call by call from
// dev/animalViewer.mjs so it can save single big stills and frame sequences for the owner's viewer page.
//   window.still({ species, variant, view: "front"|"side"|"3/4", size: 720, person: true }) -> jpeg data URL
//   window.clip({ species, variant, act, t0, dur, fps, size, opts }) -> [jpeg data URL per frame]
import * as THREE from "three";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { makeAnimal, animateAnimal, ANIMAL_SPECIES, animalGait } from "/page/kit/animals/index.js";
import { makePerson, posePerson } from "/page/kit/people.js";

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95; renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color("#aeb1b6"); scene.fog = new THREE.Fog("#aeb1b6", 1, 2);
const env = await new RGBELoader().loadAsync("/assets/ph/hdri/kloofendal_43d_clear_puresky.hdr"); env.mapping = THREE.EquirectangularReflectionMapping;
scene.environment = env; scene.environmentIntensity = 0.45;
const floor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ color: "#b9bcc1", roughness: 0.95 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const sun = new THREE.DirectionalLight("#fff1dc", 2.6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; scene.add(sun, sun.target);
scene.add(new THREE.HemisphereLight("#e6eefc", "#8a8070", 0.7));
const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 5000);
const person = makePerson({ id: "scale", role: "adult", seed: 8 }); scene.add(person);
posePerson(person, "stand", 0);

const DIRS = { "3/4": new THREE.Vector3(0.75, 0.32, 0.85), front: new THREE.Vector3(0, 0.18, 1), side: new THREE.Vector3(1, 0.12, 0) };
// the box of the meshes that are really drawn (hidden helpers, zero-scale parts and sprites left out)
function visBox(g) {
  g.updateMatrixWorld(true);
  const b = new THREE.Box3(), tmp = new THREE.Box3();
  g.traverseVisible((o) => {
    if (!o.isMesh || !o.geometry) return;
    const e = new THREE.Vector3(); o.getWorldScale(e); if (Math.min(Math.abs(e.x), Math.abs(e.y), Math.abs(e.z)) < 0.01) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); b.union(tmp);
  });
  return b.isEmpty() ? new THREE.Box3().setFromObject(g) : b;
}
window.visBox = visBox;
function frame(g, dir, pad = 1.12, box = null) {
  g.updateMatrixWorld(true);
  const b = box ?? visBox(g);
  const s = b.getSize(new THREE.Vector3());
  // fit the 8 box corners exactly in perspective from this direction, then centre them on screen (two passes)
  const fwd = dir.clone().normalize().negate(), right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize(), up = new THREE.Vector3().crossVectors(right, fwd);
  const T = Math.tan((camera.fov * Math.PI) / 360) / pad;
  const corners = [];
  for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) corners.push(new THREE.Vector3(x, y, z));
  const c = b.getCenter(new THREE.Vector3());
  let d = 0;
  for (let pass = 0; pass < 3; pass++) {
    d = 0;
    for (const q of corners) { const p = q.clone().sub(c); d = Math.max(d, Math.max(Math.abs(p.dot(right)), Math.abs(p.dot(up))) / T - p.dot(fwd)); }
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const q of corners) { const p = q.clone().sub(c), z = d + p.dot(fwd), sx = p.dot(right) / z, sy = p.dot(up) / z; x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy); }
    c.addScaledVector(right, ((x0 + x1) / 2) * d).addScaledVector(up, ((y0 + y1) / 2) * d);
  }
  camera.position.copy(c).addScaledVector(dir.clone().normalize(), d);
  camera.near = d / 50; camera.far = d * 20; scene.fog.near = d * 1.6; scene.fog.far = d * 6; camera.updateProjectionMatrix(); camera.lookAt(c);
  const R = Math.max(s.x, s.z, 2) * 3;
  floor.scale.set(R * 80, R * 80, 1);
  sun.position.copy(c).add(new THREE.Vector3(R * 0.6, R * 1.2, R * 0.9)); sun.target.position.copy(c);
  Object.assign(sun.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 0.01, far: R * 6 }); sun.shadow.camera.updateProjectionMatrix();
}
function placePerson(g, view, show) {
  person.visible = !!show;
  const U = g.userData, w = U.width, L = U.length;
  if (view === "side") person.position.set(-0.3, 0, -(L / 2 + 0.6)); else person.position.set(-(w / 2 + 0.75), 0, -(L / 2 + 0.5));
  person.rotation.y = view === "side" ? Math.PI / 2 : 0.3;
}
const shot = (q = 0.9) => renderer.domElement.toDataURL("image/jpeg", q);

window.still = ({ species, variant, view = "3/4", size = 720, person: withPerson = true }) => {
  renderer.setSize(size, size, false);
  const g = makeAnimal({ species, variant }); scene.add(g);
  try {
    animateAnimal(g, "idle", 0.2);
    placePerson(g, view, withPerson);
    frame(g, DIRS[view] ?? DIRS["3/4"], 1.15);
    renderer.render(scene, camera);
    return shot();
  } finally { scene.remove(g); }
};

// the loop length: a whole number of gait cycles near the asked length, so the clip loops without a hitch
window.loopLen = ({ species, variant, act, want = 2.5 }) => {
  const g = makeAnimal({ species, variant });
  let f = 0;
  if (act === "fly") f = Math.min(4, Math.max(0.25, 2.2 / Math.sqrt(g.userData.size)));
  else if (["walk", "run", "swim", "slither", "crawl"].includes(act)) f = animalGait(g, act === "swim" || act === "slither" || act === "crawl" ? "walk" : act).cadence;
  if (!(f > 0)) return want;
  let n = Math.max(1, Math.round(want * f)), d = n / f;
  while (d > 3.5 && n > 1) { n--; d = n / f; }
  while (d < 1.8) { n++; d = n / f; }
  return d;
};

window.clip = ({ species, variant, act = "walk", t0 = 0, dur = 2.5, fps = 24, size = 512, opts = {}, view = "3/4" }) => {
  renderer.setSize(size, size, false);
  const g = makeAnimal({ species, variant }); scene.add(g);
  try {
    person.visible = false;
    // frame once over the union of a few poses of the clip, then keep the camera still
    const box = new THREE.Box3();
    for (let k = 0; k < 6; k++) { animateAnimal(g, act, t0 + (dur * k) / 6, { dur, ...opts }); g.updateMatrixWorld(true); box.union(visBox(g)); }
    const dir = view === "side" ? new THREE.Vector3(0.95, 0.22, 0.55) : view === "high" ? new THREE.Vector3(0.7, 0.9, 0.6) : DIRS[view] ?? DIRS["3/4"];
    frame(g, dir, 1.15, box);
    const n = Math.round(dur * fps), out = [];
    for (let i = 0; i < n; i++) { animateAnimal(g, act, t0 + i / fps, { dur, ...opts }); renderer.render(scene, camera); out.push(shot(0.88)); }
    return out;
  } finally { scene.remove(g); }
};
window.SPECIES = Object.fromEntries(Object.entries(ANIMAL_SPECIES).map(([k, v]) => [k, { plan: v.plan, variants: Object.keys(v.variants ?? {}) }]));
window.ready = true;
