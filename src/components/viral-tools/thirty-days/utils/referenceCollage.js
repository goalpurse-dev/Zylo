import { uploadForExternalFetch } from "../../../../lib/storage";

// Combines up to 3 reference images into ONE labeled-panel collage image, so
// a single-reference-image model call can still be anchored by several
// independent identity/style/environment references at once. New
// infrastructure — no precedent elsewhere in the repo (see plan doc).
//
// Layout:
//   1 ref  -> no collage needed, caller should just use that ref's own URL
//   2 refs -> side-by-side halves
//   3 refs -> top row = 2 halves, bottom row = 1 full-width panel
const CANVAS_W = 1024;
const CANVAS_H = 1024;
const PADDING = 8;
const BG = "#101012";

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = url;
  });
}

function drawContain(ctx, img, x, y, w, h) {
  const scale = Math.min(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  ctx.fillStyle = BG;
  ctx.fillRect(x, y, w, h);
  ctx.drawImage(img, dx, dy, dw, dh);
}

function layoutFor(count) {
  if (count === 2) {
    const w = (CANVAS_W - PADDING * 3) / 2;
    const h = CANVAS_H - PADDING * 2;
    return [
      { x: PADDING, y: PADDING, w, h },
      { x: PADDING * 2 + w, y: PADDING, w, h },
    ];
  }
  // count === 3
  const topW = (CANVAS_W - PADDING * 3) / 2;
  const topH = (CANVAS_H - PADDING * 3) / 2;
  const bottomH = CANVAS_H - PADDING * 3 - topH;
  return [
    { x: PADDING, y: PADDING, w: topW, h: topH },
    { x: PADDING * 2 + topW, y: PADDING, w: topW, h: topH },
    { x: PADDING, y: PADDING * 2 + topH, w: CANVAS_W - PADDING * 2, h: bottomH },
  ];
}

function collageKey(refs) {
  // Order is semantic: Panel 1/2/3 in the prompt must describe the same
  // visual panels. [A,B] and [B,A] are therefore different cache entries.
  return refs.map((r) => r.id).join("|");
}

// Cache is caller-owned (one Map per generation run) so identical reference
// combinations across different scenes never rebuild/re-upload the same
// collage twice.
export async function buildReferenceCollage(refs, cache) {
  const valid = refs.filter((r) => r?.url);
  if (valid.length === 0) return null;
  if (valid.length === 1) return valid[0].url;

  const key = collageKey(valid);
  if (cache?.has(key)) return cache.get(key);

  const promise = (async () => {
    const images = await Promise.all(valid.slice(0, 3).map((r) => loadImage(r.url)));
    const canvas = document.createElement("canvas");
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    const layout = layoutFor(images.length);
    images.forEach((img, i) => drawContain(ctx, img, layout[i].x, layout[i].y, layout[i].w, layout[i].h));

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    // key joins ref ids with "|" for cache-key readability, but that's not a
    // safe storage object key character — sanitize before it becomes part of
    // the uploaded filename (this was silently failing the upload, which
    // fell back to a single raw reference image with no collage at all).
    const safeKey = key.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 60);
    const file = new File([blob], `collage-${safeKey}.jpg`, { type: "image/jpeg" });
    const uploaded = await uploadForExternalFetch(file, { prefix: "thirty-days-collage" }, true);
    if (!uploaded.wasPublic) {
      throw new Error("COLLAGE_PUBLICATION_FAILED");
    }
    const { url } = uploaded;
    return url;
  })();

  cache?.set(key, promise);
  const result = await promise;
  cache?.set(key, result);
  return result;
}

export function createCollageCache() {
  return new Map();
}
