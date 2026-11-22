"""REPLICA compare sheet (local, free): per card the REFERENCE start | OURS start | REFERENCE end | OURS end, its words
under them. Pages of 8 cards.   python compareSheet.py <compare.json> <out.jpg>"""
import json
import os
import sys
import textwrap

from PIL import Image, ImageDraw, ImageFont

rows = json.load(open(sys.argv[1], encoding="utf8"))["rows"]
out = sys.argv[2]
TW, TH, PER, COLS, CAP = 135, 240, 8, 2, 58
try:
    F = ImageFont.truetype("arialbd.ttf", 20)
    FB = ImageFont.truetype("arialbd.ttf", 12)
    FS = ImageFont.truetype("arial.ttf", 11)
except OSError:
    F = FB = FS = ImageFont.load_default()
CW = 4 * TW + 3 * 4
names = []
for pi in range(0, len(rows), PER):
    page = rows[pi:pi + PER]
    nrow = (len(page) + COLS - 1) // COLS
    W, H = COLS * (CW + 20) + 20, 50 + nrow * (TH + CAP + 22)
    sh = Image.new("RGB", (W, H), (16, 16, 22))
    d = ImageDraw.Draw(sh)
    d.text((20, 14), "REPLICA (internal test): reference vs ours, start | start | end | end", font=F, fill=(255, 255, 255))
    for k, r in enumerate(page):
        x, y = 20 + (k % COLS) * (CW + 20), 50 + (k // COLS) * (TH + CAP + 22)
        for j, (key, lab, col) in enumerate((("refStart", "REF", (200, 200, 210)), ("ourStart", "OURS", (255, 210, 120)), ("refEnd", "REF end", (200, 200, 210)), ("ourEnd", "OURS end", (255, 210, 120)))):
            xx = x + j * (TW + 4)
            p = r.get(key)
            if p and os.path.exists(p):
                sh.paste(Image.open(p).convert("RGB").resize((TW, TH)), (xx, y))
            else:
                d.rectangle([xx, y, xx + TW, y + TH], fill=(50, 20, 20))
            d.text((xx + 3, y + 3), ("%d " % r["k"] if j == 0 else "") + lab, font=FB, fill=col, stroke_width=2, stroke_fill=(0, 0, 0))
        ty = y + TH + 5
        for ln in textwrap.wrap('"%s"' % r["words"], 80)[:2]:
            d.text((x, ty), ln, font=FB, fill=(255, 255, 255)); ty += 15
        d.text((x, ty), r["what"][:96], font=FS, fill=(170, 220, 140))
    name = out.replace(".jpg", "_%d.jpg" % (pi // PER + 1))
    sh.save(name, quality=86)
    names.append(name)
print("\n".join(names))
