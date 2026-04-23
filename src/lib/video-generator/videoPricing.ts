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

/** For models with a free-form duration slider (e.g. Kling Pro 3-15s) and optional sound. */
export function calculateVideoCreditsRaw(
  toolKey: ToolKey,
  durationSec: number,
  withSound = false,
): number {
  const link = getProviderLink(toolKey);
  if (!link) return 0;

  const creditsPerSec = withSound
    ? (link.soundCreditsPerSecond ?? link.baseCreditsPerSecond ?? 0)
    : (link.baseCreditsPerSecond ?? 0);

  return Math.ceil(creditsPerSec * durationSec);
}