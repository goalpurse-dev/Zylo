// ANIMALS contact sheets (BLOCKY-ANIMALS agent, 2026-11-06): the blocky animal kit on a neutral grey studio floor with
// a small person for scale. Renders cell by cell into one composite canvas.
//   ?sheet=views&list=dog,cat:husky,...&cols=3&cell=300     each animal from the 3/4 front, the FRONT and the SIDE
//   ?sheet=motion&list=turtle,wolf,...&cell=220               a strip of motion frames per animal (walk/run/fly/swim/roar...)
import * as THREE from "three";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { makeAnimal, animateAnimal, ANIMAL_SPECIES, actionsOf } from "/page/kit/animals/index.js";
import { makePerson, posePerson } from "/page/kit/people.js";

const Q = new URLSearchParams(location.search);
const SHEET = Q.get("sheet") ?? "views", CELL = Number(Q.get("cell") ?? 300), COLS = Number(Q.get("cols") ?? 3);
const LIST = (Q.get("list") ?? Object.keys(ANIMAL_SPECIES).join(",")).split(",").filter(Boolean).map((s) => { const [species, variant] = s.split(":"); return { species, variant }; });
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(CELL, CELL, false); renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95; renderer.outputColorSpace = THREE.SRGBColorSpace;
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

const out = document.createElement("canvas"); const P = out.getContext("2d");
function frame(g, dir, pad = 1.15, onlyAnimal = true) {
  g.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(g); if (!onlyAnimal) b.union(new THREE.Box3().setFromObject(person));
  const c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3());
  const r = Math.max(s.x, s.y, s.z) * 0.62 * pad;
  const d = r / Math.tan((camera.fov * Math.PI) / 360);
  camera.position.copy(c).addScaledVector(dir.clone().normalize(), d);
  camera.near = d / 50; camera.far = d * 20; scene.fog.near = d * 1.6; scene.fog.far = d * 6; camera.updateProjectionMatrix(); camera.lookAt(c);
  const R = Math.max(s.x, s.z, 2) * 3;
  floor.scale.set(R * 80, R * 80, 1);
  sun.position.copy(c).add(new THREE.Vector3(R * 0.6, R * 1.2, R * 0.9)); sun.target.position.copy(c);
  Object.assign(sun.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 0.01, far: R * 6 }); sun.shadow.camera.updateProjectionMatrix();
}
function label(x, y, w, text, small = false) {
  P.fillStyle = "rgba(20,22,28,0.72)"; P.fillRect(x, y, w, small ? 22 : 30);
  P.fillStyle = "#fff"; P.font = `${small ? 14 : 20}px "Arial Black", sans-serif`; P.textBaseline = "middle"; P.fillText(text, x + 8, y + (small ? 11 : 15));
}

