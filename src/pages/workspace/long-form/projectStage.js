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

export function formatProjectDuration(project) {
  const minutes = project.resolved_length_minutes ?? project.custom_length_minutes;
  return minutes ? `${minutes} min` : null;
}
