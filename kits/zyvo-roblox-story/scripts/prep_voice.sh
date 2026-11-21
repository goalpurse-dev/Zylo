#!/usr/bin/env bash
# Zyvo Studio Kit: THE USER'S OWN VOICE FILE -> voice.mp3 at the recommended pace (reference/voice.md, way 2).
#   bash prep_voice.sh <the user's file (mp3 / wav / m4a)> <zyvo-project/<slug>/voice.mp3> <words in narration.txt>
# 1. trims the silence before the first word and every pause longer than 0.5 s down to 0.45 s (the natural pauses
#    stay: the story stays easy to follow),
# 2. speeds it up at the same pitch so it lands near 195 words a minute: 1.25x for a normal-pace file (ElevenLabs at
#    speed 1.0), less if the file is already quick, never slower,
# 3. prints its length, its pace and every pause ("pause <start> <end>", seconds), which the shot list is timed to.
# Free and local (ffmpeg only). Nothing is uploaded. The user's original file is never changed.
set -euo pipefail
export LC_ALL=C
IN="${1:?the voice file}"; OUT="${2:?out voice.mp3}"; WORDS="${3:-0}"
[ -f "$IN" ] || { echo "not found: $IN" >&2; exit 2; }
command -v ffmpeg >/dev/null || { echo "ffmpeg is missing (the kit's setup step installs it)" >&2; exit 3; }
mkdir -p "$(dirname "$OUT")"
TMP="${OUT%.*}_trim_$$.wav"
trap 'rm -f "$TMP"' EXIT

ffmpeg -v error -y -i "$IN" -af "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05:stop_periods=-1:stop_duration=0.5:stop_threshold=-40dB:stop_silence=0.45" -ar 44100 -ac 1 "$TMP"
DUR="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$TMP")"
TEMPO="$(awk -v w="$WORDS" -v d="$DUR" 'BEGIN { if (w <= 0 || d <= 0) { print "1.25"; exit } wpm = w / (d / 60); t = 195 / wpm; if (t > 1.25) t = 1.25; if (t < 1.0) t = 1.0; printf "%.3f", t }')"
ffmpeg -v error -y -i "$TMP" -af "atempo=$TEMPO" -c:a libmp3lame -b:a 192k "$OUT"
LEN="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT")"
echo "voice $OUT"
echo "tempo $TEMPO"
echo "length $LEN"
awk -v w="$WORDS" -v d="$LEN" 'BEGIN { if (w > 0 && d > 0) printf "pace %d words a minute\n", w / (d / 60) }'
ffmpeg -v info -i "$OUT" -af "silencedetect=noise=-35dB:d=0.12" -f null - 2>&1 | tr '\r' '\n' | awk '
	/silence_start:/ { s = $NF }
	/silence_end:/ { e = $0; sub(/.*silence_end: */, "", e); sub(/ .*/, "", e); if (s != "") printf "pause %s %s\n", s, e; s = "" }'
