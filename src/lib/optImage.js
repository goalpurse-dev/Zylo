import manifest from "../data/optImages.json";

// Responsive WebP for a public image path (variants made by
// scripts/optimizeImages.mjs): spread into <img>. `sizes` is the displayed
// width; `want` picks the fallback src. Unknown paths fall back to the file.
const url = (src, w) => encodeURI(`/opt${src}.w${w}.webp`);
export function optImg(src, sizes = "100vw", want = 480) {
  const widths = manifest[src];
  if (!widths) return { src };
  const pick = widths.find((w) => w >= want) ?? widths[widths.length - 1];
  return { src: url(src, pick), srcSet: widths.map((w) => `${url(src, w)} ${w}w`).join(", "), sizes };
}
export const optUrl = (src, want = 480) => optImg(src, undefined, want).src;
