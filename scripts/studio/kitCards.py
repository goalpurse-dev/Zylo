"""Zyvo Studio reuse kit: the step cards of a reused creation (owner, 2026-10-30), from REAL screens and REAL outputs.
  step1  the real menu path (copied from the recorded navigation)
  step2  the creation's own input re-entered on the internal account (inputCapture.mjs), cropped like the live run
  step3  its real scene pictures appearing one by one (a grid of the actual images)
  step4  its real clips (one still from the middle of each clip)
  step5  its real final video (a frame)
No time badges: nobody measured how long the owner's creation took (only a live recorded run has times).
    python kitCards.py <kit json> <out cards dir>
"""
import json, os, shutil, sys
from PIL import Image

K = json.load(open(sys.argv[1], encoding="utf-8")); out = sys.argv[2]
os.makedirs(out, exist_ok=True)
cards = {}
W, H = 1104, 1480          # step 3–5 cards: the same aspect as the live run's right panel (0.746)
BG = (11, 12, 14)

# step 1: the recorded navigation
nav = json.load(open(os.path.join(K["nav_cards"], "cards.json"), encoding="utf-8"))["step1"]
for f in nav["frames"]: shutil.copy(os.path.join(K["nav_cards"], f["file"]), os.path.join(out, f["file"]))
cards["step1"] = nav

# step 2: the input screens re-entered (3x screenshots of the 1280x860 page), the live run's crop
x0, y0, x1, y1 = 236, 290, 692, 845
inp = json.load(open(os.path.join(K["input_dir"], "input.json"), encoding="utf-8"))
frames = []
for i, s in enumerate(inp["steps"]):
    im = Image.open(os.path.join(K["input_dir"], s["file"])).convert("RGB").crop((x0 * 3, y0 * 3, x1 * 3, y1 * 3))
    f = f"step2_{i:02d}.jpg"; im.save(os.path.join(out, f), quality=94)
    tap = s.get("tap")
    frames.append({"file": f, "t": None, "tap": [(tap[0] - x0) / (x1 - x0), (tap[1] - y0) / (y1 - y0)] if tap else None})
cards["step2"] = {"frames": frames, "aspect": (x1 - x0) / (y1 - y0), "label": f"its own input re-entered ({inp.get('how')})", "nav": False}


def fit(im, w, h):
    k = max(w / im.width, h / im.height); im = im.resize((int(im.width * k + 0.5), int(im.height * k + 0.5)), Image.LANCZOS)
    return im.crop(((im.width - w) // 2, (im.height - h) // 2, (im.width - w) // 2 + w, (im.height - h) // 2 + h))


# step 3: the scene pictures appearing one by one in a grid
pics = [Image.open(p).convert("RGB") for p in K["scene_images"]]
n = len(pics); cols = 2 if n <= 4 else 3; rows = (n + cols - 1) // cols; gap = 18
cw = (W - gap * (cols + 1)) // cols; ch = min(int(cw * 16 / 9), (H - gap * (rows + 1)) // rows)
top = (H - (rows * ch + (rows - 1) * gap)) // 2
frames = []
for k in range(1, n + 1):
    can = Image.new("RGB", (W, H), BG)
    for i in range(n):
        r, c = divmod(i, cols); x = gap + c * (cw + gap); y = top + r * (ch + gap)
        can.paste(fit(pics[i], cw, ch) if i < k else Image.new("RGB", (cw, ch), (30, 32, 36)), (x, y))
    f = f"step3_{k - 1:02d}.jpg"; can.save(os.path.join(out, f), quality=93); frames.append({"file": f, "t": None, "tap": None})
cards["step3"] = {"frames": frames, "aspect": W / H, "label": "its real scene pictures", "nav": False}

# step 4: its clips, one still each, big
frames = []
for i, p in enumerate(K["clip_stills"]):
    f = f"step4_{i:02d}.jpg"; fit(Image.open(p).convert("RGB"), W, H).save(os.path.join(out, f), quality=93); frames.append({"file": f, "t": None, "tap": None})
cards["step4"] = {"frames": frames, "aspect": W / H, "label": "its real clips", "nav": False}

# step 5: the final video
f = "step5_00.jpg"; fit(Image.open(K["final_still"]).convert("RGB"), W, H).save(os.path.join(out, f), quality=93)
cards["step5"] = {"frames": [{"file": f, "t": None, "tap": None}], "aspect": W / H, "label": "its real final video", "nav": False}

json.dump(cards, open(os.path.join(out, "cards.json"), "w", encoding="utf-8"), indent=1)
print({k: len(v["frames"]) for k, v in cards.items()})
