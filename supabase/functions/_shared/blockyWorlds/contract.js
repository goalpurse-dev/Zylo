// Blocky Worlds: the contract between the page and the blocky-worlds-api function (one place, imported by both).
//
// Every action is POST /functions/v1/blocky-worlds-api with { action, ...fields } and the user's session (supabase
// functions.invoke). Replies are JSON; errors are { error: "<friendly message>", code } with the HTTP status below.
//
// THE FLOW: idea -> script -> settings -> generate -> result
//   access       {}                                   -> Access (works signed out)
//   ideas        { mood?, more? }                     -> { ideas: IdeaCard[], batchesLeft }       free, daily limit
//   topicIdeas   { topic, mood? }                     -> { ideas: IdeaCard[], batchesLeft }       free, same limit
//   writeScript  { ideaId, lengthSec }                -> Draft                                    paid plans, daily limit
//   rewrite      { draftId, note? }                   -> Draft                                    same limit
//   saveScript   { draftId?, lengthSec, title?, lines?: [{part,text}], text? } -> Draft         the user's edits or own script (free)
//   fixOpener    { draftId }                          -> Draft (only the first line rewritten)    same limit
//   fixPart      { draftId, part }                    -> Draft + { fixed } (only that part's flagged lines rewritten,
//                                                        every other line verbatim; the whole script re-checked)  same limit
//   drafts       {}                                   -> { drafts: Draft[] } (newest 10)
//   quote        { draftId, lengthSec? }              -> { credits, lengthSec, ready, problems }
//   start        { draftId, removeWatermark? }        -> RunView (charged once, at start)
//   status       { runId }                            -> RunView
//   list         {}                                   -> { runs: RunView[] } (newest 20)
//   remove       { runId }                            -> { ok: true }
//
// Access: { enabled, signedIn, plan, canGenerate, canWrite, owner, tester, mock, renderer, lengths, defaultLength,
//           prices: { [lengthSec]: credits }, narrator: { name }, moods: [{ id, label }], ideaBatchesLeft,
//           launch ("board" | "off": the board-only launch mode), film ([{ id, label, what }] "What we can film", from the
//           kit list, or null) }
// IdeaCard: { id, opener, title, premise, teaser, mood, moodLabel, setting }
// Draft: { id, source ("idea"|"topic"|"own"), ideaId, title, lengthSec, lines: [{ part, text }], post, credits,
//          check: { problems[], warnings[], words, seconds, spots: [{ problem, part, lines[], fix }] }, ready (no problems),
//          writesLeft, updatedAt, notice? (a rewrite or fix that still has a problem says so here)
//          spots: where each problem sits (protocol.js problemSpots); fix "opener" | "part" (fixPart) | "rewrite"
// RunView: { id, draftId, title, lengthSec, credits, createdAt, doneAt, status, stepAt, pct, post, finalUrl,
//            downloadUrl, poster, error, reason, failKind, refunded }
//   a failed run: reason = the plain-words why (failReason below), failKind "ours" | "busy" | "story" | "paused"
//   start refuses a second run of a draft while one is being made (code LIMIT, extra runId): a retry can never charge twice
//   status "queued" | "voice" | "plan" | "render" | "done" | "failed"

export const STATUSES = Object.freeze(["queued", "voice", "plan", "render", "done", "failed"]);
export const STATUS_LABELS = Object.freeze({
  queued: "In line",
  voice: "Recording the narrator",
  plan: "Planning every shot",
  render: "Building the world",
  done: "Ready",
  failed: "Failed",
});

