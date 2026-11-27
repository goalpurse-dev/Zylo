// deno-lint-ignore-file no-explicit-any
// maestro-api: MAESTRO, the chat (docs/studio-v2-plan.md "Maestro"). The logic is _shared/maestro/brain.js (tested in
// Node); this file is the Deno glue: the user and their plan, the tables, and the Claude call.
//   Free: Claude Haiku 5.5. Paid plans (and the owner): Claude Sonnet 5.5 with the server-side refusal fallback.
//   Plans and changes go through the Director (_shared/director/deno.ts: Claude Sonnet 5.5 writes them).
// Maestro never spends credits: making something is a card the user presses (the page starts the template itself).
// Function secrets: ANTHROPIC_API_KEY (already set for the other functions), BLOCKY_WORLDS_OWNER_EMAILS (the owner list).
// OWNER-ONLY (owner 2026-11-27): STUDIO_V2_ACCESS (_shared/studioV2/access.js). { action: "access" } answers every
// signed-in user ({ studioV2: true|false }: the site shows the new UI only on true); everything else is a 404 for anyone
// the switch does not let in. STUDIO_V2_ACCESS=off closes it for the owner too (the rollback).
// Deploy with verify_jwt on.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk@1.14.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cors, ok, err } from "../shared/cors.ts";
import { alertAdmin } from "../_shared/adminAlert.ts";
import { requireUser } from "../shared/auth.ts";
import { MAESTRO, MaestroError, makeMaestro } from "../_shared/maestro/brain.js";
import { makeDirectorFor } from "../_shared/director/deno.ts";
import { canWrite } from "../_shared/blockyWorlds/access.js";
import { blockyOwners } from "../_shared/blockyWorlds/gate.js";
import { STUDIO_V2_CLOSED, studioV2Allowed } from "../_shared/studioV2/access.js";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") ?? "" });
const OWNERS = blockyOwners(Deno.env.get("BLOCKY_WORLDS_OWNER_EMAILS")).map((e: string) => e.toLowerCase());
const must = (r: any) => { if (r.error) throw new Error(r.error.message); return r.data; };
const iso = () => new Date().toISOString();

const store = {
  async getChat(userId: string, id: string) { return (await admin.from("maestro_chats").select("*").eq("id", id).eq("user_id", userId).is("deleted_at", null).maybeSingle()).data ?? null; },
  async createChat(row: any) { return must(await admin.from("maestro_chats").insert(row).select("*").single()); },
  async updateChat(id: string, patch: any) { await admin.from("maestro_chats").update(patch).eq("id", id); },
  async listChats(userId: string, n: number) { return (await admin.from("maestro_chats").select("*").eq("user_id", userId).is("deleted_at", null).order("updated_at", { ascending: false }).limit(n)).data ?? []; },
  async listMessages(chatId: string) { return (await admin.from("maestro_messages").select("*").eq("chat_id", chatId).order("id", { ascending: true }).limit(MAESTRO.turnsPerChat + 2)).data ?? []; },
  async insertMessage(row: any) { return must(await admin.from("maestro_messages").insert(row).select("*").single()); },
  // only answers that worked count toward the day
  async countUsage(userId: string, since: string) { const { count } = await admin.from("maestro_usage").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("ok", true).gte("created_at", since); return count ?? 0; },
  async logUsage(row: any) { return must(await admin.from("maestro_usage").insert(row).select("id").single()).id; },
  async markUsage(id: number, patch: any) { await admin.from("maestro_usage").update(patch).eq("id", id); },
};

// a subscription that still bills (the same rule as the pricing page: src/hooks/usePlanCode.js)
const LIVE_SUB = ["active", "paid", "trialing", "past_due"];
async function user(userId: string) {
  const [{ data: u }, { data: p }] = await Promise.all([admin.auth.admin.getUserById(userId), admin.from("profiles").select("plan_code, credit_balance, stripe_subscription_id, subscription_status").eq("id", userId).maybeSingle()]);
  const plan = String(p?.plan_code ?? "free").toLowerCase();
  const status = p?.subscription_status ? String(p.subscription_status) : null;
  return {
    plan, paid: canWrite(plan), owner: OWNERS.includes(String(u?.user?.email ?? "").toLowerCase()),
    credits: Number.isFinite(Number(p?.credit_balance)) ? Number(p.credit_balance) : null,
    hasSub: Boolean(p?.stripe_subscription_id) && (status == null || LIVE_SUB.includes(status)),
  };
}

