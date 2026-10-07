// Helpers for the Blocky Stories scripts. Never prints keys or tokens.
// Like AI Fruit Story's scripts they talk to the real project with the keys in
// .env.local; every provider call is made by Blocky's functions there, with
// the keys in Supabase secrets.
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(path.join(ROOT, "package.json"));
for (const f of [".env", ".env.local"]) require("dotenv").config({ path: path.join(ROOT, f), quiet: true, override: f === ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const need = (name) => {
  if (!process.env[name]) throw new Error(`${name} is not set in .env.local`);
  return process.env[name];
};
export const SUPABASE_URL = need("VITE_SUPABASE_URL").replace(/\/+$/, "");
export const serviceKey = () => need("SUPABASE_SERVICE_ROLE_KEY");
export const anonKey = () => need("VITE_SUPABASE_ANON_KEY");
export const TEST_EMAIL = "upwardlift6@gmail.com";

export const admin = () => createClient(SUPABASE_URL, serviceKey(), { auth: { persistSession: false } });

/** A real session for an account, via an admin magic-link token (no email is sent). */
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
 * is done): no user charge, logged in blocky_ai_calls with its real cost, and
 * refused while Blocky's paid-calls switch is off or the daily cap is reached.
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
