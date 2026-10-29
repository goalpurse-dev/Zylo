#!/usr/bin/env bash
# M2 step F, third pass: free re-renders with the vision check off (the Anthropic balance ran out on 2026-10-22): the
# water well and the golden French drain from their accepted layouts (camera and grading fixes), the septic tank at
# 60 s (its plan and voice are already paid; its preview vision check could not run).
R=/c/Users/Public/Zylo/research/seamless-niche
P=${M2_PROTO:-/c/Users/Huhta/AppData/Local/Temp/claude/c--Users-Public-Zylo/9fd93e59-a925-49a7-beab-dadbb576d507/scratchpad/proto}
FF=/c/Users/Huhta/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe
LOG=$R/work/m2spend.jsonl
cd "$(dirname "$0")/.."
run() { local name=$1; shift; echo "=== $name"; mkdir -p "$1"; node m2/run.mjs --out "$@" --proto $P --ff $FF --log $LOG --noVision > "$1/run_free.log" 2>&1; grep -E '"ok"|"totalUsd"|"saturation"|"stage":"failed"|Error' "$1/run_free.log" | head -5; }
run water_well $R/work/m2run_water_well --topic "a water well" --length 30
run golden_french_drain $R/work/m2golden/french_drain --topic "golden French drain" --length 30 --script $R/work/m2golden/french_drain.script.json --voice $R/m2drain/voice/voice_final.mp3 --words $R/m2drain/voice/voice_final.words.json
run septic_tank_new_60 $R/work/m2run_septic_tank60 --topic "a septic tank" --length 60
echo "=== step F3 done"
