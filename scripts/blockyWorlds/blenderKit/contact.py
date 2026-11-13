"""Blender kit engine: contact sheet of a finished video, one frame per second, each labelled with its time.
    python contact.py <video.mp4> <sheet.jpg> [every_s=1.0] [cols=12]
Reads the real encode (ffmpeg on PATH), tiles 216x384 thumbnails, labels them "12s"."""
import os
import subprocess
import sys
import tempfile

from PIL import Image, ImageDraw, ImageFont

src, out = sys.argv[1], sys.argv[2]
every = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0
cols = int(sys.argv[4]) if len(sys.argv) > 4 else 12
W, H, LBL = 216, 384, 24
with tempfile.TemporaryDirectory() as tmp:
    # output frame k = the input frame nearest k * every seconds (ffmpeg fps filter, start at 0)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-vf", f"fps=1/{every}:start_time=0,scale={W}:{H}",
                    os.path.join(tmp, "f_%04d.png")], check=True)
    files = sorted(f for f in os.listdir(tmp) if f.endswith(".png"))
    rows = -(-len(files) // cols)
    sheet = Image.new("RGB", (cols * W, rows * (H + LBL)), (18, 18, 22))
    dr = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("arialbd.ttf", 18)
    except OSError:
        font = ImageFont.load_default()
    for k, f in enumerate(files):
        x, y = (k % cols) * W, (k // cols) * (H + LBL)
        sheet.paste(Image.open(os.path.join(tmp, f)).convert("RGB"), (x, y + LBL))
        dr.text((x + 6, y + 2), f"{k * every:.0f}s", fill=(255, 220, 80), font=font)
sheet.save(out, quality=86)
print(out, len(files), "frames")
