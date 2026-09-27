import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../../lib/supabaseClient";
import { approveReferenceAssetManually, approveReferenceIdentity, editReferenceAsset, fetchReferenceAssets, regenerateReferenceAsset, startVisualWorld, reconcileVisualWorld, adoptVisualWorldVersion, promoteReferenceAssetVersion } from "./visualWorld";
import { fetchLongFormResumeState } from "./project";
import { referenceEntities, VISUAL_WORLD_MODELS } from "./visualWorldPlanning";
import { nextBackoffMs } from "./connectionState";
import { assessVisualWorldCompatibility } from "./visualWorldCompatibility";
import VisualWorldWorkspace from "./VisualWorldWorkspace";

export default function LongFormVisualWorld() {
  const { id } = useParams();
  return <ProjectVisualWorld key={id} projectId={id} />;
}

function ProjectVisualWorld({ projectId }) {
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [rebuildStarting, setRebuildStarting] = useState(false);
  const [revision, setRevision] = useState(0);
  const [excludedViews, setExcludedViews] = useState(() => new Set());
  // Part 5/6 of the 2026-09-14 fix: no longer a user-editable choice (the
  // old Model dropdown was removed from VisualWorldWorkspace — each
  // reference type's renderer is fixed by role now, not by a world-level
  // preference) — kept only because startVisualWorld's payload still
  // expects a rendererToolKey field; "fast" (Klein 4B/base) is a harmless
  // default no dispatch path actually reads back out.
  const [modelKey] = useState("fast");
  const actionInFlight = useRef(false);

  useEffect(() => {
    document.title = "Visual World | Zyvo";
    let cancelled = false;
    let timer;
    let failures = 0;
    async function refresh() {
      let delay = 3000;
      try {
        const { data: project, error: projectError } = await supabase.from("long_form_projects").select("*").eq("id", projectId).maybeSingle();
        if (projectError) throw projectError;
        if (!project) { if (!cancelled) setSnapshot({ missing: true }); return; }
        if (!project.current_visual_plan_version_id) { if (!cancelled) setSnapshot({ needsPlan: true }); return; }
        const { data: plan, error: planError } = await supabase.from("long_form_visual_plan_versions").select("*").eq("id", project.current_visual_plan_version_id).maybeSingle();
        if (planError) throw planError;
        if (!plan || plan.status !== "ready") { if (!cancelled) setSnapshot({ needsPlan: true }); return; }
        // 2026-09-19 forensic fix (real Mars incident): this used to look up
        // "the current Visual World" ONLY by visual_plan_version_id = the
        // CURRENT plan — which returns NOTHING the instant a project
        // replans (the durable, real, already-built world was created for
        // an OLDER plan version and never gets a fresh row just because the
        // plan pointer moved). Real Mars reproduction: this exact query
        // returns zero rows for plan v5 even though a real, 85-succeeded-
        // reference Visual World genuinely exists — the page would have
        // rendered a misleading "Visual World not started" onboarding view.
        // start-long-form-visual-world/index.ts already documents and
        // trusts the durable current_visual_world_version_id pointer FIRST
        // for exactly this reason (its own Part 6 comment) — this now
        // mirrors that same precedence: durable pointer first, the
        // plan-scoped lookup only as a fallback for a project that has
        // genuinely never had a world at all.
        let world = null;
        if (project.current_visual_world_version_id) {
          const { data: pointedWorld, error: pointedError } = await supabase.from("long_form_visual_world_versions").select("*").eq("id", project.current_visual_world_version_id).maybeSingle();
          if (pointedError) throw pointedError;
          world = pointedWorld ?? null;
        }
        if (!world) {
          const { data: fallbackWorld, error: worldError } = await supabase.from("long_form_visual_world_versions").select("*").eq("project_id", projectId).eq("visual_plan_version_id", plan.id).order("version", { ascending: false }).limit(1).maybeSingle();
          if (worldError) throw worldError;
          world = fallbackWorld ?? null;
        }
        // 2026-09-19 "Visual World incremental reconciliation" pass: an
        // "Update Visual World" click creates a NEW world version (parent_
        // visual_world_version_id set, scoped to the CURRENT plan) WITHOUT
        // touching current_visual_world_version_id until it's actually
        // ready (see start_visual_world_reconciliation's own comment) — so
        // while it's in flight, the durable pointer above still resolves to
        // the OLD world. Look for an in-progress/completed/FAILED
        // reconciliation targeting the current plan and, if one exists,
        // show IT instead — this is what lets the user watch live per-asset
        // progress (Part 7/8) rather than staring at the stale compatibility
        // banner while real work is happening just out of view. A FAILED
        // reconciliation is deliberately shown too (2026-09-19 production
        // incident fix, item 5) — silently falling back to the old world
        // here is exactly what produced the "stuck forever with no
        // explanation" bug: the failure banner needs the failed world's own
        // row to render at all.
        const { data: reconciliationWorld, error: reconcileWorldError } = await supabase.from("long_form_visual_world_versions").select("*").eq("project_id", projectId).eq("visual_plan_version_id", plan.id).not("parent_visual_world_version_id", "is", null).order("version", { ascending: false }).limit(1).maybeSingle();
        if (reconcileWorldError) throw reconcileWorldError;
        // A full rebuild is deliberately NOT a reconciliation: it has no
        // parent_visual_world_version_id and must remain non-adopted until
        // the user approves it. The old loader therefore skipped it while
        // it was planning/generating and kept painting the adopted board.
        // Follow the newest same-plan, non-adopted full rebuild for its whole
        // lifecycle so refresh/back/forward restore the version that is
        // actually being built or reviewed.
        const { data: latestForPlan, error: latestForPlanError } = await supabase.from("long_form_visual_world_versions").select("*").eq("project_id", projectId).eq("visual_plan_version_id", plan.id).order("version", { ascending: false }).limit(1).maybeSingle();
        if (latestForPlanError) throw latestForPlanError;
        const dismissedRebuildId = sessionStorage.getItem(`zyvo:visual-world:kept-current:${projectId}`);
        const rebuildPreview = latestForPlan
          && latestForPlan.id !== world?.id
          && !latestForPlan.parent_visual_world_version_id
          && latestForPlan.id !== dismissedRebuildId
          ? latestForPlan
          : null;
        const displayWorld = rebuildPreview ?? reconciliationWorld ?? world;
        const assets = displayWorld ? await fetchReferenceAssets(displayWorld.id) : [];
        // Part 5: same authoritative resolver every other Long Form entry
        // point uses — lets this page say "Scene generation in progress"/
        // "Review Scenes" truthfully instead of a generic "Continue to
        // Scenes" once generation has actually started.
        const resumeState = await fetchLongFormResumeState(projectId);
        // Part 2/3/4 of the 2026-09-19 forensic fix — the hard invariant:
        // current VisualPlan + current Visual World + required canonical
        // references must be mutually compatible before Scenes proceeds.
        // Only meaningful when displaying a world built for a DIFFERENT
        // plan version than the one now current (a genuinely fresh/never-
        // built world has nothing to compare — the normal "not started"
        // onboarding view already covers that case; a reconciliation world
        // is ALREADY scoped to the current plan by construction, so this is
        // naturally null while one is being displayed — its own live
        // progress is what gates Continue to Scenes at that point instead).
        const compatibility = displayWorld && displayWorld.visual_plan_version_id !== plan.id
          ? assessVisualWorldCompatibility(plan.entity_registry, displayWorld.reference_plan?.entities ?? [], plan.continuity_groups)
          : null;
        if (cancelled) return;
        // `reconciling` is scoped to ACTIVELY IN PROGRESS only (Part 7: the
        // special "Updating Visual World" heading/caption is for the in-
        // flight period — once status resolves to 'ready'/'needs_attention'
        // this reverts to the normal "Your Visual World"/ready-count view,
        // exactly like a fresh build does once it finishes).
        const reconciling = Boolean(reconciliationWorld && ["planning", "generating"].includes(reconciliationWorld.status));
        const rebuilding = Boolean(rebuildPreview && ["planning", "generating"].includes(rebuildPreview.status));
        const reviewingRebuild = Boolean(rebuildPreview && rebuildPreview.status === "ready");
        setSnapshot({ project, plan, adoptedWorld: world, world: displayWorld, assets, resumeState, compatibility, reconciling, rebuilding, reviewingRebuild });
        setError(null);
        failures = 0;
        // Part 15 of the 2026-09-13 reliability fix: this used to stop
        // polling entirely once the world left planning/generating (e.g.
        // 'needs_attention' after a stage hit MAX_STAGE_ATTEMPTS) — but
        // Part 5/6's whole point is that a provider-success orphan can be
        // reconciled OUT OF BAND by the recovery cron with no user action in
        // this tab to bump `revision` and restart the effect. An open tab
        // would sit on stale data until a hard refresh, exactly what Part 15
        // forbids. Keep a slow heartbeat instead of stopping outright — full
        // 3s cadence while actively generating, a much lighter 15s check
        // otherwise so an out-of-band fix still surfaces without a refresh.
        delay = displayWorld && ["planning", "generating"].includes(displayWorld.status) ? 3000 : 15000;
      } catch {
        if (cancelled) return;
        setError("Connection interrupted. Reconnecting… Your saved references are still here.");
        delay = nextBackoffMs(++failures);
      }
      if (!cancelled) timer = setTimeout(refresh, delay);
    }
    refresh();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [projectId, revision]);

  async function perform(action) {
    if (actionInFlight.current) return false;
    actionInFlight.current = true;
    setBusy(true);
    setActionError(null);
    try {
      await action();
      setRevision((n) => n + 1);
      return true;
    } catch (err) {
      setActionError(err.message || "Couldn't start this reference. Please try again.");
      // Re-read after an uncertain response; the server may have accepted it.
      setRevision((n) => n + 1);
      return false;
    } finally { actionInFlight.current = false; setBusy(false); }
  }
  const build = () => perform(async () => {
    // styleKey is no longer sent — the server derives the real style from
    // the project's own visual_style_preset (see getStylePresetForProject
    // in advance-long-form-visual-world). The legacy "zyvo_illustrated_documentary"
    // key/allowlist still exists server-side for old callers but is never
    // sent from here anymore.
    const result = await startVisualWorld(projectId, { rendererToolKey: VISUAL_WORLD_MODELS[modelKey].toolKey, excludedViews: [...excludedViews] });
    if (!result.ok) throw new Error(result.message);
  });
  const retry = (ids) => perform(async () => {
    // Each slot gets its own replacement; no new world or planner call.
    for (const assetId of Array.isArray(ids) ? ids : [ids]) {
      const result = await regenerateReferenceAsset(assetId);
      if (!result.ok) throw new Error(result.message);
    }
  });
  const edit = (assetId, instruction) => perform(async () => {
    const result = await editReferenceAsset(assetId, instruction);
    if (!result.ok) throw new Error(result.message);
  });
  const approveIdentity = (assetId) => perform(async () => {
    const result = await approveReferenceIdentity(assetId);
    if (!result.ok) throw new Error(result.message);
  });
  const approveAnyway = (assetId) => perform(async () => {
    const result = await approveReferenceAssetManually(assetId);
    if (!result.ok) throw new Error(result.message);
  });
  // 2026-09-19 "Visual World incremental reconciliation" pass — "Update
  // Visual World": reuses compatible references, generates only the
  // missing ones. Idempotent server-side, so a double-click here is
  // harmless (returns the same in-progress reconciliation, never a second
  // one) — actionInFlight.current already guards against a double-click
  // firing two overlapping requests in the same tab regardless.
  const updateVisualWorld = () => perform(async () => {
    const result = await reconcileVisualWorld(projectId);
    if (!result.ok) throw new Error(result.message);
  });
  // 2026-09-20 "Rebuild Visual World" fix — non-destructive: creates a NEW
  // long_form_visual_world_versions row (regenerate:true, already-proven
  // server capability) using the current storyboard/plan and style; the
  // existing current Visual World is never touched and stays current until
  // the rebuild is explicitly adopted (see adoptRebuild below). Never
  // triggers scene generation.
  const rebuild = async () => {
    setRebuildStarting(true);
    sessionStorage.removeItem(`zyvo:visual-world:kept-current:${projectId}`);
    try {
      return await perform(async () => {
        const result = await startVisualWorld(projectId, { regenerate: true, rendererToolKey: VISUAL_WORLD_MODELS[modelKey].toolKey, excludedViews: [...excludedViews] });
        if (!result.ok) throw new Error(result.message);
      });
    } finally {
      setRebuildStarting(false);
    }
  };
  const adoptRebuild = (visualWorldVersionId) => perform(async () => {
    const result = await adoptVisualWorldVersion(visualWorldVersionId);
    if (!result.ok) throw new Error(result.message);
  });
  const useReferenceVersion = (assetId) => perform(async () => {
    const result = await promoteReferenceAssetVersion(assetId);
    if (!result.ok) throw new Error(result.message);
  });
  const keepCurrentWorld = () => {
    if (!snapshot?.world?.id || !snapshot?.adoptedWorld) return;
    sessionStorage.setItem(`zyvo:visual-world:kept-current:${projectId}`, snapshot.world.id);
    setSnapshot((currentSnapshot) => ({
      ...currentSnapshot,
      world: currentSnapshot.adoptedWorld,
      assets: [],
      rebuilding: false,
      reviewingRebuild: false,
    }));
    setRevision((n) => n + 1);
  };

  if (snapshot?.missing || snapshot?.needsPlan) return <div className="mx-auto max-w-xl px-5 py-20 text-center text-white"><p>{snapshot.missing ? "Project not found." : "This project needs a finished storyboard before Visual World can begin."}</p><button onClick={() => navigate(`/long-form/project/${projectId}/look`)} className="mt-4 text-sm text-lime-300">Go to Look</button></div>;
  return <VisualWorldWorkspace project={snapshot?.project} entities={referenceEntities(snapshot?.plan, snapshot?.world)} assets={snapshot?.assets} visualWorld={snapshot?.world} excludedViews={snapshot?.world ? new Set() : excludedViews} onToggleView={(key) => setExcludedViews((old) => { const next = new Set(old); if (next.has(key)) next.delete(key); else next.add(key); return next; })} onBuild={build} onRebuild={rebuild} onRetry={retry} onEdit={edit} onApproveIdentity={approveIdentity} onApproveAnyway={approveAnyway} onUseVersion={useReferenceVersion} onContinueToScenes={() => navigate(`/long-form/project/${projectId}/generate`)} onBackToStoryboard={() => navigate(`/long-form/project/${projectId}/look`)} onUpdateVisualWorld={updateVisualWorld} rebuilding={snapshot?.rebuilding ?? false} rebuildStarting={rebuildStarting} reviewingRebuild={snapshot?.reviewingRebuild ?? false} onAdoptRebuild={adoptRebuild} onKeepCurrent={keepCurrentWorld} resumeState={snapshot?.resumeState} compatibility={snapshot?.compatibility ?? null} reconciling={snapshot?.reconciling ?? false} busy={busy} loading={!snapshot} error={actionError ?? error} />;
}
