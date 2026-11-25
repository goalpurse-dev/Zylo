# IN THIS TOWN v2: THE DARKNESS CHECK (owner 2026-11-25). After the render: a still whose subject is too dark to read
# fails. The subjects' boxes come from the render gate (zvbox lines: people's heads + chests, story objects, the
# entity); a still without subjects (an aerial) is judged on the whole picture above the captions.
#   python darkCheck.py list.json  ->  one line per still: "<png>|ok|p90" or "<png>|dark|<why>"
import json
import sys
from PIL import Image

SUBJ_P90 = 0.30      # the brightest tenth of a subject's box must reach this (0..1, sRGB luma)
FRAME_P90 = 0.24     # a still without subjects: the brightest tenth of the picture above the captions
FRAME_MEAN = 0.06


def luma_list(im, box):
    w, h = im.size
    u0, u1, v0, v1 = box
    c = im.crop((int(u0 * w), int(v0 * h), max(int(u0 * w) + 1, int(u1 * w)), max(int(v0 * h) + 1, int(v1 * h)))).convert("L")
    px = sorted(c.get_flattened_data() if hasattr(c, "get_flattened_data") else c.getdata())
    return px


def p90(px):
    return px[int(0.9 * (len(px) - 1))] / 255.0 if px else 0.0


for it in json.load(open(sys.argv[1], encoding="utf8")):
    try:
        im = Image.open(it["png"]).convert("RGB")
    except Exception as e:
        print("%s|skip|%s" % (it["png"], str(e)[:60]))
        continue
    boxes = [b for b in it.get("boxes") or [] if (b[1] - b[0]) * (b[3] - b[2]) > 0.0004]
    if boxes:
        worst = min(p90(luma_list(im, b)) for b in boxes)
        print("%s|%s|subject p90 %.2f" % (it["png"], "ok" if worst >= SUBJ_P90 else "dark", worst))
    else:
        px = luma_list(im, (0.0, 1.0, 0.0, 0.62))
        m = sum(px) / 255.0 / max(1, len(px))
        bad = p90(px) < FRAME_P90 or m < FRAME_MEAN
        print("%s|%s|frame p90 %.2f mean %.2f" % (it["png"], "dark" if bad else "ok", p90(px), m))
