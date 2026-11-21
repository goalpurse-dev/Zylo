// THE ZYVO CONNECTOR (remote MCP server, docs/zyvo-studio-kit-plan.md B): prices, limits, timings, scopes. Plain JS:
// the edge function (supabase/functions/zyvo-mcp) and the Node tests import the same values.
// Prices follow our rule: 1 credit = $0.01 of our full cost, the user pays $0.02 a credit (2x cost).
import { BLENDER_FLAT } from "../blockyWorlds/blenderPricing.js";

export const SERVER = Object.freeze({
  name: "zyvo",
  title: "Zyvo",
  version: "1.0.0",
  // MCP protocol versions we speak (newest first); the client's is echoed back when we know it
  protocolVersions: Object.freeze(["2025-11-25", "2025-06-18", "2025-03-26"]),
});

export const OAUTH = Object.freeze({
  accessTtlSec: 3600, // 1 h access tokens
  refreshTtlDays: 30, // refresh tokens rotate on every use
  codeTtlSec: 300, // authorization codes: 5 minutes, single use
  requestTtlSec: 600, // the consent screen has 10 minutes
  // one scope per kind (plan "Security notes"); a connection without "spend" can never charge
  scopes: Object.freeze(["ideas", "scripts", "videos", "spend"]),
  maxRedirectUris: 5,
  registrationsPerHourPerIp: 20,
});

/** the confirm token of a paid tool: 10 minutes, single use, bound to user + tool + the input's hash */
export const QUOTE = Object.freeze({ ttlSec: 600 });

// ---------------------------------------------------------------- prices (credits)
/** our writer (25 credits = $0.50; our cost is at most $0.25, measured) */
export const WRITE_SCRIPT_CREDITS = 25;
/** finish_my_video at launch (owner 2026-11-19): 10 credits; measured on the first 3 real runs, then adjusted */
export const FINISH_CREDITS = 10;
/** the full video in Zyvo: today's In This Town flat price, script included */
export const VIDEO_CREDITS = BLENDER_FLAT.credits;
/** the voice: $0.00173 a second of finished voice (measured): 60 s = 11, 90 s = 16, 120 s = 21 credits */
export const VOICE_USD_PER_SEC = 0.00173;
export const voiceCredits = (seconds) => Math.max(1, Math.ceil((Math.max(0, Number(seconds) || 0) * VOICE_USD_PER_SEC) / 0.01 - 1e-9));
/** the spoken pace the kit sizes scripts at (owner's "voice A": ~195 words a minute) */
export const WORDS_PER_SEC = 3.25;
export const wordsOf = (text) => String(text ?? "").split(/\s+/).filter(Boolean).length;
export const secondsOfScript = (lines) => Math.round(wordsOf((lines ?? []).map((l) => l?.text ?? "").join(" ")) / WORDS_PER_SEC);
/** what the cap check counts for a step before it runs (our worst real cost, $) */
export const WORST_USD = Object.freeze({ voice: (sec) => +(sec * VOICE_USD_PER_SEC * 1.6).toFixed(4), finish: 0.12, script: 0.3 });

// ---------------------------------------------------------------- limits
export const LIMITS = Object.freeze({
  perDay: Object.freeze({ write_script: 10, make_voice: 10, finish_my_video: 6, make_video_in_zyvo: 6 }),
  freeCallsPerMinute: 60,
  projectsPerUser: 200,
  // the first free finish (owner 2026-11-19: one per account, voice + finish); at most this many given out a day,
  // across everyone (a sign-up farm can't drain it), and only to accounts with a confirmed email
  freeFinishPerDay: 30,
  // a script or video task the edge function started and never finished is failed + refunded after this
  taskStaleSec: 420,
  // a worker job (voice, finish) with no heartbeat for this long is failed + refunded
  jobStaleSec: 1800,
});

/** what a Studio project may hold (the kit's data is untrusted: sizes capped, text checked, never run as instructions) */
export const PROJECT_LIMITS = Object.freeze({
  slug: /^[a-z0-9][a-z0-9-]{0,63}$/,
  titleMax: 120,
  lineMax: 400,
  linesMax: 200,
  scriptCharsMax: 12000,
  shotPlanBytesMax: 200_000,
  kitVersionMax: 40,
  speakerMax: 40,
});

export const STATUSES = Object.freeze(["voice_needed", "voice_ready", "recorded", "finished"]);

/** the recording upload (finish_my_video) */
export const UPLOAD = Object.freeze({
  bucket: "zyvo-studio",
  maxBytes: 500 * 1024 * 1024,
  maxSec: 240, // a landscape recording carries ~5 s of lead-in and tail around a story of up to ~3 minutes
  types: Object.freeze({ mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm" }),
  urlTtlSec: 7200,
  keepDays: 7,
});

/** the free Studio Kit's zip in the private zyvo-studio bucket (scripts/studioKit/packKit.mjs builds it; phase 3 uploads it) */
export const KIT = Object.freeze({
  // 1.1.0 (owner 2026-11-20): the skill is "roblox-story" (the /roblox-story command; the zip's folder is roblox-story/)
  // 1.2.0 (owner's real-user test, 2026-11-20): upright floating text, ["do"], walk actions, show respects hidden plates,
  // hollow sets, real close-ups, show_build, the end card, tone + spooky lane, keep the user's idea, silent Play run
  // 1.3.0 (owner's spooky test, 2026-11-20): packed worlds (backdrop), no gizmos in stills, glow control, no prop-only
  // close-ups, a fast contact sheet (capture plan + sheet script), the own-voice flow (prep_voice), install by Claude,
  // monsters built and shown at their reveal (story check), the silent Play wait inside Studio
  // 1.4.0 (2026-11-21): renamed to "zyvo-roblox-story" (the /zyvo-roblox-story command; the zip's folder is
  // zyvo-roblox-story/): "roblox-story" is also another creator's skill folder, so installing one replaced the other.
  // Old 1.x kits keep working: report_studio_project / update_project take any kit_version text.
  version: "1.4.0",
  skill: "zyvo-roblox-story",
  path: "kit/zyvo-roblox-story-1.4.0.zip",
  fileName: "zyvo-roblox-story.zip",
  // until the new zip is in the bucket the download falls back to the last uploaded one (never a broken button)
  previous: Object.freeze({ version: "1.3.0", path: "kit/roblox-story-1.3.0.zip", fileName: "roblox-story.zip" }),
  linkTtlSec: 600,
});

export const URLS = Object.freeze({
  site: "https://www.tryzyvo.com",
  page: "https://www.tryzyvo.com/in-this-town-story-video-maker",
  // the MCP section's tabs (owner 2026-11-20); the old /workspace/studio-projects and /connect-claude redirect here
  projects: "https://www.tryzyvo.com/workspace/mcp/studio",
  consent: "https://www.tryzyvo.com/connect/authorize",
  connect: "https://www.tryzyvo.com/workspace/mcp/connect",
});

/** the access switch (owner 2026-11-19, phase 3): "owner" (default, fail closed) = only the owner list; "everyone" */
export const accessModeOf = (raw) => (String(raw ?? "").trim().toLowerCase() === "everyone" ? "everyone" : "owner");
