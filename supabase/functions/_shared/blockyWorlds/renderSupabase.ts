// deno-lint-ignore-file no-explicit-any
// Blocky Worlds: the production adapters for renderRuntime.js — Supabase (tables, storage, refund, ledger, alerts) and
// RunPod. Used by blocky-worlds-api (start) and blocky-worlds-render (callbacks + the sweeper).
//
// Function secrets:
//   BLOCKY_WORLDS_RUNPOD_API_KEY (falls back to CUTAWAY_RUNPOD_API_KEY), BLOCKY_WORLDS_RUNPOD_ENDPOINT (zyvo-blocky-render)
//   BLOCKY_WORLDS_CALLBACK_SECRET   signs each run's callback token (any long random string)
//   BLOCKY_WORLDS_CRON_SECRET       the sweeper's header (also the vault secret blocky_worlds_cron_secret)
//   BLOCKY_WORLDS_DIRECTOR          off | mock | haiku | sonnet (default mock: free)       the prepare job's story director
//   BLOCKY_WORLDS_BUILDER           off | on (default off: kit + shared library only)      the prepare job's builder
//   BLOCKY_WORLDS_BUILDER_MAX_USD   the builder's money cap per video (default 0.60, at most 2)
// The ElevenLabs and Anthropic keys are NOT here: they are RunPod secrets in the worker's template (blocky_elevenlabs,
// blocky_anthropic: runpod/setup.mjs).
import { makeRuntime } from "./renderRuntime.js";
import { BUCKET, productionSettings } from "./render.js";
import { alertOnce } from "../adminAlert.ts";

const env = (k: string) => (Deno.env.get(k) ?? "").trim();
export const RENDER_CONFIG = {
  runpodKey: env("BLOCKY_WORLDS_RUNPOD_API_KEY") || env("CUTAWAY_RUNPOD_API_KEY"),
  endpoint: env("BLOCKY_WORLDS_RUNPOD_ENDPOINT"),
  callbackSecret: env("BLOCKY_WORLDS_CALLBACK_SECRET"),
  cronSecret: env("BLOCKY_WORLDS_CRON_SECRET"),
  callbackUrl: `${env("SUPABASE_URL")}/functions/v1/blocky-worlds-render`,
  production: productionSettings(env),
};
/** everything a start needs: checked by blocky-worlds-api BEFORE anything is charged */
export const renderConfigured = () => Boolean(RENDER_CONFIG.runpodKey && RENDER_CONFIG.endpoint && RENDER_CONFIG.callbackSecret);

const TERMINAL = "(done,failed)";
const now = () => new Date().toISOString();

export function supabaseDb(admin: any) {
  return {
    async getRun(id: string) { return (await admin.from("blocky_worlds_runs").select("*").eq("id", id).maybeSingle()).data ?? null; },
    async liveRuns(limit: number) { return (await admin.from("blocky_worlds_runs").select("*").not("status", "in", TERMINAL).is("deleted_at", null).order("created_at").limit(limit)).data ?? []; },
    async updateRun(id: string, patch: any, guard: any = {}) {
      let q = admin.from("blocky_worlds_runs").update({ ...patch, updated_at: now() }).eq("id", id);
      if (guard.notTerminal) q = q.not("status", "in", TERMINAL);
      if (guard.plannedNull) q = q.is("planned_at", null);
      const { data, error } = await q.select("*").maybeSingle();
      if (error) throw new Error(`run update: ${error.message}`);
      return data ?? null;
    },
    async jobs(runId: string) { return (await admin.from("blocky_worlds_jobs").select("*").eq("run_id", runId).order("created_at")).data ?? []; },
    async getJob(id: string) { return (await admin.from("blocky_worlds_jobs").select("*").eq("id", id).maybeSingle()).data ?? null; },
    async insertJob(row: any) {
      const { data, error } = await admin.from("blocky_worlds_jobs").insert(row).select("*").maybeSingle();
      if (error) { if (error.code === "23505" || /duplicate key/i.test(error.message)) return null; throw new Error(`job insert: ${error.message}`); }
      return data;
    },
    async updateJob(id: string, patch: any, guard: any = {}) {
      let q = admin.from("blocky_worlds_jobs").update({ ...patch, updated_at: now() }).eq("id", id);
      if (guard.live) q = q.in("state", ["sent", "running"]);
      const { data, error } = await q.select("*").maybeSingle();
      if (error) throw new Error(`job update: ${error.message}`);
      return data ?? null;
    },
    async jobsMissingCost(limit: number) {
      const since = new Date(Date.now() - 86400000).toISOString(), before = new Date(Date.now() - 60000).toISOString();
      return (await admin.from("blocky_worlds_jobs").select("*").is("gpu_seconds", null).not("provider_job_id", "is", null).not("finished_at", "is", null).gt("finished_at", since).lt("finished_at", before).limit(limit)).data ?? [];
    },
    /** rows with a ref are written once (unique run_id + ref); only the new ones are added to the run's cost */
    async ledger(run: any, rows: any[]) {
      const { data, error } = await admin.from("blocky_worlds_cost_ledger").upsert(rows.map((r) => ({ run_id: run.id, stage: r.stage, provider: r.provider, model: r.model ?? null, usd: r.usd, units: r.units ?? {}, ref: r.ref })), { onConflict: "run_id,ref", ignoreDuplicates: true }).select("usd");
      if (error) { console.error("[blocky-worlds-render] ledger:", error.message); return 0; }
      const add = (data ?? []).reduce((a: number, r: any) => a + Number(r.usd || 0), 0);
      if (add > 0) await admin.rpc("blocky_worlds_add_cost", { p_run: run.id, p_usd: add });
      return add;
    },
    async refund(runId: string) {
      const { data, error } = await admin.rpc("blocky_worlds_refund", { p_run: runId });
      if (error) throw new Error(error.message);
      return Number(data) || 0;
    },
    async alert(key: string, subject: string, text: string) { await alertOnce(admin, key, 3600, subject, text); },
    /** the shared library's snapshot for the builder (supabase/migrations/20261203100000_blocky_worlds_assets.sql);
     * a missing table (not applied yet) or any error is an empty library, never a failed run */
    async assetLibrary(limit: number) {
      const { data, error } = await admin.from("blocky_worlds_assets").select("id,kind,name,name_key,aliases,keys,blueprint,still_path,status,uses")
        .eq("status", "live").order("uses", { ascending: false }).order("updated_at", { ascending: false }).limit(limit);
      if (error) { console.log("[blocky-worlds-render] library snapshot skipped:", error.message); return []; }
      return data ?? [];
    },
    /** one built asset, once per kind + name_key (the first one built wins); never throws */
    async saveAsset(row: any) {
      try {
        const { error } = await admin.from("blocky_worlds_assets").upsert(row, { onConflict: "kind,name_key", ignoreDuplicates: true });
        if (error) { console.log("[blocky-worlds-render] library save skipped:", error.message); return false; }
        return true;
      } catch (e: any) { console.log("[blocky-worlds-render] library save skipped:", e?.message ?? e); return false; }
    },
  };
}

