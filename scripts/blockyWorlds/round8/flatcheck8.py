# THE FREE FLAT-SURFACE CHECK, round 8 (owner 2026-11-23, item 22): a shaded wall or pavement filling the frame fails.
# The biggest SMOOTH region on a tiny copy of the still (24 x 43): a flood fill that grows while neighbouring pixels
# differ by at most STEP per channel. At this size a shaded wall / a lit pavement is one region (round 7: the walls that
# passed the old check measured 0.58-0.78 here, the white deck 0.46, good stills at most 0.43). Fail at > 0.45.
# Prints JSON {png: share}.   python flatcheck8.py a.png b.png ...
import sys, json
from PIL import Image

STEP = 10
W, H = 24, 43


def flat_share(p):
    im = Image.open(p).convert("RGB").resize((W, H))
    px = im.load()
    seen = bytearray(W * H)
    best = 0
    for sy in range(H):
        for sx in range(W):
            if seen[sy * W + sx]:
                continue
            seen[sy * W + sx] = 1
            stack, n = [(sx, sy)], 0
            while stack:
                x, y = stack.pop()
                n += 1
                c = px[x, y]
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < W and 0 <= ny < H and not seen[ny * W + nx]:
                        d = px[nx, ny]
                        if abs(d[0] - c[0]) <= STEP and abs(d[1] - c[1]) <= STEP and abs(d[2] - c[2]) <= STEP:
                            seen[ny * W + nx] = 1
                            stack.append((nx, ny))
            best = max(best, n)
    return best / float(W * H)


print(json.dumps({p: round(flat_share(p), 3) for p in sys.argv[1:]}))
