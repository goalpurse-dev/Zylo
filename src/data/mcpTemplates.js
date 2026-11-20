// THE MCP TEMPLATES (owner 2026-11-20): the cards on MCP > Templates and each template's tutorial page.
// A new template = one more entry here (and its media in public/media/<folder>); the grid and the tutorial page render
// whatever is listed. Steps follow the kit's own words (kits/roblox-story/QUICKSTART.md, reference/recording.md).
//
// A step's `shots` are REAL pictures (from the owner's Bedtime Story test). A step without real pictures shows a
// `diagram` instead: our own drawing of the clicks, never a copy of another app's screen. Swapping a diagram for a
// real screenshot = add { src, alt, caption } to `shots`.

// the kit is the Claude Code skill "roblox-story" (kits/roblox-story/SKILL.md): its folder name is the slash command
export const KIT_SKILL = "roblox-story";
export const KIT_COMMAND = `/${KIT_SKILL}`;
export const KIT_FIRST_QUESTION = "What's your In This Town rule? Type it, or say 'ideas' and I'll suggest some.";

export const MCP_TEMPLATES = [
  {
    id: "in-this-town",
    title: "In This Town",
    pitch: "Claude writes a Roblox-style town story and builds it in your own Roblox Studio.",
    badge: "Free kit",
    thumb: "/media/studio-kit/bedtime-zyvo.webp",
    thumbAlt: "A frame of our Bedtime Story video, made with the kit in Roblox Studio",
    time: "About 1-2 hours the first time",
    needs: [
      { title: "Roblox Studio", text: "Free from create.roblox.com. Sign in and keep it updated.", link: { href: "https://create.roblox.com/", label: "Get Roblox Studio" } },
      { title: "The Claude desktop app, Code tab", text: "On a Claude plan that includes Claude Code. The Code tab needs no terminal.", link: { href: "https://claude.ai/download", label: "Get the Claude app" } },
      { title: "ffmpeg (free)", text: "Turns the recording upright and adds the captions. The kit offers to install it and asks first." },
    ],
    steps: [
      {
        id: "install",
        title: "Install the kit",
        text: `Download the kit (below), then unzip it into Claude's skills folder, so the folder ${KIT_SKILL} sits right inside skills. That folder name is the command you'll type in step 4.`,
        bullets: [`Windows: C:\\Users\\<you>\\.claude\\skills\\${KIT_SKILL}`, `Mac: ~/.claude/skills/${KIT_SKILL}`],
        download: true,
        diagram: { kind: "folders", path: [".claude", "skills", KIT_SKILL], files: ["SKILL.md", "QUICKSTART.md", "luau", "scripts"] },
      },
      {
        id: "studio-mcp",
        title: "Turn on Studio's MCP server",
        text: "Open Roblox Studio, then New > Baseplate: always a new, empty place, never one of your real games.",
        bullets: ["Click Assistant (top right) > ... > Settings > MCP Servers", "Switch on Enable Studio as MCP server"],
        diagram: { kind: "clicks", path: ["Assistant", "...", "Settings", "MCP Servers"], toggle: "Enable Studio as MCP server" },
      },
      {
        id: "connect",
        title: "Connect Claude to Studio",
        text: "Make an empty folder for your videos (for example Documents\\ZyvoStudio) and open a Code session in it. Ask Claude: \"Connect to Roblox Studio for every folder\". Or paste the line for your computer into a terminal:",
        commands: [
          { label: "Windows", value: "claude mcp add --scope user Roblox_Studio -- cmd.exe /c %LOCALAPPDATA%\\Roblox\\mcp.bat" },
          { label: "Mac", value: "claude mcp add --scope user Roblox_Studio -- /Applications/RobloxStudio.app/Contents/MacOS/StudioMCP" },
        ],
        after: "Then start a NEW Code session in the same folder, with Studio open, and type /mcp: Roblox_Studio should say connected.",
        connectZyvo: true,
        diagram: { kind: "terminal", lines: [{ t: "> /mcp", dim: false }, { t: "Roblox_Studio", ok: "connected" }, { t: "zyvo (optional)", ok: "connected" }] },
      },
      {
        id: "prompt",
        title: `Type ${KIT_COMMAND}`,
        text: `In the same Code session, type ${KIT_COMMAND}. Claude asks for your In This Town rule: type it, or say "ideas" and pick one of 5 by its number ("more" gives 5 new ones). Then it checks your computer and starts.`,
        bullets: [`Know your rule already? Type it right after the command: ${KIT_COMMAND} every time you yawn, everyone around you falls asleep`],
        prompt: KIT_COMMAND,
        promptLabel: "Type this",
        diagram: { kind: "chat", lines: [
          { who: "you", t: KIT_COMMAND },
          { who: "claude", t: KIT_FIRST_QUESTION },
          { who: "you", t: "ideas" },
          { who: "claude", t: "1. In this town, your shadow tells everyone how you feel\n2. In this town, it rains whatever you dreamed\n… Pick a number, or say 'more'." },
          { who: "you", t: "2" },
        ] },
      },
      {
        id: "approve",
        title: "Approve each step",
        text: "Claude goes step by step: the idea, the script, a grey blockout, the world, the cast, the light, the voice and the shot list. Look at each one, say what to change, then say yes. When Claude asks to use a Studio tool, allow it.",
        bullets: ["Before filming, it checks every shot and shows you a contact sheet of all of them."],
        shots: [
          { src: "/media/studio-kit/build-1.webp", alt: "The grey blockout of the town in Roblox Studio", caption: "Blockout" },
          { src: "/media/studio-kit/build-2.webp", alt: "The town's world built in Roblox Studio", caption: "World" },
          { src: "/media/studio-kit/build-3.webp", alt: "The town lit for filming", caption: "Light" },
          { src: "/media/studio-kit/build-4.webp", alt: "The cast standing in the town", caption: "Cast" },
          { src: "/media/studio-kit/contact-sheet.webp", alt: "The contact sheet: a 9:16 still of every shot with its number, time and line", caption: "Contact sheet", wide: true },
        ],
      },
      {
        id: "record",
        title: "Record it",
        text: "Claude plays the shots; you record the Studio window.",
        bullets: [
          "Test tab > Device: None (no phone emulator)",
          "Maximize Studio (double-click its title bar) and close the panels around the view",
          "Windows: Win+G > Settings > Capturing > audio off. Mac: Cmd+Shift+5 > Options > Microphone: None",
          "Start recording (Win+Alt+R), then type \"ready\": Claude presses Play",
          "The picture looks sideways in Studio: that's expected. Stop recording when it goes black at the end.",
        ],
        diagram: { kind: "checklist", items: ["Device: None", "Studio maximized", "Recorder audio off", "Recording, then \"ready\""] },
      },
      {
        id: "finish",
        title: "Finish it",
        text: "Give Claude the recording's file path. It turns it upright, crops it to 9:16 and lines it up with the voice.",
        finish: true,
      },
    ],
    problems: [
      { q: "\"claude\" is not recognized", a: "Your terminal can't find Claude Code: it isn't on your PATH yet. Use the Claude desktop app's Code tab (no terminal needed), or open a NEW terminal after installing Claude Code. Still not found on Windows? Add the folder the installer named (usually %USERPROFILE%\\.local\\bin) to PATH, then open a new terminal." },
      { q: "The Roblox tools aren't loaded", a: "Open Roblox Studio first (with Enable Studio as MCP server on), then close Claude Code and start it again in your video folder. Type /mcp: Roblox_Studio must say connected. Started in another folder? Add it with --scope user (step 3) so it works in every folder." },
      { q: "Screenshots come out grey", a: "Keep Studio in front while Claude works: not minimized and not covered by another window. Studio only draws its view while you can see it." },
    ],
  },
];

export const getMcpTemplate = (id) => MCP_TEMPLATES.find((t) => t.id === id) ?? null;
