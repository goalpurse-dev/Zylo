"""Zyvo Studio: word times of a real result's own sound (local faster-whisper, $0), for picking its moments and for
the scorecard's "its captions change" events. Decodes with ffmpeg (PyAV in faster-whisper is not used).
    python transcribe.py <video.mp4> <words.json>
Writes {"segments": [{"start", "end", "text", "words": [{"w", "s", "e"}]}]}.
"""
import json, subprocess, sys
import numpy as np
from faster_whisper import WhisperModel

src, out = sys.argv[1], sys.argv[2]
pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], capture_output=True, check=True).stdout
audio = np.frombuffer(pcm, dtype=np.float32).copy()
segs, info = WhisperModel("small", device="cpu", compute_type="int8").transcribe(audio, word_timestamps=True, vad_filter=False)
segments = [{"start": round(s.start, 3), "end": round(s.end, 3), "text": s.text.strip(),
             "words": [{"w": w.word.strip(), "s": round(w.start, 3), "e": round(w.end, 3)} for w in (s.words or [])]} for s in segs]
json.dump({"language": info.language, "segments": segments}, open(out, "w", encoding="utf-8"), indent=1)
print(f"{sum(len(s['words']) for s in segments)} words, {len(segments)} segments")
