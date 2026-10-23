// Test 3 without AI video ($0): the existing wide images + keyframe upscales, a slow code-made camera,
// crossfades between states while the camera keeps drifting, and a subtle 2.5D parallax from a local
// depth map (Depth Anything V2 small). Audio = test3b's mix_20 (voice A, effects and chime 20 dB under),
// captions and number cards = test3b's captions.ass.
import fs from "node:fs";
import { execFileSync, spawn } from "node:child_process";

const [ff, PARALLAX = "1"] = process.argv.slice(2);
const R = "C:/Users/Public/Zylo/research/seamless-niche";
const RUN = `${R}/work/cutaway-test3/run3`;
const OUT = `${R}/work/stills`;
const s = JSON.parse(fs.readFileSync(`${RUN}/state.json`, "utf8"));
const t3b = JSON.parse(fs.readFileSync(`${R}/test3b/test3b.json`, "utf8"));
const B = t3b.placed.map((b) => ({ ...b, verbAt: b.start + b.verbAt })); // beats: start, end, verbAt (made absolute)
const LEN = t3b.lengthSec;
const FPS = 24, OW = 1080, OH = 1920;
const SW = 768, SH = 1376, K = 2, CW = SW * K, CH = SH * K; // canvas = wide image at 2x
const WIDE = { W0: "wide-W0-1.jpg", W1: "wide-W1-2.jpg", W2: "wide-W2-1.jpg", W3: "wide-W3-1.jpg", W4: "wide-W4-1.jpg" }; // the images test 3's clips came from (hash-matched)

const raw = (file, w, h, fmt = "rgb24") => execFileSync(ff, ["-v", "error", "-i", file, "-vf", `scale=${w}:${h}:flags=lanczos`, "-f", "rawvideo", "-pix_fmt", fmt, "-"], { maxBuffer: 1 << 30 });

// ---- canvases: the wide image at 2x with the crisp keyframe upscales pasted in where they are plain crops ----
const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const canvases = {}, depths = {};
const pasteLog = [];
for (const [st, file] of Object.entries(WIDE)) {
  const c = Buffer.from(raw(`${RUN}/${file}`, CW, CH));
  const keys = s.keyframes.filter((k) => k.state === st && !k.edit && fs.existsSync(`${RUN}/key-${k.id}-up.jpg`)).sort((a, b) => b.box.w - a.box.w);
  for (const k of keys) {
    const bw = Math.round(k.box.w * CW), bh = Math.round((bw * 16) / 9), bx = Math.round(k.box.x * CW), by = Math.round(k.box.y * CH);
    if (bx < 0 || by < 0 || bx + bw > CW || by + bh > CH) { pasteLog.push({ id: k.id, st, skipped: "outside" }); continue; }
    const p = raw(`${RUN}/key-${k.id}-up.jpg`, bw, bh);
    // only paste if the upscale still matches the wide image (mean abs difference on a coarse grid)
    let diff = 0, n = 0;
    for (let y = 0; y < bh; y += 8) for (let x = 0; x < bw; x += 8) { const i = (y * bw + x) * 3, j = ((by + y) * CW + bx + x) * 3; diff += Math.abs(p[i] - c[j]) + Math.abs(p[i + 1] - c[j + 1]) + Math.abs(p[i + 2] - c[j + 2]); n += 3; }
    diff /= n;
    if (diff > 22) { pasteLog.push({ id: k.id, st, diff: +diff.toFixed(1), skipped: "does not match" }); continue; }
    const band = bw * 0.08;
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
      const a = smooth(Math.min(x, bw - 1 - x, y, bh - 1 - y) / band);
      if (a <= 0) continue;
      const i = (y * bw + x) * 3, j = ((by + y) * CW + bx + x) * 3;
      c[j] += (p[i] - c[j]) * a; c[j + 1] += (p[i + 1] - c[j + 1]) * a; c[j + 2] += (p[i + 2] - c[j + 2]) * a;
    }
    pasteLog.push({ id: k.id, st, diff: +diff.toFixed(1), pasted: true });
  }
  canvases[st] = c;
  const d16 = raw(`${OUT}/depth-${file.replace(".jpg", "")}.png`, SW, SH, "gray16le");
  const d = new Float32Array(SW * SH);
  for (let i = 0; i < d.length; i++) d[i] = d16.readUInt16LE(i * 2) / 65535;
  depths[st] = d;
}
console.log("pastes", JSON.stringify(pasteLog));

