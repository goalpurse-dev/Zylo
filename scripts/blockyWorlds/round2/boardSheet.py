"""ROUND 2 STORYBOARD SHEET (owner 2026-11-21): one still per shot, its line written under it, the MUST SEE, a green (pass)
or red (fail) frame and the check's words for a failed shot. Several pages of 24 shots if needed.
    python boardSheet.py <board.json> <out.jpg>"""
import json
import os
import sys
import textwrap

from PIL import Image, ImageDraw, ImageFont

data = json.load(open(sys.argv[1], encoding="utf8"))
out = sys.argv[2]
rows = data["rows"]
TW, TH, COLS, PER = 216, 384, 6, 24
CAP = 150
try:
    F = ImageFont.truetype("arialbd.ttf", 22)
    FB = ImageFont.truetype("arialbd.ttf", 14)
    FS = ImageFont.truetype("arial.ttf", 13)
except OSError:
    F = FB = FS = ImageFont.load_default()
pages = [rows[k:k + PER] for k in range(0, len(rows), PER)]
for pi, page in enumerate(pages):
    nrow = (len(page) + COLS - 1) // COLS
    W, H = COLS * (TW + 12) + 12, 60 + nrow * (TH + CAP + 14)
    sheet = Image.new("RGB", (W, H), (18, 18, 24))
    d = ImageDraw.Draw(sheet)
    npass = sum(1 for r in rows if r["ok"])
    d.text((12, 16), "%s  |  storyboard %d/%d  |  %d of %d shots pass the picture check" % (data["title"], pi + 1, len(pages), npass, len(rows)), font=F, fill=(255, 255, 255))
    for k, r in enumerate(page):
        x, y = 12 + (k % COLS) * (TW + 12), 60 + (k // COLS) * (TH + CAP + 14)
        col = (90, 200, 110) if r["ok"] else (230, 80, 80)
        if r.get("png") and os.path.exists(r["png"]):
            im = Image.open(r["png"]).convert("RGB").resize((TW, TH))
            sheet.paste(im, (x, y))
        else:
            d.rectangle([x, y, x + TW, y + TH], fill=(40, 20, 20))
            d.text((x + 10, y + 20), "no still (crashed)", font=FB, fill=(255, 140, 140))
        d.rectangle([x - 2, y - 2, x + TW + 1, y + TH + 1], outline=col, width=3)
        d.text((x + 6, y + 6), "%d  L%d  %s" % (r["id"], r["line"], r["camera"]), font=FB, fill=(255, 255, 255), stroke_width=2, stroke_fill=(0, 0, 0))
        ty = y + TH + 6
        for ln in textwrap.wrap('"%s"' % r["text"], 30)[:3]:
            d.text((x, ty), ln, font=FB, fill=(255, 255, 255)); ty += 17
        for ln in textwrap.wrap("SEE: %s" % r["must_see"], 34)[:3]:
            d.text((x, ty), ln, font=FS, fill=(190, 230, 140)); ty += 15
        if not r["ok"] and r.get("problem"):
            for ln in textwrap.wrap("X %s" % r["problem"], 34)[:2]:
                d.text((x, ty), ln, font=FS, fill=(255, 140, 140)); ty += 15
    name = out if len(pages) == 1 else out.replace(".jpg", "_%d.jpg" % (pi + 1))
    sheet.save(name, quality=88)
    print(name)
