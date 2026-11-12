"""Small JPEG thumbnails for the comparison page.

usage: python thumbs.py <out_dir> <width> @list.txt     (list lines: "<src path>\t<out name>")
"""
import os
import sys

from PIL import Image


def main():
    out, w, lst = sys.argv[1], int(sys.argv[2]), sys.argv[3][1:]
    os.makedirs(out, exist_ok=True)
    with open(lst, encoding="utf-8") as f:
        for ln in f:
            if not ln.strip():
                continue
            src, name = ln.rstrip("\n").split("\t")
            im = Image.open(src).convert("RGB")
            im.resize((w, int(round(im.height * w / im.width)))).save(os.path.join(out, name), quality=82)


if __name__ == "__main__":
    main()
