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


def ffmpeg_decode(path, tempo=1.0):
    af = ["-af", f"atempo={tempo:.3f}"] if abs(tempo - 1) > 1e-3 else []   # faster, same pitch (short videos: 200-230 wpm)
    pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", path, *af, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(pcm, dtype=np.float32).copy()


_wm = None
def take_words(path):
    """Word times inside one take (local whisper, cached next to it): a short video can reuse part of a paid take."""
    cache = path + ".words.json"
    if os.path.exists(cache):
        return json.load(open(cache, encoding="utf-8"))
    global _wm
    from faster_whisper import WhisperModel
    _wm = _wm or WhisperModel("small", device="cpu", compute_type="int8")
    segs, _ = _wm.transcribe(resample(ffmpeg_decode(path), SR, 16000), word_timestamps=True, vad_filter=False)
    ws = [{"w": w.word.strip(), "s": round(w.start, 3), "e": round(w.end, 3)} for s in segs for w in (s.words or [])]
    json.dump(ws, open(cache, "w", encoding="utf-8"))
    return ws


def take_for(ln, n):
    """A line's take: its own (line01.mp3...) or a reused one ("take": "m7/line06.mp3"), optionally from a word on
    ("from_word": 2 drops "Step two:"), sped up by the script's tempo."""
    path = os.path.join(opt["--takes"], ln.get("take", f"line{n + 1:02d}.mp3"))
    x = ffmpeg_decode(path)
    if ln.get("from_word"):
        ws = take_words(path)
        cut = max(0.0, ws[ln["from_word"]]["s"] - 0.04)
        x = x[int(cut * SR):]
    tempo = ln.get("tempo", S.get("tempo", 1.0))
    if abs(tempo - 1) > 1e-3:   # atempo on the cut piece (ffmpeg via a temp wav)
        tmp = os.path.join(out, "_tempo.wav"); sf.write(tmp, x, SR); x = ffmpeg_decode(tmp, tempo); os.remove(tmp)
    if S.get("squeeze"): x = squeeze(x, S["squeeze"])
    return trim(x)


def squeeze(x, keep=0.18, thr_db=-38.0):
    """Short videos: a pause inside a take ("Animate. ... They talk") longer than keep seconds is cut down to keep."""
    hop = int(0.01 * SR); n = len(x) // hop
    if n < 3: return x
    q = 20 * np.log10(np.sqrt(np.mean(x[: n * hop].reshape(n, hop) ** 2, axis=1)) + 1e-9) < thr_db
    out_parts, i, last = [], 0, 0
    while i < n:
        if q[i]:
            j = i
            while j < n and q[j]: j += 1
            if i > 0 and j < n and (j - i) * 0.01 > keep:   # inside the take only (the edges are trimmed anyway)
                half = int(keep / 2 * SR)
                out_parts.append(x[last: i * hop + half]); last = j * hop - half
            i = j
        else: i += 1
    out_parts.append(x[last:])
    return np.concatenate(out_parts)


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
        takes.append(take_for(ln, n))
else:
    sys.exit("engine: kokoro or eleven")

