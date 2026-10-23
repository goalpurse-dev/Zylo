// Camera zoom/pan per frame over a short range (robust alignment on small grey frames), to read the easing.
import { execFileSync } from "node:child_process";
const [ff, file, ss, dur, fps = "30"] = process.argv.slice(2);
const W = 90, H = 160, N = W * H;
const buf = execFileSync(ff, ["-v", "error", "-ss", ss, "-t", dur, "-i", file, "-vf", `fps=${fps},scale=${W}:${H},format=gray`, "-f", "rawvideo", "-"], { maxBuffer: 1 << 28 });
const n = Math.floor(buf.length / N), fr = (i) => buf.subarray(i * N, (i + 1) * N);
const zooms = []; for (let z = 0.9; z <= 1.25; z += 0.01) zooms.push(+z.toFixed(2));
let cum = 1, out = [];
for (let i = 1; i < n; i++) {
  const a = fr(i - 1), b = fr(i);
  let best = { e: Infinity };
  for (const z of zooms) for (let dy = -8; dy <= 8; dy += 1) for (let dx = -6; dx <= 6; dx += 1) {
    let e = 0, c = 0;
    for (let y = 30; y < H - 30; y += 3) for (let x = 15; x < W - 15; x += 3) {
      const sx = Math.round(W / 2 + (x - W / 2) / z - dx), sy = Math.round(H / 2 + (y - H / 2) / z - dy);
      if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
      if (Math.abs(b[y * W + x] - a[sy * W + sx]) > 12) e++; c++;
    }
    e /= c; if (e < best.e) best = { e, dx, dy, z };
  }
  cum *= best.z;
  out.push(`${(Number(ss) + i / Number(fps)).toFixed(2)} z${best.z.toFixed(2)} dy${best.dy} dx${best.dx} cum${cum.toFixed(2)}`);
}
console.log(out.join("\n"));
