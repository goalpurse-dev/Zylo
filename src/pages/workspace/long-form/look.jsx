import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../../lib/supabaseClient";
import { fetchLongFormProject, fetchLongFormResumeState, saveVisualStylePreset } from "./project";
import { fetchLatestVisualPlanForScript, fetchLastCompletedVisualPlan, startVisualPlan, resumeVisualPlan, saveStoryboardEdits, adoptVisualPlanVersion } from "./visualPlan";
import { LongFormCreationHeader } from "./shared";
import GenerationExperience from "./GenerationExperience";
import StoryboardWorkspace from "./StoryboardWorkspace";
import { generationState } from "./storyboardModel";
import { assessVisualWorldCompatibility } from "./visualWorldCompatibility";

const STAGES = ["planning", "finalizing"];
const LABELS = { planning: "Interpreting your narration into visual beats", finalizing: "Building your storyboard" };
export function VisualPlanProgress({ row, error, onRetry }) {
  const state = generationState(row);
  return <GenerationExperience variant="visualPlan" heading={state === "creating" ? "Creating your Visual Plan…" : "Directing your visuals…"}
    microCopy={state === "creating" ? "Saving your storyboard request…" : state === "starting" ? "Starting visual director…" : row?.stage === "finalizing" ? "Organizing your rough storyboard." : "Narration is long and detailed — this reads it chapter by chapter, so real progress can take several minutes with no visible jump."}
    pending={state === "creating" || state === "starting"} stageOrder={STAGES} stageLabels={LABELS} currentStageKey={row?.stage ?? "planning"}
    startedAt={row?.workflow_started_at ?? row?.stage_started_at} stageStartedAt={row?.stage_started_at} workerLockUntil={row?.worker_lock_until}
    isComplete={row?.status === "ready"} failed={state === "failed"} failedHeading="Your storyboard hit a snag."
    failedSubcopy="Your progress is saved — resuming continues from exactly where it left off, at no extra cost." retryLabel="Resume Storyboard"
    onRetry={onRetry} connectionStatus={error ? "syncing" : null} />;
}
export default function LongFormLook() {
  const { id } = useParams();
  return <LookProject key={id} projectId={id} />;
}
function LookProject({ projectId }) {
  const navigate = useNavigate();
  // 2026-09-22 structured readiness routing fix — a Generate-page storyboard
  // issue routes here with the exact conflicting beat ids in navigation
  // state, so StoryboardWorkspace can scroll to and highlight them instead
  // of dropping the user on an unfocused 175-shot list.
  const location = useLocation();
  const focusBeatIds = location.state?.focusBeatIds ?? [];
  const [row, setRow] = useState(null);
  const [script, setScript] = useState(null);
  const [project, setProject] = useState(null);
  const [resumeState, setResumeState] = useState(null);
  const [phase, setPhase] = useState("loading");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  // Item 3 of the 2026-09-19 "fix the missing production workflow" pass:
  // populated only when the latest plan for the current script is READY but
  // hasn't been adopted yet (see adopt_visual_plan_version) — a genuine
  // explicit replan of an already-established project awaiting review, never
  // set for a project's first-ever plan (nothing to compare against, no
  // review needed, matches the backend's own auto-promote-on-first-plan
  // exception).
  const [replanReview, setReplanReview] = useState(null);
  const action = useRef(false);
  const currentScript = useRef(null);
  useEffect(() => {
    document.title = "Look | Zyvo";
    let cancelled = false, timer, failures = 0, sawActive = false;
    async function load() {
      try {
        const project = await fetchLongFormProject(projectId);
        if (cancelled) return;
        if (!project) { setPhase("notfound"); return; }
        setProject(project);
        // Part 4: this page must never claim downstream work hasn't
        // happened — the SAME authoritative resolver the lobby uses (not a
        // second, page-local notion of "is Visual World built").
        fetchLongFormResumeState(projectId).then((r) => { if (!cancelled) setResumeState(r); });
        currentScript.current = project.current_script_version_id;
        if (!currentScript.current) { setPhase("needs-script"); return; }
        const { data: scriptRow, error: scriptError } = await supabase.from("long_form_script_versions").select("status,script_document").eq("id", currentScript.current).single();
        if (scriptError) throw scriptError;
        let version = await fetchLatestVisualPlanForScript(projectId, currentScript.current);
        if (cancelled) return;
        if (!version) {
          const previous = await fetchLastCompletedVisualPlan(project);
          if (cancelled) return;
          if (previous?.status === "ready") {
            const { data, error } = await supabase.from("long_form_script_versions").select("script_document").eq("id",previous.script_version_id).single();
            if (error) throw error;
            if (cancelled) return;
            setRow(previous); setScript(data.script_document); setPhase("stale"); return;
          }
          if (scriptRow.status !== "ready") { setPhase("needs-script"); return; }
          setPhase("generating");
          const result = await startVisualPlan(projectId);
          if (!result.ok) throw new Error(result.message);
          version = result.visualPlan;
        }
        if (cancelled) return;
        setRow(version); setScript(scriptRow.script_document); setError(""); failures = 0;
        // Item 2/3/8: a ready plan with a parent that ISN'T yet the
        // project's active plan is exactly an unreviewed replan — the
        // backend (start_visual_plan_version / advance-long-form-visual-
        // plan) intentionally holds it here rather than auto-promoting it.
        // Fetch the OLD (still-active) plan for an old-vs-new summary and
        // check Visual World compatibility against it — both zero-cost,
        // read-only lookups, never a rebuild trigger of their own.
        const isPendingReplan = version.status === "ready" && version.parent_visual_plan_version_id && version.id !== project.current_visual_plan_version_id;
        if (isPendingReplan) {
          const previousPlan = await fetchLastCompletedVisualPlan(project);
          let currentWorldEntities = [];
          if (project.current_visual_world_version_id) {
            const { data: world } = await supabase.from("long_form_visual_world_versions").select("reference_plan").eq("id", project.current_visual_world_version_id).maybeSingle();
            currentWorldEntities = world?.reference_plan?.entities ?? [];
          }
          const compatibility = assessVisualWorldCompatibility(version.entity_registry, currentWorldEntities, version.continuity_groups);
          if (!cancelled) setReplanReview({ previousPlan, compatibility });
        } else if (!cancelled) {
          setReplanReview(null);
        }
        if (version.status === "ready" && sawActive) {
          setPhase("completing");
          timer = setTimeout(() => { if (!cancelled) setPhase("ready"); }, 350);
          return;
        }
        setPhase(version.status === "ready" ? "ready" : "generating");
        sawActive = version.status === "planning";
        if (version.status === "planning") timer = setTimeout(load, 2000);
      } catch (e) {
        if (cancelled) return;
        setError(e.message || "Reconnecting to your storyboard…");
        timer = setTimeout(load, Math.min(30000, 2000 * 2 ** failures++));
      }
    }
    load();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [projectId, revision]);
  async function regenerate() {
    if (action.current) return;
    action.current = true; setBusy(true); setError("");
    try {
      const result = await startVisualPlan(projectId, { regenerate: true });
      if (!result.ok) throw new Error(result.message);
      setRow(result.visualPlan); setPhase("generating"); setRevision(v => v + 1);
    } catch (e) { setError(e.message); }
    finally { action.current = false; setBusy(false); }
  }
  // 2026-09-21 emergency reliability fix: the FAILED-state "Resume
  // Storyboard" action — resumes the SAME row at the stage it failed at
  // (resume-long-form-visual-plan), never a new version, never a replanned
  // chapter that already succeeded. Distinct from `regenerate` above, which
  // is the deliberate creative replan action on an already-READY plan.
  async function resume() {
    if (action.current || !row?.id) return;
    action.current = true; setBusy(true); setError("");
    try {
      const result = await resumeVisualPlan(row.id);
      if (!result.ok) throw new Error(result.message);
      setRow(result.visualPlan); setPhase("generating"); setRevision(v => v + 1);
    } catch (e) { setError(e.message); }
    finally { action.current = false; setBusy(false); }
  }
  async function save(patches) {
    const saved = await saveStoryboardEdits(row.id, patches);
    setRow(saved);
  }
  // Item 3: the one explicit "Use This Plan" action — never automatic. Bumps
  // revision so every downstream read (project.current_visual_plan_version_id,
  // resumeState) refreshes off the newly-adopted plan.
  async function adoptPlan() {
    if (action.current) return;
    action.current = true; setBusy(true); setError("");
    try {
      await adoptVisualPlanVersion(row.id);
      setReplanReview(null);
      setRevision((v) => v + 1);
    } catch (e) { setError(e.message || "Couldn't switch to the new plan. Please try again."); }
    finally { action.current = false; setBusy(false); }
  }
  // Instant, optimistic — style selection never touches Script/Research/
  // Visual Plan (Part 1/8/10 of the Style Picker milestone), so there's
  // nothing to regenerate or re-poll here, just a project-row save.
  async function changeVisualStyle(nextPreset) {
    setProject((p) => (p ? { ...p, visual_style_preset: nextPreset } : p));
    await saveVisualStylePreset(projectId, nextPreset);
  }
  const ready = phase === "ready" || phase === "stale";
  return <div className={`mx-auto flex min-h-full w-full flex-col px-4 lg:h-full lg:min-h-0 lg:px-6 ${ready ? "max-w-[1600px]" : "h-full max-w-[760px]"}`}>
    <div className="shrink-0"><LongFormCreationHeader current="look" project={project} /></div>
    {/* Some backend error strings (e.g. VISUAL_PLAN_PAUSED) are already
        complete, reassuring sentences on their own — unconditionally
        appending this suffix after them duplicated it verbatim ("...is
        safe. Your saved storyboard is preserved."). Only add it when the
        message doesn't already say so, so a generic/unexpected error still
        gets the reassurance while a self-contained one isn't doubled up. */}
    {error && (
      <p role="status" className="mb-3 rounded-xl border border-amber-200/20 p-3 text-sm text-amber-200/80">
        {error}
        {!/preserved|safe/i.test(error) && " Your saved storyboard is preserved."}
      </p>
    )}
    {ready ? <StoryboardWorkspace row={row} script={script} busy={busy} stale={phase === "stale"} onSave={save} onRegenerate={regenerate} onBuildWorld={() => navigate(`/long-form/project/${projectId}/visual-world`)}
      focusBeatIds={focusBeatIds}
      onContinueToScenes={() => navigate(`/long-form/project/${projectId}/generate`)}
      onBackToNarration={() => navigate(`/long-form/project/${projectId}/script`)}
      visualStylePreset={project?.visual_style_preset} visualWorldExists={Boolean(project?.current_visual_world_version_id)} resumeState={resumeState} onChangeVisualStyle={changeVisualStyle}
      replanReview={replanReview} onAdoptPlan={adoptPlan} />
      : phase === "needs-script" || phase === "notfound" ? <div className="m-auto py-16 text-center"><h1 className="text-xl font-semibold text-white">{phase === "notfound" ? "Project not found" : "Your narration isn't ready yet"}</h1><button className="mt-5 text-sm font-semibold text-lime-300" onClick={() => navigate(`/long-form/project/${projectId}/script`)}>Back to Script →</button></div>
      : <div className="flex min-h-0 flex-1 items-center justify-center"><VisualPlanProgress row={row} error={error} onRetry={resume} /></div>}
  </div>;
}
