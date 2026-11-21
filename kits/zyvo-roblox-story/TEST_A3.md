# A3 test: one whole video in Roblox Studio (you run it; about 1-2 hours; free)

Do A1 first (TEST_A1.md): Studio connected, `/mcp` shows Roblox Studio.

## 1. Install the skill
Windows (PowerShell): `Copy-Item -Recurse C:\Users\Public\Zylo\kits\zyvo-roblox-story $HOME\.claude\skills\zyvo-roblox-story`
macOS: `cp -R kits/zyvo-roblox-story ~/.claude/skills/zyvo-roblox-story`
Start Claude Code in an empty folder (e.g. `C:\ZyvoTest`), so the project files land there.

## 2. Start
Open Studio with a NEW Baseplate. In Claude Code:

> /zyvo-roblox-story "in this town, your shadow tells everyone how you
> really feel". About 60 seconds.

## 3. What should happen (approve or correct at each step)
| Step | You should see | Check |
|---|---|---|
| 0 Setup | the system check result, the connection test | it stops and says why if something is missing |
| 1 Idea | the rule's six test scores (9+ of 12) | the scores are shown per test |
| 2 Script | `zyvo-project/<slug>/script.md`: style sheet, 4 locations, logic answers, ~60 s | the hook first, "You see, in this town" by line 2 |
| 3 Blockout | grey boxes per location, the rule sign, screenshots in `screenshots/` | locations far apart, the sign readable |
| 4 World | free models placed, `credits.txt` filled | the Output says scripts and sounds were removed |
| 5 Cast | coloured custom avatars, no name tags | none looks like the default avatar |
| 6 Lighting | warm low sun, long shadows | faces still readable |
| 7 Shot list | `shots.json`, the ZyvoShots module, the two director scripts | `problems` list empty |
| 8 Play run | black 3 s, the shots, black 1.5 s; no UI, no sound | you record it (TEST: Game Bar with audio OFF) |

## 4. Rules to watch (tell me if any is broken)
- It never saves or publishes the place, never uses paid models, never adds sound.
- No Roblox UI (no top bar, no chat, no thumbstick) and no name tags in the recording.
- Each step ends with ONE plain Zyvo line, not a sales pitch.

## 5. Send me back
- The recording (or its length + a few screenshots), `script.md`, `shots.json`, `credits.txt`.
- Where it got stuck, the exact message, and how long each step took.
- Anything that looked wrong (camera inside a wall, someone floating, a shot with nobody in it).
