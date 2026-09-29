// deno-lint-ignore-file no-explicit-any
// stickman/sceneImagePost.ts — standard post-render step for every scene
// image quality tier (Phase 4a).
//
// render (tier model) -> upscale (Runware Real-ESRGAN, 2x) -> resize +
// center-crop in code to exactly 1920x1080 (16:9). The final stored scene
// image is the 1920x1080 version; the original render is kept too.
// Config-driven per tier (model id, factor, on/off). Runware calls are
// injected, so the step is testable offline.
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";

export type SceneTier = "V2" | "V3" | "V4";
export type UpscaleConfig = { enabled: boolean; model: string; factor: 2 | 4 };
export type PostProcessConfig = { target: { width: number; height: number }; jpegQuality: number; upscale: Record<SceneTier, UpscaleConfig> };

// Real-ESRGAN on Runware: taskType "upscale", model runware:504@1, factor 2
// (~$0.0006/image, ~4 s). Applied to every tier.
export const DEFAULT_POSTPROCESS: PostProcessConfig = {
  target: { width: 1920, height: 1080 },
  jpegQuality: 92,
  upscale: {
    V2: { enabled: true, model: "runware:504@1", factor: 2 },
    V3: { enabled: true, model: "runware:504@1", factor: 2 },
    V4: { enabled: true, model: "runware:504@1", factor: 2 },
  },
};

// Cover-fit: scale so the image covers the target, then center-crop the
// overflow. 1376x768 -> 2752x1536 -> 1935x1080 -> crop 15 px of width;
// Recraft 1344x768 -> 2688x1536 -> 1920x1097 -> crop 17 px of height.
export function coverFit(srcW: number, srcH: number, dstW: number, dstH: number) {
  const scale = Math.max(dstW / srcW, dstH / srcH);
  const w = Math.round(srcW * scale);
  const h = Math.round(srcH * scale);
  return { scale, resizeW: w, resizeH: h, cropX: Math.floor((w - dstW) / 2), cropY: Math.floor((h - dstH) / 2), dstW, dstH };
}

export async function toTarget(bytes: Uint8Array, target = DEFAULT_POSTPROCESS.target, quality = DEFAULT_POSTPROCESS.jpegQuality): Promise<{ bytes: Uint8Array; fit: ReturnType<typeof coverFit>; srcW: number; srcH: number }> {
  const img = await Image.decode(bytes);
  const fit = coverFit(img.width, img.height, target.width, target.height);
  img.resize(fit.resizeW, fit.resizeH);
  img.crop(fit.cropX, fit.cropY, fit.dstW, fit.dstH);
  return { bytes: await img.encodeJPEG(quality), fit, srcW: fit.resizeW / fit.scale, srcH: fit.resizeH / fit.scale };
}

export type UpscaleCall = (task: { taskType: "upscale"; model: string; upscaleFactor: number; inputs: { image: string }; outputType: "URL"; outputFormat: "JPG"; outputQuality: number }) => Promise<{ imageURL: string; cost: number | null; latencyMs: number }>;

export type PostProcessResult = {
  original: { url: string };
  upscaled: { url: string; cost: number | null; latencyMs: number; model: string; factor: number } | null;
  final: { bytes: Uint8Array; width: number; height: number; fit: ReturnType<typeof coverFit> };
  // Phase 5c: the full-res upscaled source (e.g. 2752x1536), KEPT — the 1440p
  // master crops from it; 5a/5b only kept the 1920x1080 downscale.
  master: { bytes: Uint8Array } | null;
};

// The standard step: optional upscale (per tier), then exact 1920x1080.
export async function postProcessSceneImage(args: { originalUrl: string; tier: SceneTier; config?: PostProcessConfig; upscale: UpscaleCall; fetchBytes: (url: string) => Promise<Uint8Array> }): Promise<PostProcessResult> {
  const config = args.config ?? DEFAULT_POSTPROCESS;
  const up = config.upscale[args.tier];
  let sourceUrl = args.originalUrl;
  let upscaled: PostProcessResult["upscaled"] = null;
  if (up?.enabled) {
    const r = await args.upscale({ taskType: "upscale", model: up.model, upscaleFactor: up.factor, inputs: { image: args.originalUrl }, outputType: "URL", outputFormat: "JPG", outputQuality: 95 });
    upscaled = { url: r.imageURL, cost: r.cost, latencyMs: r.latencyMs, model: up.model, factor: up.factor };
    sourceUrl = r.imageURL;
  }
  const sourceBytes = await args.fetchBytes(sourceUrl);
  const out = await toTarget(sourceBytes, config.target, config.jpegQuality);
  return { original: { url: args.originalUrl }, upscaled, final: { bytes: out.bytes, width: config.target.width, height: config.target.height, fit: out.fit }, master: upscaled ? { bytes: sourceBytes } : null };
}
