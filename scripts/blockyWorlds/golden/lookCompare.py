"""THE LOOK GOLDEN SHEET (owner 2026-11-21): before vs after, one row per golden story, each shot as a BEFORE | AFTER
pair, with the caption band (62-76 % of the height) marked on the after tiles so a face under the captions shows.
    python -I lookCompare.py <before dir> <after dir> <out.jpg>"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

bdir, adir, out = sys.argv[1], sys.argv[2], sys.argv[3]
shots = json.load(open(os.path.join(adir, "shots.json"), encoding="utf8"))
TW, TH, GAP, HEAD, LBL = 270, 480, 10, 56, 30
try:
    F = ImageFont.truetype("arialbd.ttf", 20)
    FS = ImageFont.truetype("arial.ttf", 16)
except OSError:
    F = FS = ImageFont.load_default()
stories = []
for s in shots:
    if s["story"] not in stories:
        stories.append(s["story"])
TITLES = {"day": "DAY STORY (downtown)", "night": "NIGHT STORY (brick city)", "monster": "MONSTER STORY (suburb, night)", "rooms": "ROOMS + THE KIT'S SETS (living room, shop, classroom)"}
KIND = {"wide": "wide", "close": "close-up", "two": "two-person", "monster": "monster shot", "room": "room", "set": "kit set"}
cols = 6
W = cols * TW + (cols - 1) * GAP + 2 * GAP
H = len(stories) * (LBL + 22 + TH + GAP) + HEAD + GAP
sheet = Image.new("RGB", (W, H), (18, 18, 24))
d = ImageDraw.Draw(sheet)
d.text((GAP, 14), "In This Town, Blender engine: BEFORE vs AFTER (upgrade round 1). Pink lines = caption band.", font=F, fill=(255, 255, 255))
y = HEAD
for st in stories:
    d.text((GAP, y), TITLES.get(st, st), font=F, fill=(190, 242, 100))
    y += LBL
    x = GAP
    for s in [s for s in shots if s["story"] == st]:
        for side, dd in (("BEFORE", bdir), ("AFTER", adir)):
            p = os.path.join(dd, "preview", "shot_%02d.png" % s["id"])
            d.text((x, y), "%s %s" % (KIND.get(s["kind"], s["kind"]), side.lower()), font=FS, fill=(255, 210, 120) if side == "AFTER" else (200, 200, 210))
            if os.path.exists(p):
                im = Image.open(p).convert("RGB").resize((TW, TH))
                if side == "AFTER":
                    dr = ImageDraw.Draw(im)
                    for fr in (0.62, 0.76):
                        dr.line([(0, int(TH * fr)), (TW, int(TH * fr))], fill=(255, 90, 170), width=2)
                sheet.paste(im, (x, y + 22))
            else:
                d.rectangle([x, y + 22, x + TW, y + 22 + TH], outline=(120, 60, 60), width=2)
                d.text((x + 10, y + 40), "not rendered", font=FS, fill=(255, 120, 120))
            x += TW + GAP
    y += 22 + TH + GAP
sheet.save(out, quality=90)
print(out)
