// deno-lint-ignore-file no-explicit-any
// retry-long-form-scene/index.ts — "Regenerate" / "Try Another Layout".
// Retries the scene's OWN existing render_strategy (GENERATE stays GENERATE
// at the tier's primary renderer; EDIT stays EDIT at Qwen) — enforced at the
// SQL layer by retry_long_form_scene, which never rewrites render_strategy.
// A pre-dispatch failure (job never created) resumes the SAME row for free —
// nothing new is being created, so no new charge; a genuine provider
// failure or QA rejection creates a NEW scene row instead, which
// retry_long_form_scene charges atomically (server-authoritative price via
// estimate_scene_operation_credits' same underlying tier functions) before
// creating it. Double-click safe structurally: a second call finds the
// replacement row already exists and returns it unchanged, never re-billing.
//
// 2026-09-17 "fix PROGRAMMATIC_GRAPHIC" pass (Parts 5/6/12): a
// PROGRAMMATIC_GRAPHIC scene takes a COMPLETELY different path here —
// deterministic graphics have zero provider cost, so "Regenerate" for one
// must never charge credits, and it must produce a genuinely NEW visual
// TREATMENT (a different icon/composition for the SAME fact), never just
// redraw the identical stored GraphicSpec. A legacy (pre-this-pass) or null
// spec gets a real upgrade attempt using the plan's own pinned contract
// claim, never a redraw of the old giant-text card — and never a fabricated
// one if no trustworthy claim exists (GRAPHIC_REPLAN_REQUIRED instead).
// Historical rows are never mutated either way — this always creates a NEW
// scene + render-plan-version row, exactly like the GENERATE/EDIT path.
//
// POST { sceneId }
// Returns { ok: true, sceneId: <the id to now poll/display>, creditsCharged: <0 for a free/graphic action, tier price otherwise> }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";
import { compileGraphicSpec, validatePinnedClaim, selectNextVariant, variantCountFor, resolveGraphicClaim } from "../_shared/graphicSpec.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SELF_URL = `${SUPABASE_URL}/functions/v1/advance-long-form-scene-generation`;
const ADVANCE_SECRET = Deno.env.get("LONG_FORM_SCENE_ADVANCE_SECRET") ?? "";

async function kickWorker() {
  fetch(SELF_URL, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json", "x-cron-secret": ADVANCE_SECRET }, body: JSON.stringify({}) }).catch(() => {});
}

// 2026-09-19: resolveGraphicClaim now lives in _shared/graphicSpec.ts,
// shared with advance-long-form-scene-generation's automatic zero-cost
// repair dispatch (Section 6) — moved verbatim, not reimplemented, so the
// manual "Try Another Layout" path and the automatic one always agree on
// which claim covers a given beat.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);

  const { user, authError } = await requireUser(req);
  if (!user) return err(req, authError || "Unauthorized", 401);

  const body = await req.json().catch(() => ({}));
  const sceneId = String(body?.sceneId ?? "").trim();
  if (!sceneId) return err(req, "Missing sceneId", 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: scene } = await admin.from("long_form_scenes").select("id, render_strategy, scene_render_plan_id").eq("id", sceneId).maybeSingle();
  if (!scene) return err(req, "Could not retry this scene", 404);

  if (scene.render_strategy === "PROGRAMMATIC_GRAPHIC") {
    const { data: plan } = await admin.from("long_form_scene_render_plans").select("*").eq("id", scene.scene_render_plan_id).maybeSingle();
    if (!plan) return err(req, "Could not retry this scene", 404);

    const resolved = await resolveGraphicClaim(admin, plan);
    if ("error" in resolved) {
      // Never surface internal vocabulary to the user (Part 13) — the
      // underlying reason is logged server-side only.
      console.error("[retry-long-form-scene] graphic upgrade blocked:", sceneId, resolved.error);
      return err(req, "This graphic can't be redrawn automatically yet — try regenerating the scene from the storyboard instead.", 422);
    }

    const existingSpec = plan.overlay_spec;
    const isStructured = existingSpec && typeof existingSpec === "object" && existingSpec.version === 1 && typeof existingSpec.template === "string";
    const variantIndex = isStructured ? selectNextVariant(existingSpec.variantIndex ?? 0, variantCountFor(existingSpec)) : 0;

    const compileResult = compileGraphicSpec(resolved.claim, { theme: "light", variantIndex, contractVersionId: resolved.contractVersionId, beatFacts: plan.composition?.beatFacts ?? null });
    if (!compileResult.ok) {
      console.error("[retry-long-form-scene] graphic upgrade could not compile a spec:", sceneId, compileResult.reason);
      return err(req, "This graphic can't be redrawn automatically yet — try regenerating the scene from the storyboard instead.", 422);
    }

    const { data: replacementId, error } = await admin.rpc("regenerate_long_form_graphic", {
      p_scene_id: sceneId, p_user_id: user.id, p_overlay_spec: compileResult.spec, p_narration_contract_version_id: resolved.contractVersionId,
    });
    if (error) {
      const message = error.message ?? "";
      const status = message.includes("FORBIDDEN") ? 403 : message.includes("SCENE_NOT_FOUND") ? 404
        : message.includes("ALREADY_IN_PROGRESS") ? 409 : message.includes("NOT_A_GRAPHIC_SCENE") ? 400 : 500;
      return err(req, status === 409 ? "This scene is already generating." : "Could not retry this scene", status);
    }
    await kickWorker();
    return ok(req, { ok: true, sceneId: replacementId, creditsCharged: 0 });
  }

  const { data: replacementId, error } = await admin.rpc("retry_long_form_scene", { p_scene_id: sceneId, p_user_id: user.id });
  if (error) {
    const message = error.message ?? "";
    const status = message.includes("FORBIDDEN") ? 403 : message.includes("SCENE_NOT_FOUND") ? 404
      : message.includes("GENERATION_PAUSED") ? 409 : message.includes("ALREADY_IN_PROGRESS") ? 409 : message.includes("INSUFFICIENT_CREDITS") ? 402 : 500;
    const fallback = message.includes("GENERATION_PAUSED") ? "Generation is paused — continue generation to retry this scene."
      : status === 409 ? "This scene is already generating." : status === 402 ? "Not enough credits to retry this scene." : "Could not retry this scene";
    return err(req, fallback, status);
  }
  const { data: replacementScene } = await admin.from("long_form_scenes").select("credits_charged").eq("id", replacementId).maybeSingle();
  await kickWorker();
  return ok(req, { ok: true, sceneId: replacementId, creditsCharged: replacementScene?.credits_charged ?? 0 });
});
