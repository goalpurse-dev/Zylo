import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../../lib/supabaseClient";
import { fetchReferenceAssets, regenerateReferenceAsset, startVisualWorld } from "./visualWorld";
import { referenceEntities, VISUAL_WORLD_MODELS } from "./visualWorldPlanning";
import { nextBackoffMs } from "./connectionState";
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
  const [revision, setRevision] = useState(0);
  const [excludedViews, setExcludedViews] = useState(() => new Set());
  const [modelKey, setModelKey] = useState("fast");
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
        const { data: world, error: worldError } = await supabase.from("long_form_visual_world_versions").select("*").eq("project_id", projectId).eq("visual_plan_version_id", plan.id).order("version", { ascending: false }).limit(1).maybeSingle();
        if (worldError) throw worldError;
        const assets = world ? await fetchReferenceAssets(world.id) : [];
        if (cancelled) return;
        setSnapshot({ project, plan, world, assets });
        setError(null);
        failures = 0;
        if (!world || !["planning", "generating"].includes(world.status)) return;
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
    const result = await startVisualWorld(projectId, { rendererToolKey: VISUAL_WORLD_MODELS[modelKey].toolKey, styleKey: "zyvo_illustrated_documentary", excludedViews: [...excludedViews] });
    if (!result.ok) throw new Error(result.message);
  });
  const retry = (ids) => perform(async () => {
    // Each slot gets its own replacement; no new world or planner call.
    for (const assetId of Array.isArray(ids) ? ids : [ids]) {
      const result = await regenerateReferenceAsset(assetId);
      if (!result.ok) throw new Error(result.message);
    }
  });

  if (snapshot?.missing || snapshot?.needsPlan) return <div className="mx-auto max-w-xl px-5 py-20 text-center text-white"><p>{snapshot.missing ? "Project not found." : "This project needs a finished storyboard before Visual World can begin."}</p><button onClick={() => navigate(`/long-form/project/${projectId}/look`)} className="mt-4 text-sm text-lime-300">Go to Look</button></div>;
  return <VisualWorldWorkspace entities={referenceEntities(snapshot?.plan, snapshot?.world)} assets={snapshot?.assets} visualWorld={snapshot?.world} excludedViews={snapshot?.world ? new Set() : excludedViews} onToggleView={(key) => setExcludedViews((old) => { const next = new Set(old); if (next.has(key)) next.delete(key); else next.add(key); return next; })} modelKey={modelKey} onModelChange={setModelKey} onBuild={build} onRetry={retry} busy={busy} loading={!snapshot} error={actionError ?? error} />;
}
