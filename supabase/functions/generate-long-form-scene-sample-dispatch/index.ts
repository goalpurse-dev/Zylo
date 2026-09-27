// deno-lint-ignore-file no-explicit-any
// generate-long-form-scene-sample-dispatch/index.ts
//
// 2026-09-23 "systemic production stabilization" pass, Item E — the DISPATCH
// half of "Generate Test Sample," explicitly deferred by the 2026-09-22
// "permanently separate PLAN/COMPILE from PAID GENERATION" pass (see
// generate-long-form-scene-sample/index.ts's own comment). That pass shipped
// the QUOTE half; this is the real charge+authorize+kick action the button
// needs to actually do something.
//
// Recomputes the exact same sample (resolveSampleCandidates — the ONE
// authoritative selection, shared with the quote endpoint) server-side
// rather than trusting whatever the client last saw, so a stale quote can
// never be charged. Charges ONLY those beats (charge_long_form_sample_
// generation, migration 20261001220000) — never the whole chapter/episode,
// and structurally refuses if a real chapter/episode generation is already
// active for this project (GENERATION_ALREADY_ACTIVE), so a test sample can
// never cancel/displace real paid generation. Chapter 1 / the full episode
// remain completely unauthorized by this action — only the 1-3 selected
// beats are ever moved out of 'awaiting_generation'.
//
// POST { projectId, tier }
// Returns { ok:true, alreadyCharged, creditsCharged, generationRunId, sampleScenes }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";
import { resolveSampleCandidates } from "../_shared/sceneSampleSelection.ts";
import { authorizeCompiledScenesForDispatch } from "../_shared/sceneGenerationAuthorization.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADVANCE_SECRET = Deno.env.get("LONG_FORM_SCENE_ADVANCE_SECRET") ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);

  const { user, authError } = await requireUser(req);
  if (!user) return err(req, authError || "Unauthorized", 401);

  const body = await req.json().catch(() => ({}));
  const projectId = String(body?.projectId ?? "").trim();
  if (!projectId) return err(req, "Missing projectId", 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: project, error: projectError } = await admin.from("long_form_projects").select("*").eq("id", projectId).maybeSingle();
  if (projectError) return err(req, "Failed to load project", 500);
  if (!project || project.user_id !== user.id) return err(req, "Project not found", 404);
  if (!project.current_visual_world_version_id || !project.current_visual_plan_version_id) return err(req, "Visual World or Visual Plan not ready", 400);
  const tier = String(body?.tier ?? project.scene_generation_tier ?? "v3").trim();
  if (!["v2", "v3", "v4"].includes(tier)) return err(req, "Invalid tier", 400);

  const worldId = project.current_visual_world_version_id;
  const planVersionId = project.current_visual_plan_version_id;

  const { compiledPlanCount, sampleScenes, estimatedSampleCredits } = await resolveSampleCandidates(admin, worldId, planVersionId, tier);
  if (!compiledPlanCount) return err(req, "No scenes have been compiled yet for this plan — compile scenes first, then generate a test sample.", 409);
  if (!sampleScenes.length) return err(req, "No representative sample could be selected from the current plan.", 409);

  const beatIds = sampleScenes.map((s) => s.beatId);
  const { data: charge, error } = await admin.rpc("charge_long_form_sample_generation", {
    p_project_id: projectId, p_user_id: user.id, p_tier: tier, p_beat_ids: beatIds, p_expected_credits: estimatedSampleCredits,
  });
  if (error) {
    const message = error.message ?? "";
    const status = message.includes("FORBIDDEN") ? 403 : message.includes("PROJECT_NOT_FOUND") ? 404
      : message.includes("GENERATION_ALREADY_ACTIVE") ? 409
      : message.includes("SAMPLE_PRICE_MISMATCH") || message.includes("SAMPLE_BEAT_IDS_NOT_IN_CURRENT_PLAN") ? 409
      : message.includes("VISUAL_WORLD_NOT_READY") ? 400
      : message.includes("INSUFFICIENT_CREDITS") ? 402 : message.includes("INVALID_TIER") ? 400 : 500;
    const friendly = status === 402 ? "Not enough credits."
      : status === 409 && message.includes("GENERATION_ALREADY_ACTIVE") ? "A chapter or episode generation is already in progress for this project — finish or wait for it before generating a test sample."
      : status === 409 ? "The plan changed since this sample was quoted — please refresh and try again."
      : status === 400 ? "This project isn't ready to generate yet."
      : "Could not start the test sample";
    return err(req, friendly, status);
  }

  // Only authorize+kick on a FRESH charge — a replayed (alreadyCharged)
  // request must never re-authorize/re-dispatch scenes a second time.
  if (charge?.charged && !charge?.alreadyCharged) {
    const generationRunId = String(charge?.generationRunId ?? "");
    const authorizeAndDispatch = (async () => {
      const authResult = await authorizeCompiledScenesForDispatch(admin, { visualWorldVersionId: worldId, beatIds, generationRunId }).catch((e) => {
        console.error("[generate-long-form-scene-sample-dispatch] authorization failed", e);
        return null;
      });
      if (authResult?.skipped?.length) console.error("[generate-long-form-scene-sample-dispatch] some sample beats could not be authorized:", authResult.skipped);
      if (authResult?.authorized?.length) {
        await fetch(`${SUPABASE_URL}/functions/v1/advance-long-form-scene-generation`, {
          method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json", "x-cron-secret": ADVANCE_SECRET },
          body: JSON.stringify({ visualWorldVersionId: worldId }),
        }).catch((e) => console.error("[generate-long-form-scene-sample-dispatch] dispatch kick failed", e));
      }
    })().catch(() => {});
    const rt = (globalThis as any).EdgeRuntime;
    if (rt?.waitUntil) rt.waitUntil(authorizeAndDispatch); else await authorizeAndDispatch;
  }

  return ok(req, {
    ok: true, charged: Boolean(charge?.charged), alreadyCharged: Boolean(charge?.alreadyCharged),
    creditsCharged: charge?.creditsCharged ?? 0, generationRunId: charge?.generationRunId ?? null, sampleScenes,
  });
});
