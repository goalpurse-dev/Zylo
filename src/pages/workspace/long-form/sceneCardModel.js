import { customerVisualMessage } from "./customerVisualMessage.js";
// Deterministic VisualBeat -> user-facing scene card mapping for the
// Generate workspace. Deliberately duplicates the tiny, purely-mechanical
// renderMethod -> category mapping from supabase/functions/_shared/
// sceneRenderPlan.ts's RENDER_STRATEGY_FROM_METHOD (same disclosed cross-
// runtime duplication as stylePresets.js — Deno and the browser bundle
// can't share one module) so a beat with no SceneRenderPlan compiled yet
// can still show a correct, honest strategy badge with zero provider calls
// and zero guessing.
//
// Internal engineering vocabulary (GENERATE, EDIT, REUSE_WITH_DELTA,
// baseSetupKey, continuityGroupId, renderMethod...) never reaches this
// module's return value — every field here is already a user-facing label.

// 2026-09-22 "FINAL stabilization pass" §11 — real Atlantis finding: a
// scene with base_result_url = clean base and final_result_url = the
// overlay-composited frame (overlay_applied:true) showed the composited
// text on its CARD (which already preferred final_result_url) but the text
// disappeared the moment its MODAL opened, because the modal read
// previewScene.result_url directly — a different field, resolved
// independently, with no shared rule. THE authoritative "what should this
// scene currently show" resolver — every surface (card thumbnail, modal
// preview, fullscreen viewer, and any future export/editor preview) must
// call this and only this, never read final_result_url/result_url
// separately, or two surfaces WILL drift again. Default display is always
// the current FINAL frame; Final equals Base whenever no overlay exists,
// by construction (final_result_url is only ever set to something
// different from the base pixels once an overlay is actually composited).
export function resolveSceneDisplayUrl(scene) {
  return scene?.final_result_url ?? scene?.result_url ?? null;
}

// The clean, un-overlaid base — for an eventual explicit "Base" view/tab
// (§0/§10, architected but not built this pass). Falls back to the same
// resolved display url for any scene compiled before base_result_url
// existed, so an older row is never left with no image at all.
export function resolveSceneBaseUrl(scene) {
  return scene?.base_result_url ?? resolveSceneDisplayUrl(scene);
}

const STRATEGY_LABELS = {
  GENERATE: "New scene",
  EDIT: "Edit",
  REUSE: "Reuse",
  CROP: "Crop",
  COMPOSITE: "Crop",
  PROGRAMMATIC_GRAPHIC: "Graphic",
};

export function deriveStrategyLabel(renderMethod) {
  return STRATEGY_LABELS[renderMethod] ?? "Scene";
}

