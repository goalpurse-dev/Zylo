"""Blender kit engine: OUR step after the kit's finish.py (the kit's files are never edited). The worker runs the kit's
finish.py with --no-captions (its mix: voice + its sound cues + OUR music; final_nocaptions.mp4), then this:
  1. the mix normalised to -14 LUFS / -1.5 dBTP (two-pass loudnorm, owner 2026-11-14: as our other videos)
  2. the captions in the KIT'S caption style (its finish.py: one word at a time, the same font, size, outline, shadow,
     position and the 1.3-frame lag), COLOURED PER SPEAKER from audio/caption_colors.json (one "#RRGGBB" or null per
     word: null = the narrator, white); burned with the kit's encode settings -> out/final.mp4
  3. out/final_nocaptions.mp4 with the normalised mix, and the phone copy remade from the new final (the kit's settings)
    post_finish(vdir, font, preset="slow") -> { lufs_before, lufs_after, colored_words }
Local check: python finishx.py --check <final_nocaptions.mp4> <words.json> <colors.json> <mix.m4a> <out dir> [seconds]"""
import json
import os
import re
import subprocess
import sys

LAG = 1.3 / 30
HEAD = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Word,{FONT},150,&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,0,0,0,0,100,100,1,0,1,9,3,5,20,20,20,1
Style: Tag,{FONT},60,&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,0,0,0,0,100,100,2,0,1,5,2,5,20,20,20,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""


def ts(t):
    cs = int(round(max(t, 0) * 100))
    return f"{cs // 360000}:{cs // 6000 % 60:02d}:{cs // 100 % 60:02d}.{cs % 100:02d}"


def ass_colour(hex_rgb):
    h = hex_rgb.lstrip("#")
    return f"&H00{h[4:6]}{h[2:4]}{h[0:2]}&".upper()


def tag_lines(words, colors, speakers):
    """round 3 (owner 2026-11-22): a small NAME TAG above a speaker's spoken words (one per run of their words), in their colour"""
    out, i = [], 0
    while speakers and i < len(words):
        who = speakers[i] if i < len(speakers) else None
        if not who:
            i += 1
            continue
        j = i
        while j + 1 < len(words) and j + 1 < len(speakers) and speakers[j + 1] == who:
            j += 1
        s = 0.0 if i == 0 else words[i]["start"] + LAG
        e = (words[j + 1]["start"] + LAG) if j + 1 < len(words) else words[j]["end"] + 0.4
        c = colors[i] if colors and i < len(colors) else None
        col = f"\\c{ass_colour(c)}" if c and re.match(r"^#[0-9A-Fa-f]{6}$", c) else ""
        name = re.sub(r"[^\w' ]", "", str(who)).strip().upper()[:16]
        if name:
            out.append(f"Dialogue: 1,{ts(s)},{ts(e)},Tag,,0,0,0,,{{\\pos(540,1505){col}}}{name}")
        i = j + 1
    return out


def captions_ass(words, colors, font, speakers=None):
    """the kit finish.py's captions (same words, timing and style), each word with its speaker's colour; a name tag above
    a speaker's words"""
    lines = tag_lines(words, colors, speakers)
    for i, w in enumerate(words):
        txt = re.sub(r"[^\w'$%,.]", "", w["word"]).strip(",.").upper()
        if not txt:
            continue
        s = 0.0 if i == 0 else w["start"] + LAG
        e = (words[i + 1]["start"] + LAG) if i + 1 < len(words) else w["end"] + 0.4
        c = colors[i] if colors and i < len(colors) else None
        tag = "{\\pos(540,1607)" + (f"\\c{ass_colour(c)}" if c and re.match(r"^#[0-9A-Fa-f]{6}$", c) else "") + "}"
        lines.append(f"Dialogue: 0,{ts(s)},{ts(e)},Word,,0,0,0,,{tag}{txt}")
    return HEAD.replace("{FONT}", font) + "\n".join(lines) + "\n"


def ff(args, timeout=1800):
    p = subprocess.run(["ffmpeg", "-v", "error", "-y"] + args, capture_output=True, text=True, timeout=timeout)
    if p.returncode:
        raise RuntimeError("ffmpeg: " + p.stderr[-800:])
    return p


