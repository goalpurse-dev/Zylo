import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { authError, EMAIL_WAIT_SECONDS, formatCountdown } from "../src/lib/authErrors.js";

// Password reset: "Forgot password?" has its own view with a resend countdown,
// the link in the email is a tryzyvo.com address (/auth/confirm checks it) and
// /auth/reset sets the new password. Supabase's "slow down" answers are shown
// as a countdown everywhere in auth, never as a red error.
const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(root, p), "utf8");

test("Supabase's rate limits become a wait, not an error", () => {
  // one email a minute per address: an email did go out a moment ago
  assert.deepEqual(
    authError({ status: 429, code: "over_email_send_rate_limit", message: "For security purposes, you can only request this after 43 seconds." }),
    { message: "Too many tries in a short time.", rateLimited: true, waitSeconds: 43, sentRecently: true },
  );
  // the project's hourly email limit: nothing was sent, no seconds are named
  const hourly = authError({ status: 429, code: "over_email_send_rate_limit", message: "email rate limit exceeded" });
  assert.deepEqual([hourly.rateLimited, hourly.waitSeconds, hourly.sentRecently], [true, EMAIL_WAIT_SECONDS, false]);
  // too many sign-in tries, and an older server that sends no code
  assert.equal(authError({ status: 429, code: "over_request_rate_limit", message: "Request rate limit reached" }).rateLimited, true);
  assert.equal(authError({ message: "Email rate limit exceeded" }).rateLimited, true);
  assert.equal(authError({ status: 400, code: "invalid_credentials", message: "Invalid login credentials" }).rateLimited, false);
});

test("auth errors are said in plain words", () => {
  const say = (e) => authError(e).message;
  assert.equal(say({ code: "invalid_credentials", message: "Invalid login credentials" }), "That email and password don't match. Try again, or reset your password.");
  assert.equal(say({ message: "Invalid login credentials" }), say({ code: "invalid_credentials" }), "no code: the message decides");
  assert.equal(say({ message: "User already registered" }), "That email already has an account. Sign in instead.");
  assert.equal(say({ code: "same_password", message: "New password should be different from the old password." }), "That is already your password. Choose a new one.");
  assert.equal(say({ code: "otp_expired", message: "Email link is invalid or has expired" }), "This link has expired or was already used.");
  assert.equal(say({ name: "AuthRetryableFetchError", message: "Failed to fetch" }), "Couldn't reach Zyvo. Check your connection and try again.");
  // Supabase's own sentence names the password rule
  assert.equal(say({ code: "weak_password", message: "Password should be at least 6 characters." }), "Password should be at least 6 characters.");
  assert.equal(authError(null, "Login failed.").message, "Login failed.");
  assert.deepEqual([0, 9, 60, 75].map(formatCountdown), ["0:00", "0:09", "1:00", "1:15"]);
});

