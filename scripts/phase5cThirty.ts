// deno-lint-ignore-file no-explicit-any
// Phase 5c — the first ~30 s of Myth vs Reality, two ways, for an unlisted
// YouTube comparison:
//   (a) the current 1080p output (5b server render), cut frame-exact at the
//       first clip boundary after 30 s (stream copy — no re-encode);
//   (b) the 1440p YouTube master: full-res Real-ESRGAN sources (2752x1536),
//       16:9 crop at native resolution, sub-pixel motion there, one Lanczos
//       scale to 2560x1440, CRF 18 — using the render worker's own graph code.
// Uploads both (full files) to the private renders bucket; 7-day signed links.
import { admin, root, PROJECT_ID } from "./lib/v2Runner.ts";
import { clipGraph, PROFILES } from "../render-worker/src/motion.mjs";

const FFMPEG = Deno.env.get("FFMPEG")!, FFPROBE = Deno.env.get("FFPROBE")!;
const P = (p: string) => decodeURIComponent(new URL(p, root).pathname).replace(/^\/([A-Za-z]:)/, "$1");
const run = async (cmd: string, args: string[]) => { const r = await new Deno.Command(cmd, { args, stdout: "piped", stderr: "piped" }).output(); if (r.code !== 0) throw new Error(new TextDecoder().decode(r.stderr).slice(-500)); return new TextDecoder().decode(r.stdout).trim(); };
const ff = (args: string[]) => run(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", ...args]);
const frames = async (f: string) => Number(await run(FFPROBE, ["-v", "error", "-select_streams", "v:0", "-count_packets", "-show_entries", "stream=nb_read_packets", "-of", "csv=p=0", f]));

const edl = JSON.parse(await Deno.readTextFile(new URL("docs/phase5/myth-vs-reality.server.edl.json", root)));
const clips = edl.clips.filter((c: any) => c.startMs < 30000);
const endFrame = clips.at(-1).endFrame, endS = (endFrame / edl.fps).toFixed(6);
const OUT = "docs/phase5/test30", WORK = `${OUT}/work`;
await Deno.mkdir(new URL(`${WORK}/`, root), { recursive: true });
const t0 = Date.now();

// (a) current 1080p — frame-exact cut (every clip starts on a keyframe).
const A = `${OUT}/myth-vs-reality-first30s-A-1080p-current.mp4`;
await ff(["-i", P("docs/phase5/myth-vs-reality-v2-server.mp4"), "-t", endS, "-c", "copy", "-movflags", "+faststart", P(A)]);

// (b) 1440p master from the full-res sources.
const prof = PROFILES.master;
const segs: string[] = [];
for (const c of clips) {
  const src = `docs/phase5/upscale/beat-${String(c.beatSequence).padStart(3, "0")}-runware-504-1.png`;
  const clip = { ...c, masterImage: src, masterSize: { width: 2752, height: 1536 }, overlayImage: null };
  const seg = `${WORK}/m-${String(c.index).padStart(3, "0")}.mp4`;
  await ff(["-loop", "1", "-framerate", String(edl.fps), "-i", P(src), "-filter_complex", clipGraph(clip, edl, prof), "-map", "[v]", "-frames:v", String(c.frames), ...prof.x264, "-r", String(edl.fps), "-video_track_timescale", "30000", "-an", P(seg)]);
  segs.push(seg);
}
await Deno.writeTextFile(new URL(`${WORK}/list.txt`, root), segs.map((s) => `file '${P(s)}'`).join("\n"));
const B = `${OUT}/myth-vs-reality-first30s-B-1440p-master.mp4`;
await ff(["-f", "concat", "-safe", "0", "-i", P(`${WORK}/list.txt`), "-t", endS, "-i", P("tests/fixtures/stickman/audio/myth-vs-reality/audio.mp3"), "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", P(B)]);
const renderS = Math.round((Date.now() - t0) / 1000);

// Checks + upload + signed links (FULL files).
const out: Record<string, any> = { endFrame, renderS };
for (const [label, f] of [["A_1080p_current", A], ["B_1440p_master", B]]) {
  const size = (await Deno.stat(new URL(f, root))).size;
  const dims = await run(FFPROBE, ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", P(f)]);
  const path = `${PROJECT_ID}/tests/phase5c/${f.split("/").pop()}`;
  const up = await admin.storage.from("long-form-renders").upload(path, await Deno.readFile(new URL(f, root)), { contentType: "video/mp4", upsert: true });
  const signed = up.error ? null : await admin.storage.from("long-form-renders").createSignedUrl(path, 7 * 24 * 3600);
  out[label] = { file: f, dims, frames: await frames(P(f)), mb: Number((size / 1e6).toFixed(1)), url: signed?.data?.signedUrl ?? `UPLOAD FAILED: ${up.error?.message}` };
}
await Deno.writeTextFile(new URL(`${OUT}/links.json`, root), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
