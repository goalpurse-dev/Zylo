import test from "node:test";
import assert from "node:assert/strict";
import { deriveEpisodeGenerationProgress, activityLabelForCard, EPISODE_GENERATION_PHASE_COPY } from "../src/pages/workspace/long-form/sceneCardModel.js";

// 2026-09-19 "premium active-generation UI" pass. deriveEpisodeGenerationProgress
// is the ONE selector the hero panel, sidebar mini-status, and scene card
// production states all read from (item 10 — no parallel frontend state
// machine). These tests operate on plain card objects shaped exactly like
// buildSceneCards' own output ({ beatId, sequenceIndex, strategyLabel,
// status: { key } }) since that's the real, already-tested contract this
// function consumes.

function card(overrides) {
  return { beatId: "b1", sequenceIndex: 1, strategyLabel: "New scene", status: { key: "planned", label: "Planned" }, ...overrides };
}

test("no active run -> phase is idle regardless of card contents", () => {
  const p = deriveEpisodeGenerationProgress([card({ status: { key: "ready" } })], { hasActiveRun: false });
  assert.equal(p.phase, "idle");
});

test("nothing compiled yet (every card still planned) -> phase is compiling, even with an active run", () => {
  const cards = [card({ beatId: "b1" }), card({ beatId: "b2" })];
  const p = deriveEpisodeGenerationProgress(cards, { hasActiveRun: true });
  assert.equal(p.phase, "compiling");
  assert.equal(p.total, 2);
  assert.equal(p.processed, 0);
  assert.equal(p.processedPct, 0);
});

test("some queued/generating work exists -> phase is rendering, real counts split into queued/generating/checking buckets", () => {
  const cards = [
    card({ beatId: "b1", status: { key: "queued" } }),
    card({ beatId: "b2", status: { key: "generating" } }),
    card({ beatId: "b3", status: { key: "checking" } }),
    card({ beatId: "b4", status: { key: "ready" } }),
  ];
  const p = deriveEpisodeGenerationProgress(cards, { hasActiveRun: true });
  assert.equal(p.phase, "rendering");
  assert.equal(p.queued, 1);
  assert.equal(p.generating, 1);
  assert.equal(p.checking, 1);
  assert.equal(p.ready, 1);
  assert.equal(p.processed, 1, "only ready/needs_review/failed count as processed — checking is NOT processed yet");
});

test("all rendering finished, only QA remains -> phase is checking", () => {
  const cards = [card({ beatId: "b1", status: { key: "checking" } }), card({ beatId: "b2", status: { key: "ready" } })];
  const p = deriveEpisodeGenerationProgress(cards, { hasActiveRun: true });
  assert.equal(p.phase, "checking");
});

test("nothing active left but something needs a human decision -> phase is needs_review", () => {
  const cards = [card({ beatId: "b1", status: { key: "needs_review" } }), card({ beatId: "b2", status: { key: "ready" } })];
  const p = deriveEpisodeGenerationProgress(cards, { hasActiveRun: true });
  assert.equal(p.phase, "needs_review");
});

test("failed scenes alone (nothing else active) also route to needs_review, never a false 'ready'", () => {
  const cards = [card({ beatId: "b1", status: { key: "failed" } }), card({ beatId: "b2", status: { key: "ready" } })];
  const p = deriveEpisodeGenerationProgress(cards, { hasActiveRun: true });
  assert.equal(p.phase, "needs_review");
  assert.equal(p.failed, 1);
});

test("everything ready -> phase is ready, processedPct is 100", () => {
  const cards = [card({ beatId: "b1", status: { key: "ready" } }), card({ beatId: "b2", status: { key: "ready" } })];
  const p = deriveEpisodeGenerationProgress(cards, { hasActiveRun: true });
  assert.equal(p.phase, "ready");
  assert.equal(p.processedPct, 100);
});

test("currentActivities lists only actively-in-progress cards, sorted by sequenceIndex, capped at 4, with the real strategy-derived activity label", () => {
  const cards = [
    card({ beatId: "b3", sequenceIndex: 3, status: { key: "generating" }, strategyLabel: "New scene" }),
    card({ beatId: "b1", sequenceIndex: 1, status: { key: "checking" }, strategyLabel: "Edit" }),
    card({ beatId: "b2", sequenceIndex: 2, status: { key: "queued" } }), // queued is NOT "active" for this list
    card({ beatId: "b4", sequenceIndex: 4, status: { key: "compositing" }, strategyLabel: "Reuse" }),
  ];
  const p = deriveEpisodeGenerationProgress(cards, { hasActiveRun: true });
  assert.deepEqual(p.currentActivities.map((a) => a.beatId), ["b1", "b3", "b4"], "sorted by sequenceIndex, queued excluded");
  assert.equal(p.currentActivities[0].activity, "Checking visual quality", "checking always wins regardless of strategy");
  assert.equal(p.currentActivities[1].activity, "Creating a new scene");
  assert.equal(p.currentActivities[2].activity, "Preparing existing visual");
});

test("nextQueuedShotLabel surfaces the lowest-sequenceIndex queued card, or null if none queued", () => {
  const withQueued = deriveEpisodeGenerationProgress([card({ beatId: "b2", sequenceIndex: 2, status: { key: "queued" } }), card({ beatId: "b1", sequenceIndex: 1, status: { key: "queued" } })], { hasActiveRun: true });
  assert.equal(withQueued.nextQueuedShotLabel, "Shot 01");
  const withoutQueued = deriveEpisodeGenerationProgress([card({ status: { key: "ready" } })], { hasActiveRun: true });
  assert.equal(withoutQueued.nextQueuedShotLabel, null);
});

test("activityLabelForCard never leaks internal render-strategy vocabulary (GENERATE/EDIT/REUSE/CROP/PROGRAMMATIC_GRAPHIC) — only user-facing sentences", () => {
  for (const label of ["New scene", "Edit", "Graphic", "Reuse", "Crop", "Something unmapped"]) {
    const activity = activityLabelForCard(card({ strategyLabel: label, status: { key: "generating" } }));
    assert.doesNotMatch(activity, /GENERATE|EDIT|REUSE|CROP|COMPOSITE|PROGRAMMATIC_GRAPHIC/);
  }
  assert.equal(activityLabelForCard(card({ status: { key: "checking" }, strategyLabel: "New scene" } )), "Checking visual quality", "checking overrides strategy label even for a GENERATE scene");
});

test("every phase used by the UI has real title/subcopy copy defined, and subcopy is a function of the real total (never a hardcoded number)", () => {
  for (const phase of ["compiling", "rendering", "checking", "needs_review", "ready", "idle"]) {
    const entry = EPISODE_GENERATION_PHASE_COPY[phase];
    assert.ok(entry?.title, `missing title for phase ${phase}`);
    assert.equal(typeof entry.subcopy, "function");
  }
  assert.match(EPISODE_GENERATION_PHASE_COPY.rendering.subcopy(42), /42/);
});
