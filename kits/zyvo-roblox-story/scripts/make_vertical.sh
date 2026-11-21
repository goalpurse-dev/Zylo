#!/usr/bin/env bash
# Zyvo Studio Kit: turn the landscape screen recording of the rolled Play run into the upright 9:16 video.
#   bash make_vertical.sh <recording.mp4> <runtime seconds> <out.mp4> [voice.mp3]
# 1. finds the magenta sync marker (the Play run shows it 1.0 s before the voice's second 0)
# 2. finds the Studio viewport from the marker's rectangle (so the whole Studio window may be recorded)
# 3. crops the viewport, turns it upright (the camera was rolled 90 degrees), crops the centered 9:16 frame
#    (this also drops the Roblox menu button in the viewport's corner) and scales to 1080x1920, 30 fps
# 4. trims it to start exactly at the voice's second 0 and to last <runtime> seconds; silent, plus an optional
#    preview copy with the voice laid on top
# Free and local (ffmpeg only). Nothing is uploaded.
set -euo pipefail
IN="$1"; RUNTIME="$2"; OUT="$3"; VOICE="${4:-}"
# a relative temp folder: Windows ffmpeg can't open Git Bash's /tmp, and a relative path needs no escaping in a filter
TMP=".zyvo_vertical_$$"; mkdir -p "$TMP"; trap 'rm -rf "./.zyvo_vertical_$$"' EXIT
MASK="format=rgb24,geq=r='if(gt(r(X\,Y)\,190)*lt(g(X\,Y)\,80)*gt(b(X\,Y)\,190)\,255\,0)':g='if(gt(r(X\,Y)\,190)*lt(g(X\,Y)\,80)*gt(b(X\,Y)\,190)\,255\,0)':b='if(gt(r(X\,Y)\,190)*lt(g(X\,Y)\,80)*gt(b(X\,Y)\,190)\,255\,0)'"

# 1. the marker's first frame: magenta covering at least 8% of the (downscaled) picture
ffmpeg -v error -i "$IN" -an -vf "scale=320:-2,$MASK,format=gray,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=$TMP/yavg.txt" -f null -
T_MARK="$(awk '/pts_time/ { split($0, a, "pts_time:"); t = a[2] } /YAVG/ { split($0, b, "="); if (b[2] + 0 > 20) { print t; exit } }' "$TMP/yavg.txt")"
[ -n "$T_MARK" ] || { echo "no magenta sync marker found: was the recording started before Play?" >&2; exit 2; }

# 2. the viewport = the marker's rectangle, measured at full size 0.2 s into the marker
T_BOX="$(awk -v t="$T_MARK" 'BEGIN { printf "%.3f", t + 0.2 }')"
ffmpeg -v info -ss "$T_BOX" -i "$IN" -frames:v 1 -an -vf "$MASK,bbox=min_val=128" -f null - 2> "$TMP/bbox.txt" || true
read -r X1 Y1 X2 Y2 < <(grep -o 'x1:[0-9]* x2:[0-9]* y1:[0-9]* y2:[0-9]*' "$TMP/bbox.txt" | tail -1 | sed 's/[a-z0-9]*://g' | awk '{ print $1, $3, $2, $4 }')
[ -n "${X2:-}" ] || { echo "could not measure the viewport" >&2; exit 3; }
W=$(( (X2 - X1 + 1) / 2 * 2 )); H=$(( (Y2 - Y1 + 1) / 2 * 2 ))
# the 9:16 frame lies on its side in the viewport: the centered 16:9 box
if [ $(( W * 9 )) -ge $(( H * 16 )) ]; then BW=$(( H * 16 / 9 / 2 * 2 )); BH=$H; else BW=$W; BH=$(( W * 9 / 16 / 2 * 2 )); fi
BX=$(( X1 + (W - BW) / 2 )); BY=$(( Y1 + (H - BH) / 2 ))

# 3 + 4. crop, turn upright (90 degrees counterclockwise), scale, trim to the voice
T0="$(awk -v t="$T_MARK" 'BEGIN { printf "%.3f", t + 1.0 }')"
ffmpeg -v error -y -ss "$T0" -i "$IN" -t "$RUNTIME" -an \
	-vf "crop=$BW:$BH:$BX:$BY,transpose=2,scale=1080:1920:flags=lanczos,fps=30,format=yuv420p" \
	-c:v libx264 -preset slow -crf 17 -movflags +faststart "$OUT"
if [ -n "$VOICE" ]; then
	ffmpeg -v error -y -i "$OUT" -i "$VOICE" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest "${OUT%.mp4}_with_voice.mp4"
fi
echo "marker at ${T_MARK}s, viewport ${W}x${H} at ${X1},${Y1}, 9:16 box ${BW}x${BH}; story starts at ${T0}s -> $OUT"
