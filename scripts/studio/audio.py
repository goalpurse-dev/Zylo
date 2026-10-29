"""Zyvo Studio audio: voices, word times, mouth envelopes, our own music bed and pops, the mix. $0 (local).

    python audio.py <script.json> <engine: kokoro|eleven> <out dir> [--kokoro <model dir>] [--takes <dir of eleven wavs>]

kokoro: the free local voices (kokoro-onnx). eleven: per-line takes already made (a paid step, run only after the
owner's go) in --takes as line01.mp3 ... ; this script never calls a paid service.
Writes <out>/voice.wav, mix.wav, timing.json (lines with word times, key words, mouth envelope at 30 fps, events).
"""
import json, os, subprocess, sys
import numpy as np
import soundfile as sf

SR = 44100
FPS = 30
args = sys.argv[1:]
script_path, engine, out = args[0], args[1], args[2]
opt = {args[i]: args[i + 1] for i in range(3, len(args) - 1, 2)}
os.makedirs(out, exist_ok=True)
S = json.load(open(script_path, encoding="utf-8"))
lines = S["lines"]


def resample(x, sr_from, sr_to=SR):
    if sr_from == sr_to:
        return x
    n = int(round(len(x) * sr_to / sr_from))
    return np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x).astype(np.float32)


def trim(x, thr=0.01, pad=0.03):
    idx = np.where(np.abs(x) > thr)[0]
    if not len(idx):
        return x
    a, b = max(0, idx[0] - int(pad * SR)), min(len(x), idx[-1] + int(pad * SR))
    return x[a:b]


def ffmpeg_decode(path):
    pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(pcm, dtype=np.float32).copy()


# ── 1. one take per line ──────────────────────────────────────────────
takes = []
if engine == "kokoro":
    from kokoro_onnx import Kokoro
    md = opt["--kokoro"]
    k = Kokoro(os.path.join(md, "kokoro-v1.0.onnx"), os.path.join(md, "voices-v1.0.bin"))
    voices = S["voices"]["kokoro"]
    for ln in lines:
        v = voices[ln["who"]]
        samples, sr = k.create(ln.get("say", ln["text"]), voice=v["voice"], speed=v.get("speed", 1.1), lang="en-us")
        takes.append(trim(resample(np.asarray(samples, dtype=np.float32), sr)))
elif engine == "eleven":
    for n, ln in enumerate(lines):
        takes.append(trim(ffmpeg_decode(os.path.join(opt["--takes"], f"line{n + 1:02d}.mp3"))))
else:
    sys.exit("engine: kokoro or eleven")

# ── 2. the voice track: short gaps, a little longer between speakers ──
lead = S.get("lead", 0.15)
voice, t, timed = [np.zeros(int(lead * SR), np.float32)], lead, []
# REAL outputs' own moments, heard with their sound (owner, 2026-10-30): "clips" (or the older single "clip"),
# each after a line: the camera pushes in (pre), the clip plays, a beat (post), then the next line.
CLIPS = S.get("clips") or ([S["clip"]] if S.get("clip") else [])
clips = []
for n, (ln, x) in enumerate(zip(lines, takes)):
    C = next((c for c in CLIPS if n and n == c["after_line"] + 1), None)
    if C:
        pre, post, dur = C.get("pre", 0.95), C.get("post", 0.35), C["out"] - C["in"]
        clips.append({"name": C.get("name", f"clip{len(clips) + 1}"), "file": C["file"], "in": C["in"], "out": C["out"], "duck_db": C.get("duck_db", 10), "start": round(t + pre, 3), "end": round(t + pre + dur, 3)})
        voice.append(np.zeros(int((pre + dur + post) * SR), np.float32)); t += pre + dur + post
    elif n:
        gap = S.get("gap_speaker", 0.22) if ln["who"] != lines[n - 1]["who"] else S.get("gap_same", 0.12)
        gap += ln.get("pause_before", 0)          # room for a visual beat (the wall)
        voice.append(np.zeros(int(gap * SR), np.float32)); t += gap
    timed.append({"who": ln["who"], "start": round(t, 3), "end": round(t + len(x) / SR, 3)})
    voice.append(x); t += len(x) / SR
tail = S.get("tail", 0.6)
voice.append(np.zeros(int(tail * SR), np.float32))
voice = np.concatenate(voice)
peak = np.max(np.abs(voice)) or 1
voice = voice / peak * 0.89
total = len(voice) / SR
sf.write(os.path.join(out, "voice.wav"), voice, SR)

