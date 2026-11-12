"""Blocky Worlds COLOUR MATCHING (GRADE, 2026-11-10): per-mood reference colour statistics + a per-mood 3D LUT that
maps our renders' colour distribution onto the reference's. CPU only, light (numpy + PIL at 270 px wide), no renders,
no paid calls. Owner: "extract colour statistics per mood (day exterior, interior, neon, sunset, night) from the
reference frames, build a per-mood colour grade / 3D LUT that maps our render's colour distribution onto the
reference's ... vibrance + contrast curve. Kill beige."

  python colourFit.py refstats [--analysis <reference/blocky-worlds/analysis>] [--grid <lookref/grid> --gridlabels <ref-7706161704.json>]
         [--out engine/lib/data/refColour.json]
      -> abstract statistics per mood (no frames): OKLab mean/std, L + chroma quantiles, hue histogram, HSV sat/value,
         beige share, contrast, hue entropy, an 8-colour k-means palette.
  python colourFit.py fit --runs <runDir>[,<runDir>...] [--ref engine/lib/data/refColour.json] [--out engine/lib/data/colourGrade.json]
      -> per mood: the transform's parameters + a 25^3 LUT (base64 RGB bytes, r fastest). A run dir holds stills/ (NNN_sNN.jpg)
         and timeline.json (each shot's rig -> mood). RE-FIT after material / lighting changes: render new stills, run this.
  python colourFit.py apply --runs <runDir>,... --out <dir> [--grade colourGrade.json] [--ref refColour.json]
      -> before/after sheets per run, palette swatch sheet per mood (ours before / ours after / reference) and
         <dir>/metrics.json (sat / bright / beige / hue entropy / contrast before, after, reference per mood).
  python colourFit.py palettes <out.json> <img>... | @list.txt
      -> a 6-colour palette per image (compare.mjs: the gate page's swatches, ours vs the matched reference frame).

The LUT is applied after the whole post chain (page/post.js: OutputPass sRGB + the punchy grade + the per-shot auto
grade), so it is fitted on final stills of that same chain, and python applies it with the same trilinear lookup the
GPU does (lut coordinate = rgb * (N-1)/N + 0.5/N), so the offline proof is the shader's result.
"""
import base64
import glob
import json
import math
import os
import re
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.normpath(os.path.join(HERE, "..", "engine"))
DATA = os.path.join(ENGINE, "lib", "data")
REPO = os.path.normpath(os.path.join(HERE, "..", "..", ".."))

MOODS = ["day", "interior", "sunset", "night", "neon", "alarm"]
# the rig (lib/setThemes.js RIGS) -> mood; lib/colourGrade.js RIG_MOOD mirrors this (the test checks both agree)
RIG_MOOD = {"day": "day", "golden": "sunset", "night_practicals": "night", "neon": "neon", "interior_warm": "interior", "alarm_red": "alarm"}
LUT_N = 25  # 17 bled the beige killer into light skin (hue 60 -> 49 by interpolation); 25 keeps it within ~3 degrees
W, H = 270, 480  # every frame is measured at the reference keyframes' size
SEED = 20261110

# ------------------------------------------------------------------------------------------------ colour maths
def srgb_to_lin(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lin_to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)


M1 = np.array([[0.4122214708, 0.5363325363, 0.0514459929], [0.2119034982, 0.6806995451, 0.1073969566], [0.0883024619, 0.2817188376, 0.6299787005]])
M2 = np.array([[0.2104542553, 0.7936177850, -0.0040720468], [1.9779984951, -2.4285922050, 0.4505937099], [0.0259040371, 0.7827717662, -0.8086757660]])
M2i = np.linalg.inv(M2)
M1i = np.linalg.inv(M1)


def rgb_to_oklab(rgb):
    """rgb (..., 3) sRGB 0..1 -> OKLab (..., 3)"""
    lms = srgb_to_lin(rgb) @ M1.T
    return np.cbrt(np.maximum(lms, 0)) @ M2.T


def oklab_to_rgb_lin(lab):
    lms = (lab @ M2i.T) ** 3
    return lms @ M1i.T


