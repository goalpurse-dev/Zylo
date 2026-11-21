// THE MCP TEMPLATES (owner 2026-11-20): the cards on MCP > Templates and each template's tutorial page.
// A new template = one more entry here (and its media in public/media/<folder>); the grid and the tutorial page render
// whatever is listed. Steps follow the kit's own words (kits/zyvo-roblox-story/QUICKSTART.md, reference/recording.md).
//
// A step's `shots` are REAL pictures (from the owner's Bedtime Story test). A step without real pictures shows a
// `diagram` (or a list of them) instead: our own drawing of the clicks, never a copy of another app's screen. Swapping
// a diagram for a real screenshot = add { src, alt, caption } to `shots`.
import { CLAUDE_CODE_COMMAND, CLAUDE_CODE_NAME, MCP_URL } from "./studioKit.js";

// the kit is the Claude Code skill "zyvo-roblox-story" (kits/zyvo-roblox-story/SKILL.md): its folder name is the slash command.
// Kit 1.4.0 (2026-11-21) renamed it from "roblox-story": another creator's skill uses that folder, installing one replaced the other.
export const KIT_SKILL = "zyvo-roblox-story";
/** the name up to kit 1.3.0 (the problems list tells people who type it) */
export const KIT_OLD_COMMAND = "/roblox-story";
export const KIT_COMMAND = `/${KIT_SKILL}`;
/** the recommended install (owner 2026-11-20; kit 1.4.0 names its own folder): the user pastes this into Claude Code, Claude does the rest */
export const KIT_INSTALL_PROMPT = `Install the ${KIT_SKILL} kit from my Downloads folder into my Claude skills folder as its own folder ${KIT_SKILL}; don't overwrite any other skill`;
export const KIT_FIRST_QUESTION = "What's your In This Town rule? Type it, or say 'ideas' and I'll suggest some.";
/** the tones /zyvo-roblox-story offers after the rule (owner 2026-11-20) */
export const KIT_TONES = ["Spooky (mimic horror)", "Funny", "Wholesome", "Twist"];
/** the end card (owner 2026-11-20): Free and Starter videos end with it, Pro and higher don't */
export const END_CARD = {
  seconds: 2,
  line: "Made with Zyvo AI · tryzyvo.com",
  text: "On the Free and Starter plans, every video ends with a 2-second card: your cast lined up, with \"Made with Zyvo AI · tryzyvo.com\". Pro and higher plans have no end card.",
};