# ── 3. word times (local faster-whisper on our own voice track) ───────
from faster_whisper import WhisperModel
v16 = resample(voice, SR, 16000)
segs, _ = WhisperModel("small", device="cpu", compute_type="int8").transcribe(v16, word_timestamps=True, vad_filter=False, initial_prompt=" ".join(l.get("say", l["text"]) for l in lines))
words = [{"w": w.word.strip(), "s": round(w.start, 3), "e": round(w.end, 3)} for s in segs for w in (s.words or [])]


def norm(w):
    return "".join(c for c in w.lower() if c.isalnum())


# First choice: the whole video in order. When whisper heard exactly as many words as the script has (hyphen parts
# counted), each script word takes its heard time; no boundary guessing between close lines.
# A line may be spoken differently from how it is shown ("say": "Try zyvo dot com" for "tryzyvo.com"): align on
# what is spoken; then the shown words share that line's real span by their length.
all_parts = [(n, i, p) for n, ln in enumerate(lines) for i, sw in enumerate(ln.get("say", ln["text"]).split()) for p in sw.split("-")]
if len(all_parts) == len(words):
    for n, (ln, tl) in enumerate(zip(lines, timed)):
        sw = ln.get("say", ln["text"]).split(); idx = [k for k, (m, _, _) in enumerate(all_parts) if m == n]
        said = [{"w": w, "s": min(words[k]["s"] for k in idx if all_parts[k][1] == i), "e": max(words[k]["e"] for k in idx if all_parts[k][1] == i)} for i, w in enumerate(sw)]
        if "say" in ln:
            shown = ln["text"].split(); a0, a1 = said[0]["s"], said[-1]["e"]; tot = sum(len(w) + 1 for w in shown); acc = 0; tl["words"] = []
            for w in shown:
                s0 = a0 + (a1 - a0) * acc / tot; acc += len(w) + 1; tl["words"].append({"w": w, "s": round(s0, 3), "e": round(a0 + (a1 - a0) * acc / tot, 3)})
        else: tl["words"] = said
        tl["heard"] = " ".join(words[k]["w"] for k in idx); tl["aligned"] = "whole"
# Otherwise: each heard word belongs to the line whose take holds its midpoint (else the nearest line)
def owner(w):
    m = (w["s"] + w["e"]) / 2
    return min(range(len(timed)), key=lambda i: 0 if timed[i]["start"] <= m <= timed[i]["end"] else min(abs(m - timed[i]["start"]), abs(m - timed[i]["end"])))
owners = [owner(w) for w in words]
for n, (ln, tl) in enumerate(zip(lines, timed)):
    if tl.get("aligned") == "whole":
        keys = {norm(k) for k in ln.get("key", [])}
        for w in tl["words"]: w["key"] = norm(w["w"]) in keys
        tl.update({k: ln[k] for k in ("text", "expr", "pose") if k in ln}); continue
    mine = [w for w, o in zip(words, owners) if o == n]
    script_words = ln["text"].split()
    # whisper hears "short-form" as two words: align on the hyphen parts, then join them back
    parts = [(i, p) for i, sw in enumerate(script_words) for p in sw.split("-")]
    tl["heard"] = " ".join(m["w"] for m in mine)
    # Show the SCRIPT's words (spelling, "Zyvo") on the whisper times; fall back to an even spread.
    if len(mine) == len(script_words):
        tl["words"] = [{"w": sw, "s": m["s"], "e": m["e"]} for sw, m in zip(script_words, mine)]
    elif len(mine) == len(parts):
        tl["words"] = [{"w": sw, "s": min(m["s"] for (j, _), m in zip(parts, mine) if j == i), "e": max(m["e"] for (j, _), m in zip(parts, mine) if j == i)} for i, sw in enumerate(script_words)]
    else:
        d = (tl["end"] - tl["start"]) / len(script_words)
        tl["words"] = [{"w": sw, "s": round(tl["start"] + i * d, 3), "e": round(tl["start"] + (i + 1) * d, 3)} for i, sw in enumerate(script_words)]
        tl["spread"] = True
    keys = {norm(k) for k in ln.get("key", [])}
    for w in tl["words"]:
        w["key"] = norm(w["w"]) in keys
    tl.update({k: ln[k] for k in ("text", "expr", "pose") if k in ln})

