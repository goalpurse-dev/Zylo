// Pure payload/reconciliation logic, shared with mocked lifecycle tests.
// One provider job per independently durable asset, never per browser view.
//
// Renderer allowlist (Part 3/Part 4 of the FLUX.2 9B A/B milestone): exactly
// two verified, already-registered Runware entries. Both use the same
// 1024x1024 request shape for a fair, apples-to-apples cost/latency/quality
// comparison — 9B's real capability (up to 2048px, reference-image input)
// is intentionally not exercised yet, this is a plain text-to-image test.
const ALLOWED_REFERENCE_RENDERER_TOOL_KEYS = ["image:flux.base", "image:flux2.klein9bkv"];

export function referenceJobPayload(asset: any, world: any, project: any, prompt: string, planCode: string, now = new Date().toISOString()) {
  const toolKey = world.renderer_tool_key ?? "image:flux.base";
  if (!ALLOWED_REFERENCE_RENDERER_TOOL_KEYS.includes(toolKey)) throw new Error("Unsupported reference renderer");
  return {
    id: asset.id, user_id: project.user_id, type: "image", tool_key: toolKey, project_id: null, prompt,
    settings: { tool_key: toolKey, credits: 0, priceUSD: 0, creation_type: "photo", long_form_internal: true, long_form_reference_asset_id: asset.id },
    input: { tool: "image", subject: prompt, style: null, creation_type: "photo", negative: null, brand: { id: null, use_palette: false }, init_image_url: null, width: 1024, height: 1024 },
    status: "queued", progress: 0, charge_credits: 0, charged: false, priority: 9,
    plan_code: planCode.toLowerCase(), provider: "runware", attempts: 0, max_attempts: 3, retry_after: now,
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

export async function ensureReferenceJob(admin: any, asset: any, world: any, project: any, prompt: string, planCode: string) {
  const payload = referenceJobPayload(asset, world, project, prompt, planCode);
  // Atomic SQL transaction links the immutable prompt and job before either
  // can become visible to job-worker. Repeating after a lost response is safe.
  const { data, error } = await admin.rpc("enqueue_long_form_reference_job", { p_asset_id: asset.id, p_job: payload, p_claim_attempt: asset.claim_attempts });
  if (error) throw error;
  return data;
}
