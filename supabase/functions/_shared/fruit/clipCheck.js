// Clip check for AI Fruit Story v2: every finished clip is listened to and its
// last frame is looked at, before the user sees it. A clip that fails is made
// again once at our cost (engine.js); a check that can't run never blocks.
//
//   1. Words: the clip is transcribed (captionWords.js, about $0.0005; the
//      final video reuses the transcript) and compared with the line
//      (spoken.js). Seedance changed the words in 5 of its first 8 clips:
//      a dropped name, "knowed" for "know". Only a difference that MATTERS
//      remakes the clip (a name, a missing or swapped word), never a slur or
//      a lost filler, and never more than once.
//   2. Last frame: a small Fly machine grabs the clip's last frame with ffmpeg
//      (edge functions can't decode video) and the picture check looks at it
//      (pictureCheck.js, about $0.001). One Wan clip grew a human man in the
//      background that was not in the picture it started from.
// Plain JS so node tests and Deno share it.
import { transcriptsForClips } from "./captionWords.js";
import { spokenProblem } from "./spoken.js";
import { CLIP_FRAME_PURPOSE, DRAWN_TEXT_PROBLEM, checkPicture } from "./pictureCheck.js";
import { REMAKE_NOTE } from "./engine.js";

/**
 * What the clip check did to one story, for the log: how many clips were made
 * again and what that cost us (the discarded clips), plus what the checks
 * themselves cost. Saved with every final build (fruit-story-api).
 * @param {{id:string, kind:string, error?:string}[]} jobs   the story's fruit_jobs
 * @param {{job_id?:string, purpose:string, ok?:boolean, cost_usd?:number, attempt?:number}[]} calls  its fruit_ai_calls
 */
export function remakeStats(jobs, calls) {
  const clipJobs = (jobs ?? []).filter((j) => j.kind === "clip");
  const remade = clipJobs.filter((j) => String(j.error ?? "").startsWith(REMAKE_NOTE));
  const usd = (n) => Math.round(n * 1e6) / 1e6;
  let remakeCostUsd = 0;
  for (const j of remade) {
    // Every clip the provider delivered for this job except the last one (the kept one) was thrown away.
    const made = (calls ?? []).filter((c) => c.job_id === j.id && c.purpose === "clip" && c.ok).sort((a, b) => (a.attempt ?? 0) - (b.attempt ?? 0));
    remakeCostUsd += made.slice(0, -1).reduce((sum, c) => sum + (Number(c.cost_usd) || 0), 0);
  }
  const checkCostUsd = (calls ?? []).filter((c) => ["caption_words", "clip_frame", CLIP_FRAME_PURPOSE].includes(c.purpose)).reduce((sum, c) => sum + (Number(c.cost_usd) || 0), 0);
  return {
    clips: clipJobs.length,
    remade: remade.length,
    remakeRate: clipJobs.length ? Math.round((remade.length / clipJobs.length) * 100) / 100 : 0,
    remakeCostUsd: usd(remakeCostUsd),
    checkCostUsd: usd(checkCostUsd),
    reasons: remade.map((j) => String(j.error).slice(REMAKE_NOTE.length).trim()),
  };
}

/** Did the voice say the line? Returns {ok, problems, heard} or null when the clip couldn't be transcribed. */
export async function checkClipWords({ admin, apiKey, paidOff = false, userId, storyId, sceneId, clipUrl, line, durationSec, fetchImpl = fetch }) {
  const [t] = await transcriptsForClips({ admin, apiKey, paidOff, userId, storyId, clips: [{ sceneId, url: clipUrl, durationSec }], fetchImpl });
  if (!t) return null;
  if (t.heard === false) return { ok: false, problems: ["nobody speaks in the clip"], heard: "" };
  const problem = spokenProblem(line, t.text);
  return { ok: !problem, problems: problem ? [problem] : [], heard: t.text };
}

/** Looks at a clip's last frame: fruit heads, no humans, nobody new, no writing. Framing is not judged (the camera has moved). */
// speechUrl: two frames from the middle of the line, looked at for subtitles the video model drew itself.
export async function checkClipFrame({ admin, apiKey, frameUrl, speechUrl = null, expected, ids, fetchLlm }) {
  const v = await checkPicture({ admin, apiKey, imageUrl: frameUrl, expected, purpose: CLIP_FRAME_PURPOSE, speechFramesUrl: speechUrl, ids, ...(fetchLlm ? { fetchLlm } : {}) });
  // Words the model drew itself are seen in the middle of the clip, not in its last frame.
  return { ok: v.ok, problems: v.problems.map((p) => (p.startsWith(DRAWN_TEXT_PROBLEM) ? p : `last frame: ${p}`)) };
}

