// AI Fruit Story v2 final video (stage 3f): the job a Fly machine runs
// (render-worker/src/fruitFinal.mjs) and what its report does to the story.
// Plain JS so node tests and Deno share it.

/** Fly machine for one final: 4 dedicated CPUs, ≈ $0.0000478/s (Fly list price, performance-4x). */
export const FINAL_MACHINE = { cpu_kind: "performance", cpus: 4, memory_mb: 8192 };
export const FINAL_USD_PER_SECOND = 0.0000478;
/** A build that hasn't reported after this long is failed by the reconciler (free retry). */
export const FINAL_TIMEOUT_MIN = 10;

export const finalPath = (userId, storyId, callId) => `fruit/${userId}/${storyId}/final-${callId}.mp4`;

/**
 * Seconds the video holds on the last picture after the final word: a short
 * closing beat so it doesn't cut off dead on the last syllable, long enough
 * to read the end card when there is one (which now shows during the beat,
 * not over the last line).
 */
export const CLOSING_BEAT_SEC = { plain: 1.0, endCard: 1.8 };

/**
 * The machine's job: every clip in scene order with its line. The API adds
 * each clip's transcript (words: where to trim and when each caption word
 * shows) and, when the voice really changed the line, caption: what was said.
 */
export function buildFinalJob({ story, scenes, callId, captions, uploadUrl, callbackUrl, token, overlays = null, cover = null }) {
  const ordered = [...scenes].sort((a, b) => a.idx - b.idx);
  const missing = ordered.filter((s) => s.clip_status !== "ready" || !s.clip_url);
  if (!ordered.length || missing.length) throw new Error("every scene needs a clip");
  return {
    callId, storyId: story.id, aspect: story.aspect, captions: Boolean(captions),
    ...(overlays && (overlays.part || overlays.end) ? { overlays } : {}),
    closingBeatSec: overlays?.end ? CLOSING_BEAT_SEC.endCard : CLOSING_BEAT_SEC.plain,
    ...(cover ? { cover } : {}),
    clips: ordered.map((s) => ({ url: s.clip_url, line: s.line })),
    uploadUrl, callbackUrl, token,
  };
}

/**
 * The scenes whose clip carries words the video model drew itself. The final
 * video then leaves its own caption off those clips, so there is never more
 * than ONE caption line on screen (pictureCheck.js#DRAWN_TEXT_PROBLEM).
 *   scenes: [{id, clip_job_id}]
 *   jobs:   the story's clip jobs, [{id, attempt}]
 *   checks: fruit_ai_calls rows of the clip frame check, [{job_id, attempt, created_at, response: {verdict: {problems}}}]
 * The check that counts is the newest one for the clip's CURRENT attempt. When that
 * attempt was never checked (the frame machine failed) but an earlier attempt of
 * the same clip had drawn words, the clip counts as carrying them: one caption
 * too few is the safe side, two at once never happens.
 */
export function scenesWithDrawnText(scenes, jobs, checks, problem) {
  const flagged = (row) => (row?.response?.verdict?.problems ?? []).some((p) => String(p).includes(problem));
  const out = new Set();
  for (const scene of scenes ?? []) {
    const job = (jobs ?? []).find((j) => j.id === scene.clip_job_id);
    if (!job) continue;
    const mine = (checks ?? []).filter((c) => c.job_id === job.id).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    const current = mine.filter((c) => Number(c.attempt) === Number(job.attempt)).at(-1);
    if (current ? flagged(current) : mine.some(flagged)) out.add(scene.id);
  }
  return out;
}

/** Machines API body: the render-worker image, run once, destroyed after. */
export function finalMachineConfig({ image, job }) {
  return {
    name: `fruit-final-${job.callId.slice(0, 8)}-${Date.now().toString(36)}`,
    config: {
      image,
      guest: FINAL_MACHINE,
      auto_destroy: true,
      restart: { policy: "no" },
      init: { cmd: ["node", "src/fruitFinal.mjs"] },
      env: { FRUIT_FINAL_JOB: JSON.stringify(job), WORK_DIR: "/tmp/render", MACHINE_USD_PER_SECOND: String(FINAL_USD_PER_SECOND) },
    },
  };
}

/** Emotions that make a scene the cover (strongest first); the latest such scene wins. */
const DRAMA = ["furious", "enraged", "livid", "outraged", "horrified", "shocked", "stunned", "betrayed", "devastated", "panicked", "terrified", "heartbroken", "gasping", "screaming", "angry", "desperate", "smug", "gleeful", "triumphant"];

/**
 * The most dramatic scene (by emotion; ties and no match: the later scene, the cliffhanger).
 * A picture the check flagged (a human head...) is never the cover unless all of them are.
 */
export function coverScene(scenes) {
  const drawn = [...scenes].filter((s) => s.image_url).sort((a, b) => a.idx - b.idx);
  const clean = drawn.filter((s) => s.image_check !== "failed");
  const ordered = clean.length ? clean : drawn;
  let best = null, bestScore = -1;
  for (const s of ordered) {
    const e = String(s.emotion ?? "").toLowerCase();
    const hit = DRAMA.findIndex((d) => e.includes(d));
    const score = hit < 0 ? 0 : DRAMA.length - hit;
    if (score >= bestScore) { best = s; bestScore = score; }
  }
  return best;
}

/**
 * Series overlay texts. Episodes: "Part N" and "Part N+1: next title / Follow
 * for more" (the last episode: "Follow for more"). Singles: "Part 1" and
 * "Part 2 coming soon / Follow for more".
 */
export function overlayTexts({ partLabel, endCard, episodeNumber = null, nextTitle = null }) {
  const n = episodeNumber ?? 1;
  return {
    part: partLabel ? `Part ${n}` : null,
    end: endCard ? (episodeNumber ? (nextTitle ? `Part ${n + 1}: ${nextTitle}\nFollow for more` : "Follow for more") : "Part 2 coming soon\nFollow for more") : null,
  };
}

/** What a report changes on the story: ready with the new URL (and cover), or back to clips_ready with a free-retry error. */
export function storyUpdateForReport(report, publicUrl, failMessage, coverUrl = null) {
  if (report?.ok) {
    return {
      status: "final_ready", final_status: "ready", final_url: publicUrl, final_error: null,
      ...(report.cover && coverUrl ? { cover_url: coverUrl } : {}),
      final_trimmed_sec: Number(report.trimmedSec) || 0,
      final_trimmed_per_clip: Array.isArray(report.trimmedPerClip) ? report.trimmedPerClip.map((n) => Number(n) || 0) : [],
    };
  }
  return { status: "clips_ready", final_status: "failed", final_error: failMessage };
}
