// Free measurement on existing videos:
// 1. camera framings per 10 s: frame-to-frame camera pan + zoom estimated at 12 fps (brute-force alignment on
//    small grey frames), accumulated into a camera path; a new framing starts when the view has moved more than
//    a third of the frame or zoomed more than 1.4x from where the current framing started, or on a hard cut.
// 2. fine detail vs big simple shapes: share of each frame (1 fps, 540x960 grey) whose 8x8 blocks carry strong
//    fine texture (high-pass energy after a 5x5 blur).
import fs from "node:fs";
import { execFileSync } from "node:child_process";
const [ff, outFile] = process.argv.slice(2);
const R = "C:/Users/Public/Zylo/research/seamless-niche";
const VIDEOS = [
  ["pool (creator, 9.4M views)", `${R}/video1,9.4mview.mp4`],
  ["road (creator, 2.2M views)", `${R}/2.2mviews.mp4`],
  ["test 3 (P-Video-2)", `${R}/test3.mp4`],
  ["test 3b (P-Video-2, voice A)", `${R}/test3b.mp4`],
  ["test 3 stills (code camera)", `${R}/test3_stills.mp4`],
];
const gray = (file, fps, w, h) => execFileSync(ff, ["-v", "error", "-i", file, "-vf", `fps=${fps},scale=${w}:${h},format=gray`, "-f", "rawvideo", "-"], { maxBuffer: 1 << 30 });

function motion(file) {
  const W = 90, H = 160, N = W * H, buf = gray(file, 12, W, H), n = Math.floor(buf.length / N);
  const fr = (i) => buf.subarray(i * N, (i + 1) * N);
  const zooms = [0.96, 0.97, 0.98, 0.99, 1, 1.01, 1.02, 1.03, 1.04];
  const steps = [];
  for (let i = 1; i < n; i++) {
    const a = fr(i - 1), b = fr(i);
    let best = { e: Infinity };
    for (const z of zooms) for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      let e = 0, c = 0;
      for (let y = 20; y < H - 20; y += 2) for (let x = 12; x < W - 12; x += 2) {
        // b(x,y) ~ a(centre + (p - centre)/z - d)
        const sx = Math.round(W / 2 + (x - W / 2) / z - dx), sy = Math.round(H / 2 + (y - H / 2) / z - dy);
        if (Math.abs(b[y * W + x] - a[sy * W + sx]) > 10) e++; c++; // robust: share of pixels that do NOT match (moving objects do not pull the estimate)
      }
      e /= c;
      if (e < best.e) best = { e, dx, dy, z };
    }
    steps.push(best);
  }
  // camera path: pan in frame widths (of the current view), zoom as log
  let px = 0, py = 0, lz = 0, anchor = { px: 0, py: 0, lz: 0 }, framings = [{ t: 0, why: "start" }];
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i], t = (i + 1) / 12;
    const lastT = framings.at(-1).t, cut = s.e > 0.65 && t - lastT > 1; // most pixels unmatched = a cut or a morph (bursts within 1 s count once)
    px -= s.dx / W; py -= s.dy / W; lz += Math.log(s.z);
    const moved = Math.hypot(px - anchor.px, py - anchor.py), zoomed = Math.abs(lz - anchor.lz);
    if (cut || moved > 0.35 || zoomed > Math.log(1.4)) {
      framings.push({ t: +t.toFixed(2), why: cut ? "cut/morph" : moved > 0.35 ? "pan" : "zoom" });
      anchor = { px, py, lz };
    }
  }
  const dur = n / 12;
  const still = steps.filter((s) => s.dx === 0 && s.dy === 0 && s.z === 1).length / steps.length;
  return { durationSec: +dur.toFixed(1), framings: framings.length, per10s: +((framings.length / dur) * 10).toFixed(2), cuts: framings.filter((f) => f.why === "cut/morph").length, stillShare: +still.toFixed(2), list: framings };
}

function detail(file) {
  const W = 540, H = 960, N = W * H, buf = gray(file, 1, W, H), n = Math.floor(buf.length / N);
  const blur = new Float32Array(N), tmp = new Float32Array(N);
  let fineSum = 0, flatSum = 0, hfSum = 0, chFine = 0, chBlocks = 0; let prev = null;
  for (let k = 0; k < n; k++) {
    const f = buf.subarray(k * N, (k + 1) * N);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let s = 0; for (let d = -2; d <= 2; d++) s += f[y * W + Math.min(W - 1, Math.max(0, x + d))]; tmp[y * W + x] = s / 5; }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let s = 0; for (let d = -2; d <= 2; d++) s += tmp[Math.min(H - 1, Math.max(0, y + d)) * W + x]; blur[y * W + x] = s / 5; }
    let fine = 0, flat = 0, blocks = 0, hf = 0;
    for (let by = 0; by < H; by += 8) for (let bx = 0; bx + 8 <= W; bx += 8) {
      let e = 0;
      for (let y = by; y < by + 8; y++) for (let x = bx; x < bx + 8; x++) e += Math.abs(f[y * W + x] - blur[y * W + x]);
      e /= 64; hf += e; blocks++;
      if (prev) { let m = 0; for (let y = by; y < by + 8; y += 2) for (let x = bx; x < bx + 8; x += 2) m += Math.abs(f[y * W + x] - prev[y * W + x]); if (m / 16 > 15) { chBlocks++; if (e > 6) chFine++; } }
      if (e > 6) fine++; else if (e < 2.5) flat++;
    }
    prev = Uint8Array.from(f);
    fineSum += fine / blocks; flatSum += flat / blocks; hfSum += hf / blocks;
  }
  return { fineDetailShare: +(fineSum / n).toFixed(3), smoothShare: +(flatSum / n).toFixed(3), meanTexture: +(hfSum / n).toFixed(2), changingFineShare: +(chFine / Math.max(1, chBlocks)).toFixed(3), frames: n };
}

const results = {};
for (const [label, file] of VIDEOS) {
  const m = motion(file), d = detail(file);
  results[label] = { ...m, ...d };
  console.log(label, "| framings", m.framings, "in", m.durationSec, "s =", m.per10s, "per 10 s | cuts/morphs", m.cuts, "| camera still", m.stillShare, "| fine detail", d.fineDetailShare, "smooth", d.smoothShare, "texture", d.meanTexture, "| fine detail in the parts that change", d.changingFineShare);
}
fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
