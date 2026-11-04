// Blocky Worlds: the check still for a newly built object or world (lib/builder/still.mjs drives it in headless Chrome;
// in production it runs inside the prepare job, whose GPU worker already has Chrome).
//   window.renderStill({ kind: "object" | "world", spec, light = "day", size = 768, person = kind === "world" })
//     -> { data: JPEG data URL, w, h, problems, ms }
//   object: on a neutral pavement with the locked light + post, a 3/4 view framed by its size (square, size x size)
//   world:  the wide establishing shot of the engine (camera.js "wide" on the centre spot, 9:16 at size tall), with one
//           kid at the centre for scale, as the video will show it
// window.stillReady = true once the modules are loaded; window.stillError on a load failure.
import * as THREE from "three";
import { makeRenderer, makePost } from "/page/post.js";
import { applyLight, preloadEnv } from "/page/lighting.js";
import { buildBlueprint, animateBlueprint } from "/page/kit/blueprint.js";
import { buildWorld } from "/page/sets/worldspec.js";
import { frameShot } from "/page/camera.js";
import { makeKit } from "/page/sets/util.js";

let people = null;
const LM = THREE.DefaultLoadingManager, pending = { done: 0, total: 0 };
LM.onStart = (u, l, t) => { pending.done = l; pending.total = t; };
LM.onProgress = (u, l, t) => { pending.done = l; pending.total = t; };
const settle = async () => { const t0 = performance.now(); while (pending.done < pending.total && performance.now() - t0 < 60000) await new Promise((r) => setTimeout(r, 40)); };

async function renderStill({ kind, spec, light = "day", size = 768, person = kind === "world" }) {
  const t0 = performance.now();
  const W = kind === "world" ? Math.round(size * 9 / 16) : size, H = size;
  const renderer = makeRenderer(W, H);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(35, W / H, 0.1, 3000);
  scene.add(camera);
  const post = makePost({ renderer, scene, camera, W, H });
  let set, problems = [];
  try {
    if (kind === "world") {
      set = await buildWorld(spec, { THREE, scene, renderer });
      problems = set.problems ?? [];
      set.name = "world";
    } else {
      const root = new THREE.Group(); scene.add(root);
      const K = makeKit({ THREE }, root);
      K.plane(80, 80, K.pbr("concrete_pavement", { repeat: [24, 24], tint: "#eae4da" }), { y: 0, keep: true, cast: false });
      const o = buildBlueprint(spec);
      problems = o.userData.problems ?? [];
      animateBlueprint(o, 0.6);
      root.add(o);
      const u = o.userData, r = Math.max(0.35, 0.5 * Math.hypot(u.width, u.height, u.depth));
      set = { root, rig: { shadow: { center: [0, 0, -u.depth / 2], half: Math.max(4, r * 2.5), far: 160 }, fog: { day: ["#9cc8ec", 400, 3000], night: ["#16244c", 200, 900], warm: ["#f0a06a", 400, 3000] } }, spots: { center: new THREE.Vector3() } };
      const fov = 32, yaw = 28 * Math.PI / 180, el = 16 * Math.PI / 180;
      const target = new THREE.Vector3(0, u.height * 0.5, -u.depth / 2);
      const dist = (r / Math.sin((fov * Math.PI) / 360)) * 1.08;
      camera.fov = fov; camera.near = Math.max(0.02, dist / 200);
      camera.position.copy(target).add(new THREE.Vector3(Math.sin(yaw) * Math.cos(el), Math.sin(el), Math.cos(yaw) * Math.cos(el)).multiplyScalar(dist));
      camera.position.y = Math.max(camera.position.y, 0.3);
      camera.lookAt(target); camera.updateProjectionMatrix();
    }
    if (person && kind === "world") {
      people ??= await import("/page/kit/people.js");
      const p = people.makePerson({ id: "me", role: "kid", name: "Pip", seed: 3 });
      p.position.copy(set.spots.center); scene.add(p);
      people.posePerson(p, "look_up", 0.4); people.setFace(p, "surprised");
      frameShot("wide", { THREE, camera, set, focus: set.spots.center.clone(), focusHeight: people.personHeight(p), t: 0, dur: 1, seed: 3 });
      p.rotation.y = Math.atan2(camera.position.x - p.position.x, camera.position.z - p.position.z);
    } else if (kind === "world") frameShot("wide", { THREE, camera, set, focus: set.spots.center.clone(), focusHeight: 1.3, t: 0, dur: 1, seed: 3 });
    await preloadEnv(THREE);
    await settle();
    const handle = applyLight(light, { THREE, scene, renderer, set });
    post.setLight(light);
    set.update?.(1.0);
    post.render(); post.render();
    const data = renderer.domElement.toDataURL("image/jpeg", 0.88);
    handle.dispose();
    return { data, w: W, h: H, problems, ms: Math.round(performance.now() - t0) };
  } finally {
    renderer.dispose(); renderer.forceContextLoss?.();
  }
}

try {
  window.renderStill = renderStill;
  window.stillReady = true;
} catch (e) { window.stillError = String(e?.stack ?? e); }
