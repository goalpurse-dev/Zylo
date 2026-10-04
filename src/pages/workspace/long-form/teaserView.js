// teaserView.js — the free Long Form teaser's pure helpers (no network), shared
// by the Create page and the teaser page. Server calls: teaserApi.js.

// Set when a logged-out visitor presses Generate: after sign-up the Create
// page starts the teaser by itself (same niche, idea, length and voice).
export const TEASER_AUTOSTART_KEY = "zyvo:long-form:teaser-autostart";

// The loading screen's steps, from the teaser's real state (never a fake timer).
export function teaserSteps(teaser) {
  const total = teaser?.sceneCount ?? 3;
  const scenes = teaser?.scenes ?? [];
  const written = teaser && teaser.status !== "writing";
  const steps = [{ key: "title", label: written ? "Title and hook written" : "Writing your title…", state: written ? "done" : "active" }];
  for (let i = 0; i < total; i++) {
    const s = scenes[i];
    const done = s?.status === "ready", failed = s?.status === "failed" || s?.status === "skipped";
    const active = written && !done && !failed && scenes.slice(0, i).every((p) => ["ready", "failed", "skipped"].includes(p.status)) && teaser.status === "drawing";
    steps.push({ key: `scene-${i + 1}`, label: done ? `Scene ${i + 1} drawn` : failed ? `Scene ${i + 1} skipped` : `Drawing scene ${i + 1} of ${total}${active ? "…" : ""}`, state: done ? "done" : failed ? "skipped" : active ? "active" : "waiting" });
  }
  return steps;
}
export const teaserBusy = (teaser) => !teaser || teaser.status === "writing" || teaser.status === "drawing";
// What the full video would be, from the length picked on the Create page (~15 scenes a minute).
export function fullVideoFacts(teaser) {
  const minutes = Math.min(15, Math.max(8, Math.round(Number(teaser?.setup?.lengthMinutes) || 10)));
  return { minutes, scenes: Math.round((minutes * 15) / 10) * 10 };
}
