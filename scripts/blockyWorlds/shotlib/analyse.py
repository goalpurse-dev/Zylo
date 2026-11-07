# Blocky Worlds shot library, step 1 (FREE, local): analyse every reference video.
#   python scripts/blockyWorlds/shotlib/analyse.py               # all videos: visual pass for every video first, then transcripts
#   python scripts/blockyWorlds/shotlib/analyse.py --phase visual  # cuts + camera moves + keyframes only (fast)
#   python scripts/blockyWorlds/shotlib/analyse.py --summary       # only rebuild analysis/summary.json from what is done
#   options: --only <videoId> --force --threads 6 --reuse-transcript <transcript.json> (matched by duration)
#
# Reads  reference/blocky-worlds/videos/**.mp4 (owner's study inbox; never committed)
# Writes reference/blocky-worlds/analysis/<videoId>/{visual.json, transcript.json, shots.json, meta.json, frames/}
#        reference/blocky-worlds/analysis/summary.json   (git-ignored: third-party transcripts and frames)
# PATTERNS ONLY: this is a study of how the top videos cut, move and time their shots. Never copy a reference video's
# story, characters, names, footage or exact shots into a customer video.
#
# Incremental: every stage file carries the source key {rel, size, mtimeNs} + VERSION; a stage is skipped when its file
# exists with the same key. New or changed videos are analysed on the next run; finished ones are skipped.
# Whisper runs on the CPU (the GPU is shared with renders).
import os, sys, json, time, re, subprocess, argparse, statistics
import numpy as np
import cv2

VERSION = 2           # visual/merge logic; bump to redo every video
TRANSCRIPT_VERSION = 1  # whisper output; bump only when the transcription itself changes
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
SRC = os.path.join(ROOT, "reference", "blocky-worlds", "videos")
OUT = os.path.join(ROOT, "reference", "blocky-worlds", "analysis")
FPS = 30            # analysis frame rate (60 fps sources are sampled every other frame)
W, H = 270, 480     # analysis + keyframe size (9:16)
CAPTION_BAND = (0.58, 0.80)  # burnt-in captions sit here: no motion features from it
CUT_MERGE_S = 0.15

def log(*a):
    msg = time.strftime("%H:%M:%S ") + " ".join(str(x) for x in a)
    print(msg, flush=True)
    try:
        with open(os.path.join(OUT, "_run.log"), "a", encoding="utf-8") as f:
            f.write(msg + "\n")
    except OSError:
        pass

def rd(p):
    try:
        with open(p, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None

def wr(p, obj):
    tmp = p + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)
    os.replace(tmp, p)

def r3(x):
    return None if x is None else round(float(x), 3)

# ------------------------------------------------------------------------------------------------ discovery + cache
def discover():
    vids = []
    for dp, _, fs in os.walk(SRC):
        for fn in sorted(fs):
            if fn.lower().endswith((".mp4", ".mov", ".webm", ".mkv")):
                p = os.path.join(dp, fn)
                st = os.stat(p)
                rel = os.path.relpath(p, SRC).replace("\\", "/")
                m = re.search(r"(\d{15,})", fn)
                vid = m.group(1) if m else re.sub(r"[^A-Za-z0-9_-]+", "_", os.path.splitext(fn)[0])[:60]
                vids.append({"id": vid, "path": p, "key": {"rel": rel, "size": st.st_size, "mtimeNs": st.st_mtime_ns}})
    seen = {}
    for v in sorted(vids, key=lambda v: v["key"]["rel"]):
        if v["id"] in seen:  # same id twice (a copy in a subfolder): keep both, the second gets a suffix
            seen[v["id"]] += 1
            v["id"] = f'{v["id"]}_{seen[v["id"]]}'
        else:
            seen[v["id"]] = 1
    return sorted(vids, key=lambda v: v["key"]["rel"])

def fresh(path, key, version=None):
    d = rd(path)
    return d is not None and d.get("version") == (VERSION if version is None else version) and d.get("source") == key

