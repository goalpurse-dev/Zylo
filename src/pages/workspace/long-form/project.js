// Client for the real Long Form Video Project — created the moment a user
// clicks "Create Story Plan" (see create-long-form-project). Everything
// before that point is disposable discovery-session state (discoverIdeas.js
// / discoverySession.js); everything from here on is keyed by a real
// project id, which becomes the canonical identity for the rest of the
// creation flow (/long-form/project/:id/...).
import { supabase } from "../../../lib/supabaseClient";
import { safeResult } from "./connectionState";
import { STICKMAN_RECIPE } from "./recipe";
import { smallCover } from "./projectCovers";

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
  onScreenTextDensity,
  initialStatus,
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
      onScreenTextDensity,
      initialStatus,
    },
  });
  if (error || !data?.id) return null;
  return data;
}

// 2026-10-03 "fixes round 3" pass, Section 3 — project card "⋯" menu ->
// Delete. Soft delete only (see delete-long-form-project's own comment);
// fetchUserLongFormProjects already filters deleted_at is null, so a
// successful call here is enough for the caller to optimistically drop the
// row from its own list state without a full refetch.
export async function deleteLongFormProject(projectId) {
  const { error } = await supabase.functions.invoke("delete-long-form-project", { body: { projectId } });
  return !error;
}

// The signed-in user's active Long Form holds (long_form_project_billing):
// project id -> { reserved, kept, refundIfDeleted, failedByUs }. "kept" is what
// already covers work done (charge for work done); a delete gives back the rest —
// or everything when the video failed because of us.
export async function fetchProjectBilling() {
  const { data, error } = await supabase.rpc("long_form_project_billing");
  if (error) return new Map();
  return new Map((data ?? []).map((r) => [r.project_id, { reserved: r.reserved, kept: r.kept, refundIfDeleted: r.refund_if_deleted, failedByUs: r.failed_by_us }]));
}

// The delete confirmation (pure).
export function deleteConfirmText(title, billing) {
  const tail = "This can't be undone from here.";
  if (!billing) return `Delete "${title}"? ${tail}`;
  if (billing.failedByUs || billing.kept <= 0) return `Delete "${title}"? You'll get back all ${billing.refundIfDeleted} credits. ${tail}`;
  return `Delete "${title}"? You'll get back ${billing.refundIfDeleted} unused credits. ${billing.kept} credits cover work already done. ${tail}`;
}

// "Used so far: X of Y credits" (null when there's no active hold).
export const usedSoFarText = (billing) => (billing ? `Used so far: ${billing.failedByUs ? 0 : billing.kept} of ${billing.reserved} credits` : null);

// Direct RLS-protected read — same pattern as fetchDiscoverySession.
export async function fetchLongFormProject(projectId) {
  if (!projectId) return null;
  const { data, error } = await supabase.from("long_form_projects").select("*").eq("id", projectId).maybeSingle();
  if (error || !data) return null;
  return data;
}

