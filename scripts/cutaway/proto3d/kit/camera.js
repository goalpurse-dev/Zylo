// M2 kit: the camera director's path. Keys are [time, position, target]; a monotone cubic through each axis gives
// slow drift between close keys and a fast move with a quick stop between far ones, never an overshoot.
import { clamp01 } from "./verbs.js";

function monotone(xs, ys) {
  const n = xs.length, d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (3 * (xs[i + 1] - xs[i - 1])) / ((2 * xs[i + 1] - xs[i] - xs[i - 1]) / d[i - 1] + (xs[i + 1] + xs[i] - 2 * xs[i - 1]) / d[i]);
  return (x) => {
    let i = 0; while (i < n - 2 && x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], u = clamp01((x - xs[i]) / h);
    return (2 * u ** 3 - 3 * u ** 2 + 1) * ys[i] + (u ** 3 - 2 * u ** 2 + u) * h * m[i] + (-2 * u ** 3 + 3 * u ** 2) * ys[i + 1] + (u ** 3 - u ** 2) * h * m[i + 1];
  };
}

export function cameraPath(keys) {
  const ks = [...keys].sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < ks.length; i++) if (ks[i][0] - ks[i - 1][0] < 0.05) throw new Error(`camera keys too close at ${ks[i][0]}`);
  const T = ks.map((k) => k[0]);
  const pos = [0, 1, 2].map((a) => monotone(T, ks.map((k) => k[1][a])));
  const tgt = [0, 1, 2].map((a) => monotone(T, ks.map((k) => k[2][a])));
  return { apply(camera, t) { camera.position.set(pos[0](t), pos[1](t), pos[2](t)); camera.lookAt(tgt[0](t), tgt[1](t), tgt[2](t)); } };
}
