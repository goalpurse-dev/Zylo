// Pure derivation of "where is this Project right now" for the lobby list
// and its resume routing — no DB calls in here, just logic over already-
// fetched rows, so it's directly unit-testable.
//
// Two independent signals, checked in priority order (active work always
// wins over a stale completed pointer from an earlier version):
//   1. ACTIVE work (_activeResearch/_activeScript/_activeVisualPlan) — a row
//      currently in status researching/drafting/planning. Invisible to the
//      current_*_version_id pointers, since those are only ever set once a
//      stage reaches a non-failure terminal state — see
//      fetchUserLongFormProjects for the 3 extra bulk queries that surface
//      this. Without this check, a project mid-Research would show its
//      LAST completed stage (e.g. "Story Plan Ready") while actually
//      researching, which is exactly the stale-lobby bug this fixes.
//   2. Otherwise, which current_*_version_id pointer is set, furthest along
//      wins — each pointer is only ever set on a non-failure terminal
//      state, so "which one is set" alone is a correct completed-stage
//      signal without needing to separately query live status.
const STAGE_LABELS = {
  visualPlan: "Look",
  script: "Story",
  research: "Story",
  storyPlan: "Story",
  draft: "Story",
};

const SCRIPT_STATUS_LABEL = { ready: "Script Ready", needs_research: "Needs Research", needs_attention: "Needs Attention", drafting: "Writing Script", failed: "Script Failed" };
const RESEARCH_STATUS_LABEL = { ready: "Research Ready", needs_attention: "Needs Attention", researching: "Researching", failed: "Research Failed" };
const VISUAL_PLAN_STATUS_LABEL = { ready: "Storyboard Ready", planning: "Planning Storyboard", failed: "Storyboard Failed" };

// Real incident this fixes (Mars, 2026-09-15): this resolver used to have a
// hard ceiling of "Look" — it never inspected Visual World or Scene
// Generation at all, so a project with a fully-built Visual World and an
// active, charged Scene Generation run still opened on Storyboard, which
// then claimed "Build Visual World →" as if none of that had happened.
// `resume` is `project._resumeState` — the ONE authoritative backend
// resolver (long_form_project_resume_state SQL function, fetched in bulk by
// fetchUserLongFormProjects for the lobby, or singly via
// fetchLongFormResumeState for an already-loaded project page) — computed
// from durable current-version pointers + real scene/charge data, never
// frontend memory. It is checked FIRST, before any of the Story/Idea sub-
// stage logic below (which remains correct for projects that genuinely
// haven't reached Visual World yet).
function stageInfoFromResumeState(resume) {
  if (!resume) return null;
  if (resume.route === "generate") {
    const processed = resume.ready + resume.needsReview + resume.failed;
    const pct = resume.totalBeats ? Math.floor((processed / resume.totalBeats) * 100) : 0;
    // Priority mirrors deriveEpisodeProgressPhase (sceneCardModel.js): needs
    // review/failed (needs a decision) > still generating (real progress %)
    // > all done. Never invented — every number is a real DB count.
    const statusLabel = resume.needsReview > 0 ? `${resume.needsReview} need review`
      : resume.failed > 0 ? `${resume.failed} need another try`
      : processed >= resume.totalBeats && resume.totalBeats > 0 ? `Scenes · ${resume.ready} / ${resume.totalBeats} ready`
      : `Generating · ${pct}%`;
    return { topLevel: "Scenes", statusLabel, route: "generate", active: false, resume };
  }
  if (resume.route === "visual-world") {
    return { topLevel: "Visual World", statusLabel: resume.visualWorldStatus === "ready" ? "Ready" : "Building", route: "visual-world", active: false, resume };
  }
  return null; // "look"/"none" — fall through to the existing pointer logic below, which already handles Storyboard/Story/Idea correctly.
}

// Phase 5b — the final video's own statuses (long_form_projects.status):
// images_ready -> rendering -> complete | failed. These outrank every earlier
// stage signal: once a render exists, the card is about the video.
const VIDEO_STATUS = {
  images_ready: { statusLabel: "Ready to render", active: false },
  rendering: { statusLabel: "Rendering", active: true },
  complete: { statusLabel: "Done", active: false },
  failed: { statusLabel: "Failed", active: false },
};
function stageInfoFromVideoStatus(project) {
  const v = VIDEO_STATUS[project?.status];
  if (!v) return null;
  return { topLevel: "Video", statusLabel: v.statusLabel, route: "generate", active: v.active, startedAt: v.active ? project.updated_at ?? null : undefined, reason: project.status === "failed" ? project.status_reason ?? null : null };
}

