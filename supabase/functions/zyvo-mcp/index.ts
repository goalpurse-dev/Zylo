// deno-lint-ignore-file no-explicit-any
// zyvo-mcp: THE ZYVO CONNECTOR (remote MCP server, docs/zyvo-studio-kit-plan.md B). https://mcp.tryzyvo.com is a
// Vercel host rewrite onto this function (vercel.json), so every path below is served at the connector's own origin.
// The logic is in _shared/zyvoMcp/ (oauth.js, tools.js, server.js: plain JS, tested in Node); this file is the Deno
// glue: the Supabase tables, storage, the user, the caps, and the server-to-server calls to blocky-worlds-api.
// Deploy with verify_jwt OFF (supabase/config.toml): it does its own OAuth; its tokens work for nothing else.
//
// Function secrets:
//   ZYVO_MCP_INTERNAL_SECRET   shared with blocky-worlds-api (32+ characters): the connector's calls act as the user there
//   ZYVO_MCP_ACCESS=owner|everyone   who may connect and use the tools (default owner: BLOCKY_WORLDS_OWNER_EMAILS / gate.js)
//   ZYVO_MCP_PUBLIC_URL        default https://mcp.tryzyvo.com
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { makeServer } from "../_shared/zyvoMcp/server.js";
import { accessModeOf, LIMITS, UPLOAD } from "../_shared/zyvoMcp/config.js";
import { blockyOwners } from "../_shared/blockyWorlds/gate.js";
import { DEFAULT_SETTINGS, decide, SPEND_ALERT_USD } from "../_shared/blockyWorlds/guard.js";
import { alertOnce } from "../_shared/adminAlert.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SECRET = Deno.env.get("ZYVO_MCP_INTERNAL_SECRET") ?? "";
const BASE = (Deno.env.get("ZYVO_MCP_PUBLIC_URL") ?? "https://mcp.tryzyvo.com").replace(/\/$/, "");
const ACCESS = accessModeOf(Deno.env.get("ZYVO_MCP_ACCESS"));
const OWNERS = blockyOwners(Deno.env.get("BLOCKY_WORLDS_OWNER_EMAILS")).map((e: string) => e.toLowerCase());
const PAID_OFF = (Deno.env.get("BLOCKY_WORLDS_PAID_CALLS") ?? "").trim().toLowerCase() === "off";
const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
const bucket = () => admin.storage.from(UPLOAD.bucket);
const iso = () => new Date().toISOString();
const must = (r: any) => { if (r.error) throw new Error(r.error.message); return r.data; };

