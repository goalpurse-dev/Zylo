// THE ZYVO CONNECTOR: a small OAuth 2.1 authorization server for MCP clients (Claude Code, claude.ai, ...).
// Public clients only (PKCE S256, no client secret), dynamic client registration (claude.ai needs it), the consent
// screen on tryzyvo.com (the user's normal Zyvo login), opaque tokens stored only as SHA-256 hashes, 1 h access
// tokens, rotating refresh tokens with reuse detection (a replayed refresh token revokes the whole connection).
// Supabase Auth's own OAuth server is OFF on our project (checked 2026-11-19): these tokens work for the connector
// only, never for the site's other APIs.
// Everything here is pure logic over `store` (the edge function gives the Supabase tables, the tests a fake).
import { OAUTH, URLS } from "./config.js";
import { pkceOk, randomToken, sha256Hex } from "./crypto.js";

const nowIso = (now) => new Date(now()).toISOString();
const later = (now, sec) => new Date(now() + sec * 1000).toISOString();
const json = (status, body, headers = {}) => ({ status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers }, body });
const oauthError = (status, error, description) => json(status, { error, ...(description ? { error_description: description } : {}) });

export function protectedResourceMetadata(base) {
  return { resource: `${base}/mcp`, authorization_servers: [base], scopes_supported: [...OAUTH.scopes], bearer_methods_supported: ["header"], resource_name: "Zyvo", resource_documentation: URLS.connect };
}
export function authServerMetadata(base) {
  return {
    issuer: base, authorization_endpoint: `${base}/authorize`, token_endpoint: `${base}/token`, registration_endpoint: `${base}/register`,
    revocation_endpoint: `${base}/revoke`, response_types_supported: ["code"], grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"], token_endpoint_auth_methods_supported: ["none"], revocation_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [...OAUTH.scopes], service_documentation: URLS.connect,
  };
}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);
/** a redirect URI we accept: https anywhere, or http on the loopback (a CLI's local callback); never a fragment */
export function redirectOk(uri) {
  let u;
  try { u = new URL(String(uri)); } catch { return false; }
  if (String(uri).length > 500 || u.hash || u.username || u.password) return false;
  if (u.protocol === "https:") return true;
  return u.protocol === "http:" && LOOPBACK.has(u.hostname);
}
/** the registered URI matches: exactly, or (loopback, RFC 8252) the same except the port */
export function redirectMatches(registered, given) {
  if ((registered ?? []).includes(given)) return true;
  let g; try { g = new URL(given); } catch { return false; }
  if (!LOOPBACK.has(g.hostname)) return false;
  return (registered ?? []).some((r) => { try { const x = new URL(r); return LOOPBACK.has(x.hostname) && x.protocol === g.protocol && x.hostname === g.hostname && x.pathname === g.pathname && x.search === g.search; } catch { return false; } });
}
/** the scopes asked for, kept to the ones we know; none asked = all of them */
export function scopesOf(raw) {
  const asked = String(raw ?? "").split(/\s+/).filter(Boolean);
  const known = asked.filter((s) => OAUTH.scopes.includes(s));
  return (asked.length ? known : [...OAUTH.scopes]).join(" ");
}