def probe(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                          "stream=width,height,r_frame_rate:format=duration", "-of", "json", path],
                         capture_output=True, text=True, check=True).stdout
    j = json.loads(out)
    s = j["streams"][0]
    n, d = s["r_frame_rate"].split("/")
    return {"width": s["width"], "height": s["height"], "fps": round(int(n) / max(1, int(d)), 3), "duration": r3(float(j["format"]["duration"]))}

# ------------------------------------------------------------------------------------------------ visual pass
def scene_scores(path, workdir):
    # ffmpeg's own scene score per analysis frame (same fps=30 timeline as the pipe below)
    fn = "_scene.txt"
    subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-loglevel", "error", "-y", "-i", path, "-an", "-vf",
                    f"fps={FPS},scale=135:240,select='gte(scene\\,0)',metadata=print:file={fn}", "-f", "null", "-"],
                   cwd=workdir, check=True)
    scores = {}
    cur = None
    with open(os.path.join(workdir, fn), "r", encoding="utf-8") as f:
        for line in f:
            m = re.match(r"frame:(\d+)", line)
            if m:
                cur = int(m.group(1))
                continue
            m = re.match(r"lavfi\.scene_score=([\d.]+)", line.strip())
            if m and cur is not None:
                scores[cur] = float(m.group(1))
    os.remove(os.path.join(workdir, fn))
    n = (max(scores) + 1) if scores else 0
    return np.array([scores.get(i, 0.0) for i in range(n)], dtype=np.float32)

def frame_pipe(path):
    p = subprocess.Popen(["ffmpeg", "-hide_banner", "-nostats", "-loglevel", "error", "-i", path, "-an", "-vf",
                          f"fps={FPS},scale={W}:{H}", "-pix_fmt", "bgr24", "-f", "rawvideo", "pipe:1"],
                         stdout=subprocess.PIPE, bufsize=W * H * 3 * 4)
    size = W * H * 3
    while True:
        buf = p.stdout.read(size)
        if len(buf) < size:
            break
        yield np.frombuffer(buf, np.uint8).reshape(H, W, 3)
    p.stdout.close()
    p.wait()

_MASK = np.full((H, W), 255, np.uint8)
_MASK[int(H * CAPTION_BAND[0]):int(H * CAPTION_BAND[1]), :] = 0
_MASK[: int(H * 0.05), :] = 0

def pair_motion(prev, g):
    """global camera motion prev -> g: similarity transform from tracked corners (RANSAC) + parallax measures"""
    pts = cv2.goodFeaturesToTrack(prev, maxCorners=220, qualityLevel=0.01, minDistance=7, mask=_MASK)
    if pts is None or len(pts) < 14:
        return None
    nxt, st, _ = cv2.calcOpticalFlowPyrLK(prev, g, pts, None, winSize=(21, 21), maxLevel=3)
    ok = st.reshape(-1) == 1
    a, b = pts.reshape(-1, 2)[ok], nxt.reshape(-1, 2)[ok]
    if len(a) < 12:
        return None
    M, inl = cv2.estimateAffinePartial2D(a, b, method=cv2.RANSAC, ransacReprojThreshold=1.5, maxIters=500)
    if M is None:
        return None
    inl = inl.reshape(-1).astype(bool)
    sc = float(np.hypot(M[0, 0], M[1, 0]))
    rot = float(np.arctan2(M[1, 0], M[0, 0]))
    # the transform about the frame centre: translation of the centre point
    c = np.array([W / 2, H / 2])
    cc = M[:, :2] @ c + M[:, 2]
    tx, ty = float(cc[0] - c[0]), float(cc[1] - c[1])
    flow = b - a
    pred = (a @ M[:, :2].T + M[:, 2]) - a
    resid = np.linalg.norm(flow - pred, axis=1)
    fx = flow[:, 0]
    medx = float(np.median(fx))
    opp = float(np.mean(np.sign(fx) == -np.sign(medx))) if abs(medx) > 0.4 else 0.0
    return {"tx": tx, "ty": ty, "ls": float(np.log(max(sc, 1e-3))), "rot": rot, "inl": float(inl.mean()), "n": int(len(a)),
            "res": float(np.median(resid)), "res90": float(np.percentile(resid, 90)), "opp": opp,
            "mag": float(np.median(np.linalg.norm(flow, axis=1)))}

