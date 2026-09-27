// Scene Generation's job-dispatch glue — mirrors visualWorldJobs.ts exactly
// (referenceJobPayload/referenceJobResult/ensureReferenceJob), reusing the
// SAME durable jobs/job-worker/runware-image pipeline rather than a second
// one. Renderer choice is NOT re-derived here: resolveLongFormSceneRenderer
// (sceneRendererTiers.ts) picks the toolKey from the scene's OWN persisted
// render_tier (never the project's current tier — a plan compiled under one
// tier must not silently reroute if the project's selection changes later),
// and enqueue_long_form_scene_job (the SQL RPC) is the true last-resort
// enforcement of GENERATE=<tier's primary>-zero-reference-images / EDIT=
// Qwen-exactly-one-reference-image — this file must never invent a second
// source of truth for either the tier mapping or that policy.
import { resolveLongFormSceneRenderer, type SceneTier } from "./sceneRendererTiers.ts";
import { resolveImageRenderDimensions, validateReferenceImageCount } from "./imageDimensionPolicy.ts";

// Long Form scenes are 16:9. The exact pixel size is NEVER a fixed
// constant here — real incident (2026-09-13/14, two live Runware 400s,
// taskUUID 54ce89c6-22bf-4c49-99bf-aac93084771d): a Qwen EDIT job was
// dispatched at 2720x1536 (Kling's own GENERATE size) because dimensions
// were picked once for "a Long Form scene" instead of being resolved from
// the ACTUAL destination model. Every dispatch below resolves dimensions
// FRESH from resolveImageRenderDimensions() using the model this specific
// job is actually going to, per operation, per tier — never inherited from
// a source scene, a prior job, or a different renderer's convention.
export const LONG_FORM_SCENE_ASPECT_RATIO = 16 / 9;

// referenceImageUrls: for GENERATE, the resolved canonical character/
// location reference image(s) this scene conditions on (Part 6/7 — a
// character reference SHEET is used AS REFERENCE MATERIAL, not just
// described in text; Kling faithfully following a supplied reference is
// exactly what this codebase's own evidence already showed — see the SQL
// enforcement's comment for why this differs from the character-SHEET
// regenerate policy). For EDIT, exactly one URL: the source scene being
// edited.
// promptSuffix: appended verbatim after the compiled scene prompt — used
// ONLY to carry SceneReferenceBundle's explicit "this is a reference board,
// not the output layout" instruction (sceneReferenceBundle.ts's
// bundlePromptInstruction) when a bundle was actually used for this
// dispatch. Never persisted back onto the plan's own image_prompt (that
// stays the canonical scene content); this job's own `prompt` column is
// the durable record of exactly what was sent for THIS attempt.
export function scenePromptJobPayload(scene: any, ownerId: string, prompt: string, planCode: string, tier: SceneTier, referenceImageUrls: string[] = [], now = new Date().toISOString(), promptSuffix: string | null = null, negativePrompt: string | null = null) {
  const isEdit = scene.render_strategy === "EDIT";
  const operation = isEdit ? "edit" : "generate";
  const { toolKey, renderModel } = resolveLongFormSceneRenderer({ tier, operation });
  if (isEdit && referenceImageUrls.length !== 1) throw new Error("EDIT_SOURCE_IMAGE_REQUIRED");
  const finalPrompt = promptSuffix ? `${prompt}\n\n${promptSuffix}` : prompt;
  // Reference-count and dimension policy are both keyed by the actual
  // Runware air tag (renderModel), never the Zyvo-internal tool_key — the
  // dimension/reference-count registry in imageDimensionPolicy.ts mirrors
  // providers.ts's airTag values exactly, since that's what Runware itself
  // actually receives and rejects/accepts.
  validateReferenceImageCount(renderModel, referenceImageUrls.length);
  // Pre-dispatch validation (Part 4/5): resolveImageRenderDimensions throws
  // ModelDimensionPolicyViolation before any provider call is even
  // possible if the destination model has no safe size for this operation
  // — the caller's try/catch (advance-long-form-scene-generation) marks
  // the scene failed with job_id still null, so retry_long_form_scene's
  // own "pre-dispatch failure" branch resumes it without burning a real
  // generation attempt once the policy itself is corrected.
  // requestedWidth/Height carries this codebase's own established "a Long
  // Form scene is 2720x1536" convention as the STARTING point, not a final
  // answer — resolveImageRenderDimensions only honors it when the
  // destination model has that EXACT size approved (Kling does; this is
  // what keeps GENERATE unchanged for the tier that's actually proven in
  // production). Every other model snaps to its OWN nearest-approved-ratio
  // size instead — Qwen (EDIT) and Klein 9B KV/Seedream (other GENERATE
  // tiers) never see 2720x1536 pass through despite the shared starting
  // point, because none of them have it in their own approved list.
  const { width, height } = resolveImageRenderDimensions({
    model: renderModel, operation, targetAspectRatio: LONG_FORM_SCENE_ASPECT_RATIO,
    requestedWidth: 2720, requestedHeight: 1536,
  });
  return {
    id: scene.id, user_id: ownerId, type: "image", tool_key: toolKey, project_id: null, prompt: finalPrompt,
    settings: { tool_key: toolKey, credits: 0, priceUSD: 0, creation_type: "photo", long_form_internal: true, long_form_scene_id: scene.id, long_form_scene_render_plan_id: scene.scene_render_plan_id },
    input: {
      tool: "image", subject: finalPrompt, style: null, creation_type: "photo", negative: negativePrompt, brand: { id: null, use_palette: false },
      init_image_url: null, width, height,
      ...(referenceImageUrls.length ? { ref_images: referenceImageUrls } : {}),
    },
    status: "queued", progress: 0, charge_credits: 0, charged: false, priority: 9,
    plan_code: planCode.toLowerCase(), provider: "runware", attempts: 0, max_attempts: 3, retry_after: now,
  };
}

export function sceneJobResult(job: any) {
  if (!["succeeded", "failed", "canceled"].includes(job?.status)) return null;
  const ready = job.status === "succeeded" && Boolean(job.result_url);
  const rawCost = job.output?.data?.[0]?.cost;
  const cost = rawCost == null ? null : Number(rawCost);
  return {
    status: ready ? "succeeded" : "failed",
    result_url: ready ? job.result_url : null,
    base_result_url: ready ? job.result_url : null,
    cost_usd: cost != null && Number.isFinite(cost) ? cost : null,
    generation_latency_ms: job.created_at && job.updated_at ? Math.max(0, Date.parse(job.updated_at) - Date.parse(job.created_at)) : null,
    lease_until: null, last_error_code: ready ? null : "PROVIDER_GENERATION_FAILED",
  };
}

export async function ensureSceneJob(admin: any, scene: any, ownerId: string, prompt: string, planCode: string, tier: SceneTier, referenceImageUrls: string[] = [], promptSuffix: string | null = null, negativePrompt: string | null = null) {
  const payload = scenePromptJobPayload(scene, ownerId, prompt, planCode, tier, referenceImageUrls, new Date().toISOString(), promptSuffix, negativePrompt);
  const { data, error } = await admin.rpc("enqueue_long_form_scene_job", { p_scene_id: scene.id, p_job: payload, p_claim_attempt: scene.claim_attempts });
  if (error) throw error;
  return data;
}
