import { MODELS } from "./modelsConfig";
import { UI_MODEL_TO_TOOLKEY } from "./modelMapper";
import { buildFinalImagePrompt } from "./promptBuilder";
import { createImageJobSimple } from "../jobs";

export async function generateImageFromUI(params: {
  modelKey: keyof typeof MODELS;
  prompt: string;
  style: string;
  size: string;
  refImages?: string[];
}) {
  const toolKey = UI_MODEL_TO_TOOLKEY[params.modelKey];
  if (!toolKey) throw new Error("Invalid model");

  const finalPrompt = buildFinalImagePrompt({
    userPrompt: params.prompt,
    style: params.style,
  });

  return createImageJobSimple({
    subject: finalPrompt,
    toolKey, // ✅ correct
    size: params.size,
    initImageUrls: params.refImages ?? [],
  });
}
