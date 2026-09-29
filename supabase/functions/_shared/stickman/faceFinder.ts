// deno-lint-ignore-file no-explicit-any
// stickman/faceFinder.ts — free, deterministic face finder for the on-screen
// text (text upgrade). Every face in the house style has two small solid black
// dot eyes side by side on a flat fill (STYLE_HEADER: "two small black dot
// eyes"), so a face is a PAIR of small, round, dark blobs of similar size,
// level with each other, a few eye-widths apart, on a light, even patch.
// A low-detail vision look missed most heads on f90160bc (0 found where the
// text then covered one), so placement uses this instead. Profile faces (one
// eye) are found from the single eye with a smaller box.
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";

export type FaceBox = { x: number; y: number; width: number; height: number };
const WORK_W = 688;

type Blob = { cx: number; cy: number; w: number; h: number; area: number };

export function findFaces(src: Image): FaceBox[] {
  const k = src.width / WORK_W;
  const img = src.clone().resize(WORK_W, Math.round(src.height / k));
  const W = img.width, H = img.height;
  const luma = new Float32Array(W * H);
  const rgb = new Uint8Array(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const [r, g, b] = Image.colorToRGBA(img.getPixelAt(x + 1, y + 1));
    const i = y * W + x;
    luma[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    rgb[i * 3] = r; rgb[i * 3 + 1] = g; rgb[i * 3 + 2] = b;
  }
  const dark = (i: number) => luma[i] < 70;
  // Small dark blobs (4-connected).
  const seen = new Uint8Array(W * H);
  const blobs: Blob[] = [];
  const stack: number[] = [];
  for (let s = 0; s < W * H; s++) {
    if (seen[s] || !dark(s)) continue;
    let x0 = W, y0 = H, x1 = 0, y1 = 0, area = 0, big = false;
    stack.push(s); seen[s] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % W, y = (i / W) | 0;
      area++;
      if (area > 90) big = true;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const j of [i - 1, i + 1, i - W, i + W]) {
        if (j < 0 || j >= W * H || seen[j] || !dark(j)) continue;
        if ((j === i - 1 && x === 0) || (j === i + 1 && x === W - 1)) continue;
        seen[j] = 1; stack.push(j);
      }
    }
    if (big) continue;
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    if (area < 3 || w > 11 || h > 11 || w / h > 2.2 || h / w > 2.2 || area / (w * h) < 0.45) continue;
    blobs.push({ cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w, h, area });
  }
  // Heads: flat-filled, roughly round regions (the circle head inside its
  // outline) holding 1-3 of those small dark blobs (the eyes).
  const region = new Int32Array(W * H).fill(-1);
  const heads: FaceBox[] = [];
  let rid = 0;
  for (let s = 0; s < W * H; s++) {
    if (region[s] !== -1 || luma[s] < 80) continue;
    let x0 = W, y0 = H, x1 = 0, y1 = 0, area = 0, sum = 0;
    stack.push(s); region[s] = rid;
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % W, y = (i / W) | 0;
      area++; sum += luma[i];
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const j of [i - 1, i + 1, i - W, i + W]) {
        if (j < 0 || j >= W * H || region[j] !== -1 || luma[j] < 80) continue;
        if ((j === i - 1 && x === 0) || (j === i + 1 && x === W - 1)) continue;
        // A flat fill: neighbours within a small colour step.
        if (Math.abs(rgb[j * 3] - rgb[i * 3]) + Math.abs(rgb[j * 3 + 1] - rgb[i * 3 + 1]) + Math.abs(rgb[j * 3 + 2] - rgb[i * 3 + 2]) > 30) continue;
        region[j] = rid; stack.push(j);
      }
    }
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    const id = rid++;
    if (w < 9 || h < 7 || w > H * 0.45 || h > H * 0.45) continue;
    if (h / w < 0.55 || h / w > 1.45 || x0 === 0 || y0 === 0 || x1 === W - 1 || y1 === H - 1) continue;
    // Eyes: small dark blobs inside the region's box, level with each other, in its upper-middle.
    const inside = blobs.filter((b) => b.cx > x0 + w * 0.12 && b.cx < x1 - w * 0.12 && b.cy > y0 + h * 0.15 && b.cy < y1 - h * 0.2 && Math.max(b.w, b.h) < w * 0.3);
    if (inside.length < 1 || inside.length > 4) continue;
    // Round: the region plus its holes fills a circle-like share of its box.
    let holes = 0;
    for (const b of inside) holes += b.area;
    const fill = (area + holes) / (w * h);
    if (fill < 0.5 || fill > 0.92) continue;
    void id; void sum;
    heads.push({ x: x0 - w * 0.2, y: y0 - h * 0.35, width: w * 1.4, height: h * 1.55 });
  }

  // The patch around an eye: light and even (skin, not a busy texture or an outline).
  const evenAround = (cx: number, cy: number, r: number) => {
    const vals: number[] = [];
    let darkCount = 0;
    for (let a = 0; a < 16; a++) {
      const x = Math.round(cx + Math.cos((a / 16) * 2 * Math.PI) * r), y = Math.round(cy + Math.sin((a / 16) * 2 * Math.PI) * r);
      if (x < 0 || y < 0 || x >= W || y >= H) return false;
      const l = luma[y * W + x];
      if (l < 70) darkCount++; else vals.push(l);
    }
    if (darkCount > 3 || vals.length < 10) return false;
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
    return mean > 95 && sd < 22;
  };
  const eyes = blobs.filter((b) => evenAround(b.cx, b.cy, Math.max(b.w, b.h) * 1.3 + 1.5));
  const faces: FaceBox[] = [];
  const used = new Set<number>();
  for (let i = 0; i < eyes.length; i++) for (let j = i + 1; j < eyes.length; j++) {
    const a = eyes[i], b = eyes[j];
    const size = (Math.max(a.w, a.h) + Math.max(b.w, b.h)) / 2;
    const dx = Math.abs(a.cx - b.cx), dy = Math.abs(a.cy - b.cy);
    if (Math.max(a.area, b.area) / Math.min(a.area, b.area) > 2.6) continue;
    if (dy > Math.max(2, size * 0.8) || dx < size * 1.8 || dx > size * 9) continue;
    // The skin between the eyes is light (not an outline between two blobs).
    const mx = Math.round((a.cx + b.cx) / 2), my = Math.round((a.cy + b.cy) / 2);
    if (luma[my * W + mx] < 90) continue;
    used.add(i); used.add(j);
    const cx = (a.cx + b.cx) / 2, cy = (a.cy + b.cy) / 2;
    const r = Math.max(dx * 1.45, size * 3.5); // the head is a circle a bit wider than the eye span
    faces.push({ x: cx - r, y: cy - r * 1.25, width: 2 * r, height: r * 2.3 });
  }
  // Merge overlapping boxes, back to the source's pixels.
  const merged: FaceBox[] = [];
  for (const f of [...heads, ...faces]) {
    const m = merged.find((g) => f.x < g.x + g.width && g.x < f.x + f.width && f.y < g.y + g.height && g.y < f.y + f.height);
    if (m) { const x = Math.min(m.x, f.x), y = Math.min(m.y, f.y); m.width = Math.max(m.x + m.width, f.x + f.width) - x; m.height = Math.max(m.y + m.height, f.y + f.height) - y; m.x = x; m.y = y; }
    else merged.push({ ...f });
  }
  return merged.map((f) => ({ x: Math.round(f.x * k), y: Math.round(f.y * k), width: Math.round(f.width * k), height: Math.round(f.height * k) }));
}
