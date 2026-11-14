"""World library stills: one labelled sheet per world (tiles from the kit's preview mode, labelled place + spot).
    python sheet.py <tiles dir> <shots.json> <out dir>"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

tiles, shots, out = sys.argv[1], json.load(open(sys.argv[2], encoding="utf-8")), sys.argv[3]
groups = {}
for s in shots:
    w = "dressing" if s["desc"].startswith("dress") else s["place"].split("_")[0]
    w = {"living": "suburb", "bedroom": "suburb", "kitchen": "suburb", "shop": "shared", "big": "shared", "classroom": "shared", "hallway": "shared",
         "plane": "kit", "cockpit": "kit", "moon": "kit", "sky": "kit"}.get(w, w)
    groups.setdefault(w, []).append(s)
try:
    font = ImageFont.truetype("arialbd.ttf", 15)
except OSError:
    font = ImageFont.load_default()
for w, ss in groups.items():
    cols = min(6, len(ss))
    rows = -(-len(ss) // cols)
    W, H, L = 270, 480, 22
    sheet = Image.new("RGB", (cols * W, rows * (H + L)), (18, 18, 22))
    dr = ImageDraw.Draw(sheet)
    for k, s in enumerate(ss):
        p = os.path.join(tiles, "shot_%02d.png" % s["id"])
        x, y = (k % cols) * W, (k // cols) * (H + L)
        if os.path.exists(p):
            sheet.paste(Image.open(p).convert("RGB").resize((W, H)), (x, y + L))
        else:
            dr.text((x + 10, y + 200), "FAILED", fill=(255, 80, 80), font=font)
        dr.text((x + 4, y + 3), s["desc"][:36], fill=(255, 220, 80), font=font)
    sheet.save(os.path.join(out, "world_%s.jpg" % w), quality=86)
    print(os.path.join(out, "world_%s.jpg" % w))