// Phase 6e — the Stickman flow is Idea · Scenes · Edit · Publish. After
// "Generate video" ONE generating screen runs everything with no stops
// (script -> voice -> scenes); Scenes (player + grid) is the first home.
// Derived from the project's server state only, identical on every page.
// `stage` says which part of the generating screen is live.
export function deriveStickmanStep(project) {
  const ap = project?.autopilot ?? null;
  if (["rendering", "complete"].includes(project?.status) || project?.final_video_path) {
    return { key: "edit", route: "edit", statusLabel: project?.status === "rendering" ? "Rendering" : "Done", active: project?.status === "rendering" };
  }
  if (ap?.phase === "scenes") {
    const sc = ap.scenes ?? {};
    if (sc.status === "failed") return { key: "scenes", route: "generating", stage: "scenes", statusLabel: "Needs a retry", active: false };
    if (sc.status === "running" && !sc.regenerating) return { key: "scenes", route: "generating", stage: "scenes", statusLabel: "Drawing scenes", active: true, startedAt: sc.startedAt };
    return { key: "scenes", route: "scenes", statusLabel: sc.regenerating && sc.status === "running" ? "Redrawing scenes" : "Scenes ready", active: false };
  }
  // Older projects whose scenes exist without a Scenes run record.
  if (project?.status === "images_ready" || project?.current_scene_generation_status || project?._hasScenes) {
    return { key: "scenes", route: "scenes", statusLabel: "Scenes ready", active: false };
  }
  if (ap?.phase === "narration") {
    if (ap.status === "running") return { key: "scenes", route: "generating", stage: "voice", statusLabel: "Recording voice", active: true, startedAt: ap.startedAt };
    if (ap.status === "failed" || ap.narration?.status === "failed") return { key: "scenes", route: "generating", stage: "voice", statusLabel: "Needs a retry", active: false };
    // A project from before 6e that stopped at the voice: its scenes still need drawing.
    return { key: "scenes", route: "generating", stage: "voice", needsStart: true, statusLabel: "Ready to draw scenes", active: false };
  }
  if (project?._narrationReady || project?._scriptLocked || project?._script?.locked_at) {
    return { key: "scenes", route: "generating", stage: "voice", needsStart: !!project?._narrationReady, statusLabel: project?._narrationReady ? "Ready to draw scenes" : "Recording voice", active: !project?._narrationReady };
  }
  if (ap) {
    if (ap.status === "running") return { key: "scenes", route: "generating", stage: "script", statusLabel: "Writing script", active: true, startedAt: ap.startedAt };
    if (ap.status === "failed") return { key: "scenes", route: "generating", stage: "script", statusLabel: "Needs a retry", active: false };
    return { key: "scenes", route: "generating", stage: "script", needsStart: true, statusLabel: "Script ready", active: false };
  }
  if (project?.current_script_version_id) return { key: "scenes", route: "generating", stage: "script", needsStart: true, statusLabel: "Script ready", active: false };
  return { key: "idea", route: "idea", statusLabel: "Idea", active: false };
}
const STICKMAN_TOP_LEVEL = { idea: "Idea", scenes: "Scenes", edit: "Edit", publish: "Publish" };

// The new flow's pages, by the step they belong to. Script review and
// "Listen & change" are panels of the Editor now (Script / Voiceover).
export const STICKMAN_PAGE_STEP = { idea: "idea", generating: "scenes", scenes: "scenes", edit: "edit", narration: "edit", "script-review": "edit", publish: "publish" };
// Legacy pages a Stickman project must never show (the old Story / Research /
// Script / Look / Visual World / Generate screens, the "proof screen", and the
// 6a-6c writing page — the generating screen replaced it).
export const LEGACY_STICKMAN_PAGES = ["story", "research", "script", "look", "visual-world", "generate", "visuals", "writing"];
export const STICKMAN_STEP_ORDER = ["idea", "scenes", "edit", "publish"];

