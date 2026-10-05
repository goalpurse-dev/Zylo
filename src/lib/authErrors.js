// Supabase Auth errors, in words a person can act on.
//
// authError(error) → { message, rateLimited, waitSeconds, sentRecently }
//   rateLimited: Supabase said "slow down" (429). That is not the visitor's
//   mistake, so screens show a countdown for waitSeconds instead of a red error.
//   sentRecently: the wait is the one-email-a-minute rule, so an email to this
//   address did go out a moment ago.

// Supabase lets one address ask for an email once a minute.
export const EMAIL_WAIT_SECONDS = 60;

const MESSAGES = {
  invalid_credentials: "That email and password don't match. Try again, or reset your password.",
  user_already_exists: "That email already has an account. Sign in instead.",
  email_exists: "That email already has an account. Sign in instead.",
  email_not_confirmed: "Confirm your email first: the link is in your inbox.",
  email_address_invalid: "That email address doesn't look right. Check it and try again.",
  same_password: "That is already your password. Choose a new one.",
  otp_expired: "This link has expired or was already used.",
  session_not_found: "This link is no longer active. Ask for a new one.",
  user_banned: "This account is disabled. Write to support@tryzyvo.com.",
  signup_disabled: "New sign-ups are closed right now.",
};

// Older Supabase versions send no code: the message is the only clue.
const BY_TEXT = [
  [/invalid login credentials/i, "invalid_credentials"],
  [/already (registered|been registered)|already exists/i, "user_already_exists"],
  [/email not confirmed/i, "email_not_confirmed"],
  [/should be different from the old password/i, "same_password"],
  [/link is invalid or has expired|token has expired|otp.*expired/i, "otp_expired"],
  [/auth session missing|session.*not.*found/i, "session_not_found"],
];

export function authError(error, fallback = "Something went wrong. Try again.") {
  const text = String(error?.message ?? "");
  const code = error?.code ?? BY_TEXT.find(([re]) => re.test(text))?.[1] ?? null;

  const seconds = text.match(/after (\d+) seconds?/i);
  const rateLimited = error?.status === 429 || /rate_limit/.test(String(code)) || /rate limit|too many requests/i.test(text) || Boolean(seconds);
  if (rateLimited) {
    const waitSeconds = seconds ? Math.max(1, Number(seconds[1])) : EMAIL_WAIT_SECONDS;
    return { message: "Too many tries in a short time.", rateLimited: true, waitSeconds, sentRecently: Boolean(seconds) };
  }

  if (/failed to fetch|networkerror|load failed/i.test(text) || error?.name === "AuthRetryableFetchError") {
    return { message: "Couldn't reach Zyvo. Check your connection and try again.", rateLimited: false, waitSeconds: 0 };
  }
  // weak_password: Supabase's own sentence names the rule ("at least 6 characters").
  return { message: MESSAGES[code] ?? (text || fallback), rateLimited: false, waitSeconds: 0 };
}

/** 75 → "1:15" */
export function formatCountdown(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
