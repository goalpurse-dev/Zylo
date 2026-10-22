#!/usr/bin/env bash
# M2 step F: the proof runs, one after another (the GPU renders one at a time). Stops before a run when the worst-case
# M2 spend (measured + dropped calls) would pass $8, leaving room under the owner's $10.
R=/c/Users/Public/Zylo/research/seamless-niche
P=${M2_PROTO:-/c/Users/Huhta/AppData/Local/Temp/claude/c--Users-Public-Zylo/9fd93e59-a925-49a7-beab-dadbb576d507/scratchpad/proto}
FF=/c/Users/Huhta/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe
LOG=$R/work/m2spend.jsonl
cd "$(dirname "$0")/.."
guard() { local w; w=$(node m2/tally.mjs $LOG $R/BUILD_PLAN.md | sed -E 's/measured \$([0-9.]+), dropped calls up to \$([0-9.]+)/\1 \2/' | awk '{print $1+$2}'); echo "spend so far (worst case): \$$w"; awk -v w="$w" 'BEGIN{exit !(w < 8)}'; }
run() { local name=$1; shift; guard || { echo "STOP: budget guard before $name"; exit 1; }; echo "=== $name"; mkdir -p "$1"; node m2/run.mjs --out "$@" --proto $P --ff $FF --log $LOG > "$1/run.log" 2>&1; grep -E '"ok"|"totalUsd"|"saturation"|"stage":"failed"' "$1/run.log" | head -5; }
run water_well $R/work/m2run_water_well --topic "a water well" --length 30
run golden_french_drain $R/work/m2golden/french_drain --topic "golden French drain" --length 30 --script $R/work/m2golden/french_drain.script.json --voice $R/m2drain/voice/voice_final.mp3 --words $R/m2drain/voice/voice_final.words.json
run golden_landfill $R/work/m2golden/landfill --topic "golden landfill" --length 30 --script $R/work/m2golden/landfill.script.json --voice $R/m1/voice_tests/voice_final_eric.mp3 --words $R/m1/voice_tests/voice_final_eric.words.json
run french_drain_saved_30 $R/work/m2run_french_drain_saved30 --topic "a French drain" --length 30 --reuse french_drain
run septic_tank_new_60 $R/work/m2run_septic_tank60 --topic "a septic tank" --length 60
run french_drain_saved_60 $R/work/m2run_french_drain_saved60 --topic "a French drain" --length 60 --reuse french_drain
guard
echo "=== step F done"
