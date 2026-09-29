// StickmanRouteGuard.jsx — Phase 6c/6e. Wraps every /long-form/project/:id/*
// route. For a Stickman project it fetches the live facts that decide the
// real step (script locked? narration ready? scenes drawn?), then either
// renders the page or redirects to the page of the project's actual step
// (resolveStickmanPage) — so a legacy URL never opens for a Stickman project
// and the stepper (which reads the same facts from StickmanProjectContext)
// always matches the page. Legacy (non-Stickman) projects render as before.
// 6e: the last known state is kept in memory, so Back/Continue between saved
// steps decides instantly (no blank screen, no progress flash) and refreshes
// in the background.
import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { supabase } from "../../../lib/supabaseClient";
import { fetchLongFormProject } from "./project";
import { fetchActiveGenerationProfile, isStickmanRecipeProfile } from "./productionProfile";
import { resolveStickmanPage } from "./projectStage";
import { StickmanProjectContext } from "./stickmanContext";

const cache = new Map(); // projectId -> { stickman: boolean, project?: object, profile?: object }
export const cachedStickmanProject = (id) => cache.get(id) ?? null;
// Call before navigating after a state change (a run finished, a step started), so the next guard reads fresh.
export const invalidateStickmanCache = (id) => { cache.delete(id); };

export async function fetchStickmanFacts(project, profile) {
  const [script, narration, scenes] = await Promise.all([
    project.current_script_version_id
      ? supabase.from("long_form_script_versions").select("locked_at, locked_generation_profile_id").eq("id", project.current_script_version_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("long_form_narration_audio_versions").select("id").eq("project_id", project.id).eq("generation_profile_id", profile.id).in("status", ["ready", "alignment_failed"]).limit(1),
    supabase.from("long_form_scene_images").select("id", { count: "exact", head: true }).eq("project_id", project.id).eq("is_current", true),
  ]);
  return {
    _scriptLocked: Boolean(script.data?.locked_at && script.data.locked_generation_profile_id === profile.id),
    _narrationReady: (narration.data ?? []).length > 0,
    _hasScenes: (scenes.count ?? 0) > 0,
  };
}

async function load(id) {
  const project = await fetchLongFormProject(id);
  if (!project) return { stickman: false };
  const profile = await fetchActiveGenerationProfile(id);
  if (!isStickmanRecipeProfile(profile)) return { stickman: false };
  const facts = await fetchStickmanFacts(project, profile);
  return { stickman: true, project: { ...project, ...facts }, profile };
}

export default function StickmanRouteGuard({ page, children }) {
  const { id } = useParams();
  const [state, setState] = useState(() => (cache.has(id) ? { loading: false, ...cache.get(id) } : { loading: true }));

  useEffect(() => {
    let alive = true;
    if (!cache.has(id)) setState({ loading: true });
    load(id)
      .then((s) => { cache.set(id, s); if (alive) setState({ loading: false, ...s }); })
      .catch(() => { if (alive && !cache.has(id)) setState({ loading: false, stickman: false }); });
    return () => { alive = false; };
  }, [id, page]);

  if (state.loading) return <div className="min-h-[60vh]" aria-busy="true" />;
  if (!state.stickman) return children;
  const target = resolveStickmanPage(page, state.project);
  if (target !== page) return <Navigate replace to={`/long-form/project/${id}/${target}`} />;
  return <StickmanProjectContext.Provider value={state.project}>{children}</StickmanProjectContext.Provider>;
}