def oklab_to_rgb(lab):
    """OKLab -> sRGB 0..1, out-of-gamut colours pulled toward grey at the same L (hue kept) instead of clipped"""
    lab = lab.copy()
    for _ in range(8):
        lin = oklab_to_rgb_lin(lab)
        bad = (lin < -1e-4).any(axis=-1) | (lin > 1 + 1e-4).any(axis=-1)
        if not bad.any():
            break
        lab[bad, 1:] *= 0.88
    return lin_to_srgb(oklab_to_rgb_lin(lab))


def hsv(rgb):
    mx = rgb.max(axis=-1)
    mn = rgb.min(axis=-1)
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


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def window(x, a, b, soft):
    """1 inside [a, b], smooth falloff of width soft outside"""
    return smooth(a - soft, a, x) * (1 - smooth(b, b + soft, x))


def hue_dist(a, b):
    """signed shortest angle b - a in degrees"""
    return (b - a + 180.0) % 360.0 - 180.0


# ------------------------------------------------------------------------------------------------ frame metrics
def look_metrics(rgb):
    """the look gate's per-frame measure (lookgate/measure.py): median HSV s / v, beige share, contrast, hue entropy"""
    h, s, v = hsv(rgb.reshape(-1, 3))
    col = (s > 0.2) & (v > 0.15)
    hb = np.bincount((h[col] // 30).astype(np.int32) % 12, minlength=12).astype(np.float64)
    hp = hb / hb.sum() if hb.sum() > 0 else hb
    nz = hp[hp > 0]
    vv = np.sort(v)
    return {
        "sat": float(np.median(s)), "bright": float(np.median(v)),
        "beige": float(((h >= 20) & (h <= 50) & (s >= 0.12) & (s <= 0.6) & (v >= 0.5)).mean()),
        "contrast": float(vv[int(0.9 * (vv.size - 1))] - vv[int(0.1 * (vv.size - 1))]),
        "hueEntropy": float(-(nz * np.log2(nz)).sum()) if nz.size else 0.0,
    }


def caption_mask(rgb):
    """True where a pixel is probably burned-in caption text (bright neutral or caption-yellow next to its black outline)"""
    h, s, v = hsv(rgb)
    text = ((v > 0.88) & (s < 0.18)) | ((v > 0.8) & (s > 0.55) & (h > 50) & (h < 80))
    dark = v < 0.12
    near = dark.copy()
    for dy in (-2, -1, 1, 2):
        near |= np.roll(dark, dy, axis=0)
    for dx in (-2, -1, 1, 2):
        near |= np.roll(dark, dx, axis=1)
    m = text & near
    grow = m.copy()
    for d in (-1, 1):
        grow |= np.roll(m, d, axis=0) | np.roll(m, d, axis=1)
    return grow


def load(path):
    im = Image.open(path).convert("RGB")
    if im.size != (W, H):
        im = im.resize((W, H), Image.BILINEAR)
    return np.asarray(im, dtype=np.float32) / 255.0


# ------------------------------------------------------------------------------------------------ reference labels
INTERIOR = re.compile(r"\b(bedroom|classroom|hallway|corridor|room|kitchen|cafeteria|office|interior|inside|indoors?|aisle|shop|store|diner|cabin|lab|laboratory|hall|warehouse|supermarket|throne|booth|counter|basement|attic|bathroom|library|gym|garage|elevator|lobby|studio|theat(er|re)|museum|chamber|bakery|restaurant|cockpit|bunker|vault|dungeon|cell|stairwell|closet|locker|house)\b")
NEON = re.compile(r"\b(neon|arcade|cyber\w*|nightclub|club|hologram\w*|disco|rave)\b")
ALARM = re.compile(r"\b(alarms?|sirens?|red light|red alert|emergency light\w*)\b")


def desc_mood(s):
    tod = (s.get("timeOfDay") or "").lower()
    place = (s.get("place") or "").lower()
    txt = " ".join(str(s.get(k) or "") for k in ("place", "subject", "action", "libraryLabel")).lower()
    if ALARM.search(txt):
        return "alarm"
    if NEON.search(txt):
        return "neon"
    inside = bool(INTERIOR.search(place)) and not re.search(r"\b(outside|exterior|street|yard|lawn|roof)\b", place)
    if tod == "night":
        return "night"
    if tod in ("dusk", "golden_hour"):
        return "interior" if inside else "sunset"
    if tod == "day":
        return "interior" if inside else "day"
    if tod == "unclear" and inside:
        return "interior"
    return None


GRID_LIGHT = {"day": "day", "warm interior": "interior", "torch gold": "interior", "cool neon day": "day",
              "dark cyan neon": "neon", "sunset": "sunset", "red alarm neon": "alarm"}


def ref_frames(analysis, grid=None, gridlabels=None):
    """[(path, mood)] of every labelled reference keyframe"""
    out = []
    for d in sorted(glob.glob(os.path.join(analysis, "*", "descriptions.json"))):
        vid = os.path.dirname(d)
        shots = json.load(open(d, encoding="utf-8")).get("shots", {})
        for k, s in shots.items():
            mood = desc_mood(s)
            if not mood:
                continue
            for part in ("start", "mid", "end"):
                p = os.path.join(vid, "frames", "s%03d_%s.jpg" % (int(k), part))
                if os.path.exists(p):
                    out.append((p, mood))
    if grid and gridlabels and os.path.isdir(grid):
        lab = json.load(open(gridlabels, encoding="utf-8"))
        fam = lab["lightFamily"]
        for i, f in enumerate(lab["frames"]):
            mood = GRID_LIGHT.get(fam.get(f[8], ""), None)
            if mood == "day" and INTERIOR.search(f[7].lower()):
                mood = "interior"
            p = os.path.join(grid, "g_%03d.jpg" % (i + 1))
            if mood and os.path.exists(p):
                out.append((p, mood))
    return out


# ------------------------------------------------------------------------------------------------ statistics
QS = np.linspace(0, 100, 51)


def kmeans(x, k, rng, iters=25):
    c = [x[rng.integers(len(x))]]
    for _ in range(1, k):
        d = np.min(((x[:, None, :] - np.array(c)[None]) ** 2).sum(-1), axis=1)
        c.append(x[rng.choice(len(x), p=d / d.sum())])
    c = np.array(c)
    for _ in range(iters):
        lab = np.argmin(((x[:, None, :] - c[None]) ** 2).sum(-1), axis=1)
        for j in range(k):
            if (lab == j).any():
                c[j] = x[lab == j].mean(0)
    lab = np.argmin(((x[:, None, :] - c[None]) ** 2).sum(-1), axis=1)
    share = np.bincount(lab, minlength=k) / len(lab)
    o = np.argsort(-share)
    return c[o], share[o]


def pixel_stats(lab, rng, frames_metrics):
    L, a, b = lab[:, 0], lab[:, 1], lab[:, 2]
    C = np.hypot(a, b)
    hue = np.degrees(np.arctan2(b, a)) % 360
    neutral = C < 0.06
    chrom = C > 0.04
    hh = np.bincount((hue[chrom] // 15).astype(int) % 24, weights=C[chrom], minlength=24)
    hh = hh / max(hh.sum(), 1e-9)
    sub = lab[rng.choice(len(lab), size=min(30000, len(lab)), replace=False)]
    cen, share = kmeans(sub, 8, rng)
    rgb = oklab_to_rgb(cen)
    fm = {k: float(np.median([m[k] for m in frames_metrics])) for k in frames_metrics[0]}
    return {
        "frames": len(frames_metrics), "pixels": int(len(lab)),
        "oklab": {"mean": [round(float(v), 4) for v in lab.mean(0)], "std": [round(float(v), 4) for v in lab.std(0)]},
        "chroma": {"mean": round(float(C.mean()), 4), "std": round(float(C.std()), 4)},
        "neutralAB": [round(float(a[neutral].mean()), 4), round(float(b[neutral].mean()), 4)] if neutral.any() else [0, 0],
        "Lq": [round(float(v), 4) for v in np.percentile(L, QS)],
        "Cq": [round(float(v), 4) for v in np.percentile(C, QS)],
        "hueHist24": [round(float(v), 4) for v in hh],
        "palette": [{"hex": "#%02x%02x%02x" % tuple(int(round(v * 255)) for v in np.clip(rgb[j], 0, 1)),
                     "oklab": [round(float(v), 4) for v in cen[j]], "share": round(float(share[j]), 4)} for j in range(len(cen))],
        "look": {k: round(v, 4) for k, v in fm.items()},
        "beigeHeavyPct": round(100.0 * float(np.mean([m["beige"] > 0.4 for m in frames_metrics])), 1),
    }


def collect(items, per_frame=1500, rng=None, transform=None):
    """items [(path, mood)] -> {mood: (lab pixels, [frame metrics])}"""
    acc = {}
    for p, mood in items:
        rgb = load(p)
        if transform is not None:
            rgb = transform(rgb)
        m = look_metrics(rgb)
        keep = ~caption_mask(rgb)
        px = rgb[keep]
        if len(px) > per_frame:
            px = px[rng.choice(len(px), size=per_frame, replace=False)]
        L, M, S = acc.setdefault(mood, ([], [], []))
        L.append(rgb_to_oklab(px))
        M.append(m)
        S.append(rgb[3::6, 3::6])
    return {k: (np.concatenate(v[0]), v[1], v[2]) for k, v in acc.items()}


def cmd_refstats(a):
    analysis = a.get("analysis", os.path.join(REPO, "reference", "blocky-worlds", "analysis"))
    items = ref_frames(analysis, a.get("grid"), a.get("gridlabels", os.path.join(HERE, "ref-7706161704.json")))
    rng = np.random.default_rng(SEED)
    print("reference frames:", len(items), {m: sum(1 for _, x in items if x == m) for m in MOODS}, file=sys.stderr)
    acc = collect(items, 1200, rng)
    out = {"version": 1, "how": "lookgate/colourFit.py refstats: abstract colour statistics per mood of the reference keyframes "
           "(reference/blocky-worlds/analysis/*/frames labelled by descriptions.json time of day + place, plus the lookref grid's "
           "hand light labels). Captions masked. OKLab; Lq / Cq = percentiles 0..100 step 2; hueHist24 = chroma-weighted 15-degree "
           "hue bins; look = per-frame medians of the look gate's measure. No frames are stored.",
           "moods": {}}
    for m in MOODS:
        if m in acc:
            out["moods"][m] = pixel_stats(acc[m][0], rng, acc[m][1])
    path = a.get("out", os.path.join(DATA, "refColour.json"))
    json.dump(out, open(path, "w", encoding="utf-8"), indent=1)
    print(path)


# ------------------------------------------------------------------------------------------------ the transform
def interp_map(x, src_q, dst_q):
    """monotone quantile map, pinned at 0 -> 0 and 1 -> 1 (keeps the black and white points)"""
    s = np.concatenate([[0.0], np.maximum.accumulate(np.asarray(src_q[1:-1])), [1.0]])
    d = np.concatenate([[0.0], np.maximum.accumulate(np.asarray(dst_q[1:-1])), [1.0]])
    s = s + np.arange(len(s)) * 1e-6
    return np.interp(x, s, d)


def transform_lab(lab, P):
    """our OKLab -> graded OKLab. P: one mood's parameters (see fit_mood)."""
    L0, a0, b0 = lab[..., 0], lab[..., 1], lab[..., 2]
    C0 = np.hypot(a0, b0)
    h0 = np.degrees(np.arctan2(b0, a0)) % 360
    # protections: skin (crowd / people SKIN tones are OKLab hue ~45-70, chroma 0.03-0.11) and the white / black points
    skin = window(h0, 42, 70, 8) * window(C0, 0.03, 0.115, 0.02) * window(L0, 0.38, 0.93, 0.05)
    ends = smooth(0.95, 0.995, L0) + (1 - smooth(0.02, 0.07, L0))
    # 1. cast: the neutral axis moved onto the reference's (our orange / beige cast on greys), strongest on neutrals
    wn = 1 - smooth(0.03, 0.14, C0)
    a = a0 + P["cast"][0] * wn
    b = b0 + P["cast"][1] * wn
    C = np.hypot(a, b)
    h = np.degrees(np.arctan2(b, a)) % 360
    # 2. lightness: quantile match to the reference, blended, then the S contrast curve (pivot 0.5, ends fixed)
    Lm = interp_map(L0, P["Lsrc"], P["Ldst"])
    L = L0 + P["alphaL"] * (Lm - L0)
    L = L + P["contrast"] * 2 * L * (1 - L) * (2 * L - 1)
    # 3. chroma: quantile match (ratio clamped), then vibrance (low-chroma colours lifted more than saturated ones)
    Cm = interp_map(np.clip(C / 0.4, 0, 1), np.asarray(P["Csrc"]) / 0.4, np.asarray(P["Cdst"]) / 0.4) * 0.4
    ratio = np.clip(np.where(C > 1e-4, Cm / np.maximum(C, 1e-4), 1.0), 0.75, 1.6)
    C = C * (1 + P["betaC"] * (ratio - 1))
    C = C * (1 + P["vibrance"] * (1 - np.clip(C / 0.22, 0, 1)) ** 2 * smooth(0.012, 0.04, C))
    # 4. hue: pulled toward the reference palette's hues (Gaussian attraction, capped), only on coloured pixels
    if P["paletteHues"]:
        ph = np.asarray(P["paletteHues"], dtype=np.float64)
        pw = np.asarray(P["paletteWeights"], dtype=np.float64)
        d = hue_dist(h[..., None], ph)
        g = pw * np.exp(-(d ** 2) / (2 * 22.0 ** 2))
        dh = (g * d).sum(-1) / (g.sum(-1) + 0.35)
        h = h + np.clip(P["hueK"] * dh, -10, 10) * smooth(0.03, 0.08, C)
    # 5. the BEIGE KILLER: desaturated warm mid / light tones (sand, tan, khaki, beige plaster; OKLab hue ~72-104, chroma
    # 0.015-0.1, L > ~0.4) lose most of their chroma and take the reference's neutral (clean stone / white), skin excluded
    wb = window(h, 72, 104, 10) * window(C, 0.015, 0.1, 0.02) * smooth(0.33, 0.43, L) * (1 - skin)
    C = C * (1 - P["beigeK"] * wb)
    hr = np.radians(h)
    a = C * np.cos(hr) + P["beigeK"] * wb * P["refNeutral"][0]
    b = C * np.sin(hr) + P["beigeK"] * wb * P["refNeutral"][1]
    # protections blended back
    keep_ab = np.clip(0.7 * skin + ends, 0, 1)
    keep_L = np.clip(0.4 * skin + ends, 0, 1)
    L = L + (L0 - L) * keep_L
    a = a + (a0 - a) * keep_ab
    b = b + (b0 - b) * keep_ab
    return np.stack([L, a, b], axis=-1)


def transform_rgb(rgb, P):
    return oklab_to_rgb(transform_lab(rgb_to_oklab(rgb), P))


def build_lut(P, n=LUT_N):
    g = np.linspace(0, 1, n)
    bb, gg, rr = np.meshgrid(g, g, g, indexing="ij")  # index = r + g*n + b*n*n (r fastest): the Data3DTexture order
    rgb = np.stack([rr, gg, bb], axis=-1).reshape(-1, 3)
    out = transform_rgb(rgb, P)
    return np.clip(np.round(out * 255), 0, 255).astype(np.uint8)


def apply_lut(rgb, lut, n=LUT_N):
    """trilinear lookup, the GPU's: rgb (..., 3) 0..1, lut (n^3, 3) uint8"""
    t = lut.reshape(n, n, n, 3).astype(np.float32) / 255.0  # [b, g, r]
    x = np.clip(rgb, 0, 1) * (n - 1)
    i0 = np.minimum(np.floor(x).astype(np.int32), n - 2)
    f = x - i0
    r0, g0, b0 = i0[..., 0], i0[..., 1], i0[..., 2]
    fr, fg, fb = f[..., 0:1], f[..., 1:2], f[..., 2:3]
    def T(db, dg, dr):
        return t[b0 + db, g0 + dg, r0 + dr]
    c00 = T(0, 0, 0) * (1 - fr) + T(0, 0, 1) * fr
    c01 = T(0, 1, 0) * (1 - fr) + T(0, 1, 1) * fr
    c10 = T(1, 0, 0) * (1 - fr) + T(1, 0, 1) * fr
    c11 = T(1, 1, 0) * (1 - fr) + T(1, 1, 1) * fr
    c0 = c00 * (1 - fg) + c01 * fg
    c1 = c10 * (1 - fg) + c11 * fg
    return c0 * (1 - fb) + c1 * fb


def fit_mood(src_lab, src_small, ref):
    """parameters mapping our distribution (src_lab pixels, None = no stills of this mood yet) onto ref (refColour mood)"""
    pal = [p for p in ref["palette"] if math.hypot(p["oklab"][1], p["oklab"][2]) > 0.05]
    tot = sum(p["share"] for p in pal) or 1
    P = {
        "Ldst": ref["Lq"], "Cdst": ref["Cq"],
        "paletteHues": [round(math.degrees(math.atan2(p["oklab"][2], p["oklab"][1])) % 360, 2) for p in pal],
        "paletteWeights": [round(p["share"] / tot, 4) for p in pal],
        "refNeutral": ref["neutralAB"], "hueK": 0.35, "beigeK": 0.85,
    }
    if src_lab is None:
        # provisional (no stills of this mood yet): no lightness / chroma remap, cast at half strength, the curves only
        P.update({"Lsrc": ref["Lq"], "Csrc": ref["Cq"], "alphaL": 0.0, "betaC": 0.0, "contrast": 0.12, "vibrance": 0.15,
                  "cast": [0.0, 0.0], "provisional": True})
        return P
    C = np.hypot(src_lab[:, 1], src_lab[:, 2])
    neutral = C < 0.06
    na = [float(src_lab[neutral, 1].mean()), float(src_lab[neutral, 2].mean())] if neutral.any() else [0.0, 0.0]
    P.update({"Lsrc": [round(float(v), 4) for v in np.percentile(src_lab[:, 0], QS)],
              "Csrc": [round(float(v), 4) for v in np.percentile(C, QS)],
              "cast": [round(0.8 * (ref["neutralAB"][0] - na[0]), 4), round(0.8 * (ref["neutralAB"][1] - na[1]), 4)],
              "provisional": False})
    # small grid search on the curve strengths: the graded stills' per-frame look (median over frames, the same
    # measure as the reference's) toward the reference's; the gentlest grade that gets there wins ties
    tgt = ref["look"]
    frames = [rgb_to_oklab(f) for f in src_small]
    flat = np.concatenate([f.reshape(-1, 3) for f in frames])
    sizes = [f.shape[0] * f.shape[1] for f in frames]
    best = None
    for alphaL in (0.5, 0.8):
        for betaC in (0.3, 0.6):
            for contrast in (0.0, 0.12, 0.25):
                for vib in (0.0, 0.15, 0.3):
                    Q = dict(P, alphaL=alphaL, betaC=betaC, contrast=contrast, vibrance=vib)
                    g = oklab_to_rgb(transform_lab(flat, Q))
                    ms, o = [], 0
                    for n in sizes:
                        ms.append(look_metrics(g[o:o + n]))
                        o += n
                    m = {k: float(np.median([x[k] for x in ms])) for k in ms[0]}
                    err = ((m["sat"] - tgt["sat"]) / 0.04) ** 2 + ((m["bright"] - tgt["bright"]) / 0.04) ** 2 \
                        + ((m["contrast"] - tgt["contrast"]) / 0.05) ** 2 + (max(0, m["beige"] - tgt["beige"]) / 0.03) ** 2 \
                        + 0.25 * (alphaL + betaC + contrast + vib)
                    if best is None or err < best[0]:
                        best = (err, alphaL, betaC, contrast, vib, m)
    P["fitLook"] = {k: round(v, 4) for k, v in best[5].items()}
    P.update({"alphaL": best[1], "betaC": best[2], "contrast": best[3], "vibrance": best[4]})
    return P


def run_items(run):
    """[(still path, mood)] of a run dir (stills/NNN_sNN.jpg + timeline.json)"""
    tl = json.load(open(os.path.join(run, "timeline.json"), encoding="utf-8"))
    shots = tl.get("shots", [])
    out = []
    for p in sorted(glob.glob(os.path.join(run, "stills", "*.jpg"))):
        m = re.search(r"_s(\d+)\.jpg$", p)
        if not m or int(m.group(1)) >= len(shots):
            continue
        s = shots[int(m.group(1))]
        out.append((p, s.get("mood") or RIG_MOOD.get(s.get("rig"), "day")))
    return out


def cmd_fit(a):
    ref = json.load(open(a.get("ref", os.path.join(DATA, "refColour.json")), encoding="utf-8"))
    runs = [r for r in a["runs"].split(",") if r]
    items = [it for r in runs for it in run_items(r)]
    rng = np.random.default_rng(SEED)
    ours = collect(items, 3000, rng)
    out = {"version": 1, "size": LUT_N, "order": "rgb bytes, index = r + g*N + b*N*N (Data3DTexture)",
           "how": "lookgate/colourFit.py fit --runs " + ",".join(os.path.relpath(r, REPO) if r.startswith(REPO) else os.path.basename(r.rstrip("/\\")) for r in runs),
           "rigMood": RIG_MOOD, "moods": {}}
    for m in MOODS:
        if m not in ref["moods"]:
            continue
        r = ref["moods"][m]
        src = ours.get(m)
        P = fit_mood(src[0] if src else None, src[2] if src else None, r)
        lut = build_lut(P)
        out["moods"][m] = {"stills": len(src[1]) if src else 0,
                           "params": {k: v for k, v in P.items() if k not in ("Ldst", "Cdst")},
                           "lut": base64.b64encode(lut.tobytes()).decode("ascii")}
        print(m, "stills", out["moods"][m]["stills"], {k: P[k] for k in ("alphaL", "betaC", "contrast", "vibrance", "cast")}, file=sys.stderr)
    path = a.get("out", os.path.join(DATA, "colourGrade.json"))
    json.dump(out, open(path, "w", encoding="utf-8"), separators=(",", ":"))
    print(path)


# ------------------------------------------------------------------------------------------------ the proof
def lut_of(grade, mood):
    m = grade["moods"].get(mood) or grade["moods"]["day"]
    return np.frombuffer(base64.b64decode(m["lut"]), dtype=np.uint8).reshape(-1, 3)


def swatch_row(draw, x, y, palette, w=36, h=36):
    for j, p in enumerate(palette):
        c = tuple(int(p["hex"][i:i + 2], 16) for i in (1, 3, 5))
        ww = max(6, int(round(w * 8 * p["share"])))
        draw.rectangle([x, y, x + ww - 1, y + h - 1], fill=c)
        x += ww
    return x


def palette_of(rgbs, rng):
    px = np.concatenate([r.reshape(-1, 3)[rng.choice(r.shape[0] * r.shape[1], 1500, replace=False)] for r in rgbs])
    cen, share = kmeans(rgb_to_oklab(px), 8, rng)
    rgb = oklab_to_rgb(cen)
    return [{"hex": "#%02x%02x%02x" % tuple(int(round(v * 255)) for v in np.clip(rgb[j], 0, 1)), "share": float(share[j])} for j in range(len(cen))]


def cmd_apply(a):
    grade = json.load(open(a.get("grade", os.path.join(DATA, "colourGrade.json")), encoding="utf-8"))
    ref = json.load(open(a.get("ref", os.path.join(DATA, "refColour.json")), encoding="utf-8"))
    outd = a["out"]
    os.makedirs(outd, exist_ok=True)
    rng = np.random.default_rng(SEED)
    per = {}
    sheets = []
    for run in [r for r in a["runs"].split(",") if r]:
        name = os.path.basename(os.path.dirname(run.rstrip("/\\"))) + "-" + os.path.basename(run.rstrip("/\\"))
        items = run_items(run)
        tiles = []
        for p, mood in items:
            rgb = load(p)
            g = apply_lut(rgb, lut_of(grade, mood))
            d = per.setdefault(mood, {"before": [], "after": [], "imgB": [], "imgA": []})
            d["before"].append(look_metrics(rgb))
            d["after"].append(look_metrics(g))
            d["imgB"].append(rgb[::4, ::4])
            d["imgA"].append(g[::4, ::4])
            tiles.append((os.path.splitext(os.path.basename(p))[0] + " " + mood, rgb, g))
        # before / after sheet: pairs side by side, 6 pairs per row, every 2nd still (enough to look at)
        tw, th = 135, 240
        pick = tiles[::2]
        cols = 6
        rows = (len(pick) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * (2 * tw + 8), rows * (th + 16)), (20, 20, 20))
        dr = ImageDraw.Draw(sheet)
        for k, (lbl, b, g) in enumerate(pick):
            x, y = (k % cols) * (2 * tw + 8), (k // cols) * (th + 16)
            sheet.paste(Image.fromarray((b * 255).astype(np.uint8)).resize((tw, th)), (x, y + 16))
            sheet.paste(Image.fromarray((np.clip(g, 0, 1) * 255).astype(np.uint8)).resize((tw, th)), (x + tw, y + 16))
            dr.text((x + 3, y + 2), lbl + "  before | after", fill=(255, 255, 0))
        sp = os.path.join(outd, "beforeafter_%s.jpg" % name)
        sheet.save(sp, quality=85)
        sheets.append(sp)
    # metrics + palette swatches per mood
    metrics = {}
    sw = Image.new("RGB", (900, 60 + 130 * len(MOODS)), (24, 24, 24))
    dr = ImageDraw.Draw(sw)
    y = 10
    dr.text((10, y), "palette per mood (k-means 8, bar width = share): ours before / ours after / reference", fill=(255, 255, 255))
    y += 24
    for m in MOODS:
        r = ref["moods"].get(m)
        if not r:
            continue
        med = lambda L, k: round(float(np.median([x[k] for x in L])), 3)
        keys = ("sat", "bright", "beige", "contrast", "hueEntropy")
        row = {"reference": {k: round(r["look"][k], 3) for k in keys} | {"beigeHeavyPct": r["beigeHeavyPct"]}}
        dr.text((10, y), m + ("" if m in per else "  (no stills of this mood: provisional LUT)"), fill=(255, 220, 90))
        if m in per:
            d = per[m]
            for side, L in (("before", d["before"]), ("after", d["after"])):
                row[side] = {k: med(L, k) for k in keys} | {"beigeHeavyPct": round(100.0 * float(np.mean([x["beige"] > 0.4 for x in L])), 1), "stills": len(L)}
            swatch_row(dr, 90, y + 18, palette_of(d["imgB"], rng), h=30)
            swatch_row(dr, 90, y + 52, palette_of(d["imgA"], rng), h=30)
        dr.text((10, y + 26), "ours", fill=(200, 200, 200))
        dr.text((10, y + 60), "graded", fill=(200, 200, 200))
        dr.text((10, y + 94), "reference", fill=(200, 200, 200))
        swatch_row(dr, 90, y + 86, r["palette"], h=30)
        metrics[m] = row
        y += 130
    swp = os.path.join(outd, "palettes.jpg")
    sw.save(swp, quality=90)
    json.dump({"sheets": sheets, "palettes": swp, "moods": metrics}, open(os.path.join(outd, "metrics.json"), "w", encoding="utf-8"), indent=1)
    print(json.dumps(metrics, indent=1))
    print("\n".join(sheets + [swp]))


def cmd_palettes(out, files):
    """palettes <out.json> <img>... | @list.txt -> {file: [{hex, share}] x6} (the look gate page's swatches)"""
    if len(files) == 1 and files[0].startswith("@"):
        with open(files[0][1:], encoding="utf-8") as f:
            files = [ln.strip() for ln in f if ln.strip()]
    res = {}
    for p in files:
        rng = np.random.default_rng(SEED)
        rgb = load(p)
        px = rgb[~caption_mask(rgb)]
        px = px[rng.choice(len(px), size=min(3000, len(px)), replace=False)]
        cen, share = kmeans(rgb_to_oklab(px), 6, rng, iters=15)
        c = oklab_to_rgb(cen)
        res[p] = [{"hex": "#%02x%02x%02x" % tuple(int(round(v * 255)) for v in np.clip(c[j], 0, 1)), "share": round(float(share[j]), 3)} for j in range(len(cen))]
    json.dump(res, open(out, "w", encoding="utf-8"))


def args(argv):
    a = {}
    i = 0
    while i < len(argv):
        if argv[i].startswith("--"):
            a[argv[i][2:]] = argv[i + 1] if i + 1 < len(argv) else True
            i += 2
        else:
            i += 1
    return a


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    A = args(sys.argv[2:])
    if cmd == "refstats":
        cmd_refstats(A)
    elif cmd == "fit":
        cmd_fit(A)
    elif cmd == "apply":
        cmd_apply(A)
    elif cmd == "palettes":
        cmd_palettes(sys.argv[2], sys.argv[3:])
    else:
        print(__doc__)
        sys.exit(2)
