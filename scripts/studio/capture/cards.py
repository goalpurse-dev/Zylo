"""Step cards for a Studio video, cut from the REAL 3x screenshots of a live run (fruitRun.mjs). One feature per
crop so it reads on a phone. Steps 3 and 4 become flipbooks of the real progress screens, each frame labelled with
the real time since the first click (from the screenshot's name).
    python cards.py <run dir> <out dir> <template json>
The template's "cards" give, per step: the screenshots (name parts), the crop box in CSS px (x0,y0,x1,y1 on the
1280x860 page), and an optional tap point (CSS px) for the cursor.
"""
import json, os, re, sys
from PIL import Image

run, out, tpl = sys.argv[1], sys.argv[2], sys.argv[3]
T = json.load(open(tpl, encoding="utf-8"))
os.makedirs(out, exist_ok=True)
shots = sorted(os.listdir(os.path.join(run, "shots")))
cards = {}
for key, c in T["cards"].items():
    names = [s for s in shots if any(p in s for p in c["shots"])] if "shots" in c else []
    if "range" in c:
        a, b = c["range"]; names = [s for s in shots if a <= int(s[:3]) <= b]
        names = names[:: c.get("every", 1)] + ([names[-1]] if names and names[-1] not in names[:: c.get("every", 1)] else [])
    x0, y0, x1, y1 = c["crop"]
    frames = []
    for i, n in enumerate(names):
        im = Image.open(os.path.join(run, "shots", n)).convert("RGB").crop((x0 * 3, y0 * 3, x1 * 3, y1 * 3))
        f = f"{key}_{i:02d}.jpg"; im.save(os.path.join(out, f), quality=92)
        secs = int(re.match(r"\d+_(\d+)s_", n).group(1))
        frames.append({"file": f, "t": secs})
    tap = None
    if c.get("tap"):
        tap = [(c["tap"][0] - x0) / (x1 - x0), (c["tap"][1] - y0) / (y1 - y0)]   # as a fraction of the card
    cards[key] = {"frames": frames, "aspect": (x1 - x0) / (y1 - y0), "tap": tap, "label": c.get("label")}
    print(key, len(frames), "frames", f"{x1 - x0}x{y1 - y0} css")
json.dump(cards, open(os.path.join(out, "cards.json"), "w"), indent=1)
