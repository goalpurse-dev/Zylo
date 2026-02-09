import { MODELS } from "./modelsConfig";
import { UI_MODEL_TO_TOOLKEY } from "./modelMapper";
import { buildFinalImagePrompt } from "./promptBuilder";
import { createImageJobSimple } from "../jobs";
import { uploadBlobRefsToPublicUrls } from "./uploadRefs"; // 👈 REQUIRED
import { IMAGE_STYLES } from "./styles";


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

return createImageJobSimple({
  subject: finalPrompt,
  toolKey,
  size: params.size,
  initImageUrls: uploadedRefs,
  providerHint: {
    settings: {
      quality: "high",
    },
  },
});

}
