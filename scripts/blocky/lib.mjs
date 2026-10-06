// Helpers for the Blocky Stories scripts. Never prints keys or tokens.
//
// Where a script runs:
//   BLOCKY_TARGET=local   the local stack from `supabase start` (docs/blocky-local.md),
//                         with the keys in .env.blocky.local (git-ignored, never the
//                         production keys). The default for everything that spends.
//   BLOCKY_TARGET=live    the real project, with .env.local. Only when a script
//                         says so and the owner asked for it.
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(path.join(ROOT, "package.json"));
export const TARGET = process.env.BLOCKY_TARGET === "live" ? "live" : "local";
const dotenv = require("dotenv");
if (TARGET === "live") {
  for (const f of [".env", ".env.local"]) dotenv.config({ path: path.join(ROOT, f), quiet: true, override: f === ".env.local" });
} else {
  // Only the local file: a production key never reaches a local run.
  dotenv.config({ path: path.join(ROOT, ".env.blocky.local"), quiet: true, override: true });
}
const { createClient } = require("@supabase/supabase-js");

const need = (name, value) => {
  if (!value) throw new Error(`${name} is not set for BLOCKY_TARGET=${TARGET} (${TARGET === "local" ? ".env.blocky.local, see docs/blocky-local.md" : ".env.local"})`);
  return value;
};
export const SUPABASE_URL = need("VITE_SUPABASE_URL", process.env.VITE_SUPABASE_URL).replace(/\/+$/, "");
/** The service-role key of the target. Locally it is the fixed key `supabase status` prints (BLOCKY_LOCAL_SERVICE_ROLE_KEY). */
export const serviceKey = () => need(TARGET === "local" ? "BLOCKY_LOCAL_SERVICE_ROLE_KEY" : "SUPABASE_SERVICE_ROLE_KEY", TARGET === "local" ? process.env.BLOCKY_LOCAL_SERVICE_ROLE_KEY : process.env.SUPABASE_SERVICE_ROLE_KEY);
const anonKey = () => need("VITE_SUPABASE_ANON_KEY", process.env.VITE_SUPABASE_ANON_KEY);
export const TEST_EMAIL = process.env.BLOCKY_TEST_EMAIL || "upwardlift6@gmail.com";

export const admin = () => createClient(SUPABASE_URL, serviceKey(), { auth: { persistSession: false } });

/** A real session for the test account, via an admin magic-link token (no email is sent). */
export async function userSession(email = TEST_EMAIL) {
  const { data, error } = await admin().auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw new Error(`generateLink: ${error.message}`);
  const client = createClient(SUPABASE_URL, anonKey(), { auth: { persistSession: false } });
  const { data: s, error: e2 } = await client.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: "magiclink" });
  if (e2) throw new Error(`verifyOtp: ${e2.message}`);
  return { client, accessToken: s.session.access_token, userId: s.user.id };
}

/** Calls blocky-story-api as the user. Returns the parsed body plus the HTTP status. */
export async function api(accessToken, action, payload = {}) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/blocky-story-api`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, apikey: anonKey(), "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });
  return { status: res.status, ...(await res.json().catch(() => ({ ok: false, code: "BAD_JSON" }))) };
}

/** Calls blocky-worker with the service role (its test actions; never a user's session). */
export async function worker(body) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/blocky-worker`, {
    method: "POST",
    headers: { Authorization: `Bearer ${serviceKey()}`, apikey: serviceKey(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, ...(await res.json().catch(() => ({ ok: false, code: "BAD_JSON" }))) };
}

/**
 * One test picture or clip on blocky-worker (raw_test, then raw_poll until it
 * is done): no user charge, logged in blocky_ai_calls with its real cost.
 * ONE attempt: a failure is returned, never retried.
 * @returns {{state: "success"|"error"|"refused"|"timeout", url?: string, cost: number, error?: string, seconds: number}}
 */
export async function rawTest(task, label, { everyMs = 4000, timeoutMs = 8 * 60_000 } = {}) {
  const t0 = Date.now();
  const seconds = () => Math.round((Date.now() - t0) / 1000);
  const sent = await worker({ action: "raw_test", task, label });
  // Refused before anything was sent to the provider: not an attempt, $0.
  if (!sent.ok && !sent.taskUUID) return { state: "refused", cost: 0, error: `${sent.code ?? sent.status}: ${sent.message ?? "refused"}`, seconds: seconds() };
  if (!sent.ok) return { state: "error", cost: 0, error: sent.error, seconds: seconds() };
  const kind = task.taskType === "imageInference" ? "image" : "video";
  while (Date.now() - t0 < timeoutMs) {
    await new Promise((r) => setTimeout(r, everyMs));
    const r = await worker({ action: "raw_poll", taskUUID: sent.taskUUID, callId: sent.callId, kind });
    if (r.state === "success") return { state: "success", url: r.url, cost: Number(r.cost ?? 0), seconds: seconds(), taskUUID: sent.taskUUID };
    if (r.state === "error") return { state: "error", cost: Number(r.cost ?? 0), error: r.error, seconds: seconds(), taskUUID: sent.taskUUID };
  }
  return { state: "timeout", cost: 0, error: "no result in time; poll it again with raw_poll", seconds: seconds(), taskUUID: sent.taskUUID, callId: sent.callId };
}

export function writeJson(rel, value) {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 1));
  return file;
}
