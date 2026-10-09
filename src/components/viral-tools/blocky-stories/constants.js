// Copy and fixed options for Blocky Stories.

/**
 * The idea engine (ten story engines, five ideas a batch, a memory of used
 * ideas) is its own phase. Until it is built the Story step offers
 * "Describe it" and "My own script" only, and no idea is ever asked for.
 */
export const IDEAS_ON = true;

export const SINGLE_STEPS = ["Story", "Settings", "Scenes", "Clips", "Final video"];

/** Step index (0–4) shown on the StepBar for a story status. */
export function stepForStatus(status) {
  if (status === "final_ready" || status === "building") return 4;
  if (status === "animating" || status === "clips_ready") return 3;
  return 2;
}

export const STORY_METHODS = [
  ...(IDEAS_ON ? [{ value: "idea", label: "Ideas" }] : []),
  { value: "prompt", label: "Describe it" },
  { value: "script", label: "My own script" },
];

export const MODES = [
  { value: "single", label: "Single video", sublabel: "One complete story" },
  { value: "series", label: "Series", sublabel: "Episodes with cliffhangers" },
];

/** Tall only at first: the reference pictures are portrait and wide has never had a paid run. */
export const ASPECTS = [
  { value: "9:16", label: "Tall 9:16" },
];

export const SERIES_QUESTIONS = [
  { title: "What's the series about?", sub: "One or two sentences is enough." },
  { title: "Who's in it?", sub: "Pick 2 to 5 characters. A scene shows at most 3 at once." },
  { title: "How does episode 1 open?", sub: "Drop viewers into the middle of the action." },
  { title: "How should they talk?", sub: "This sets the style of every line." },
  { title: "How many episodes?", sub: "Shorter series keep viewers coming back." },
];

export const CONCEPT_SUGGESTIONS = ["A fake admin takes over the server", "The obby nobody has ever finished", "A trade that keeps going wrong", "The new player with a secret"];
export const OPENERS = ["Banned in front of the whole server", "A trade goes through by mistake", "A new name at the top of the leaderboard", "The admin room door is open", "Something else"];
/**
 * The concept sets the world of a series, so each suggested concept offers
 * openers that happen in that world. A typed concept gets the general list;
 * the planner then moves the opener into the concept's world.
 */
export const OPENERS_BY_CONCEPT = {
  "A fake admin takes over the server": ["Banned in front of the whole server", "The admin room door is open", "A rule nobody has heard before", "The real admin logs in"],
  "The obby nobody has ever finished": ["One jump from the end", "A new name at the top of the leaderboard", "The last checkpoint is gone", "Someone is already at the finish"],
  "A trade that keeps going wrong": ["A trade goes through by mistake", "The rarest pet for a starter pet", "An empty inventory after rejoining", "Both sides press accept at once"],
  "The new player with a secret": ["A new name at the top of the leaderboard", "A badge nobody else has", "The admin room door is open", "They already know everyone's name"],
};
export const openersFor = (concept) => [...(OPENERS_BY_CONCEPT[String(concept ?? "").trim()] ?? OPENERS.filter((o) => o !== "Something else")), "Something else"];

/** Lengths offered as one-tap choices, each with its price; the slider still sets anything in between. */
export const QUICK_LENGTHS = [20, 30, 45, 60];
/**
 * The length a new story starts on. 30 seconds is six scenes: room for the hook, two steps up, the
 * proof, the twist and the last line. 20 seconds (four scenes) stays as the cheaper choice.
 */
export const DEFAULT_LENGTH_SEC = 30;
/** The small word under a one-tap length. */
export const LENGTH_NOTES = { 20: "Cheapest", 30: "Best story" };

export const TONES = ["Loud and dramatic", "Petty and sarcastic", "Funny and chaotic", "Cold and quiet"];

/**
 * What each plan unlocks in Blocky Stories, one short line each (dialogs/PlansDialog.jsx). The tiers are the
 * ones whose smallest plan is this plan or a lower one (pricing.js#TIERS.minPlan; a test keeps them in step).
 */
export const PLAN_UNLOCKS = [
  { id: "starter", name: "Starter", unlocks: "V2 videos", tiers: ["v2"] },
  { id: "pro", name: "Pro", unlocks: "V2 + V3 (sharper)", tiers: ["v2", "v3"] },
  { id: "generative", name: "Generative", unlocks: "V2 + V3 + V4 (best quality)", tiers: ["v2", "v3", "v4"] },
];

/** "45 sec", "1 min", "1 min 30 sec" */
export function formatLength(sec) {
  const s = Math.round(sec);
  if (s < 60) return `${s} sec`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m} min ${r} sec` : `${m} min`;
}

/** "just now", "5m ago", "2h ago", "3d ago" */
export function timeAgo(iso) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const sec = Math.max(0, (Date.now() - t) / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

/**
 * Plain-language error text for a caught error.
 * System failures (code "…_FAILED", no message, or a bare CODE message) get
 * the UI's own fallback, which says what happened and what to do next.
 * Validation errors ("Pick 1 to 3 characters.") are shown as the backend wrote them.
 */
export function errorText(error, fallback) {
  const message = error?.message;
  if (!message || /_FAILED$/.test(error?.code ?? "") || /^[A-Z_]+$/.test(message)) return fallback;
  return message;
}

/**
 * The showcase on the result side (workspace/Showcase.jsx): real Blocky Stories videos from the owner's own
 * tests, re-encoded small. "No Hats Allowed" whole; of the first story only its two middle scenes (its first
 * and last carried the video model's own subtitles under ours). Files: scripts/blocky/publishShowcase.mjs.
 */
const SHOWCASE_BASE = `${String(import.meta.env?.VITE_SUPABASE_URL ?? "").replace(/\/+$/, "")}/storage/v1/object/public/generated/blocky/showcase`;
export const SHOWCASE = [
  { id: "no-hats-allowed", title: "No Hats Allowed", length: "20 sec" },
  { id: "the-fake-admin", title: "The Fake Admin", length: "9 sec" },
].map((v) => ({ ...v, url: `${SHOWCASE_BASE}/${v.id}.mp4`, poster: `${SHOWCASE_BASE}/${v.id}.jpg` }));

/** YouTube tutorial link for the Recent panel. Set it and a "Watch the tutorial" link appears. */
export const TUTORIAL_URL = null;
