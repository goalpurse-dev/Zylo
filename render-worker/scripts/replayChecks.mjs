// Offline ($0) replay of a parallel render's FINISH step: download the stored
// chunk videos + narration, join them exactly like the worker, then run the
// worker's own runChecks. Nothing is uploaded or written to the DB.
//   FFMPEG=... FFPROBE=... node --env-file=../.env.local scripts/replayChecks.mjs <parentJobId> <workDir>
import { createClient } from "@supabase/supabase-js";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { runChecks } from "../src/worker.mjs";
import { audioMixArgs } from "../src/motion.mjs";

const [JOB, DIR] = process.argv.slice(2);
const FFMPEG = process.env.FFMPEG ?? "ffmpeg";
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const run = (args) => new Promise((res, rej) => { const p = spawn(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", ...args]); let err = ""; p.stderr.on("data", (d) => (err += d)); p.on("close", (c) => (c ? rej(new Error(err)) : res())); });
const fetchTo = async (url, file) => { const r = await fetch(url); if (!r.ok) throw new Error(`${r.status} ${url}`); await writeFile(file, Buffer.from(await r.arrayBuffer())); };
const signed = async (p) => (await admin.storage.from("long-form-renders").createSignedUrl(p, 600)).data.signedUrl;

await mkdir(DIR, { recursive: true });
const { data: job } = await admin.from("long_form_render_jobs").select("edl").eq("id", JOB).single();
const { data: chunks } = await admin.from("long_form_render_jobs").select("chunk_index, output_path, checks").eq("parent_job_id", JOB).order("chunk_index");
const edl = job.edl;
const files = [];
for (const c of chunks) { const f = path.join(DIR, `chunk-${c.chunk_index}.mp4`); await fetchTo(await signed(c.output_path), f); files.push(f); }
const audioPath = path.join(DIR, "narration.mp3");
await fetchTo(edl.audio.url, audioPath);
const musicPath = edl.music?.url ? path.join(DIR, "music.audio") : null;
if (musicPath) await fetchTo(edl.music.url, musicPath);
const list = path.join(DIR, "concat.txt");
await writeFile(list, files.map((f) => `file '${f.replace(/\\/g, "/")}'`).join("\n"));
const finalPath = path.join(DIR, "final.mp4"), proxyPath = path.join(DIR, "proxy.mp4");
if (musicPath) await run(["-f", "concat", "-safe", "0", "-i", list, "-i", audioPath, "-stream_loop", "-1", "-i", musicPath, ...audioMixArgs(edl.musicVolumeExpr, edl.voiceVolume ?? 1), "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", finalPath]);
else if ((edl.voiceVolume ?? 1) !== 1) await run(["-f", "concat", "-safe", "0", "-i", list, "-i", audioPath, "-map", "0:v", "-map", "1:a", "-af", `volume=${edl.voiceVolume}`, "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", finalPath]);
else await run(["-f", "concat", "-safe", "0", "-i", list, "-i", audioPath, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", finalPath]);
await run(["-i", finalPath, "-vf", "scale=640:360:flags=lanczos", "-c:v", "libx264", "-preset", "veryfast", "-crf", "26", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", proxyPath]);
const units = edl.pieces.map((p, k) => ({ ...p, index: k, startFrame: p.fromFrame }));
const segFrames = chunks.flatMap((c) => c.checks?.segFrames ?? []);
const checks = await runChecks({ edl: { ...edl, clips: units }, finalPath, proxyPath, audioPath, segFrames });
console.log(JSON.stringify({ music: !!musicPath, voiceVolume: edl.voiceVolume ?? 1, musicVolumeExpr: String(edl.musicVolumeExpr ?? "").slice(0, 120), duration: checks.duration, cuts: checks.cuts, sync: checks.sync, blankPass: checks.blank.pass }, null, 1));
