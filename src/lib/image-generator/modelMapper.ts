// lib/image-generator/modelMapper.ts
import type { ToolKey } from "../providers";
import { MODELS } from "./modelsConfig";

export type UiModelKey = keyof typeof MODELS;

export const UI_MODEL_TO_TOOLKEY: Record<UiModelKey, ToolKey> = {
  "image:nano": "image:nano",
  "image:juggernaut": "image:juggernaut",
  "image:hidream": "image:hidream",

};