export const framePath = (userId, storyId, jobId, attempt) => `fruit/${userId}/${storyId}/${jobId}-a${attempt}-last.jpg`;
/** Two frames from the middle of the line, side by side: where subtitles drawn by the video model show. */
export const speechFramesPath = (userId, storyId, jobId, attempt) => `fruit/${userId}/${storyId}/${jobId}-a${attempt}-speech.jpg`;

/**
 * What the frame machine runs (node 22 + ffmpeg, the final-video image): get
 * the clip, write its last frame as a JPG, PUT it to a one-time signed upload
 * URL, then report to fruit-worker. Kept as a real function so it is linted
 * and tested; the machine gets its source through `node -e`.
 */
export async function frameMain() {
  const job = JSON.parse(process.env.FRUIT_FRAME_JOB);
  const { execFileSync } = require("node:child_process");
  const fs = require("node:fs");
  const os = require("node:os");
  const path = require("node:path");
  let ok = false;
  let error = null;
  try {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "frame-"));
    const src = path.join(dir, "clip.mp4");
    const out = path.join(dir, "last.jpg");
    const res = await fetch(job.clipUrl, { signal: AbortSignal.timeout(60000) });
    if (!res.ok) throw new Error(`download ${res.status}`);
    fs.writeFileSync(src, Buffer.from(await res.arrayBuffer()));
    // Decode the last half second and keep overwriting one file: what is left is the very last frame.
    execFileSync(process.env.FFMPEG || "ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-sseof", "-0.5", "-i", src, "-update", "1", "-q:v", "3", out]);
    if (job.uploadUrl) {
      const put = await fetch(job.uploadUrl, { method: "PUT", headers: { "Content-Type": "image/jpeg", "x-upsert": "true" }, body: fs.readFileSync(out), signal: AbortSignal.timeout(60000) });
      if (!put.ok) throw new Error(`upload ${put.status}`);
    } else if (job.saveTo) {
      fs.copyFileSync(out, job.saveTo);   // local test
    }
    // Two frames from the middle of the line (30% and 60% of the clip), side by side: subtitles the video
    // model drew itself are on screen there and gone by the last frame.
    const length = Number(job.durationSec) || 0;
    if (length > 0 && (job.speechUploadUrl || job.speechSaveTo)) {
      const speech = path.join(dir, "speech.jpg");
      execFileSync(process.env.FFMPEG || "ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-ss", String(length * 0.3), "-i", src, "-ss", String(length * 0.6), "-i", src,
        "-filter_complex", "[0:v]scale=-2:720[a];[1:v]scale=-2:720[b];[a][b]hstack=inputs=2", "-frames:v", "1", "-q:v", "4", speech]);
      if (job.speechUploadUrl) {
        const put = await fetch(job.speechUploadUrl, { method: "PUT", headers: { "Content-Type": "image/jpeg", "x-upsert": "true" }, body: fs.readFileSync(speech), signal: AbortSignal.timeout(60000) });
        if (!put.ok) throw new Error(`speech frames upload ${put.status}`);
      } else fs.copyFileSync(speech, job.speechSaveTo);   // local test
    }
    ok = true;
  } catch (e) {
    error = String((e && e.message) || e).slice(0, 300);
  }
  if (job.callbackUrl) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(job.callbackUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "clip_frame_done", jobId: job.jobId, token: job.token, ok, error }), signal: AbortSignal.timeout(20000) });
        if (res.ok) break;
      } catch { /* try again */ }
      await new Promise((r) => setTimeout(r, attempt * 2000));
    }
  }
  if (!ok) console.error("[fruit-frame] failed:", error);
  return { ok, error };
}

/** The `node -e` source for the frame machine. */
export const FRAME_SCRIPT = `(${frameMain.toString()})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });`;

/** A small shared machine is plenty for one frame (≈ $0.000003/s, Fly list price for shared-cpu-2x 1 GB). */
export const FRAME_MACHINE = { cpu_kind: "shared", cpus: 2, memory_mb: 1024 };
export const FRAME_USD_PER_SECOND = 0.0000032;

/** Machines API body: the final-video image (it has node and ffmpeg), run once, destroyed after. */
export function frameMachineConfig({ image, job }) {
  return {
    name: `fruit-frame-${String(job.jobId).slice(0, 8)}-${Date.now().toString(36)}`,
    config: {
      image,
      guest: FRAME_MACHINE,
      auto_destroy: true,
      restart: { policy: "no" },
      init: { cmd: ["node", "-e", FRAME_SCRIPT] },
      env: { FRUIT_FRAME_JOB: JSON.stringify(job) },
    },
  };
}
