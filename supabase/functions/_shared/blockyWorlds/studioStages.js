// Blocky Worlds STUDIO ENGINE: the progress stages and the time a run takes. Pure, small, and safe for the page bundle
// (the page imports this file; studio.js re-exports it with the rest: the caps, the sweeper rules, the cost model).

// ---------------------------------------------------------------- the progress screen
/** The Studio run's stages, in order, with the run's % at each (the page shows them; the worker reports them). */
export const STUDIO_STAGES = Object.freeze([
  { stage: "queued", label: "Waiting for a director", pct: 0 },
  { stage: "voice", label: "Recording the narrator", pct: 4 },
  { stage: "plan", label: "Timing every line", pct: 8 },
  { stage: "directing", label: "Directing every shot", pct: 12 },
  { stage: "previews", label: "Test-shooting every shot", pct: 45 },
  { stage: "checking", label: "Checking every frame", pct: 55 },
  { stage: "fixing", label: "Fixing the weak shots", pct: 62 },
  { stage: "rendering", label: "Rendering the video", pct: 75 },
  { stage: "finishing", label: "Finishing up", pct: 95 },
].map(Object.freeze));
const STAGE_BY = Object.fromEntries(STUDIO_STAGES.map((s) => [s.stage, s]));
/** the runs.status each stage keeps (the status column's CHECK stays queued | voice | plan | render | done | failed) */
export const STUDIO_STATUS = Object.freeze({ queued: "queued", voice: "voice", plan: "plan", directing: "plan", previews: "plan", checking: "plan", fixing: "plan", rendering: "render", finishing: "render" });
export const isStudioStage = (s) => Object.hasOwn(STAGE_BY, String(s ?? ""));
export const studioPct = (stage) => STAGE_BY[stage]?.pct ?? 0;

/** A Studio run's stage for the page (null when done or failed): the worker's studio_stage, else read from the status. */
export function studioStageOf(run) {
  if (!run || run.status === "done" || run.status === "failed") return null;
  if (isStudioStage(run.studio_stage)) return run.studio_stage;
  return { queued: "queued", voice: "voice", plan: "directing", render: "rendering" }[run.status] ?? "queued";
}

/**
 * Which stage a paid step's name means (the worker wraps the Studio ledger's check(): every paid step is checked against
 * the caps under its name first, so the names say where the run is without touching studio/). round = fix rounds started.
 */
export function stageForStep(name, { round = 0 } = {}) {
  const n = String(name ?? "");
  if (/^runpod preview/.test(n)) return "previews";
  if (/^checker/.test(n)) return "checking";
  if (/^runpod final/.test(n)) return "rendering";
  if (/^director/.test(n)) return round > 0 ? "fixing" : "directing";
  return null;
}

/** The selected length (s) -> the video's real length: scripts are sized at 257 wpm, the 1.25x voice reads ~222 wpm. */
export const MEASURED = Object.freeze({
  scriptWpm: 257,        // config.js PACE.targetWpm (the writer sizes the script for the selected length)
  spokenWpm: 222,        // measured: 213 / 218 / 232 wpm on the Studio takes (run1, testA, testB) after pace.mjs
  cutsPerMin: 56,        // measured: 55.4 / 57.6 / 56.8 / 53 cuts a minute (run2, testA, testA2, testB)
});
export const realSeconds = (lengthSec) => +((Number(lengthSec) * MEASURED.scriptWpm) / MEASURED.spokenWpm).toFixed(1);

/** How long a run takes (s), from the measured runs: ~4 min fixed (voice, plan, mix, previews, uploads) + ~6 s a video s. */
export const studioEtaSec = (lengthSec) => Math.round(240 + 6 * realSeconds(lengthSec));
/** "about 10 minutes" for the progress screen: rounded to 5 minutes, at least 10 */
export function studioEtaText(lengthSec) {
  const m = Math.max(10, Math.round(studioEtaSec(lengthSec) / 300) * 5);
  return `about ${m} minutes`;
}
