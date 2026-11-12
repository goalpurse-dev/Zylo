// Stand-in for page/kit/people.js (engine tests only): a coloured box body + a head that bobs on cycle poses.
import * as THREE from "three";
import { rng } from "/lib/rng.js";
export const POSES = ["stand", "walk", "run", "point", "scared", "sit", "carry", "wave", "look_up", "talk", "sleep", "cheer"];
export const EXPRS = ["neutral", "happy", "sad", "scared", "surprised", "angry", "sleepy", "smirk", "cry", "excited", "shush"];
const FACE = { neutral: "#ffffff", happy: "#ffe04d", sad: "#5aa0ff", scared: "#c0ff9a", surprised: "#ffb0f0", angry: "#ff4030", excited: "#ff9a20" };
export function makePerson(spec) {
  const r = rng(spec.seed ?? 1), h = spec.role === "kid" ? 1.2 : 1.75, g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, h * 0.7, 0.3), new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(r(), 0.6, 0.5) }));
  body.position.y = h * 0.35; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), new THREE.MeshStandardMaterial({ color: "#f1c27d" }));
  head.position.y = h * 0.85; head.castShadow = true; g.add(head);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.12), new THREE.MeshBasicMaterial({ color: "#ffffff" }));
  face.position.set(0, h * 0.85, 0.171); g.add(face);
  g.userData = { h, head, face };
  return g;
}
export function posePerson(p, pose, t) {
  const cyc = ["walk", "run", "talk", "wave", "cheer"].includes(pose);
  p.userData.head.position.y = p.userData.h * 0.85 + (cyc ? Math.abs(Math.sin(t * 6)) * 0.06 : 0);
  p.userData.head.rotation.z = pose === "scared" ? 0.25 : 0;
}
export function setFace(p, expr) { p.userData.face.material.color.set(FACE[expr] ?? "#888888"); }
export function personHeight(p) { return p.userData.h; }
