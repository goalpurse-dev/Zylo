// deno-lint-ignore-file no-explicit-any
// Cutaway Explainer: the server side of a run, shared by cutaway-api (start), cutaway-callback (the worker's events and
// the RunPod webhook) and cutaway-watchdog (the cron). orchestrate.js decides; this file carries the actions out:
// dispatching to RunPod or the Fly fallback, refunds (once, in SQL), alerts, the cost ledger, saving new layouts, and the
// page's view of a run (contract.js RunView) with signed URLs.
//
// Secrets (Supabase function secrets; LAUNCH_CHECKLIST.md and the deploy notes list them):
//   CUTAWAY_RUNPOD_API_KEY, CUTAWAY_RUNPOD_ENDPOINT   the production RunPod key and endpoint id
//   CUTAWAY_FLY_API_TOKEN, CUTAWAY_FLY_APP, CUTAWAY_RENDER_IMAGE   the fallback: a token scoped to the app, the pinned digest
//   CUTAWAY_CALLBACK_SECRET                          signs each run's callback token (any long random string)
//   CUTAWAY_ANTHROPIC_API_KEY, CUTAWAY_ELEVENLABS_KEY the production model keys (the kit check here; the Fly machines' env)
import { BUCKET, chunksFor, FRAMES, jobFor, paths, tokenFor } from "./jobs.js";
import { onEvent, onWatch } from "./orchestrate.js";
import { FAILED_MESSAGE } from "./contract.js";
import { costBasisUsd, RUNTIME_RATES } from "./pricing.js";
import { alertOnce } from "../adminAlert.ts";

const env = (k: string) => (Deno.env.get(k) ?? "").trim();
const SUPABASE_URL = env("SUPABASE_URL");
export const CONFIG = {
  runpodKey: env("CUTAWAY_RUNPOD_API_KEY"), endpoint: env("CUTAWAY_RUNPOD_ENDPOINT"),
  // the owner's choice (2026-10-25): the existing model keys are reused; a CUTAWAY_* secret, if ever set, takes over.
  // (Long Form's FLY_API_TOKEN is scoped to zyvo-render: Fly answered 403 for the Cutaway apps, so it isn't reused)
  flyToken: env("CUTAWAY_FLY_API_TOKEN"), flyApp: env("CUTAWAY_FLY_APP") || "zyvo-cutaway-render", image: env("CUTAWAY_RENDER_IMAGE"),
  callbackSecret: env("CUTAWAY_CALLBACK_SECRET"),
  anthropic: env("CUTAWAY_ANTHROPIC_API_KEY") || env("ANTHROPIC_API_KEY"), elevenlabs: env("CUTAWAY_ELEVENLABS_KEY") || env("ELEVENLABS_KEY"),
};
const CALLBACK_URL = `${SUPABASE_URL}/functions/v1/cutaway-callback`;
const DAY = 86400;

// ---------- signed URLs ----------
async function putUrl(admin: any, path: string) {
  const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path, { upsert: true });
  if (error || !data?.signedUrl) throw new Error(`upload URL: ${error?.message ?? "none"}`);
  return data.signedUrl as string;
}
async function getUrl(admin: any, path: string, seconds = 3 * 3600, download?: string) {
  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(path, seconds, download ? { download } : undefined);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl as string;
}
const allUrls = async (admin: any, list: string[], f: (p: string) => Promise<string | null>) => Promise.all(list.map(f));

/** the signed URLs a job of this role needs */
async function urlsFor(admin: any, run: any, role: string, index?: number) {
  const P = paths(run), keys = Object.keys(P.plan);
  const planPut = role === "video" || role === "plan" ? Object.fromEntries(await Promise.all(keys.map(async (k) => [k, await putUrl(admin, (P.plan as any)[k])]))) : null;
  const planGet = run.plan_ready || role === "chunk" || role === "mix" ? Object.fromEntries(await Promise.all(keys.map(async (k) => [k, await getUrl(admin, (P.plan as any)[k])]))) : null;
  const out: any = { planPut, planGet };
  // a retry before the plan was made: the earlier attempt's paid planner replies (null when it kept none)
  if ((role === "video" || role === "plan") && !run.plan_ready && (run.attempt ?? 1) > 1) out.resume = await getUrl(admin, P.plan.steps);
  if (role === "video" || role === "plan") out.frames = await allUrls(admin, P.frames, (p) => putUrl(admin, p));
  if (role === "video" || role === "mix") { out.final = await putUrl(admin, P.final); out.web = await putUrl(admin, P.web); out.poster = await putUrl(admin, P.poster); }
  if (role === "chunk") out.segment = await putUrl(admin, P.chunk(index!));
  if (role === "mix") out.segments = await allUrls(admin, (run.fallback?.chunks ?? []).map((c: any) => P.chunk(c.index)), (p) => getUrl(admin, p));
  return out;
}

