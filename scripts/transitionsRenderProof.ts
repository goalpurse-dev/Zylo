// deno-lint-ignore-file no-explicit-any
// Transitions render proof ($0, local FFmpeg): eight pictures from the TEST
// project, 2.5 s each, one transition of every kind at the cuts -> the render
// EDL (compileEdit: pieces) -> the worker's own pieceGraph -> FFmpeg -> checks
// (total frames == the voice's frames, every window centred on its cut) and a
// sheet of each transition at 1/4, 1/2 and 3/4 of its window.
//   FFMPEG=... npx -y deno@2.9.6 run -A --no-check scripts/transitionsRenderProof.ts <outDir>
import { createClient } from "npm:@supabase/supabase-js@2";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
import { compileEdit } from "../supabase/functions/_shared/stickman/editRender.ts";
import { TRANSITIONS } from "../src/lib/stickmanEdit.js";
import { pieceGraph } from "../render-worker/src/motion.mjs";

const FFMPEG = Deno.env.get("FFMPEG") ?? "ffmpeg";
const env: Record<string, string> = {};
for (const line of (await Deno.readTextFile(".env.local")).split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/); if (m) env[m[1]] = m[2]; }
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const [dir] = Deno.args;
const work = `${dir}/work`;
await Deno.mkdir(work, { recursive: true });
const ff = async (args: string[]) => { const r = await new Deno.Command(FFMPEG, { args: ["-hide_banner", "-loglevel", "error", "-y", ...args], stderr: "piped" }).output(); if (!r.success) throw new Error(new TextDecoder().decode(r.stderr).slice(-600)); };

const { data: imgs } = await admin.from("long_form_scene_images").select("beat_sequence, image_url").eq("project_id", "f6ee3eb2-726b-4faa-9d25-1ed957eb46ae").eq("is_current", true).eq("status", "ready").in("beat_sequence", [1, 5, 9, 14, 20, 26, 33, 40]).order("beat_sequence");
const kinds = Object.keys(TRANSITIONS).filter((k) => k !== "cut"); // 8 kinds, 7 cuts: fade .. circle (whip first)
const order = ["whip", "zoom", "flash", "slide_left", "slide_right", "dip", "circle", "fade"].filter((k) => kinds.includes(k));
const clips = imgs!.map((r: any, i: number) => ({ id: `c${i}`, beatSequence: r.beat_sequence, startMs: i * 2500, startWord: 0, image: r.image_url, narration: "", motion: ["push_in", "pan_left", "hold", "pull_out", "pan_right", "push_in", "hold", "push_in"][i] }));
const doc: any = { version: "STICKMAN_EDIT_V1", fps: 30, width: 1920, height: 1080, audio: { url: "", durationMs: 20000 }, clips, texts: [{ id: "t1", text: "TRANSITIONS", style: "HEADLINE", startMs: 2000, endMs: 5600, x: 960, y: 170, scale: 140 }], captions: { enabled: false, style: "highlight", edits: {} }, music: { url: null }, transition: { kind: "cut", ms: 200 }, transitions: Object.fromEntries(clips.slice(1).map((c: any, i: number) => [c.id, order[i]])) };
const edl: any = compileEdit(doc, []);
const t0 = Date.now();
for (const c of edl.clips) await Deno.writeFile(`${work}/img-${c.index}.jpg`, new Uint8Array(await (await fetch(c.image)).arrayBuffer()));
const { drawOverlayPng } = await import("../supabase/functions/_shared/stickman/editRender.ts");
const font = await Deno.readFile(new URL("../supabase/functions/_shared/fonts/LilitaOne-Regular.ttf", import.meta.url));
const segs: string[] = [];
for (const [k, p] of edl.pieces.entries()) {
  const inputs = ["-loop", "1", "-framerate", "30", "-i", `${work}/img-${p.a}.jpg`];
  if (p.kind === "xfade") inputs.push("-loop", "1", "-framerate", "30", "-i", `${work}/img-${p.b}.jpg`);
  for (const o of p.overlays) { const f = `${work}/ov-${o.key}.png`; try { await Deno.stat(f); } catch { await Deno.writeFile(f, await drawOverlayPng(edl, o.key, font)); } inputs.push("-i", f); }
  const out = `${work}/seg-${String(k).padStart(3, "0")}.mp4`;
  await ff([...inputs, "-filter_complex", pieceGraph(p, edl.clips, 30), "-map", "[v]", "-frames:v", String(p.frames), "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p", "-r", "30", "-video_track_timescale", "30000", "-an", out]);
  segs.push(out);
}
await Deno.writeTextFile(`${work}/concat.txt`, segs.map((s) => `file '${s.split("/").pop()}'`).join("\n"));
const mp4 = `${dir}/transitions-proof.mp4`;
await ff(["-f", "concat", "-safe", "0", "-i", `${work}/concat.txt`, "-c", "copy", mp4]);
const probe = await new Deno.Command(FFMPEG, { args: ["-i", mp4, "-map", "0:v", "-f", "null", "-"], stderr: "piped" }).output();
const frames = Number([...new TextDecoder().decode(probe.stderr).matchAll(/frame=\s*(\d+)/g)].at(-1)?.[1]);
// Sheet: every transition at 1/4, 1/2, 3/4 of its window.
const windows = edl.pieces.filter((p: any) => p.kind === "xfade");
const rows: Image[] = [];
for (const w of windows) {
  const row = new Image(3 * 320, 180);
  for (const [j, f] of [0.25, 0.5, 0.75].entries()) {
    const n = w.fromFrame + Math.floor(w.frames * f);
    const png = `${work}/f-${n}.png`;
    await ff(["-i", mp4, "-vf", `select=eq(n\\,${n})`, "-vsync", "0", "-frames:v", "1", png]);
    row.composite((await Image.decode(await Deno.readFile(png)) as Image).resize(320, 180), j * 320, 0);
  }
  rows.push(row);
}
const sheet = new Image(960, 180 * rows.length);
rows.forEach((r, i) => sheet.composite(r, 0, i * 180));
await Deno.writeFile(`${dir}/transitions-proof.jpg`, await sheet.encodeJPEG(85));
console.log(JSON.stringify({ totalFrames: edl.totalFrames, renderedFrames: frames, pieces: edl.pieces.length, renderS: ((Date.now() - t0) / 1000).toFixed(1),
  windows: windows.map((w: any) => ({ t: w.transition, xfade: w.xfade, frames: w.frames, from: w.fromFrame, to: w.toFrame, cut: edl.clips[w.b].startFrame, centred: edl.clips[w.b].startFrame - w.fromFrame === Math.floor(w.frames / 2) })) }, null, 1));