export function makeOAuth({ store, base, now = () => Date.now() }) {
  return {
    /** RFC 7591 dynamic client registration (public clients only) */
    async register(body, { ip = "" } = {}) {
      const ipHash = await sha256Hex(`ip:${ip}`);
      if ((await store.countRegistrations(ipHash, new Date(now() - 3600_000).toISOString())) >= OAUTH.registrationsPerHourPerIp) return oauthError(429, "temporarily_unavailable", "Too many registrations. Try again later.");
      const uris = Array.isArray(body?.redirect_uris) ? body.redirect_uris.map(String) : [];
      if (!uris.length || uris.length > OAUTH.maxRedirectUris || !uris.every(redirectOk)) return oauthError(400, "invalid_redirect_uri", "redirect_uris: 1-5 https URLs (or http on localhost).");
      const method = body?.token_endpoint_auth_method ?? "none";
      if (method !== "none") return oauthError(400, "invalid_client_metadata", "Only public clients (token_endpoint_auth_method none, with PKCE).");
      const grants = Array.isArray(body?.grant_types) ? body.grant_types : ["authorization_code", "refresh_token"];
      if (!grants.every((g) => g === "authorization_code" || g === "refresh_token")) return oauthError(400, "invalid_client_metadata", "grant_types: authorization_code, refresh_token.");
      const name = String(body?.client_name ?? "An MCP client").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 80) || "An MCP client";
      const row = { client_id: randomToken("zyvo_c_", 18), client_name: name, redirect_uris: uris, ip_hash: ipHash, created_at: nowIso(now) };
      await store.insertClient(row);
      return json(201, { client_id: row.client_id, client_id_issued_at: Math.floor(now() / 1000), client_name: name, redirect_uris: uris, grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "none" });
    },

    /** GET /authorize: checked, then handed to the consent screen on tryzyvo.com (the user signs in there) */
    async authorize(q) {
      const client = q.client_id ? await store.getClient(String(q.client_id)) : null;
      // a bad client or redirect is never redirected to (an open redirector otherwise): a plain error page
      if (!client) return { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" }, body: "Unknown client. Add the connector again." };
      const redirect = String(q.redirect_uri ?? (client.redirect_uris.length === 1 ? client.redirect_uris[0] : ""));
      if (!redirectMatches(client.redirect_uris, redirect)) return { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" }, body: "This redirect address is not registered for the client." };
      const back = (error, description) => {
        const u = new URL(redirect); u.searchParams.set("error", error); if (description) u.searchParams.set("error_description", description); if (q.state) u.searchParams.set("state", String(q.state));
        return { status: 302, headers: { Location: u.toString() }, body: "" };
      };
      if (q.response_type !== "code") return back("unsupported_response_type", "Only response_type=code.");
      if (q.code_challenge_method !== "S256" || !/^[A-Za-z0-9\-_]{43,128}$/.test(String(q.code_challenge ?? ""))) return back("invalid_request", "PKCE S256 is required.");
      if (q.resource && String(q.resource).replace(/\/$/, "") !== `${base}/mcp`) return back("invalid_target", "Unknown resource.");
      const id = randomToken("zyvo_ar_", 24);
      await store.insertAuthRequest({ id_hash: await sha256Hex(id), client_id: client.client_id, redirect_uri: redirect, code_challenge: String(q.code_challenge), scope: scopesOf(q.scope), state: q.state ? String(q.state).slice(0, 500) : null, expires_at: later(now, OAUTH.requestTtlSec), created_at: nowIso(now) });
      const to = new URL(URLS.consent); to.searchParams.set("request", id);
      return { status: 302, headers: { Location: to.toString() }, body: "" };
    },

    /** the consent screen's details (the signed-in user's own call from tryzyvo.com) */
    async requestDetails(userId, id) {
      const r = await store.getAuthRequest(await sha256Hex(String(id ?? "")));
      if (!r || Date.parse(r.expires_at) < now()) return json(404, { error: "expired", message: "This sign-in link expired. Go back to Claude and connect again." });
      const client = await store.getClient(r.client_id);
      return json(200, { client: client?.client_name ?? "An MCP client", redirectHost: new URL(r.redirect_uri).host, scopes: r.scope.split(" "), expiresAt: r.expires_at, userId });
    },

    /** Allow / Deny on the consent screen: a code for the client, or access_denied; the request is used up either way */
    async decision(userId, id, approve) {
      const idHash = await sha256Hex(String(id ?? ""));
      const r = await store.takeAuthRequest(idHash);
      if (!r || Date.parse(r.expires_at) < now()) return json(404, { error: "expired", message: "This sign-in link expired. Go back to Claude and connect again." });
      const u = new URL(r.redirect_uri);
      if (r.state) u.searchParams.set("state", r.state);
      if (!approve) { u.searchParams.set("error", "access_denied"); return json(200, { redirect: u.toString() }); }
      const code = randomToken("zyvo_ac_", 32);
      await store.insertCode({ code_hash: await sha256Hex(code), client_id: r.client_id, user_id: userId, redirect_uri: r.redirect_uri, code_challenge: r.code_challenge, scope: r.scope, expires_at: later(now, OAUTH.codeTtlSec), created_at: nowIso(now) });
      u.searchParams.set("code", code);
      return json(200, { redirect: u.toString() });
    },

    /** POST /token: authorization_code (PKCE) or refresh_token (rotation) */
    async token(form) {
      const grant = String(form?.grant_type ?? "");
      if (grant === "authorization_code") {
        const codeHash = await sha256Hex(String(form.code ?? ""));
        const c = await store.takeCode(codeHash);
        if (!c) return oauthError(400, "invalid_grant", "The code is unknown or expired.");
        if (c.reused) {
          // a code used twice: whatever it gave out is revoked (RFC 6749 4.1.2)
          if (c.family_id) await store.revokeFamily(c.family_id, "code_reused");
          return oauthError(400, "invalid_grant", "The code was already used.");
        }
        if (Date.parse(c.expires_at) < now()) return oauthError(400, "invalid_grant", "The code expired.");
        if (form.client_id && String(form.client_id) !== c.client_id) return oauthError(400, "invalid_grant", "The code belongs to another client.");
        if (String(form.redirect_uri ?? c.redirect_uri) !== c.redirect_uri) return oauthError(400, "invalid_grant", "redirect_uri does not match.");
        if (!(await pkceOk(form.code_verifier, c.code_challenge))) return oauthError(400, "invalid_grant", "PKCE check failed.");
        const family = randomToken("", 16);
        await store.setCodeFamily(codeHash, family);
        return json(200, await this.issue({ userId: c.user_id, clientId: c.client_id, scope: c.scope, family }));
      }
      if (grant === "refresh_token") {
        const rt = String(form.refresh_token ?? "");
        const t = await store.getTokenByRefresh(await sha256Hex(rt));
        if (!t) return oauthError(400, "invalid_grant", "Unknown refresh token.");
        if (t.revoked_at) {
          // a rotated refresh token came back: someone kept a copy -> the whole connection is revoked
          if (t.revoked_why === "rotated") await store.revokeFamily(t.family_id, "refresh_reused");
          return oauthError(400, "invalid_grant", "This connection was signed out. Connect again.");
        }
        if (Date.parse(t.refresh_expires_at) < now()) return oauthError(400, "invalid_grant", "The refresh token expired. Connect again.");
        if (form.client_id && String(form.client_id) !== t.client_id) return oauthError(400, "invalid_grant", "The token belongs to another client.");
        await store.revokeToken(t.id, "rotated");
        return json(200, await this.issue({ userId: t.user_id, clientId: t.client_id, scope: t.scope, family: t.family_id }));
      }
      return oauthError(400, "unsupported_grant_type");
    },

    async issue({ userId, clientId, scope, family }) {
      const access = randomToken("zyvo_at_"), refresh = randomToken("zyvo_rt_");
      await store.insertToken({ user_id: userId, client_id: clientId, scope, family_id: family, access_hash: await sha256Hex(access), refresh_hash: await sha256Hex(refresh), access_expires_at: later(now, OAUTH.accessTtlSec), refresh_expires_at: later(now, OAUTH.refreshTtlDays * 86400), created_at: nowIso(now) });
      return { access_token: access, token_type: "Bearer", expires_in: OAUTH.accessTtlSec, refresh_token: refresh, scope };
    },

    /** RFC 7009: always 200; an access or refresh token revokes its connection */
    async revoke(form) {
      const h = await sha256Hex(String(form?.token ?? ""));
      const t = (await store.getTokenByAccess(h)) ?? (await store.getTokenByRefresh(h));
      if (t?.family_id) await store.revokeFamily(t.family_id, "revoked");
      return json(200, {});
    },

    /** the Bearer token of an MCP request -> who and what it may do, or null */
    async authenticate(header) {
      const m = /^Bearer\s+(zyvo_at_[A-Za-z0-9\-_]{20,})$/i.exec(String(header ?? "").trim());
      if (!m) return null;
      const t = await store.getTokenByAccess(await sha256Hex(m[1]));
      if (!t || t.revoked_at || Date.parse(t.access_expires_at) < now()) return null;
      store.touchToken?.(t.id)?.catch?.(() => {});
      return { userId: t.user_id, clientId: t.client_id, scopes: String(t.scope).split(" "), tokenId: t.id, family: t.family_id };
    },
  };
}