// ---- states over time: a crossfade at the verb that adds the part ----
const fades = [
  { from: "W0", to: "W1", at: B[2].verbAt - 0.3, dur: 1.6 }, // "So you LAY a thick clay base" (layout changes: a slower dissolve)
  { from: "W1", to: "W2", at: B[4].verbAt - 0.25, dur: 1.1 }, // "A pipe DRAINS collected juice into a tank" (pipe + tank appear)
  { from: "W2", to: "W3", at: B[7].verbAt - 0.25, dur: 1.1 }, // "so a pipe CARRIES it out" (gas pipe + flame)
  { from: "W3", to: "W4", at: B[9].verbAt - 0.3, dur: 1.6 }, // "Add a grass CAP" (layout changes)
];
function stateAt(t) {
  let cur = "W0";
  for (const f of fades) {
    if (t < f.at) return { a: cur };
    if (t < f.at + f.dur) return { a: f.from, b: f.to, mix: smooth((t - f.at) / f.dur) };
    cur = f.to;
  }
  return { a: cur };
}

// ---- camera: one main angle, slow eased moves; close only where the voice names a small part ----
// [time, centre x, centre y, width] as fractions of the wide image; view height = width * 0.992
const MAIN = [0.5, 0.57, 0.84];
const way = [
  [0, 0.5, 0.544, 0.92],
  [B[1].start, 0.47, 0.58, 0.84],
  [B[1].end - 0.2, 0.36, 0.68, 0.6], //  "leaks down into groundwater": the pit bottom
  [B[2].verbAt + 1.6, ...MAIN], //       back to the main angle as the liner fades in
  [B[3].end - 0.6, 0.52, 0.58, 0.8], //  "a plastic sheet ... liner": drift
  [B[4].end - 0.2, 0.62, 0.62, 0.6], //  "a pipe drains ... into a tank": pipe and tank
  [B[5].end - 0.4, 0.52, 0.58, 0.8], //  "sealed tight": main
  [B[6].start + 3.2, 0.5, 0.57, 0.54], // "a 1952 newspaper ... readable": the trash layers (card 37 YEARS)
  [B[6].end, 0.5, 0.57, 0.52],
  [B[7].end - 0.3, 0.5, 0.55, 0.78], // "trapped trash makes gas ... pipe carries it out"
  [B[8].start + 2.6, 0.47, 0.5, 0.58], // "that flame ... electricity": the flare (card 480 LANDFILLS)
  [B[8].end, 0.47, 0.5, 0.58],
  [B[9].verbAt + 2.4, 0.5, 0.55, 0.88], // "add a grass cap": pull back
  [LEN, 0.5, 0.53, 0.95],
];
// monotone cubic (Fritsch-Carlson) per channel: smooth, no overshoot, never stops dead mid-shot
function monotone(xs, ys) {
  const n = xs.length, d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (3 * (xs[i + 1] - xs[i - 1])) / ((2 * xs[i + 1] - xs[i] - xs[i - 1]) / d[i - 1] + (xs[i + 1] + xs[i] - 2 * xs[i - 1]) / d[i]);
  return (x) => {
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], u = Math.min(1, Math.max(0, (x - xs[i]) / h));
    const h00 = 2 * u ** 3 - 3 * u ** 2 + 1, h10 = u ** 3 - 2 * u ** 2 + u, h01 = -2 * u ** 3 + 3 * u ** 2, h11 = u ** 3 - u ** 2;
    return h00 * ys[i] + h10 * h * m[i] + h01 * ys[i + 1] + h11 * h * m[i + 1];
  };
}
const T = way.map((w) => w[0]);
const fx = monotone(T, way.map((w) => w[1])), fy = monotone(T, way.map((w) => w[2])), fw = monotone(T, way.map((w) => Math.log(w[3])));
function cam(t) {
  const w = Math.exp(fw(t)), h = w * 0.9922;
  const cx = Math.min(1 - w / 2, Math.max(w / 2, fx(t))), cy = Math.min(1 - h / 2, Math.max(h / 2, fy(t)));
  return { cx, cy, w };
}

