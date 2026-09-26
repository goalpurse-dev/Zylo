// ╔════════════════════════════════════════════════════════════════════════╗
// ║ AI FRUIT STORY v2 — PRICE ESTIMATES (the ONLY estimate file)           ║
// ║                                                                        ║
// ║ Scene pictures, edits and regenerations use an EXACT server quote     ║
// ║ (image:fruit-v2 via useToolPriceQuotes).                               ║
// ║                                                                        ║
// ║ Clip prices are ESTIMATED here, because today's price rows only accept║
// ║ one clip length per tier (V2/V3: 5 s, V4: 6 s) while v2 makes one clip ║
// ║ per line (4–6 s). We quote each tier's allowed length, derive a        ║
// ║ per-second rate, and round each clip up — the same CEIL(rate × sec)    ║
// ║ rule compute_tool_price uses.                                          ║
// ║                                                                        ║
// ║ PHASE 3: add per-second fruit video rows that accept 3–8 s clips, then ║
// ║ quote clipPriceItem(tier, durationSec, aspect) per scene and delete    ║
// ║ the rate derivation below.                                             ║
// ╚════════════════════════════════════════════════════════════════════════╝

/** Quality tiers: server tool keys and the one clip length each row accepts today. */
export const TIERS = {
  v2: { id: "v2", label: "V2", tag: "Fast & cheap", minPlan: "starter", toolKey: "video:fruit-v2", quoteSec: 5, dims: { "9:16": [496, 864], "16:9": [864, 496] } },
  v3: { id: "v3", label: "V3", tag: "Sharper", minPlan: "pro", toolKey: "video:fruit-v3", quoteSec: 5, dims: { "9:16": [720, 1280], "16:9": [1280, 720] } },
  v4: { id: "v4", label: "V4", tag: "Best quality", minPlan: "generative", toolKey: "video:fruit-v4", quoteSec: 6, dims: { "9:16": [1080, 1920], "16:9": [1920, 1080] } },
};
export const TIER_IDS = ["v2", "v3", "v4"];

const IMAGE_DIMS = { "9:16": [720, 1280], "16:9": [1280, 720] };

/** Quote items (useToolPriceQuotes) for one aspect: the scene picture + each tier's clip. */
export function priceItems(aspect = "9:16") {
  const [iw, ih] = IMAGE_DIMS[aspect] ?? IMAGE_DIMS["9:16"];
  return [
    { id: "image", tool_key: "image:fruit-v2", input: { width: iw, height: ih } },
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

/** Credits per second for a tier, derived from its quoted clip. ESTIMATE. */
export function perSecondRate(tierId, prices) {
  const tier = TIERS[tierId];
  const quoted = prices?.[`clip:${tierId}`];
  if (!tier || quoted == null) return null;
  return quoted / tier.quoteSec;
}

/** One clip of durationSec on a tier. ESTIMATE (see header). */
export function clipPrice(tierId, durationSec, prices) {
  const rate = perSecondRate(tierId, prices);
  if (rate == null) return null;
  return Math.ceil(rate * durationSec - 1e-9);
}

/** Animate every scene of a story (sum of its clips). ESTIMATE. */
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
