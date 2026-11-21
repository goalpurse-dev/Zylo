# Quick start: your first In This Town video in 8 steps

About 1-2 hours the first time. Free.

**1. Get Claude.** Install the Claude desktop app (claude.ai/download) and open the **Code** tab. You need a Claude
plan that includes Claude Code.

**2. Get Roblox Studio.** Install it free from create.roblox.com, sign in, and open **New > Baseplate**. Always use a
new, empty place: never one of your real games.

**3. Turn on Studio's connection.** In Studio click **Assistant** (top right) > **...** > **Settings** > **MCP
Servers**, and switch on **Enable Studio as MCP server**.

**4. Add the kit (recommended: let Claude do it).** Download the kit (it lands in Downloads), open the Claude app's
**Code** tab in any folder and paste:

> Install the zyvo-roblox-story kit from my Downloads folder into my Claude skills folder as its own folder zyvo-roblox-story; don't overwrite any other skill

Claude finds the newest `zyvo-roblox-story*.zip` in Downloads, makes the skills folder if it isn't there, unzips the kit
into it as its own folder `zyvo-roblox-story` (replacing only an older copy of this kit, never another skill), checks that `zyvo-roblox-story/SKILL.md` is in place, and tells you to start a NEW
Code session and type `/zyvo-roblox-story`. By hand instead: unzip it so this file ends up at
`C:\Users\<you>\.claude\skills\zyvo-roblox-story\QUICKSTART.md` (Windows) or `~/.claude/skills/zyvo-roblox-story/QUICKSTART.md`
(macOS). That folder name is the command you'll type in step 6: `/zyvo-roblox-story`.

**5. Connect Claude to Studio.** Make an empty folder for your videos (e.g. `Documents\ZyvoStudio`) and start a Code
session in it. Ask Claude: *"Connect to Roblox Studio for every folder"*, or paste this into a terminal yourself:
- Windows: `claude mcp add --scope user Roblox_Studio -- cmd.exe /c %LOCALAPPDATA%\Roblox\mcp.bat`
- macOS: `claude mcp add --scope user Roblox_Studio -- /Applications/RobloxStudio.app/Contents/MacOS/StudioMCP`

Then start a NEW Code session in the same folder (with Studio open) and type `/mcp`: Roblox Studio should say
connected.

*Optional, Zyvo:* to use Zyvo's ideas, voice and finish, add Zyvo ONCE in the Claude app: Settings > Connectors > Add
custom connector > `https://mcp.tryzyvo.com/mcp`, then sign in. It works in the Code tab too (`/mcp` shows it as
**claude.ai Zyvo**). The terminal command `claude mcp add --transport http --scope user zyvo https://mcp.tryzyvo.com/mcp`
is the other way: use one, not both.

**6. Make it.** Type **`/zyvo-roblox-story`**. Claude asks for your In This Town rule: type it, or say *ideas* and pick one
of 5 by its number (*more* gives 5 new ones). Already know your rule? Type it right after the command, e.g.
`/zyvo-roblox-story every time you yawn, everyone around you falls asleep`. Claude keeps your idea and your words (if it
suggests a tighter version, you see both and yours is the default), then asks the tone: Spooky (mimic horror), Funny,
Wholesome or Twist. Then it checks your computer and goes step by step: the script, a grey blockout, the world, the
cast, the light, the voice, the shot list. After each build Studio's camera jumps to what was just made. You approve
each step; say what to change. Before filming it checks every shot and shows you a contact sheet of all of them.

**7. Record it.** Turn on **Do not disturb** first (Windows: Win+N > Do not disturb; macOS: Focus), so no pop-up lands in
the video. Turn off audio in your recorder (Windows: Win+G > Settings > Capturing > audio off; macOS: Cmd+Shift+5 >
Options > Microphone: None). Maximize Studio, start recording (Win+Alt+R), say "ready", and Claude starts Play and
stays silent until the run ends. The picture looks sideways in Studio: that's expected. Stop recording when it goes
black at the end.

**8. Finish it.** Give Claude the recording's file path. It turns it upright, crops it to 9:16 and lines it up with
the voice (needs ffmpeg; Claude offers to install it), then adds your voice and simple white one-word captions:
`final_free.mp4` is ready to post, and Claude opens it and its folder for you. Want more? Let Zyvo finish it: our
voice, coloured captions per speaker, sound effects and music, with and without music.

On the Free and Starter plans (and without Zyvo connected) every video ends with a 2-second card: your cast lined up
+ "Made with Zyvo AI · tryzyvo.com". Pro and higher: no end card.

Never publish the place or save it to Roblox. File > Save to File (a copy on your computer) is fine if you want to
come back later.
