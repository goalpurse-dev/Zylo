import { getProviderLink, type ToolKey } from "../providers";
import { RESOLUTIONS } from "./resolutions";
import { DURATIONS } from "./durations";

export function calculateVideoCredits(
  toolKey: ToolKey,
  durationKey: keyof typeof DURATIONS,
  resolutionKey: keyof typeof RESOLUTIONS
) {
  const link = getProviderLink(toolKey);

  if (!link?.baseCreditsPerSecond) return 0;

  const seconds = DURATIONS[durationKey].seconds;
  const resolutionMultiplier = RESOLUTIONS[resolutionKey].multiplier;

  const credits =
    link.baseCreditsPerSecond *
    seconds *
    resolutionMultiplier;

  return Math.ceil(credits);
}