// Single-project resume state — same authoritative RPC the lobby's bulk
// fetch uses (long_form_project_resume_state), for pages that already have
// one project loaded and need to know its own truthful downstream state
// (Look/Visual World's "don't pretend downstream work hasn't happened"
// CTAs). Never a second/different resolver — this and the lobby's bulk
// variant call the exact same underlying SQL function.
export async function fetchLongFormResumeState(projectId) {
  if (!projectId) return null;
  const { data, error } = await supabase.rpc("long_form_project_resume_state", { p_project_id: projectId });
  if (error) return null;
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
  // 2026-10-03 "fixes round 3" pass, Section 1: a project must never appear
  // here until Generate's credit reservation actually succeeded
  // (create-long-form-production-setup flips status out of 'draft' at that
  // exact moment) — and never once soft-deleted (Section 3's "⋯" -> Delete).
  const { data: projects } = await supabase.from("long_form_projects").select("*").eq("user_id", userId).is("deleted_at", null).neq("status", "draft").order("updated_at", { ascending: false });
  if (!projects?.length) return [];

  const projectIds = projects.map((p) => p.id);
  const scriptIds = projects.map((p) => p.current_script_version_id).filter(Boolean);
  const researchIds = projects.map((p) => p.current_research_version_id).filter(Boolean);
  const visualPlanIds = projects.map((p) => p.current_visual_plan_version_id).filter(Boolean);
  const visualWorldIds = projects.map((p) => p.current_visual_world_version_id).filter(Boolean);
  const discoverySessionIds = [...new Set(projects.map((p) => p.discovery_session_id).filter(Boolean))];

  const [scriptsRes, researchRes, visualPlansRes, visualWorldsRes, activeResearchRes, activeScriptRes, activeVisualPlanRes, discoverySessionsRes, resumeStatesRes, sceneRenderPlansRes, generationProfilesRes] = await Promise.all([
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
    // The ONE authoritative resume resolver's backend half (Visual World /
    // Scene Generation tiers — see projectStage.js's deriveProjectStageInfo,
    // which checks this FIRST before falling back to its own Story/Idea
    // sub-stage logic). One bulk RPC, scoped to the caller's own projects
    // by construction (long_form_project_resume_state.sql).
    supabase.rpc("my_long_form_project_resume_states"),
    // Cover priority tier 1 (2026-10-03 "fixes round 3" pass, Section 3):
    // the first FINISHED scene image, if this project has gotten that far.
    // long_form_scenes has no project_id column of its own — scoped via its
    // scene_render_plan_id FK, so this is a real 2-step bulk lookup rather
    // than a single query, never per-project.
    supabase.from("long_form_scene_render_plans").select("id, project_id").in("project_id", projectIds),
    // Cover priority tier 3 (new Stickman flow, no scenes yet): the
    // project's own locked Visual Style, via the one RPC that can actually
    // read long_form_generation_profiles from the frontend (see that
    // table's own grant-revoked comment) — scoped to the caller by
    // construction, same pattern as my_long_form_project_resume_states above.
    supabase.rpc("my_long_form_generation_profiles"),
  ]);
  const scriptById = new Map((scriptsRes.data ?? []).map((s) => [s.id, s]));
  const researchById = new Map((researchRes.data ?? []).map((r) => [r.id, r]));
  const visualPlanById = new Map((visualPlansRes.data ?? []).map((v) => [v.id, v]));
  const activeResearchByProject = new Map((activeResearchRes.data ?? []).map((r) => [r.project_id, r]));
  const activeScriptByProject = new Map((activeScriptRes.data ?? []).map((s) => [s.project_id, s]));
  const activeVisualPlanByProject = new Map((activeVisualPlanRes.data ?? []).map((v) => [v.project_id, v]));
  const resumeStateByProject = new Map((resumeStatesRes.data ?? []).map((r) => [r.project_id, r.resume]));

  // Step 2 of the scene-thumbnail lookup: now that we know each project's
  // render plan id(s), find the earliest SUCCEEDED scene under any of them.
  // Grouped in JS (never per-project) since Postgres has no "first row per
  // group" via a plain .select() through PostgREST.
  const projectIdByRenderPlanId = new Map((sceneRenderPlansRes.data ?? []).map((rp) => [rp.id, rp.project_id]));
  const renderPlanIds = [...projectIdByRenderPlanId.keys()];
  const { data: succeededScenes } = renderPlanIds.length
    ? await supabase.from("long_form_scenes").select("scene_render_plan_id, final_result_url, result_url, created_at").in("scene_render_plan_id", renderPlanIds).eq("status", "succeeded").order("created_at", { ascending: true })
    : { data: [] };
  const finishedSceneUrlByProject = new Map();
  for (const scene of succeededScenes ?? []) {
    const url = scene.final_result_url ?? scene.result_url;
    const projectId = projectIdByRenderPlanId.get(scene.scene_render_plan_id);
    if (url && projectId && !finishedSceneUrlByProject.has(projectId)) finishedSceneUrlByProject.set(projectId, url);
  }

  // Cover priority tier 3: the new Stickman flow's own locked Visual Style —
  // only classic_flat_stickman exists today, so this is a 1-entry lookup for
  // now, but written against the real registry rather than hardcoded so a
  // future style needs no change here.
  const visualRecipeByProject = new Map((generationProfilesRes.data ?? []).map((p) => [p.project_id, p.visual_recipe]));

  // Idea id -> ready concept preview URL, across every discovery session's
  // visible list AND its uncapped batch archive (an idea can fall out of
  // the capped `ideas` list after enough "Generate 10 More" clicks, but the
  // archive never drops it) — only a genuinely finished (status: "ready")
  // preview with a real URL counts.
  const conceptPreviewByIdeaId = new Map();
  for (const session of discoverySessionsRes.data ?? []) {
    const allIdeas = [...(session.ideas ?? []), ...(session.idea_batches ?? []).flatMap((b) => b.ideas ?? [])];
    for (const idea of allIdeas) {
      // The chosen idea's own thumbnail (or its older concept preview).
      const url = idea?.thumbnail?.status === "ready" && idea.thumbnail.imageUrl ? idea.thumbnail.imageUrl
        : idea?.conceptPreview?.status === "ready" ? idea.conceptPreview.imageUrl : null;
      if (url) conceptPreviewByIdeaId.set(idea.id, smallCover(url));
    }
  }

  return projects.map((p) => {
    const conceptPreviewUrl = p.selected_idea_id ? conceptPreviewByIdeaId.get(p.selected_idea_id) ?? null : null;
    const finishedSceneUrl = finishedSceneUrlByProject.get(p.id) ?? null;
    const visualRecipe = visualRecipeByProject.get(p.id) ?? null;
    return {
      ...p,
      _script: p.current_script_version_id ? scriptById.get(p.current_script_version_id) ?? null : null,
      _research: p.current_research_version_id ? researchById.get(p.current_research_version_id) ?? null : null,
      _visualPlan: p.current_visual_plan_version_id ? visualPlanById.get(p.current_visual_plan_version_id) ?? null : null,
      _activeResearch: activeResearchByProject.get(p.id) ?? null,
      _activeScript: activeScriptByProject.get(p.id) ?? null,
      _activeVisualPlan: activeVisualPlanByProject.get(p.id) ?? null,
      _conceptPreviewUrl: conceptPreviewUrl,
      _resumeState: resumeStateByProject.get(p.id) ?? null,
      // 2026-10-03 "fixes round 3" pass, Section 3 — the card's real
      // thumbnail priority: a finished scene beats everything (it's this
      // exact video), a concept preview is still project-specific, and the
      // locked Visual Style is the cheapest real image better than a plain
      // icon. ProjectCard falls back to the clapperboard only when this is null.
      // Phase 5b: a rendered video's thumbnail (its first beat's image) beats everything.
      // V2 launch fixes: no style/niche art — the chosen idea's thumbnail, else a neutral title cover (null).
      _thumbnailUrl: p.final_thumbnail_url ?? finishedSceneUrl ?? conceptPreviewUrl ?? null,
      // Phase 6a: Stickman projects use the one Stickman stepper everywhere.
      _stickman: visualRecipe === STICKMAN_RECIPE,
    };
  });
}

export async function selectStoryTitle(projectId, title) {
  const { error } = await supabase.functions.invoke("update-long-form-project", { body: { projectId, selectedTitle: title } });
  return !error;
}

export async function saveStoryChapters(projectId, chapters) {
  const { error } = await supabase.functions.invoke("update-long-form-project", { body: { projectId, chapters } });
  return !error;
}

// Persists the selected Visual StylePreset (versioned id, e.g.
// "bold_cartoon_documentary:v1") on the project row — durable across
// refresh, leaving/reopening the project, Storyboard regeneration, and a
// ScriptVersion change. Never touches Script/Research/Visual Plan; style is
// not Script-specific. See stylePresets.js for the preset registry.
export async function saveVisualStylePreset(projectId, visualStylePreset) {
  const { error } = await supabase.functions.invoke("update-long-form-project", { body: { projectId, visualStylePreset } });
  return !error;
}
