import { MODELS } from "./modelsConfig";
import { UI_MODEL_TO_TOOLKEY } from "./modelMapper";
import { DURATIONS } from "./durations";
import { RESOLUTIONS } from "./resolutions";
import { VIDEO_SIZES } from "./sizes";
import { createVideoJobSimple } from "../jobs";
import { buildVideoPrompt } from "./promptBuilder";

export async function generateVideoFromUI(params: {
  modelKey: keyof typeof MODELS;
  prompt: string;
  size: string;
  duration: string;
  resolution: string;
  refImages?: string[];
}) {
  const model = MODELS[params.modelKey];
  if (!model) throw new Error("Invalid model");

  const toolKey = UI_MODEL_TO_TOOLKEY[params.modelKey];
  if (!toolKey) throw new Error("No provider mapping");

  const durationMultiplier =
    DURATIONS[params.duration]?.multiplier ?? 1;

  const resolutionMultiplier =
    RESOLUTIONS[params.resolution]?.multiplier ?? 1;

  const baseCredits = model.credits;

  const totalCredits = Math.ceil(
    baseCredits * durationMultiplier * resolutionMultiplier
  );

  const sizeConfig =
    VIDEO_SIZES[params.size] ?? VIDEO_SIZES["16:9"];

  const is1080 = params.resolution === "1080p";

  const width = is1080
    ? sizeConfig.width1080.w
    : sizeConfig.width720.w;

  const height = is1080
    ? sizeConfig.width1080.h
    : sizeConfig.width720.h;

  const durationSec = Number(
    params.duration.replace("s", "")
  );

  const enhancedPrompt = buildVideoPrompt(params.prompt);

  return createVideoJobSimple({
    subject: enhancedPrompt,
    toolKey,
    width,
    height,
    durationSec,
    initImageUrls: params.refImages ?? [],
    calculatedCredits: totalCredits,
  });
}