// Style test: camera shots as continuous eased moves in the subject's own frame (it tracks the walking animal).
// shot: { t0, t1, from: [x,y,z], to: [x,y,z], look0: [x,y,z], look1: [x,y,z], fov0, fov1 } (subject-local metres,
// +z = the way it faces). The move never stops inside a shot (half linear, half smoothstep), so it reads as a
// steady dolly / crane / push with soft starts, never a whip. Between shots: a straight cut, like the target.
import * as THREE from "three";

const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
export function ease(u) { u = Math.min(1, Math.max(0, u)); return 0.45 * u + 0.55 * u * u * (3 - 2 * u); }

/** frame: { position: Vector3, yaw } of the subject at time t; sets camera; returns the shot index */
export function placeShot(camera, shots, t, frame) {
  let i = shots.findIndex((s) => t >= s.t0 && t < s.t1); if (i < 0) i = t < shots[0].t0 ? 0 : shots.length - 1;
  const s = shots[i], e = ease((t - s.t0) / (s.t1 - s.t0));
  const m = new THREE.Matrix4().makeRotationY(frame.yaw).setPosition(frame.position);
  const p = v3(s.from).lerp(v3(s.to), e).applyMatrix4(m);
  const l = v3(s.look0).lerp(v3(s.look1 ?? s.look0), e).applyMatrix4(m);
  camera.position.copy(p); camera.up.set(0, 1, 0); camera.lookAt(l);
  if (s.roll) camera.rotateZ(s.roll * (e - 0.5));
  camera.fov = (s.fov0 ?? 50) + ((s.fov1 ?? s.fov0 ?? 50) - (s.fov0 ?? 50)) * e; camera.updateProjectionMatrix();
  return i;
}
