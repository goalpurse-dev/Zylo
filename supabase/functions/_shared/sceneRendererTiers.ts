// Long Form Generate workspace — model tier -> renderer resolution.
//
// ONE authoritative resolver (Part 13 of the Generate-workspace spec) so
// the UI's tier labels and the worker's actual dispatch tool_key can never
// drift apart the way Visual World's stale-renderer problem did. The
// user's selected tier changes ONLY the GENERATE/main renderer — it never
// touches EDIT (always Qwen Image Edit Plus) or the zero-cost strategies
// (REUSE/CROP/COMPOSITE/PROGRAMMATIC_GRAPHIC never dispatch to a provider
// at all, regardless of tier).
//
// V4 (2026-09-14 correction): the model actually manually verified against
// Runware is Seedream 5.0 LITE (bytedance:seedream@5.0-lite) — a prior pass
// registered this tier as "Seedream 5.0 Pro" without a real verified model
// behind it. Pro is a SEPARATE, not-yet-added model; do not conflate them.
export type SceneTier = "v2" | "v3" | "v4";
export type SceneRenderOperation = "generate" | "edit";

export const SCENE_TIER_PRIMARY_TOOL_KEY: Record<SceneTier, string> = {
  v2: "image:flux2.klein9bkv",
  v3: "image:kling.o3",
  v4: "image:seedream5lite",
};
export const SCENE_EDIT_TOOL_KEY = "image:qwen.image-edit-plus";

export const SCENE_TIER_PRIMARY_AIR_TAG: Record<SceneTier, string> = {
  v2: "runware:400@6",
  v3: "klingai:kling-image@o3",
  v4: "bytedance:seedream@5.0-lite",
};
export const SCENE_EDIT_AIR_TAG = "runware:108@22";

export const SCENE_TIER_LABELS: Record<SceneTier, { name: string; model: string; quality: string; description: string }> = {
  v2: { name: "V2", model: "FLUX.2 Klein 9B KV", quality: "Fast", description: "Lowest cost — fastest turnaround for drafting a full episode." },
  v3: { name: "V3", model: "Kling IMAGE O3", quality: "High Quality", description: "Recommended — the main Long Form scene renderer." },
  v4: { name: "V4", model: "Seedream 5.0 Lite", quality: "Maximum Quality", description: "Premium main renderer for the highest-fidelity episode." },
};

export function resolveLongFormSceneRenderer(args: { tier: SceneTier; operation: SceneRenderOperation }): { toolKey: string; renderModel: string } {
  const tier = SCENE_TIER_PRIMARY_TOOL_KEY[args.tier] ? args.tier : "v3";
  if (args.operation === "edit") {
    return { toolKey: SCENE_EDIT_TOOL_KEY, renderModel: SCENE_EDIT_AIR_TAG };
  }
  return { toolKey: SCENE_TIER_PRIMARY_TOOL_KEY[tier], renderModel: SCENE_TIER_PRIMARY_AIR_TAG[tier] };
}
