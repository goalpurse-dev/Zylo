// video-generator/modelMapper.ts

import type { ToolKey } from "../providers";

export const UI_MODEL_TO_TOOLKEY: Record<string, ToolKey> = {
  "video:seedance15pro":  "video:seedance15pro",
  "video:seedance20fast": "video:seedance20fast",   // kept for future re-enable
  "video:veo31lite":      "video:veo31lite",
  // legacy / disabled
  "video:klingaist":      "video:klingaist",
  "video:miniMaxFast":    "video:miniMaxFast",
  "video:wan26flash":     "video:wan26flash",
  "video:viduq3turbo":    "video:viduq3turbo",
};