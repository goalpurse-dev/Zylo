// M2: the flicker check (free). At each sentence's moment the scene is held still and only the camera moves, 1/240 s
// each way: three frames. Over every part on screen, the jitter |2·b − a − c|: the camera's smooth shift cancels out of
// it, so what remains is surfaces fighting at one depth (the tank's sawtooth), the flicker a viewer sees as the camera
// drifts. Moving things (flows, brushes, foam) are frozen, so they never count. A part above FLICKER_MAX fails.
//   node m2/flickerCheck.mjs <runDir (layout.json, script.json)> --proto PROTO --ff FFMPEG [--words voice.words.json]
//   -> <runDir>/flicker/flicker.json, and the failing parts printed
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { compile } from "./compile.mjs";
import { draftWords } from "./plan.js";
import { previewTimes } from "./checks.mjs";
import { preparePage, runProcess } from "./make.mjs";
import { cameraAt, projectBox } from "./director.js";
import { focusOf } from "./focus.js";

// mean jitter over a part's area, in grey levels (0-255), calibrated on the car wash: the old tank's sawtooth against the
// fixed tank (old 9-56 on the tank and its inflow, fixed under 2.6; see flicker.json beside each run)
export const FLICKER_MAX = 5;
// and a sawtooth is dense: over this share of the part's pixels jitter strongly (over 24 levels); a fast camera move
// leaves only sparse dots on edges (the car wash's pull-back at "Congratulations": mean 5.8 from scattered dots)
export const DENSE_MIN = 0.03;

/** mean |2b − a − c| over a rectangle of three same-size grey images (Buffers, width w) */
export function jitter(a, b, c, w, rect) { return jitterStats(a, b, c, w, rect).mean; }
/** the mean, and the share of strongly jittering pixels */
export function jitterStats(a, b, c, w, [x0, y0, x1, y1]) {
  let s = 0, n = 0, strong = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = y * w + x, j = Math.abs(2 * b[i] - a[i] - c[i]); s += j; n++; if (j > 24) strong++; }
  return { mean: n ? s / n : 0, dense: n ? strong / n : 0 };
}

export async function flickerCheck({ run, proto, ff, words: wordsFile = null }) {
  const layout0 = JSON.parse(fs.readFileSync(path.join(run, "layout.json"), "utf8")), script = JSON.parse(fs.readFileSync(path.join(run, "script.json"), "utf8"));
  const layout = { ...layout0, key: `${layout0.key}_flicker`.slice(0, 60) };
  const words = wordsFile ? JSON.parse(fs.readFileSync(wordsFile, "utf8")) : draftWords(script.sentences);
  const tl = compile(layout, words, words.at(-1).e + 0.1, { roles: script.sentences.map((s) => s.role) });
  const moments = previewTimes(tl, layout).map((p) => ({ role: p.role, t: p.t }));
  const dt = 1 / 240, times = moments.flatMap((m) => [m.t - dt, m.t, m.t + dt].map((c) => `${m.t.toFixed(4)}@${c.toFixed(4)}`));
  preparePage({ layout, tl, proto });
  const dir = path.join(run, "flicker"); fs.mkdirSync(dir, { recursive: true });
  await runProcess(process.execPath, [path.join(proto, "m2", "stills.mjs"), `m2_${layout.key}.html`, dir, times.join(",")], { cwd: proto });
  // grey at half size (540 x 960): enough to see a sawtooth, a quarter of the work
  const W = 540, H = 960;
  const grey = (i) => execFileSync(ff, ["-v", "error", "-i", path.join(dir, `f_${String(i).padStart(3, "0")}.png`), "-vf", `scale=${W}:${H},format=gray`, "-f", "rawvideo", "-"], { maxBuffer: 1 << 24 });
  const cut = layout.world?.cut, out = [];
  moments.forEach((m, mi) => {
    const [a, b, c] = [0, 1, 2].map((k) => grey(mi * 3 + k)), k = cameraAt(tl.camera.end, m.t);
    for (const p of layout.parts) {
      if (["light", "rain"].includes(p.kind)) continue;
      let box; try { box = focusOf(p, cut); } catch { continue; }
      if (!box) continue;
      const r = projectBox(k.pos, k.tgt, box);
      if (r.behind) continue;
      const rect = [Math.max(0, Math.floor(r.x0 * W)), Math.max(0, Math.floor(r.y0 * H)), Math.min(W, Math.ceil(r.x1 * W)), Math.min(H, Math.ceil(r.y1 * H))];
      if ((rect[2] - rect[0]) * (rect[3] - rect[1]) < 400) continue; // too small on screen to judge
      const { mean: j, dense } = jitterStats(a, b, c, W, rect);
      out.push({ role: m.role, t: m.t, part: p.id, kind: p.kind, jitter: +j.toFixed(2), dense: +dense.toFixed(3), ok: j <= FLICKER_MAX || dense < DENSE_MIN });
    }
  });
  const failing = out.filter((x) => !x.ok);
  fs.writeFileSync(path.join(dir, "flicker.json"), JSON.stringify({ max: FLICKER_MAX, failing, all: out }, null, 1));
  return { ok: failing.length === 0, failing, all: out };
}

if (/flickerCheck\.mjs$/.test(process.argv[1] ?? "")) {
  const arg = (k) => (process.argv.includes(`--${k}`) ? process.argv[process.argv.indexOf(`--${k}`) + 1] : null);
  const r = await flickerCheck({ run: process.argv[2], proto: arg("proto"), ff: arg("ff"), words: arg("words") });
  const worst = [...r.all].sort((x, y) => y.jitter - x.jitter).slice(0, 8);
  console.log(r.ok ? "no part flickers" : `FLICKER: ${r.failing.map((f) => `${f.part} at ${f.role} (${f.jitter})`).join(", ")}`);
  console.log("worst:", worst.map((f) => `${f.part}@${f.role}=${f.jitter}`).join(" "));
}
