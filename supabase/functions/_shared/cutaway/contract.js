// Cutaway Explainer: the contract between the page and the cutaway-api function (one place, imported by both).
//
// Every action is POST /functions/v1/cutaway-api with { action, ...fields } and the user's session (supabase
// functions.invoke). Replies are JSON; errors are { error: "<friendly message>", code } with the HTTP status below.
//
//   access      {}                                   -> { enabled, tester, signedIn, plan, canGenerate, canRemoveWatermark }
//                (works signed out too: the page shows itself when enabled, or to a tester while it is off)
//   quote       { topic, lengthSec }                 -> { quote: { kind, premade, credits, buildable, missing, closest } }
//   start       { topic, lengthSec, removeWatermark } -> RunView (charged once, at start)
//   status      { runId }                            -> RunView
//   list        {}                                   -> { runs: RunView[] } (newest 20, the user's own)
//   remove      { runId }                            -> { ok: true } (a finished or failed run of the user's)
//   approveLayout { runId, approve: true|false }     -> { ok: true, approved } (owner only: the layout is reused for everyone)
//
// Error codes (HTTP status):
//   SIGN_IN 401            "Please sign in."
//   UPGRADE 402            "Cutaway Explainer is for paid plans."             -> the app's upgrade popup
//   CREDITS 402            "You need N credits for this video."                -> the app's add-credits flow (needed in `credits`)
//   OFF 403                "This template isn't available yet."
//   CANT_BUILD 422         "We can't build this one yet."                      (+ missing, closest; nothing charged)
//   LIMIT 429              a cap or rate limit, in plain words (+ retryAfterSec)
//   BUSY 503               "We're making a lot of videos right now..."        (nothing charged)
//   BAD_INPUT 400, NOT_FOUND 404, SERVER 500
//
// RunView (what the page renders; the page never sees provider ids, keys or costs):
//   id, topic, title, lengthSec, kind ("premade"|"custom"), credits (charged), createdAt, doneAt
//   status   "queued" | "script" | "scene" | "render" | "done" | "failed"
//   step     the same value (the page's existing name for it)
//   stepAt   ms timestamp the current status began (for "typing" and ETAs)
//   renderPct 0-100 while rendering
//   narration, parts [names], frames [urls of low-res preview frames], facts [{ claim, sources: [{ label, url }] }]
//   post     { title, description, hashtags[] } once done (the copy-ready post text)
//   finalUrl the video to play (signed, 1080p), downloadUrl (signed, with a download filename), poster
//   endCard  true when the Zyvo end card is in the video (Starter), false when removed (Pro and above)
//   error    a friendly message when failed, refunded true when the credits went back (creditsRefunded)
//   owner    true for the owner (shows "Approve layout"), layoutApproved true|false|null

export const STATUSES = Object.freeze(["queued", "script", "scene", "render", "done", "failed"]);

export const ERRORS = Object.freeze({
  SIGN_IN: { status: 401, message: "Please sign in." },
  UPGRADE: { status: 402, message: "Cutaway Explainer is for paid plans." },
  CREDITS: { status: 402, message: "You need more credits for this video." },
  OFF: { status: 403, message: "This template isn't available yet." },
  CANT_BUILD: { status: 422, message: "We can't build this one yet." },
  LIMIT: { status: 429, message: "You've hit a limit for now. Try again a little later." },
  BUSY: { status: 503, message: "We're making a lot of videos right now. Try again in a few minutes." },
  BAD_INPUT: { status: 400, message: "That didn't look right. Please try again." },
  NOT_FOUND: { status: 404, message: "We couldn't find that video." },
  SERVER: { status: 500, message: "Something went wrong on our side. Please try again." },
});

/** The friendly message a failed run shows (the run keeps its own error code for us). */
export const FAILED_MESSAGE = "We couldn't make this video. It's not your fault, and your credits are back.";

/** The worker's stages, mapped to the page's statuses. */
export function statusOfStage(stage) {
  return ({ queued: "queued", script: "script", facts: "script", scene: "scene", voice: "scene", preview: "scene", repair: "scene", render: "render", sound: "render", finish: "render", upload: "render", done: "done", failed: "failed" })[stage] ?? "queued";
}
