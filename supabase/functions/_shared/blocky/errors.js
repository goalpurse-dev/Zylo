// Error codes for Blocky Stories. Every failure the user can see has a
// code and a friendly message that says what to do next. The UI shows
// `message` as-is, except for codes ending in _FAILED, where it shows its own
// copy (see constants.js#errorText in the v2 UI).

export class BlockyError extends Error {
  /** @param {string} code @param {string} message @param {number} [status] */
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export const MESSAGES = Object.freeze({
  UNAUTHORIZED: "Sign in to continue.",
  PLAN_UPGRADE_REQUIRED: "Blocky Stories needs a paid plan.",
  INSUFFICIENT_CREDITS: "You don't have enough credits for this. Nothing was charged.",
  RATE_LIMITED: "You're going a bit fast. Try again in a minute.",
  NOT_FOUND: "This video doesn't exist anymore.",
  WRONG_STATUS: "This step isn't available right now. Refresh and try again.",
  STAGE_NOT_READY: "This part isn't switched on yet.",
  PAID_CALLS_DISABLED: "Blocky Stories is switched off for making new things right now. Nothing was charged.",
  DAILY_CAP_REACHED: "Blocky Stories has reached today's limit. Nothing was charged. It opens again tomorrow.",
  PLANNER_FAILED: "We couldn't write this story. Nothing was charged. Try again.",
  IMAGE_FAILED: "The picture couldn't be made. Your credits were refunded. Tap Retry.",
  CLIP_FAILED: "The clip couldn't be animated. Your credits were refunded. Tap Retry.",
  CLIP_BLOCKED: "The video model refused this line. Your credits were refunded. Edit the line or the picture and try again.",
  PROVIDER_BUSY: "The video service is busy. Your credits were refunded. Try again in a few minutes.",
  PROVIDER_TIMEOUT: "The video service didn't finish this in time, so we stopped it and refunded your credits. Tap Retry: it usually works on the next try.",
  FINAL_FAILED: "We couldn't join your clips. This is free, so just try again.",
  PROVIDER_UNAVAILABLE: "Blocky Stories is taking a short break on our side. You weren't charged. Try again in a few minutes.",
  SERVER_FAILED: "Something went wrong on our side. Nothing was charged. Try again.",
});

export const blockyError = (code, message = MESSAGES[code] ?? MESSAGES.SERVER_FAILED, status) =>
  new BlockyError(code, message, status ?? STATUS[code] ?? 400);

const STATUS = {
  UNAUTHORIZED: 401, PLAN_UPGRADE_REQUIRED: 403, INSUFFICIENT_CREDITS: 402, RATE_LIMITED: 429,
  NOT_FOUND: 404, WRONG_STATUS: 409, STAGE_NOT_READY: 501, PAID_CALLS_DISABLED: 503, DAILY_CAP_REACHED: 503,
  PLANNER_FAILED: 502, FINAL_FAILED: 502, PROVIDER_UNAVAILABLE: 503, SERVER_FAILED: 500,
};

const PLAN_NAMES = { starter: "Starter", pro: "Pro", generative: "Generative" };

/**
 * Turns a Postgres error from the Blocky RPCs into a BlockyError.
 * Unknown errors become SERVER_FAILED (the raw text is only logged).
 */
export function fromDbError(err) {
  const msg = String(err?.message ?? err ?? "");
  if (/INSUFFICIENT_CREDITS/.test(msg)) return blockyError("INSUFFICIENT_CREDITS");
  const plan = msg.match(/PLAN_UPGRADE_REQUIRED(?::\s*(\w+))?/);
  if (plan) {
    const name = PLAN_NAMES[plan[1]] ?? "a higher";
    return blockyError("PLAN_UPGRADE_REQUIRED", `This needs the ${name} plan.`);
  }
  if (/WRONG_STATUS/.test(msg)) return blockyError("WRONG_STATUS");
  if (/NOT_FOUND/.test(msg)) return blockyError("NOT_FOUND");
  return blockyError("SERVER_FAILED");
}

/** The JSON body the API returns for an error. */
export function errorBody(err) {
  if (err instanceof BlockyError) return { ok: false, code: err.code, message: err.message };
  return { ok: false, code: "SERVER_FAILED", message: MESSAGES.SERVER_FAILED };
}
