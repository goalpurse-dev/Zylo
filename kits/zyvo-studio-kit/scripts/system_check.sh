#!/bin/bash
# Zyvo Studio Kit: system check (macOS). Read-only: it changes nothing and sends nothing anywhere.
fail=0; warn=0
say() { printf "%-4s %s: %s\n" "$1" "$2" "$3"; [ "$1" = FAIL ] && fail=$((fail+1)); [ "$1" = WARN ] && warn=$((warn+1)); }

ver=$(sw_vers -productVersion 2>/dev/null)
major=${ver%%.*}
if [ -n "$major" ] && [ "$major" -ge 13 ]; then say OK OS "macOS $ver"; else say FAIL OS "macOS 13 or newer is needed (this is ${ver:-not macOS})"; fi

app="/Applications/RobloxStudio.app"
if [ -d "$app" ]; then say OK "Roblox Studio" "found"; else say FAIL "Roblox Studio" "not found: install it from create.roblox.com, open it once, then run this again"; fi
if [ -x "$app/Contents/MacOS/StudioMCP" ]; then say OK "Studio MCP launcher" "found"; else say FAIL "Studio MCP launcher" "missing: update Roblox Studio and turn on 'Enable Studio as MCP server'"; fi

ram=$(( $(sysctl -n hw.memsize 2>/dev/null || echo 0) / 1073741824 ))
if [ "$ram" -ge 16 ]; then say OK RAM "$ram GB"; elif [ "$ram" -ge 8 ]; then say WARN RAM "$ram GB: it works; close other apps while recording"; else say FAIL RAM "$ram GB: Studio needs at least 8 GB to record smoothly"; fi

chip=$(sysctl -n machdep.cpu.brand_string 2>/dev/null)
gpu=$(system_profiler SPDisplaysDataType 2>/dev/null | awk -F': ' '/Chipset Model/{print $2; exit}')
if [ -n "$gpu" ]; then
  case "$gpu$chip" in *Apple*|*Radeon*|*NVIDIA*) say OK GPU "$gpu";; *) say WARN GPU "$gpu: integrated graphics; keep the Studio window small while recording";; esac
else say FAIL GPU "no graphics found"; fi

free=$(df -g . | awk 'NR==2{print $4}')
if [ "$free" -ge 10 ]; then say OK "Free disk" "$free GB"; elif [ "$free" -ge 4 ]; then say WARN "Free disk" "$free GB: enough for a short recording"; else say FAIL "Free disk" "$free GB: free up at least 4 GB for the recording"; fi

say OK "Screen recorder" "macOS Screenshot app (Cmd+Shift+5)"

if [ $fail -gt 0 ]; then echo "RESULT: not-ready"; elif [ $warn -gt 0 ]; then echo "RESULT: ready-with-warnings"; else echo "RESULT: ready"; fi
