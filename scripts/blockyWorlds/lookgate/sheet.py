"""Contact sheet maker for the look gate.

usage: python -I sheet.py <out_prefix> <cols> <rows> <tile_w> <img1> <img2> ...
Each tile is labelled with the image's file name (without extension).
Writes <out_prefix>_1.jpg, _2.jpg ... (cols*rows tiles per sheet).
"""
import os
import sys

from PIL import Image, ImageDraw


def main():
    prefix, cols, rows, tw = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4])
    files = sys.argv[5:]
    per = cols * rows
    for s in range(0, len(files), per):
        chunk = files[s:s + per]
        tiles = []
        for f in chunk:
            im = Image.open(f).convert("RGB")
            th = int(im.height * tw / im.width)
            tiles.append((os.path.splitext(os.path.basename(f))[0], im.resize((tw, th))))
        th = max(t[1].height for t in tiles)
        sheet = Image.new("RGB", (cols * tw, rows * (th + 16)), (20, 20, 20))
        d = ImageDraw.Draw(sheet)
        for k, (name, im) in enumerate(tiles):
            x, y = (k % cols) * tw, (k // cols) * (th + 16)
            sheet.paste(im, (x, y + 16))
            d.text((x + 3, y + 2), name, fill=(255, 255, 0))
        sheet.save(f"{prefix}_{s // per + 1}.jpg", quality=85)


if __name__ == "__main__":
    main()
