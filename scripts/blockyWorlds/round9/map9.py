# THE SCENE MAPS (owner round 9i): on each scene's top-down render: every zone outlined and labelled, the rule's allowed
# zones in green (forbidden at night in red), and a named dot per character / pet / car / prop at the start and end of
# each line, with the plan's zone next to the measured one (a mismatch in red). argv: done.json plan_zones.json out_dir
import sys, json, os
from PIL import Image, ImageDraw, ImageFont

done = json.load(open(sys.argv[1], encoding="utf-8"))
plan = json.load(open(sys.argv[2], encoding="utf-8"))
out = sys.argv[3]
try:
    F = ImageFont.truetype("arial.ttf", 20)
    FS = ImageFont.truetype("arial.ttf", 15)
    FB = ImageFont.truetype("arialbd.ttf", 26)
except Exception:
    F = FS = FB = ImageFont.load_default()
COL = {"home_inside": (200, 200, 200), "home_doorway": (255, 220, 60), "home_window": (120, 200, 255), "home_line_edge": (120, 255, 140),
       "home_yard": (60, 200, 90), "neighbor_yard": (40, 140, 60), "front_lawn": (255, 150, 60), "pavement": (220, 120, 255), "kerb": (255, 90, 200), "road": (255, 70, 70)}
WHO = {"me": (255, 60, 60), "dad": (90, 170, 255), "guy": (255, 200, 0), "monster": (20, 20, 20)}
sheets = []
for sc in plan["scenes"]:
    sid = str(sc["id"])
    png = done["pngs"].get(sid)
    if not png:
        continue
    im = Image.open(png).convert("RGB")
    W, H = im.size
    S = 1080.0 / W
    im = im.resize((1080, int(H * S)))
    W, H = im.size
    ov = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    tag = "M" + sid
    allowed = set(plan["rule_zones"].get(sc["time"], []) or [])
    labelled = set()
    for g in done["gate"]:
        p = g.split("|")
        if len(p) < 5 or p[1] != tag or p[2] != "zone":
            continue
        name = p[3]
        pts = []
        for q in p[4].split(";"):
            try:
                u, v = q.split(",")[:2]
                pts.append((float(u) * W, float(v) * H))
            except Exception:
                continue
        if len(pts) < 3:
            continue
        c = COL.get(name, (255, 255, 255))
        fill = (60, 220, 90, 40) if (not allowed or name in allowed) else (230, 50, 50, 40)
        d.polygon(pts, outline=c + (255,), fill=fill)
        if name not in labelled:
            cx = sum(x for x, _ in pts) / len(pts)
            cy = sum(y for _, y in pts) / len(pts)
            cx, cy = min(W - 120, max(4, cx)), min(H - 30, max(40, cy))
            d.text((cx - 40, cy - 10), name, font=FS, fill=c + (255,))
            labelled.add(name)
    # positions: a path per character through the lines, a dot at each line's start (the number), the end dot
    tracks = {}
    for g in done["gate"]:
        p = g.split("|")
        if len(p) < 7 or p[1] != tag or p[2] != "pos" or p[5] == "-":
            continue
        who, ln, uv, zone = p[3], p[4], p[5], p[6]
        try:
            u, v = uv.split(",")[:2]
            int(ln[:-1])
            tracks.setdefault(who, []).append((ln, float(u) * W, float(v) * H, zone.strip()))
        except Exception:
            continue
    bad = []
    for who, pts in tracks.items():
        col = WHO.get(who, (255, 255, 255))
        if len(pts) > 1 and who in WHO:
            d.line([(x, y) for _, x, y, _ in pts], fill=col + (200,), width=3)
        for k, (ln, x, y, zone) in enumerate(pts):
            n = int(ln[:-1])
            want = (plan["zones"].get(str(n)) or {}).get(who)
            mism = want is not None and want != zone and not (want == "home_yard" and zone.startswith("home_"))
            r = 7 if ln.endswith("s") else 4
            d.ellipse((x - r, y - r, x + r, y + r), fill=col + (255,), outline=(255, 0, 0, 255) if mism else (255, 255, 255, 255), width=3 if mism else 1)
            if ln.endswith("s") and who in WHO:
                d.text((x + 8, y - 8), "%s L%d" % (who, n), font=FS, fill=(255, 255, 255, 255))
            if mism:
                bad.append("L%d %s: plan %s, measured %s" % (n, who, want, zone))
        if who not in WHO and pts:
            ln, x, y, zone = pts[0]
            d.text((x + 6, y - 6), who.split("#")[0], font=FS, fill=(230, 230, 230, 255))
    im = Image.alpha_composite(im.convert("RGBA"), ov).convert("RGB")
    dd = ImageDraw.Draw(im)
    dd.rectangle((0, 0, W, 34), fill=(16, 16, 20))
    dd.text((8, 4), "SCENE %s  lines %d-%d  %s  (green = allowed now, red = forbidden; red ring = not in the plan's zone)" % (sid, sc["lines"][0], sc["lines"][1], sc["time"]), font=F, fill=(255, 255, 255))
    y = 40
    for b in bad[:14]:
        dd.text((8, y), b, font=FS, fill=(255, 120, 120))
        y += 18
    fn = os.path.join(out, "map_scene%s.jpg" % sid)
    im.save(fn, quality=90)
    sheets.append(fn)
print(json.dumps(sheets))
