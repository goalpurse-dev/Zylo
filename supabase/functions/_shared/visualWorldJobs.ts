import { referenceRendererPolicy, resolveAssetRoleKey, resolveReferenceOperationRenderer } from "./referenceRendererPolicy.js";
import { DERIVED_SHEET_ROLES, SHEET_CONTRACT_VERSION } from "./characterSheetContract.js";
import { resolveImageRenderDimensions } from "./imageDimensionPolicy.ts";

// referenceImageUrl accepts either a single URL (existing callers, kept
// backward compatible) or an array of up to 3 URLs — Qwen Image Edit Plus's
// verified referenceImages range (runware.ai/docs/models/alibaba-qwen-
// image-edit-plus: "min items: 1, max items: 3") — so a geometry edit can
// condition on both the Identity Master and its Face Detail crop (Part 6).
export function referenceJobPayload(asset: any, world: any, project: any, prompt: string, planCode: string, referenceImageUrl?: string | string[] | null, now = new Date().toISOString()) {
  const policy = referenceRendererPolicy(asset);
  if (policy.method === "CROP") throw new Error("CROP_ROLE_MUST_NOT_DISPATCH_JOB");
  const referenceImageUrls = referenceImageUrl == null ? [] : Array.isArray(referenceImageUrl) ? referenceImageUrl.filter(Boolean) : [referenceImageUrl];
  if (policy.requiresIdentityAnchor && (referenceImageUrls.length === 0 || !asset.input_reference_asset_ids?.length)) throw new Error("ACCEPTED_IDENTITY_ANCHOR_REQUIRED");
  // Part 3 of the 2026-09-13 routing-contract fix: resolve the renderer from
  // the OPERATION (edit_instruction present == Edit Reference; otherwise a
  // fresh Generate/Regenerate), not merely from the role's own base policy —
  // see resolveReferenceOperationRenderer's own comment for the real
  // incident (Edit Reference on a character sheet silently used Klein 4B
  // instead of Qwen) this closes, and the guardrail it now enforces before
  // every reference job is ever created.
  const operation = asset.edit_instruction ? "edit" : "generate";
  const resolvedRenderer = resolveReferenceOperationRenderer({ operation, assetRole: resolveAssetRoleKey(asset), referenceImageCount: referenceImageUrls.length });
  const toolKey = resolvedRenderer.toolKey;
  if (DERIVED_SHEET_ROLES.has(asset.angle_or_view) && (referenceImageUrls.length !== 1 || asset.input_reference_asset_ids?.length !== 1)) throw new Error("SHEET_REQUIRES_EXACTLY_ONE_IDENTITY");
  // Defense-in-depth (Part 7 dispatch-path audit, 2026-09-14): unlike Scene
  // Generation's real incident, Visual World's width/height was NEVER
  // inherited from a source/sibling operation — each role's own policy
  // object (referenceRendererPolicy.js) already hardcodes its own fixed
  // width/height, so there is no leak path here today. This validates that
  // fixed value against the SAME central dimension policy Scene Generation
  // now uses, so a future edit to a role's policy.width/height can never
  // silently drift into an invalid provider payload again.
  const toolKeyToAirTag: Record<string, string> = {
    "image:kling.o3": "klingai:kling-image@o3",
    "image:flux2.klein9bkv": "runware:400@6",
    "image:flux.base": "runware:400@4",
    "image:qwen.image-edit-plus": "runware:108@22",
    "image:seedream5pro": "bytedance:seedream@5.0-pro",
  };
  const { width, height } = resolveImageRenderDimensions({
    model: toolKeyToAirTag[toolKey] ?? toolKey, operation,
    requestedWidth: policy.width ?? 1024, requestedHeight: policy.height ?? 1024,
  });
  return {
    id: asset.id, user_id: project.user_id, type: "image", tool_key: toolKey, project_id: null, prompt,
    settings: { tool_key: toolKey, credits: 0, priceUSD: 0, creation_type: "photo", long_form_internal: true, long_form_reference_asset_id: asset.id, long_form_reference_role: asset.angle_or_view, long_form_reference_entity_id: asset.entity_id, reference_contract_version: SHEET_CONTRACT_VERSION },
    input: {
      tool: "image", subject: prompt, style: null, creation_type: "photo", negative: null, brand: { id: null, use_palette: false },
      init_image_url: null, width, height,
      // job-worker forwards this verbatim as runware-image's `referenceImages`
      // (see materializeReferencePayload's REFERENCE_KEYS — "ref_images"
      // normalizes to "refimages", already in that set) — an already-public
      // URL (this Visual World's own prior successful asset) needs no
      // storage-reference resolution, just the accessibility check every
      // reference URL gets regardless of source.
      ...(referenceImageUrls.length ? { ref_images: referenceImageUrls } : {}),
    },
    status: "queued", progress: 0, charge_credits: 0, charged: false, priority: 9,
    plan_code: planCode.toLowerCase(), provider: "runware", attempts: 0, max_attempts: policy.requiresIdentityAnchor ? 1 : 3, retry_after: now,
  };
}

export function referenceJobResult(job: any) {
  if (!["succeeded", "failed", "canceled"].includes(job?.status)) return null;
  const ready = job.status === "succeeded" && Boolean(job.result_url);
  const rawCost = job.output?.data?.[0]?.cost;
  const cost = rawCost == null ? null : Number(rawCost);
  return {
    status: ready ? "succeeded" : "failed", result_url: ready ? job.result_url : null,
    cost_usd: cost != null && Number.isFinite(cost) ? cost : null,
    generation_latency_ms: job.created_at && job.updated_at ? Math.max(0, Date.parse(job.updated_at) - Date.parse(job.created_at)) : null,
    lease_until: null, last_error_code: ready ? null : "PROVIDER_GENERATION_FAILED",
  };
}

export async function ensureReferenceJob(admin: any, asset: any, world: any, project: any, prompt: string, planCode: string, referenceImageUrl?: string | null) {
  const payload = referenceJobPayload(asset, world, project, prompt, planCode, referenceImageUrl);
  // Atomic SQL transaction links the immutable prompt and job before either
  // can become visible to job-worker. Repeating after a lost response is safe.
  const { data, error } = await admin.rpc("enqueue_long_form_reference_job", { p_asset_id: asset.id, p_job: payload, p_claim_attempt: asset.claim_attempts });
  if (error) throw error;
  return data;
}
