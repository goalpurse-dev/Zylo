# THE FREE FLAT-COLOUR CHECK (round 7): more than half of a still is ONE flat surface = fail (a wall / the sky / the
# ground filling the lens, a glare blob). Measured as the biggest SMOOTH region on a small copy of the still: a flood
# fill that grows while neighbouring pixels differ by at most STEP per channel, so a shaded wall or a gradient sky
# still counts as one surface, while a street with people, houses and edges breaks into many regions.
# Prints JSON {png: share of the frame in the biggest smooth region}.
#   python flatcheck.py a.png b.png ...
import sys, json
from PIL import Image

STEP = 5
W, H = 72, 128


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
