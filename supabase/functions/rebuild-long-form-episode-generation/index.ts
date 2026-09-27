// deno-lint-ignore-file no-explicit-any
// rebuild-long-form-episode-generation/index.ts
//
// "Rebuild Episode Visuals" (2026-09-15 safe full-episode rebuild pass) —
// mirrors charge-long-form-episode-generation's own shape exactly (charge
// via a server-authoritative RPC, then kick off compilation for every beat
// in the CURRENT VisualPlan in batches of 40, self-chaining, durable via
// waitUntil) with two differences: (1) it calls
// rebuild_long_form_episode_generation instead of charge_long_form_episode_
// generation — that RPC supersedes the previous ACTIVE charge rather than
// requiring none to exist, and switches the project's active-run pointer
// only after the new charge is durably created; (2) every compile batch
// call passes forceNewPlanVersion:true and the new run's own id explicitly,
// so every beat gets a genuinely NEW SceneRenderPlan version (never an
// in-place upsert onto the previous run's plan_version=1) and every new
// scene is tagged with the NEW generation_run_id, never inheriting the old
// run's scenes by accident (Part 4/7).
//
// Visual World / canonical references are NEVER touched here (Part 8) —
// this only ever reads project.current_visual_world_version_id, never
// creates or regenerates a world.
//
// POST { projectId, tier, expectedActiveGenerationRunId }
// Returns { ok:true, newGenerationRunId, previousGenerationRunId, alreadyCharged, creditsCharged, breakdown, tier }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";
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
  const tier = String(body?.tier ?? "v3").trim();
  const expectedActiveGenerationRunId = String(body?.expectedActiveGenerationRunId ?? "").trim();
  if (!projectId) return err(req, "Missing projectId", 400);
  if (!["v2", "v3", "v4"].includes(tier)) return err(req, "Invalid tier", 400);
  if (!expectedActiveGenerationRunId) return err(req, "Missing expectedActiveGenerationRunId — reload the page and try again", 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: charge, error } = await admin.rpc("rebuild_long_form_episode_generation", {
    p_project_id: projectId, p_user_id: user.id, p_tier: tier, p_expected_active_charge_id: expectedActiveGenerationRunId,
  });
  if (error) {
    const message = error.message ?? "";
    const status = message.includes("FORBIDDEN") ? 403 : message.includes("PROJECT_NOT_FOUND") ? 404
      : message.includes("NOT_READY") || message.includes("VISUAL_WORLD_NOT_READY") ? 400
      : message.includes("ACTIVE_RUN_CHANGED_SINCE_QUOTE") ? 409
      : message.includes("NO_ACTIVE_GENERATION_TO_REBUILD") ? 409
      : message.includes("INSUFFICIENT_CREDITS") ? 402 : message.includes("INVALID_TIER") ? 400 : 500;
    const friendly = status === 402 ? "Not enough credits." : status === 409
      ? "This episode's generation has changed since you opened this dialog — refresh and try again."
      : status === 400 ? "This episode isn't ready to rebuild yet." : "Could not start the rebuild";
    return err(req, friendly, status);
  }

  // Only kick off compilation/authorization/dispatch on a FRESH rebuild — a
  // replayed (alreadyCharged) request (double-click) must never re-trigger a
  // second full compile pass.
  //
  // 2026-09-22 "permanently separate PLAN/COMPILE from PAID GENERATION"
  // pass: same three-step sequence as charge-long-form-episode-generation
  // (compile via compile-long-form-scenes -> explicit authorize -> kick
  // dispatch) — a rebuild is still real paid generation and must go through
  // the same authorization gate as any other charge, never bypass it.
  if (charge?.charged && !charge?.alreadyCharged) {
    const { data: project } = await admin.from("long_form_projects").select("current_visual_plan_version_id, current_visual_world_version_id").eq("id", projectId).maybeSingle();
    const { data: planRow } = await admin.from("long_form_visual_plan_versions").select("visual_plan").eq("id", project?.current_visual_plan_version_id).maybeSingle();
    const beatIds: string[] = (planRow?.visual_plan?.visualBeats ?? []).map((b: any) => b.id);
    const worldId = String(project?.current_visual_world_version_id ?? "");
    const generationRunId = String(charge.newGenerationRunId);
    const BATCH = 40;
    const compileAuthorizeAndDispatch = (async () => {
      for (let i = 0; i < beatIds.length; i += BATCH) {
        const batch = beatIds.slice(i, i + BATCH);
        await fetch(`${SUPABASE_URL}/functions/v1/compile-long-form-scenes`, {
          method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, beatIds: batch, ownerUserId: user.id, forceNewPlanVersion: true, generationRunId }),
        }).catch((e) => console.error("[rebuild-long-form-episode-generation] batch compile failed", e));
      }
      const authResult = await authorizeCompiledScenesForDispatch(admin, { visualWorldVersionId: worldId, beatIds, generationRunId }).catch((e) => {
        console.error("[rebuild-long-form-episode-generation] authorization failed", e);
        return null;
      });
      if (authResult?.skipped?.length) console.error("[rebuild-long-form-episode-generation] some beats could not be authorized:", authResult.skipped);
      if (authResult?.authorized?.length) {
        await fetch(`${SUPABASE_URL}/functions/v1/advance-long-form-scene-generation`, {
          method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json", "x-cron-secret": ADVANCE_SECRET },
          body: JSON.stringify({ visualWorldVersionId: worldId }),
        }).catch((e) => console.error("[rebuild-long-form-episode-generation] dispatch kick failed", e));
      }
    })().catch(() => {});
    const rt = (globalThis as any).EdgeRuntime;
    if (rt?.waitUntil) rt.waitUntil(compileAuthorizeAndDispatch); else await compileAuthorizeAndDispatch;
  }

  return ok(req, {
    ok: true, newGenerationRunId: charge?.newGenerationRunId, previousGenerationRunId: charge?.previousGenerationRunId,
    alreadyCharged: Boolean(charge?.alreadyCharged), creditsCharged: charge?.creditsCharged, breakdown: charge?.breakdown, tier: charge?.tier,
  });
});