test("email templates: a tryzyvo.com link Supabase can verify, said clearly", () => {
  const templates = {
    "recovery.html": { type: "recovery", subject: "Reset your Zyvo password", button: "Reset password" },
    "email_change.html": { type: "email_change", subject: "Confirm your new email for Zyvo", button: "Confirm new email" },
    "magic_link.html": { type: "email", subject: "Your Zyvo sign-in link", button: "Sign in to Zyvo" },
  };
  for (const [file, { type, subject, button }] of Object.entries(templates)) {
    const html = read(`supabase/templates/${file}`);
    const link = `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=${type}`;
    assert.equal(html.split(link).length - 1, 2, `${file}: the link is on the button and once more as text to copy`);
    assert.ok(html.includes(`<a href="${link}"`) && html.includes(`>${button}</a>`), `${file}: a real button`);
    assert.match(html, new RegExp(`word-break:break-all;">${link.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</p>`), `${file}: the copy-paste link is plain text`);
    assert.doesNotMatch(html, /supabase\.co|\{\{ \.ConfirmationURL \}\}|\{\{ \.Token \}\}/, `${file}: no supabase.co address, no code`);
    assert.ok(html.includes(`<title>${subject}</title>`) && html.includes(`Subject: ${subject} -->`), `${file}: subject`);
    assert.match(html, /If you didn't request this, ignore this email/);
    assert.match(html, /<img src="https:\/\/www\.tryzyvo\.com\/logo\.png" width="36" height="36" alt=""/);
    assert.match(html, /support@tryzyvo\.com/);
    assert.deepEqual([...html.matchAll(/\{\{ \.(\w+) \}\}/g)].map((m) => m[1]).filter((v) => !["SiteURL", "TokenHash", "Email", "NewEmail"].includes(v)), [], `${file}: only variables Supabase fills in`);
  }
  // the link types /auth/confirm accepts cover the templates
  const confirm = read("src/pages/auth/Confirm.jsx");
  for (const { type } of Object.values(templates)) assert.ok(confirm.includes(`"${type}"`), `/auth/confirm accepts ${type}`);
});

test("the link is checked on /auth/confirm, the password is set on /auth/reset", () => {
  const app = read("src/App.jsx");
  assert.match(app, /<Route path="\/auth\/confirm" element=\{<AuthConfirm \/>\} \/>/);
  assert.match(app, /const AuthConfirm = lazy\(\(\) => import\("\.\/pages\/auth\/Confirm\.jsx"\)\);/);
  assert.match(app, /<PasswordRecoveryRedirect \/>/);
  assert.match(read("public/robots.txt"), /Disallow: \/auth\//);

  assert.match(read("src/lib/recoveryLink.js"), /supabase\.auth\.verifyOtp\(\{ token_hash: tokenHash, type \}\)/);
  const confirm = read("src/pages/auth/Confirm.jsx");
  assert.match(confirm, /params\.get\("token_hash"\)/);
  assert.match(confirm, /if \(type === "recovery"\) \{\s*rememberRecoveryLink\(tokenHash\);\s*navigate\("\/auth\/reset", \{ replace: true \}\);/);
  assert.match(confirm, /<ForgotPassword/, "an expired link offers a new one on the spot");

  const reset = read("src/pages/tools/Reset.jsx");
  assert.match(reset, /supabase\.auth\.updateUser\(\{ password \}\)/);
  assert.match(reset, /signOut\(\{ scope: "others" \}\)/, "other devices are signed out, this one stays in");
  assert.doesNotMatch(reset, /signOut\(\)/, "the visitor is not signed out after choosing the password");
  assert.match(reset, /Your password is updated/);
  assert.match(reset, /setStage\(data\.session \? "ready" : "expired"\)/);

  // links from the older template (session after the #) still reach the form
  const old = read("src/components/auth/PasswordRecoveryRedirect.jsx");
  assert.match(old, /event === "PASSWORD_RECOVERY"\) navigate\("\/auth\/reset", \{ replace: true \}\)/);
  assert.match(old, /typeof window === "undefined" \? "" : window\.location\.hash/, "safe in the server render");

  // a plan picked before the reset waits until the password is set
  assert.match(read("src/components/billing/ResumeCheckout.jsx"), /const HOLD_ON = \["\/auth\/confirm", "\/auth\/reset"\];[\s\S]*if \(loading \|\| !userId \|\| onHold\) return;/);
});

test("\"Forgot password?\" is one view everywhere, with a countdown instead of an error", () => {
  const view = read("src/components/auth/ForgotPassword.jsx");
  assert.match(view, /resetPasswordForEmail\(email\.trim\(\), \{/);
  assert.match(view, /Check your inbox/);
  assert.match(view, /It can take a minute\. Check your spam folder too\./);
  assert.match(view, /`Resend in \$\{formatCountdown\(cooldown\.secondsLeft\)\}` : "Resend email"/);
  assert.match(view, /if \(problem\.sentRecently\) waitFor\(problem\.waitSeconds, true\);\s*\/\/[^\n]*\n\s*else if \(problem\.rateLimited\) \{ busy\.start\(problem\.waitSeconds\); setStage\("form"\); \}/);
  assert.match(view, /if \(left > 0\) \{ waitFor\(left, true\); return; \}/, "asked a moment ago: no second request to Supabase");

  // the only place that asks Supabase for a reset email
  const walk = (dir) => readdirSyncDeep(dir).filter((f) => /\.(jsx?|tsx?)$/.test(f));
  assert.deepEqual(walk("src").filter((f) => read(f).includes("resetPasswordForEmail(")), ["src/components/auth/ForgotPassword.jsx"]);

  const modal = read("src/components/AuthModal.jsx");
  assert.match(modal, /<ForgotPassword initialEmail=\{email\} onBack=\{\(\) => setView\("form"\)\} \/>/, "the dialog passes on the email already typed");
  assert.match(modal, /onClick=\{\(\) => \{ setError\(""\); setSuccess\(""\); setView\("forgot"\); \}\}/);
  assert.match(read("src/pages/Login.jsx"), /<Link to="\/auth\/forgot" state=\{\{ email \}\}/);
  assert.match(read("src/pages/tools/Forgot.jsx"), /<ForgotPassword initialEmail=\{state\?\.email \?\? ""\}/);

  // no auth screen prints Supabase's raw sentence or a red rate-limit error
  for (const file of ["src/components/AuthModal.jsx", "src/pages/Login.jsx", "src/pages/Signup.jsx", "src/pages/tools/Reset.jsx", "src/components/auth/ForgotPassword.jsx"]) {
    const src = read(file);
    assert.doesNotMatch(src, /set(Error|Err)\((error|e2|failed|err)\??\.message/, `${file} shows the plain-words message`);
    assert.match(src, /authError\(/, `${file} uses authError`);
    assert.match(src, /(cooldown|busy)\.start\(problem\.waitSeconds\)/, `${file} counts down on a rate limit`);
  }
});

function readdirSyncDeep(dir) {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? readdirSyncDeep(`${dir}/${e.name}`) : [`${dir}/${e.name}`]));
}
