// What a number of credits makes, in the two things people know best. ONE copy, read by the pricing page and the
// upgrade popups (src/data/planEquivalents.js re-exports it) and by Maestro (_shared/maestro/knowledge.js).
import { BLENDER_FLAT } from "./blockyWorlds/blenderPricing.js";

export const TOWN_VIDEO_CREDITS = BLENDER_FLAT.credits; // one In This Town video: its flat price
export const QUICK_IMAGE_CREDITS = 7; // one Quick Generate image (the server's quote for nano.2 at 2k, 2026-11-26)

/** { town, images }: how many of each the credits make on their own, rounded down */
export function planEquivalents(credits) {
  const c = Math.max(0, Number(credits) || 0);
  return { town: Math.floor(c / TOWN_VIDEO_CREDITS), images: Math.floor(c / QUICK_IMAGE_CREDITS) };
}
