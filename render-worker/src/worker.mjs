// Zyvo render worker (Phase 5b) — EDL -> final MP4 + 640x360 proxy.
//
// Triggered by long_form_render_jobs rows (queued -> rendering -> done/failed):
//   claim (SKIP LOCKED; a stale 'rendering' job is reclaimed and RESUMED)
//   -> download inputs (images verified against the EDL's sha256 — blocking)
//   -> render one segment per clip in parallel (finished segments are kept, so
//      a restarted job only renders what's missing) with a heartbeat
//   -> concat + narration (AAC 192k, +faststart) -> proxy -> checks
//   -> TUS resumable upload -> finish-long-form-render (statuses, billing,
//      compute cost in the ledger, stage "render").
// Never runs on Supabase edge functions.
import { createClient } from "@supabase/supabase-js";
import * as tus from "tus-js-client";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, writeFile, stat, access, rename } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { clipGraph, clipGraphV2, pieceGraph, audioMixArgs, PROFILES } from "./motion.mjs";

const env = (k, d) => process.env[k] ?? d;
const SUPABASE_URL = env("SUPABASE_URL");
const SERVICE_KEY = env("SUPABASE_SERVICE_ROLE_KEY");
const FFMPEG = env("FFMPEG", "ffmpeg"), FFPROBE = env("FFPROBE", "ffprobe"), DENO = env("DENO", "deno");
const HERE = path.dirname(fileURLToPath(import.meta.url));
const WORK_DIR = env("WORK_DIR", path.join(os.tmpdir(), "zyvo-render"));
const CPUS = os.cpus().length;
const CONCURRENCY = Number(env("CONCURRENCY", Math.max(2, Math.min(8, CPUS - 1))));
const X264_THREADS = Math.max(1, Math.floor(CPUS / CONCURRENCY));
// Compute price of the machine this runs on (USD/second) — an estimate from
// the host's list price; the ledger row is marked estimated.
const USD_PER_SECOND = Number(env("MACHINE_USD_PER_SECOND", "0.0000957"));
const HOST = env("RENDER_HOST", "local"), MACHINE = env("RENDER_MACHINE", `${CPUS}cpu`);
const WORKER_ID = env("WORKER_ID", `${os.hostname()}-${process.pid}`);
const BUCKET = "long-form-renders";
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// Final encode (Phase 5b): 1080p30 H.264, CRF 23, preset slow, tuned for flat animation.
// Encodes (Phase 5c): segments are the 1440p YouTube master (CRF 18) when the
// EDL carries full-res sources, else 1080p (CRF 23); both preset slow, tuned for flat animation.
const x264For = (profile) => [...profile.x264.map((a, i, arr) => (arr[i - 1] === "-crf" && profile.name === "base" ? env("CRF", a) : a)), "-threads", String(X264_THREADS)];

class TerminalError extends Error { constructor(code, userReason, detail) { super(detail ?? code); this.code = code; this.userReason = userReason; } }

