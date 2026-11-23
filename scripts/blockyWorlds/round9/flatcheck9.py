# THE FREE FLAT-SURFACE CHECK, round 9b: a LIT wall / pavement / roof filling the frame fails; the night's darkness does
# not count (the reference's own night frames are mostly near-black, round 9b: the round 8 check failed every night
# shot). The biggest smooth region of pixels brighter than DARK on a 24 x 43 copy (step 10), as a share of the frame.
#   python flatcheck9.py a.png ...   -> JSON {png: share}
import sys, json
from PIL import Image

STEP, W, H, DARK = 10, 24, 43, 34


def flat_share(p):
    im = Image.open(p).convert("RGB").resize((W, H))
    px = im.load()
    seen = bytearray(W * H)
    best = 0
    lum = lambda c: 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]
    for sy in range(H):
        for sx in range(W):
            if seen[sy * W + sx]:
                continue
            seen[sy * W + sx] = 1
            if lum(px[sx, sy]) < DARK:
                continue
            stack, n = [(sx, sy)], 0
            while stack:
                x, y = stack.pop()
                n += 1
                c = px[x, y]
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < W and 0 <= ny < H and not seen[ny * W + nx]:
                        d = px[nx, ny]
                        if lum(d) >= DARK and abs(d[0] - c[0]) <= STEP and abs(d[1] - c[1]) <= STEP and abs(d[2] - c[2]) <= STEP:
                            seen[ny * W + nx] = 1
                            stack.append((nx, ny))
            best = max(best, n)
    return best / float(W * H)


print(json.dumps({p: round(flat_share(p), 3) for p in sys.argv[1:]}))
