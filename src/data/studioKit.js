// THE ZYVO STUDIO KIT + the Zyvo connector on the site (docs/zyvo-studio-kit-plan.md C): the words, prices and
// addresses the Connect Claude page, the consent screen, the Studio projects tab and the In This Town section share.
// Prices are the connector's own (supabase/functions/_shared/zyvoMcp/config.js); the server always re-checks them.
import { FINISH_CREDITS, VIDEO_CREDITS, WRITE_SCRIPT_CREDITS, voiceCredits } from "../../supabase/functions/_shared/zyvoMcp/config.js";

// The MCP section in the tools shell (owner 2026-11-20): three tabs, Connect / Templates / MCP Studio.
export const MCP_PATH = "/workspace/mcp";
export const MCP_CONNECT_PATH = `${MCP_PATH}/connect`;
export const MCP_TEMPLATES_PATH = `${MCP_PATH}/templates`;
export const MCP_STUDIO_PATH = `${MCP_PATH}/studio`;
export const mcpTemplatePath = (id) => `${MCP_TEMPLATES_PATH}/${id}`;
// the names the pages already use, now pointing at the tabs; the old addresses only redirect (App.jsx, vercel.json)
export const STUDIO_PROJECTS_PATH = MCP_STUDIO_PATH;
export const CONNECT_CLAUDE_PATH = MCP_CONNECT_PATH;
export const OLD_STUDIO_PROJECTS_PATH = "/workspace/studio-projects";
export const OLD_CONNECT_CLAUDE_PATH = "/connect-claude";
export const CONSENT_PATH = "/connect/authorize";

/**
 * Before launch (phase 3 ships owner-only first): false = the In This Town section, the header link and the pages
 * show only to accounts the server says are open (GET /account/studio?peek=1). true = everyone sees the section.
 */
export const STUDIO_KIT_PUBLIC = false;

export const MCP_URL = "https://mcp.tryzyvo.com/mcp";
export const CLAUDE_CODE_COMMAND = `claude mcp add --transport http --scope user zyvo ${MCP_URL}`;

/** what the connector can do, as the Connect Claude page lists it */
export const CONNECTOR_TOOLS = [
  { name: "Story ideas", what: "Ideas for your town, each rule checked by our idea engine", price: "Free" },
  { name: "Save your Studio project", what: "Your script and shot plan show up in MCP Studio", price: "Free" },
  { name: "Check progress, list my videos", what: "Where a voice, finish or video is, with links", price: "Free" },
  { name: "Write the script", what: "Our tested writer, from your topic or idea", price: `${WRITE_SCRIPT_CREDITS} credits` },
  { name: "Make the voice", what: "Our narrator voice with exact word timings", price: `${voiceCredits(60)}-${voiceCredits(120)} credits` },
  { name: "Finish my video", what: "Your recording with our voice, captions, sound effects and music", price: `${FINISH_CREDITS} credits`, note: "first one free" },
  { name: "Make the whole video in Zyvo", what: "No Studio needed: we build, film and render it", price: `${VIDEO_CREDITS} credits` },
];

/** the consent screen: one plain line per permission (oauth.js scopes) */
export const SCOPE_TEXT = {
  ideas: "Get story ideas",
  scripts: "Write scripts with our writer",
  videos: "Save your Studio projects, make voices and finish videos",
  spend: "Spend your credits, only after you say yes to each price in Claude",
};

/** the system check, in plain words (the kit runs the same list before any work) */
export const REQUIREMENTS = [
  "A Windows 10+ or macOS computer with Roblox Studio installed and updated",
  "Claude Code: the Claude desktop app's Code tab (recommended) or the claude terminal command, on a Claude plan that includes Claude Code",
  "8 GB of memory (16 GB is better) and a graphics card that keeps Studio smooth at 1080p",
  "About 10 GB of free disk space for recordings",
  "A screen recorder: Xbox Game Bar or OBS on Windows, Cmd+Shift+5 on a Mac",
  "ffmpeg for the vertical crop and the captions (the kit offers to install it, and asks first)",
];

/** the free path and the Zyvo finish, side by side (owner 2026-11-20: the free kit gives a postable video) */
export const FREE_VS_FINISH = {
  free: ["Story, shot list and the whole Studio build", "Your own voice file, or a free voice", "A vertical video with simple white one-word captions"],
  finish: ["Our narrator voice, timed to every word", "Coloured captions per speaker", "Sound effects on the sound words", "A music bed mixed under the voice"],
};

export const STUDIO_KIT_FAQ = [
  { q: "What is free?", a: "The kit, the story and shot list it writes with you, the whole Studio build and the simple captioned video. Roblox Studio is free; Claude Code needs a Claude plan that includes it." },
  { q: "What costs credits?", a: `Only what you choose from Zyvo: our writer (${WRITE_SCRIPT_CREDITS} credits), our voice (about ${voiceCredits(90)} credits for 90 seconds), Finish my video (${FINISH_CREDITS} credits, your first one free) or the whole video made in Zyvo (${VIDEO_CREDITS} credits). Claude shows the price and waits for your yes every time.` },
  { q: "What if something fails?", a: "A voice, finish or video that fails gives every credit back, once, automatically." },
  { q: "Does the kit publish my place?", a: "Never. It doesn't save to Roblox or publish, it uses only free Creator Store models, deletes every script inside them, and never asks for your Roblox login." },
  { q: "No Studio, or a slow computer?", a: "Make it in Zyvo instead: we write, build, film and render the whole video for you." },
];
