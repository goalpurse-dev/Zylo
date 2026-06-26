import { getProviderLink, type ToolKey } from "../providers";
import { RESOLUTIONS } from "./resolutions";
import { DURATIONS } from "./durations";

const CREDIT_RETAIL_USD = 0.02;

export function calculateVideoCredits(
  toolKey: ToolKey,
  durationKey: keyof typeof DURATIONS,
  resolutionKey: keyof typeof RESOLUTIONS,
  withSound = false,
) {
  const link = getProviderLink(toolKey);

  if (!link?.baseCreditsPerSecond && !link?.soundCreditsPerSecond) return 0;

  const seconds = DURATIONS[durationKey].seconds;
  const costPerSecondUSD = link.resolutionCostPerSecondUSD?.[resolutionKey];

  if (costPerSecondUSD != null) {
    const multiplier = link.retailMultiplier ?? 1;
    return Math.ceil((costPerSecondUSD * multiplier * seconds) / CREDIT_RETAIL_USD);
  }

  // Use sound rate when sound is on and a separate rate exists
  const creditsPerSec = withSound && link.soundCreditsPerSecond != null
    ? link.soundCreditsPerSecond
    : (link.baseCreditsPerSecond ?? 0);

  const resolutionMultiplier = RESOLUTIONS[resolutionKey].multiplier;

  return Math.ceil(creditsPerSec * seconds * resolutionMultiplier);
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
