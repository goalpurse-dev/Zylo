# M2: a voiceover transcribed locally (faster-whisper, CPU, free), for the word-by-word check against the script
# (voiceCheck.mjs). Prints JSON: {"text": ..., "words": [{"w", "s", "e", "p"}]} (p: the word's probability).
#   python m2/transcribe.py voice.mp3 FFMPEG [model small.en]
import json
import subprocess
import sys
import types

import numpy as np

# Windows' Application Control blocks PyAV's DLLs on this laptop: faster-whisper only needs it to decode audio, so it
# gets a stand-in and the audio is decoded by our ffmpeg (16 kHz mono float, what the model takes)
sys.modules.setdefault("av", types.ModuleType("av"))
from faster_whisper import WhisperModel  # noqa: E402

src, ff = sys.argv[1], sys.argv[2]
name = sys.argv[3] if len(sys.argv) > 3 else "small.en"
pcm = subprocess.run([ff, "-v", "error", "-i", src, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], capture_output=True, check=True).stdout
audio = np.frombuffer(pcm, dtype=np.float32)
model = WhisperModel(name, device="cpu", compute_type="int8")
# no prompt and no previous-text conditioning: the transcript must hear what was said, not guess what should be
segments, _ = model.transcribe(audio, language="en", beam_size=5, word_timestamps=True, condition_on_previous_text=False, vad_filter=False)
words = []
for seg in segments:
    for w in seg.words or []:
        words.append({"w": w.word.strip(), "s": round(w.start, 3), "e": round(w.end, 3), "p": round(w.probability, 3)})
print(json.dumps({"text": " ".join(x["w"] for x in words), "words": words}))
