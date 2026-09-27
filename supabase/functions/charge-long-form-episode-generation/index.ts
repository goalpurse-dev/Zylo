// deno-lint-ignore-file no-explicit-any
// charge-long-form-episode-generation/index.ts
//
// The "Generate Episode" server-side action (Generate workspace, Part 8 of
// the spec: verify readiness -> compute authoritative price -> verify
// balance -> charge exactly once -> begin scene jobs). NEVER trusts a
// client-supplied credit amount — charge_long_form_episode_generation (SQL)
// recomputes the price itself from the project's current VisualPlan and the
// selected tier before touching any balance. Idempotent by construction: a
// second call for a project that already has an active charge returns that
// SAME charge unchanged (see the partial unique index on
// long_form_episode_generation_charges), so a double-click or a reload-and-
// resubmit can never double-charge.
//
// This function is fully wired end-to-end (charge, then kick off
// compilation/dispatch for every beat in the current VisualPlan) but is
// NOT invoked anywhere in this codebase yet outside of a real user pressing
// the Generate Episode button — no code path in this session calls it.
//
// POST { projectId, tier }
// Returns { ok:true, alreadyCharged, creditsCharged, breakdown, tier }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";
import { loadEpisodePreflight } from "../_shared/episodePreflight.ts";
import { generationReadinessMessage, classifyVisualWorldReadinessReason, classifyPreflightErrors } from "../_shared/generationReadiness.ts";
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
  // 2026-09-22 chapter-by-chapter testing gate — opt-in, defaults false so
  // every existing caller keeps its current all-at-once behavior.
  const chapterGate = Boolean(body?.chapterGate);
  if (!projectId) return err(req, "Missing projectId", 400);
  if (!["v2", "v3", "v4"].includes(tier)) return err(req, "Invalid tier", 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  let preflight;
  try {
    preflight = await loadEpisodePreflight(admin, projectId, user.id, tier);
    if (!preflight.ok) {
      const reason = String(preflight.errors?.[0]?.reason ?? "COMPILE_FAILED");
      const beatsById = new Map((preflight.context?.plan?.visualBeats ?? []).map((b: any) => [b.id, b]));
      const issues = classifyPreflightErrors(preflight.errors ?? [], beatsById);
      return err(req, `${issues[0]?.message ?? generationReadinessMessage(reason)} No credits were charged.`, 422,
        { reason, issues, errors: preflight.errors?.slice(0, 5) ?? [] });
    }
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    if (raw.includes("PROJECT_NOT_FOUND")) return err(req, "Project not found", 404);
    const reason = raw.includes("GENERATE_PREFLIGHT_FAILED_VISUAL_WORLD:") ? raw.split(":").pop()! : raw;
    const issue = classifyVisualWorldReadinessReason(reason);
    return err(req, `${issue.message} No credits were charged.`, 422, { reason, issues: [issue] });
  }
  const { data: charge, error } = await admin.rpc("charge_long_form_episode_generation", {
    p_project_id: projectId, p_user_id: user.id, p_tier: tier,
    p_preflight: { planId: preflight.planId, worldId: preflight.worldId, contractId: preflight.contractId, plan: preflight.context.plan, beatIds: preflight.compiled.map((b: any) => b.beatId) },
    p_chapter_gate: chapterGate,
  });
  if (error) {
    const message = error.message ?? "";
    // 2026-09-19 billing-incident hotfix: STALE_CHARGE_BLOCKS_NEW_GENERATION
    // itself no longer fires for the real incident (a charge for a
    // superseded plan is now auto-superseded inside the RPC) — kept here
    // only as defense-in-depth with an honest message, never the generic
    // 500 catch-all, in case some other invariant ever raises it again.
    // 2026-09-19 "make the narration contract mandatory" V1 fix: the
    // Generate preflight (charge_long_form_episode_generation, task 1) —
    // never spend credits on a plan whose graphic beats are already known
    // to be uncompilable. Distinct 422 (not 500) so the UI can tell the
    // user this needs a replan, not a generic transient failure.
    const isPreflightFailure = message.includes("GENERATE_PREFLIGHT_FAILED");
    const status = message.includes("FORBIDDEN") ? 403 : message.includes("PROJECT_NOT_FOUND") ? 404
      : message.includes("STALE_CHARGE_BLOCKS_NEW_GENERATION") ? 409
      : isPreflightFailure ? 422
      : message.includes("NOT_READY") || message.includes("VISUAL_WORLD_NOT_READY") ? 400
      : message.includes("INSUFFICIENT_CREDITS") ? 402 : message.includes("INVALID_TIER") ? 400 : 500;
    const friendly = status === 402 ? "Not enough credits."
      : status === 422 ? "This episode's plan has visuals that can't be produced yet — please replan before generating."
      : status === 409 ? "An existing generation run needs to be resolved first — please refresh and try again."
      : status === 400 ? "This episode isn't ready to generate yet."
      : "Could not start episode generation";
    return err(req, friendly, status);
  }

  // Only kick off compilation/authorization/dispatch on a FRESH charge — a
  // replayed (alreadyCharged) request must never re-trigger generation a
  // second time.
  if (charge?.charged && !charge?.alreadyCharged) {
    // Real incident this fixes (Mars, 2026-09-14): the paid user paid for
    // 136 scenes but only 80 ever got a durable SceneRenderPlan/scene row —
    // this loop used to fire without EdgeRuntime.waitUntil(), so once
    // `return ok(...)` sent the response, the Deno isolate was free to be
    // torn down mid-loop (it got through exactly 2 of ceil(136/40)=4
    // batches — 80 beats — before being killed). waitUntil() keeps the
    // isolate alive until this background work genuinely finishes; the
    // caller's HTTP response is unaffected either way (it already returned
    // before this runs).
    //
    // 2026-09-22 "permanently separate PLAN/COMPILE from PAID GENERATION"
    // pass: this is now a real three-step sequence, not one self-chaining
    // call. compile-long-form-scenes ALSO self-chains through every batch on
    // its own, so a full episode still compiles to completion from one
    // trigger even if this loop is ever interrupted — but it never inserts
    // a claimable ('pending') row by itself (see that function). Only AFTER
    // every beat this charge covers has compiled does authorization run,
    // and only after that does dispatch get kicked — a charge can therefore
    // never leave scenes half-compiled-and-half-authorized: authorization
    // for a beat happens exactly once, after ITS OWN compile call returns.
    const beatIds: string[] = Array.isArray(charge?.beatIds) ? charge.beatIds.map(String) : [];
    const worldId = String(preflight.worldId);
    const generationRunId = String(charge?.generationRunId ?? "");
    const BATCH = 40;
    const compileAuthorizeAndDispatch = (async () => {
      for (let i = 0; i < beatIds.length; i += BATCH) {
        const batch = beatIds.slice(i, i + BATCH);
        await fetch(`${SUPABASE_URL}/functions/v1/compile-long-form-scenes`, {
          method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, beatIds: batch, ownerUserId: user.id, generationRunId, scopeBeatIdsOnly: chapterGate }),
        }).catch((e) => console.error("[charge-long-form-episode-generation] batch compile failed", e));
      }
      // Explicit authorization: move exactly this charge's beats from
      // 'awaiting_generation' to 'pending', scoped to this world + this
      // generation_run_id — never a global flip, never touching a beat
      // outside this charge's own scope (the full chapter, or the chapter-
      // gate-scoped subset when chapterGate is set — charge_long_form_
      // episode_generation already computed beatIds accordingly).
      const authResult = await authorizeCompiledScenesForDispatch(admin, { visualWorldVersionId: worldId, beatIds, generationRunId }).catch((e) => {
        console.error("[charge-long-form-episode-generation] authorization failed", e);
        return null;
      });
      if (authResult?.skipped?.length) console.error("[charge-long-form-episode-generation] some beats could not be authorized:", authResult.skipped);
      // Kick dispatch once — advance-long-form-scene-generation self-chains
      // through every claimable scene on its own; the standing recovery
      // cron covers this regardless if this kick is ever lost.
      if (authResult?.authorized?.length) {
        await fetch(`${SUPABASE_URL}/functions/v1/advance-long-form-scene-generation`, {
          method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json", "x-cron-secret": ADVANCE_SECRET },
          body: JSON.stringify({ visualWorldVersionId: worldId }),
        }).catch((e) => console.error("[charge-long-form-episode-generation] dispatch kick failed", e));
      }
    })().catch(() => {});
    const rt = (globalThis as any).EdgeRuntime;
    if (rt?.waitUntil) rt.waitUntil(compileAuthorizeAndDispatch); else await compileAuthorizeAndDispatch;
  }

  return ok(req, { ok: true, alreadyCharged: Boolean(charge?.alreadyCharged), creditsCharged: charge?.creditsCharged, breakdown: charge?.breakdown, tier: charge?.tier, scope: charge?.scope, chapterId: charge?.chapterId, chapterIndex: charge?.chapterIndex, generationRunId: charge?.generationRunId });
});
