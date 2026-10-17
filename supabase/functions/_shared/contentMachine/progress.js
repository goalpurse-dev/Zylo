// Content Machine: a run's live progress for the Start button (owner, 2026-10-18): which step each
// slideshow is on (writing → captions & checks → images → rendering → done), a progress share, and
// "about X min left" from how long past real runs took per slideshow. Pure: the rows are given.

export const STEPS = [
  { key: "writing", label: "Writing", stages: ["plan", "write", "write_batch", "poll_batch"] },
  { key: "captions", label: "Captions & checks", stages: ["check", "rewrite"] },
  { key: "images", label: "Images", stages: ["images"] },
  { key: "rendering", label: "Rendering", stages: ["render", "render_wait"] },
];
const ORDER = ["writing", "captions", "images", "rendering", "done"];
const FINISHED = new Set(["done", "failed", "skipped_budget", "rejected", "cancelled"]);
export const DEFAULT_SECONDS_PER_SLIDESHOW = 150;

/** The step one slideshow is on: from its own status, else its newest job. */
export function stepOf(idea, jobs) {
  if (FINISHED.has(idea.status)) return idea.status === "done" ? "done" : idea.status;
  const mine = jobs.filter((j) => j.idea_id === idea.id && j.status !== "cancelled");
  const last = mine[mine.length - 1];
  if (!last) return "writing";
  return STEPS.find((s) => s.stages.includes(last.stage))?.key ?? "writing";
}

/** Seconds per slideshow in past real runs (the median), or the default. */
export function secondsPerSlideshow(pastRuns) {
  const values = pastRuns
    .map((r) => (Date.parse(r.finished_at) - Date.parse(r.started_at)) / 1000 / Math.max(1, Number(r.input?.count) || 1))
    .filter((v) => Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);
  return values.length ? values[Math.floor(values.length / 2)] : DEFAULT_SECONDS_PER_SLIDESHOW;
}

export function runProgress({ run, ideas, jobs, pastRuns = [], now = new Date() }) {
  const per = ideas.map((i) => ({ id: i.id, title: i.title, step: stepOf(i, jobs) }));
  const counts = Object.fromEntries([...ORDER, "failed", "skipped_budget", "cancelled", "rejected"].map((k) => [k, 0]));
  for (const p of per) counts[p.step] = (counts[p.step] ?? 0) + 1;
  const total = Math.max(1, Number(run.input?.count) || ideas.length || 1);
  // Each slideshow counts 0–4 steps of 4; finished ones (any outcome) count fully.
  const doneSteps = per.reduce((a, p) => a + (ORDER.includes(p.step) ? ORDER.indexOf(p.step) : 4), 0);
  const share = Math.min(1, doneSteps / (total * 4));
  const active = !["done", "failed", "budget_stopped", "cancelled"].includes(run.status);
  const elapsed = run.started_at ? Math.max(0, (now - new Date(run.started_at)) / 1000) : 0;
  const estimate = secondsPerSlideshow(pastRuns) * total;
  // What's left: the estimate minus the time spent, never below what the unfinished share implies.
  const left = active ? Math.max(Math.round(estimate * (1 - share)) * 0.5, estimate - elapsed, 0) : 0;
  return {
    status: run.status, active, total, share: Math.round(share * 1000) / 1000,
    steps: STEPS.map((s) => ({ key: s.key, label: s.label, now: counts[s.key], passed: per.filter((p) => ORDER.indexOf(p.step) > ORDER.indexOf(s.key) || (!ORDER.includes(p.step))).length })),
    done: counts.done, failed: counts.failed + counts.skipped_budget, cancelled: counts.cancelled,
    elapsedSec: Math.round(elapsed), leftSec: Math.round(left), ideas: per,
  };
}
