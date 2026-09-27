// deno-lint-ignore-file no-explicit-any
// generate-long-form-scene-sample/index.ts
//
// 2026-09-22 "permanently separate PLAN/COMPILE from PAID GENERATION" pass,
// §6/§7/§12: "Add Generate Test Sample ... show the exact scenes and
// estimated credits BEFORE dispatch." This is the QUOTE half of that
// feature — it reads the REAL persisted compile (compile-long-form-scenes'
// output), picks up to 3 representative scenes via the generic
// selectRepresentativeSampleScenes selector (never blindly the first
// three), and returns them with an honest credit estimate. It never
// charges, never authorizes, never dispatches, and never creates or
// touches any row — pure read + pure selection, safe to call any number of
// times, including from the Generate page before the user has decided
// anything.
//
// The DISPATCH half (charge exactly these 3 scenes, authorize them, kick
// generation) is deliberately NOT implemented here yet. It needs a real
// SQL charge RPC scoped to an arbitrary small beat set that composes
// correctly with the existing one-'charged'-row-per-project constraint
// (long_form_episode_charge_one_active_per_project) the same way the
// chapter-gate design already does (a sub-ledger under one shared parent
// charge row — see long_form_chapter_generation_charges) — that requires a
// migration, and per this pass's own instructions any new migration is
// written and tested locally but left PENDING, never applied, while the
// Supabase migration-history ledger mismatch is unresolved. Building and
// deploying an unverified change to real billing SQL was judged higher-risk
// than shipping the safe, fully-real quote path now and the charge/dispatch
// half as an explicit, separately-tracked follow-up — see this pass's final
// report.
//
// POST { projectId }
// Returns { ok:true, charged:false, totalCompiledScenes, sampleScenes: [{
//   sceneId, beatId, category, reason, renderStrategy, estimatedCredits,
//   referenceAssetIds, hasOverlay, basePromptSummary
// }], estimatedSampleCredits }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";
import { resolveSampleCandidates } from "../_shared/sceneSampleSelection.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);

  const { user, authError } = await requireUser(req);
  if (!user) return err(req, authError || "Unauthorized", 401);

  const body = await req.json().catch(() => ({}));
  const projectId = String(body?.projectId ?? "").trim();
  if (!projectId) return err(req, "Missing projectId", 400);
  const tier = String(body?.tier ?? "v3").trim();

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: project, error: projectError } = await admin.from("long_form_projects").select("*").eq("id", projectId).maybeSingle();
  if (projectError) return err(req, "Failed to load project", 500);
  if (!project || project.user_id !== user.id) return err(req, "Project not found", 404);
  if (!project.current_visual_world_version_id || !project.current_visual_plan_version_id) return err(req, "Visual World or Visual Plan not ready", 400);

  const worldId = project.current_visual_world_version_id;
  const planVersionId = project.current_visual_plan_version_id;

  // Only ever reads plan/scene rows already compiled by compile-long-form-
  // scenes — never compiles anything itself. A project with zero compiled
  // scenes yet gets an honest, actionable message rather than an empty
  // sample. resolveSampleCandidates is the ONE authoritative selection
  // query (2026-09-23 Item E) — generate-long-form-scene-sample-dispatch
  // recomputes the exact same thing server-side before charging, so quote
  // and charge can never silently disagree about what "the sample" means.
  const { compiledPlanCount, sampleScenes, estimatedSampleCredits } = await resolveSampleCandidates(admin, worldId, planVersionId, tier);
  if (!compiledPlanCount) return err(req, "No scenes have been compiled yet for this plan — compile scenes first, then select a test sample.", 409);

  return ok(req, { ok: true, charged: false, totalCompiledScenes: compiledPlanCount, sampleScenes, estimatedSampleCredits });
});
