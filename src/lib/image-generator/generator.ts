import { MODELS } from "./modelsConfig";
import { UI_MODEL_TO_TOOLKEY } from "./modelMapper";
import { buildFinalImagePrompt } from "./promptBuilder";
import { createImageJobSimple } from "../jobs";
import { IMAGE_STYLES } from "./styles";
import { IMAGE_SIZES } from "./sizes";

export async function generateImageFromUI(params: {
  modelKey: keyof typeof MODELS;
  prompt: string;
  style: string;
  size: string;
  refImages?: string[];

  // 🔥 NEW (optional, only Nano Banana uses)
  width?: number;
  height?: number;

   resolution?: string;
}) {
  const toolKey = UI_MODEL_TO_TOOLKEY[params.modelKey];
  if (!toolKey) throw new Error("Invalid model");

  // ✅ build prompt (unchanged)
  const finalPrompt = buildFinalImagePrompt({
    userPrompt: params.prompt,
    style: params.style,
  });

  // ✅ upload refs (unchanged)
  const uploadedRefs = params.refImages ?? [];

  // ✅ fallback size (old system)
  const sizeConfig =
    IMAGE_SIZES[params.size] ?? IMAGE_SIZES["1:1"];

  // 🔥 SAFE OVERRIDE (ONLY if provided)
  const finalWidth =
    typeof params.width === "number"
      ? params.width
      : sizeConfig.width;

  const finalHeight =
    typeof params.height === "number"
      ? params.height
      : sizeConfig.height;

  return createImageJobSimple({
    subject: finalPrompt,
    toolKey,
    initImageUrls: uploadedRefs,

    // ✅ now dynamic (works for BOTH old + Nano 2)
    width: finalWidth,
    height: finalHeight,

    // ✅ keep for UI/history
    size: `${finalWidth}x${finalHeight}`,

    resolution: params.resolution,

    providerHint: {
      engine: "runware",
      mode: "t2i",
      edgeFn: "runware-image",
      airTag: UI_MODEL_TO_TOOLKEY[params.modelKey] as any,
      settings: { quality: "high" },
    } as any,
  });
}