// Mirrors visualWorldPlanning.js's resolveDisplayStatus philosophy — a
// small number of honest, truthful states, never a fake "Generating" while
// nothing has actually been claimed yet.
//
// REUSE/CROP/COMPOSITE/PROGRAMMATIC_GRAPHIC never get a job_id at all (see
// advance-long-form-scene-generation's processZeroCostScene — they resolve
// synchronously within one worker invocation, no provider job ever
// created). Labeling that in-flight moment "Starting…" — the same label a
// GENERATE/EDIT scene shows the instant BEFORE its real provider job
// exists — would misrepresent it as about to make a paid provider call it
// will never make. "Compositing…"/"Preparing graphic…" is what's actually
// happening (Part 5's truthful-states requirement).
const ZERO_COST_RUNNING_LABEL = { REUSE: "Linking reused visual…", CROP: "Reframing existing visual…", COMPOSITE: "Compositing…", PROGRAMMATIC_GRAPHIC: "Preparing graphic…" };
// 2026-09-21 emergency pause feature: `isPaused` only ever changes the
// LABEL on an otherwise-untouched "queued" card ("Paused" instead of
// "Queued") — the key stays "queued" so every existing count/filter
// (deriveEpisodeGenerationProgress's `queued`, the phase derivation below)
// keeps working unchanged. A scene already "generating"/"starting"/
// "compositing" is mid-flight and stays labeled that way regardless of
// pause — pause never relabels real in-progress work as paused.
export function deriveSceneCardStatus(scene, isPaused = false) {
  if (!scene) return { key: "planned", label: "Planned" };
  // 2026-09-22 "FINAL stabilization pass" §18 — real Atlantis finding: most
  // rejected scenes carry severity=HARD_FAIL, requiresReview=false (an
  // objectively broken result — wrong identity, wrong style, forbidden
  // content), yet the UI labeled every rejection "Needs review," implying a
  // human judgment call even when there isn't one to make. The operational
  // bucket (filterable as needs_review, countable, eligible for manual
  // approve) stays unified — either way the user must look at it — but the
  // LABEL now tells the truth: an objectively broken HARD_FAIL result reads
  // "Needs fix"; only a genuinely soft/ambiguous result QA itself flagged
  // for human judgment (requiresReview:true) reads "Needs review."
  if (scene.status === "succeeded" && scene.qa_status === "rejected") {
    return { key: "needs_review", label: scene.qa_result?.requiresReview ? "Needs review" : "Needs fix" };
  }
  if (scene.status === "succeeded" && scene.qa_status == null) return { key: "checking", label: "Checking…" };
  if (scene.status === "succeeded") return { key: "ready", label: "Ready" };
  if (scene.status === "failed") return { key: "failed", label: "Needs another try" };
  if (scene.status === "running" && scene.job_id) return { key: "generating", label: "Generating…" };
  if (scene.status === "running" && ZERO_COST_RUNNING_LABEL[scene.render_strategy]) return { key: "compositing", label: ZERO_COST_RUNNING_LABEL[scene.render_strategy] };
  if (scene.status === "running") return { key: "starting", label: "Starting…" };
  return { key: "queued", label: isPaused ? "Paused" : "Queued" };
}

// 2026-09-22 "FINAL stabilization pass" §16 — real Atlantis finding: cards
// exposed internal planning wording verbatim, e.g. "Help the viewer
// understand this exact narration moment (Return to the subject...)" —
// visualShotPlanning.js's own deterministic shotPurpose TEMPLATE (not an
// authored description), never meant for a viewer to read. The intended
// full fix (a short, natural-language displaySummary field authored by the
// Scene Director LLM call) is NOT implemented — that call
// (runSceneDirector, start-long-form-scene-generation/index.ts) is
// currently dead code, never invoked anywhere in the live pipeline, so
// there is no existing model call to attach a new field to without adding
// a brand-new provider call this pass didn't authorize.
//
// 2026-09-23 "root-contract stabilization" pass — real Atlantis finding:
// this still-live fallback read composition.focalSubject (raw — often a
// literal entity id like "ent_timaeus", see episodePreflight.ts's own fix)
// and templated it as "A visual of ent_timaeus." — exactly the kind of
// internal-id leak and lazy phrasing the user explicitly called out. Now
// reads composition.displaySubject (already resolved to a human-readable
// name by the backend fix), never the "A visual of..." template, and
// defensively strips any raw id-shaped token that might still slip through
// from either source — belt-and-suspenders, since a UI-layer leak is worse
// than a backend one (a user sees it directly).
const INTERNAL_SHOT_PURPOSE_WRAPPER = /^Help the viewer understand this exact narration moment\b/i;
const RAW_ENTITY_ID_TOKEN = /\b(?:ent|obj|loc)_[a-z0-9_]+\b/gi;
function stripRawEntityIds(text) {
  return String(text ?? "").replace(RAW_ENTITY_ID_TOKEN, "").replace(/\s{2,}/g, " ").trim();
}
// Roughly 5-14 words, ending cleanly — never mid-word truncation.
function capToReadableLength(text, maxWords = 14) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text;
  return `${words.slice(0, maxWords).join(" ")}...`;
}