def hist(img):
    h = cv2.calcHist([img], [0, 1, 2], None, [8, 8, 8], [0, 256, 0, 256, 0, 256])
    return cv2.normalize(h, h).flatten()

def detect_cuts(sc, diffs, hcorr, motions, n):
    """ffmpeg scene-score candidates verified by histogram change, flash rejection and feature continuity"""
    cand = []
    d = np.array(diffs, dtype=np.float32)
    for i in range(1, n):
        s = float(sc[i]) if i < len(sc) else 0.0
        nb = [j for j in range(max(1, i - 6), min(n, i + 7)) if j != i]
        loc_s = float(np.median(sc[nb])) if nb and len(sc) > max(nb) else 0.0
        loc_d = float(np.median(d[nb])) if nb else 0.0
        m = motions[i]
        inl = m["inl"] if m is not None else 0.0
        strong = s >= 0.30
        weak = s >= 0.12 and s > 3.5 * max(loc_s, 0.01) and hcorr[i] < 0.85
        # dark or busy footage (night, rain): the scene score stays low, so a cut is a pixel-change spike over the
        # neighbouring frames that the tracked corners do not carry across
        spike = inl < 0.15 and ((d[i] >= 15 and d[i] >= 1.5 * loc_d) or (s >= 0.15 and s >= 3 * max(loc_s, 0.02)))
        if not (strong or weak or spike):
            continue
        if m is not None and inl > 0.55 and m["n"] >= 40 and hcorr[i] > 0.6:
            continue  # the corners carried straight across: a fast move, not a cut
        if hcorr[i] > 0.97 and d[i] < 12 and not spike:
            continue
        cand.append((i, max(s, 0.01)))
    # merge candidates closer than CUT_MERGE_S: keep the strongest
    merged = []
    gap = int(round(CUT_MERGE_S * FPS))
    for i, s in cand:
        if merged and i - merged[-1][0] <= gap:
            if s > merged[-1][1]:
                merged[-1] = (i, s)
        else:
            merged.append((i, s))
    return merged

