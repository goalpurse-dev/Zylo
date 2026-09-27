// deno-lint-ignore-file no-explicit-any
// escalate-long-form-scene-to-generate/index.ts
//
// Part 5 of the 2026-09-15 "content grounding + UX" pass: "if [an EDIT's
// promised visual change] is not happening, escalate it to NEW SCENE."
// retry-long-form-scene deliberately never rewrites render_strategy (a
// failed EDIT always retries as the same EDIT with the same weak
// instruction) — correct for a genuine provider hiccup, wrong for an EDIT
// whose own perceptual-hash QA signal (visualDeltaSatisfied, added in the
// prior QA-calibration pass) shows it came back a near-duplicate of its
// source. This compiles a REAL fresh GENERATE render plan for the same
// beat (canonical references re-resolved, a real compileScenePrompt call —
// mirrors start-long-form-scene-generation's own GENERATE branch exactly,
// since a scene escalated this way must be grounded exactly as well as one
// planned as GENERATE from the start) and hands the atomic charge + row
// creation to escalate_long_form_scene_to_generate (SQL).
//
// POST { sceneId }
// Returns { ok:true, sceneId: <new scene id>, creditsCharged }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";
import { getStylePresetForProject } from "../_shared/visualWorldStyle.ts";
import { requiredReferenceLookups, compileScenePrompt } from "../_shared/sceneRenderPlan.ts";
import { compileClaimRendererNotes } from "../_shared/narrationVisualContract.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADVANCE_SECRET = Deno.env.get("LONG_FORM_SCENE_ADVANCE_SECRET") ?? "";
const SELF_URL = `${SUPABASE_URL}/functions/v1/advance-long-form-scene-generation`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);

  const { user, authError } = await requireUser(req);
  if (!user) return err(req, authError || "Unauthorized", 401);

  const body = await req.json().catch(() => ({}));
  const sceneId = String(body?.sceneId ?? "").trim();
  if (!sceneId) return err(req, "Missing sceneId", 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: scene } = await admin.from("long_form_scenes").select("*").eq("id", sceneId).maybeSingle();
  if (!scene) return err(req, "Scene not found", 404);
  if (scene.render_strategy !== "EDIT") return err(req, "Only an EDIT scene can be escalated to a new scene", 400);

  const { data: plan } = await admin.from("long_form_scene_render_plans").select("*").eq("id", scene.scene_render_plan_id).maybeSingle();
  if (!plan) return err(req, "Render plan not found", 404);

  const { data: project } = await admin.from("long_form_projects").select("*").eq("id", plan.project_id).maybeSingle();
  if (!project || project.user_id !== user.id) return err(req, "Forbidden", 403);

  const { data: planRow } = await admin.from("long_form_visual_plan_versions").select("visual_plan").eq("id", plan.visual_plan_version_id).maybeSingle();
  const allBeats: any[] = planRow?.visual_plan?.visualBeats ?? [];
  const beat = allBeats.find((b) => b.id === plan.visual_beat_id);
  if (!beat) return err(req, "Could not find this scene's original beat data", 500);
  const entityRegistryById = new Map((planRow?.visual_plan?.entityRegistry ?? []).map((e: any) => [e.id, e]));

  const styleSpec = getStylePresetForProject(project.visual_style_preset);
  const director = plan.director_meta ?? {};

  // Re-resolve canonical references exactly like a real GENERATE compile —
  // never reuse the old EDIT's single source-frame reference, since the
  // whole point of escalating is a real, independently-grounded new setup.
  const lookups = requiredReferenceLookups(beat, entityRegistryById);
  const referenceAssetIds: string[] = [];
  const identityBlocks: string[] = [];
  for (const lookup of lookups) {
    const { data: resolved } = await admin.rpc("resolve_canonical_reference", { p_visual_world_version_id: scene.visual_world_version_id, p_entity_id: lookup.entityId, p_angle: lookup.angle });
    const row = Array.isArray(resolved) ? resolved[0] : resolved;
    if (!row) return err(req, `A canonical reference this scene needs (${lookup.entityId}) is not ready`, 409, { code: "CANONICAL_REFERENCE_NOT_READY" });
    referenceAssetIds.push(row.id);
    const name = entityRegistryById.get(lookup.entityId)?.name ?? lookup.entityId;
    identityBlocks.push(`${name}: present, canonical identity established via the supplied reference image.`);
  }
  if (beat.locationId) {
    const locationEntity = entityRegistryById.get(beat.locationId);
    if (locationEntity?.referenceNeeded) {
      const candidateAnchors = [director.cameraAnchor, ...(beat.__availableCameraAnchors ?? [])].filter(Boolean);
      for (const anchor of candidateAnchors.length ? candidateAnchors : [null]) {
        const { data: resolved } = await admin.rpc("resolve_canonical_reference", { p_visual_world_version_id: scene.visual_world_version_id, p_entity_id: beat.locationId, p_angle: anchor ?? "establishing" });
        const row = Array.isArray(resolved) ? resolved[0] : resolved;
        if (row) { referenceAssetIds.push(row.id); break; }
      }
    }
  }

  const locationEntity = beat.locationId ? entityRegistryById.get(beat.locationId) : null;
  // Part 10/2 (semantic-grounding pass): an escalated GENERATE must stay
  // grounded in the SAME semantic claim the failed EDIT was — escalating
  // away from a weak edit must never also silently drop "no phone"-style
  // requirements the original beat was planned against.
  let semanticNotes: string | null = null;
  if (plan.narration_claim_id && project.current_narration_contract_version_id) {
    const { data: contractRow } = await admin.from("long_form_narration_contract_versions").select("claims").eq("id", project.current_narration_contract_version_id).maybeSingle();
    const claim = (contractRow?.claims ?? []).find((c: any) => c.claimId === plan.narration_claim_id) ?? null;
    semanticNotes = compileClaimRendererNotes(claim);
  }

  const imagePrompt = compileScenePrompt(styleSpec, {
    sceneType: plan.scene_type, shotSize: beat.shotSize, cameraFraming: director.cameraFraming ?? "", focalSubject: director.focalSubject ?? "",
    informationToCommunicate: beat.informationToCommunicate ?? plan.communication_goal ?? "", characterIdentityBlocks: identityBlocks,
    locationDescription: locationEntity ? `${locationEntity.name}${director.cameraAnchor ? ` — camera anchor: ${director.cameraAnchor}` : ""}` : null,
    worldStateNotes: (plan.world_state_before ?? []).map((kv: any) => `${kv.key}: ${kv.value}`),
    continuityNote: director.continuityNote || null,
    factualConstraints: (plan.factual_constraints ?? []).map((c: any) => c.description ?? c),
    forbiddenElements: plan.forbidden_elements ?? [], reserveTextSafeArea: false,
    semanticNotes,
  });

  const { data: replacementId, error } = await admin.rpc("escalate_long_form_scene_to_generate", {
    p_scene_id: sceneId, p_user_id: user.id, p_image_prompt: imagePrompt, p_reference_asset_ids: referenceAssetIds,
  });
  if (error) {
    const message = error.message ?? "";
    const status = message.includes("FORBIDDEN") ? 403 : message.includes("SCENE_NOT_FOUND") ? 404
      : message.includes("GENERATION_PAUSED") ? 409 : message.includes("ALREADY_IN_PROGRESS") ? 409 : message.includes("NOT_AN_EDIT_SCENE") ? 400
      : message.includes("INSUFFICIENT_CREDITS") ? 402 : 500;
    const fallback = message.includes("GENERATION_PAUSED") ? "Generation is paused — continue generation to escalate this scene."
      : status === 409 ? "This scene is already generating." : status === 402 ? "Not enough credits to create a new scene." : "Could not escalate this scene";
    return err(req, fallback, status);
  }

  const { data: replacementScene } = await admin.from("long_form_scenes").select("credits_charged").eq("id", replacementId).maybeSingle();
  fetch(SELF_URL, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json", "x-cron-secret": ADVANCE_SECRET }, body: JSON.stringify({}) }).catch(() => {});
  return ok(req, { ok: true, sceneId: replacementId, creditsCharged: replacementScene?.credits_charged ?? 0 });
});