// the live plan and pack prices: the plan-prices function (Stripe, the same numbers the pricing page shows), kept 10 min
const PRICES_TTL_MS = 10 * 60 * 1000;
let pricesCache: { at: number; body: unknown } | null = null;
async function prices() {
  if (pricesCache && Date.now() - pricesCache.at < PRICES_TTL_MS) return pricesCache.body;
  try {
    const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/plan-prices`, { method: "POST", headers: { "content-type": "application/json", apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "", Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY") ?? ""}` }, body: "{}", signal: AbortSignal.timeout(5000) });
    const body = await res.json();
    if (!res.ok || !body?.plans) throw new Error(body?.error ?? `status ${res.status}`);
    pricesCache = { at: Date.now(), body };
    return body;
  } catch (e) {
    console.error("[maestro-api] prices", (e as any)?.message ?? e);
    return pricesCache?.body ?? null; // a stale copy beats none; with none, Maestro says "see the pricing page"
  }
}

/** one Messages call. Sonnet gets the refusal fallback (its beta); for Haiku, blocks only that beta knows are left out */
async function claude(request: any) {
  const sonnet = request.model === MAESTRO.models.paid;
  if (sonnet) return await anthropic.beta.messages.create({ ...request, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } as any);
  const messages = request.messages.map((m: any) => (Array.isArray(m.content) ? { ...m, content: m.content.filter((b: any) => b.type !== "fallback") } : m));
  return await anthropic.messages.create({ ...request, messages } as any);
}

// a scanned reference video: only the user's own finished scan (reference_scans)
const references = {
  async get(userId: string, id: string) {
    const { data } = await admin.from("reference_scans").select("breakdown").eq("id", id).eq("user_id", userId).eq("status", "done").maybeSingle();
    return data?.breakdown ?? null;
  },
};
const maestro = makeMaestro({ store, claude, director: makeDirectorFor(admin), user, prices, references });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);
  const { user: u, authError } = await requireUser(req);
  if (authError || !u) return err(req, "Sign in to chat with Maestro.", 401, { code: "SIGN_IN" });
  const text = await req.text();
  if (text.length > 20_000) return err(req, "That's too much text.", 413, { code: "BAD_INPUT" });
  let body: any = {};
  try { body = JSON.parse(text || "{}"); } catch { return err(req, "Bad request.", 400, { code: "BAD_INPUT" }); }
  // the owner-only switch, before anything is read, written or sent to a model
  const allowed = studioV2Allowed({ mode: Deno.env.get("STUDIO_V2_ACCESS"), user: u, owners: OWNERS });
  if (body?.action === "access") return ok(req, { studioV2: allowed });
  if (!allowed) return new Response(JSON.stringify(STUDIO_V2_CLOSED), { status: 404, headers: { ...cors(req), "content-type": "application/json" } });
  try {
    return ok(req, await maestro.handle(u.id, body));
  } catch (e) {
    if (e instanceof MaestroError) {
      // Claude (and its backup) didn't answer: the owner's failure alerts (grouped, once per 6 h); the reason stays server-side
      if (e.code === "BUSY") {
        const { reason, ...extra } = (e.extra ?? {}) as any;
        await alertAdmin("Maestro: the model didn't answer", `A Maestro message failed: ${reason ?? "no reason"}.\nThe user saw "Maestro is taking a break, try again in a minute." Nothing was counted against their day.`, "maestro-api").catch(() => {});
        return err(req, e.message, e.status, { code: e.code, ...extra });
      }
      return err(req, e.message, e.status, { code: e.code, ...e.extra });
    }
    console.error("[maestro-api]", (e as any)?.message ?? e, iso());
    await alertAdmin("Maestro: server error", `maestro-api failed: ${String((e as any)?.message ?? e).slice(0, 300)}`, "maestro-api").catch(() => {});
    return err(req, "Maestro is taking a break, try again in a minute.", 500, { code: "SERVER" });
  }
});