// 2026-09-23 "systemic production stabilization" pass, Item D — real
// Atlantis finding: "Operational checklist graphic appears in this scene."
// (the old fallback for EVERY PROGRAMMATIC_GRAPHIC beat, regardless of what
// the graphic actually shows) is exactly the internal-vocabulary-adjacent,
// generic phrasing the user asked to replace. This is deterministic (no new
// LLM call) — it reads the ALREADY-COMPILED, now-genuinely-per-beat
// overlay_spec (graphicSpec.ts's compileGraphicSpec, fixed this same pass to
// stop collapsing every sibling beat onto one shared-claim spec) and
// describes the SPECIFIC content of THIS card, never a generic label.
const NUMBER_WORDS = ["", "One", "Two", "Three", "Four", "Five", "Six"];
function deriveGraphicSummary(overlaySpec, displaySubject) {
  if (!overlaySpec || typeof overlaySpec !== "object" || !overlaySpec.template) return null;
  const subject = displaySubject || "this topic";
  switch (overlaySpec.template) {
    case "BULLET_LIST": {
      const n = overlaySpec.items?.length ?? 0;
      if (!n) return null;
      if (n === 1) return `A key detail about ${subject} is shown on a clean visual card.`;
      return `${NUMBER_WORDS[Math.min(n, 6)]} key details about ${subject} are laid out on a clean visual checklist.`;
    }
    case "COMPARISON": return overlaySpec.leftLabel && overlaySpec.rightLabel ? `${overlaySpec.leftLabel} and ${overlaySpec.rightLabel} are compared side by side.` : null;
    case "BEFORE_AFTER": return overlaySpec.beforeLabel && overlaySpec.afterLabel ? `${subject} is shown before and after: ${overlaySpec.beforeLabel} versus ${overlaySpec.afterLabel}.` : null;
    case "TIMELINE": return `Key moments in ${subject} are laid out on a timeline.`;
    case "PROCESS": { const steps = overlaySpec.steps ?? []; return steps.length >= 2 ? `${steps[0].label} leads to ${steps[steps.length - 1].label} in a simple diagram.` : null; }
    case "CAUSE_EFFECT": return `A simple diagram explains what leads to what for ${subject}.`;
    case "SYMBOL_NEGATION": return overlaySpec.polarity === "affirmed"
      ? `A simple graphic confirms ${(overlaySpec.label || subject).toLowerCase()}.`
      : `A simple graphic marks ${(overlaySpec.label || subject).toLowerCase()} as unavailable.`;
    case "QUANTITY_RESOURCE": case "SIMPLE_STAT": case "RESOURCE_BAR": return `A key number about ${subject} is highlighted on screen.`;
    case "ANNOTATED_SUBJECT": return (overlaySpec.annotations?.length) ? `${subject} is labeled with its key details.` : null;
    default: return null; // TEXT_EMPHASIS and anything unrecognized: nothing distinct to summarize beyond the text itself
  }
}

export function deriveDisplaySummary(beat, plan) {
  const raw = stripRawEntityIds(String(beat?.informationToCommunicate ?? "").trim());
  if (raw && !INTERNAL_SHOT_PURPOSE_WRAPPER.test(raw)) return capToReadableLength(raw);
  const displaySubject = stripRawEntityIds(plan?.composition?.displaySubject ?? "");
  if (beat?.renderMethod === "PROGRAMMATIC_GRAPHIC" || plan?.render_strategy === "PROGRAMMATIC_GRAPHIC") {
    const graphicSummary = deriveGraphicSummary(plan?.overlay_spec, displaySubject);
    if (graphicSummary) return capToReadableLength(graphicSummary);
  }
  // A real, already-authored sentence describing what changes in THIS shot
  // (never the legacy hydration templates "Establish X."/"Change the visual
  // to..." — those are internal planning defaults, not a real description).
  const delta = stripRawEntityIds(String(beat?.visualDelta ?? "").trim());
  if (delta && delta.split(/\s+/).length >= 4 && !/^Establish\b/i.test(delta) && !/^Change the visual/i.test(delta)) return capToReadableLength(delta);
  return displaySubject ? `${displaySubject} appears in this scene.` : "Visual for this moment in the story.";
}

