"""ROUND 2 SCENE STORYBOARD (owner 2026-11-21): each card's START and END still side by side, its words under them (+ the
seconds, the camera, the motion on words, the sfx), a green (pass) or red (fail) frame. Pages of 12 cards.
    python sceneSheet.py <sheet.json> <out.jpg>"""
import json
import os
import sys
import textwrap

from PIL import Image, ImageDraw, ImageFont

data = json.load(open(sys.argv[1], encoding="utf8"))
out = sys.argv[2]
rows = data["rows"]
TW, TH, COLS, PER, CAP = 170, 302, 4, 12, 132
try:
    F = ImageFont.truetype("arialbd.ttf", 22)
    FB = ImageFont.truetype("arialbd.ttf", 14)
    FS = ImageFont.truetype("arial.ttf", 12)
except OSError:
    F = FB = FS = ImageFont.load_default()
CW = 2 * TW + 6
pages = [rows[k:k + PER] for k in range(0, len(rows), PER)]
names = []
for pi, page in enumerate(pages):
    nrow = (len(page) + COLS - 1) // COLS
    W, H = COLS * (CW + 18) + 18, 58 + nrow * (TH + CAP + 22)
    sheet = Image.new("RGB", (W, H), (18, 18, 24))
    d = ImageDraw.Draw(sheet)
    npass = sum(1 for r in rows if r["ok"])
    d.text((18, 16), "%s  |  page %d/%d  |  %d of %d cards pass (start + end)" % (data["title"], pi + 1, len(pages), npass, len(rows)), font=F, fill=(255, 255, 255))
    for k, r in enumerate(page):
        x, y = 18 + (k % COLS) * (CW + 18), 58 + (k // COLS) * (TH + CAP + 22)
        col = (90, 200, 110) if r["ok"] else (230, 80, 80)
        d.rectangle([x - 3, y - 3, x + CW + 2, y + TH + 2], outline=col, width=3)
        for j, key in enumerate(("start", "end")):
            p = r.get(key)
            xx = x + j * (TW + 6)
            if p and os.path.exists(p):
                sheet.paste(Image.open(p).convert("RGB").resize((TW, TH)), (xx, y))
            else:
                d.rectangle([xx, y, xx + TW, y + TH], fill=(40, 20, 20))
                d.text((xx + 8, y + 20), "no still", font=FB, fill=(255, 140, 140))
            d.text((xx + 5, y + 5), ("%d START" % r["id"]) if j == 0 else "END", font=FB, fill=(255, 255, 255), stroke_width=2, stroke_fill=(0, 0, 0))
        ty = y + TH + 6
        for ln in textwrap.wrap('"%s" (%.1f s)' % (r["words"], r["secs"]), 48)[:3]:
            d.text((x, ty), ln, font=FB, fill=(255, 255, 255)); ty += 17
        for ln in textwrap.wrap("cam %s | %s" % (r["cam"], r["motion"] or "no motion"), 58)[:2]:
            d.text((x, ty), ln, font=FS, fill=(190, 230, 140)); ty += 14
        if r.get("sfx"):
            d.text((x, ty), ("sfx: " + r["sfx"])[:60], font=FS, fill=(140, 200, 255)); ty += 14
        if not r["ok"] and r.get("problem"):
            for ln in textwrap.wrap("X " + r["problem"], 58)[:2]:
                d.text((x, ty), ln, font=FS, fill=(255, 140, 140)); ty += 14
    name = out if len(pages) == 1 else out.replace(".jpg", "_%d.jpg" % (pi + 1))
    sheet.save(name, quality=88)
    names.append(name)
print("\n".join(names))
