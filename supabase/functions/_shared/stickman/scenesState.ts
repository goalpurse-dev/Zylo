// deno-lint-ignore-file no-explicit-any
// stickman/scenesState.ts — loads a project's Scenes-step rows into decideScenes' input (Phase 6c).
// Shared by advance-long-form-autopilot and get-long-form-scenes.
import { tierOf, type ScenesInput, type ScenesRecord } from "./scenes.ts";
import { bibleBuildState } from "./bibleBuild.ts";

export async function loadScenesInput(admin: any, projectId: string, project: any, sc: ScenesRecord, now: string) {
  const { data: profile } = await admin.from("long_form_generation_profiles").select("id, render_tier").eq("project_id", projectId).eq("status", "active").maybeSingle();
  const scriptId = project.current_script_version_id;
  const { data: bible } = await admin.from("long_form_production_bibles").select("id, status, created_at").eq("project_id", projectId).eq("script_version_id", scriptId).neq("status", "superseded").order("created_at", { ascending: false }).limit(1).maybeSingle();
  // The run's own plan once known (also covers regenerations on a finished run); else the newest plan since
  // the run started — or since the last free Retry, so a plan that failed before it is never picked up again.
  const { data: planRow } = sc.planId
    ? await admin.from("long_form_beat_plan_versions").select("id, status, created_at, stats, error_code").eq("id", sc.planId).maybeSingle()
    : await admin.from("long_form_beat_plan_versions").select("id, status, created_at, stats, error_code").eq("project_id", projectId).eq("script_version_id", scriptId).neq("status", "check_only").gte("created_at", (sc as any).retriedAt ?? sc.startedAt).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const beatCount = planRow ? ((await admin.from("long_form_beats").select("id", { count: "exact", head: true }).eq("beat_plan_version_id", planRow.id)).count ?? 0) : 0;
  const { data: imgs } = planRow ? await admin.from("long_form_scene_images").select("id, status, attempts, lease_until, ready_at, created_at").eq("project_id", projectId).eq("beat_plan_version_id", planRow.id).eq("is_current", true) : { data: [] as any[] };
  const list = imgs ?? [];
  const nowMs = Date.parse(now);
  const images = {
    queued: list.filter((r: any) => r.status === "queued").length,
    rendering: list.filter((r: any) => r.status === "rendering").length,
    renderingExpired: list.filter((r: any) => r.status === "rendering" && (!r.lease_until || Date.parse(r.lease_until) < nowMs)).map((r: any) => ({ id: r.id, attempts: r.attempts })),
    ready: list.filter((r: any) => r.status === "ready").length,
    failed: list.filter((r: any) => r.status === "failed").length,
    total: list.length,
    // The newest of: a scene finished, a scene row was made, the second pass began (it gets its own six hours).
    lastProgressAt: [...list.map((r: any) => [r.ready_at, r.created_at]).flat(), (sc as any).secondPassAt].filter(Boolean).map((t: string) => new Date(t).toISOString()).sort().at(-1) ?? null,
  };
  const bibleBuild = bible?.status === "frozen" || !scriptId ? null : await bibleBuildState(admin, projectId, scriptId);
  const input: ScenesInput = { now, scenes: sc, bible: bible ?? null, bibleBuild, plan: planRow ? { id: planRow.id, status: planRow.status, created_at: planRow.created_at, beatCount, errorCode: planRow.error_code ?? null } : null, images, tier: tierOf(profile?.render_tier) };
  return { input, planRow, tier: tierOf(profile?.render_tier) };
}