// One card per VisualBeat — real scene data where a (current, unreplaced)
// scene row exists, a deterministic placeholder otherwise. `scenesByBeatId`
// should already be resolved to the CURRENT (non-replaced) scene per beat.
export function buildSceneCards(visualBeats, entityRegistryById, scenesByBeatId, plansByBeatId, isPaused = false) {
  return (visualBeats ?? []).map((beat) => {
    const scene = scenesByBeatId.get(beat.id) ?? null;
    const plan = plansByBeatId.get(beat.id) ?? null;
    const status = deriveSceneCardStatus(scene, isPaused);
    const characterNames = [...(beat.primaryEntityIds ?? []), ...(beat.supportingEntityIds ?? [])]
      .map((id) => entityRegistryById.get(id))
      .filter((e) => e?.category === "CHARACTER")
      .map((e) => e.name);
    const locationName = beat.locationId ? entityRegistryById.get(beat.locationId)?.name ?? null : null;
    return {
      beatId: beat.id,
      sceneId: scene?.id ?? null,
      sequenceIndex: beat.sequenceIndex,
      chapterId: beat.chapterId,
      sequenceId: beat.sequenceId ?? null,
      narrativeFunction: beat.narrativeFunction ?? null,
      startSeconds: beat.estimatedStartSeconds,
      endSeconds: beat.estimatedEndSeconds,
      description: deriveDisplaySummary(beat, plan),
      strategyLabel: deriveStrategyLabel(beat.renderMethod),
      renderMethod: beat.renderMethod,
      characterNames,
      locationName,
      status,
      thumbnailUrl: resolveSceneDisplayUrl(scene),
      qaReasons: (scene?.qa_result?.reasons ?? []).map(customerVisualMessage),
      manualApproval: Boolean(scene?.manual_approval),
      overlayApplied: Boolean(scene?.overlay_applied),
      // Part 5 (2026-09-15 content-grounding pass): an EDIT whose own
      // perceptual-hash QA signal came back near-identical to its source —
      // "Regenerate" would just retry the same weak EDIT instruction again,
      // so the modal offers "Try as New Scene" (a real GENERATE) instead.
      weakEditDelta: Boolean(scene?.render_strategy === "EDIT" && scene?.qa_result?.visualDeltaSatisfied === false),
    };
  }).sort((a, b) => a.sequenceIndex - b.sequenceIndex)
    // 2026-09-22 "FINAL stabilization pass" §17 — real Atlantis finding: the
    // visible shot sequence read "01 02 03 05 06..." because internal
    // sequence_index 4 was absent after prior planning/version work.
    // sequence_index is an internal, immutable historical identifier and is
    // allowed to have gaps — but the user-facing shot NUMBER never should.
    // displayIndex is purely a 1-based position within this already-sorted,
    // currently-active card list — every "Shot NN" label in the UI must read
    // this field, never sequenceIndex directly.
    .map((card, i) => ({ ...card, displayIndex: i + 1 }));
}

// Groups already-sorted scene cards into their real sequenceId runs (real
// VisualBeat data — never an invented grouping). Sequences appear as
// contiguous runs in sequenceIndex order (chapters can interleave/revisit
// each other across the timeline, e.g. a "greenhouse" chapter's storyline
// resuming later after a cutaway — grouping by sequenceId keeps each
// visually-contiguous run together instead of scattering it by chapter).
// The very first group in the whole plan is the episode's actual opening —
// flagged isHook:true so the UI can give it the deliberate "this is the
// hook" treatment Part 5 asks for, purely a presentation decision, no
// beat/prompt data is touched.
export function groupScenesBySequence(cards) {
  const groups = [];
  let current = null;
  for (const card of cards) {
    const key = card.sequenceId ?? card.chapterId ?? "unsequenced";
    if (!current || current.key !== key) {
      current = { key, chapterId: card.chapterId, sequenceId: card.sequenceId, narrativeFunction: card.narrativeFunction, startSeconds: card.startSeconds, endSeconds: card.endSeconds, cards: [] };
      groups.push(current);
    }
    current.cards.push(card);
    current.endSeconds = card.endSeconds;
  }
  return groups.map((g, i) => ({ ...g, isHook: i === 0 }));
}