export function supabaseStorage(admin: any) {
  const b = () => admin.storage.from(BUCKET);
  return {
    async signPut(path: string) {
      const { data, error } = await b().createSignedUploadUrl(path, { upsert: true });
      if (error || !data?.signedUrl) throw new Error(`upload URL for ${path}: ${error?.message ?? "none"}`);
      return data.signedUrl as string;
    },
    async signGet(path: string, seconds = 3 * 3600) {
      const { data, error } = await b().createSignedUrl(path, seconds);
      return error || !data?.signedUrl ? null : (data.signedUrl as string);
    },
    async readText(path: string) {
      const { data } = await b().download(path);
      return data ? await data.text() : null;
    },
    async remove(list: string[]) { if (list.length) await b().remove(list); },
  };
}

export function runpodApi(key = RENDER_CONFIG.runpodKey, endpoint = RENDER_CONFIG.endpoint) {
  const rp = async (path: string, init: any = {}) => {
    const r = await fetch(`https://api.runpod.ai/v2/${endpoint}${path}`, { ...init, headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, signal: AbortSignal.timeout(20000) });
    const t = await r.text(); let j: any; try { j = JSON.parse(t); } catch { j = { raw: t }; }
    if (!r.ok) throw new Error(`RunPod ${path}: ${r.status} ${t.slice(0, 200)}`);
    return j;
  };
  return {
    configured: Boolean(key && endpoint),
    run: (body: any) => rp("/run", { method: "POST", body: JSON.stringify(body) }),
    status: async (id: string) => { try { return await rp(`/status/${id}`); } catch { return null; } },
    cancel: async (id: string) => { try { await rp(`/cancel/${id}`, { method: "POST" }); } catch { /* already gone */ } },
  };
}

/**
 * The capability gap log (scripts/blockyWorlds/engine/lib/gaps.js; table from
 * supabase/migrations/20261204100000_blocky_worlds_capability_gaps.sql): the prepare job's "planned" event carries the
 * story director's gaps (the worker has no Supabase key). Inserted once per run (a retried event adds nothing).
 * Bookkeeping: NEVER throws, so a missing table (the migration is not applied yet) or any error never breaks a run.
 */
export async function logCapabilityGaps(admin: any, runId: string, ev: any): Promise<number> {
  try {
    const gaps = Array.isArray(ev?.gaps) ? ev.gaps.slice(0, 200) : [];
    if (!runId || !gaps.length) return 0;
    const table = "blocky_worlds_capability_gaps";
    const { count, error: e1 } = await admin.from(table).select("id", { count: "exact", head: true }).eq("run_id", runId);
    if (e1) { console.log("[blocky-worlds-render] gap log skipped:", e1.message); return 0; }
    if ((count ?? 0) > 0) return 0;
    const s = (v: any, n: number) => String(v ?? "").slice(0, n);
    const source = ev?.director?.provider === "anthropic" ? "anthropic" : "mock";
    const rows = gaps.map((g: any) => ({
      capability: s(g.capability, 60) || "unknown", detail: s(g.detail, 120), item: s(g.item, 60), item_kind: s(g.itemKind, 20), name: s(g.name, 80),
      line: Number.isInteger(g.line) ? g.line : null, line_text: s(g.lineText, 300), story_id: runId, run_id: runId, source, title: null,
    }));
    const { error } = await admin.from(table).insert(rows);
    if (error) { console.log("[blocky-worlds-render] gap log skipped:", error.message); return 0; }
    return rows.length;
  } catch (e: any) { console.log("[blocky-worlds-render] gap log skipped:", e?.message ?? e); return 0; }
}

export function renderRuntime(admin: any) {
  return makeRuntime({ db: supabaseDb(admin), storage: supabaseStorage(admin), runpod: runpodApi(), secret: RENDER_CONFIG.callbackSecret, callbackUrl: RENDER_CONFIG.callbackUrl, production: RENDER_CONFIG.production });
}
