// Copy and fixed options for AI Fruit Story v2 (text follows the approved prototype).

export const SINGLE_STEPS = ["Story", "Settings", "Scenes", "Clips", "Final video"];

/** Step index (0–4) shown on the StepBar for a story status. */
export function stepForStatus(status) {
  if (status === "final_ready" || status === "building") return 4;
  if (status === "animating" || status === "clips_ready") return 3;
  return 2;
}

export const STORY_METHODS = [
  { value: "idea", label: "Pick an idea" },
  { value: "prompt", label: "Describe it" },
  { value: "script", label: "My own script" },
];

export const MODES = [
  { value: "single", label: "Single video", sublabel: "One complete story" },
  { value: "series", label: "Series", sublabel: "Episodes with cliffhangers" },
];

export const ASPECTS = [
  { value: "9:16", label: "Tall 9:16" },
  { value: "16:9", label: "Wide 16:9" },
];

export const SERIES_QUESTIONS = [
  { title: "What's the series about?", sub: "One or two sentences is enough." },
  { title: "Who's in it?", sub: "Pick 2 to 5 characters. A scene shows at most 3 at once." },
  { title: "How does episode 1 open?", sub: "Drop viewers into the middle of the drama." },
  { title: "How should they talk?", sub: "This sets the style of every line." },
  { title: "How many episodes?", sub: "Shorter series keep viewers coming back." },
];

export const CONCEPT_SUGGESTIONS = ["A CEO and his intern", "A mother-in-law who never leaves", "Prison kingpin beef", "Two best friends, one boyfriend"];
export const OPENERS = ["Caught at a fancy dinner", "Walked in on at the office", "A reply-all email", "A credit card bill read out loud", "Something else"];
export const TONES = ["Loud and dramatic", "Petty and sarcastic", "Funny and chaotic", "Cold and quiet"];

export const UPGRADE_COPY = {
  v3: { title: "V3 is a Pro feature", body: "V3 animates every scene with sharper, steadier motion. It's available starting on the Pro plan." },
  v4: { title: "V4 is a Generative feature", body: "V4 animates every scene with the most natural motion and voices. It's available on the Generative plan." },
};

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
 * The example video on the Recent panel (guests, no plan, no stories yet): a
 * real V2 story made end to end ("The Surprise Wedding Switch", 29 s, captions
 * on). The MP4 is the compressed copy in storage (2.5 MB); the poster is in
 * the repo, public/lp/fruit/examples/.
 */
export const EXAMPLE_VIDEO = {
  title: "The Surprise Wedding Switch",
  blurb: "The engagement party is secretly the wedding. 6 scenes, made on V2.",
  url: "https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/fruit/examples/the-surprise-wedding-switch.mp4",
  poster: "/lp/fruit/examples/the-surprise-wedding-switch.jpg",
};

/** YouTube tutorial link for the Recent panel. Set it and a "Watch the tutorial" link appears. */
export const TUTORIAL_URL = null;
