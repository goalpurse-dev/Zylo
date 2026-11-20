// The site's calls to the Zyvo connector's account routes (supabase/functions/zyvo-mcp: _shared/zyvoMcp/site.js and
// server.js): the consent screen, the connections list, the Studio projects tab and the kit download. Always with
// the user's own site login (a Supabase session token); the connector never sees a password.
// Local dev with ?mock=1 only (import.meta.env.DEV is false in every build): an in-browser fake answers instead
// (zyvoConnectorMock.js), so the pages can be looked at on localhost without an account or a charge.
import { supabase } from "./supabaseClient";

const BASE = `${String(import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "")}/functions/v1/zyvo-mcp`;
export const CONNECTOR_MOCK = Boolean(import.meta.env?.DEV) && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mock") === "1";

export class ConnectorError extends Error {
  constructor(code, message, extra = {}) { super(message); this.code = code; Object.assign(this, extra); }
}

/** connector(path, { method, body, query }) -> the JSON reply; a refusal throws ConnectorError(code, message) */
export async function connector(path, { method = "GET", body, query } = {}) {
  if (CONNECTOR_MOCK) {
    const { mockConnector } = await import("./zyvoConnectorMock.js");
    return mockConnector(path, { method, body, query });
  }
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new ConnectorError("sign_in", "Sign in to Zyvo first.");
  const qs = query ? `?${new URLSearchParams(query)}` : "";
  let res;
  try {
    res = await fetch(`${BASE}${path}${qs}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ConnectorError("network", "We couldn't reach Zyvo. Check your connection and try again.");
  }
  const out = await res.json().catch(() => ({}));
  if (!res.ok) {
    const { error, message, ...extra } = out ?? {};
    throw new ConnectorError(error ?? "server_error", message ?? "Something went wrong on our side.", extra);
  }
  return out;
}

/** PUT the recording to the signed upload link, with progress (0..1) */
export function putFile(url, file, contentType, onProgress) {
  if (CONNECTOR_MOCK) {
    return new Promise((resolve) => {
      let p = 0;
      const t = setInterval(() => { p += 0.2; onProgress?.(Math.min(1, p)); if (p >= 1) { clearInterval(t); resolve(); } }, 200);
    });
  }
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open("PUT", url);
    x.setRequestHeader("Content-Type", contentType);
    x.setRequestHeader("x-upsert", "true");
    x.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(e.loaded / e.total); };
    x.onload = () => (x.status >= 200 && x.status < 300 ? resolve() : reject(new ConnectorError("upload", "The upload didn't go through. Try again.")));
    x.onerror = () => reject(new ConnectorError("upload", "The upload didn't go through. Check your connection and try again."));
    x.send(file);
  });
}

// ---------------------------------------------------------------- "is it open for me" (once per visitor + session)
const KEY = "zyvo_studio_open2"; // v2 (2026-11-21, opened to everyone): ignores a "closed" cached before the opening
const pending = new Map();
export function studioOpenFor(who) {
  if (CONNECTOR_MOCK) return Promise.resolve(true);
  try {
    const d = JSON.parse(sessionStorage.getItem(KEY) || "null");
    if (d && d.who === who && typeof d.open === "boolean") return Promise.resolve(d.open);
  } catch { /* no storage: ask */ }
  if (!pending.has(who)) {
    // signed out: the connector's public GET /open (the one switch, ZYVO_MCP_ACCESS): the pages and the In This Town
    // section show to visitors once it's open for everyone; the kit download and the tools still need a sign-in
    const ask = who === "guest"
      ? fetch(`${BASE}/open`).then((r) => (r.ok ? r.json() : { open: false }))
      : connector("/account/studio", { query: { peek: 1 } });
    pending.set(who, ask
      .then((r) => { const open = r?.open === true; try { sessionStorage.setItem(KEY, JSON.stringify({ who, open })); } catch { /* fine */ } return open; })
      .catch(() => false)
      .finally(() => window.setTimeout(() => pending.delete(who), 0)));
  }
  return pending.get(who);
}
