import { MODELS } from "./modelsConfig";
import { UI_MODEL_TO_TOOLKEY } from "./modelMapper";
import { VIDEO_SIZES } from "./sizes";
import { createVideoJobSimple } from "../jobs";
import { buildVideoPrompt } from "./promptBuilder";

export type VideoJobParams = {
  modelKey: keyof typeof MODELS;
  size: string;
  /** Either a key like "6s" or a raw number string like "8" (from slider) */
  duration: string;
  resolution: string;
  withSound?: boolean;
};

/**
 * The priced shape of the job generateVideoFromUI creates: tool_key plus the
 * inputs compute_tool_price reads. The UI quotes this exact shape, so the
 * price shown is the price the jobs trigger charges.
 */
export function videoJobShape(params: VideoJobParams) {
  const model = MODELS[params.modelKey];
  if (!model) throw new Error("Invalid model");

  const toolKey = UI_MODEL_TO_TOOLKEY[params.modelKey];
  if (!toolKey) throw new Error("No provider mapping");

  const isVeoLite       = toolKey === "video:veo31lite";
  const isKling         = toolKey.startsWith("klingai:");
  const isMiniMax       = toolKey.startsWith("minimax:");
  const isSeedanceSlider = toolKey === "video:seedance15pro" || toolKey === "video:seedance20fast";

  // Support both "6s" keys and raw numeric strings from the duration slider
  const durationSec = params.duration.endsWith("s")
    ? Number(params.duration.slice(0, -1))
    : Number(params.duration);

  const sizeConfig = VIDEO_SIZES[params.size] ?? VIDEO_SIZES["16:9"];
  const dimensions =
    params.resolution === "1080p"
      ? sizeConfig.width1080
      : params.resolution === "540p"
        ? sizeConfig.width540
        : sizeConfig.width720;

  const payload: any = {
    toolKey,
    durationSec,
    withSound:         params.withSound ?? false,
  };

  // ✅ SEEDANCE (1.5 Pro / 2.0 Fast) — explicit width/height at 720p
  if (isSeedanceSlider) {
    payload.width  = dimensions.w;
    payload.height = dimensions.h;
  }

  // ✅ VEO 3.1 LITE — resolution string only (width/height ignored by Runware)
  else if (isVeoLite) {
    payload.resolution = "720p";
    payload.width  = dimensions.w;
    payload.height = dimensions.h;
  }

  // ✅ KLING — explicit width/height
  else if (isKling) {
    payload.width = dimensions.w;
    payload.height = dimensions.h;
  }

  // ✅ MINIMAX — resolution string only
  else if (isMiniMax) {
    payload.resolution = params.resolution === "1080p" ? "1080p" : "768p";
  }

  // ✅ DEFAULT
  else {
    payload.width = dimensions.w;
    payload.height = dimensions.h;
  }

  return payload as { toolKey: string; durationSec: number; withSound: boolean; width?: number; height?: number; resolution?: string };
}

export async function generateVideoFromUI(params: VideoJobParams & {
  prompt: string;
  refImages?: string[];
}) {
  const shape = videoJobShape(params);
  return createVideoJobSimple({
    ...shape,
    subject:       buildVideoPrompt(params.prompt),
    initImageUrls: params.refImages ?? [],
    resolution:    shape.resolution,
  } as any);
}
