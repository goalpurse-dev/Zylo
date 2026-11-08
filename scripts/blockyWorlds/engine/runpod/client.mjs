// Blocky Worlds: the laptop's side of the RunPod still jobs (dev/runpodStills.mjs, runpod/stillRendererRunpod.mjs).
// Keys come from C:\Users\Public\Zylo\.env.local only when a job is really sent (never at import, never printed):
// RUNPOD_API_KEY (+ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY for the storage test folder). Endpoint: runpod/endpoint.json.
//   const c = rpClient()                       c.submit(input) -> id; c.wait(id, { maxSec, pollMs }) -> status
//   const s = storage(env, prefix)             s.put / s.signGet / s.signPut / s.get / s.cleanup (bucket "generated",
//                                              only under blocky-worlds-test/)
//   billed(status) -> { seconds, usd }         delayTime + executionTime (an upper bound: delay holds queue time too)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
// the 16 GB tier (RTX A4000 / 4000 Ada / A4500 / 2000 Ada), per second (dispatch.mjs RATE)
export const RATE = 0.58 / 3600;
// per job: a cold start (FlashBoot: a few s; a fresh worker ~15 s) + the GPU check (~3 s) + the page load (~10 s);
// per still ~0.4 s (540x960; the laptop's 0.25 s/frame at 1080p / 3.7)
export const EST = { coldS: 15, gpuS: 3, loadS: 10, perStillS: 0.4, objectLoadS: 6, perObjectS: 1.5 };
export const estimate = ({ jobs = 1, stills = 0, objects = 0 }) => {
  const s = jobs * (EST.coldS + EST.gpuS) + (stills ? jobs * EST.loadS + stills * EST.perStillS : 0) + (objects ? jobs * EST.objectLoadS + objects * EST.perObjectS : 0);
  return { seconds: +s.toFixed(0), usd: +(s * RATE).toFixed(4) };
};

export function loadEnv(file = "C:/Users/Public/Zylo/.env.local") {
  return Object.fromEntries(fs.readFileSync(file, "utf8").split(/\r?\n/).map((l) => l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]));
}
export const endpointInfo = () => JSON.parse(fs.readFileSync(path.join(here, "endpoint.json"), "utf8"));

export function billed(st) {
  const seconds = ((st?.executionTime ?? 0) + (st?.delayTime ?? 0)) / 1000;
  return { seconds: +seconds.toFixed(1), usd: +(seconds * RATE).toFixed(5) };
}

/** RunPod's serverless API for the Blocky endpoint; fetchFn for the tests */
export function rpClient({ key = null, endpointId = null, fetchFn = fetch } = {}) {
  let k = key, ep = endpointId;
  const ensure = () => { k ??= loadEnv().RUNPOD_API_KEY; ep ??= endpointInfo().endpointId; if (!k) throw new Error("RUNPOD_API_KEY missing in .env.local"); };
  const call = async (p, init = {}) => { ensure(); const r = await fetchFn(`https://api.runpod.ai/v2/${ep}${p}`, { ...init, headers: { Authorization: `Bearer ${k}`, "Content-Type": "application/json" } }); const t = await r.text(); try { return JSON.parse(t); } catch { return { error: t.slice(0, 300), httpStatus: r.status }; } };
  return {
    async submit(input, { policy = null } = {}) { const r = await call("/run", { method: "POST", body: JSON.stringify({ input, ...(policy ? { policy } : {}) }) }); if (!r.id) throw new Error(`RunPod refused the job: ${JSON.stringify(r).slice(0, 300)}`); return r.id; },
    status: (id) => call(`/status/${id}`),
    cancel: (id) => call(`/cancel/${id}`, { method: "POST" }),
    /** polls until a final state; over maxSec the job is cancelled (the worst case stays bounded) */
    async wait(id, { maxSec = 600, pollMs = 1500, onStatus = null } = {}) {
      const t0 = Date.now();
      for (;;) {
        const st = await call(`/status/${id}`);
        onStatus?.(st);
        if (["COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"].includes(st.status)) return st;
        if (Date.now() - t0 > maxSec * 1000) { await call(`/cancel/${id}`, { method: "POST" }); return { ...st, status: "TIMED_OUT", error: `over ${maxSec} s: cancelled` }; }
        await new Promise((s) => setTimeout(s, pollMs));
      }
    },
  };
}

/** the private test folder in the "generated" bucket (dispatch.mjs's way); every path stays under blocky-worlds-test/ */
export function storage(env, prefix, { fetchFn = fetch } = {}) {
  if (!prefix.startsWith("blocky-worlds-test/")) throw new Error("the stills test folder must be under blocky-worlds-test/");
  for (const k of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) if (!env[k]) throw new Error(`missing ${k} in .env.local`);
  const BUCKET = "generated";
  const sb = (p, init = {}) => fetchFn(`${env.SUPABASE_URL}/storage/v1${p}`, { ...init, headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, apikey: env.SUPABASE_SERVICE_ROLE_KEY, ...(init.headers ?? {}) } });
  return {
    prefix,
    async put(name, body, type) { const r = await sb(`/object/${BUCKET}/${prefix}/${name}`, { method: "POST", headers: { "Content-Type": type, "x-upsert": "true" }, body }); if (!r.ok) throw new Error(`upload ${name}: ${r.status} ${(await r.text()).slice(0, 200)}`); },
    async signGet(name, expiresIn = 7200) { const r = await sb(`/object/sign/${BUCKET}/${prefix}/${name}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expiresIn }) }); const j = await r.json(); if (!r.ok) throw new Error(`sign ${name}: ${r.status}`); return `${env.SUPABASE_URL}/storage/v1${j.signedURL}`; },
    async signPut(name) { const r = await sb(`/object/upload/sign/${BUCKET}/${prefix}/${name}`, { method: "POST", headers: { "Content-Type": "application/json", "x-upsert": "true" }, body: "{}" }); const j = await r.json(); if (!r.ok) throw new Error(`sign upload ${name}: ${r.status}`); return `${env.SUPABASE_URL}/storage/v1${j.url}`; },
    async get(name) { const r = await sb(`/object/${BUCKET}/${prefix}/${name}`); if (!r.ok) return null; return Buffer.from(await r.arrayBuffer()); },
    async cleanup() {
      // the list API shows one level: a folder (id null) is listed again (the stills sit in j0/, j1/, ...)
      const listAll = async (p, depth = 0) => {
        const list = await (await sb(`/object/list/${BUCKET}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prefix: `${p}/`, limit: 1000 }) })).json();
        const out = [];
        for (const f of Array.isArray(list) ? list : []) {
          if (f.id == null && depth < 4) out.push(...(await listAll(`${p}/${f.name}`, depth + 1)));
          else if (f.id != null) out.push(`${p}/${f.name}`);
        }
        return out;
      };
      const files = (await listAll(prefix)).filter((f) => f.startsWith("blocky-worlds-test/"));
      if (files.length) await sb(`/object/${BUCKET}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prefixes: files }) });
      return files.length;
    },
  };
}

/** spend log next to the outputs (as dispatch.mjs) */
export function logSpend(dir, label, b) {
  try { fs.mkdirSync(dir, { recursive: true }); fs.appendFileSync(path.join(dir, "spend.jsonl"), JSON.stringify({ at: new Date().toISOString(), label, seconds: b.seconds, costUsd: b.usd }) + "\n"); } catch { /* bookkeeping */ }
}
