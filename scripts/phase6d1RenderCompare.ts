// deno-lint-ignore-file no-explicit-any
// Phase 6d-1 ($0): preview vs FFmpeg on 10 s. The Myth vs Reality TEST
// project's saved edit -> compileEdit (the render EDL v2) -> the worker's own
// clip graph (render-worker/src/motion.mjs clipGraphV2) -> FFmpeg, locally ->
// frames at the same times as the editor preview's screenshots -> a pixel
// comparison (640x360, mean abs difference + PSNR) and a side-by-side sheet.
//   FFMPEG=... npx -y deno@2.9.6 run -A --no-check scripts/phase6d1RenderCompare.ts <dir> <fromS> <toS> t1 t2 ...
import { createClient } from "npm:@supabase/supabase-js@2";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
import { compileEdit, drawOverlayPng } from "../supabase/functions/_shared/stickman/editRender.ts";
import { flattenWords } from "../src/lib/stickmanEdit.js";
import { clipGraphV2 } from "../render-worker/src/motion.mjs";

const TEST_PROJECT = "f6ee3eb2-726b-4faa-9d25-1ed957eb46ae";
const FFMPEG = Deno.env.get("FFMPEG") ?? "ffmpeg";
const env: Record<string, string> = {};
for (const line of (await Deno.readTextFile(".env.local")).split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/); if (m) env[m[1]] = m[2]; }
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const [dir, fromS, toS, ...times] = Deno.args;
const W0 = Number(fromS) * 1000, W1 = Number(toS) * 1000;
const work = `${dir}/ffmpeg`;
await Deno.mkdir(work, { recursive: true });
const ff = async (args: string[]) => { const r = await new Deno.Command(FFMPEG, { args: ["-hide_banner", "-loglevel", "error", "-y", ...args], stderr: "piped" }).output(); if (!r.success) throw new Error(new TextDecoder().decode(r.stderr).slice(-800)); };

const { data: e } = await admin.from("long_form_edits").select("version, doc").eq("project_id", TEST_PROJECT).order("version", { ascending: false }).limit(1).single();
const { data: narr } = await admin.from("long_form_narration_audio_versions").select("narration, audio_url").eq("id", e.doc.audio.narrationId).single();
const words = flattenWords(narr.narration);
const edl = compileEdit(e.doc, words);
const font = await Deno.readFile(new URL("../supabase/functions/_shared/fonts/LilitaOne-Regular.ttf", import.meta.url));
const clips = edl.clips.filter((c) => c.endMs > W0 && c.startMs < W1);
const t0 = Date.now();
const segs: string[] = [];
for (const c of clips) {
  const img = `${work}/img-${c.index}.jpg`;
  await Deno.writeFile(img, new Uint8Array(await (await fetch(c.image)).arrayBuffer()));
  const inputs = ["-loop", "1", "-framerate", String(edl.fps), "-i", img];
  for (const o of c.overlays) { const p = `${work}/ov-${o.key}.png`; try { await Deno.stat(p); } catch { await Deno.writeFile(p, await drawOverlayPng(edl, o.key, font)); } inputs.push("-i", p); }
  const out = `${work}/seg-${String(c.index).padStart(3, "0")}.mp4`;
  await ff([...inputs, "-filter_complex", clipGraphV2(c), "-map", "[v]", "-frames:v", String(c.frames), "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p", "-r", String(edl.fps), "-video_track_timescale", "30000", "-an", out]);
  segs.push(out);
}
await Deno.writeTextFile(`${work}/concat.txt`, segs.map((s) => `file '${s.replace(/\\/g, "/").split("/").pop()}'`).join("\n"));
const firstMs = (clips[0].startFrame * 1000) / edl.fps;
const clipMp4 = `${dir}/ffmpeg-${fromS}-${toS}s.mp4`;
await ff(["-f", "concat", "-safe", "0", "-i", `${work}/concat.txt`, "-ss", String((W0 - firstMs) / 1000), "-t", String((W1 - W0) / 1000), "-i", narr.audio_url, "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", clipMp4].flatMap((a, i, arr) => (a === "-i" && arr[i + 1] === narr.audio_url ? ["-ss", String(W0 / 1000), "-i"] : [a])));
const renderS = ((Date.now() - t0) / 1000).toFixed(1);

// Frames at the same times, compared with the preview's.
const small = async (bytes: Uint8Array) => (await Image.decode(bytes) as Image).resize(640, 360);
const results: any[] = [];
const tiles: Image[] = [];
for (const t of times) {
  const png = `${work}/ffmpeg-${t}.png`;
  // Frame-exact: the frame index at t (the preview shows the frame at floor(t*fps)).
  const frame = Math.floor((Number(t) * 1000 * edl.fps) / 1000) - Math.round((W0 * edl.fps) / 1000);
  await ff(["-i", clipMp4, "-vf", `select=eq(n\\,${frame})`, "-vsync", "0", "-frames:v", "1", png]);
  const a = await small(await Deno.readFile(`${dir}/preview-${t}.png`));
  const b = await small(await Deno.readFile(png));
  let sum = 0, se = 0;
  for (let y = 1; y <= 360; y++) for (let x = 1; x <= 640; x++) {
    const [r1, g1, b1] = Image.colorToRGBA(a.getPixelAt(x, y)), [r2, g2, b2] = Image.colorToRGBA(b.getPixelAt(x, y));
    const d = (Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2)) / 3;
    sum += d; se += ((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2) / 3;
  }
  const n = 640 * 360, mse = se / n;
  results.push({ t: Number(t), meanAbsDiff: Number((sum / n).toFixed(2)), psnrDb: Number((10 * Math.log10((255 * 255) / Math.max(mse, 1e-6))).toFixed(1)) });
  const row = new Image(1280, 360);
  row.composite(a, 0, 0); row.composite(b, 640, 0);
  tiles.push(row);
}
const sheet = new Image(1280, 360 * tiles.length);
tiles.forEach((r, i) => sheet.composite(r, 0, i * 360));
await Deno.writeFile(`${dir}/preview-vs-ffmpeg.jpg`, await sheet.encodeJPEG(85));
console.log(JSON.stringify({ edit: e.version, window: [W0, W1], clips: clips.length, overlays: clips.reduce((a, c) => a + c.overlays.length, 0), renderS, results }, null, 1));