# ── 2. the voice track: short gaps, a little longer between speakers ──
lead = S.get("lead", 0.15)
voice, t, timed = [np.zeros(int(lead * SR), np.float32)], lead, []
# REAL outputs' own moments, heard with their sound (owner, 2026-10-30): "clips" (or the older single "clip"),
# each after a line: the camera pushes in (pre), the clip plays, a beat (post), then the next line.
CLIPS = S.get("clips") or ([S["clip"]] if S.get("clip") else [])
clips = []
# short videos (Retention Engine, owner 2026-10-30): a clip "at": "start" plays from frame 0, before the first line;
# "freeze": {"secs"} holds its last frame after it ends (a cliffhanger); the extra keys go to the page as they are
CLIP_KEYS = ("sfx_at", "fullscreen", "enter", "hook", "punch", "freeze", "open_loop", "vin", "pays_loop", "loop_frame", "text_y")
for n, (ln, x) in enumerate(zip(lines, takes)):
    C = next((c for c in CLIPS if (n == 0 and c.get("at") == "start") or (n and n == c.get("after_line", -9) + 1)), None)
    if C:
        if C.get("at") == "start": voice = [np.zeros(0, np.float32)]; t = 0.0   # frame 0: no lead
        pre, post, dur = (0.0 if C.get("at") == "start" else C.get("pre", 0.95)), C.get("post", 0.35), C["out"] - C["in"]
        hold = (C.get("freeze") or {}).get("secs", 0)
        clips.append({"name": C.get("name", f"clip{len(clips) + 1}"), "file": C["file"], "in": C["in"], "out": C["out"], "duck_db": C.get("duck_db", 10), "start": round(t + pre, 3), "end": round(t + pre + dur, 3),
                      **({"freeze_end": round(t + pre + dur + hold, 3)} if hold else {}), **{k: C[k] for k in CLIP_KEYS if k in C}})
        voice.append(np.zeros(int((pre + dur + hold + post) * SR), np.float32)); t += pre + dur + hold + post
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
n_said = sum(len(l.get("say", l["text"]).split()) for l in lines)
if len(words) < 0.8 * n_said:   # the prompt can make whisper skip a long stretch (a track that starts with 4 s of clip): again without it
    segs, _ = WhisperModel("small", device="cpu", compute_type="int8").transcribe(v16, word_timestamps=True, vad_filter=False)
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
# Second choice: match the spoken words to the heard ones in order (difflib), then give every unmatched word a share of
# the time between its matched neighbours, inside its own line's take ("150" heard for "a hundred and fifty")
else:
    import difflib
    said_parts = [(n, i, norm(p)) for n, ln in enumerate(lines) for i, sw in enumerate(ln.get("say", ln["text"]).split()) for p in sw.split("-")]
    sm = difflib.SequenceMatcher(None, [p for _, _, p in said_parts], [norm(w["w"]) for w in words], autojunk=False)
    got = {}
    for a, b, size in sm.get_matching_blocks():
        for k in range(size):
            n, _, _ = said_parts[a + k]; w = words[b + k]
            if timed[n]["start"] - 0.3 <= w["s"] <= timed[n]["end"] + 0.3: got[a + k] = (w["s"], w["e"])
    if len(got) >= 0.6 * len(said_parts):
        for n, (ln, tl) in enumerate(zip(lines, timed)):
            idx = [k for k, (m, _, _) in enumerate(said_parts) if m == n]
            # unmatched runs: spread between the neighbours (or the take's own edges)
            times, k = {}, 0
            while k < len(idx):
                if idx[k] in got: times[idx[k]] = got[idx[k]]; k += 1; continue
                j = k
                while j < len(idx) and idx[j] not in got: j += 1
                a0 = got[idx[k - 1]][1] if k else tl["start"]; b0 = got[idx[j]][0] if j < len(idx) else tl["end"]
                for q in range(k, j): s0 = a0 + (b0 - a0) * (q - k) / (j - k); times[idx[q]] = (s0, a0 + (b0 - a0) * (q - k + 1) / (j - k))
                k = j
            sw = ln.get("say", ln["text"]).split()
            said = [{"w": w, "s": round(min(times[x][0] for x in idx if said_parts[x][1] == i), 3), "e": round(max(times[x][1] for x in idx if said_parts[x][1] == i), 3)} for i, w in enumerate(sw)]
            if "say" in ln:
                shown = ln["text"].split(); a0, a1 = said[0]["s"], said[-1]["e"]; tot = sum(len(w) + 1 for w in shown); acc = 0; tl["words"] = []
                for w in shown:
                    s0 = a0 + (a1 - a0) * acc / tot; acc += len(w) + 1; tl["words"].append({"w": w, "s": round(s0, 3), "e": round(a0 + (a1 - a0) * acc / tot, 3)})
            else: tl["words"] = said
            tl["heard"] = f"{sum(1 for x in idx if x in got)}/{len(idx)} words matched"; tl["aligned"] = "matched"
# Otherwise: each heard word belongs to the line whose take holds its midpoint (else the nearest line)
def owner(w):
    m = (w["s"] + w["e"]) / 2
    return min(range(len(timed)), key=lambda i: 0 if timed[i]["start"] <= m <= timed[i]["end"] else min(abs(m - timed[i]["start"]), abs(m - timed[i]["end"])))
