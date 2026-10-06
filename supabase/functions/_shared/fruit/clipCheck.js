// Clip check for AI Fruit Story v2: every finished clip is listened to and its
// last frame is looked at, before the user sees it. A clip that fails is made
// again once at our cost (engine.js); a check that can't run never blocks.
//
//   1. Words: the clip is transcribed (captionWords.js, about $0.0005; the
//      final video reuses the transcript) and compared with the line
//      (spoken.js). Seedance changed the words in 5 of its first 8 clips:
//      a dropped name, "knowed" for "know".
//   2. Last frame: a small Fly machine grabs the clip's last frame with ffmpeg
//      (edge functions can't decode video) and the picture check looks at it
//      (pictureCheck.js, about $0.001). One Wan clip grew a human man in the
//      background that was not in the picture it started from.
// Plain JS so node tests and Deno share it.
import { transcriptsForClips } from "./captionWords.js";
import { spokenProblem } from "./spoken.js";
import { CLIP_FRAME_PURPOSE, checkPicture } from "./pictureCheck.js";

/** Did the voice say the line? Returns {ok, problems, heard} or null when the clip couldn't be transcribed. */
export async function checkClipWords({ admin, apiKey, paidOff = false, userId, storyId, sceneId, clipUrl, line, durationSec, fetchImpl = fetch }) {
  const [t] = await transcriptsForClips({ admin, apiKey, paidOff, userId, storyId, clips: [{ sceneId, url: clipUrl, durationSec }], fetchImpl });
  if (!t) return null;
  if (t.heard === false) return { ok: false, problems: ["nobody speaks in the clip"], heard: "" };
  const problem = spokenProblem(line, t.text);
  return { ok: !problem, problems: problem ? [problem] : [], heard: t.text };
}

/** Looks at a clip's last frame: fruit heads, no humans, nobody new, no writing. Framing is not judged (the camera has moved). */
export async function checkClipFrame({ admin, apiKey, frameUrl, expected, ids, fetchLlm }) {
  const v = await checkPicture({ admin, apiKey, imageUrl: frameUrl, expected, purpose: CLIP_FRAME_PURPOSE, ids, ...(fetchLlm ? { fetchLlm } : {}) });
  return { ok: v.ok, problems: v.problems.map((p) => `last frame: ${p}`) };
}

export const framePath = (userId, storyId, jobId, attempt) => `fruit/${userId}/${storyId}/${jobId}-a${attempt}-last.jpg`;

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