export const ERRORS = Object.freeze({
  SIGN_IN: { status: 401, message: "Please sign in." },
  UPGRADE: { status: 402, message: "Blocky Worlds videos are for paid plans." },
  CREDITS: { status: 402, message: "You need more credits for this video." },
  OFF: { status: 403, message: "Blocky Worlds isn't available yet." },
  RENDER_OFF: { status: 403, message: "Video making isn't switched on yet. Your script is saved." },
  NOT_READY: { status: 422, message: "Fix the script first." },
  DAILY_LIMIT: { status: 429, message: "That's today's limit. Come back tomorrow." },
  LIMIT: { status: 429, message: "You've hit a limit for now. Try again a little later." },
  BUSY: { status: 503, message: "We're making a lot of videos right now. Try again in a few minutes." },
  WRITER: { status: 502, message: "The writer couldn't finish this one. Nothing was charged. Try again." },
  BAD_INPUT: { status: 400, message: "That didn't look right. Please try again." },
  NOT_FOUND: { status: 404, message: "We couldn't find that." },
  SERVER: { status: 500, message: "Something went wrong on our side. Please try again." },
});

/** The friendly message a failed run shows (the run keeps its own error code for us). */
export const FAILED_MESSAGE = "We couldn't make this video. It's not your fault, and your credits are back.";

/**
 * A failed run's error code (render.js / renderRuntime.js) in plain words, without the credits sentence (the page adds
 * "Your N credits are back." from the run's refund state). kind: "ours" (a hiccup: try again), "busy" (no machine free:
 * try again in a minute), "story" (the builder couldn't show something the story needs: a rewrite works more often than
 * the same script again), "paused" (switched off on our side for a while).
 */
const FAIL_KINDS = Object.freeze({
  busy: ["NO_GPU", "QUEUE_TIMEOUT"],
  story: ["VISUAL_CHECK", "SUBJECT_CHECK", "PRODUCTION_CHECK", "KIT_MISSING", "PLAN_FAILED", "TIMELINE_INVALID", "STORYBOARD_FAILED", "STORYBOARD_CHECKS", "KIT_UNSUPPORTED"],
  paused: ["NOT_CONFIGURED", "VOICE_CONFIG", "PROVIDER_BALANCE"],
});
export const FAIL_TEXT = Object.freeze({
  ours: "Something broke on our side while building your video.",
  busy: "All our video machines were busy, so your video couldn't start in time.",
  story: "Our builder couldn't show everything your story needs (something in it isn't in our block world yet).",
  paused: "Video making is paused on our side for a moment.",
});
export function failReason(code, message = null) {
  const c = String(code ?? "").toUpperCase();
  // CRITICAL_UNBUILT (2026-11-08): the builder couldn't make a thing the story can't be told without, so the plan was
  // rejected before any render; the worker's message names them in quotes before " — " (runpod/worker.mjs criticalUnbuilt)
  if (c === "CRITICAL_UNBUILT") {
    const head = String(message ?? "").split(" — ")[0];
    const items = [...head.matchAll(/"([^"]{1,60})"/g)].map((m) => m[1]).slice(0, 4);
    const list = items.length <= 1 ? items[0] ?? "" : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
    return { kind: "story", text: list ? `We couldn't build ${list} for your story.` : "We couldn't build something your story needs." };
  }
  // KIT_UNSUPPORTED (board-only launch mode, 2026-11-12): the story needs a thing the board kit can't film; the worker's
  // early kit check names them in quotes (worker.mjs: the story needs "bus" (vehicle), ...); the director's says how many lines
  if (c === "KIT_UNSUPPORTED") {
    const items = [...new Set([...String(message ?? "").matchAll(/"([^"]{1,40})"/g)].map((m) => m[1]))].slice(0, 3);
    const list = items.length <= 1 ? items[0] ?? "" : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
    return { kind: "story", text: list ? `Our block world can't film ${list} yet, so this story couldn't be made. Rewrite it without ${items.length > 1 ? "them" : "it"}, or pick an idea from the list.` : "Part of this story needs something our block world can't film yet. Rewrite it, or pick an idea from the list." };
  }
  const kind = Object.keys(FAIL_KINDS).find((k) => FAIL_KINDS[k].includes(c)) ?? "ours";
  return { kind, text: FAIL_TEXT[kind] };
}