// Storyboard-wall grouping: keep chapter headers full width while allowing
// cards from adjacent short sequences to flow through one responsive grid.
// Chronology is preserved because cards are never reordered.
export function groupScenesForBoard(cards) {
  const groups = [];
  let current = null;
  for (const card of cards) {
    const key = card.chapterId ?? "unchaptered";
    if (!current || current.key !== key) {
      current = { key, chapterId: card.chapterId, sequenceIds: [], narrativeFunction: card.narrativeFunction, startSeconds: card.startSeconds, endSeconds: card.endSeconds, cards: [] };
      groups.push(current);
    }
    if (card.sequenceId && !current.sequenceIds.includes(card.sequenceId)) current.sequenceIds.push(card.sequenceId);
    current.cards.push(card);
    current.endSeconds = card.endSeconds;
  }
  return groups.map((group, index) => ({ ...group, sequenceId: group.sequenceIds.join(", "), isHook: index === 0 }));
}

// Chapter labels are derived only from the real chapterId string (e.g. "c3"
// -> "Chapter 3") — no invented titles. narrativeFunction (already authored
// by the Visual Director for this exact sequence) is the honest, non-
// invented source for a short descriptive subtitle.
export function deriveChapterLabel(chapterId) {
  const match = /^(?:c|ch)(\d+)$/i.exec(chapterId ?? "");
  return match ? `Chapter ${match[1]}` : (chapterId ? chapterId : "Chapter");
}

// Client-side only (Part 10 — "do not perform a backend query per filter").
// Operates on the already-loaded card list; "generating" folds in every
// active sub-state (queued/starting/generating/checking) since a user
// filtering for "what's currently working" doesn't care about that
// distinction, mirroring summarizeSceneProgress's own "active" bucket.
export const SCENE_FILTERS = ["all", "needs_review", "ready", "generating", "planned"];
export function filterSceneCards(cards, filter) {
  if (!filter || filter === "all") return cards;
  if (filter === "generating") return cards.filter((c) => ["queued", "starting", "compositing", "generating", "checking"].includes(c.status.key));
  return cards.filter((c) => c.status.key === filter);
}

// THE authoritative "has the user actually pressed the paid Generate
// Episode action" signal — a real, charged long_form_episode_generation_
// charges row, and nothing else. Extracted as its own tiny pure function
// (rather than left as an inline `Boolean(episodeCharge)` in JSX) so the
// exact rule — never scene rows, never progress.started — is independently
// testable and can never silently regress back to the "any scene row
// exists" bug this task fixes.
export function isEpisodeGenerationCommitted(episodeCharge) {
  return Boolean(episodeCharge);
}

// Mirrors the scene modal's own Approve-button gating exactly — pulled out
// so the rule (Needs Review only) is testable independent of React.
export function canManuallyApproveScene(statusKey) {
  return statusKey === "needs_review";
}

export function summarizeSceneProgress(cards) {
  const total = cards.length;
  const ready = cards.filter((c) => c.status.key === "ready").length;
  const needsReview = cards.filter((c) => c.status.key === "needs_review").length;
  const failed = cards.filter((c) => c.status.key === "failed").length;
  const active = cards.filter((c) => ["queued", "starting", "compositing", "generating", "checking"].includes(c.status.key)).length;
  const planned = cards.filter((c) => c.status.key === "planned").length;
  // "started" only means "some scene ROW exists" — a handful of controlled-
  // test scenes produces started:true here even though the user never
  // pressed the real paid Generate Episode action. This field is kept for
  // display purposes only (e.g. "6 of 115") — it must NEVER be used to
  // decide whether the episode-generation-committed/tier-lock state is
  // true. That decision has exactly one authoritative source: a real
  // long_form_episode_generation_charges row (see episodeGenerationCommitted
  // in GenerateWorkspace.jsx).
  return { total, ready, needsReview, failed, active, planned, started: total > planned };
}

// Part 14's exact 4-state progress header logic. Priority: something
// actively rendering right now is always the most time-sensitive thing to
// show; only once nothing is active do we ask "is there still unstarted
// work" (never claim "ready" while beats remain unplanned-for-real) vs "is
// everything attempted but some need a human decision" vs truly done.
export function deriveEpisodeProgressPhase(progress) {
  if (progress.active > 0) return "generating";
  if (progress.planned > 0) return "planned";
  if (progress.needsReview > 0 || progress.failed > 0) return "needs_review";
  return "ready";
}
export const EPISODE_PROGRESS_HEADING = {
  generating: "Generating your episode",
  planned: "Episode generation",
  needs_review: "Visuals need review",
  ready: "Episode visuals ready",
};