// ---------------------------------------------------------------- the store (service role; every query is per user)
const store = {
  // OAuth
  async countRegistrations(ipHash: string, since: string) { const { count } = await admin.from("zyvo_mcp_clients").select("client_id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", since); return count ?? 0; },
  async insertClient(row: any) { must(await admin.from("zyvo_mcp_clients").insert(row)); },
  async getClient(id: string) { return (await admin.from("zyvo_mcp_clients").select("*").eq("client_id", id).maybeSingle()).data ?? null; },
  async insertAuthRequest(row: any) { must(await admin.from("zyvo_mcp_auth_requests").insert(row)); },
  async getAuthRequest(h: string) { return (await admin.from("zyvo_mcp_auth_requests").select("*").eq("id_hash", h).maybeSingle()).data ?? null; },
  async takeAuthRequest(h: string) { return (await admin.from("zyvo_mcp_auth_requests").delete().eq("id_hash", h).select("*").maybeSingle()).data ?? null; },
  async insertCode(row: any) { must(await admin.from("zyvo_mcp_codes").insert(row)); },
  async takeCode(h: string) {
    const { data } = await admin.from("zyvo_mcp_codes").update({ used_at: iso() }).eq("code_hash", h).is("used_at", null).select("*").maybeSingle();
    if (data) return data;
    const { data: used } = await admin.from("zyvo_mcp_codes").select("code_hash, family_id").eq("code_hash", h).maybeSingle();
    return used ? { reused: true, family_id: used.family_id } : null;
  },
  async setCodeFamily(h: string, family: string) { await admin.from("zyvo_mcp_codes").update({ family_id: family }).eq("code_hash", h); },
  async insertToken(row: any) { must(await admin.from("zyvo_mcp_tokens").insert(row)); },
  async getTokenByAccess(h: string) { return (await admin.from("zyvo_mcp_tokens").select("*").eq("access_hash", h).maybeSingle()).data ?? null; },
  async getTokenByRefresh(h: string) { return (await admin.from("zyvo_mcp_tokens").select("*").eq("refresh_hash", h).maybeSingle()).data ?? null; },
  async revokeToken(id: string, why: string) { await admin.from("zyvo_mcp_tokens").update({ revoked_at: iso(), revoked_why: why }).eq("id", id).is("revoked_at", null); },
  async revokeFamily(family: string, why: string) { await admin.from("zyvo_mcp_tokens").update({ revoked_at: iso(), revoked_why: why }).eq("family_id", family).is("revoked_at", null); },
  async touchToken(id: string) { await admin.from("zyvo_mcp_tokens").update({ last_used_at: iso() }).eq("id", id); },
  async listConnections(userId: string) {
    const { data } = await admin.from("zyvo_mcp_tokens").select("family_id, client_id, scope, created_at, last_used_at, refresh_expires_at, zyvo_mcp_clients(client_name)").eq("user_id", userId).is("revoked_at", null).order("created_at", { ascending: false }).limit(50);
    return (data ?? []).map((t: any) => ({ id: t.family_id, client: t.zyvo_mcp_clients?.client_name ?? "An MCP client", scopes: String(t.scope).split(" "), since: t.created_at, lastUsed: t.last_used_at }));
  },
  async revokeConnection(userId: string, family: string) {
    const { data } = await admin.from("zyvo_mcp_tokens").update({ revoked_at: iso(), revoked_why: "user_signed_out" }).eq("user_id", userId).eq("family_id", family).is("revoked_at", null).select("id");
    return (data ?? []).length > 0;
  },
  // calls + quotes + jobs
  async countCalls(userId: string, since: string) { const { count } = await admin.from("zyvo_mcp_calls").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since); return count ?? 0; },
  async logCall(row: any) { await admin.from("zyvo_mcp_calls").insert(row); },
  async insertQuote(row: any) { must(await admin.from("zyvo_mcp_quotes").insert(row)); },
  async startPaid({ tokenHash, userId, tool, inputHash, kind, job, charge }: any) {
    const { data, error } = await admin.rpc("zyvo_mcp_start", { p_token_hash: tokenHash, p_user: userId, p_tool: tool, p_input_hash: inputHash, p_kind: kind, p_job: job ?? {}, p_charge: charge !== false });
    if (error) throw new Error(error.message);
    return Array.isArray(data) ? data[0] : data;
  },
  async refundJob(id: string, why: string) { const { data, error } = await admin.rpc("zyvo_mcp_refund", { p_job: id, p_why: why }); if (error) console.error("[zyvo-mcp] REFUND FAILED, refund by hand:", id, error.message); return data ?? 0; },
  async updateJob(id: string, patch: any) { must(await admin.from("zyvo_studio_jobs").update(patch).eq("id", id)); },
  async getJob(userId: string, id: string) { return (await admin.from("zyvo_studio_jobs").select("*").eq("id", id).eq("user_id", userId).maybeSingle()).data ?? null; },
  async countJobs(userId: string, tool: string, since: string) { const { count } = await admin.from("zyvo_studio_jobs").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("tool", tool).gte("created_at", since).is("refunded_at", null); return count ?? 0; },
  async activeJob(userId: string, projectId: string, kinds: string[]) { return (await admin.from("zyvo_studio_jobs").select("*").eq("user_id", userId).eq("project_id", projectId).in("kind", kinds).in("status", ["queued", "running"]).limit(1).maybeSingle()).data ?? null; },
  async listJobs(userId: string, n: number) { return (await admin.from("zyvo_studio_jobs").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(n)).data ?? []; },
  async sweepJob(j: any) {
    if (!["queued", "running"].includes(j.status)) return j;
    const stale = j.kind === "script" || j.kind === "video" ? Date.now() - Date.parse(j.created_at) > LIMITS.taskStaleSec * 1000 : Date.now() - Date.parse(j.heartbeat_at ?? j.created_at) > LIMITS.jobStaleSec * 1000;
    if (!stale) return j;
    await admin.rpc("zyvo_studio_sweep");
    return (await store.getJob(j.user_id, j.id)) ?? j;
  },
  async freeFinishUsed(userId: string) { return Boolean((await admin.from("zyvo_free_finish").select("user_id").eq("user_id", userId).maybeSingle()).data); },
  async freeFinishesToday(since: string) { const { count } = await admin.from("zyvo_free_finish").select("user_id", { count: "exact", head: true }).gte("used_at", since); return count ?? 0; },
  async scriptCreditsFor(userId: string, draftId: string) {
    const { data } = await admin.from("zyvo_studio_jobs").select("credits_charged").eq("user_id", userId).eq("kind", "script").eq("status", "done").is("refunded_at", null).eq("output->>draft_id", draftId).limit(1).maybeSingle();
    return Number(data?.credits_charged ?? 0);
  },
  // make_video_in_zyvo from a draft: the site's own prepay (blocky_worlds_prepay), tied to the draft, so "start"
  // consumes it and a failed video gives it all back (blocky_worlds_refund); never a second charge path
  async prepayDraft(userId: string, draftId: string, credits: number, keep: number, _jobId: string) {
    const { data: d } = await admin.from("blocky_worlds_drafts").select("id").eq("id", draftId).eq("user_id", userId).is("deleted_at", null).maybeSingle();
    if (!d) throw Object.assign(new Error("We couldn't find that script."), { code: "NOT_FOUND" });
    const open = (await admin.from("blocky_worlds_prepays").select("id").eq("user_id", userId).eq("draft_id", draftId).is("run_id", null).is("refunded_at", null).maybeSingle()).data;
    if (open) return open.id; // already paid for (the site's Write my script): nothing more is taken
    const { data: pre, error } = await admin.rpc("blocky_worlds_prepay", { p_user: userId, p_credits: credits, p_keep: keep, p_days: 7 });
    if (error || !pre) throw Object.assign(new Error(/INSUFFICIENT_CREDITS/.test(error?.message ?? "") ? `You need ${credits} credits for this video.` : "Couldn't take the payment. Nothing was charged."), { code: /INSUFFICIENT_CREDITS/.test(error?.message ?? "") ? "CREDITS" : "SERVER" });
    await admin.from("blocky_worlds_prepays").update({ draft_id: draftId }).eq("id", pre.id);
    return pre.id;
  },
  async refundDraftPrepay(userId: string, draftId: string, why: string) {
    const open = (await admin.from("blocky_worlds_prepays").select("id").eq("user_id", userId).eq("draft_id", draftId).is("run_id", null).is("refunded_at", null).maybeSingle()).data;
    if (open) { const { error } = await admin.rpc("blocky_worlds_prepay_refund", { p_prepay: open.id, p_keep: 0, p_why: why }); if (error) console.error("[zyvo-mcp] prepay refund FAILED, refund by hand:", open.id, error.message); }
  },
  // projects
  async getProject(userId: string, id: string) { return (await admin.from("zyvo_studio_projects").select("*").eq("id", id).eq("user_id", userId).is("deleted_at", null).maybeSingle()).data ?? null; },
  async getProjectBySlug(userId: string, slug: string) { return (await admin.from("zyvo_studio_projects").select("*").eq("user_id", userId).eq("kit_project_id", slug).is("deleted_at", null).maybeSingle()).data ?? null; },
  async countProjects(userId: string) { const { count } = await admin.from("zyvo_studio_projects").select("id", { count: "exact", head: true }).eq("user_id", userId).is("deleted_at", null); return count ?? 0; },
  async saveProject(userId: string, slug: string, row: any) { return must(await admin.from("zyvo_studio_projects").upsert({ user_id: userId, kit_project_id: slug, ...row, updated_at: iso() }, { onConflict: "user_id,kit_project_id" }).select("*").single()); },
  async updateProject(userId: string, id: string, row: any) { return must(await admin.from("zyvo_studio_projects").update({ ...row, updated_at: iso() }).eq("id", id).eq("user_id", userId).select("*").single()); },
  async listProjects(userId: string, n: number) { return (await admin.from("zyvo_studio_projects").select("*").eq("user_id", userId).is("deleted_at", null).order("updated_at", { ascending: false }).limit(n)).data ?? []; },
  async logKitDownload(row: any) { await admin.from("zyvo_kit_downloads").insert(row); },
  async voiceWords(p: any) {
    if (!p.voice?.words) return null;
    const { data } = await bucket().download(p.voice.words);
    try { return data ? JSON.parse(await data.text()) : null; } catch { return null; }
  },
};

