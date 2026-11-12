// Stand-in for page/camera.js: a fixed distance per shot type in front of the focus, a slow push-in over the shot.
export function frameShot(type, { camera, focus, focusHeight = 1.7, t = 0, dur = 1 }) {
  const dist = { wide: 9, medium: 4.5, closeup: 2.2, low: 4, over_shoulder: 3.5, insert: 2.4 }[type] ?? 6;
  const k = 1 - 0.08 * Math.min(1, t / Math.max(dur, 0.01));
  const eye = type === "low" ? 0.5 : focusHeight * 0.85;
  camera.fov = 50; camera.updateProjectionMatrix();
  camera.position.set(focus.x, focus.y + eye, focus.z + dist * k);
  camera.lookAt(focus.x, focus.y + focusHeight * (type === "wide" ? 0.6 : 0.75), focus.z);
}
