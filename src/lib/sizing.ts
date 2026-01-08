// Parse "1080x1920 (9:16)" → 1080, 1920
export function parseDims(sizeLabel: string): { w: number; h: number } | null {
  const m = (sizeLabel || "").toLowerCase().match(/(\d{2,5})\s*[x×]\s*(\d{2,5})/);
  if (!m) return null;
  const w = Number(m[1]), h = Number(m[2]);
  if (!Number.isFinite(w) || !Number.isFinite(h)) return null;
  return { w, h };
}

// Estimate what fal.run bills (ceil to whole MP)
export function billedMegapixels(sizeLabel: string): number {
  const dims = parseDims(sizeLabel);
  if (!dims) return 2; // default ≈ 1024² → billed 2MP on fal
  const mp = (dims.w * dims.h) / 1e6;
  return Math.max(1, Math.ceil(mp));
}

// (Optional) sanity check for tokens vs dims – dev-only
export function assertTokenMatchesDims(token: string, w: number, h: number) {
  const portrait = h > w, landscape = w > h, square = w === h;
  if (token.includes("portrait") && !portrait) console.warn("Token mismatch: expected portrait");
  if (token.includes("landscape") && !landscape) console.warn("Token mismatch: expected landscape");
  if (token.includes("square") && !square && !token.endsWith("_hd")) console.warn("Token mismatch: expected square");
}
