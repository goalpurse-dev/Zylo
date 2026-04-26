import { MODELS } from "./modelsConfig";
import { UI_MODEL_TO_TOOLKEY } from "./modelMapper";
import { DURATIONS } from "./durations";
import { RESOLUTIONS } from "./resolutions";
import { VIDEO_SIZES } from "./sizes";
import { createVideoJobSimple } from "../jobs";
import { buildVideoPrompt } from "./promptBuilder";
import { calculateVideoCredits, calculateVideoCreditsRaw } from "./videoPricing";

// Kling Pro: fixed dims per aspect ratio (1080p for 16:9 & 9:16, 1440p for 1:1)
const KLING_PRO_DIMS: Record<string, { w: number; h: number }> = {
  "16:9": { w: 1920, h: 1080 },
  "9:16": { w: 1080, h: 1920 },
  "1:1": { w: 1440, h: 1440 },
};

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

  const isKlingPro = toolKey === "video:klingpro";
  const isKling = !isKlingPro && toolKey.startsWith("klingai:");
  const isMiniMax = toolKey.startsWith("minimax:");

  const durationSec = Number(params.duration.replace("s", ""));

  const totalCredits = isKlingPro
    ? calculateVideoCreditsRaw(toolKey, durationSec, params.withSound ?? false)
    : calculateVideoCredits(toolKey, params.duration, params.resolution);

  const sizeConfig = VIDEO_SIZES[params.size] ?? VIDEO_SIZES["16:9"];
  const is1080 = params.resolution === "1080p";
  const width = is1080 ? sizeConfig.width1080.w : sizeConfig.width720.w;
  const height = is1080 ? sizeConfig.width1080.h : sizeConfig.width720.h;

  const enhancedPrompt = buildVideoPrompt(params.prompt);

  const payload: any = {
    subject: enhancedPrompt,
    toolKey,
    durationSec,
    initImageUrls: params.refImages ?? [],
    calculatedCredits: totalCredits,
  };

  // ✅ KLING PRO — fixed dims by aspect ratio + sound flag
  if (isKlingPro) {
    const dims = KLING_PRO_DIMS[params.size] ?? KLING_PRO_DIMS["16:9"];
    payload.width = dims.w;
    payload.height = dims.h;
    payload.withSound = params.withSound ?? false;
  }

  // ✅ KLING STANDARD — explicit width/height
  else if (isKling) {
    payload.width = width;
    payload.height = height;
  }

  // ✅ MINIMAX / HAILOU
  // Runware requires "768p" or "1080p", not "720p"
  else if (isMiniMax) {
    payload.resolution = params.resolution === "1080p" ? "1080p" : "768p";
  }

  // ✅ DEFAULT — explicit width/height
  else {
    payload.width = width;
    payload.height = height;
  }

  return createVideoJobSimple({
    ...payload,
    resolution: payload.resolution,
  });
}