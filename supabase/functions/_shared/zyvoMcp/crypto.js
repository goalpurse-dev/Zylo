// THE ZYVO CONNECTOR: the small crypto helpers (WebCrypto only: the same code in Deno and Node 20+).
// Tokens are random 32-byte values; only their SHA-256 is ever stored. PKCE is S256 only.

const enc = new TextEncoder();
const subtle = () => globalThis.crypto.subtle;

export function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** a random token with a readable prefix (zyvo_at_ = access, zyvo_rt_ = refresh, zyvo_qt_ = confirm, ...) */
export function randomToken(prefix = "", bytes = 32) {
  const b = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(b);
  return prefix + b64url(b);
}

export async function sha256Hex(text) {
  const d = new Uint8Array(await subtle().digest("SHA-256", enc.encode(String(text))));
  return [...d].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** PKCE S256: BASE64URL(SHA256(verifier)) === challenge; the verifier is 43-128 unreserved characters */
export async function pkceOk(verifier, challenge) {
  const v = String(verifier ?? "");
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(v)) return false;
  const d = new Uint8Array(await subtle().digest("SHA-256", enc.encode(v)));
  return safeEqual(b64url(d), String(challenge ?? ""));
}

/** constant-time string compare (lengths may differ: that returns false, still walking the longer one) */
export function safeEqual(a, b) {
  const x = String(a ?? ""), y = String(b ?? "");
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x.charCodeAt(i) || 0) ^ (y.charCodeAt(i) || 0);
  return diff === 0;
}

/** canonical JSON (sorted keys, no undefined): the input hash a confirm token is bound to */
export function canonical(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  return `{${Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}`;
}
export const inputHash = (tool, input) => sha256Hex(`${tool}\n${canonical(input ?? {})}`);
