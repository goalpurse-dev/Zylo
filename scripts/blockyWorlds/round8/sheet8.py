"""ROUND 8 STORYBOARD: each line card's FIRST / ACTION / LAST stills side by side (the camera on the running scene), the
words, the cuts, the actions, a green (pass) or red (fail) frame, a CONTINUITY mark (the first still vs the line before's
last still). Pages of 9 cards.   python sheet8.py <sheet.json> <out.jpg>"""
import json
import sys
import textwrap

from PIL import Image, ImageDraw, ImageFont

data = json.load(open(sys.argv[1], encoding="utf8"))
out = sys.argv[2]
rows = data["rows"]
TW, TH, COLS, PER, CAP = 150, 266, 3, 9, 150
try:
    F = ImageFont.truetype("arialbd.ttf", 22)
    FB = ImageFont.truetype("arialbd.ttf", 14)
    FS = ImageFont.truetype("arial.ttf", 12)
except OSError:
    F = FB = FS = ImageFont.load_default()
CW = 3 * TW + 8
pages = [rows[k:k + PER] for k in range(0, len(rows), PER)]
names = []
npass = sum(1 for r in rows if r["ok"])
for pi, page in enumerate(pages):
    nrow = (len(page) + COLS - 1) // COLS
    W, H = COLS * (CW + 18) + 18, 58 + nrow * (TH + CAP + 22)
    sheet = Image.new("RGB", (W, H), (18, 18, 24))
    d = ImageDraw.Draw(sheet)
    d.text((18, 16), "%s  |  page %d/%d  |  %d of %d cards pass  |  %s" % (data["title"], pi + 1, len(pages), npass, len(rows), data.get("note", "")), font=F, fill=(255, 255, 255))
    for i, r in enumerate(page):
        x = 18 + (i % COLS) * (CW + 18)
        y = 58 + (i // COLS) * (TH + CAP + 22)
        col = (60, 200, 90) if r["ok"] else (220, 60, 60)
        d.rectangle([x - 4, y - 4, x + CW + 3, y + TH + 3], outline=col, width=4)
        for j, (lab, p) in enumerate(r["stills"]):
            px = x + j * (TW + 4)
            if p:
                try:
                    im = Image.open(p).convert("RGB").resize((TW, TH))
                    sheet.paste(im, (px, y))
                except OSError:
                    pass
            d.rectangle([px, y, px + 64, y + 18], fill=(0, 0, 0))
            d.text((px + 3, y + 2), "%d %s" % (r["id"], lab), font=FB, fill=(255, 255, 255))
        cy = y + TH + 8
        if r.get("cont") is not None:
            d.text((x + CW - 120, cy - 2), "continuity " + ("ok" if r["cont"] else "BREAK"), font=FB, fill=(120, 220, 140) if r["cont"] else (255, 120, 120))
        for k, line in enumerate(textwrap.wrap('"%s" (%.1f s)' % (r["words"], r["secs"]), 62)[:2]):
            d.text((x, cy + k * 16), line, font=FB, fill=(255, 255, 255))
        cy += 34
        for line in textwrap.wrap(r["cam"], 80)[:2]:
            d.text((x, cy), line, font=FS, fill=(170, 200, 255)); cy += 14
        for line in textwrap.wrap(r["acts"], 80)[:2]:
            d.text((x, cy), line, font=FS, fill=(200, 230, 170)); cy += 14
        if r.get("problem"):
            for line in textwrap.wrap("X " + r["problem"], 80)[:4]:
                d.text((x, cy), line, font=FS, fill=(255, 140, 140)); cy += 14
    nm = out if len(pages) == 1 else out.replace(".jpg", "_%d.jpg" % (pi + 1))
    sheet.save(nm, quality=88)
    names.append(nm)
print("\n".join(names))
