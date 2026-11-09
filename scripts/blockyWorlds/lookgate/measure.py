"""Look-gate pixel metrics for a list of stills (CPU only, light: numpy + scipy at ~270-540 px).

usage: python measure.py <out.json> <img1> <img2> ...   (or  @list.txt  with one path per line)
Per image:
  sat, val          median HSV saturation / value (0..1), same method for reference frames and our stills
  satMean, valMean  means
  dominant          fraction of pixels in the single biggest colour bin (RGB quantised to 6 levels/channel)
  uniform           fraction of the frame covered by the biggest connected low-detail region
                    (10x10 px blocks at 270 px wide with luminance std < 4, joined when neighbouring block
                    colours differ < 14) - a sky / wall / ground / inside-an-object area
  uniformKind       sky | dark | wall (colour + position of that region)
  detail            mean absolute luminance gradient (0..255)
  flat              dominant > 0.6 or uniform > 0.6  (one flat colour fills the frame)
  blank             uniform > 0.45 (a big empty sky / wall region, the 'nothing to look at' frame)
  over / under      fraction of pixels with value > 0.97 / < 0.08
  coloured          fraction of pixels with s > 0.2 (and not near-black)
  hueTop, hueTopShare, hueEntropy
                    the biggest 30-degree hue family of the coloured pixels (centre deg), its share, and the
                    hue entropy in bits (0 = one hue, 3.6 = all 12 families equal)
  beige             fraction of pixels that are beige / sand / tan (hue 20-50, s 0.12-0.6, v >= 0.5)
  contrast          p90 - p10 of value (flat light = low)
Faces are NOT measured from pixels: a cheap eye-pair finder was tried and found only 3 of 16 reference
close-ups, so face size / readability for our stills comes from the planner (timeline) in measure.mjs.
"""
import json
import sys

import numpy as np
from PIL import Image


def hsv(arr):
    rgb = arr.astype(np.float32) / 255.0
    mx = rgb.max(axis=2)
    mn = rgb.min(axis=2)
    d = mx - mn
    s = np.where(mx > 1e-6, d / np.maximum(mx, 1e-6), 0.0)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    h = np.zeros_like(mx)
    m = d > 1e-6
    rc = (mx == r) & m
    gc = (mx == g) & m & ~rc
    bc = m & ~rc & ~gc
    h[rc] = ((g - b)[rc] / d[rc]) % 6
    h[gc] = ((b - r)[gc] / d[gc]) + 2
    h[bc] = ((r - g)[bc] / d[bc]) + 4
    return h * 60.0, s, mx


def uniform_region(small):
    """Biggest connected low-detail region (union-find over 10x10 blocks)."""
    H, W, _ = small.shape
    B = 10
    gh, gw = H // B, W // B
    lum = small.astype(np.float32) @ np.array([0.299, 0.587, 0.114], np.float32)
    blocks = small[: gh * B, : gw * B].reshape(gh, B, gw, B, 3).astype(np.float32)
    mean = blocks.mean(axis=(1, 3))
    std = lum[: gh * B, : gw * B].reshape(gh, B, gw, B).std(axis=(1, 3))
    low = std < 4.0
    parent = list(range(gh * gw))

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    for y in range(gh):
        for x in range(gw):
            if not low[y, x]:
                continue
            for dy, dx in ((0, 1), (1, 0)):
                yy, xx = y + dy, x + dx
                if yy < gh and xx < gw and low[yy, xx] and np.abs(mean[y, x] - mean[yy, xx]).max() < 14:
                    ra, rb = find(y * gw + x), find(yy * gw + xx)
                    if ra != rb:
                        parent[ra] = rb
    counts = {}
    for y in range(gh):
        for x in range(gw):
            if low[y, x]:
                r = find(y * gw + x)
                counts.setdefault(r, []).append((y, x))
    if not counts:
        return 0.0, ""
    best = max(counts.values(), key=len)
    frac = len(best) / float(gh * gw)
    col = np.mean([mean[y, x] for y, x in best], axis=0)
    cy = np.mean([y for y, _ in best]) / gh
    h, s, v = hsv(col.reshape(1, 1, 3).astype(np.uint8))
    h, s, v = float(h[0, 0]), float(s[0, 0]), float(v[0, 0])
    if v < 0.18:
        kind = "dark"
    elif cy < 0.5 and 180 <= h <= 250 and s > 0.15:
        kind = "sky"
    else:
        kind = "wall"
    return frac, kind


def measure(path):
    im = Image.open(path).convert("RGB")
    small = np.asarray(im.resize((270, int(round(im.height * 270 / im.width)))))
    h, s, v = hsv(small)
    q = (small // 43).astype(np.int32)
    bins = np.bincount((q[..., 0] * 36 + q[..., 1] * 6 + q[..., 2]).ravel(), minlength=216)
    dominant = bins.max() / float(bins.sum())
    uni, kind = uniform_region(small)
    lum = small.astype(np.float32) @ np.array([0.299, 0.587, 0.114], np.float32)
    detail = float((np.abs(np.diff(lum, axis=0)).mean() + np.abs(np.diff(lum, axis=1)).mean()) / 2)
    # palette: hue families (12 x 30 deg) of the coloured pixels, how much is beige/sand, light contrast
    col = (s > 0.2) & (v > 0.15)
    hb = np.bincount((h[col] // 30).astype(np.int32) % 12, minlength=12).astype(np.float64)
    hp = hb / hb.sum() if hb.sum() > 0 else hb
    nz = hp[hp > 0]
    beige = float(((h >= 20) & (h <= 50) & (s >= 0.12) & (s <= 0.6) & (v >= 0.5)).mean())
    vv = np.sort(v.ravel())
    contrast = float(vv[int(0.9 * (vv.size - 1))] - vv[int(0.1 * (vv.size - 1))])
    return {
        "file": path,
        "sat": round(float(np.median(s)), 3), "val": round(float(np.median(v)), 3),
        "satMean": round(float(s.mean()), 3), "valMean": round(float(v.mean()), 3),
        "dominant": round(float(dominant), 3), "uniform": round(uni, 3), "uniformKind": kind,
        "detail": round(detail, 2),
        "flat": bool(dominant > 0.6 or uni > 0.6), "blank": bool(uni > 0.45),
        "over": round(float((v > 0.97).mean()), 3), "under": round(float((v < 0.08).mean()), 3),
        "coloured": round(float(col.mean()), 3),
        "hueTop": int(np.argmax(hb) * 30 + 15) if hb.sum() > 0 else -1,
        "hueTopShare": round(float(hp.max()), 3) if hb.sum() > 0 else 0.0,
        "hueEntropy": round(float(-(nz * np.log2(nz)).sum()), 2) if nz.size else 0.0,
        "beige": round(beige, 3), "contrast": round(contrast, 3),
    }


def main():
    out = sys.argv[1]
    files = sys.argv[2:]
    if len(files) == 1 and files[0].startswith("@"):  # @list.txt = one path per line
        with open(files[0][1:], encoding="utf-8") as f:
            files = [ln.strip() for ln in f if ln.strip()]
    res = [measure(p) for p in files]
    with open(out, "w", encoding="utf-8") as f:
        json.dump(res, f, indent=1)


if __name__ == "__main__":
    main()
