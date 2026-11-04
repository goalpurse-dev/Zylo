// deno-lint-ignore-file no-explicit-any
// Blocky Worlds: the production adapters for renderRuntime.js — Supabase (tables, storage, refund, ledger, alerts) and
// RunPod. Used by blocky-worlds-api (start) and blocky-worlds-render (callbacks + the sweeper).
//
// Function secrets:
//   BLOCKY_WORLDS_RUNPOD_API_KEY (falls back to CUTAWAY_RUNPOD_API_KEY), BLOCKY_WORLDS_RUNPOD_ENDPOINT (zyvo-blocky-render)
//   BLOCKY_WORLDS_CALLBACK_SECRET   signs each run's callback token (any long random string)
//   BLOCKY_WORLDS_CRON_SECRET       the sweeper's header (also the vault secret blocky_worlds_cron_secret)
// The ElevenLabs key is NOT here: it is a RunPod secret in the worker's template (blocky_elevenlabs).
import { makeRuntime } from "./renderRuntime.js";
import { BUCKET } from "./render.js";
import { alertOnce } from "../adminAlert.ts";

const env = (k: string) => (Deno.env.get(k) ?? "").trim();
export const RENDER_CONFIG = {
  runpodKey: env("BLOCKY_WORLDS_RUNPOD_API_KEY") || env("CUTAWAY_RUNPOD_API_KEY"),
  endpoint: env("BLOCKY_WORLDS_RUNPOD_ENDPOINT"),
  callbackSecret: env("BLOCKY_WORLDS_CALLBACK_SECRET"),
  cronSecret: env("BLOCKY_WORLDS_CRON_SECRET"),
  callbackUrl: `${env("SUPABASE_URL")}/functions/v1/blocky-worlds-render`,
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

export function renderRuntime(admin: any) {
  return makeRuntime({ db: supabaseDb(admin), storage: supabaseStorage(admin), runpod: runpodApi(), secret: RENDER_CONFIG.callbackSecret, callbackUrl: RENDER_CONFIG.callbackUrl });
}
