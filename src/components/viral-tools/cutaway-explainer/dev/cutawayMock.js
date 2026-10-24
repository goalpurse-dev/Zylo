// Cutaway Explainer, LOCAL DEV ONLY: realistic RunViews for every state, so each view can be opened from the URL
// without an account or a server. The page only imports this behind import.meta.env.DEV, so a production build
// drops it (and never reads ?as= or ?mock=).
//
//   ?as=guest|free|starter|pro|generative|owner      who is looking (owner = Pro + the "Approve layout" toggle)
//   ?mock=quote              the builder with a premade topic typed and its live price
//         cantbuild          the builder after "We can't build this one yet" (closest premade topics as chips)
//         limit | busy       the builder with the calm "try again later" message
//         credits            the add-credits popup (the plan's balance is too low)
//         signup | upgrade   the sign-up popup (guest) / the upgrade popup (free plan), as Generate opens them
//         generating-queued | generating-script | generating-scene | generating-render
//         done               a finished video, with the reveal
//         failed             a failed run, credits back
//   &balance=N               the mock credit balance (default 640, or 12 with ?mock=credits)
// Pressing Generate in mock mode plays the whole timed sequence (script -> scene -> render -> reveal).
import { EXAMPLES, FAILED_MESSAGE, endCardFor, quoteTopic } from "../api/cutawayApi";

export const MOCK_STATES = Object.freeze([
  "quote", "cantbuild", "limit", "busy", "credits", "signup", "upgrade",
  "generating-queued", "generating-script", "generating-scene", "generating-render", "done", "failed",
]);

const EX = EXAMPLES[0]; // the French drain: narration, parts, frames, facts, post text
const TOPIC = "French drain";

/** The builder's starting values for a mock state (a typed topic shows the live price). */
export function mockValues(state) {
  if (state === "cantbuild") return { topic: "how does a microwave work" };
  if (["quote", "credits", "limit", "busy", "upgrade", "signup"].includes(state)) return { topic: TOPIC };
  return null;
}

/** The inline message the builder shows for ?mock=limit / busy (the server's words). */
export function mockNotice(state) {
  if (state === "limit") return { kind: "LIMIT", message: "You've made 3 videos in the last hour. Try again a little later.", retryAfterSec: 1260 };
  if (state === "busy") return { kind: "BUSY", message: "We're making a lot of videos right now. Try again in a few minutes." };
  return null;
}

export const mockBalance = (state, param) => (Number.isFinite(Number(param)) && param !== null ? Number(param) : state === "credits" ? 12 : 640);

/** A RunView as cutaway-api would send it, frozen in one state (no timers run on it). */
export function mockRun(state, { plan = "starter", owner = false, removeWatermark = false } = {}) {
  const q = quoteTopic(TOPIC, 30);
  const now = Date.now();
  const base = {
    id: `mock-${state}`,
    topic: TOPIC,
    title: EX.title,
    lengthSec: 30,
    kind: q.kind,
    credits: q.credits,
    createdAt: new Date(now - 90_000).toISOString(),
    soundEffects: true,
    endCard: endCardFor(plan, removeWatermark),
    narration: EX.narration,
    parts: EX.parts,
    frames: EX.frames,
    facts: EX.facts,
    poster: EX.poster,
    owner,
    layoutApproved: owner ? null : undefined,
    mock: true,
    frozen: true,
  };
  const at = (step, msAgo, extra = {}) => ({ ...base, step, status: step, stepAt: now - msAgo, ...extra });
  switch (state) {
    case "generating-queued": return at("queued", 2000, { narration: "", parts: [], frames: [], framesShown: 0 });
    case "generating-script": return at("script", 2600, { parts: [], frames: [], framesShown: 0, narrationAt: now - 2600 });
    case "generating-scene": return at("scene", 1500, { frames: [], framesShown: 0, narrationAt: now - 60_000, partsAt: now - 1500 });
    case "generating-render": return at("render", 41_000, { renderPct: 62, framesShown: 5, narrationAt: now - 120_000, partsAt: now - 90_000 });
    case "done": return at("done", 900, { renderPct: 100, framesShown: 8, finalUrl: base.endCard ? EX.finalUrl : "/cutaway-explainer/example-french-drain-clean.mp4", downloadUrl: base.endCard ? EX.finalUrl : "/cutaway-explainer/example-french-drain-clean.mp4", post: EX.post, doneAt: now, frozen: false });
    case "failed": return at("failed", 4000, { error: FAILED_MESSAGE, refunded: true, frames: EX.frames.slice(0, 3), framesShown: 3, renderPct: 34 });
    default: return null;
  }
}

/** Recent Creations in mock mode: one finished video of the viewer's own, so the grid shows a real item too. */
export function mockRecent(state, opts) {
  if (state === "done") return [mockRun("done", opts)];
  return [];
}