/**
 * The parts library (the kit grows by itself): parts designed for earlier videos that passed every check, not retired.
 * The planner is shown the ones whose names match its topic (planner.mjs libraryMatches); the newest 60 go with a job.
 */
async function partsLibrary(admin: any) {
  const { data } = await admin.from("cutaway_parts_library").select("name, synonyms, recipe").is("retired_at", null).order("created_at", { ascending: false }).limit(60);
  return data ?? [];
}

async function approvedLayout(admin: any, run: any) {
  if (!run.layout_key) return null;
  const { data } = await admin.from("cutaway_layouts").select("key, layout, script").eq("key", run.layout_key).eq("approved", true).is("retired_at", null).maybeSingle();
  return data ? { ...data.layout, key: data.key, facts: data.script?.facts ?? data.layout?.facts ?? [], ...(data.script?.sentences ? { approvedScript: { title: data.script.title, hero: data.script.hero, sentences: data.script.sentences, cards: data.script.cards ?? [], parts: data.script.parts ?? [] } } : {}) } : null;
}

// ---------- RunPod ----------
const rp = async (path: string, init: any = {}) => {
  const r = await fetch(`https://api.runpod.ai/v2/${CONFIG.endpoint}${path}`, { ...init, headers: { Authorization: `Bearer ${CONFIG.runpodKey}`, "Content-Type": "application/json" }, signal: AbortSignal.timeout(20000) });
  const t = await r.text(); let j: any; try { j = JSON.parse(t); } catch { j = { raw: t }; }
  if (!r.ok) throw Object.assign(new Error(`RunPod ${path}: ${r.status} ${t.slice(0, 200)}`), { status: r.status });
  return j;
};
export async function runpodStatus(jobId: string) { try { return await rp(`/status/${jobId}`); } catch { return null; } }

async function dispatchRunPod(admin: any, run: any) {
  if (!CONFIG.runpodKey || !CONFIG.endpoint) throw Object.assign(new Error("RunPod is not configured"), { code: "NOT_CONFIGURED" });
  const token = await tokenFor(CONFIG.callbackSecret, run.id);
  const job = jobFor(run, { role: "video", mode: "gpu", urls: await urlsFor(admin, run, "video"), callback: { url: CALLBACK_URL, token }, layout: await approvedLayout(admin, run), library: run.layout_key ? null : await partsLibrary(admin) });
  const res = await rp("/run", { method: "POST", body: JSON.stringify({ input: { job }, webhook: `${CALLBACK_URL}?src=runpod&run=${run.id}&token=${token}`, policy: { executionTimeout: 2700000, ttl: 3600000 } }) });
  return { provider: "runpod", provider_job_id: res.id, dispatched_at: new Date().toISOString() };
}