owners = [owner(w) for w in words]
for n, (ln, tl) in enumerate(zip(lines, timed)):
    if tl.get("aligned") in ("whole", "matched"):
        keys = {norm(k) for k in ln.get("key", [])}
        for w in tl["words"]: w["key"] = norm(w["w"]) in keys
        tl.update({k: ln[k] for k in ("text", "expr", "pose", "role", "step", "card", "chip", "badge") if k in ln}); continue
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
    tl.update({k: ln[k] for k in ("text", "expr", "pose", "role", "step", "card", "chip", "badge") if k in ln})

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
# the real clips' own beats (short videos): a hit on frame 0, a punch on each zoom, a record scratch + riser on a
# freeze, a pop when the open-loop chip lands; "loopPlant"/"loopPaid" for the scorecard
for c in clips:
    if c.get("enter") == "cut": events.append({"t": c["start"], "event": f"{c['name']}On", "sfx": "hit"})
    for p in c.get("punch", []): events.append({"t": round(c["start"] + p, 3), "event": f"{c['name']}Punch", "sfx": "punch"})
    if c.get("freeze_end"):
        events.append({"t": c["end"], "event": f"{c['name']}Freeze", "sfx": "scratch"})
        events.append({"t": round(c["end"] + 0.25, 3), "event": f"{c['name']}Riser", "sfx": f"riser:{c['freeze_end'] - c['end'] - 0.15:.2f}"})
    if c.get("open_loop"): events.append({"t": round(c["start"] + c["open_loop"]["at"], 3), "event": "loopPlant", "sfx": "pop"})
    if c.get("pays_loop"): events.append({"t": c["start"], "event": "loopPaid", "sfx": None})
    for at, kind in c.get("sfx_at", []): events.append({"t": round(c["start"] + at, 3), "event": f"{c['name']}Beat", "sfx": kind})   # a beat inside the clip (a smirk)
for e in S.get("events_extra", []): events.append(e)
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
    if kind == "tick":   # a screen flips / a clock starts: a short bright tick
        m = int(0.03 * SR); tt = np.arange(m) / SR
        return 0.35 * np.sin(2 * np.pi * 3200 * tt) * np.exp(-tt * 160)
    if kind == "click":  # a real click (the tap ring): a soft mouse click
        m = int(0.025 * SR); tt = np.arange(m) / SR
        return 0.45 * np.random.default_rng(7).standard_normal(m) * np.exp(-tt * 260) + 0.2 * np.sin(2 * np.pi * 1800 * tt) * np.exp(-tt * 200)
    if kind.startswith("keys"):  # soft typing across a quiet stretch (keys:<seconds>)
        dur = float(kind.split(":")[1]); out = np.zeros(int(dur * SR), np.float32); rng = np.random.default_rng(11); t0 = 0.0
        while t0 < dur - 0.03:
            m = int(0.018 * SR); s0 = int(t0 * SR); tt = np.arange(m) / SR
            out[s0:s0 + m] += (0.12 + 0.06 * rng.random()) * rng.standard_normal(m) * np.exp(-tt * 300)
            t0 += 0.07 + 0.09 * rng.random()
        return out
    if kind == "hit":    # frame 0: a deep boom + a bright snap (the scroll-stop)
        m = int(0.45 * SR); tt = np.arange(m) / SR
        boom = 0.9 * np.sin(2 * np.pi * (48 + 140 * np.exp(-tt * 22)) * tt) * np.exp(-tt * 7)
        snap = 0.5 * np.random.default_rng(5).standard_normal(m) * np.exp(-tt * 70)
        return boom + snap
    if kind == "punch":  # a zoom punch: a short low thud
        m = int(0.2 * SR); tt = np.arange(m) / SR
        return 0.7 * np.sin(2 * np.pi * (70 + 120 * np.exp(-tt * 40)) * tt) * np.exp(-tt * 16) + 0.15 * np.random.default_rng(6).standard_normal(m) * np.exp(-tt * 120)
    if kind == "scratch":  # a record scratch: noise swept down and up
        m = int(0.42 * SR); tt = np.arange(m) / SR
        f = 900 + 700 * np.sin(2 * np.pi * 3.2 * tt)
        return 0.55 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.random.default_rng(8).uniform(0.6, 1, m) * np.exp(-tt * 3)
    if kind.startswith("riser"):  # tension under a freeze: a rising tone with a little noise
        dur = float(kind.split(":")[1]); m = int(max(0.1, dur) * SR); tt = np.arange(m) / SR
        f = 220 * (1 + 2 * tt / tt[-1])
        return (0.22 * np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.05 * np.random.default_rng(9).standard_normal(m)) * (tt / tt[-1]) ** 1.5
    if kind.startswith("whoosh"):
        # filtered noise swelling over the move (a whip is short and bright, a push longer and softer)
        dur = float(kind.split(":")[1]) if ":" in kind else 0.35
        m = int(dur * SR); tt = np.arange(m) / SR
        noise = np.random.default_rng(3).standard_normal(m)
        k = max(1, int(SR / 2500)); smooth = np.convolve(noise, np.ones(k) / k, mode="same")
        return 0.5 * smooth * np.sin(np.pi * tt / tt[-1]) ** 2
    return np.zeros(1)


