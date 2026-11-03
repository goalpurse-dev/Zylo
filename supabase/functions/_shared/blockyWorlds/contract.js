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
//   drafts       {}                                   -> { drafts: Draft[] } (newest 10)
//   quote        { draftId, lengthSec? }              -> { credits, lengthSec, ready, problems }
//   start        { draftId, removeWatermark? }        -> RunView (charged once, at start)
//   status       { runId }                            -> RunView
//   list         {}                                   -> { runs: RunView[] } (newest 20)
//   remove       { runId }                            -> { ok: true }
//
// Access: { enabled, signedIn, plan, canGenerate, canWrite, owner, tester, mock, renderer, lengths, defaultLength,
//           prices: { [lengthSec]: credits }, narrator: { name }, moods: [{ id, label }], ideaBatchesLeft }
// IdeaCard: { id, opener, title, premise, teaser, mood, moodLabel, setting }
// Draft: { id, source ("idea"|"topic"|"own"), ideaId, title, lengthSec, lines: [{ part, text }], post, credits,
//          check: { problems[], warnings[], words, seconds }, ready (no problems), writesLeft, updatedAt }
// RunView: { id, draftId, title, lengthSec, credits, createdAt, doneAt, status, stepAt, pct, post, finalUrl,
//            downloadUrl, poster, error, refunded }
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