export function stickmanRouteForStep(step) {
  return step.route;
}
// Scenes are all drawn (no first run still going) — Edit and Publish can open.
export function scenesFinished(project) {
  const ap = project?.autopilot;
  if (["rendering", "complete"].includes(project?.status) || project?.final_video_path) return true;
  if (ap?.phase === "scenes") return ap.scenes?.status === "done" || (ap.scenes?.status === "running" && !!ap.scenes?.regenerating);
  return !!project?._hasScenes;
}

// Where a request for `page` on this Stickman project should land (the route
// guard redirects when it differs). Legacy pages always go to the real step;
// Idea is always a read-only summary; the generating screen only while
// something is generating (or needs a retry / a start); Scenes, Edit (and its
// Script / Voiceover panels) and Publish once the scenes are drawn.
export function resolveStickmanPage(page, project) {
  const step = deriveStickmanStep(project);
  const home = stickmanRouteForStep(step);
  if (page === "idea") return "idea";
  if (!STICKMAN_PAGE_STEP[page]) return home;
  if (page === "generating") return step.route === "generating" ? "generating" : home;
  return scenesFinished(project) ? page : home;
}

// Which stepper steps can be opened (reached) — Back/Continue only ever move between these.
export function reachableStickmanSteps(project) {
  const step = deriveStickmanStep(project);
  const done = scenesFinished(project);
  return {
    idea: "idea",
    scenes: step.key === "idea" ? null : done ? "scenes" : "generating",
    edit: done ? "edit" : null,
    publish: done ? "publish" : null,
  };
}
export function formatElapsedMinutes(startedAt) {
  if (!startedAt) return null;
  const startMs = typeof startedAt === "string" ? new Date(startedAt).getTime() : startedAt;
  const minutes = Math.max(0, Math.round((Date.now() - startMs) / 60000));
  if (minutes < 1) return "just started";
  return `${minutes} min`;
}

// `project` is a long_form_projects row, decorated with `_script`/
// `_research`/`_visualPlan` (completed pointer targets) and
// `_activeResearch`/`_activeScript`/`_activeVisualPlan` (in-progress rows)
// — see fetchUserLongFormProjects.
export function deriveProjectStageInfo(project) {
  // Durable downstream progress (Visual World built / Scene Generation
  // started) always outranks everything below — a stray active-work row
  // from an earlier stage must never pull a project that has genuinely
  // moved past Look back to Look (Part 3: "the user must never be dumped
  // backward to Storyboard simply because generation is incomplete").
  // Phase 6a: Stickman projects never show the legacy Story/Look/Generate steps.
  if (project?._stickman) {
    const s = deriveStickmanStep(project);
    return { topLevel: STICKMAN_TOP_LEVEL[s.key], statusLabel: s.statusLabel, route: s.route, active: s.active, startedAt: s.startedAt, stickmanStep: s.key };
  }
  const fromVideo = stageInfoFromVideoStatus(project);
  if (fromVideo) return fromVideo;
  const fromResume = stageInfoFromResumeState(project._resumeState);
  if (fromResume) return fromResume;

  // Active work first, most-advanced-stage active row wins (a project can
  // only ever have one thing actively running at a time in practice, but
  // this ordering stays correct even if that ever changes).
  if (project._activeVisualPlan) {
    return { topLevel: STAGE_LABELS.visualPlan, statusLabel: "Planning Storyboard", route: "look", active: true, startedAt: project._activeVisualPlan.created_at };
  }
  if (project._activeScript) {
    return { topLevel: STAGE_LABELS.script, statusLabel: "Writing Script", route: "script", active: true, startedAt: project._activeScript.created_at };
  }
  if (project._activeResearch) {
    return { topLevel: STAGE_LABELS.research, statusLabel: "Researching", route: "research", active: true, startedAt: project._activeResearch.research_started_at };
  }

  if (project.current_visual_plan_version_id) {
    const status = project._visualPlan?.status;
    return { topLevel: STAGE_LABELS.visualPlan, statusLabel: VISUAL_PLAN_STATUS_LABEL[status] ?? "Storyboard Ready", route: "look", active: false };
  }
  if (project.current_script_version_id) {
    const status = project._script?.status;
    return { topLevel: STAGE_LABELS.script, statusLabel: SCRIPT_STATUS_LABEL[status] ?? "Script Ready", route: "script", active: false };
  }
  if (project.current_research_version_id) {
    const status = project._research?.status;
    return { topLevel: STAGE_LABELS.research, statusLabel: RESEARCH_STATUS_LABEL[status] ?? "Research Ready", route: "research", active: false };
  }
  if (project.current_story_plan_version_id) {
    return { topLevel: STAGE_LABELS.storyPlan, statusLabel: "Story Plan Ready", route: "research", active: false };
  }
  if (project.status === "planning_failed") {
    return { topLevel: STAGE_LABELS.draft, statusLabel: "Planning Failed", route: "story", active: false };
  }
  return { topLevel: STAGE_LABELS.draft, statusLabel: "Planning", route: "story", active: false };
}

