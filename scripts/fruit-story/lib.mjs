// Shared helpers for AI Fruit Story Phase 3 test scripts (local only).
// Never prints keys or tokens.
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(path.join(ROOT, "package.json"));
for (const f of [".env", ".env.local"]) require("dotenv").config({ path: path.join(ROOT, f), quiet: true, override: f === ".env.local" });
const { createClient } = require("@supabase/supabase-js");

export const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL).replace(/\/+$/, "");
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.VITE_SUPABASE_ANON_KEY;
export const TEST_EMAIL = "upwardlift6@gmail.com";

export const admin = () => createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

/** A real session for the test account, via an admin magic-link token (no email is sent). */
export async function userSession(email = TEST_EMAIL) {
  const a = admin();
  const { data, error } = await a.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw new Error(`generateLink: ${error.message}`);
  const client = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } });
  const { data: s, error: e2 } = await client.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: "magiclink" });
  if (e2) throw new Error(`verifyOtp: ${e2.message}`);
  return { client, accessToken: s.session.access_token, userId: s.user.id };
}

/** Calls fruit-story-api as the user. Returns the parsed body plus the HTTP status. */
export async function api(accessToken, action, payload = {}) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/fruit-story-api`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });
  return { status: res.status, ...(await res.json().catch(() => ({ ok: false, code: "BAD_JSON" }))) };
}

export function writeJson(rel, value) {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 1));
  return file;
}
