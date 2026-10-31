#!/usr/bin/env bash
# One Studio v2 video: audio -> camera plan + visual sounds -> audio again -> render. $0 once its voice takes exist.
#   STUDIO_SCRATCH=<takes root> PICS_DIR=<real outputs> PROTO_DIR=<render folder> SCREENS=<screens dir> MEDIA=<kit media dir> \
#   buildStory.sh <script.json> <work dir> <out.mp4> [--audio-only | --stills t1,t2,...]
set -e
SCRIPT="$1"; WORK="$2"; OUT="$3"; MODE="$4"; ARG="$5"
cd "$(dirname "$0")"
mkdir -p "$WORK/screens" "$WORK/media"; rm -f "$WORK/moves.json" "$WORK/visual_events.json"
cp "$SCREENS"/*.jpg "$WORK/screens/" 2>/dev/null || true
cp "$MEDIA"/scene* "$WORK/media/" 2>/dev/null || true
ENG="${ENGINE:-eleven}"; A=(--pics "$PICS_DIR" --takes "$STUDIO_SCRATCH" --kokoro "${KOKORO_DIR:-none}")
python audio.py "$SCRIPT" "$ENG" "$WORK" "${A[@]}" 2>&1 | grep -E "^eleven:|Error|error" || true
node writeMoves.mjs "$WORK" | tail -2
python audio.py "$SCRIPT" "$ENG" "$WORK" "${A[@]}" 2>&1 | grep -E "^eleven:|^ +[0-9]|Error|error" || true
[ "$MODE" = "--audio-only" ] && exit 0
TOT=$(python -c "import json;print(json.load(open(r'$WORK/timing.json'))['total'])")
FF="$(cygpath -m "$(which ffmpeg)")"
if [ "$MODE" = "--stills" ]; then
  WORK_DIR="$WORK" PAGE="story.html" node render.mjs "$FF" "$OUT" 1 30 "$ARG" 2>&1 | grep -E "SAFE|rror" ; exit 0
fi
WORK_DIR="$WORK" AUDIO="$WORK/mix.wav" OBS_OUT="$WORK/render_checks.json" PAGE="story.html" node render.mjs "$FF" "$OUT" "$TOT" 30 2>&1 | grep -E "rendered|SAFE|error|reloading"