if (SHEET === "views") {
  const VIEWS = [["3/4", new THREE.Vector3(0.75, 0.32, 0.85)], ["front", new THREE.Vector3(0, 0.18, 1)], ["side", new THREE.Vector3(1, 0.12, 0)]];
  const rows = Math.ceil(LIST.length / COLS);
  out.width = COLS * CELL * 3 + (COLS - 1) * 12; out.height = rows * CELL;
  P.fillStyle = "#2a2d33"; P.fillRect(0, 0, out.width, out.height);
  LIST.forEach((a, i) => {
    const g = makeAnimal({ species: a.species, variant: a.variant }); scene.add(g);
    animateAnimal(g, "idle", 0.2);
    const U = g.userData;
    VIEWS.forEach(([name, dir], v) => {
      // the person for scale: beside the animal, out of the way of this view
      const w = U.width, L = U.length;
      if (name === "side") person.position.set(-0.3, 0, -(L / 2 + 0.6)); else person.position.set(-(w / 2 + 0.75), 0, -(L / 2 + 0.5));
      person.rotation.y = name === "side" ? Math.PI / 2 : 0.3;
      frame(g, dir, 1.12);
      renderer.render(scene, camera);
      const x = (i % COLS) * (CELL * 3 + 12) + v * CELL, y = Math.floor(i / COLS) * CELL;
      P.drawImage(renderer.domElement, x, y);
      if (v === 0) label(x, y, CELL * 3, `${i + 1}. ${U.species}${U.variant && U.variant !== Object.keys(ANIMAL_SPECIES[U.species].variants)[0] ? " (" + U.variant + ")" : ""}`);
      label(x, y + CELL - 22, 60, name, true);
    });
    scene.remove(g);
  });
} else if (SHEET === "giants") {
  // giants on the blocky rigs at 60 m with their own towns (shell / back) or an asked back town (backTown.js)
  const { makeGiant, animateGiant } = await import("/page/kit/giants.js");
  const { addBackTown } = await import("/page/kit/backTown.js");
  const kinds = (Q.get("kinds") ?? "turtle,whale,snail,elephant,bear:town,eagle:town").split(",");
  out.width = COLS * CELL; out.height = Math.ceil(kinds.length / COLS) * CELL;
  kinds.forEach((k, i) => {
    const [kind, extra] = k.split(":");
    const g = makeGiant({ kind, size: 60, seed: 3, lit: extra === "lit" });
    if (extra === "town" || extra === "castle") addBackTown(g, { style: extra === "castle" ? "castle" : "town", seed: 4 });
    scene.add(g); animateGiant(g, Q.get("act") ?? "walk", 0.7);
    person.position.set(g.userData.width / 2 + 3, 0, g.userData.length / 2); person.rotation.y = 0;
    frame(g, new THREE.Vector3(0.8, 0.45, 0.75), 1.05);
    renderer.render(scene, camera);
    P.drawImage(renderer.domElement, (i % COLS) * CELL, Math.floor(i / COLS) * CELL);
    label((i % COLS) * CELL, Math.floor(i / COLS) * CELL, CELL, `${kind}${extra ? " + " + extra : ""} (60 m, ${g.userData.rigV2 ? "blocky rig" : "classic"})`, true);
    scene.remove(g);
  });
} else {
  // motion strips: per animal a row of frames over its key actions
  const STRIP = (sp) => {
    const acts = actionsOf(sp), f = [];
    const add = (a, ts) => { if (acts.includes(a)) for (const t of ts) f.push([a, t]); };
    add("walk", [0.0, 0.14, 0.28, 0.42]); add("run", [0.0, 0.16]);
    if (sp === "dragon" || ANIMAL_SPECIES[sp].plan === "bird") add("fly", [0.8, 0.95, 1.1]);
    if (["whale", "turtle", "dog"].includes(sp)) add("swim", [0.3, 0.6]);
    if (sp === "snail") add("crawl", [0.4, 0.8]);
    add("roar", [0.6]); add("attack", [0.4, 0.62]); add("stomp", [0.5]); add("sleep", [1.2]);
    return f.slice(0, 12);
  };
  const strips = LIST.map((a) => ({ a, frames: STRIP(a.species) }));
  const cols = Math.max(...strips.map((s) => s.frames.length));
  out.width = cols * CELL; out.height = strips.length * CELL;
  P.fillStyle = "#2a2d33"; P.fillRect(0, 0, out.width, out.height);
  person.visible = false;
  strips.forEach(({ a, frames }, r) => {
    const g = makeAnimal({ species: a.species, variant: a.variant }); scene.add(g);
    animateAnimal(g, "idle", 0); frame(g, new THREE.Vector3(0.95, 0.22, 0.55), 1.35);
    const camPos = camera.position.clone(), camQ = camera.quaternion.clone();
    frames.forEach(([act, t], c) => {
      animateAnimal(g, act, t, { dur: 3, hitAt: 0.6 });
      camera.position.copy(camPos); camera.quaternion.copy(camQ);
      if (act === "fly") { g.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(g); const cc = b.getCenter(new THREE.Vector3()); camera.lookAt(cc); }
      renderer.render(scene, camera);
      P.drawImage(renderer.domElement, c * CELL, r * CELL);
      label(c * CELL, r * CELL + CELL - 22, CELL, `${c === 0 ? a.species + " · " : ""}${act} ${t.toFixed(2)}s`, true);
    });
    scene.remove(g);
  });
}
window.snapshot = () => out.toDataURL("image/jpeg", 0.9);
window.ready = true;
