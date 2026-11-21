# Zyvo Roblox Story: the Zyvo Studio Kit (free)

Make a Roblox "In This Town" story short in your own Roblox Studio, with Claude doing the building. Install it the easy
way: download the zip, then in Claude Code paste *"Install the zyvo-roblox-story kit from my Downloads folder into my Claude
skills folder as its own folder zyvo-roblox-story; don't overwrite any other skill"* (or unzip it yourself so the folder is `~/.claude/skills/zyvo-roblox-story`; Windows:
`C:\Users\<you>\.claude\skills\zyvo-roblox-story`). Start a new session, then type **`/zyvo-roblox-story`** in
Claude Code or the Claude desktop app's Code tab (or `/zyvo-roblox-story <your rule>` to start straight away). Claude writes the
story, builds the town, dresses the cast, places every camera, checks every shot in a 9:16 frame and runs the whole
film in Play while you screen-record it. Free: the kit costs nothing, and nothing leaves your computer except what
Claude and Roblox Studio normally send.

**Start here:** [QUICKSTART.md](QUICKSTART.md), 8 steps in plain English.

**Version 1.4.0: renamed.** Up to 1.3.0 this kit was `/roblox-story` in the folder `skills/roblox-story`, the same
name as another creator's skill, so installing one replaced the other. It is now `/zyvo-roblox-story` in its own folder
`skills/zyvo-roblox-story`. Had the old one? You can delete its folder (only if it is this kit: its SKILL.md says "Zyvo
Studio Kit"); the first `/zyvo-roblox-story` run offers to do it for you.

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
  shot list, the framing checker (framer + frame_check), the contact-sheet preview, the director installer, the
  end card set (endcard), show_build (moves your Studio camera to what was just built) and backdrop (the packed
  world: far ground, background buildings, hills, street dressing and people around every location).
- `runtime/`: the three scripts that run during Play: the camera, the life (breathing, yawns, waves) and the actions.
- `scripts/`: `system_check.*` (can this computer do it?) and `make_vertical.sh` (the recording -> an upright 9:16 mp4),
  `add_captions.sh` (+ the voice and simple white one-word captions -> a postable mp4), `prep_voice.sh` (your own
  voice file -> the recommended pace, with its pauses for timing) and `contact_sheet.sh` (the stills -> sheets).

## The rules it keeps
It never saves or publishes your place, uses only free Creator Store models (and removes every script and sound from
them), adds no audio, shows no Roblox logos or UI, and never asks for any API key.

Free and Starter plan videos (and videos made without Zyvo connected) end with a 2-second end card: the cast lined up
+ "Made with Zyvo AI · tryzyvo.com". Pro and higher: none. Zyvo connects ONE way: the Claude app's connector (it
also shows in Claude Code as "claude.ai Zyvo") or the terminal command, not both.

Want the voice, captions, sound and music done for you, or the whole video made for you? Zyvo:
https://www.tryzyvo.com/in-this-town-story-video-maker