# ── 4. mouth envelope per line (30 fps, 0..1) ──────────────────────────
for tl, x in zip(timed, takes):
    hop = SR // FPS
    rms = np.array([np.sqrt(np.mean(x[i:i + hop] ** 2)) for i in range(0, max(1, len(x) - hop), hop)])
    ref = np.percentile(rms, 92) or 1
    env = np.clip(rms / ref, 0, 1) ** 0.8
    env = np.convolve(env, [0.25, 0.5, 0.25], mode="same")
    tl["env"] = [round(float(v), 3) for v in env]

# ── 5. events (cues on words) ─────────────────────────────────────────
events = []
for ln, tl in zip(lines, timed):
    for c in ln.get("cues", []):
        w = tl["words"][min(c.get("word", 0), len(tl["words"]) - 1)]
        events.append({"t": round(w["s"] + c.get("offset", 0), 3), "event": c["event"], "sfx": c.get("sfx")})
events.sort(key=lambda e: e["t"])

# ── 6. our own music bed + pops (made here: no licence questions) ─────
def note(f, n, kind="pad"):
    tt = np.arange(n) / SR
    if kind == "pad":
        w = sum(np.sin(2 * np.pi * f * m * tt + m) / m ** 1.6 for m in (1, 2, 3, 4))
        return w * (0.5 - 0.5 * np.cos(2 * np.pi * np.minimum(tt / (n / SR), 1)))
    return np.sin(2 * np.pi * f * tt)


