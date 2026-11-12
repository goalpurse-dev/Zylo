// Stand-in for page/kit/monsters.js: a tall dark box with two glowing eyes; sways, rises on "reveal".
import * as THREE from "three";
export function makeMonster(spec) {
  const g = new THREE.Group(), h = spec.type === "furry" ? 2.6 : 4.5;
  const body = new THREE.Mesh(new THREE.BoxGeometry(spec.type === "furry" ? 1.8 : 0.7, h, 0.6), new THREE.MeshStandardMaterial({ color: "#1b1820" }));
  body.position.y = h / 2; body.castShadow = true; g.add(body);
  for (const x of [-0.15, 0.15]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.07), new THREE.MeshBasicMaterial({ color: new THREE.Color(spec.glow ?? "#9be8ff").multiplyScalar(4) })); e.position.set(x, h - 0.3, 0.31); g.add(e); }
  g.userData.body = body;
  return g;
}
export function animateMonster(m, state, t) { m.userData.body.rotation.z = Math.sin(t * 1.3) * 0.05; m.scale.setScalar(state === "reveal" ? Math.min(1, 0.7 + t * 0.3) : 1); }
