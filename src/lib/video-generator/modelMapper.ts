// video-generator/modelMapper.ts

import type { ToolKey } from "../providers";

export const UI_MODEL_TO_TOOLKEY: Record<string, ToolKey> = {
  "video:cinematic": "video:klingaist", // temporary if cinematic uses kling
  "video:klingaist": "video:klingaist",
  "video:fast": "video:klingaist", // adjust later when you add real fast provider
};