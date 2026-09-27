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