// ---------- the Fly fallback ----------
const FLY_GUEST: Record<string, any> = { plan: { cpu_kind: "performance", cpus: 4, memory_mb: 8192 }, chunk: { cpu_kind: "performance", cpus: 8, memory_mb: 16384 }, mix: { cpu_kind: "performance", cpus: 4, memory_mb: 8192 } };
async function startFly(run: any, role: string, job: any, name: string) {
  if (!CONFIG.flyToken || !CONFIG.image) throw Object.assign(new Error("the Fly fallback is not configured"), { code: "NOT_CONFIGURED" });
  const res = await fetch(`https://api.machines.dev/v1/apps/${CONFIG.flyApp}/machines`, {
    // (a deploy token is "FlyV1 fm2_...": sent as it is; an older token goes after "Bearer")
    method: "POST", headers: { Authorization: CONFIG.flyToken.startsWith("FlyV1 ") ? CONFIG.flyToken : `Bearer ${CONFIG.flyToken}`, "Content-Type": "application/json" }, signal: AbortSignal.timeout(30000),
    body: JSON.stringify({
      name, region: "fra",
      config: {
        image: CONFIG.image, guest: FLY_GUEST[role], auto_destroy: true, restart: { policy: "no" },
        init: { cmd: ["node", "/app/wt/scripts/cutaway/proto3d/m3/videoJob.mjs"] },
        env: { CUTAWAY_JOB: JSON.stringify(job), ...(role === "plan" ? { ANTHROPIC_API_KEY: CONFIG.anthropic, ELEVENLABS_KEY: CONFIG.elevenlabs } : {}) },
      },
    }),
  });
  if (!res.ok) throw new Error(`Fly machine (${role}) didn't start: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return (await res.json())?.id ?? null;
}
async function dispatchFly(admin: any, run: any, role: string, index?: number) {
  const token = await tokenFor(CONFIG.callbackSecret, run.id), callback = { url: CALLBACK_URL, token };
  if (role === "chunks") {
    const version = run.end_card === false ? "noend" : "end";
    const chunks = chunksFor(Number(run.frames_total) || 1110).map((c) => ({ ...c, done: false }));
    const fb = { ...(run.fallback ?? {}), phase: "chunks", version, chunks };
    await admin.from("cutaway_runs").update({ fallback: fb }).eq("id", run.id);
    const r2 = { ...run, fallback: fb };
    for (const c of chunks) await startFly(r2, "chunk", jobFor(r2, { role: "chunk", mode: "cpu", urls: await urlsFor(admin, r2, "chunk", c.index), callback, chunk: c }), `cutaway-${String(run.id).slice(0, 8)}-c${c.index}-${Date.now().toString(36)}`);
    return {};
  }
  if (role === "chunk") {
    const c = (run.fallback?.chunks ?? []).find((x: any) => x.index === index);
    await startFly(run, "chunk", jobFor(run, { role: "chunk", mode: "cpu", urls: await urlsFor(admin, run, "chunk", index), callback, chunk: c }), `cutaway-${String(run.id).slice(0, 8)}-c${index}-${Date.now().toString(36)}`);
    return {};
  }
  const id = await startFly(run, role, jobFor(run, { role, mode: "cpu", urls: await urlsFor(admin, run, role), callback, layout: role === "plan" ? await approvedLayout(admin, run) : null, library: role === "plan" && !run.layout_key ? await partsLibrary(admin) : null }), `cutaway-${String(run.id).slice(0, 8)}-${role}-${Date.now().toString(36)}`);
  return { provider_job_id: id };
}

// ---------- the actions ----------
async function ledger(admin: any, run: any, costs: any, extra: any = {}) {
  const rows = Object.entries(costs ?? {}).filter(([, v]) => Number(v) > 0).map(([k, v]) => ({ run_id: run.id, user_id: run.user_id, stage: k.replace(/Usd$/, ""), provider: k === "voiceUsd" ? "elevenlabs" : k === "gpuUsd" ? "runpod" : k === "flyUsd" ? "fly" : "anthropic", usd: Number(Number(v).toFixed(6)), units: extra, env: run.env ?? "prod" }));
  if (!rows.length) return 0;
  const { error } = await admin.from("cutaway_cost_ledger").insert(rows);
  if (error) console.error("[cutaway] ledger:", error.message);
  const add = rows.reduce((a, r) => a + r.usd, 0);
  await admin.rpc("cutaway_add_cost", { p_run: run.id, p_usd: add });
  return add;
}

/** the GPU time a RunPod job used, at the tier's rate */
async function gpuUsd(jobId: string | null) {
  if (!jobId) return 0;
  const s = await runpodStatus(jobId);
  return s?.executionTime ? Number(((Number(s.executionTime) / 1000) * RUNTIME_RATES.runpodUsdPerSec).toFixed(6)) : 0;
}

/** is this finished run's layout approved now (its cutaway_layouts row)? null when there is no row or it's not finished */
async function layoutIsApproved(admin: any, run: any): Promise<boolean | null> {
  const key = run.status === "done" ? layoutKeyOf(run) : null;
  if (!key) return null;
  const { data } = await admin.from("cutaway_layouts").select("approved, retired_at").eq("key", key).maybeSingle();
  return data ? Boolean(data.approved && !data.retired_at) : null;
}

/** the cutaway_layouts key of a run's layout: the reused one, else the topic's (a premade topic keeps its premade key) */
export const layoutKeyOf = (run: any): string | null => run.layout_key ?? run.topic_key ?? run.plan_key ?? null;

/** a new layout (a custom topic, or a premade topic made fresh) is kept for the owner to approve; never over an approved one */
async function saveLayout(admin: any, run: any) {
  if (run.layout_key && run.layout_used) return;
  const P = paths(run);
  const read = async (p: string) => { const { data } = await admin.storage.from(BUCKET).download(p); return data ? JSON.parse(await data.text()) : null; };
  const layout = await read(P.plan.layout), script = await read(P.plan.script);
  if (!layout) return;
  const key = layoutKeyOf(run) ?? layout.key;
  const { data: cur } = await admin.from("cutaway_layouts").select("approved").eq("key", key).maybeSingle();
  if (cur?.approved) return;
  await admin.from("cutaway_layouts").upsert({ key, topic: run.topic, layout, script, approved: false, source_run: run.id, updated_at: new Date().toISOString() });
}

export async function applyActions(admin: any, run: any, actions: any[]) {
  let patch: any = {};
  for (const a of actions) {
    try {
      if (a.type === "ledger") await ledger(admin, run, a.costs, { role: a.role, attempt: a.attempt });
      else if (a.type === "refund") { const { error } = await admin.rpc("cutaway_refund", { p_run: run.id }); if (error) console.error("[cutaway] refund failed, needs a manual refund:", run.id, error.message); await ledger(admin, run, { gpuUsd: await gpuUsd(run.provider === "runpod" ? run.provider_job_id : null) }); }
      else if (a.type === "alert") await alertOnce(admin, a.key, 3600, a.subject, a.text);
      else if (a.type === "cancel" && a.jobId) await rp(`/cancel/${a.jobId}`, { method: "POST" }).catch(() => null);
      else if (a.type === "settle") await ledger(admin, run, { gpuUsd: await gpuUsd(run.provider === "runpod" ? run.provider_job_id : null), flyUsd: run.provider === "fly" ? Number((((a.seconds ?? 0) + 60) * RUNTIME_RATES.flyUsdPerSec).toFixed(6)) : 0 });
      else if (a.type === "saveLayout") await saveLayout(admin, run);
      else if (a.type === "verifyDone") {
        // RunPod says done but the worker's own "done" never arrived: the video in storage settles it
        const P = paths(run), dirOf = P.final.slice(0, P.final.lastIndexOf("/"));
        const { data } = await admin.storage.from(BUCKET).list(dirOf, { search: "final.mp4" });
        if ((data ?? []).some((f: any) => f.name === "final.mp4")) Object.assign(patch, (await advance(admin, run, { event: "done", attempt: run.attempt, files: null })).patch ?? {});
      } else if (a.type === "dispatch") {
        const p = a.target === "runpod" ? await dispatchRunPod(admin, { ...run, ...patch }) : await dispatchFly(admin, { ...run, ...patch }, a.role, a.index);
        patch = { ...patch, ...p };
      }
    } catch (e: any) {
      console.error(`[cutaway] action ${a.type} failed:`, e?.message ?? e);
      if (a.type === "dispatch") {
        // nowhere to send it: the next step of the path (or the end, refunded)
        const r = await advance(admin, { ...run, ...patch }, { event: "failed", attempt: run.attempt, code: a.target === "runpod" ? "NO_GPU_SLOT" : "FALLBACK_FAILED", retryable: a.target === "runpod", message: String(e?.message ?? e) });
        patch = { ...patch, ...(r.patch ?? {}) };
      }
    }
  }
  if (Object.keys(patch).length) await admin.from("cutaway_runs").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", run.id);
  return patch;
}

/** one event on a run: decide (orchestrate.js), save the patch, carry out the actions */
/**
 * The kit grows by itself (the owner, 2026-10-26): a video that passed every check and finished saves the parts its plan
 * designed (kind "rig", with a name) to the parts library, unless a part of that name is already there. The next video
 * that needs one is shown it and reuses it for free. Never throws: a video is done whatever happens here.
 */
export async function saveDesignedParts(admin: any, run: any) {
  try {
    const { data: file } = await admin.storage.from(BUCKET).download(paths(run).plan.layout);
    if (!file) return 0;
    const layout = JSON.parse(await file.text());
    let saved = 0;
    for (const p of (layout.parts ?? []).filter((q: any) => q.kind === "rig" && typeof q.params?.name === "string" && q.params.name.trim())) {
      const name = p.params.name.trim().toLowerCase().slice(0, 60);
      const { data: have } = await admin.from("cutaway_parts_library").select("id").eq("name", name).is("retired_at", null).maybeSingle();
      if (have) { await admin.rpc("cutaway_part_used", { p_name: name }); continue; }
      // the recipe as reusable: its own place and turn are the next video's
      const { pos, rotY, scale, ...recipe } = p.params;
      const { error } = await admin.from("cutaway_parts_library").insert({ name, synonyms: (Array.isArray(p.params.synonyms) ? p.params.synonyms : []).map(String).slice(0, 12), recipe, source_run: run.id, topic: run.topic });
      if (!error) saved++;
    }
    return saved;
  } catch (e) {
    console.error("[cutaway] designed parts not saved:", e instanceof Error ? e.message : e);
    return 0;
  }
}

export async function advance(admin: any, run: any, ev: any): Promise<any> {
  const r = onEvent(run, ev);
  if (Object.keys(r.patch).length) await admin.from("cutaway_runs").update({ ...r.patch, updated_at: new Date().toISOString() }).eq("id", run.id);
  const next = { ...run, ...r.patch };
  if (next.status === "done" && run.status !== "done") await saveDesignedParts(admin, next);
  const more = await applyActions(admin, next, r.actions);
  return { patch: { ...r.patch, ...more } };
}

/** the watchdog's look at one run */
export async function watch(admin: any, run: any) {
  const st = run.provider === "runpod" && run.provider_job_id ? await runpodStatus(run.provider_job_id) : null;
  const r = onWatch(run, st);
  if (Object.keys(r.patch).length) await admin.from("cutaway_runs").update({ ...r.patch, watched_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", run.id);
  else await admin.from("cutaway_runs").update({ watched_at: new Date().toISOString() }).eq("id", run.id);
  return applyActions(admin, { ...run, ...r.patch }, r.actions);
}

/** start a new run's video on RunPod (the API's start); a run that can't be sent anywhere is refunded */
export async function dispatchNew(admin: any, run: any) {
  return applyActions(admin, run, [{ type: "dispatch", target: "runpod", role: "video" }]);
}

// ---------- the page's view of a run (contract.js RunView) ----------
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
export async function viewOf(admin: any, run: any, { owner = false } = {}) {
  const P = paths(run), done = run.status === "done";
  const n = Math.min(FRAMES, Number(run.preview_frames) || 0);
  const frames = n ? (await allUrls(admin, P.frames.slice(0, n), (p) => getUrl(admin, p, 3600))).filter(Boolean) : [];
  const slug = String(run.title ?? run.topic).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "cutaway";
  return {
    id: run.id, topic: run.topic, title: run.title ?? run.topic, lengthSec: run.length_sec, kind: run.kind, credits: run.credits_charged,
    // the finished video's real length (a "30 s" video runs about 36 s with its end card)
    durationSec: Number(run.files?.durationSec) || null,
    createdAt: run.created_at, doneAt: run.finished_at ?? null,
    status: run.status, step: run.status, stepAt: Date.parse(run.stage_at ?? run.created_at), renderPct: done ? 100 : run.status === "render" ? Number(run.pct) || 0 : 0,
    narration: run.narration ?? "", parts: run.parts ?? [], frames, framesShown: done ? frames.length : run.status === "render" ? Math.floor(((Number(run.pct) || 0) / 100) * frames.length) : 0,
    facts: (run.facts ?? []).filter((f: any) => f?.verdict !== "drop").map((f: any) => ({ claim: f.claim, sources: (f.sources ?? []).map((s: any) => ({ label: String(s.title ?? "").slice(0, 40) || host(s.url), url: s.url })) })),
    post: run.post ?? null,
    finalUrl: done ? await getUrl(admin, P.web, 7 * DAY) : null, // the light web copy plays; the download is the full file
    downloadUrl: done ? await getUrl(admin, P.final, 7 * DAY, `${slug}.mp4`) : null,
    poster: done ? await getUrl(admin, P.poster, 7 * DAY) : null,
    endCard: run.end_card !== false,
    error: run.status === "failed" ? FAILED_MESSAGE : null,
    refunded: Boolean(run.refunded_at), creditsRefunded: run.credits_refunded ?? 0,
    // approved: made from an approved layout (a premade topic), or its own layout approved since (on this run or another)
    owner, layoutApproved: owner ? (run.layout_used ? true : (await layoutIsApproved(admin, run)) ?? run.layout_approved ?? null) : null,
    // the owner only: why a run failed (customers see the friendly message)
    debug: owner && run.status === "failed" ? { step: run.stage ?? null, code: run.error_code ?? null, message: run.error_message ?? null, attempt: run.attempt ?? 1, provider: run.provider ?? null, at: run.finished_at ?? null } : null,
  };
}

/** what a video of this kind and length is expected to cost us (the caps check it before charging) */
export const expectedUsd = (kind: string, lengthSec: number) => costBasisUsd(kind, lengthSec);