def lufs(path):
    p = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af", "ebur128=framelog=quiet", "-f", "null", "-"], capture_output=True, text=True)
    m = re.findall(r"I:\s+(-?[\d.]+) LUFS", p.stderr)
    return float(m[-1]) if m else None


def loudnorm(src, dst, target=-14.0, tp=-1.5):
    """two-pass loudnorm -> AAC 192k (the engine's mix does the same to -14 / -1.5)"""
    p = subprocess.run(["ffmpeg", "-hide_banner", "-i", src, "-af", f"loudnorm=I={target}:TP={tp}:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True)
    j = json.loads(p.stderr[p.stderr.rindex("{"):p.stderr.rindex("}") + 1])
    ln = f"loudnorm=I={target}:TP={tp}:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true"
    ff(["-i", src, "-af", ln + ",aresample=48000", "-c:a", "aac", "-b:a", "192k", dst])
    return dst


def post_finish(vdir, font, preset="slow", seconds=None):
    a, o = os.path.join(vdir, "audio"), os.path.join(vdir, "out")
    words = json.load(open(os.path.join(a, "words.json"), encoding="utf-8"))
    cp = os.path.join(a, "caption_colors.json")
    colors = json.load(open(cp, encoding="utf-8")) if os.path.exists(cp) else []
    sp = os.path.join(a, "caption_speakers.json")
    speakers = json.load(open(sp, encoding="utf-8")) if os.path.exists(sp) else []
    mix, mixn = os.path.join(a, "mix.m4a"), os.path.join(a, "mix_norm.m4a")
    before = lufs(mix)
    loudnorm(mix, mixn)
    nocap0 = os.path.join(o, "final_nocaptions.mp4")
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mixn], capture_output=True, text=True).stdout)
    if seconds:
        dur = min(dur, seconds)
    nocap = os.path.join(o, "final_nocaptions.norm.mp4")
    ff(["-i", nocap0, "-i", mixn, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "copy", "-t", f"{dur:.3f}", "-movflags", "+faststart", nocap])
    ass = os.path.join(vdir, "captions_speakers.ass")
    open(ass, "w", encoding="utf-8").write(captions_ass(words, colors, font, speakers))
    final = os.path.join(o, "final.mp4")
    cwd = os.getcwd()
    os.chdir(vdir)  # the ass filter takes a plain relative name (no drive letters / colons to escape)
    try:
        ff(["-i", nocap, "-vf", "ass=captions_speakers.ass", "-c:v", "libx264", "-preset", preset, "-crf", "16", "-pix_fmt", "yuv420p",
            "-c:a", "copy", "-t", f"{dur:.3f}", "-movflags", "+faststart", final], timeout=3600)
    finally:
        os.chdir(cwd)
    os.replace(nocap, nocap0)
    vbr = max(800, int(25 * 8 * 1024 / dur) - 160)  # the kit's phone copy (under ~25 MB)
    ff(["-i", final, "-vf", "scale=720:1280", "-c:v", "libx264", "-preset", preset, "-b:v", f"{vbr}k", "-maxrate", f"{int(vbr * 1.2)}k",
        "-bufsize", f"{vbr * 2}k", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", os.path.join(o, "final_phone.mp4")], timeout=3600)
    return {"lufs_before": before, "lufs_after": lufs(final), "colored_words": sum(1 for c in colors if c), "words": len(words)}


if __name__ == "__main__" and len(sys.argv) > 1 and sys.argv[1] == "--check":
    # the local check (free): a scratch video folder from an existing run's files, the first N seconds
    nocap_src, words_f, colors_f, mix_src, out_dir = sys.argv[2:7]
    secs = float(sys.argv[7]) if len(sys.argv) > 7 else None
    import shutil
    os.makedirs(os.path.join(out_dir, "audio"), exist_ok=True)
    os.makedirs(os.path.join(out_dir, "out"), exist_ok=True)
    shutil.copy(words_f, os.path.join(out_dir, "audio", "words.json"))
    shutil.copy(colors_f, os.path.join(out_dir, "audio", "caption_colors.json"))
    shutil.copy(mix_src, os.path.join(out_dir, "audio", "mix.m4a"))
    shutil.copy(nocap_src, os.path.join(out_dir, "out", "final_nocaptions.mp4"))
    print(json.dumps(post_finish(out_dir, "Archivo Black" if os.name != "nt" else "Arial Black", preset="ultrafast", seconds=secs)))
