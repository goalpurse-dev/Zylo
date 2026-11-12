// Style test: the free rigged wolf (Quaternius, CC0 per Poly Pizza; low-poly, flat colours) made furrier with shell
// fur (N inflated copies of the skinned mesh, strands cut by a 3D hash of the rest position: the model has no UVs).
// makeWolf(renderer, height) -> { root, pose(t, pos, yaw), spineWorld(), pitch(), back: { w, len, y } }
import * as THREE from "three";
import { loadGltf, A, groundH } from "./world.js";

const LAYERS = 14;

function furMaterial(base, layer, len, density) {
  const m = new THREE.MeshStandardMaterial({ color: base.color.clone(), roughness: 0.95, metalness: 0 });
  const f = layer / LAYERS;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uF = { value: f }; sh.uniforms.uLen = { value: len }; sh.uniforms.uDen = { value: density };
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nuniform float uF, uLen; varying vec3 vRest;")
      .replace("#include <skinning_vertex>", "#include <skinning_vertex>\nvRest = position; transformed += normalize(objectNormal) * uF * uLen;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform float uF, uDen; varying vec3 vRest;\nfloat h31(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }")
      .replace("#include <color_fragment>", `#include <color_fragment>
        vec3 cell = floor(vRest * uDen); vec3 fr = fract(vRest * uDen) - 0.5;
        float r = h31(cell), thick = (1.0 - uF) * 0.55 + 0.05;
        if (uF > 0.0 && (r < uF * 0.9 || length(fr.xz) > thick)) discard;
        diffuseColor.rgb *= mix(0.35, 1.25, uF) * (0.85 + 0.3 * h31(cell + 7.0));`);
  };
  return m;
}

export async function makeWolf(renderer, height = 26) {
  const gltf = await loadGltf(`${A}/wolf_a/Wolf.glb`);
  const model = gltf.scene, root = new THREE.Group(); root.add(model);
  const mixer = new THREE.AnimationMixer(model);
  const clip = gltf.animations.find((a) => a.name === "Walk") ?? gltf.animations[0];
  const action = mixer.clipAction(clip); action.play(); mixer.setTime(0);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3());
  const s = height / size.y; model.scale.setScalar(s); model.position.y = -box.min.y * s;
  // shell fur on every skinned mesh (skip eyes / nose)
  const skinned = []; model.traverse((o) => { if (o.isSkinnedMesh) skinned.push(o); });
  for (const sm of skinned) {
    sm.castShadow = sm.receiveShadow = true; sm.frustumCulled = false;
    const mats = Array.isArray(sm.material) ? sm.material : [sm.material];
    sm.geometry.computeBoundingBox(); const lsz = sm.geometry.boundingBox.getSize(new THREE.Vector3()).length();
    const furMats = (layer) => mats.map((m) => (/eye|nose/i.test(m.name) ? Object.assign(m.clone(), { visible: layer === 0 }) : furMaterial(m, layer, lsz * 0.016, 2600 / lsz * 0.06)));
    sm.material = Array.isArray(sm.material) ? furMats(0) : furMats(0)[0];
    for (let k = 1; k <= LAYERS; k++) {
      const shell = new THREE.SkinnedMesh(sm.geometry, Array.isArray(sm.material) ? furMats(k) : furMats(k)[0]);
      shell.bind(sm.skeleton, sm.bindMatrix); shell.frustumCulled = false; shell.castShadow = k < 3; shell.receiveShadow = true;
      sm.parent.add(shell); shell.position.copy(sm.position); shell.quaternion.copy(sm.quaternion); shell.scale.copy(sm.scale);
    }
  }
  // glowing red eyes like the target
  model.traverse((o) => { if (o.isMesh) { const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) if (/eye/i.test(m.name)) { m.color?.set("#ff2a10"); m.emissive?.set("#ff1a00"); m.emissiveIntensity = 3; } } });
  let spine = null; model.traverse((o) => { if (o.isBone && o.name === "Torso2") spine = o; });
  model.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(model), sp = spine.getWorldPosition(new THREE.Vector3());
  const back = { w: (b2.max.x - b2.min.x) * 0.8, len: (b2.max.z - b2.min.z) * 0.42, y: (b2.max.y - b2.min.y) * 0.66 - sp.y + 0.6 };
  const restSpine = sp.clone();
  return {
    root, back, size: b2.getSize(new THREE.Vector3()),
    pose(t, pos, yaw) { mixer.setTime(t * 0.85); root.position.set(pos.x, groundH(pos.x, pos.z), pos.z); root.rotation.y = yaw; root.updateMatrixWorld(true); },
    spineWorld() { const p = spine.getWorldPosition(new THREE.Vector3()); return p; },
    pitch() { return 0; },
    restSpine,
  };
}
