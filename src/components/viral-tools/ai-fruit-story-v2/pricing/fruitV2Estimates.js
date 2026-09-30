// ╔════════════════════════════════════════════════════════════════════════╗
// ║ AI FRUIT STORY v2 — PRICES (the ONLY price file)                       ║
// ║                                                                        ║
// ║ Every number comes from the server's tool_prices rows via             ║
// ║ useToolPriceQuotes: image:fruit-story (flat per picture / edit /      ║
// ║ regenerate) and video:fruit-story-v2/v3/v4 (credits per second).      ║
// ║ We quote one allowed length per tier and divide, which gives the      ║
// ║ row's exact per-second rate; each clip is then CEIL(rate × sec), the  ║
// ║ same rule compute_tool_price charges. Only the whole-story video      ║
// ║ figure before the script exists is an estimate (clip lengths are      ║
// ║ decided by the lines).                                                 ║
// ╚════════════════════════════════════════════════════════════════════════╝

/** Quality tiers: server tool keys and the clip length each is quoted at. */
export const TIERS = {
  v2: { id: "v2", label: "V2", tag: "Fast & cheap", minPlan: "starter", toolKey: "video:fruit-story-v2", quoteSec: 5, dims: { "9:16": [720, 1280], "16:9": [1280, 720] } },
  v3: { id: "v3", label: "V3", tag: "Sharper", minPlan: "pro", toolKey: "video:fruit-story-v3", quoteSec: 5, dims: { "9:16": [720, 1280], "16:9": [1280, 720] } },
  v4: { id: "v4", label: "V4", tag: "Best quality", minPlan: "generative", toolKey: "video:fruit-story-v4", quoteSec: 4, dims: { "9:16": [720, 1280], "16:9": [1280, 720] } },
};
export const TIER_IDS = ["v2", "v3", "v4"];

export const PICTURE_TOOL_KEY = "image:fruit-story";
const IMAGE_DIMS = { "9:16": [768, 1376], "16:9": [1376, 768] };

/** Quote items (useToolPriceQuotes) for one aspect: the scene picture + each tier's clip. */
export function priceItems(aspect = "9:16") {
  const [iw, ih] = IMAGE_DIMS[aspect] ?? IMAGE_DIMS["9:16"];
  return [
    { id: "image", tool_key: PICTURE_TOOL_KEY, input: { width: iw, height: ih } },
    ...TIER_IDS.map((id) => {
      const tier = TIERS[id];
      const [width, height] = tier.dims[aspect] ?? tier.dims["9:16"];
      return { id: `clip:${id}`, tool_key: tier.toolKey, input: { durationSec: tier.quoteSec, withSound: true, width, height } };
    }),
  ];
}

/** Scenes for a length: one line each, about 5 s per line. */
export function sceneCountForLength(lengthSec) {
  return Math.max(3, Math.round(lengthSec / 5));
}

/** Exact server price of one scene picture (also edit / regenerate), or null. */
export function picturePrice(prices) {
  return prices?.image ?? null;
}

/** Credits per second for a tier (exact: the quoted clip ÷ its length). */
export function perSecondRate(tierId, prices) {
  const tier = TIERS[tierId];
  const quoted = prices?.[`clip:${tierId}`];
  if (!tier || quoted == null) return null;
  return quoted / tier.quoteSec;
}

/** One clip of durationSec on a tier, exactly as the server charges it. */
export function clipPrice(tierId, durationSec, prices) {
  const rate = perSecondRate(tierId, prices);
  if (rate == null) return null;
  return Math.ceil(rate * durationSec - 1e-9);
}

/** Animate every scene of a story (sum of its clips). */
export function animateAllPrice(story, prices) {
  if (!story?.scenes?.length) return null;
  let total = 0;
  for (const scene of story.scenes) {
    const price = clipPrice(story.quality, scene.durationSec, prices);
    if (price == null) return null;
    total += price;
  }
  return total;
}

/**
 * Settings-step estimate before anything is written.
 *   pictures: exact (scene count × picture price)
 *   video:    about lengthSec of the tier's video (estimate)
 * Returns null fields until prices load.
 */
export function estimateStory({ lengthSec, tierId, prices, sceneCount }) {
  const scenes = sceneCount ?? sceneCountForLength(lengthSec);
  const picture = picturePrice(prices);
  const rate = perSecondRate(tierId, prices);
  const pictures = picture == null ? null : scenes * picture;
  const video = rate == null ? null : Math.ceil(rate * lengthSec - 1e-9);
  return {
    sceneCount: scenes,
    pictures,
    video,
    total: pictures == null || video == null ? null : pictures + video,
  };
}

/** Expected clip length for one line (4–6 s by word count). ESTIMATE; the backend decides. */
export function estimateLineSec(line) {
  const words = String(line).trim().split(/\s+/).filter(Boolean).length;
  return words > 7 ? 6 : words > 4 ? 5 : 4;
}
