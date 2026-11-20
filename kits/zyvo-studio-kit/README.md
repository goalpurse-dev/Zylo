# Zyvo Studio Kit (free)

Make a Roblox "In This Town" story short in your own Roblox Studio, with Claude doing the building. Claude writes the
story, builds the town, dresses the cast, places every camera, checks every shot in a 9:16 frame and runs the whole
film in Play while you screen-record it. Free: the kit costs nothing, and nothing leaves your computer except what
Claude and Roblox Studio normally send.

**Start here:** [QUICKSTART.md](QUICKSTART.md), 8 steps in plain English.

## What you need
- Windows 10/11 or macOS 13+, 8 GB RAM or more (16 GB is smoother).
- Roblox Studio (free) with "Enable Studio as MCP server" turned on.
- Claude Code: the Claude desktop app's Code tab (recommended) or the `claude` terminal command, on a Claude plan that
  includes Claude Code.
- ffmpeg (free) for the last step; the kit offers to install it.

## What's inside
- `SKILL.md`: the steps Claude follows (idea, script, blockout, world, cast, lighting, voice, shot list, Play run).
- `reference/`: setup, story writing, voice, shot list rules, recording.
- `luau/`: the Studio helpers Claude runs: blockout, camera spots, asset check + clean, cast library + cast, lighting,
  shot list, the framing checker (framer + frame_check), the contact-sheet preview, the director installer.
- `runtime/`: the three scripts that run during Play: the camera, the life (breathing, yawns, waves) and the actions.
- `scripts/`: `system_check.*` (can this computer do it?) and `make_vertical.sh` (the recording -> an upright 9:16 mp4),
  `add_captions.sh` (+ the voice and simple white one-word captions -> a postable mp4).

## The rules it keeps
It never saves or publishes your place, uses only free Creator Store models (and removes every script and sound from
them), adds no audio, shows no Roblox logos or UI, and never asks for any API key.

Want the voice, captions, sound and music done for you, or the whole video made for you? Zyvo:
https://www.tryzyvo.com/in-this-town-story-video-maker
