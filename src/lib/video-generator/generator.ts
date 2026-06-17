import { MODELS } from "./modelsConfig";
import { UI_MODEL_TO_TOOLKEY } from "./modelMapper";
import { DURATIONS } from "./durations";
import { RESOLUTIONS } from "./resolutions";
import { VIDEO_SIZES } from "./sizes";
import { createVideoJobSimple } from "../jobs";
import { buildVideoPrompt } from "./promptBuilder";
import { calculateVideoCredits, calculateVideoCreditsRaw } from "./videoPricing";

export async function generateVideoFromUI(params: {
  modelKey: keyof typeof MODELS;
  prompt: string;
  size: string;
  duration: string;
  resolution: string;
  refImages?: string[];
  withSound?: boolean;
}) {
  const model = MODELS[params.modelKey];
  if (!model) throw new Error("Invalid model");

  const toolKey = UI_MODEL_TO_TOOLKEY[params.modelKey];
  if (!toolKey) throw new Error("No provider mapping");

  const isVeoLite  = toolKey === "video:veo31lite";
  const isKling    = toolKey.startsWith("klingai:");
  const isMiniMax  = toolKey.startsWith("minimax:");

  const durationSec = Number(params.duration.replace("s", ""));
  const totalCredits = calculateVideoCredits(toolKey, params.duration, params.resolution);

  const sizeConfig = VIDEO_SIZES[params.size] ?? VIDEO_SIZES["16:9"];
  const dimensions =
    params.resolution === "1080p"
      ? sizeConfig.width1080
      : params.resolution === "540p"
        ? sizeConfig.width540
        : sizeConfig.width720;

  const enhancedPrompt = buildVideoPrompt(params.prompt);

  const payload: any = {
    subject: enhancedPrompt,
    toolKey,
    durationSec,
    initImageUrls: params.refImages ?? [],
    calculatedCredits: totalCredits,
  };

  // ✅ VEO 3.1 LITE — resolution string + dims for text-to-video fallback
  if (isVeoLite) {
    payload.resolution = "720p";
    payload.width  = dimensions.w;
    payload.height = dimensions.h;
  }

  // ✅ KLING STANDARD — explicit width/height
  else if (isKling) {
    payload.width = dimensions.w;
    payload.height = dimensions.h;
  }

  // ✅ MINIMAX / HAILOU — resolution string only
  else if (isMiniMax) {
    payload.resolution = params.resolution === "1080p" ? "1080p" : "768p";
  }

  // ✅ DEFAULT — explicit width/height
  else {
    payload.width = dimensions.w;
    payload.height = dimensions.h;
    if (toolKey === "video:viduq3turbo") {
      payload.withSound = params.withSound ?? false;
    }
  }

  return createVideoJobSimple({
    ...payload,
    resolution: payload.resolution,
  });
}