def music(seconds, bpm=98):
    n = int(seconds * SR); y = np.zeros(n, np.float32); beat = 60 / bpm
    chords = [[220.0, 261.63, 329.63, 392.0], [174.61, 220.0, 261.63, 329.63], [261.63, 329.63, 392.0, 493.88], [196.0, 246.94, 293.66, 392.0]]
    bar = int(4 * beat * SR)
    for b in range(0, n, bar):
        ch = chords[(b // bar) % 4]; m = min(bar, n - b)
        for f in ch:
            y[b:b + m] += 0.05 * note(f, m)
        y[b:b + m] += 0.12 * note(ch[0] / 2, m, "sine") * np.exp(-np.arange(m) / SR * 1.2)
    for i in range(int(seconds / beat) + 1):            # soft kick on every beat, hat on the off-beats
        s = int(i * beat * SR); m = min(int(0.18 * SR), n - s)
        if m <= 0: break
        tt = np.arange(m) / SR
        y[s:s + m] += 0.35 * np.sin(2 * np.pi * (55 + 90 * np.exp(-tt * 30)) * tt) * np.exp(-tt * 18)
        h = int((i + 0.5) * beat * SR); hm = min(int(0.04 * SR), n - h)
        if hm > 0: y[h:h + hm] += 0.04 * np.random.default_rng(i).standard_normal(hm) * np.exp(-np.arange(hm) / SR * 120)
    a = int(0.4 * SR); y[:a] *= np.linspace(0, 1, a); y[-a:] *= np.linspace(1, 0, a)
    return y


def sfx(kind):
    if kind == "pop":
        m = int(0.09 * SR); tt = np.arange(m) / SR
        return 0.6 * np.sin(2 * np.pi * (1100 * np.exp(-tt * 25) + 260) * tt) * np.exp(-tt * 38)
    if kind == "sparkle":
        out = np.zeros(int(0.7 * SR), np.float32)
        for i, f in enumerate([1318.5, 1567.98, 2093.0, 2637.0, 3135.96]):
            s = int(i * 0.07 * SR); m = len(out) - s; tt = np.arange(m) / SR
            out[s:] += 0.18 * np.sin(2 * np.pi * f * tt) * np.exp(-tt * 9)
        return out
    if kind.startswith("whoosh"):
        # filtered noise swelling over the move (a whip is short and bright, a push longer and softer)
        dur = float(kind.split(":")[1]) if ":" in kind else 0.35
        m = int(dur * SR); tt = np.arange(m) / SR
        noise = np.random.default_rng(3).standard_normal(m)
        k = max(1, int(SR / 2500)); smooth = np.convolve(noise, np.ones(k) / k, mode="same")
        return 0.5 * smooth * np.sin(np.pi * tt / tt[-1]) ** 2
    return np.zeros(1)


bed = music(total)
# the clip's own sound: matched to our voices, faded in/out; the music ducks under it
clip_track = np.zeros_like(voice)
for clip in clips:
    src = os.path.join(opt["--pics"], clip["file"])
    pcm = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(clip["in"]), "-t", str(clip["out"] - clip["in"]), "-i", src, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    ca = np.frombuffer(pcm, dtype=np.float32).copy()
    f = int(0.04 * SR); ca[:f] *= np.linspace(0, 1, f); ca[-f:] *= np.linspace(1, 0, f)
    s0 = int(clip["start"] * SR); m = min(len(ca), len(clip_track) - s0); clip_track[s0:s0 + m] = ca[:m]
speech = np.concatenate([voice[int(tl["start"] * SR):int(tl["end"] * SR)] for tl in timed])
v_rms = np.sqrt(np.mean(speech ** 2)); m_rms = np.sqrt(np.mean(bed ** 2)) or 1
under = S.get("music_db_under", 14)
bed *= (v_rms / m_rms) * 10 ** (-under / 20)
for clip in clips:
    a0, b0 = int(clip["start"] * SR), int(clip["end"] * SR)
    c_rms = np.sqrt(np.mean(clip_track[a0:b0] ** 2)) or 1
    clip_track[a0:b0] *= (v_rms / c_rms) * 0.95
    g = 10 ** (-clip["duck_db"] / 20)
    duck = np.ones_like(bed); a, b, r = int((clip["start"] - 0.15) * SR), int((clip["end"] + 0.15) * SR), int(0.15 * SR)
    duck[a:b] = g; duck[a - r:a] = np.linspace(1, g, r); duck[b:b + r] = np.linspace(g, 1, min(r, len(duck) - b))
    bed *= duck
mix = voice + bed + clip_track
for e in events:
    if e.get("sfx"):
        x = sfx(e["sfx"]) * (v_rms / 0.2) * 0.9; s = int(e["t"] * SR); m = min(len(x), len(mix) - s)
        if m > 0: mix[s:s + m] += x[:m]
moves_path = os.path.join(out, "moves.json")
whooshes = []
if os.path.exists(moves_path):
    for mv in json.load(open(moves_path, encoding="utf-8")):
        d = mv["t1"] - mv["t0"]; strength = 1.0 if mv["kind"] == "whip" else 0.55
        x = sfx(f"whoosh:{d:.2f}") * (v_rms / 0.2) * strength; s = int(mv["t0"] * SR); m = min(len(x), len(mix) - s)
        if m > 0: mix[s:s + m] += x[:m]; whooshes.append(round(mv["t0"], 2))
mix = mix / (np.max(np.abs(mix)) or 1) * 0.92
sf.write(os.path.join(out, "mix.wav"), mix, SR)
measured = 20 * np.log10(v_rms / (np.sqrt(np.mean(bed ** 2)) or 1))

# the phone's frames, decoded exactly: the clip plays continuously from when the phone lights up to the wall reveal
phone = None
clip = clips[0] if clips else None
if clip:
    on = next((e["t"] for e in events if e["event"] == "phoneOn"), clip["start"]); off = next((e["t"] for e in events if e["event"] == "wall"), total) + 0.6
    vt0 = max(0.0, clip["in"] + (on - 0.1 - clip["start"])); dur = clip["in"] + (off - clip["start"]) - vt0
    if S.get("phone_full"): vt0, dur = S.get("phone_range", [0.0, 1e4])[0], S.get("phone_range", [0.0, 1e4])[1] - S.get("phone_range", [0.0, 1e4])[0]   # the part of the video used
    pdir = os.path.join(out, "phone"); os.makedirs(pdir, exist_ok=True)
    for f in os.listdir(pdir): os.remove(os.path.join(pdir, f))
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{vt0:.3f}", "-t", f"{dur:.3f}", "-i", os.path.join(opt["--pics"], clip["file"]), "-vf", "fps=30", os.path.join(pdir, "f%05d.png")], check=True)   # lossless frames (no JPEG step)
    phone = {"vt0": round(vt0, 3), "fps": 30, "count": len(os.listdir(pdir))}
json.dump({"engine": engine, "template": S.get("template"), "clip": clip, "clips": clips, "phone": phone, "total": round(total, 3), "fps": FPS, "lines": timed, "events": events, "music_db_under_voice": round(float(measured), 1), "end_chip": S.get("end_chip"), "whooshes": whooshes},
          open(os.path.join(out, "timing.json"), "w", encoding="utf-8"), indent=1)
print(f"{engine}: {total:.2f} s, {sum(len(t['words']) for t in timed)} words, music {measured:.1f} dB under the voice, spread lines: {[i for i, t in enumerate(timed) if t.get('spread')]}")
for tl in timed:
    print(f"  {tl['start']:5.2f}-{tl['end']:5.2f} {tl['who']:7s} {tl['text']}   (heard: {tl['heard']})")
