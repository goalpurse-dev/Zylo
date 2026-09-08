// Client for the real Long Form Video Project — created the moment a user
// clicks "Create Story Plan" (see create-long-form-project). Everything
// before that point is disposable discovery-session state (discoverIdeas.js
// / discoverySession.js); everything from here on is keyed by a real
// project id, which becomes the canonical identity for the rest of the
// creation flow (/long-form/project/:id/...).
import { supabase } from "../../../lib/supabaseClient";
import { safeResult } from "./connectionState";

// Same query as fetchLongFormProject below, but distinguishes "project
// genuinely doesn't exist" from "we couldn't tell" (network/auth/timeout) —
// see connectionState.js. A generation-polling bootstrap must use this: the
// plain version's bare `null` on ANY error is what could make a client
// network hiccup look like "Project not found" instead of a transient
// connection issue.
export async function fetchLongFormProjectSafe(projectId) {
  if (!projectId) return { ok: true, data: null };
  const { data, error } = await supabase.from("long_form_projects").select("*").eq("id", projectId).maybeSingle();
  return safeResult(data, error);
}

export async function createLongFormProject({
  discoverySessionId,
  topic,
  source,
  selectedIdea,
  lengthMode,
  customLengthMinutes,
  depthMode,
  customExplanationDepth,
}) {
  const { data, error } = await supabase.functions.invoke("create-long-form-project", {
    body: {
      discoverySessionId,
      topic,
      source,
      selectedIdeaId: selectedIdea?.id ?? null,
      selectedIdeaTitle: selectedIdea?.title ?? null,
      selectedIdeaAngle: selectedIdea?.angle ?? null,
      narrativeArchetypeHint: selectedIdea?.narrativeArchetype ?? null,
      lengthMode,
      customLengthMinutes,
      depthMode,
      customExplanationDepth,
    },
  });
  if (error || !data?.id) return null;
  return data;
}

// Direct RLS-protected read — same pattern as fetchDiscoverySession.
export async function fetchLongFormProject(projectId) {
  if (!projectId) return null;
  const { data, error } = await supabase.from("long_form_projects").select("*").eq("id", projectId).maybeSingle();
  if (error || !data) return null;
  return data;
}

