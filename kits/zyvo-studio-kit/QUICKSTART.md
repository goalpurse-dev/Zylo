# Quick start: your first In This Town video in 8 steps

About 1-2 hours the first time. Free.

**1. Get Claude.** Install the Claude desktop app (claude.ai/download) and open the **Code** tab. You need a Claude
plan that includes Claude Code.

**2. Get Roblox Studio.** Install it free from create.roblox.com, sign in, and open **New > Baseplate**. Always use a
new, empty place: never one of your real games.

**3. Turn on Studio's connection.** In Studio click **Assistant** (top right) > **...** > **Settings** > **MCP
Servers**, and switch on **Enable Studio as MCP server**.

**4. Add the kit.** Unzip it into your skills folder, so this file ends up at:
- Windows: `C:\Users\<you>\.claude\skills\zyvo-studio-kit\QUICKSTART.md`
- macOS: `~/.claude/skills/zyvo-studio-kit/QUICKSTART.md`

**5. Connect Claude to Studio.** Make an empty folder for your videos (e.g. `Documents\ZyvoStudio`) and start a Code
session in it. Ask Claude: *"Connect to Roblox Studio for every folder"*, or paste this into a terminal yourself:
- Windows: `claude mcp add --scope user Roblox_Studio -- cmd.exe /c %LOCALAPPDATA%\Roblox\mcp.bat`
- macOS: `claude mcp add --scope user Roblox_Studio -- /Applications/RobloxStudio.app/Contents/MacOS/StudioMCP`

Then start a NEW Code session in the same folder (with Studio open) and type `/mcp`: Roblox Studio should say
connected.

**6. Make it.** Type: *"Use the zyvo-studio-kit skill. Make an In This Town video about: in this town, ..."*. Claude
checks your computer, then goes step by step: the idea, the script, a grey blockout, the world, the cast, the light,
the voice, the shot list. You approve each step; say what to change. Before filming it checks every shot and shows
you a contact sheet of all of them.

**7. Record it.** Turn off audio in your recorder (Windows: Win+G > Settings > Capturing > audio off; macOS:
Cmd+Shift+5 > Options > Microphone: None). Maximize Studio, start recording (Win+Alt+R), say "ready", and Claude
starts Play. The picture looks sideways in Studio: that's expected. Stop recording when it goes black at the end.

**8. Finish it.** Give Claude the recording's file path. It turns it upright, crops it to 9:16 and lines it up with
the voice (needs ffmpeg; Claude offers to install it), then adds your voice and simple white one-word captions:
`final_free.mp4` is ready to post. Want more? Let Zyvo finish it: our voice, coloured captions per speaker, sound
effects and music, with and without music.

Never publish the place or save it to Roblox. File > Save to File (a copy on your computer) is fine if you want to
come back later.
