import { MODELS } from "./modelsConfig";
import { UI_MODEL_TO_TOOLKEY } from "./modelMapper";
import { buildFinalImagePrompt } from "./promptBuilder";
import { createImageJobSimple } from "../jobs";
import { uploadBlobRefsToPublicUrls } from "./uploadRefs"; // 👈 REQUIRED
import { IMAGE_STYLES } from "./styles";
import { IMAGE_SIZES } from "./sizes";


export async function generateImageFromUI(params: {
  modelKey: keyof typeof MODELS;
  prompt: string;
  style: string;
  size: string;
  refImages?: string[];
}) {
  const toolKey = UI_MODEL_TO_TOOLKEY[params.modelKey];
  const styleConfig = IMAGE_STYLES[params.style];
  if (!toolKey) throw new Error("Invalid model");
  

  const finalPrompt = buildFinalImagePrompt({
    userPrompt: params.prompt,
    style: params.style,
  });

  // ✅ convert blob → public URLs
  const uploadedRefs = params.refImages?.length
    ? await uploadBlobRefsToPublicUrls(params.refImages)
    : [];

const sizeConfig = IMAGE_SIZES[params.size] ?? IMAGE_SIZES["1:1"];

return createImageJobSimple({
  subject: finalPrompt,
  toolKey,
  initImageUrls: uploadedRefs,

  // ✅ either pass width/height
  width: sizeConfig.width,
  height: sizeConfig.height,

  // ✅ and optionally keep size string for UI/history
  size: `${sizeConfig.width}x${sizeConfig.height}`,

  providerHint: {
    engine: "runware",
    mode: "t2i",
    edgeFn: "runware-image", // or leave if your getProviderLink handles it
    airTag: UI_MODEL_TO_TOOLKEY[params.modelKey] as any, // (you already have toolKey)
    settings: { quality: "high" },
  } as any,
});





}
