import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Everything in api/ is a public URL on the site (Vercel serves each file at
// /api/<name>). A script there that sends email when it loads, or a handler
// that mails whoever the request names, can be triggered by anyone:
// api/send-recovery-manual.js sent one address the same email about 900 times
// a day until it was removed (2026-10-04).
const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(root, p), "utf8");
const apiFiles = readdirSync(join(root, "api")).filter((f) => f.endsWith(".js"));

test("the campaign and recovery scripts are gone from api/", () => {
  for (const f of [
    "send-recovery-manual.js", "send-welcome-emails.js", "send-abandoned-emails.js",
    "send-clean-cycle-email.js", "send-convert-email.js", "send-engagement-email.js",
    "send-hard-convert-email.js", "send-plan-comparison-email.js",
  ]) assert.ok(!existsSync(join(root, "api", f)), `api/${f} must not exist`);
});

test("no file in api/ sends email on load, and every sender is a handler that checks who is asking", () => {
  for (const f of apiFiles) {
    const src = read(`api/${f}`);
    const sends = /resend\.emails\.send|api\.resend\.com|nodemailer/.test(src);
    if (!sends) continue;
    assert.match(src, /export default async function handler/, `api/${f} must be a handler, not a script`);
    assert.doesNotMatch(src, /^(run|main)\(\);?\s*$/m, `api/${f} must not run anything when it loads`);
    assert.match(src, /supabase\.auth\.getUser\(token\)/, `api/${f} must identify the caller from their session`);
  }
});

test("the welcome endpoint emails the signed-in account's own address and nothing else", () => {
  const src = read("api/send-welcome-email.js");
  assert.doesNotMatch(src, /req\.body/, "nothing in the request body is read: no address, no user id");
  assert.match(src, /req\.headers\?\.authorization/);
  assert.match(src, /return res\.status\(401\)\.json\(\{ error: "Not signed in" \}\);/);
  assert.match(src, /welcomeEmail\(user\.email\)/);
  assert.match(src, /\.eq\("id", user\.id\)\s*\.eq\("welcome_email_sent", false\)/, "the flag is claimed before sending: one email per account");
  const auth = read("src/lib/auth.js");
  assert.match(auth, /Authorization: `Bearer \$\{data\.session\.access_token\}`/);
  assert.doesNotMatch(auth, /user_id: data\.user\.id|email: data\.user\.email/, "the app no longer sends an address or a user id");
});