// 2026-09-19 "premium active-generation UI" pass (item 10 — "do NOT invent a
// parallel frontend state machine"). This is the ONE selector every piece of
// UI that needs to show generation progress reads from — the hero panel, the
// sidebar mini-status, the scene filter counts, and the activity feed all
// call this same function with the same sceneCards array (itself already
// built from real persisted long_form_scenes/long_form_scene_render_plans
// rows by buildSceneCards above). Nothing here is timer-driven or estimated;
// every field is a straight count over already-loaded, already-truthful
// per-card status.key values.
const ACTIVE_STATUS_KEYS = ["starting", "generating", "compositing", "checking"];
// User-facing "what Zyvo is doing" copy per render strategy — internal
// vocabulary (GENERATE/EDIT/REUSE/CROP/COMPOSITE/PROGRAMMATIC_GRAPHIC) never
// reaches this map's values, only its keys (deriveStrategyLabel's own output).
const ACTIVITY_LABEL_BY_STRATEGY = {
  "New scene": "Creating a new scene",
  Edit: "Updating an existing scene",
  Graphic: "Building an explainer graphic",
  Reuse: "Preparing existing visual",
  Crop: "Reframing visual",
};
export function activityLabelForCard(card) {
  if (card.status.key === "checking") return "Checking visual quality";
  return ACTIVITY_LABEL_BY_STRATEGY[card.strategyLabel] ?? "Working on this scene";
}

// `hasActiveRun` is the SAME authoritative signal as isEpisodeGenerationCommitted
// (a real charge row) — passed in rather than re-derived here so this module
// never needs to know about long_form_episode_generation_charges directly.
export function deriveEpisodeGenerationProgress(cards, { hasActiveRun = false, isPaused = false } = {}) {
  const total = cards.length;
  const ready = cards.filter((c) => c.status.key === "ready").length;
  const needsReview = cards.filter((c) => c.status.key === "needs_review").length;
  const failed = cards.filter((c) => c.status.key === "failed").length;
  const queued = cards.filter((c) => ["queued", "starting"].includes(c.status.key)).length;
  const generating = cards.filter((c) => ["generating", "compositing"].includes(c.status.key)).length;
  const checking = cards.filter((c) => c.status.key === "checking").length;
  const planned = cards.filter((c) => c.status.key === "planned").length;
  const processed = ready + needsReview + failed;
  const processedPct = total ? Math.floor((processed / total) * 100) : 0;

  // Phase priority mirrors the real production pipeline order: nothing
  // compiled yet -> compiling; compiled rows exist and some are actively
  // queued/rendering -> rendering; every render attempt finished and only QA
  // remains -> checking; nothing active left but something needs a human ->
  // needs_review; everything approved -> ready. `idle` only applies when the
  // caller passes hasActiveRun:false (kept for defensive callers; the
  // Generate page itself only reaches for this object once a run exists).
  let phase;
  if (!hasActiveRun) phase = "idle";
  else if (total === 0 || planned === total) phase = "compiling";
  else if (queued > 0 || generating > 0) phase = "rendering";
  else if (checking > 0) phase = "checking";
  else if (needsReview > 0 || failed > 0) phase = "needs_review";
  else if (total > 0 && ready === total) phase = "ready";
  else phase = "compiling";

  // 2026-09-21 emergency pause feature: a deliberate pause overrides
  // whatever the raw pipeline state would otherwise show (rendering/
  // checking/needs_review) — the ONE exception is "ready", since nothing is
  // left to pause once every visual is already approved.
  if (hasActiveRun && isPaused && phase !== "ready") phase = "paused";

  const currentActivities = cards
    .filter((c) => ACTIVE_STATUS_KEYS.includes(c.status.key))
    .sort((a, b) => a.sequenceIndex - b.sequenceIndex)
    .slice(0, 4)
    .map((c) => ({
      beatId: c.beatId,
      sequenceIndex: c.sequenceIndex,
      // §17: the displayed number is the contiguous UI position, never the
      // internal (possibly gapped) sequenceIndex. Falls back to
      // sequenceIndex only for a card that never went through
      // buildSceneCards (defensive — every real card carries displayIndex).
      shotLabel: `Shot ${String(c.displayIndex ?? c.sequenceIndex).padStart(2, "0")}`,
      activity: activityLabelForCard(c),
      strategyLabel: c.strategyLabel,
    }));

  // The very next beat still waiting its turn (lowest sequenceIndex among
  // queued cards not already surfaced above) — a cheap, honest "up next"
  // hint with no dependency-graph modeling required.
  const nextQueued = cards
    .filter((c) => c.status.key === "queued")
    .sort((a, b) => a.sequenceIndex - b.sequenceIndex)[0] ?? null;

  return {
    total, ready, needsReview, failed, queued, generating, checking, planned,
    processed, processedPct, remaining: total - processed, phase, currentActivities,
    nextQueuedShotLabel: nextQueued ? `Shot ${String(nextQueued.displayIndex ?? nextQueued.sequenceIndex).padStart(2, "0")}` : null,
  };
}

