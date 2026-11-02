// Cutaway free preview (the new-user tutorial): who may start one, and which topics they are offered. Pure, so the page
// and the server share the rules and the tests run in node. The server (cutaway-api) enforces these on every start.
//
// A preview is the first ~10 s of a 30 s premade video, rendered for this user from the topic's shared script and voice
// (cutaway_preview_plans): only the GPU is paid for each one. After an upgrade the same plan is rendered in full, free.

export const PREVIEW = Object.freeze({
  seconds: 10,
  expectedUsd: 0.03,     // what one preview's render is expected to cost us: the free cap checks this before a start
  ipLimit: 2,            // previews per network address per 30 days
  deviceLimit: 2,        // previews per browser per 30 days (a weak signal: it can be cleared)
  windowDays: 30,
});

/** The approved layouts on offer, best first, by what the survey's first question said. Only the order changes: all are the same format. */
export const PREVIEW_TOPIC_KEYS = Object.freeze(["landfill", "car_wash", "swimming_pool", "french_drain"]);
const ORDER_BY_GOAL = Object.freeze({
  faceless: ["landfill", "swimming_pool", "car_wash", "french_drain"],
  longform: ["landfill", "french_drain", "swimming_pool", "car_wash"],
  business: ["car_wash", "swimming_pool", "french_drain", "landfill"],
  exploring: ["landfill", "car_wash", "swimming_pool", "french_drain"],
});
export function topicsForGoals(goals = [], count = 3) {
  const first = (Array.isArray(goals) ? goals : []).find((g) => ORDER_BY_GOAL[g]);
  return (ORDER_BY_GOAL[first] ?? PREVIEW_TOPIC_KEYS).slice(0, count);
}

// The fastest our narration runs, words per second. Reading a little ahead means the line is never one they already heard.
const FASTEST_WORDS_PER_SEC = 3.8;
/** The real line of the video that comes after the preview stops: the first sentence that starts past the cut. "" if none. */
export function cliffhangerLine(narration, seconds = PREVIEW.seconds) {
  const sentences = String(narration ?? "").match(/[^.!?]+[.!?]+/g) ?? [];
  const heard = seconds * FASTEST_WORDS_PER_SEC;
  let words = 0;
  for (const s of sentences) {
    if (words >= heard) return s.trim();
    words += s.trim().split(/\s+/).length;
  }
  return "";
}

/**
 * May this account start a free preview now? { ok, code, message }. Reads nothing: the caller passes the fresh facts.
 * enrolled: in the rollout. existing: its cutaway_free_previews row (a failed one doesn't count). spent24h: what free
 * previews cost in 24 h, running ones included.
 */
export function previewDecision({ switchOn, enrolled, plan, existing, ipCount = 0, deviceCount = 0, spent24h = 0, capUsd = 0, hasPlan = true }) {
  const no = (code, message) => ({ ok: false, code, message });
  if (!switchOn || !enrolled) return no("OFF", "This isn't available yet.");
  if (String(plan ?? "free").toLowerCase().trim() !== "free") return no("UPGRADE", "Your plan makes full videos.");
  if (existing && existing.status !== "failed") return no("PREVIEW_USED", "You've already made your free preview.");
  if (!hasPlan) return no("BAD_INPUT", "Pick one of the videos on offer.");
  if (ipCount >= PREVIEW.ipLimit || deviceCount >= PREVIEW.deviceLimit) return no("PREVIEW_LIMIT", "Free previews have already been used from this network. Take a look at this example instead.");
  if (Number(spent24h) + PREVIEW.expectedUsd > Number(capUsd)) return no("BUSY", "We're making a lot of previews right now. Please try again a little later.");
  return { ok: true, code: null, message: null };
}