// Where the top stepper's "Story" step navigates when clicked from a later
// stage (Look, Generate, ...) — the FURTHEST COMPLETED Story-family artifact
// (Story Plan / Research / Narration), for VIEWING what already exists.
// Deliberately NOT deriveProjectStageInfo above, which answers a different
// question ("where should I continue the workflow forward from") and would
// route a completed Story Plan straight into Research instead of showing
// the Story Plan itself. Uses only the project row's own current_*_version_id
// pointers — persisted artifacts, never frontend memory — so a direct URL
// load or a hard refresh resolves identically to a live session.
export function resolveStoryStepRoute(project) {
  if (project?.current_script_version_id) return "script";
  if (project?.current_research_version_id) return "research";
  if (project?.current_story_plan_version_id) return "story";
  return null;
}

// 2026-09-19 "fix backward navigation" pass (item 1): the top stepper's
// "Look" step gets the exact same treatment resolveStoryStepRoute already
// gives "Story" — clickable once a completed artifact actually exists to
// view, using only the project row's own durable pointer, never frontend
// memory. A completed VisualPlan (current_visual_plan_version_id set) is
// the one artifact "Look" represents; safe to open read/edit at any later
// stage since opening it is a plain navigation, never a rebuild trigger.
export function resolveLookStepRoute(project) {
  return project?.current_visual_plan_version_id ? "look" : null;
}

// 2026-10-03 "fixes round 3" pass, Section 3 — every project card shows one
// of exactly these 7 human statuses, never the granular internal
// topLevel/statusLabel pair (which leaked things like "Story · Script
// Ready" and "Scenes · 111 need review" straight into the UI). Takes the
// SAME stage object deriveProjectStageInfo already returns — including its
// `resume` payload, when present, for real counts — so this is a pure
// relabeling pass, never a second stage-derivation.
export function humanizeProjectStatus(stage) {
  const { topLevel, statusLabel, resume } = stage;

  if (topLevel === "Video") return statusLabel;
  if (stage.stickmanStep) return statusLabel;
  if (topLevel === "Scenes") {
    if (resume?.needsReview > 0) return `Needs your review · ${resume.needsReview} scene${resume.needsReview === 1 ? "" : "s"}`;
    if (resume?.failed > 0) return `Needs your review · ${resume.failed} scene${resume.failed === 1 ? "" : "s"}`;
    if (resume?.totalBeats > 0 && resume.ready >= resume.totalBeats) return "Done";
    return "Rendering";
  }
  if (topLevel === "Visual World") {
    return statusLabel === "Ready" ? "Ready to review" : "Generating visuals";
  }
  if (topLevel === "Look") {
    if (statusLabel === "Storyboard Ready") return "Ready to review";
    if (statusLabel === "Storyboard Failed") return "Failed";
    return "Generating visuals";
  }
  if (topLevel === "Story") {
    if (statusLabel === "Script Ready") return "Ready to review";
    if (statusLabel === "Script Failed" || statusLabel === "Research Failed" || statusLabel === "Planning Failed") return "Failed";
    return "Writing script";
  }
  return "Writing script";
}

export function formatProjectDuration(project) {
  const minutes = project.resolved_length_minutes ?? project.custom_length_minutes;
  return minutes ? `${minutes} min` : null;
}