// ---- render ----
const frames = Math.round(LEN * FPS);
const enc = spawn(ff, ["-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", `${OW}x${OH}`, "-r", String(FPS), "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", `${OUT}/stills-video.mp4`], { stdio: ["pipe", "inherit", "inherit"] });
const frame = Buffer.alloc(OW * OH * 3), tmp = Buffer.alloc(OW * OH * 3);
const PAR = PARALLAX === "1" ? 0.014 : 0; // parallax sway, as a share of the view width (near vs far)
function draw(st, c, t, out) {
  const src = canvases[st], dep = depths[st];
  const vw = c.w * CW, sc = vw / OW;
  const x0 = c.cx * CW - vw / 2, y0 = c.cy * CH - (vw * 16) / 9 / 2;
  const sway = PAR * vw * Math.sin((2 * Math.PI * t) / 17), swayY = PAR * 0.35 * vw * Math.sin((2 * Math.PI * t) / 23 + 1);
  let o = 0;
  for (let j = 0; j < OH; j++) {
    const py0 = y0 + (j + 0.5) * sc - 0.5;
    for (let i = 0; i < OW; i++) {
      let px = x0 + (i + 0.5) * sc - 0.5, py = py0;
      if (PAR) {
        const dx = Math.min(SW - 1, Math.max(0, (px / K) | 0)), dy = Math.min(SH - 1, Math.max(0, (py / K) | 0));
        const dd = dep[dy * SW + dx] - 0.5;
        px += dd * sway; py += dd * swayY;
      }
      if (px < 0) px = 0; else if (px > CW - 1.001) px = CW - 1.001;
      if (py < 0) py = 0; else if (py > CH - 1.001) py = CH - 1.001;
      const xi = px | 0, yi = py | 0, ax = px - xi, ay = py - yi;
      const p00 = (yi * CW + xi) * 3, p01 = p00 + 3, p10 = p00 + CW * 3, p11 = p10 + 3;
      for (let ch = 0; ch < 3; ch++) {
        const top = src[p00 + ch] + (src[p01 + ch] - src[p00 + ch]) * ax;
        const bot = src[p10 + ch] + (src[p11 + ch] - src[p10 + ch]) * ax;
        out[o++] = top + (bot - top) * ay;
      }
    }
  }
}
let maxPan = 0, maxZoom = 0, prev = null;
for (let f = 0; f < frames; f++) {
  const t = f / FPS, c = cam(t), st = stateAt(t);
  if (prev) { maxPan = Math.max(maxPan, (Math.hypot(c.cx - prev.cx, c.cy - prev.cy) / c.w) * FPS); maxZoom = Math.max(maxZoom, Math.abs(Math.log(c.w / prev.w)) * FPS); }
  prev = c;
  draw(st.a, c, t, frame);
  if (st.b) { draw(st.b, c, t, tmp); const m = st.mix; for (let i = 0; i < frame.length; i++) frame[i] += (tmp[i] - frame[i]) * m; }
  if (!enc.stdin.write(frame)) await new Promise((r) => enc.stdin.once("drain", r));
  if (f % 96 === 0) console.log(`frame ${f}/${frames}`);
}
enc.stdin.end();
await new Promise((r) => enc.on("close", r));
console.log(`camera: fastest pan ${(maxPan * 100).toFixed(1)}% of the view per second, fastest zoom ${(maxZoom * 100).toFixed(1)}% per second`);

// ---- final: the stills video + test3b's -20 mix + test3b's captions and cards ----
const RD = `${R}/work/test3b/render`;
execFileSync(ff, ["-v", "error", "-y", "-i", `${OUT}/stills-video.mp4`, "-i", `${R}/test3b/mix_20.mp3`, "-filter_complex", "[0:v]subtitles=captions.ass:fontsdir=fonts[v]", "-map", "[v]", "-map", "1:a", "-t", LEN.toFixed(3), "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", `${R}/test3_stills.mp4`], { cwd: RD });
fs.writeFileSync(`${OUT}/stills.json`, JSON.stringify({ fades, way, pasteLog, parallax: PAR, maxPanPerSec: maxPan, maxZoomPerSec: maxZoom }, null, 2));
console.log("done", `${R}/test3_stills.mp4`);
