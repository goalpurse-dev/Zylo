# THE REPLICA COMPARISON SHEET: per cut, the reference's mid frame | ours, the reference shot number, the recipe, the
# subject's height share of the frame (the reference's, measured by eye; ours, measured in Blender). Pages of 8.
#   python compare9.py <compare.json> <out.jpg>
import json
import sys
from PIL import Image, ImageDraw, ImageFont

d = json.load(open(sys.argv[1], encoding="utf-8"))
out = sys.argv[2]
rows = d["rows"]
TW, TH, PER, COLS = 150, 266, 8, 4
CAPH = 80
try:
    F = ImageFont.truetype("arialbd.ttf", 13)
    FS = ImageFont.truetype("arial.ttf", 11)
except OSError:
    F = FS = ImageFont.load_default()
pages = [rows[k:k + PER] for k in range(0, len(rows), PER)]
names = []
for pi, page in enumerate(pages):
    nr = (len(page) + COLS - 1) // COLS
    W, H = COLS * (2 * TW + 24) + 12, nr * (TH + CAPH) + 40
    s = Image.new("RGB", (W, H), (18, 18, 24))
    g = ImageDraw.Draw(s)
    g.text((12, 10), "REPLICA (internal) | reference | ours | %d of %d shots pass ALL conditions | page %d/%d" % (d["within"], d["measured"], pi + 1, len(pages)), font=F, fill=(255, 255, 255))
    for i, r in enumerate(page):
        x = 12 + (i % COLS) * (2 * TW + 24)
        y = 40 + (i // COLS) * (TH + CAPH)
        for j, p in enumerate((r["refPng"], r["ours"])):
            if p:
                try:
                    s.paste(Image.open(p).convert("RGB").resize((TW, TH)), (x + j * (TW + 4), y))
                except OSError:
                    pass
        ok = r.get("pass", False)
        g.rectangle([x - 2, y - 2, x + 2 * TW + 6, y + TH + 2], outline=(60, 200, 90) if ok else (230, 90, 60), width=2)
        g.text((x, y + TH + 4), "ref %s  line %s  %s" % (r["ref"], r["line"], r["spec"][:34]), font=FS, fill=(220, 220, 220))
        g.text((x, y + TH + 20), "size %s/%s  pos %s/%s" % ("-" if r["refh"] is None else "%.2f" % r["refh"], "-" if r["h"] is None else "%.2f" % r["h"], "-" if r.get("refv") is None else "%.2f" % r["refv"], "-" if r.get("v") is None else "%.2f" % r["v"]), font=FS, fill=(170, 210, 255))
        g.text((x, y + TH + 34), ("PASS" if ok else "X " + r.get("why", ""))[:58], font=FS, fill=(120, 220, 140) if ok else (255, 140, 120))
    nm = out.replace(".jpg", "_%d.jpg" % (pi + 1))
    s.save(nm, quality=86)
    names.append(nm)
print("\n".join(names))