bed = music(total)
bed = np.pad(bed, (0, max(0, len(voice) - len(bed))))[: len(voice)]   # exactly the voice track's length (rounding)
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
# visual events from the camera plan (writeMoves.mjs): every flip, tap and chip change gets its own sound
fx = np.zeros_like(mix)
vis_path = os.path.join(out, "visual_events.json")
if os.path.exists(vis_path):
    for e in json.load(open(vis_path, encoding="utf-8")):
        x = sfx(e["sfx"]) * (v_rms / 0.2) * e.get("gain", 0.7); s0 = int(e["t"] * SR); m = min(len(x), len(fx) - s0)
        if 0 <= s0 and m > 0: fx[s0:s0 + m] += x[:m]
moves_path = os.path.join(out, "moves.json")
whooshes = []
if os.path.exists(moves_path):
    for mv in json.load(open(moves_path, encoding="utf-8")):
        d = mv["t1"] - mv["t0"]; strength = 1.0 if mv["kind"] == "whip" else 0.55
        x = sfx(f"whoosh:{d:.2f}") * (v_rms / 0.2) * strength; s = int(mv["t0"] * SR); m = min(len(x), len(mix) - s)
        if m > 0: fx[s:s + m] += x[:m]; whooshes.append(round(mv["t0"], 2))
# event sounds (pops, sparkles) were mixed into `mix` above; collect the foreground = everything but the music
fg = mix - bed + fx
# no dead air (owner, 2026-10-30): any foreground stretch quieter than -40 dB for more than 0.45 s gets soft typing
def quiet_runs(sig, thr_db=-40.0, min_len=0.45, scale=1.0):
    hop = int(0.05 * SR); n = len(sig) // hop
    r = np.sqrt(np.mean((sig[: n * hop] * scale).reshape(n, hop) ** 2, axis=1) + 1e-12); q = 20 * np.log10(r) < thr_db
    runs, i = [], 0
    while i < n:
        if q[i]:
            j = i
            while j < n and q[j]: j += 1
            if (j - i) * 0.05 >= min_len: runs.append((i * 0.05, j * 0.05))
            i = j
        else: i += 1
    return runs
peak = np.max(np.abs(fg + bed)) or 1
filled = []
for a, b in quiet_runs(fg, scale=0.92 / peak):
    if b > total - 0.3: continue   # the very end may fade
    x = sfx(f"keys:{b - a + 0.1:.2f}") * (v_rms / 0.2); s0 = int(max(0, a - 0.05) * SR); m = min(len(x), len(fx) - s0)
    if m > 0: fx[s0:s0 + m] += x[:m]; filled.append([round(a, 2), round(b, 2)])
fg = mix - bed + fx
mix = fg + bed
peak = np.max(np.abs(mix)) or 1
sf.write(os.path.join(out, "fg.wav"), fg / peak * 0.92, SR)   # for the scorecard's "longest near-silence"
mix = mix / peak * 0.92
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
json.dump({"engine": engine, "template": S.get("template"), "clip": clip, "clips": clips, "phone": phone, "total": round(total, 3), "fps": FPS, "lines": timed, "events": events, "music_db_under_voice": round(float(measured), 1), "end_chip": S.get("end_chip"), "whooshes": whooshes, "filled_quiet": filled,
           "short": {k: S[k] for k in ("variant", "recipe", "shots", "start_at", "chips", "steps_total", "cta", "counter", "timer", "loop_end", "length_target", "hq_dir", "tempo", "phone_skip") if k in S} or None},
          open(os.path.join(out, "timing.json"), "w", encoding="utf-8"), indent=1)
print(f"{engine}: {total:.2f} s, {sum(len(t['words']) for t in timed)} words, music {measured:.1f} dB under the voice, spread lines: {[i for i, t in enumerate(timed) if t.get('spread')]}")
for tl in timed:
    print(f"  {tl['start']:5.2f}-{tl['end']:5.2f} {tl['who']:7s} {tl['text']}   (heard: {tl['heard']})")