export const EPISODE_GENERATION_PHASE_COPY = {
  compiling: { title: "Preparing your episode", subcopy: (n) => `Zyvo is compiling the render plan for ${n} visuals.` },
  rendering: { title: "Creating your episode", subcopy: (n) => `Zyvo is rendering ${n} visuals using your Visual World.` },
  checking: { title: "Finishing quality checks", subcopy: () => "Every visual has rendered — Zyvo is running final quality checks." },
  needs_review: { title: "Some visuals need your review", subcopy: (n) => `Zyvo finished rendering all ${n} visuals — a few need a quick look.` },
  ready: { title: "Episode visuals ready", subcopy: (n) => `All ${n} visuals are approved and ready to edit into your episode.` },
  // 2026-09-21 emergency pause feature: a deliberate, user-initiated pause —
  // never styled as a failure/error state (no red/amber alarm treatment).
  paused: { title: "Generation paused", subcopy: () => "No new visuals will be generated until you continue." },
  idle: { title: "Episode generation", subcopy: () => "Generate the episode to begin rendering." },
};

// Chronological version chain for one shot, oldest first, built purely from
// the already-loaded scenes array's replaces_scene_id links — no extra
// fetch. The last entry is always the current (displayed) version.
export function buildSceneHistory(scenes, currentSceneId) {
  if (!currentSceneId) return [];
  const byId = new Map(scenes.map((s) => [s.id, s]));
  const chain = [];
  let cursor = byId.get(currentSceneId);
  const seen = new Set();
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    chain.unshift(cursor);
    cursor = cursor.replaces_scene_id ? byId.get(cursor.replaces_scene_id) : null;
  }
  return chain;
}

// Part 11's structural safety net. Two INDEPENDENT GENERATE/EDIT scenes
// (never REUSE/CROP/COMPOSITE, where sharing source pixels is the whole
// point) ending up with the identical result_url would mean a real
// dispatch/reconciliation bug attached one provider result to two scenes.
// Pure and cheap (string comparison only, no image bytes/hashing — this is
// the structural "same URL means same underlying job" check, not a
// perceptual-similarity detector) so it can run on every reconciliation
// tick with no added cost. Returns the id of the earlier conflicting scene,
// or null if candidateUrl is clean.
//
// candidateStrategy gates the check at BOTH ends, not just the sibling's:
// a REUSE scene checking its OWN url against the very GENERATE base it
// intentionally reuses from would otherwise register as a false-positive
// "conflict" (caught by this module's own test suite) — REUSE/CROP/
// COMPOSITE candidates are expected to share a source's pixels by design,
// so this returns null immediately for them without even looking at
// siblings, exactly mirroring the real caller's own precondition
// (advance-long-form-scene-generation only runs this check for scenes
// whose OWN render_strategy is GENERATE or EDIT).
export function findDuplicateResultUrl(currentScenes, candidateSceneId, candidateUrl, candidateStrategy) {
  if (!candidateUrl) return null;
  if (candidateStrategy && !["GENERATE", "EDIT"].includes(candidateStrategy)) return null;
  const conflict = currentScenes.find((s) =>
    s.id !== candidateSceneId &&
    ["GENERATE", "EDIT"].includes(s.render_strategy) &&
    s.result_url === candidateUrl
  );
  return conflict?.id ?? null;
}
