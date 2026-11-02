"""Zyvo Studio v2: real app screens as tight crops, one feature at a time, big enough to read on a phone (Master Prompt v2).
Cut from the 3x screenshots of the live run and navigation on the internal account (1280x860 CSS px).
    python screens.py <run shots dir> <nav shots dir> <ken input shots dir> <out dir>
"""
import os, sys
from PIL import Image

run, nav, ken, out = sys.argv[1:5]
os.makedirs(out, exist_ok=True)
CROPS = {
    "s_menu": (os.path.join(nav, "nav2_before.png"), (10, 90, 500, 540)),
    "s_ideas": (os.path.join(run, "001_0000s_story_ideas.png"), (236, 310, 692, 720)),
    "s_length": (os.path.join(run, "003_0004s_settings.png"), (236, 440, 692, 810)),
    "s_pictures": (os.path.join(run, "013_0063s_before_animate_all_scenes.png"), (710, 130, 1250, 640)),
    "s_anim": (os.path.join(run, "014_0066s_progress.png"), (710, 130, 1250, 640)),
    "s_final": (os.path.join(run, "038_0232s_final.png"), (710, 90, 1270, 640)),
    "ken_typed": (os.path.join(ken, "01_typed.png"), (236, 440, 692, 800)),
}
for name, (src, (x0, y0, x1, y1)) in CROPS.items():
    if not os.path.exists(src):
        print("missing", src); continue
    Image.open(src).convert("RGB").crop((x0 * 3, y0 * 3, x1 * 3, y1 * 3)).save(os.path.join(out, name + ".jpg"), quality=94)
    print(name, x1 - x0, "x", y1 - y0)