def visual_pass(v, vdir, meta):
    t0 = time.time()
    sc = scene_scores(v["path"], vdir)
    small, hists, diffs, hcorr, motions, jpgs = [], [], [0.0], [1.0], [None], []
    prev_g, prev_h = None, None
    for f in frame_pipe(v["path"]):
        g = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY)
        h = hist(cv2.resize(f, (54, 96)))
        if prev_g is not None:
            diffs.append(float(np.mean(cv2.absdiff(g, prev_g))))
            hcorr.append(float(cv2.compareHist(prev_h, h, cv2.HISTCMP_CORREL)))
            motions.append(pair_motion(prev_g, g))
        small.append(cv2.resize(g, (54, 96)).astype(np.float32))
        hists.append(h)
        jpgs.append(cv2.imencode(".jpg", f, [cv2.IMWRITE_JPEG_QUALITY, 82])[1].tobytes())
        prev_g, prev_h = g, h
    n = len(jpgs)
    cuts = detect_cuts(sc, diffs, hcorr, motions, n)
    # flash rejection: frame i differs from i-1 but i+2 looks like i-1 again
    kept = []
    for i, s in cuts:
        if i + 2 < n and float(np.mean(np.abs(small[i + 2] - small[i - 1]))) < 6 and cv2.compareHist(hists[i - 1], hists[i + 2], cv2.HISTCMP_CORREL) > 0.95:
            continue
        kept.append((i, s))
    bounds = [0] + [i for i, _ in kept] + [n]
    shots = []
    fdir = os.path.join(vdir, "frames")
    os.makedirs(fdir, exist_ok=True)
    for old in os.listdir(fdir):  # a re-run may find fewer shots: no stale frames left behind
        if old.endswith(".jpg"):
            os.remove(os.path.join(fdir, old))
    for k in range(len(bounds) - 1):
        f0, f1 = bounds[k], bounds[k + 1]
        L = f1 - f0
        if L <= 0:
            continue
        pad = max(1, int(round(0.12 * L))) if L > 4 else 0
        picks = {"start": min(f1 - 1, f0 + pad), "mid": f0 + L // 2, "end": max(f0, f1 - 1 - pad)}
        frames = {}
        for tag, idx in picks.items():
            name = f"s{k + 1:03d}_{tag}.jpg"
            with open(os.path.join(fdir, name), "wb") as fh:
                fh.write(jpgs[idx])
            frames[tag] = f"frames/{name}"
        shots.append({"n": k + 1, "f0": f0, "f1": f1, "t0": r3(f0 / FPS), "t1": r3(f1 / FPS), "dur": r3(L / FPS),
                      "cutScore": r3(float(sc[f0])) if 0 < f0 < len(sc) else None,
                      "move": classify_move(motions[f0 + 1:f1]), "frames": frames})
    vis = {"version": VERSION, "source": v["key"], "fps": FPS, "frameSize": [W, H], "frames": n,
           "cutDetector": "ffmpeg scene score (fps 30, 135x240) >= 0.30, or >= 0.12 and 3.5x the local median with a colour-histogram change; "
                          "rejected when tracked corners carry across (fast move), when nothing changed, or when the picture returns within 2 frames (flash); merged within 0.15 s",
           "shots": shots, "ms": int((time.time() - t0) * 1000)}
    wr(os.path.join(vdir, "visual.json"), vis)
    return vis

def classify_move(ms):
    """camera move of one shot from per-frame similarity transforms. Units: % of frame width per second."""
    good = [m for m in ms if m is not None and m["inl"] >= 0.3]
    cover = len(good) / max(1, len(ms))
    if len(good) < 3:
        return {"type": "unknown", "family": "unknown", "coverage": r3(cover)}
    k = 100.0 / W * FPS
    tx = np.array([m["tx"] for m in good]); ty = np.array([m["ty"] for m in good])
    ls = np.array([m["ls"] for m in good]); rot = np.array([m["rot"] for m in good])
    res = np.array([m["res"] for m in good]); opp = np.array([m["opp"] for m in good])
    zx = ls * (W / 2)       # zoom as edge displacement (px per frame)
    rx = rot * (W / 2)      # roll as edge displacement
    dur = len(good) / FPS
    net = {"x": float(tx.sum() * 100 / W), "y": float(ty.sum() * 100 / W), "zoom": float(ls.sum()), "rollDeg": float(np.degrees(rot.sum()))}
    vx, vy, vz, vr = abs(tx.sum()) * k / len(good), abs(ty.sum()) * k / len(good), abs(zx.sum()) * k / len(good), abs(rx.sum()) * k / len(good)
    speed_each = np.sqrt(tx ** 2 + ty ** 2 + zx ** 2 + rx ** 2) * k
    speed = float(np.mean(speed_each))
    path = float(np.sum(np.sqrt(tx ** 2 + ty ** 2 + zx ** 2)))
    directness = float(np.hypot(np.hypot(tx.sum(), ty.sum()), zx.sum()) / path) if path > 1e-6 else 1.0
    vel = np.stack([tx, ty, zx], 1) * k
    acc = np.linalg.norm(np.diff(vel, axis=0), axis=1) * FPS if len(vel) > 1 else np.array([0.0])  # %w/s^2
    jerk = float(np.median(np.linalg.norm(np.diff(vel, axis=0), axis=1)) / (np.mean(np.linalg.norm(vel, axis=1)) + 1.0)) if len(vel) > 1 else 0.0
    parallax = float(np.median(res)) * k
    third = max(1, len(speed_each) // 3)
    s_in, s_out = float(np.mean(speed_each[:third])), float(np.mean(speed_each[-third:]))
    ease = "steady"
    if s_out > 1.6 * s_in + 1: ease = "speeds_up"
    elif s_in > 1.6 * s_out + 1: ease = "slows_down"
    # a similarity fit on a 3D scene turns parallax into fake roll: roll only leads when it is big and clean
    roll_real = abs(net["rollDeg"]) >= 20 and vr > 2 * max(vx, vy, vz) and parallax < 6
    comps = {"pan": vx, "tilt": vy, "zoom": vz, "roll": vr if roll_real else min(vr, 0.5 * max(vx, vy, vz))}
    order = sorted(comps, key=comps.get, reverse=True)
    top = comps[order[0]]
    intensity = "still" if speed < 2.5 else "slow" if speed < 8 else "medium" if speed < 25 else "fast" if speed < 80 else "whip"
    if speed < 2.5 and parallax < 2.5:
        t, fam = "static", "static"
    elif speed > 6 and directness < 0.3 and jerk > 0.6:
        t, fam = "shake", "shake"
    elif top < 1.5:
        t, fam = ("drift" if parallax < 2.5 else "static_action"), "static"
    elif order[0] == "zoom":
        t = "push_in" if net["zoom"] > 0 else "pull_out"
        fam = t
    elif order[0] == "pan":
        lateral = "pan_right" if tx.sum() < 0 else "pan_left"   # content moves left = camera turns/moves right
        if float(np.mean(opp)) >= 0.2 and parallax >= 1.5:
            t, fam = "orbit_" + ("right" if tx.sum() < 0 else "left"), "orbit"
        elif parallax >= 2.0:
            t, fam = "track_" + ("right" if tx.sum() < 0 else "left"), "track"
        else:
            t, fam = lateral, "pan"
    elif order[0] == "tilt":
        t, fam = ("tilt_up" if ty.sum() > 0 else "tilt_down"), "tilt"   # content moves down = camera looks up
    else:
        t, fam = "roll", "roll"
    second = order[1] if comps[order[1]] >= max(1.0, 0.4 * top) and fam not in ("static", "shake") else None
    return {"type": t, "family": fam, "secondary": second, "intensity": intensity, "speed": r3(speed), "speedPan": r3(vx), "speedTilt": r3(vy),
            "speedZoom": r3(vz), "speedRoll": r3(vr), "net": {k2: r3(v2) for k2, v2 in net.items()},
            "directness": r3(directness), "jerk": r3(jerk), "accP95": r3(np.percentile(acc, 95)),
            "smooth": "smooth" if jerk < 0.35 else ("jittery" if jerk < 0.8 else "rough"), "ease": ease,
            "parallax": r3(parallax), "oppositeShare": r3(np.mean(opp)), "coverage": r3(cover),
            "scale": "% of frame width per second"}

# ------------------------------------------------------------------------------------------------ audio + transcript
def load_audio(path):
    raw = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", path, "-vn", "-ac", "1", "-ar", "16000",
                          "-f", "f32le", "pipe:1"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).copy()

_MODEL = None
def whisper(threads):
    global _MODEL
    if _MODEL is None:
        from faster_whisper import WhisperModel
        _MODEL = WhisperModel("small", device="cpu", compute_type="int8", cpu_threads=threads, num_workers=1)
    return _MODEL

def transcribe(v, vdir, audio, threads, reuse):
    dur = len(audio) / 16000
    for r in reuse:
        if abs(r.get("duration", -1) - dur) < 0.08:
            out = {"version": TRANSCRIPT_VERSION, "source": v["key"], "language": r.get("language", "en"), "duration": r3(dur),
                   "model": "reused: " + r["_path"], "segments": r["segments"]}
            wr(os.path.join(vdir, "transcript.json"), out)
            return out
    t0 = time.time()
    segs, info = whisper(threads).transcribe(audio, beam_size=5, word_timestamps=True, vad_filter=False)
    segments = []
    for s in segs:
        segments.append({"start": r3(s.start), "end": r3(s.end), "text": s.text.strip(),
                         "words": [{"w": w.word.strip(), "s": r3(w.start), "e": r3(w.end), "p": r3(w.probability)} for w in (s.words or [])]})
    out = {"version": TRANSCRIPT_VERSION, "source": v["key"], "language": info.language, "duration": r3(dur),
           "model": "faster-whisper small int8 cpu, word_timestamps", "segments": segments, "ms": int((time.time() - t0) * 1000)}
    wr(os.path.join(vdir, "transcript.json"), out)
    return out

def loud_peaks(audio, words):
    """sharp loudness onsets (SFX cue candidates); inWord=False ones sit between spoken words"""
    hop = 320  # 20 ms
    n = len(audio) // hop
    if n < 10:
        return []
    fr = audio[: n * hop].reshape(n, hop)
    db = 10 * np.log10(np.mean(fr ** 2, axis=1) + 1e-10)
    peaks = []
    for i in range(6, n - 7):
        if db[i] < -35 or db[i] < db[max(0, i - 7):i + 8].max():
            continue
        base = float(np.median(db[max(0, i - 75):i]))
        rise = float(db[i] - db[max(0, i - 6):i].min())
        if db[i] - base >= 9 and rise >= 10:
            t = i * hop / 16000
            if peaks and t - peaks[-1]["t"] < 0.25:
                continue
            w = next((x for x in words if x["s"] - 0.03 <= t <= x["e"] + 0.03), None)
            peaks.append({"t": r3(t), "db": r3(db[i]), "overBase": r3(db[i] - base), "rise": r3(rise), "inWord": w is not None})
    return peaks

def lines_of(words):
    lines, cur = [], []
    for i, w in enumerate(words):
        cur.append(i)
        nxt = words[i + 1] if i + 1 < len(words) else None
        end = re.search(r"[.!?]\W*$", w["w"]) is not None
        if nxt is None or end or (nxt["s"] - w["e"]) > 0.7:
            lines.append(cur)
            cur = []
    return [{"n": k + 1, "t0": words[c[0]]["s"], "t1": words[c[-1]]["e"], "w0": c[0], "w1": c[-1],
             "text": " ".join(words[j]["w"] for j in c)} for k, c in enumerate(lines)]

def cut_word(t, words, line_starts):
    best = None
    for i, w in enumerate(words):
        if w["s"] - 0.12 <= t < w["e"]:
            best = i
            break
        if w["s"] > t:
            best = i if w["s"] - t <= 0.5 else None
            break
    if best is None:
        return {"word": None, "kind": "in_pause", "offset": None}
    w = words[best]
    off = t - w["s"]
    kind = "on_word_start" if abs(off) <= 0.12 else ("before_word" if off < 0 else "mid_word")
    return {"word": w["w"], "wordIndex": best, "offset": r3(off), "kind": kind, "lineStart": best in line_starts}

def merge(v, vdir, vis, tr, audio, info):
    words = [w for s in tr["segments"] for w in s["words"] if w.get("s") is not None]
    lines = lines_of(words)
    line_starts = {l["w0"] for l in lines}
    peaks = loud_peaks(audio, words)
    shots = []
    for s in vis["shots"]:
        sw = [w for w in words if s["t0"] <= (w["s"] + w["e"]) / 2 < s["t1"]]
        cw = cut_word(s["t0"], words, line_starts) if s["n"] > 1 else {"word": words[0]["w"] if words else None, "kind": "video_start"}
        ln = [l["n"] for l in lines if l["t0"] < s["t1"] and l["t1"] > s["t0"]]
        shots.append({**s, "words": " ".join(w["w"] for w in sw), "cut": cw, "lines": ln,
                      "loudPeaks": [p for p in peaks if s["t0"] <= p["t"] < s["t1"]]})
    for l in lines:
        ov = []
        for s in shots:
            o = min(l["t1"], s["t1"]) - max(l["t0"], s["t0"])
            if o > 0:
                ov.append({"shot": s["n"], "overlap": r3(o)})
        l["shots"] = ov
        l["shotCount"] = len(ov)
        l["dur"] = r3(l["t1"] - l["t0"])
    out = {"version": VERSION, "source": v["key"], "video": v["id"], "duration": info["duration"],
           "patternsOnly": "study material: learn patterns, never copy story, characters, names, footage or exact shots",
           "cutDetector": vis["cutDetector"], "frameSize": vis["frameSize"], "shots": shots, "lines": lines, "loudPeaks": peaks}
    wr(os.path.join(vdir, "shots.json"), out)
    return out

def video_stats(sh):
    shots = sh["shots"]
    durs = [s["dur"] for s in shots]
    cuts = [s["cut"] for s in shots if s["n"] > 1]
    kinds = {}
    for c in cuts:
        kinds[c["kind"]] = kinds.get(c["kind"], 0) + 1
    fams = {}
    for s in shots:
        f = s["move"]["family"]
        fams[f] = fams.get(f, 0) + 1
    ln = sh["lines"]
    return {"shots": len(shots), "duration": sh["duration"], "medianShot": r3(statistics.median(durs)) if durs else None,
            "meanShot": r3(statistics.mean(durs)) if durs else None, "shotsPerMin": r3(len(shots) / (sh["duration"] / 60)),
            "cutKinds": kinds, "cutsOnLineStart": sum(1 for c in cuts if c.get("lineStart") and c["kind"] in ("on_word_start", "before_word")),
            "moveFamilies": fams, "lines": len(ln), "shotsPerLine": r3(statistics.mean([l["shotCount"] for l in ln])) if ln else None,
            "sfxCandidates": sum(1 for p in sh["loudPeaks"] if not p["inWord"])}

# ------------------------------------------------------------------------------------------------ summary
def summary(vids):
    rows, all_d, fam, kinds, typ, inten = [], [], {}, {}, {}, {}
    pending = []
    vis_shots = 0
    for v in vids:
        vdir = os.path.join(OUT, v["id"])
        meta = rd(os.path.join(vdir, "meta.json"))
        vis = rd(os.path.join(vdir, "visual.json"))
        if vis and vis.get("source") == v["key"]:
            vis_shots += len(vis["shots"])
        if not (meta and meta.get("complete") and meta.get("source") == v["key"] and meta.get("version") == VERSION):
            pending.append(v["id"])
            continue
        sh = rd(os.path.join(vdir, "shots.json"))
        st = meta["stats"]
        rows.append({"id": v["id"], "rel": v["key"]["rel"], **st})
        for s in sh["shots"]:
            all_d.append(s["dur"])
            fam[s["move"]["family"]] = fam.get(s["move"]["family"], 0) + 1
            typ[s["move"]["type"]] = typ.get(s["move"]["type"], 0) + 1
            it = s["move"].get("intensity", "unknown")
            inten[it] = inten.get(it, 0) + 1
            if s["n"] > 1:
                kinds[s["cut"]["kind"]] = kinds.get(s["cut"]["kind"], 0) + 1
    tot = len(all_d)
    nc = sum(kinds.values())
    out = {"version": VERSION, "updated": time.strftime("%Y-%m-%dT%H:%M:%S"),
           "videosFound": len(vids), "videosDone": len(rows), "pending": pending, "shotsInVisualPass": vis_shots,
           "totals": {"shots": tot, "minutes": r3(sum(r["duration"] for r in rows) / 60),
                      "medianShot": r3(statistics.median(all_d)) if all_d else None,
                      "meanShot": r3(statistics.mean(all_d)) if all_d else None,
                      "p10Shot": r3(np.percentile(all_d, 10)) if all_d else None, "p90Shot": r3(np.percentile(all_d, 90)) if all_d else None},
           "moveFamilies": {k: {"n": c, "share": r3(c / max(1, tot))} for k, c in sorted(fam.items(), key=lambda x: -x[1])},
           "moveTypes": dict(sorted(typ.items(), key=lambda x: -x[1])),
           "moveIntensity": {k: {"n": c, "share": r3(c / max(1, tot))} for k, c in sorted(inten.items(), key=lambda x: -x[1])},
           "cutOnWord": {k: {"n": c, "share": r3(c / max(1, nc))} for k, c in sorted(kinds.items(), key=lambda x: -x[1])},
           "perVideo": rows}
    wr(os.path.join(OUT, "summary.json"), out)
    return out

# ------------------------------------------------------------------------------------------------ main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--phase", choices=["all", "visual"], default="all")
    ap.add_argument("--only")
    ap.add_argument("--shard", help="k/n: this process takes every n-th video starting at k (parallel visual passes)")
    ap.add_argument("--force", action="store_true", help="redo cuts/moves/frames/merge (transcripts kept)")
    ap.add_argument("--retranscribe", action="store_true")
    ap.add_argument("--summary", action="store_true")
    ap.add_argument("--threads", type=int, default=6)
    ap.add_argument("--reuse-transcript", action="append", default=[])
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    cv2.setNumThreads(2)
    vids = discover()
    if a.only:
        vids = [v for v in vids if v["id"] == a.only]
    if a.shard:
        k, n = (int(x) for x in a.shard.split("/"))
        vids = vids[k::n]
    if a.summary:
        s = summary(discover())
        print(json.dumps({k: s[k] for k in ("videosFound", "videosDone", "shotsInVisualPass", "totals", "moveFamilies", "cutOnWord")}, indent=1))
        return
    reuse = []
    for p in a.reuse_transcript:
        d = rd(p)
        if d and d.get("segments"):
            d["_path"] = p
            reuse.append(d)
    log(f"found {len(vids)} videos in {SRC}")
    # phase 1: the visual pass for every video (cuts, moves, keyframes) -> the shot count is known early
    for k, v in enumerate(vids):
        vdir = os.path.join(OUT, v["id"])
        os.makedirs(vdir, exist_ok=True)
        if not a.force and fresh(os.path.join(vdir, "visual.json"), v["key"]):
            continue
        t0 = time.time()
        vis = visual_pass(v, vdir, None)
        log(f"visual {k + 1}/{len(vids)} {v['id']}: {len(vis['shots'])} shots in {time.time() - t0:.0f}s")
    if a.phase == "visual":
        s = summary(discover())
        log(f"visual pass done: {s['shotsInVisualPass']} shots")
        return
    # phase 2: transcript + merge, one video at a time (CPU whisper)
    todo = [v for v in vids if a.force or not fresh(os.path.join(OUT, v["id"], "meta.json"), v["key"]) or not (rd(os.path.join(OUT, v["id"], "meta.json")) or {}).get("complete")]
    log(f"transcripts: {len(todo)} to do, {len(vids) - len(todo)} already done")
    t_start, done_s = time.time(), 0.0
    for k, v in enumerate(todo):
        vdir = os.path.join(OUT, v["id"])
        t0 = time.time()
        info = probe(v["path"])
        vis = rd(os.path.join(vdir, "visual.json"))
        audio = load_audio(v["path"])
        tp = os.path.join(vdir, "transcript.json")
        tr = rd(tp) if (not a.retranscribe and fresh(tp, v["key"], TRANSCRIPT_VERSION)) else None
        if tr is None:
            tr = transcribe(v, vdir, audio, a.threads, reuse)
        sh = merge(v, vdir, vis, tr, audio, info)
        meta = {"version": VERSION, "source": v["key"], "id": v["id"], "probe": info, "complete": True,
                "analysedAt": time.strftime("%Y-%m-%dT%H:%M:%S"), "stats": video_stats(sh),
                "files": ["visual.json", "transcript.json", "shots.json", "frames/"],
                "patternsOnly": "never copy story, characters, names, footage or exact shots"}
        wr(os.path.join(vdir, "meta.json"), meta)
        done_s += info["duration"]
        el = time.time() - t_start
        left = sum(probe(x["path"])["duration"] for x in todo[k + 1:]) if k + 1 < len(todo) else 0
        eta = el / max(done_s, 1) * left
        log(f"done {k + 1}/{len(todo)} {v['id']}: {meta['stats']['shots']} shots, {len(tr['segments'])} segments, "
            f"{time.time() - t0:.0f}s (ETA {eta / 60:.1f} min)")
    s = summary(discover())
    log(f"summary: {s['videosDone']}/{s['videosFound']} videos, {s['totals']['shots']} shots, {s['totals']['minutes']} min, median shot {s['totals']['medianShot']} s")

if __name__ == "__main__":
    main()
