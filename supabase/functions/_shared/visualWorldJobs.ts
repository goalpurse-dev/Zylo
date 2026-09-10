import { referenceRendererPolicy } from "./referenceRendererPolicy.js";

export function referenceJobPayload(asset: any, world: any, project: any, prompt: string, planCode: string, referenceImageUrl?: string | null, now = new Date().toISOString()) {
  const policy = referenceRendererPolicy(asset);
  if (policy.requiresIdentityAnchor && (!referenceImageUrl || asset.input_reference_asset_ids?.length !== 1)) throw new Error("ACCEPTED_IDENTITY_ANCHOR_REQUIRED");
  const toolKey = policy.toolKey;
  return {
    id: asset.id, user_id: project.user_id, type: "image", tool_key: toolKey, project_id: null, prompt,
    settings: { tool_key: toolKey, credits: 0, priceUSD: 0, creation_type: "photo", long_form_internal: true, long_form_reference_asset_id: asset.id },
    input: {
      tool: "image", subject: prompt, style: null, creation_type: "photo", negative: null, brand: { id: null, use_palette: false },
      init_image_url: null, width: 1024, height: 1024,
      // job-worker forwards this verbatim as runware-image's `referenceImages`
      // (see materializeReferencePayload's REFERENCE_KEYS — "ref_images"
      // normalizes to "refimages", already in that set) — an already-public
      // URL (this Visual World's own prior successful asset) needs no
      // storage-reference resolution, just the accessibility check every
      // reference URL gets regardless of source.
      ...(referenceImageUrl ? { ref_images: [referenceImageUrl] } : {}),
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
