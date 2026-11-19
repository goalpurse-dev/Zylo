// THE ZYVO CONNECTOR -> blocky-worlds-api: a server-to-server call acts as the connector's signed-in user.
// Only with the shared secret (ZYVO_MCP_INTERNAL_SECRET, 32+ characters, both functions' secrets) and a user id;
// the secret never leaves our functions. Without it (every browser call) nothing changes.
import { safeEqual } from "./crypto.js";

export const INTERNAL_HEADERS = Object.freeze({ secret: "x-zyvo-mcp-secret", user: "x-zyvo-mcp-user" });

/** the user id the connector acts for, or null (wrong / missing / short secret, or a bad id) */
export function internalCaller(getHeader, secret) {
  const s = String(secret ?? "");
  if (s.length < 32) return null;
  const given = String(getHeader(INTERNAL_HEADERS.secret) ?? "");
  if (!given || !safeEqual(given, s)) return null;
  const user = String(getHeader(INTERNAL_HEADERS.user) ?? "");
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user) ? user.toLowerCase() : null;
}
