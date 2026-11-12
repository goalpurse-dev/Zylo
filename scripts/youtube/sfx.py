"""Zyvo YouTube tutorials: the voice-only track and the sound-effect track, made here ($0, no licences).
    python sfx.py <plan.json> <voice_out.wav> <sfx_out.wav>
plan.json: {"total": seconds, "voice": [{"file", "at"}], "events": [{"at", "kind": "whoosh"|"pop"|"stamp"|"tick"}]}
"""
import json, subprocess, sys
import numpy as np

SR = 48000
plan = json.load(open(sys.argv[1], encoding="utf-8"))
n = int(plan["total"] * SR) + SR


def load(f):
    pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", f, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(pcm, dtype=np.float32)


def put(track, x, at):
    s = int(at * SR); m = max(0, min(len(x), len(track) - s))
    track[s:s + m] += x[:m]


rng = np.random.default_rng(3)


def sound(kind):
    if kind == "whoosh":   # filtered noise swelling and fading: a soft swipe on every change of picture
        m = int(0.32 * SR); t = np.arange(m) / SR
        noise = rng.standard_normal(m)
        # a moving band: a crude sweep by mixing a low-passed and a high-passed copy
        lo = np.convolve(noise, np.ones(24) / 24, mode="same"); hi = noise - lo
        k = t / t[-1]
        return 0.22 * ((1 - k) * lo + k * hi) * np.sin(np.pi * k) ** 1.5
    if kind == "pop":      # a keyword pops in: two quick bright notes
        m = int(0.09 * SR); t = np.arange(m) / SR
        return 0.25 * np.sin(2 * np.pi * (900 + 500 * t / t[-1]) * t) * np.exp(-t * 45)
    if kind == "stamp":    # a check mark stamps in: a soft low thud and a click
        m = int(0.22 * SR); t = np.arange(m) / SR
        return 0.5 * np.sin(2 * np.pi * (90 + 120 * np.exp(-t * 40)) * t) * np.exp(-t * 18) + 0.15 * rng.standard_normal(m) * np.exp(-t * 220)
    if kind == "tick":
        m = int(0.03 * SR); t = np.arange(m) / SR
        return 0.25 * np.sin(2 * np.pi * 3000 * t) * np.exp(-t * 160)
    raise SystemExit(f"no sound {kind}")


voice = np.zeros(n, np.float32)
for v in plan["voice"]:
    put(voice, load(v["file"]), v["at"])
fx = np.zeros(n, np.float32)
for e in plan["events"]:
    put(fx, sound(e["kind"]).astype(np.float32), e["at"])
import soundfile as sf
sf.write(sys.argv[2], voice[: int(plan["total"] * SR)], SR)
sf.write(sys.argv[3], fx[: int(plan["total"] * SR)], SR)
print(f"voice track + {len(plan['events'])} sound effects")
