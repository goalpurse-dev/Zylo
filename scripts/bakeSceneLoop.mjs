// Bakes a silent, seamless scene loop from still images ($0, local FFmpeg):
// each scene is held 3.5 s with a slow zoom (1.00 -> 1.05), 0.8 s crossfades,
// last -> first. The loop starts two frames after 0.8 s into the first scene and ends just after
// when the crossfade back into it finishes, so the seam is invisible.
// Output: <name>.mp4 (H.264, faststart), <name>.webm (VP9), <name>.webp poster
// (the loop's first frame).
//   node scripts/bakeSceneLoop.mjs <ffmpeg> <outDir> <name> <img1> <img2> ...
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const [FF, OUT, NAME, ...IMGS] = process.argv.slice(2);
const HOLD = 3.5, FADE = 0.8, FPS = 30, W = 1280, H = 720;
const SEG = HOLD + FADE; // each scene is on screen for its hold + one crossfade
const frames = Math.round(SEG * FPS);
const scenes = [...IMGS, IMGS[0]];
fs.mkdirSync(OUT, { recursive: true });

const inputs = scenes.flatMap((f) => ["-loop", "1", "-framerate", String(FPS), "-t", String(SEG), "-i", f]);
const zoom = scenes.map((_, i) =>
  `[${i}:v]scale=${W * 2}:${H * 2}:force_original_aspect_ratio=increase,crop=${W * 2}:${H * 2},` +
  `zoompan=z='1+0.05*on/${frames - 1}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=${FPS},setsar=1,format=yuv420p[s${i}]`);
let prev = "s0";
const fades = [];
for (let i = 1; i < scenes.length; i++) {
  const out = i === scenes.length - 1 ? "chain" : `x${i}`;
  fades.push(`[${prev}][s${i}]xfade=transition=fade:duration=${FADE}:offset=${(HOLD * i).toFixed(3)}[${out}]`);
  prev = out;
}
const total = HOLD * IMGS.length; // FADE .. FADE + total
const graph = [...zoom, ...fades, `[chain]trim=start=${(FADE + 2 / FPS).toFixed(4)}:duration=${total},setpts=PTS-STARTPTS[v]`].join(";");
const base = `${OUT}/${NAME}`;
execFileSync(FF, ["-y", "-loglevel", "error", ...inputs, "-filter_complex", graph, "-map", "[v]", "-an",
  "-c:v", "libx264", "-preset", "slow", "-crf", "25", "-maxrate", "800k", "-bufsize", "1600k", "-g", "105", "-tune", "animation", "-profile:v", "high", "-pix_fmt", "yuv420p",
  "-movflags", "+faststart", `${base}.mp4`], { stdio: "inherit" });
execFileSync(FF, ["-y", "-loglevel", "error", "-i", `${base}.mp4`, "-an", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "46", "-row-mt", "1", "-deadline", "good", "-cpu-used", "2", `${base}.webm`], { stdio: "inherit" });
execFileSync(FF, ["-y", "-loglevel", "error", "-i", `${base}.mp4`, "-frames:v", "1", "-c:v", "libwebp", "-quality", "82", `${base}.webp`], { stdio: "inherit" });
for (const ext of ["mp4", "webm", "webp"]) console.log(`${NAME}.${ext}`, (fs.statSync(`${base}.${ext}`).size / 1e6).toFixed(2), "MB");