const storage = {
  async signUpload(path: string) { const r = must(await bucket().createSignedUploadUrl(path)); return { url: r.signedUrl, token: r.token, path }; },
  async signDownload(path: string | undefined, name?: string, ttlSec = 3600) { if (!path) return null; const { data } = await bucket().createSignedUrl(path, ttlSec, name ? { download: name } : undefined); return data?.signedUrl ?? null; },
  /** many view links in one call (the Studio projects tab): path -> signed URL (1 h) */
  async signDownloads(paths: string[]) {
    const out = new Map<string, string>();
    const uniq = [...new Set(paths.filter(Boolean))];
    if (!uniq.length) return out;
    const { data } = await bucket().createSignedUrls(uniq, 3600);
    for (const r of data ?? []) if (r.path && r.signedUrl) out.set(r.path, r.signedUrl);
    return out;
  },
  async remove(paths: string[]) { const p = paths.filter(Boolean); if (p.length) await bucket().remove(p); },
  async exists(path: string) {
    const dir = path.split("/").slice(0, -1).join("/"), file = path.split("/").at(-1);
    const { data } = await bucket().list(dir, { search: file, limit: 5 });
    const f = (data ?? []).find((x: any) => x.name === file);
    return f ? { bytes: Number(f.metadata?.size ?? 0) } : null;
  },
};

