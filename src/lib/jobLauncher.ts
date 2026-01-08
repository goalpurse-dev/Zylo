// src/lib/jobLauncher.ts
// Central launcher that computes credits (via pricing.ts) and creates the job.
// IMPORTANT: we only kick the worker for IMAGE jobs since the worker currently
// supports image generation only.

import {
  estimateCredits,
  type Tier,
  type JobType,
  type Resolution,
} from "./pricing";
import { createJob, runWorkerForJob } from "./jobs";
import { KEY_LINKS, type ToolKey } from "./providers";

type LaunchPayload = {
  type: JobType;
  prompt?: string | null;
  input?: Record<string, any> | null;
  project_id?: string | null;
  settings?: Record<string, any> | null; // should include tier/size/etc; we'll normalize it
};

function tierToDefaultToolKey(type: JobType, tier: Tier): ToolKey | undefined {
  // Only map defaults for image/text-to-image here.
  if (type === "image") {
    if (tier === "zylo-v2") return "t2i:v2";
    if (tier === "zylo-v3") return "t2i:v3";
    if (tier === "zylo-v4") return "t2i:v4";
  }
  return undefined;
}

export async function launchJob(payload: LaunchPayload) {
  const type = payload.type;

  // Normalize blobs
  const settingsIn = (payload.settings ?? {}) as Record<string, any>;
  const inputIn = (payload.input ?? {}) as Record<string, any>;
  const optIn = (settingsIn.options ?? inputIn.options ?? {}) as Record<string, any>;

  // ---- Read knobs (prefer settings, then options/input)
  let tier: Tier =
    (settingsIn.tier as Tier) ??
    (optIn.tier as Tier) ??
    "zylo-v2";

  const size: string =
    (settingsIn.size as string) ??
    (optIn.size as string) ??
    "1024x1024";

  const durationSec: number | undefined =
    Number(settingsIn.durationSec ?? optIn.durationSec ?? inputIn.durationSec ?? 0) || undefined;

  const resolution: Resolution =
    (settingsIn.resolution as Resolution) ??
    (optIn.resolution as Resolution) ??
    "720p";

  const variants: number | undefined =
    Number(settingsIn.variants ?? optIn.variants) || undefined;

  const upscale: boolean | undefined =
    (settingsIn.upscale ?? optIn.upscale) as boolean | undefined;

  // Optional: tool key from UI (e.g., "t2i:v4"). If not present, derive from tier for images.
  const toolKeyIn =
    (settingsIn.toolKey as ToolKey | undefined) ??
    (inputIn.toolKey as ToolKey | undefined) ??
    tierToDefaultToolKey(type, tier);

  // If UI selected a concrete provider via toolKey, align tier and pricing to it
  let priceOverride: number | undefined;
  if (toolKeyIn) {
    const link = KEY_LINKS[toolKeyIn];
    if (link) {
      // Map t2i keys to tier so size/quality-dependent logic stays consistent
      if (type === "image") {
        if (toolKeyIn === "t2i:v4") tier = "zylo-v4";
        else if (toolKeyIn === "t2i:v3") tier = "zylo-v3";
        else if (toolKeyIn === "t2i:v2") tier = "zylo-v2";
      }
      // Prefer explicit provider credits when defined
      if (typeof link.credits === "number" && link.credits > 0) {
        priceOverride = link.credits;
      }
    }
  }

  // ---- Compute credits using your centralized estimator
  let price = estimateCredits({
    type,
    tier,
    durationSec,
    resolution,
    size,
    variants,
  });
  if (priceOverride != null) price = priceOverride;

  // ---- Build final settings we want persisted on the job row
  const settingsOut: Record<string, any> = {
    ...settingsIn,
    tier,
    size,
    durationSec,
    resolution,
    variants,
    upscale,
    price, // <-- worker will read this to debit
  };

  // Attach provider hint if we have a toolKey that maps to a Runware link
  if (toolKeyIn) {
    const link = KEY_LINKS[toolKeyIn];
    if (link && link.provider === "runware") {
      // choose mode based on tool key
      const mode =
        toolKeyIn.startsWith("t2i")
          ? "t2i"
          : toolKeyIn.startsWith("image-upscale")
          ? "upscale"
          : toolKeyIn === "product-photo"
          ? "product"
          : "t2i";

      settingsOut.toolKey = toolKeyIn; // keep for analytics/UX
      settingsOut.provider_hint = {
        engine: "runware",
        mode,
        airTag: link.airTag,     // Runware AIR slug (gray pill)
        edgeFn: link.edgeFn,     // Edge Function route to call
        settings: {
          // any per-model defaults you may want to pass (optional)
          // width/height will be injected by the worker from `size`
        },
      };
    }
  }

  // Keep original input as-is (it already carries options/tool details from UI)
  const inputOut: Record<string, any> = { ...inputIn };

  // ---- Create the job
  const job = await createJob({
    type,
    input: inputOut,
    prompt: payload.prompt ?? null,
    project_id: payload.project_id ?? null,
    settings: settingsOut as any, // cast to JsonValue if your TS config complains
  });

  // ---- Kick the worker ONLY for image jobs
   if (type === "image" || type === "video") {
    await runWorkerForJob(job.id);
  }

  return job;
}
