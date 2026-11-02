"""Step cards for a Studio video, cut from the REAL 3x screenshots of live recordings. One feature per crop so it
reads on a phone. A card is a flipbook of real screens; every frame can carry its own tap (where the real click was,
shown just before the next screen appears) and the real time since the first click.
    python cards.py <run dir> <out dir> <template json> [nav dir]
The template's "cards" give, per step, either:
  "nav": true            the navigation recorded by navCapture.mjs (nav dir): each screen before a click + its tap, then the end
  "frames": [{"shot": "<name part>", "tap": [x, y]?}, ...]   chosen screenshots of the run, in order
  "range": [a, b], "every": n                                a stretch of progress screenshots (no taps)
and "crop": [x0, y0, x1, y1] in CSS px of the 1280x860 page.
"""
import json, os, re, sys
from PIL import Image

run, out, tpl = sys.argv[1], sys.argv[2], sys.argv[3]
nav_dir = sys.argv[4] if len(sys.argv) > 4 else None
T = json.load(open(tpl, encoding="utf-8"))
os.makedirs(out, exist_ok=True)
shots = sorted(os.listdir(os.path.join(run, "shots")))
cards = {}
for key, c in T["cards"].items():
    picks = []   # (path, seconds since the first click, tap in CSS px or None)
    if c.get("nav"):
        nav = json.load(open(os.path.join(nav_dir, "nav.json"), encoding="utf-8"))
        picks = [(os.path.join(nav_dir, s["before"]), 0, s["tap"]) for s in nav["steps"]] + [(os.path.join(nav_dir, nav["end"]), 0, None)]
    elif "frames" in c:
        for f in c["frames"]:
            n = next(s for s in shots if f["shot"] in s)
            picks.append((os.path.join(run, "shots", n), int(re.match(r"\d+_(\d+)s_", n).group(1)), f.get("tap")))
    else:
        a, b = c["range"]; names = [s for s in shots if a <= int(s[:3]) <= b]
        sel = names[:: c.get("every", 1)]
        if names and names[-1] not in sel: sel.append(names[-1])
        picks = [(os.path.join(run, "shots", n), int(re.match(r"\d+_(\d+)s_", n).group(1)), None) for n in sel]
    x0, y0, x1, y1 = c["crop"]
    frames = []
    for i, (path, secs, tap) in enumerate(picks):
        im = Image.open(path).convert("RGB").crop((x0 * 3, y0 * 3, x1 * 3, y1 * 3))
        f = f"{key}_{i:02d}.jpg"; im.save(os.path.join(out, f), quality=94)
        frames.append({"file": f, "t": secs, "tap": [(tap[0] - x0) / (x1 - x0), (tap[1] - y0) / (y1 - y0)] if tap else None})
    cards[key] = {"frames": frames, "aspect": (x1 - x0) / (y1 - y0), "label": c.get("label"), "nav": bool(c.get("nav"))}
    print(key, len(frames), "frames", f"{x1 - x0}x{y1 - y0} css", "taps:", sum(1 for f in frames if f["tap"]))
json.dump(cards, open(os.path.join(out, "cards.json"), "w"), indent=1)
