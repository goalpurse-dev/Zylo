// Stand-in for page/sets/index.js: a coloured ground plane + a back wall per set, a sun + hemisphere per light.
import * as THREE from "three";
export const SETS = ["street", "bedroom", "school", "woods"];
const COL = { street: "#7a7f86", bedroom: "#b08a66", school: "#9fb3c8", woods: "#4f7a3a" };
export async function buildSet(name, { scene }) {
  const root = new THREE.Group();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: COL[name] ?? "#888" }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; root.add(ground);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(20, 6, 0.3), new THREE.MeshStandardMaterial({ color: "#d9c7a3" }));
  wall.position.set(0, 3, -12); wall.receiveShadow = true; root.add(wall);
  scene.add(root);
  const v = (x, z) => new THREE.Vector3(x, 0, z);
  return { root, indoor: name === "bedroom" || name === "school", spots: { center: v(0, 0), left: v(-1.6, 0.3), right: v(1.6, 0.3), back: v(0, -2.5), far: v(0, -9), door: v(3.5, -3) } };
}
export function applyLight(name, { scene, renderer }) {
  const night = name === "night";
  const hemi = new THREE.HemisphereLight(night ? "#5570aa" : "#cfe3ff", "#4a3a2a", night ? 0.6 : 1.4);
  const sun = new THREE.DirectionalLight(night ? "#9ab4ff" : name === "warm" ? "#ffb070" : "#fff4e0", night ? 0.8 : 2.6);
  sun.position.set(6, 10, 6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12 });
  scene.background = new THREE.Color(night ? "#0b1024" : name === "warm" ? "#f2a66a" : "#9cc8f0");
  scene.add(hemi, sun);
  renderer.toneMappingExposure = night ? 0.95 : 0.86;
  return { dispose() { scene.remove(hemi, sun); sun.dispose(); } };
}