// ---------------------------------------------------------------- the user, the switch, the caps
async function user(userId: string) {
  const [{ data: u }, { data: p }] = await Promise.all([admin.auth.admin.getUserById(userId), admin.from("profiles").select("plan_code, credit_balance").eq("id", userId).maybeSingle()]);
  const email = String(u?.user?.email ?? "").toLowerCase();
  return { email, emailConfirmed: Boolean(u?.user?.email_confirmed_at), plan: String(p?.plan_code ?? "free").toLowerCase(), balance: Number(p?.credit_balance ?? 0), owner: OWNERS.includes(email) };
}
async function allowed(userId: string) {
  if (ACCESS === "everyone") return true;
  return (await user(userId)).owner;
}
async function guard(userId: string, addUsd: number) {
  const [{ data: settings }, { data: counts }] = await Promise.all([
    admin.from("blocky_worlds_settings").select("*").eq("id", 1).maybeSingle(),
    admin.rpc("blocky_worlds_guard", { p_user: userId }),
  ]);
  const g = decide(settings ?? DEFAULT_SETTINGS, counts ?? null, addUsd, { envOff: PAID_OFF, kind: "writing" });
  try {
    const spent = Number(counts?.spent_24h ?? 0), cap = Number(settings?.daily_cap_usd ?? DEFAULT_SETTINGS.daily_cap_usd);
    if (spent >= SPEND_ALERT_USD) await alertOnce(admin, "in-this-town-spend-25", 86_400, `In This Town: $${spent.toFixed(2)} spent in the last 24 h`, `The real In This Town cost (GPU, AI, voice, the Zyvo connector) of the last 24 hours is $${spent.toFixed(2)}, over the $${SPEND_ALERT_USD} alert line. New paid work pauses automatically at $${cap}. To pause everything now: set paid_calls = false in public.blocky_worlds_settings.`);
  } catch (e) { console.error("[zyvo-mcp] spend alert:", (e as any)?.message ?? e); }
  return g;
}
async function siteUser(header: string | null) {
  const token = String(header ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token || token === ANON || token.startsWith("zyvo_")) return null;
  const { data } = await createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } }).auth.getUser(token);
  return data?.user ? { id: data.user.id, email: String(data.user.email ?? "").toLowerCase() } : null;
}

/** blocky-worlds-api as this user (server to server, the shared secret): the site's own rules, limits and charges */
async function api(userId: string, body: any) {
  if (SECRET.length < 32) throw Object.assign(new Error("The connector isn't fully set up yet."), { code: "BUSY" });
  const res = await fetch(`${SUPABASE_URL}/functions/v1/blocky-worlds-api`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ANON}`, "x-zyvo-mcp-secret": SECRET, "x-zyvo-mcp-user": userId },
    body: JSON.stringify(body), signal: AbortSignal.timeout(380_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const { error, code, ...extra } = data ?? {}; throw Object.assign(new Error(String(error ?? "Something went wrong on our side.")), { code: code ?? "SERVER", extra }); }
  return data;
}

const server = makeServer({
  store, storage, api, user, guard, allowed, siteUser, base: BASE,
  background: (p: Promise<unknown>) => { try { (globalThis as any).EdgeRuntime?.waitUntil(p); } catch { /* local */ } },
});

// ---------------------------------------------------------------- Deno glue
async function readBody(req: Request) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return null;
  const type = req.headers.get("content-type") ?? "";
  const text = await req.text();
  if (text.length > 1_000_000) return null;
  if (type.includes("application/x-www-form-urlencoded")) return Object.fromEntries(new URLSearchParams(text));
  try { return text ? JSON.parse(text) : null; } catch { return { __unparsed: true }; }
}
Deno.serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*?\/zyvo-mcp(?=\/|$)/, "") || "/";
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
  const body = await readBody(req);
  if (body && (body as any).__unparsed && path === "/mcp") return new Response(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }), { status: 400, headers: { "Content-Type": "application/json" } });
  const r = await server.handle({ method: req.method, path, query: Object.fromEntries(url.searchParams), headers, body, ip: (headers["x-forwarded-for"] ?? "").split(",")[0].trim() });
  // 202 / 204 / an empty redirect carry no body (Deno refuses a body on a null-body status)
  const out = r.body === "" || r.body == null ? null : typeof r.body === "string" ? r.body : JSON.stringify(r.body);
  return new Response(out, { status: r.status, headers: r.headers });
});