export async function fetchCurrentStoryPlan(project) {
  if (!project?.current_story_plan_version_id) return null;
  const { data, error } = await supabase
    .from("long_form_story_plan_versions")
    .select("id, version, story_plan, created_at")
    .eq("id", project.current_story_plan_version_id)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

// Runs both AI passes (Topic Understanding, then Narrative Strategy + Story
// Plan) server-side. Idempotent when regenerate is false — a project that
// already has a plan just gets that plan back instead of generating again,
// which is what makes it safe to call unconditionally on every Story page
// mount rather than tracking "did I already trigger this" client-side.
export async function generateStoryPlan(projectId, { regenerate = false } = {}) {
  const { data, error } = await supabase.functions.invoke("generate-long-form-story-plan", {
    body: { projectId, regenerate },
  });
  if (error) {
    const context = error.context;
    let payload = null;
    try {
      payload = context && typeof context.json === "function" ? await context.json() : null;
    } catch {
      payload = null;
    }
    return { ok: false, status: context?.status ?? 500, code: payload?.code ?? null, message: payload?.error ?? "We couldn't create the Story Plan." };
  }
  return { ok: true, project: data.project, storyPlan: data.storyPlan };
}

// The Long Form lobby's "Your Long Form Videos" list — every project the
// user has ever committed to (created the moment "Create Story Plan" is
// clicked, see create-long-form-project), regardless of how far it got.
// Decorates each project with its current script/research/visual-plan
// version's live status via 3 bulk `.in()` queries (never one query per
// project) so deriveProjectStageInfo (projectStage.js) can label and route
// each card accurately without an N+1 query per row.
export async function fetchUserLongFormProjects(userId) {
  if (!userId) return [];
  const { data: projects } = await supabase.from("long_form_projects").select("*").eq("user_id", userId).order("updated_at", { ascending: false });
  if (!projects?.length) return [];

  const projectIds = projects.map((p) => p.id);
  const scriptIds = projects.map((p) => p.current_script_version_id).filter(Boolean);
  const researchIds = projects.map((p) => p.current_research_version_id).filter(Boolean);
  const visualPlanIds = projects.map((p) => p.current_visual_plan_version_id).filter(Boolean);
  const visualWorldIds = projects.map((p) => p.current_visual_world_version_id).filter(Boolean);
  const discoverySessionIds = [...new Set(projects.map((p) => p.discovery_session_id).filter(Boolean))];

  const [scriptsRes, researchRes, visualPlansRes, visualWorldsRes, activeResearchRes, activeScriptRes, activeVisualPlanRes, discoverySessionsRes] = await Promise.all([
    scriptIds.length ? supabase.from("long_form_script_versions").select("id, status").in("id", scriptIds) : Promise.resolve({ data: [] }),
    researchIds.length ? supabase.from("long_form_research_versions").select("id, status").in("id", researchIds) : Promise.resolve({ data: [] }),
    visualPlanIds.length ? supabase.from("long_form_visual_plan_versions").select("id, status, storyboard_summary").in("id", visualPlanIds) : Promise.resolve({ data: [] }),
    // Cover priority tier 3 (Visual World board preview) — see below.
    visualWorldIds.length ? supabase.from("long_form_visual_world_versions").select("id, reference_board_meta").in("id", visualWorldIds) : Promise.resolve({ data: [] }),
    // Active work is invisible to the current_*_version_id pointers above —
    // those are ONLY ever set once a stage reaches a non-failure terminal
    // state (see each stage's own stageFinalizing), so a project mid-run
    // has none of them set yet. These 3 extra bulk queries (never per-
    // project — the partial "one active per project" unique index on each
    // table guarantees at most one row per project_id here) are what let
    // the lobby show "Researching…" instead of stale "Story Plan Ready".
    supabase.from("long_form_research_versions").select("id, project_id, stage, research_started_at").in("project_id", projectIds).eq("status", "researching"),
    supabase.from("long_form_script_versions").select("id, project_id, stage, created_at").in("project_id", projectIds).eq("status", "drafting"),
    supabase.from("long_form_visual_plan_versions").select("id, project_id, stage, created_at").in("project_id", projectIds).eq("status", "planning"),
    // For the lobby card cover: a project has no final thumbnail/scene/
    // Visual World board/storyboard preview yet at this stage of the
    // product, so the cheapest real improvement over the generic
    // placeholder is the concept-preview image the user already saw and
    // picked in Discover Ideas — it lives on the discovery session's
    // `ideas` (capped visible list) or `idea_batches` (uncapped archive,
    // see the 20260913120000 migration) JSONB, never on the project row
    // itself. One bulk query, never per-project.
    discoverySessionIds.length ? supabase.from("long_form_discovery_sessions").select("id, ideas, idea_batches").in("id", discoverySessionIds) : Promise.resolve({ data: [] }),
  ]);
  const scriptById = new Map((scriptsRes.data ?? []).map((s) => [s.id, s]));
  const researchById = new Map((researchRes.data ?? []).map((r) => [r.id, r]));
  const visualPlanById = new Map((visualPlansRes.data ?? []).map((v) => [v.id, v]));
  const activeResearchByProject = new Map((activeResearchRes.data ?? []).map((r) => [r.project_id, r]));
  const activeScriptByProject = new Map((activeScriptRes.data ?? []).map((s) => [s.project_id, s]));
  const activeVisualPlanByProject = new Map((activeVisualPlanRes.data ?? []).map((v) => [v.project_id, v]));

  // Idea id -> ready concept preview URL, across every discovery session's
  // visible list AND its uncapped batch archive (an idea can fall out of
  // the capped `ideas` list after enough "Generate 10 More" clicks, but the
  // archive never drops it) — only a genuinely finished (status: "ready")
  // preview with a real URL counts.
  const conceptPreviewByIdeaId = new Map();
  for (const session of discoverySessionsRes.data ?? []) {
    const allIdeas = [...(session.ideas ?? []), ...(session.idea_batches ?? []).flatMap((b) => b.ideas ?? [])];
    for (const idea of allIdeas) {
      if (idea?.conceptPreview?.status === "ready" && idea.conceptPreview.imageUrl) {
        conceptPreviewByIdeaId.set(idea.id, idea.conceptPreview.imageUrl);
      }
    }
  }

  return projects.map((p) => ({
    ...p,
    _script: p.current_script_version_id ? scriptById.get(p.current_script_version_id) ?? null : null,
    _research: p.current_research_version_id ? researchById.get(p.current_research_version_id) ?? null : null,
    _visualPlan: p.current_visual_plan_version_id ? visualPlanById.get(p.current_visual_plan_version_id) ?? null : null,
    _activeResearch: activeResearchByProject.get(p.id) ?? null,
    _activeScript: activeScriptByProject.get(p.id) ?? null,
    _activeVisualPlan: activeVisualPlanByProject.get(p.id) ?? null,
    _conceptPreviewUrl: p.selected_idea_id ? conceptPreviewByIdeaId.get(p.selected_idea_id) ?? null : null,
  }));
}

export async function selectStoryTitle(projectId, title) {
  const { error } = await supabase.functions.invoke("update-long-form-project", { body: { projectId, selectedTitle: title } });
  return !error;
}

export async function saveStoryChapters(projectId, chapters) {
  const { error } = await supabase.functions.invoke("update-long-form-project", { body: { projectId, chapters } });
  return !error;
}
