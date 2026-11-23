# THE SET BEFORE / AFTER: the reference | before (an earlier round) | after, for the opening aerial and street-level shots
#   python setcompare9.py <replica dir> <before tag> <after tag> <out.jpg> <ref> [<ref> ...]
import json
import os
import sys
from PIL import Image, ImageDraw, ImageFont

D, before, after, out = sys.argv[1:5]
refs = [int(x) for x in sys.argv[5:]]
shots = json.load(open(os.path.join(D, "shots.json"), encoding="utf-8"))
A = os.path.join(D, "..", "..", "analysis", "7698966230471953677", "frames")
TW, TH = 240, 427
try:
    F = ImageFont.truetype("arialbd.ttf", 15)
except OSError:
    F = ImageFont.load_default()
s = Image.new("RGB", (3 * (TW + 10) + 10, len(refs) * (TH + 30) + 40), (18, 18, 24))
g = ImageDraw.Draw(s)
g.text((10, 10), "THE SET: reference | before (%s) | after (%s)" % (before, after), font=F, fill=(255, 255, 255))
for i, ref in enumerate(refs):
    k = next(j for j, x in enumerate(shots) if x["ref"] == ref) + 2
    pics = [os.path.join(A, "s%03d_mid.jpg" % ref), os.path.join(D, "stills_%s" % before, "preview", "shot_%02d.png" % k), os.path.join(D, "stills_%s" % after, "preview", "shot_%02d.png" % k)]
    y = 40 + i * (TH + 30)
    for j, p in enumerate(pics):
        if os.path.exists(p):
            s.paste(Image.open(p).convert("RGB").resize((TW, TH)), (10 + j * (TW + 10), y))
        g.text((14 + j * (TW + 10), y + TH + 6), "ref %d  %s" % (ref, ["reference", "before", "after"][j]), font=F, fill=(220, 220, 220))
s.save(out, quality=88)
print(out)