function run(cmd, args) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    const out = [], err = [];
    p.stdout.on("data", (d) => out.push(d));
    p.stderr.on("data", (d) => err.push(d));
    p.on("close", (code) => resolve({ code, out: Buffer.concat(out), err: Buffer.concat(err).toString() }));
  });
}
async function ff(args) {
  const r = await run(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", ...args]);
  if (r.code !== 0) throw new Error(`ffmpeg: ${r.err.slice(-500)}`);
  return r;
}
const probe = async (file, args) => (await run(FFPROBE, ["-v", "error", ...args, file])).out.toString().trim();
const frameCount = async (file) => Number(await probe(file, ["-select_streams", "v:0", "-count_packets", "-show_entries", "stream=nb_read_packets", "-of", "csv=p=0"]));
const exists = (p) => access(p).then(() => true, () => false);
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

async function download(storagePath, dest, expectedSha) {
  // Phase 6d-1: an EDL v2 names its pictures / voice / music by public URL.
  if (/^https?:\/\//.test(storagePath)) {
    if (await exists(dest)) return readFile(dest);
    const r = await fetch(storagePath);
    if (!r.ok) throw new TerminalError("INPUT_MISSING", "A scene image, the narration or the music is missing. Please fix it in the editor and render again.", `${storagePath}: ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    await writeFile(dest, buf);
    return buf;
  }
  if (await exists(dest)) {
    const have = await readFile(dest);
    if (!expectedSha || sha256(have) === expectedSha) return have;
  }
  const { data, error } = await admin.storage.from(BUCKET).download(storagePath);
  if (error) throw new TerminalError("INPUT_MISSING", "A scene image or the narration is missing. Please regenerate it and render again.", `${storagePath}: ${error.message}`);
  const buf = Buffer.from(await data.arrayBuffer());
  if (expectedSha && sha256(buf) !== expectedSha) throw new TerminalError("IMAGE_HASH_MISMATCH", "A scene image changed after this render was queued. Please start the render again.", storagePath);
  await writeFile(dest, buf);
  return buf;
}

// The size is read BEFORE the promise: an error in an async executor escapes
// every try/catch and crashes the process (Phase 5d: a missing thumbnail did).
async function tusUpload(file, objectName, contentType) {
  const size = (await stat(file)).size;
  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(createReadStream(file), {
      endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
      // New-style secret keys (sb_secret_…) are not JWTs: storage's TUS endpoint
      // takes them as `apikey`; a legacy service_role JWT also works as Bearer.
      headers: { apikey: SERVICE_KEY, ...(SERVICE_KEY.startsWith("eyJ") ? { authorization: `Bearer ${SERVICE_KEY}` } : {}), "x-upsert": "true" },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      uploadSize: size,
      chunkSize: 6 * 1024 * 1024, // Supabase requires exactly 6 MB chunks
      retryDelays: [0, 2000, 5000, 10000, 20000],
      metadata: { bucketName: BUCKET, objectName, contentType, cacheControl: "3600" },
      onError: reject,
      onSuccess: () => resolve({ objectName, size }),
    });
    upload.start();
  });
}

async function finish(body) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/finish-long-form-render`, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`finish-long-form-render ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  return j;
}

// ---------------- checks (duration, cuts, black/blank, audio sync) ----------------
async function pcm(file, fromS, durS) {
  const r = await run(FFMPEG, ["-hide_banner", "-loglevel", "error", "-ss", String(fromS), "-t", String(durS), "-i", file, "-ac", "1", "-ar", "8000", "-f", "s16le", "-"]);
  return new Int16Array(r.out.buffer, r.out.byteOffset, Math.floor(r.out.byteLength / 2));
}
function bestLagMs(a, b, maxLag = 400) {
  let best = 0, bestV = -Infinity;
  for (let lag = -maxLag; lag <= maxLag; lag++) {
    let s = 0;
    for (let i = Math.max(0, -lag); i < Math.min(a.length, b.length - lag); i++) s += a[i] * b[i + lag];
    if (s > bestV) { bestV = s; best = lag; }
  }
  return (best / 8000) * 1000;
}
export async function runChecks({ edl, finalPath, proxyPath, audioPath, segFrames }) {
  const fps = edl.fps, frameMs = 1000 / fps;
  const vFrames = await frameCount(finalPath);
  const vDur = Number(await probe(finalPath, ["-select_streams", "v:0", "-show_entries", "stream=duration", "-of", "csv=p=0"])) * 1000;
  const audioMs = edl.audio.durationMs;
  let acc = 0;
  const cutErr = edl.clips.map((c, i) => { const at = acc; acc += segFrames[i]; return Math.abs(at - c.startFrame); });
  const sc = await run(FFMPEG, ["-hide_banner", "-i", proxyPath, "-vf", "select='gt(scene,0.12)',showinfo", "-an", "-f", "null", "-"]);
  const detected = [...sc.err.matchAll(/pts_time:([\d.]+)/g)].map((m) => Number(m[1]) * 1000);
  const cutMs = edl.clips.slice(1).map((c) => (c.startFrame * 1000) / fps);
  const visible = cutMs.filter((t) => detected.some((d) => Math.abs(d - t) <= frameMs + 1)).length;
  const black = await run(FFMPEG, ["-hide_banner", "-i", proxyPath, "-vf", "blackdetect=d=0.03:pix_th=0.10", "-an", "-f", "null", "-"]);
  const white = await run(FFMPEG, ["-hide_banner", "-i", proxyPath, "-vf", "negate,blackdetect=d=0.03:pix_th=0.10", "-an", "-f", "null", "-"]);
  const runs = (s) => [...s.matchAll(/black_start:([\d.]+)/g)].map((m) => Number(m[1]));
  const blackAt = runs(black.err), whiteAt = runs(white.err);
  const clipAt = (s) => edl.clips.find((c) => s * fps >= c.startFrame && s * fps < c.endFrame)?.beatSequence ?? null;
  const spots = [];
  for (const i of [1, Math.floor(edl.clips.length / 2), edl.clips.length - 2]) {
    const c = edl.clips[i];
    const from = Math.max(0, (c.startFrame / fps) - 1);
    spots.push({ beat: c.beatSequence, cutMs: Math.round((c.startFrame * 1000) / fps), audioLagMs: bestLagMs(await pcm(audioPath, from, 2.5), await pcm(finalPath, from, 2.5)) });
  }
  return {
    // The video's length is its frame count: the container's stream duration can
    // carry a few ms of padding (Debian's ffmpeg 5.1 wrote +43 ms on the joined
    // chunks of a frame-exact 15701-frame video) — kept as containerMs, for info.
    duration: { videoFrames: vFrames, edlFrames: edl.totalFrames, videoMs: Math.round(vFrames * frameMs), containerMs: Math.round(vDur), audioMs, diffFrames: Number(((vFrames * frameMs - audioMs) / frameMs).toFixed(2)), pass: vFrames === edl.totalFrames && Math.abs(vFrames * frameMs - audioMs) <= frameMs },
    cuts: { maxErrFrames: Math.max(...cutErr), visible: `${visible}/${cutMs.length}`, pass: Math.max(...cutErr) <= 1 },
    blank: { blackRuns: blackAt.map((s) => ({ atS: s, beat: clipAt(s) })), whiteRuns: whiteAt.map((s) => ({ atS: s, beat: clipAt(s) })), pass: blackAt.length === 0 && whiteAt.length === 0 },
    sync: { spots, pass: spots.every((s) => Math.abs(s.audioLagMs) < frameMs) },
  };
}

// ---------------- one job ----------------
async function processJob(job) {
  const t0 = Date.now();
  const edl = job.edl;
  const dir = path.join(WORK_DIR, job.id);
  const inDir = path.join(dir, "inputs"), segDir = path.join(dir, "segments");
  await mkdir(inDir, { recursive: true });
  await mkdir(segDir, { recursive: true });
  let segmentsDone = 0;
  const beat = setInterval(() => { admin.from("long_form_render_jobs").update({ heartbeat_at: new Date().toISOString(), segments_done: segmentsDone, updated_at: new Date().toISOString() }).eq("id", job.id).then(() => {}); }, 20_000);
  try {
    // Integrity (blocking): every clip names its image version + hash.
    const v2 = edl.version === "STICKMAN_EDL_V2";
    const noHash = v2 ? [] : edl.clips.filter((c) => !c.imageVersionId || !c.imageSha256).map((c) => c.beatSequence);
    if (noHash.length) throw new TerminalError("EDL_INTEGRITY", "The edit list is missing image versions. Please start the render again.", `beats without image id/hash: ${noHash.join(",")}`);
    await admin.from("long_form_render_jobs").update({ segments_total: edl.clips.length }).eq("id", job.id);
    // Phase 5c: render from the full-res sources (1440p master) when every clip has one.
    const useMaster = !v2 && edl.clips.every((c) => c.masterImage && c.masterSize);
    // EDL v2: the chosen output (1080p, or the 1440p "Best for YouTube" master).
    const profile = useMaster || (v2 && edl.height >= 1440) ? PROFILES.master : PROFILES.base;
    const setStage = (stage) => admin.from("long_form_render_jobs").update({ stage, updated_at: new Date().toISOString() }).eq("id", job.id).then(() => {});

    // Inputs (verified), then segments — both resumable.
    const audioPath = path.join(inDir, "narration.mp3");
    await download(v2 ? edl.audio.url : edl.audio.path, audioPath, edl.audio.sha256 ?? null);
    const musicPath = v2 && edl.music?.url ? path.join(inDir, "music.audio") : null;
    if (musicPath) await download(edl.music.url, musicPath, null);
    // EDL v2: the timeline's pieces (clip frames + transition windows) are the segments.
    const units = v2 && edl.pieces ? edl.pieces.map((p, k) => ({ ...p, index: k, startFrame: p.fromFrame })) : edl.clips;
    // Parallel render: a CHUNK renders pieces [piece_from, piece_to) and uploads
    // one chunk video; the PARENT (released when every chunk is done) joins them.
    const isChunk = !!job.parent_job_id;
    const isParent = !isChunk && Number(job.chunk_count ?? 0) > 0;
    const mine = isChunk ? units.slice(job.piece_from, job.piece_to) : isParent ? [] : units;
    await admin.from("long_form_render_jobs").update({ segments_total: mine.length }).eq("id", job.id);
    const queue = [...mine];
    const segPath = (c) => path.join(segDir, `seg-${String(c.index).padStart(3, "0")}.mp4`);
    const segFrames = new Array(units.length);
    let tSegments = 0;
    // EDL v2: every text / caption layer is drawn here (Deno, the app's own drawing code) as small positioned PNGs.
    let overlayAt = {};
    const myKeys = [...new Set(mine.flatMap((u) => (u.overlays ?? []).map((o) => o.key)))];
    if (v2 && !edl.overlayFiles && myKeys.length) {
      await setStage("drawing");
      const manifestPath = path.join(inDir, "overlays", "manifest.json");
      if (!(await exists(manifestPath))) {
        const edlPath = path.join(dir, "edl.json"), keysPath = path.join(dir, "keys.json");
        await writeFile(edlPath, JSON.stringify(edl));
        await writeFile(keysPath, JSON.stringify(myKeys));
        const r = await run(DENO, ["run", "-A", "--no-check", path.join(HERE, "draw-overlays.ts"), edlPath, path.join(inDir, "overlays"), keysPath]);
        if (r.code !== 0) throw new Error(`overlays: ${r.err.slice(-400)}`);
      }
      overlayAt = JSON.parse(await readFile(manifestPath, "utf8"));
    }
    await setStage("rendering");
    const t1 = Date.now();
    await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length) {
        const c = queue.shift();
        const out = segPath(c);
        if (await exists(out) && (await frameCount(out)) === c.frames) { segFrames[c.index] = c.frames; segmentsDone++; continue; }
        if (v2) {
          // EDL v2: the picture + the overlay PNGs showing on this clip's frames.
          // The full-res master when the EDL names one (crop there, never upsample), else the 1920x1080 picture.
          const imgOf = async (clip) => {
            const p = path.join(inDir, `${clip.masterImage ? "full" : "img"}-${String(clip.index).padStart(3, "0")}.jpg`);
            try { await download(clip.masterImage ?? clip.image, p, null); }
            catch (e) { if (!clip.masterImage) throw e; clip.masterImage = null; clip.masterSize = null; return imgOf(clip); } // an expired master: the 1920x1080 picture
            // The master's real size (crop 16:9 there, never upsample).
            if (clip.masterImage && !clip.masterSize) { const [w, h] = (await probe(p, ["-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0"])).split(",").map(Number); clip.masterSize = { width: w, height: h }; }
            return p;
          };
          const inputs = ["-loop", "1", "-framerate", String(edl.fps), "-i", await imgOf(edl.pieces ? edl.clips[c.a] : c)];
          if (edl.pieces && c.kind === "xfade") inputs.push("-loop", "1", "-framerate", String(edl.fps), "-i", await imgOf(edl.clips[c.b]));
          for (const o of c.overlays) { if (overlayAt[o.key]) { inputs.push("-i", overlayAt[o.key].file); continue; } const p = path.join(inDir, `ov-${o.key}.png`); await download(edl.overlayFiles[o.key], p, null); inputs.push("-i", p); }
          await ff([...inputs, "-filter_complex", edl.pieces ? pieceGraph(c, edl.clips, edl.fps, edl.width, edl.height, overlayAt) : clipGraphV2(c, edl.width, edl.height), "-map", "[v]", "-frames:v", String(c.frames), ...x264For(profile), "-r", String(edl.fps), "-video_track_timescale", "30000", "-an", out + ".part.mp4"]);
          await rename(out + ".part.mp4", out);
          segFrames[c.index] = await frameCount(out);
          segmentsDone++;
          continue;
        }
        const img = path.join(inDir, `${useMaster ? "full" : "img"}-${String(c.index).padStart(3, "0")}.jpg`);
        await download(useMaster ? c.masterImage : c.image, img, useMaster ? c.masterSha256 ?? null : c.imageSha256);
        const inputs = ["-loop", "1", "-framerate", String(edl.fps), "-i", img];
        const ovSrc = useMaster ? c.overlayImageMaster : c.overlayImage;
        if (ovSrc) { const ov = path.join(inDir, `${useMaster ? "ovlm" : "ovl"}-${String(c.index).padStart(3, "0")}.png`); await download(ovSrc, ov, null); inputs.push("-i", ov); }
        await ff([...inputs, "-filter_complex", clipGraph({ ...c, overlayImage: ovSrc }, edl, profile), "-map", "[v]", "-frames:v", String(c.frames), ...x264For(profile), "-r", String(edl.fps), "-video_track_timescale", "30000", "-an", out + ".part.mp4"]);
        await rename(out + ".part.mp4", out); // a crash never leaves a half segment under the final name
        segFrames[c.index] = await frameCount(out);
        segmentsDone++;
      }
    }));
    tSegments = Date.now() - t1;
    const listOf = (files) => files.map((f) => `file '${f.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`).join("\n");

    if (isChunk) {
      await setStage("uploading");
      const chunkList = path.join(dir, "chunk-concat.txt"), chunkPath = path.join(dir, `chunk-${job.chunk_index}.mp4`);
      await writeFile(chunkList, listOf(mine.map(segPath)));
      await ff(["-f", "concat", "-safe", "0", "-i", chunkList, "-c", "copy", "-an", chunkPath]);
      const parentPrefix = `${job.project_id}/${job.parent_job_id}/chunks`;
      const upChunk = await tusUpload(chunkPath, `${parentPrefix}/chunk-${job.chunk_index}.mp4`, "video/mp4");
      const computeSeconds = Math.round((Date.now() - t0) / 1000);
      const { data: parentReady, error: doneErr } = await admin.rpc("complete_long_form_render_chunk", { p_chunk_id: job.id, p_output_path: upChunk.objectName, p_seg_frames: mine.map((u) => segFrames[u.index]), p_compute_seconds: computeSeconds });
      if (doneErr) throw new Error(`chunk done: ${doneErr.message}`);
      console.log(`chunk ${job.chunk_index + 1}/${job.chunk_count ?? "?"} of ${job.parent_job_id} done in ${computeSeconds}s · ${mine.length} pieces${parentReady ? " · last chunk: joining next" : ""}`);
      return { ok: true, chunk: true, parentReady: !!parentReady, computeSeconds };
    }
    let chunkFiles = null, chunkCompute = 0;
    if (isParent) {
      const { data: chunks } = await admin.from("long_form_render_jobs").select("id, chunk_index, output_path, checks, compute_seconds, status").eq("parent_job_id", job.id).order("chunk_index");
      if (!chunks?.length || chunks.some((c) => c.status !== "done")) throw new TerminalError("CHUNK_MISSING", "Part of the video couldn't be rendered. Please try rendering again.", "chunks not all done");
      chunkFiles = [];
      for (const c of chunks) {
        const f = path.join(segDir, `chunk-${c.chunk_index}.mp4`);
        await download(c.output_path, f, null);
        chunkFiles.push(f);
        chunkCompute += Number(c.compute_seconds ?? 0);
      }
      // The chunks' segment frame counts, in timeline order (they cover every piece).
      const all = chunks.flatMap((c) => c.checks?.segFrames ?? []);
      all.forEach((n, i) => { segFrames[i] = n; });
    }

    // Concat (stream copy) + narration, then the proxy.
    await setStage("finishing");
    const list = path.join(dir, "concat.txt");
    await writeFile(list, chunkFiles ? listOf(chunkFiles) : listOf(units.map(segPath)));
    const finalPath = path.join(dir, "final.mp4"), proxyPath = path.join(dir, "proxy-640x360.mp4"), masterPath = path.join(dir, "master-1440p.mp4");
    // Resumable: an output that is already complete (every frame) is kept.
    // Each is written to a .part file first, so a complete-looking file is complete.
    const done = async (f) => (await exists(f)) && (await frameCount(f)) === edl.totalFrames;
    const make = async (f, args) => { if (await done(f)) return; await ff([...args, f + ".part.mp4"]); await rename(f + ".part.mp4", f); };
    if (useMaster) {
      // The 1440p master is the concat itself; the 1080p final is ONE Lanczos downscale of it.
      await make(masterPath, ["-f", "concat", "-safe", "0", "-i", list, "-i", audioPath, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart"]);
      await make(finalPath, ["-i", masterPath, "-vf", "scale=1920:1080:flags=lanczos", ...x264For(PROFILES.base), "-c:a", "copy", "-movflags", "+faststart"]);
    } else if (musicPath) {
      // EDL v2 with music: the music loops under the voice, ducked while it speaks.
      await make(finalPath, ["-f", "concat", "-safe", "0", "-i", list, "-i", audioPath, "-stream_loop", "-1", "-i", musicPath, ...audioMixArgs(edl.musicVolumeExpr, edl.voiceVolume ?? 1), "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart"]);
    } else if (v2 && (edl.voiceVolume ?? 1) !== 1) {
      await make(finalPath, ["-f", "concat", "-safe", "0", "-i", list, "-i", audioPath, "-map", "0:v", "-map", "1:a", "-af", `volume=${edl.voiceVolume}`, "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart"]);
    } else {
      await make(finalPath, ["-f", "concat", "-safe", "0", "-i", list, "-i", audioPath, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart"]);
    }
    await make(proxyPath, ["-i", finalPath, "-vf", "scale=640:360:flags=lanczos", "-c:v", "libx264", "-preset", "veryfast", "-crf", "26", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart"]);
    const tEncode = Date.now() - t0;

    const checks = await runChecks({ edl: units === edl.clips ? edl : { ...edl, clips: units }, finalPath, proxyPath, audioPath, segFrames });
    if (!checks.duration.pass || !checks.cuts.pass || !checks.sync.pass) throw new TerminalError("RENDER_CHECKS_FAILED", "The rendered video failed its timing checks. Please try rendering again.", JSON.stringify(checks).slice(0, 400));

    // Upload (TUS resumable) — output, proxy, thumbnail (the first beat's image).
    await setStage("uploading");
    const outPrefix = `${job.project_id}/${job.id}/output`;
    const up = await tusUpload(finalPath, `${outPrefix}/final.mp4`, "video/mp4");
    const upMaster = useMaster ? await tusUpload(masterPath, `${outPrefix}/master-1440p.mp4`, "video/mp4") : null;
    const upProxy = await tusUpload(proxyPath, `${outPrefix}/proxy-640x360.mp4`, "video/mp4");
    // Thumbnail: the first beat's 1920x1080 image in every mode (master mode renders from full-res sources).
    const thumbLocal = path.join(inDir, "thumb-000.jpg");
    await download(edl.clips[0].image, thumbLocal, v2 ? null : edl.clips[0].imageSha256);
    await tusUpload(thumbLocal, `${outPrefix}/thumbnail.jpg`, "image/jpeg");
    // Compute across ALL attempts of this job (a resumed job already spent some).
    const computeSeconds = Number(job.compute_seconds ?? 0) + chunkCompute + Math.round((Date.now() - t0) / 1000);
    const result = await finish({
      jobId: job.id, outcome: "done", outputPath: up.objectName, proxyPath: upProxy.objectName, thumbnailPath: `${outPrefix}/thumbnail.jpg`,
      durationMs: checks.duration.videoMs, sizeBytes: up.size, proxySizeBytes: upProxy.size, masterPath: upMaster?.objectName ?? null, masterSizeBytes: upMaster?.size ?? null, checks: { ...checks, timings: { segmentsS: Math.round(tSegments / 1000), encodeS: Math.round(tEncode / 1000), totalS: computeSeconds, concurrency: CONCURRENCY, cpus: CPUS, chunks: Number(job.chunk_count ?? 0), wallS: job.created_at ? Math.round((Date.now() - Date.parse(job.created_at)) / 1000) : null } },
      computeSeconds, computeUsd: Number((computeSeconds * USD_PER_SECOND).toFixed(4)), computeUsdEstimated: true, host: HOST, machine: MACHINE,
    });
    console.log(`job ${job.id} done in ${computeSeconds}s · ${(up.size / 1e6).toFixed(1)} MB · billing ${result.billing}`);
    return { ok: true, checks, computeSeconds, sizeBytes: up.size, proxySizeBytes: upProxy.size, outputPath: up.objectName, proxyPath: upProxy.objectName };
  } catch (e) {
    const computeSeconds = Number(job.compute_seconds ?? 0) + Math.round((Date.now() - t0) / 1000);
    const terminal = e instanceof TerminalError || job.attempt >= job.max_attempts;
    console.error(`job ${job.id} ${terminal ? "FAILED" : "interrupted (will resume)"}: ${e.message}`);
    // A failed parallel render still paid for every chunk: the ledger gets all of it.
    const chunksCompute = async (parentId) => ((await admin.from("long_form_render_jobs").select("compute_seconds").eq("parent_job_id", parentId)).data ?? []).reduce((s, c) => s + Number(c.compute_seconds ?? 0), 0);
    if (terminal && job.parent_job_id) {
      await admin.from("long_form_render_jobs").update({ status: "failed", error_code: String(e.code ?? "RENDER_ERROR").slice(0, 120), finished_at: new Date().toISOString(), compute_seconds: computeSeconds }).eq("id", job.id);
      const total = await chunksCompute(job.parent_job_id);
      await finish({ jobId: job.parent_job_id, outcome: "failed", terminal: true, errorCode: e.code ?? "CHUNK_FAILED", userReason: e.userReason, computeSeconds: total, computeUsd: Number((total * USD_PER_SECOND).toFixed(4)), host: HOST, machine: MACHINE });
    } else if (terminal) {
      const total = computeSeconds + (Number(job.chunk_count ?? 0) > 0 ? await chunksCompute(job.id) : 0);
      await finish({ jobId: job.id, outcome: "failed", terminal: true, errorCode: e.code ?? "RENDER_ERROR", userReason: e.userReason, computeSeconds: total, computeUsd: Number((total * USD_PER_SECOND).toFixed(4)), host: HOST, machine: MACHINE });
    } else {
      // Transient: back to the queue; the next claim resumes from the finished segments.
      // Transient: back to the queue (the next claim resumes from the finished
      // segments); the compute already spent is kept on the job and billed at the end.
      await admin.from("long_form_render_jobs").update({ status: "queued", error_code: String(e.message).slice(0, 120), compute_seconds: computeSeconds, updated_at: new Date().toISOString() }).eq("id", job.id);
    }
    return { ok: false, error: e.message };
  } finally {
    clearInterval(beat);
  }
}

export async function claimAndRun() {
  const { data, error } = await admin.rpc("claim_long_form_render_job", { p_worker_id: WORKER_ID });
  if (error) throw new Error(`claim: ${error.message}`);
  if (!data?.id) return null;
  console.log(`claimed job ${data.id} (attempt ${data.attempt}) for project ${data.project_id}: ${data.edl.clips.length} clips, ${data.edl.totalFrames} frames`);
  return await processJob(data);
}

if (process.argv[1]?.endsWith("worker.mjs")) {
  const loop = process.argv.includes("--loop");
  do {
    let r = await claimAndRun();
    while (r?.parentReady) r = await claimAndRun();
    if (!r && loop) await new Promise((res) => setTimeout(res, 10_000));
    if (!loop) { if (!r) console.log("no queued job"); break; }
  } while (true);
}
