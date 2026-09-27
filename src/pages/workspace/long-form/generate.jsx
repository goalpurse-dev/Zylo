import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../../lib/supabaseClient";
import { referenceEntities } from "./visualWorldPlanning";
import { fetchScenePlansAndScenes, fetchEpisodeCharge, saveSceneGenerationTier, chargeAndStartEpisodeGeneration, retryScene, editScene, approveSceneManually, escalateSceneToGenerate, rebuildEpisodeGeneration, pauseEpisodeGeneration, continueEpisodeGeneration, advanceChapterGate, repairStoryboard, disableSceneOverlay, generateTestSample } from "./generateWorkspaceApi";
import { fetchLongFormResumeState } from "./project";
import { DEFAULT_SCENE_GENERATION_TIER } from "./scenePricing";
import GenerateWorkspace from "./GenerateWorkspace";

export default function LongFormGenerate() {
  const { id } = useParams();
  return <ProjectGenerate key={id} projectId={id} />;
}

function ProjectGenerate({ projectId }) {
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    document.title = "Generate | Zyvo";
    let cancelled = false;
    let timer;
    async function refresh() {
      let delay = 4000;
      try {
        const { data: project, error: projectError } = await supabase.from("long_form_projects").select("*").eq("id", projectId).maybeSingle();
        if (projectError) throw projectError;
        if (!project) { if (!cancelled) setSnapshot({ missing: true }); return; }
        if (!project.current_visual_world_version_id || !project.current_visual_plan_version_id) { if (!cancelled) setSnapshot({ needsVisualWorld: true, project }); return; }
        const { data: plan, error: planError } = await supabase.from("long_form_visual_plan_versions").select("*").eq("id", project.current_visual_plan_version_id).maybeSingle();
        if (planError) throw planError;
        const { data: world, error: worldError } = await supabase.from("long_form_visual_world_versions").select("*").eq("id", project.current_visual_world_version_id).maybeSingle();
        if (worldError) throw worldError;
        if (!world || world.status !== "ready") { if (!cancelled) setSnapshot({ needsVisualWorld: true, project }); return; }
        const { data: assets, error: assetsError } = await supabase.from("long_form_reference_assets").select("*").eq("visual_world_version_id", world.id);
        if (assetsError) throw assetsError;
        // 2026-09-19 forensic fix (real Mars incident, Part 2/3/5): the
        // SAME authoritative resolver every other Long Form entry point
        // already uses — route !== "generate" means the current plan+world
        // pairing hasn't actually had scenes compiled for it (a replan was
        // adopted, or the Visual World needs new references) even though an
        // OLDER charge/scene history might still exist for a superseded
        // plan. This is what lets the page show a truthful blocked state
        // instead of a silent 0%/136 Planned with no explanation.
        const resumeState = await fetchLongFormResumeState(projectId);
        const charge = await fetchEpisodeCharge(project);
        const { plans, scenes } = await fetchScenePlansAndScenes(world.id, charge?.id ?? null);
        if (cancelled) return;
        setSnapshot({ project, plan, world, assets: assets ?? [], plans, scenes, charge, resumeState });
        setError(null);
        setActionError(null);
        delay = scenes.some((s) => ["pending", "running"].includes(s.status)) ? 4000 : 15000;
      } catch {
        if (cancelled) return;
        setError("Connection interrupted. Reconnecting…");
        delay = 5000;
      }
      if (!cancelled) timer = setTimeout(refresh, delay);
    }
    refresh();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [projectId, revision]);

  const setTier = async (tier) => {
    setSnapshot((s) => (s?.project ? { ...s, project: { ...s.project, scene_generation_tier: tier } } : s));
    try { await saveSceneGenerationTier(projectId, tier); } catch { setRevision((n) => n + 1); }
  };

  const generateEpisode = async (tier, chapterGate = false) => {
    if (busy) return { ok: false };
    setBusy(true);
    setActionError(null);
    try {
      const result = await chargeAndStartEpisodeGeneration(projectId, tier, chapterGate);
      if (!result.ok) { setActionError(result.message); return result; }
      setRevision((n) => n + 1);
      return result;
    } finally { setBusy(false); }
  };

  // Part 12/13: closes the modal / switches to the new run's data ONLY on a
  // real success — a failed setup (insufficient credits, a stale quote, a
  // network error) leaves the OLD run's snapshot fully intact, since
  // `revision` only bumps (triggering a re-fetch that will now read the NEW
  // active_generation_charge_id) once the server confirms the new run
  // actually exists.
  const rebuildEpisode = async (tier, expectedActiveGenerationRunId) => {
    if (busy) return { ok: false };
    setBusy(true);
    setActionError(null);
    try {
      const result = await rebuildEpisodeGeneration(projectId, tier, expectedActiveGenerationRunId);
      if (!result.ok) { setActionError(result.message); return result; }
      setRevision((n) => n + 1);
      return result;
    } finally { setBusy(false); }
  };

  const perform = async (action) => {
    setBusy(true);
    setActionError(null);
    try {
      const result = await action();
      if (!result.ok) setActionError(result.message);
      setRevision((n) => n + 1);
      return result;
    } finally { setBusy(false); }
  };

  if (snapshot?.missing) return <div className="mx-auto max-w-xl px-5 py-20 text-center text-white"><p>Project not found.</p></div>;
  if (snapshot?.needsVisualWorld) return <div className="mx-auto max-w-xl px-5 py-20 text-center text-white"><p>Your Visual World needs to be ready before you can generate scenes.</p><button onClick={() => navigate(`/long-form/project/${projectId}/visual-world`)} className="mt-4 text-sm text-lime-300">Back to Visual World</button></div>;

  return <GenerateWorkspace
    project={snapshot?.project}
    visualPlanRow={snapshot?.plan}
    visualWorld={snapshot?.world}
    entities={referenceEntities(snapshot?.plan, snapshot?.world)}
    assets={snapshot?.assets ?? []}
    plans={snapshot?.plans ?? []}
    scenes={snapshot?.scenes ?? []}
    episodeCharge={snapshot?.charge ?? null}
    resumeState={snapshot?.resumeState ?? null}
    loading={!snapshot}
    busy={busy}
    error={actionError ?? error}
    onTierChange={setTier}
    onGenerateEpisode={generateEpisode}
    onRebuildEpisode={rebuildEpisode}
    // 2026-09-23 "systemic production stabilization" pass, Item E — "Generate
    // Test Sample." Charges/authorizes/dispatches ONLY the server-selected
    // 1-3 representative beats; Chapter 1 and the full episode remain
    // completely unauthorized. Uses the SAME `perform` helper as every other
    // scene-level action (busy/actionError/revision-bump all unchanged).
    onGenerateTestSample={() => perform(() => generateTestSample(projectId, snapshot?.project?.scene_generation_tier))}
    onRetryScene={(sceneId) => perform(() => retryScene(sceneId))}
    onEditScene={(sceneId, instruction) => perform(() => editScene(sceneId, instruction))}
    onEscalateScene={(sceneId) => perform(() => escalateSceneToGenerate(sceneId))}
    onApproveSceneAnyway={(sceneId) => perform(() => approveSceneManually(sceneId))}
    onDisableSceneOverlay={(sceneId) => perform(() => disableSceneOverlay(sceneId))}
    onPauseGeneration={() => perform(() => pauseEpisodeGeneration(projectId))}
    onContinueGeneration={() => perform(() => continueEpisodeGeneration(projectId))}
    onAdvanceChapterGate={() => perform(() => advanceChapterGate(projectId))}
    onBackToVisualWorld={() => navigate(`/long-form/project/${projectId}/visual-world`)}
    // 2026-09-22 structured readiness routing fix: a storyboard/scene-plan
    // issue must route to the storyboard (Look) stage, never Visual World —
    // affectedBeatIds rides in navigation state so the storyboard page can
    // scroll to and highlight the exact conflicting shots.
    onGoToStoryboard={(affectedBeatIds) => navigate(`/long-form/project/${projectId}/look`, { state: { focusBeatIds: affectedBeatIds ?? [] } })}
    // 2026-09-22 "Fix Storyboard" one-click targeted repair — runs in place,
    // never navigates away. `perform` already bumps `revision` on completion
    // so a successful repair's new (adopted) VisualPlan version is picked up
    // by the next poll automatically.
    onFixStoryboard={() => perform(() => repairStoryboard(projectId, false))}
  />;
}
