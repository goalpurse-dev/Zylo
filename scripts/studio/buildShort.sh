#!/usr/bin/env bash
# One short Studio video (Retention Engine): audio -> camera plan + visual sounds -> audio again -> render -> scorecard.
# $0: the voice takes already exist (audio.py never calls a paid service).
#   STUDIO_SCRATCH=<takes root> PICS_DIR=<real outputs> PROTO_DIR=<render folder> SRC_WORK=<work with cards/ + wall.json> \
#   buildShort.sh <script.json> <work dir> <out.mp4> [--audio-only]
set -e
SCRIPT="$1"; WORK="$2"; OUT="$3"; ONLY="$4"
cd "$(dirname "$0")"
mkdir -p "$WORK"; rm -f "$WORK/moves.json" "$WORK/visual_events.json"
[ -d "$WORK/cards" ] || cp -r "$SRC_WORK/cards" "$WORK/cards"
[ -f "$WORK/wall.json" ] || cp "$SRC_WORK/wall.json" "$WORK/wall.json"
A=(--pics "$PICS_DIR" --takes "$STUDIO_SCRATCH")
python audio.py "$SCRIPT" eleven "$WORK" "${A[@]}" 2>&1 | grep -E "^eleven:|Error|error" || true
node writeMoves.mjs "$WORK" | tail -2
python audio.py "$SCRIPT" eleven "$WORK" "${A[@]}" 2>&1 | grep -E "^eleven:|^ +[0-9]|Error|error"
[ "$ONLY" = "--audio-only" ] && exit 0
TOT=$(python -c "import json;print(json.load(open(r'$WORK/timing.json'))['total'])")
WORK_DIR="$WORK" AUDIO="$WORK/mix.wav" OBS_OUT="$WORK/render_checks.json" PAGE="short.html" node render.mjs "$(cygpath -m "$(which ffmpeg)")" "$OUT" "$TOT" 30 2>&1 | grep -E "rendered|SAFE|OBSERV|error|reloading"
PAYOFF_WORDS="${PAYOFF_WORDS:-$PICS_DIR/video/m3/words.json}" node scoreShort.mjs "$WORK" "$OUT" "${OUT%.mp4}_scorecard.md"
