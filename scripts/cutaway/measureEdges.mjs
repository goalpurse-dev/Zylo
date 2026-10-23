// Edge crispness (1 fps, 540x960 grey, Sobel): share of pixels on strong clean edges vs on weak/soft edges,
// and colour saturation (how bright and flat the colours are).
import { execFileSync } from "node:child_process";
const [ff] = process.argv.slice(2);
const R = "C:/Users/Public/Zylo/research/seamless-niche";
const V = [["pool", `${R}/video1,9.4mview.mp4`], ["road", `${R}/2.2mviews.mp4`], ["test3", `${R}/test3.mp4`], ["stills", `${R}/test3_stills.mp4`]];
const W = 540, H = 960, N = W * H;
for (const [label, file] of V) {
  const g = execFileSync(ff, ["-v", "error", "-i", file, "-vf", `fps=1,scale=${W}:${H},format=gray`, "-f", "rawvideo", "-"], { maxBuffer: 1 << 30 });
  const rgb = execFileSync(ff, ["-v", "error", "-i", file, "-vf", `fps=1,scale=135:240,format=rgb24`, "-f", "rawvideo", "-"], { maxBuffer: 1 << 30 });
  const n = Math.floor(g.length / N);
  let strong = 0, weak = 0, tot = 0;
  for (let k = 0; k < n; k++) {
    const f = g.subarray(k * N, (k + 1) * N);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      const gx = f[i - W + 1] + 2 * f[i + 1] + f[i + W + 1] - f[i - W - 1] - 2 * f[i - 1] - f[i + W - 1];
      const gy = f[i + W - 1] + 2 * f[i + W] + f[i + W + 1] - f[i - W - 1] - 2 * f[i - W] - f[i - W + 1];
      const m = Math.hypot(gx, gy);
      if (m > 160) strong++; else if (m > 30) weak++;
      tot++;
    }
  }
  let sat = 0, px = 0;
  for (let i = 0; i < rgb.length; i += 3) { const mx = Math.max(rgb[i], rgb[i + 1], rgb[i + 2]), mn = Math.min(rgb[i], rgb[i + 1], rgb[i + 2]); sat += mx ? (mx - mn) / mx : 0; px++; }
  console.log(label, "| strong clean edges", (strong / tot * 100).toFixed(1) + "%", "| soft/noisy texture", (weak / tot * 100).toFixed(1) + "%", "| strong per soft", (strong / weak).toFixed(3), "| colour saturation", (sat / px).toFixed(2));
}