export const MCP_TEMPLATES = [
  {
    id: "in-this-town",
    title: "In This Town",
    pitch: "Claude writes a Roblox-style town story and builds it in your own Roblox Studio.",
    badge: "Free kit",
    beta: true, // owner 2026-11-21: opened to everyone, still labelled Beta
    video: "jjNl8NhYptY", // the owner's YouTube tutorial of this kit (data/inThisTownLanding.js TOWN_TUTORIALS)
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
        id: "connector",
        title: "Add Zyvo in the Claude app",
        text: "In the Claude desktop or web app: Settings > Connectors > Add custom connector. Name it Zyvo, paste this link, then sign in to Zyvo and press Allow. Connecting is free: anything that costs credits shows its price in Claude first.",
        commands: [{ label: "The connector link", value: MCP_URL }],
        after: `It works inside Claude Code too, where it shows up as "${CLAUDE_CODE_NAME}". So most people only need this one. Use Claude Code only in a terminal? The command below is the other way. Don't add both.`,
        alt: { label: "Or, in a terminal (not both)", value: CLAUDE_CODE_COMMAND },
        connectHelp: true,
        diagram: { kind: "clicks", path: ["Settings", "Connectors", "Add custom connector"], fields: [["Name", "Zyvo"], ["URL", MCP_URL]] },
      },
      {
        id: "install",
        title: "Install the kit",
        text: "Download the kit, then open the Claude app's Code tab (any folder) and paste the line below. Claude makes the folders, unzips the kit into your skills folder and checks it.",
        download: true,
        prompt: KIT_INSTALL_PROMPT,
        promptLabel: "Paste this into Claude",
        bullets: [
          `When Claude says it's installed, start a NEW Code session: that's where ${KIT_COMMAND} works.`,
          `By hand instead: unzip it so the folder ${KIT_SKILL} sits right inside skills. Windows: C:\\Users\\<you>\\.claude\\skills\\${KIT_SKILL}. Mac: ~/.claude/skills/${KIT_SKILL}.`,
        ],
        diagram: { kind: "folders", path: [".claude", "skills", KIT_SKILL], files: ["SKILL.md", "QUICKSTART.md", "luau", "scripts"] },
      },
      {
        id: "studio",
        title: "Connect Roblox Studio",
        text: "Open Roblox Studio, then New > Baseplate: always a new, empty place, never one of your real games. Turn on Studio's MCP server:",
        bullets: ["Click Assistant (top right) > ... > Settings > MCP Servers", "Switch on Enable Studio as MCP server"],
        between: "Then make an empty folder for your videos (for example Documents\\ZyvoStudio) and open a Code session in it. Ask Claude: \"Connect to Roblox Studio for every folder\". Or paste the line for your computer into a terminal:",
        commands: [
          { label: "Windows", value: "claude mcp add --scope user Roblox_Studio -- cmd.exe /c %LOCALAPPDATA%\\Roblox\\mcp.bat" },
          { label: "Mac", value: "claude mcp add --scope user Roblox_Studio -- /Applications/RobloxStudio.app/Contents/MacOS/StudioMCP" },
        ],
        after: `Then start a NEW Code session in the same folder, with Studio open, and type /mcp: Roblox_Studio and ${CLAUDE_CODE_NAME} should both say connected.`,
        diagram: [
          { kind: "clicks", path: ["Assistant", "...", "Settings", "MCP Servers"], toggle: "Enable Studio as MCP server" },
          { kind: "terminal", lines: [{ t: "> /mcp" }, { t: "Roblox_Studio", ok: "connected" }, { t: CLAUDE_CODE_NAME, ok: "connected" }] },
        ],
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
        id: "tone",
        title: "Pick the tone",
        text: "Claude asks how the story should feel. Pick one by its name or number.",
        bullets: KIT_TONES,
        diagram: { kind: "chat", lines: [
          { who: "claude", t: `Which tone?\n${KIT_TONES.map((x, i) => `${i + 1}. ${x}`).join("\n")}` },
          { who: "you", t: "2" },
        ] },
      },
      {
        id: "approve",
        title: "Approve each step",
        text: "Claude goes step by step: the script, a grey blockout, the world, the cast, the lighting and the shot list. Look at each one, say what to change, then say yes. When Claude asks to use a Studio tool, allow it.",
        bullets: ["Studio's camera moves to whatever is being built, so you can watch it happen.", "Before filming, it checks every shot and shows you a contact sheet of all of them."],
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
        title: "Record the Play run",
        text: "Claude plays the shots; you record the Studio window. Claude stays silent while Play runs.",
        bullets: [
          "First turn on Do not disturb (Windows: the bell by the clock, or Settings > System > Notifications. Mac: Control Center > Focus): no pop-ups in your recording",
          "Test tab > Device: None (no phone emulator)",
          "Maximize Studio (double-click its title bar) and close the panels around the view",
          "Windows: Win+G > Settings > Capturing > audio off. Mac: Cmd+Shift+5 > Options > Microphone: None",
          "Start recording (Win+Alt+R), then type \"ready\": Claude presses Play",
          "The picture looks sideways in Studio: that's expected. Stop recording when it goes black at the end.",
        ],
        diagram: { kind: "checklist", items: ["Do not disturb on", "Device: None", "Studio maximized", "Recorder audio off", "Recording, then \"ready\""] },
      },
      {
        id: "finish",
        title: "Finish it",
        text: "Give Claude the recording's file path. It turns it upright, crops it to 9:16 and lines it up with the voice. Then finish it one of two ways. When it's done, the video and its folder open by themselves.",
        finish: true,
        endCard: true,
      },
    ],
    problems: [
      { q: `${KIT_COMMAND} isn't found`, a: `The kit isn't in the skills folder yet, or the session started before it was. Paste "${KIT_INSTALL_PROMPT}" into Claude, then start a NEW Code session and type ${KIT_COMMAND} again.` },
      { q: `${KIT_OLD_COMMAND} opens a different skill`, a: `Our kit is now ${KIT_COMMAND} (it was ${KIT_OLD_COMMAND} up to version 1.3.0, the same name as another creator's skill). Download the kit again, paste "${KIT_INSTALL_PROMPT}" into Claude, start a NEW Code session and type ${KIT_COMMAND}. Leave the other skill's roblox-story folder alone; only delete it if it is our old kit.` },
      { q: "\"claude\" is not recognized", a: "Your terminal can't find Claude Code: it isn't on your PATH yet. Use the Claude desktop app's Code tab (no terminal needed), or open a NEW terminal after installing Claude Code. Still not found on Windows? Add the folder the installer named (usually %USERPROFILE%\\.local\\bin) to PATH, then open a new terminal." },
      { q: "Zyvo shows up twice in /mcp", a: `It was added both ways. Keep ${CLAUDE_CODE_NAME} (the Claude app's connector) and remove the terminal one: claude mcp remove --scope user zyvo` },
      { q: "The Roblox tools aren't loaded", a: "Open Roblox Studio first (with Enable Studio as MCP server on), then close Claude Code and start it again in your video folder. Type /mcp: Roblox_Studio must say connected. Started in another folder? Add it with --scope user (step 3) so it works in every folder." },
      { q: "Screenshots come out grey", a: "Keep Studio in front while Claude works: not minimized and not covered by another window. Studio only draws its view while you can see it." },
    ],
  },
];

export const getMcpTemplate = (id) => MCP_TEMPLATES.find((t) => t.id === id) ?? null;
