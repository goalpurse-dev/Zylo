"""Studio kits: each template's real screens as tight crops (from navCapture.mjs + templateCapture.mjs), and where its
sticker goes. python templateScreens.py <src_work dir>     -> <src_work>/screens_<template>/{s_menu,s_input}.jpg, spots.json
"""
import json, os, sys
from PIL import Image

root = sys.argv[1]
# (the menu crop, the input crop) in CSS px of 1280x860
T = {"blocky_stories": ((10, 240, 500, 620), (236, 80, 692, 500)), "cutaway": ((10, 90, 500, 480), (236, 130, 668, 480)), "long_form": ((0, 40, 560, 440), (120, 130, 1200, 560))}
for t, (menu, inp) in T.items():
    d = os.path.join(root, f"screens_{t}"); nav = json.load(open(os.path.join(d, "nav", "nav.json"), encoding="utf-8"))
    last = nav["steps"][-1]; x0, y0, x1, y1 = menu
    Image.open(os.path.join(d, "nav", last["before"])).convert("RGB").crop((x0 * 3, y0 * 3, x1 * 3, y1 * 3)).save(os.path.join(d, "s_menu.jpg"), quality=94)
    tap = last["tap"]; spots = {"s_menu": {"x": (tap[0] - x0) / (x1 - x0), "y": (tap[1] - y0) / (y1 - y0), "ty": 0.08 if (tap[1] - y0) / (y1 - y0) > 0.4 else 0.86}, "s_input": {"x": 0.5, "y": 0.4, "ty": 0.1}, "typed": {"x": 0.5, "y": 0.35, "ty": 0.75}}
    start = os.path.join(d, "start", "shots", "00_start.png")
    if os.path.exists(start):
        x0, y0, x1, y1 = inp
        Image.open(start).convert("RGB").crop((x0 * 3, y0 * 3, x1 * 3, y1 * 3)).save(os.path.join(d, "s_input.jpg"), quality=94)
    json.dump(spots, open(os.path.join(d, "spots.json"), "w"), indent=1)
    print(t, os.listdir(d))
