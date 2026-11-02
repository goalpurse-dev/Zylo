"""Zyvo Studio: how intense each yell take is, loudness + pitch + what it says, as JSON. $0, local.
    python measureTakes.py <take.mp3> ...
"""
import json, subprocess, sys
import numpy as np
from faster_whisper import WhisperModel

SR = 16000
model = WhisperModel("small", device="cpu", compute_type="int8")
out = []
for f in sys.argv[1:]:
    x = np.frombuffer(subprocess.run(["ffmpeg", "-v", "error", "-i", f, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout, dtype=np.float32).copy()
    hop = int(0.04 * SR); frames = [x[i:i + hop] for i in range(0, len(x) - hop, hop)]
    rms = np.array([np.sqrt(np.mean(a ** 2)) for a in frames]); on = rms > 0.25 * np.percentile(rms, 95)
    pitches = []
    for a, v in zip(frames, on):
        if not v: continue
        w = a * np.hanning(len(a)); ac = np.correlate(w, w, "full")[len(w) - 1:]
        lo, hi = int(SR / 500), int(SR / 70); k = lo + int(np.argmax(ac[lo:hi]))
        if ac[k] > 0.4 * ac[0]: pitches.append(SR / k)
    log = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", f, "-af", "ebur128", "-f", "null", "-"], capture_output=True).stderr.decode("utf8", "replace")
    lufs = float(next(l.split(":")[1].split()[0] for l in log[log.rfind("Summary:"):].splitlines() if l.strip().startswith("I:")))
    pitch = float(np.median(pitches)) if pitches else 0.0
    segs, _ = model.transcribe(x, word_timestamps=False, vad_filter=False)
    out.append({"file": f, "seconds": round(len(x) / SR, 2), "lufs": lufs, "pitch": round(pitch), "score": round(lufs + pitch / 20, 1), "text": " ".join(s.text.strip() for s in segs)})
print(json.dumps(out))
