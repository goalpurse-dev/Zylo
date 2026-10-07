// deno-lint-ignore-file no-explicit-any
// long-form-render/index.ts — Phase 6f. The Publish page's render.
//   start    (user)  — lock the NEWEST saved edit version, compile it (the
//                      render EDL v2, full-res masters for the crop), queue ONE
//                      job per project (a second click is a no-op), start a
//                      worker: a Fly machine (RENDER_MODE=fly) or a local
//                      worker polling the queue (the fallback). Free: the
//                      credits were reserved at the start and settle at the
//                      first successful render (finish-long-form-render).
//   status   (user)  — server-driven progress %, stage, ETA range, elapsed on
//                      the server clock, "your edits aren't in this video yet",
//                      the preview (640x360) as a signed URL for the player.
//   download (user)  — a fresh signed URL for the FULL video (re-signed per click).
//   watchdog (cron)  — a queued job with no machine, a job the worker put back
//                      after a temporary error, or a stale heartbeat gets a NEW
//                      machine (the claim RPC resumes it). A render that failed
//                      for good is started again by itself (stickman/renderRetry.ts).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encodeHex } from "jsr:@std/encoding@1/hex";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";
import { compileEdit, musicVolumeExpr } from "../_shared/stickman/editRender.ts";
import { flattenWords, validateEdit } from "../../../src/lib/stickmanEdit.js";
import { logEvent } from "../_shared/systemLog.ts";
import { chunkPieces } from "../_shared/stickman/renderChunks.ts";
import { fillCenterFlatness } from "../_shared/stickman/flatness.ts";
import { ensureEdit } from "../_shared/stickman/editDoc.ts";
import { fileSlug } from "../../../src/lib/publishText.js";
import { chargeAddon, refundAddon, render1440Credits } from "../_shared/stickman/addons.ts";
import { tierOf } from "../_shared/stickman/scenes.ts";
import { decideRenderRestart, decideRenderWatch, RENDER_FIXING_COPY, RENDER_RESTART_WINDOW_S, RESTART_REFUSED, STALE_S } from "../_shared/stickman/renderRetry.ts";
import { alertAdmin } from "../_shared/adminAlert.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SECRET = Deno.env.get("LONG_FORM_AUTOPILOT_SECRET") ?? "";
const RENDER_MODE = (Deno.env.get("RENDER_MODE") ?? "local").toLowerCase(); // "fly" | "local"
const FLY_API_TOKEN = Deno.env.get("FLY_API_TOKEN") ?? "";
const FLY_APP = Deno.env.get("FLY_RENDER_APP") ?? "zyvo-render";
const FLY_IMAGE = Deno.env.get("FLY_RENDER_IMAGE") ?? `registry.fly.io/${FLY_APP}:latest`;
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const BUCKET = "long-form-renders";
// Parallel render: up to N machines each render a chunk of the timeline (same total CPU).
const RENDER_PARALLEL = Math.max(1, Math.min(4, Number(Deno.env.get("RENDER_PARALLEL") ?? "4")));
const PARALLEL_MIN_FRAMES = 30 * 180; // under 3 minutes: one machine is fine


export const RESOLUTIONS: Record<string, { width: number; height: number }> = { "1080p": { width: 1920, height: 1080 }, "1440p": { width: 2560, height: 1440 } };
// The project's render tier (V2/V3/V4), for add-on prices.
async function projectTier(projectId: string) {
  const { data } = await admin.from("long_form_generation_profiles").select("render_tier").eq("project_id", projectId).eq("status", "active").maybeSingle();
  return tierOf(data?.render_tier);
}

// fly.toml's [env] only applies to `fly deploy` machines, not Machines API ones: the same values here.
const FLY_WORKER_ENV = { WORK_DIR: "/tmp/render", RENDER_HOST: "fly", RENDER_MACHINE: "performance-8x", CONCURRENCY: "7", CRF: "23", MACHINE_USD_PER_SECOND: "0.0000957" };

// One performance-8x machine per job; it renders, uploads, calls finish and exits (auto-destroy).
async function startMachine(jobId: string): Promise<{ ok: boolean; machineId?: string; reason?: string }> {
  if (RENDER_MODE !== "fly") return { ok: true, reason: "local worker" };
  if (!FLY_API_TOKEN) return { ok: false, reason: "FLY_API_TOKEN missing" };
  const r = await fetch(`https://api.machines.dev/v1/apps/${FLY_APP}/machines`, {
    method: "POST", headers: { Authorization: `Bearer ${FLY_API_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: `render-${jobId.slice(0, 8)}-${Date.now().toString(36)}`, config: { image: FLY_IMAGE, guest: { cpu_kind: "performance", cpus: 8, memory_mb: 16384 }, auto_destroy: true, restart: { policy: "no" }, env: { RENDER_JOB_HINT: jobId, ...FLY_WORKER_ENV } } }),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) return { ok: false, reason: `fly ${r.status}: ${JSON.stringify(j).slice(0, 160)}` };
  return { ok: true, machineId: j.id };
}

// Progress: drawing 0-8 %, segments 8-90 %, finishing/uploading 90-99 %.
function progressOf(job: any) {
  if (job.status === "done") return 100;
  if (job.status !== "rendering") return 0;
  const seg = job.segments_total ? job.segments_done / job.segments_total : 0;
  if (job.stage === "drawing") return 4;
  if (job.stage === "finishing") return 92;
  if (job.stage === "uploading") return 97;
  return Math.round(8 + seg * 82);
}
function etaOf(job: any, durationMs: number, nowMs: number) {
  if (job.status === "done" || job.status === "failed") return null;
  const started = job.started_at ? Date.parse(job.started_at) : null;
  const p = progressOf(job) / 100;
  if (started && p > 0.12) { const el = (nowMs - started) / 1000; const rest = (el / p) * (1 - p); return [Math.round(rest * 0.8), Math.round(rest * 1.3) + 20]; }
  // Before it runs: ~0.6-1.4x the video's length on an 8-CPU machine, plus a machine start.
  const d = durationMs / 1000;
  return [Math.round(d * 0.6) + 45, Math.round(d * 1.4) + 120];
}

async function jobView(job: any, projectId: string) {
  // A parallel render's parent: its chunks' progress, as one render.
  if (job.chunk_count > 0 && (job.status === "waiting" || job.status === "queued")) {
    const { data: chunks } = await admin.from("long_form_render_jobs").select("status, stage, segments_done, segments_total, started_at, heartbeat_at").eq("parent_job_id", job.id);
    const cs = chunks ?? [];
    const tot = cs.reduce((a: number, c: any) => a + Number(c.segments_total ?? 0), 0), done = cs.reduce((a: number, c: any) => a + (c.status === "done" ? Number(c.segments_total ?? 0) : Number(c.segments_done ?? 0)), 0);
    const started = cs.map((c: any) => c.started_at).filter(Boolean).sort()[0] ?? null;
    job = { ...job, status: cs.some((c: any) => c.status === "rendering" || c.status === "done") || job.status === "queued" ? "rendering" : "queued", stage: job.status === "queued" ? "finishing" : cs.some((c: any) => c.stage === "drawing") ? "drawing" : "rendering", segments_done: done, segments_total: tot || 1, started_at: job.started_at ?? started, heartbeat_at: cs.map((c: any) => c.heartbeat_at).filter(Boolean).sort().at(-1) ?? null };
  }
  const { data: latest } = await admin.from("long_form_edits").select("version").eq("project_id", projectId).order("version", { ascending: false }).limit(1).maybeSingle();
  const now = Date.now();
  const proxy = job.status === "done" && job.proxy_path ? await admin.storage.from(BUCKET).createSignedUrl(job.proxy_path, 3600) : null;
  // The in-page player plays the FULL render (faststart MP4, starts at once); the 360p proxy is only its fallback.
  const full = job.status === "done" && job.output_path ? await admin.storage.from(BUCKET).createSignedUrl(job.output_path, 3600) : null;
  const stale = job.status === "rendering" && job.heartbeat_at && now - Date.parse(job.heartbeat_at) > STALE_S * 1000;
  return {
    id: job.id, status: job.status, stage: job.stage, resolution: job.resolution, editVersion: job.edit_version, latestEditVersion: latest?.version ?? null,
    outdated: job.status === "done" && latest?.version != null && job.edit_version != null && latest.version > job.edit_version,
    progress: progressOf(job), etaSeconds: etaOf(job, job.edl?.audio?.durationMs ?? 0, now),
    elapsedSeconds: job.started_at ? Math.round(((job.finished_at ? Date.parse(job.finished_at) : now) - Date.parse(job.started_at)) / 1000) : 0,
    queuedSeconds: Math.round((now - Date.parse(job.created_at)) / 1000), stale,
    previewUrl: proxy?.data?.signedUrl ?? null, videoUrl: full?.data?.signedUrl ?? null, durationMs: job.duration_ms, sizeBytes: job.size_bytes,
    reason: job.status === "failed" ? job.user_reason ?? "The video couldn't be rendered." : null, createdAt: job.created_at, finishedAt: job.finished_at,
    // We failed it (not the user): it is being looked at and starts again by itself.
    fixing: job.status === "failed" && job.user_reason === RENDER_FIXING_COPY,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "");

  // ---------------- fly_health (internal, $0) ----------------
  // The real path, nothing rendered: the stored token creates a TINY machine
  // from the pushed image that only prints `node --version` (never the worker,
  // so it can't claim a job), we wait for it to stop, then destroy it.
  if (action === "fly_health") {
    if (!SECRET || req.headers.get("x-autopilot-secret") !== SECRET) return err(req, "Unauthorized", 401);
    if (!FLY_API_TOKEN) return ok(req, { ok: false, step: "token", reason: "FLY_API_TOKEN missing" });
    const api = (path: string, init: any = {}) => fetch(`https://api.machines.dev/v1/apps/${FLY_APP}${path}`, { ...init, headers: { Authorization: `Bearer ${FLY_API_TOKEN}`, "Content-Type": "application/json" } });
    const t0 = Date.now();
    const app = await api("");
    if (!app.ok) return ok(req, { ok: false, step: "app", status: app.status, body: (await app.text()).slice(0, 300) });
    // The machine's exit code says whether the app secrets reached it (lengths only, never values):
    // bit 1 = SUPABASE_URL missing, bit 2 = SUPABASE_SERVICE_ROLE_KEY missing,
    // bit 4 = the worker's own createClient throws (e.g. Node without WebSocket).
    const probe = "const u=(process.env.SUPABASE_URL||'').length,k=(process.env.SUPABASE_SERVICE_ROLE_KEY||'').length;console.log('node '+process.version+' secret lengths url='+u+' key='+k);import('@supabase/supabase-js').then(m=>{m.createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});return 0},e=>{console.log('client: '+e.message);return 4}).catch(e=>{console.log('client: '+e.message);return 4}).then(c=>process.exit((u>10?0:1)|(k>20?0:2)|c))";
    const created = await api("/machines", { method: "POST", body: JSON.stringify({ name: `health-${Date.now().toString(36)}`, config: { image: FLY_IMAGE, guest: body?.perf ? { cpu_kind: "performance", cpus: 8, memory_mb: 16384 } : { cpu_kind: "shared", cpus: 1, memory_mb: 256 }, auto_destroy: false, restart: { policy: "no" }, ...(body?.env ? { env: body.env } : {}), init: { cmd: ["node", "-e", probe] } } }) });
    const cj: any = await created.json().catch(() => ({}));
    if (!created.ok) return ok(req, { ok: false, step: "create", status: created.status, body: JSON.stringify(cj).slice(0, 400) });
    const waited = await api(`/machines/${cj.id}/wait?state=stopped&timeout=60`);
    const info: any = await (await api(`/machines/${cj.id}`)).json().catch(() => ({}));
    const exit = (info.events ?? []).find((e: any) => e.type === "exit")?.request?.exit_event?.exit_code ?? null;
    const del = await api(`/machines/${cj.id}?force=true`, { method: "DELETE" });
    const secrets = exit == null ? "unknown" : { SUPABASE_URL: (exit & 1) === 0, SUPABASE_SERVICE_ROLE_KEY: (exit & 2) === 0, workerClientBoots: (exit & 4) === 0 };
    return ok(req, { ok: exit === 0, image: FLY_IMAGE, machineId: cj.id, region: cj.region, createdMs: Date.now() - t0, stoppedOk: waited.ok, exitCode: exit, secrets, destroyStatus: del.status, renderParallel: RENDER_PARALLEL });
  }

  // ---------------- watchdog (cron) ----------------
  if (action === "watchdog") {
    if (!SECRET || req.headers.get("x-autopilot-secret") !== SECRET) return err(req, "Unauthorized", 401);
    const now = Date.now();
    const { data: jobs } = await admin.from("long_form_render_jobs").select("id, status, heartbeat_at, dispatched_at, created_at, updated_at, attempt, max_attempts, machine_id, parent_job_id, error_code").in("status", ["queued", "rendering"]);
    const out = [];
    const finish = (jobId: string, errorCode: string) => fetch(`${SUPABASE_URL}/functions/v1/finish-long-form-render`, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ jobId, outcome: "failed", terminal: true, errorCode }) }).then((r) => r.body?.cancel()).catch((e) => console.error("[render watchdog] finish", String(e)));
    for (const j of jobs ?? []) {
      const d = decideRenderWatch(j as any, now);
      if (d.kind === "none") continue;
      if (d.kind === "fail") {
        // No machine can finish it (it never booted, or it died on its last attempt). finish-long-form-render
        // does the rest: the project's status, the owner's alert, the 1440p refund, the plain words for the user.
        if (j.parent_job_id) {
          // A chunk: its parallel render can't finish, so the whole render fails (the chunks still queued too).
          const gone = { status: "failed", error_code: d.code, finished_at: new Date().toISOString(), updated_at: new Date().toISOString() };
          await admin.from("long_form_render_jobs").update(gone).eq("id", j.id).in("status", ["queued", "rendering"]);
          await admin.from("long_form_render_jobs").update(gone).eq("parent_job_id", j.parent_job_id).eq("status", "queued");
        }
        await logEvent("long-form-render", "error", d.code === "WORKER_BOOT_FAILED" ? "render_boot_failed" : "render_attempts_exhausted", { jobId: j.id, parentJobId: j.parent_job_id ?? null, machineId: j.machine_id, attempt: j.attempt });
        await finish(j.parent_job_id ?? j.id, d.code);
        out.push({ jobId: j.id, failed: d.code });
        continue;
      }
      const m = await startMachine(j.id);
      await admin.from("long_form_render_jobs").update({ dispatched_at: new Date().toISOString(), machine_id: m.machineId ?? null, ...(d.errorCode ? { error_code: d.errorCode } : {}) }).eq("id", j.id);
      await logEvent("long-form-render", "warn", "render_watchdog_dispatch", { jobId: j.id, status: j.status, why: d.why, attempt: j.attempt, ok: m.ok, reason: m.reason });
      out.push({ jobId: j.id, why: d.why, ...m });
    }

    // A render that failed for good starts again by itself (after 10 minutes, then after an hour).
    const restarted = [];
    const since = new Date(now - RENDER_RESTART_WINDOW_S * 1000).toISOString();
    const { data: failed } = await admin.from("long_form_render_jobs").select("id, project_id, finished_at, created_at, user_reason, error_code").eq("status", "failed").is("parent_job_id", null).gte("finished_at", since).order("created_at", { ascending: false }).limit(200);
    const byProject = new Map<string, any[]>();
    for (const f of failed ?? []) byProject.set(f.project_id, [...(byProject.get(f.project_id) ?? []), f]);
    for (const [projectId, list] of byProject) {
      const { data: newest } = await admin.from("long_form_render_jobs").select("id, status").eq("project_id", projectId).is("parent_job_id", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!newest || newest.id !== list[0].id) continue; // a newer render exists (running, done, or the user's own retry)
      // A job the claim RPC failed on its own (attempts used up) never went through finish: same handling now.
      if (list[0].user_reason !== RENDER_FIXING_COPY && list[0].error_code === "ATTEMPTS_EXHAUSTED") {
        await admin.from("long_form_render_jobs").update({ status: "rendering", finished_at: null }).eq("id", list[0].id).eq("status", "failed");
        await finish(list[0].id, "ATTEMPTS_EXHAUSTED");
        continue;
      }
      if (list[0].user_reason !== RENDER_FIXING_COPY) continue; // failed before this rule: left as it was
      if (String(list[0].error_code ?? "").startsWith(RESTART_REFUSED)) continue; // tried, could not start: it waits for a person
      const r = decideRenderRestart(list.length, list[0].finished_at, now);
      if (r.kind !== "restart") continue;
      // A project whose credits were given back is not rendered for free.
      const { data: hold } = await admin.from("long_form_project_reservations").select("status").eq("project_id", projectId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (hold?.status === "released") continue;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/long-form-render`, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", "x-autopilot-secret": SECRET }, body: JSON.stringify({ action: "start", projectId }) }).catch(() => null);
      const started = !!res?.ok;
      const said = started ? "" : (await res?.text().catch(() => "") ?? "").slice(0, 200);
      if (started) await res?.body?.cancel();
      else {
        // Never a restart attempt every minute: marked once, and the owner is told.
        await admin.from("long_form_render_jobs").update({ error_code: `${RESTART_REFUSED}${String(list[0].error_code ?? "")}`.slice(0, 120) }).eq("id", list[0].id);
        await alertAdmin("Zyvo: a failed render could not be restarted — needs you", `Project: ${projectId}\nFailed job: ${list[0].id}\nThe automatic restart was refused (${res?.status ?? "no answer"}): ${said}\n\nThe user still sees: "${RENDER_FIXING_COPY}"`, "render");
      }
      await logEvent("long-form-render", started ? "warn" : "error", "render_auto_restart", { projectId, afterJobId: list[0].id, number: r.number, started, status: res?.status ?? null });
      restarted.push({ projectId, number: r.number, started });
    }
    return ok(req, { ok: true, dispatched: out, restarted });
  }

  // "start" may also come from our own side (the autopilot secret or the service
  // key): the render is started for the project's owner, always the included
  // 1080p (never the paid 1440p add-on). Every other action needs the user.
  const trusted = (!!SECRET && req.headers.get("x-autopilot-secret") === SECRET) || req.headers.get("authorization") === `Bearer ${SERVICE_KEY}`;
  const internal = trusted && action === "start";
  const auth = internal ? { user: null as any, authError: null } : await requireUser(req);
  let user: any = auth.user;
  if (!user && !internal) return err(req, auth.authError || "Unauthorized", 401);

  // ---------------- list_done (Creations): the user's finished long-form videos ----------------
  if (action === "list_done") {
    const { data: projects } = await admin.from("long_form_projects").select("id, selected_title, topic").eq("user_id", user.id);
    const ids = (projects ?? []).map((p: any) => p.id);
    if (!ids.length) return ok(req, { ok: true, videos: [] });
    const { data: jobs } = await admin.from("long_form_render_jobs").select("id, project_id, output_path, proxy_path, resolution, duration_ms, finished_at, edit_version").in("project_id", ids).is("parent_job_id", null).eq("status", "done").order("finished_at", { ascending: false }).limit(30);
    const seen = new Set<string>();
    const videos = [];
    for (const j of jobs ?? []) {
      const key = `${j.project_id}|${j.resolution}`; // the newest per project and resolution
      if (seen.has(key)) continue;
      seen.add(key);
      const p: any = (projects ?? []).find((x: any) => x.id === j.project_id);
      const [full, proxy] = await Promise.all([admin.storage.from(BUCKET).createSignedUrl(j.output_path, 3600), j.proxy_path ? admin.storage.from(BUCKET).createSignedUrl(j.proxy_path, 3600) : Promise.resolve({ data: null })]);
      videos.push({ id: j.id, projectId: j.project_id, title: p?.selected_title ?? p?.topic ?? "Long-form video", resolution: j.resolution, durationMs: j.duration_ms, finishedAt: j.finished_at, videoUrl: full.data?.signedUrl ?? null, previewUrl: (proxy as any).data?.signedUrl ?? null });
    }
    return ok(req, { ok: true, videos });
  }

  const projectId = String(body?.projectId ?? "").trim();
  if (!projectId || !["start", "status", "download"].includes(action)) return err(req, "Bad request", 400);
  const { data: project } = await admin.from("long_form_projects").select("id, user_id, selected_title, autopilot").eq("id", projectId).maybeSingle();
  if (!project || (!internal && project.user_id !== user.id)) return err(req, "Project not found", 404);
  if (internal) user = { id: project.user_id };
  const { data: job } = await admin.from("long_form_render_jobs").select("*").eq("project_id", projectId).is("parent_job_id", null).order("created_at", { ascending: false }).limit(1).maybeSingle();

  if (action === "status") {
    // The last successful render stays watchable while a re-render runs.
    const { data: lastDone } = job && job.status !== "done" ? await admin.from("long_form_render_jobs").select("*").eq("project_id", projectId).is("parent_job_id", null).eq("status", "done").order("created_at", { ascending: false }).limit(1).maybeSingle() : { data: null };
    // The newest finished render per resolution for the CURRENT edit version (1080p + 1440p side by side).
    const { data: latestEdit } = await admin.from("long_form_edits").select("version").eq("project_id", projectId).order("version", { ascending: false }).limit(1).maybeSingle();
    const doneByRes: Record<string, any> = {};
    if (latestEdit?.version != null) {
      const { data: dones } = await admin.from("long_form_render_jobs").select("*").eq("project_id", projectId).is("parent_job_id", null).eq("status", "done").eq("edit_version", latestEdit.version).order("created_at", { ascending: false });
      for (const d of dones ?? []) if (!doneByRes[d.resolution]) doneByRes[d.resolution] = await jobView(d, projectId);
    }
    // The "Make 1440p version" price (free on V4), from the finished video's length.
    const lengthMs = doneByRes["1080p"]?.durationMs ?? job?.edl?.audio?.durationMs ?? 0;
    const price1440 = render1440Credits(await projectTier(projectId), lengthMs);
    return ok(req, { ok: true, job: job ? await jobView(job, projectId) : null, lastDone: lastDone ? await jobView(lastDone, projectId) : null, doneByRes, price1440 });
  }

  if (action === "download") {
    const id = String(body?.jobId ?? job?.id ?? "");
    const { data: j } = await admin.from("long_form_render_jobs").select("id, project_id, status, output_path, resolution").eq("id", id).maybeSingle();
    if (!j || j.project_id !== projectId || j.status !== "done" || !j.output_path) return err(req, "This video isn't ready yet.", 409);
    // A short slug from the YouTube title (else the project title): "how-did-ancient-humans-actually-hunt-1080p.mp4".
    const { data: meta } = await admin.from("long_form_publish_meta").select("title").eq("project_id", projectId).maybeSingle();
    const name = `${fileSlug(meta?.title ?? project.selected_title ?? "zyvo-video")}-${j.resolution}.mp4`;
    const signed = await admin.storage.from(BUCKET).createSignedUrl(j.output_path, 600, { download: name });
    if (signed.error) return err(req, "Couldn't prepare the download.", 500);
    return ok(req, { ok: true, url: signed.data.signedUrl, fileName: name });
  }

  // ---------------- start ----------------
  if (job && ["queued", "rendering", "waiting"].includes(job.status)) return ok(req, { ok: true, alreadyRunning: true, job: await jobView(job, projectId) });
  const resolution = !internal && RESOLUTIONS[String(body?.resolution ?? "1080p")] ? String(body?.resolution ?? "1080p") : "1080p";
  // No editor visit needed: the edit is created from the current scenes when
  // there is none, and its clips are put on the scenes' current pictures (a
  // scene redrawn since the last edit) before anything is rendered.
  const ensured = await ensureEdit(admin, project, { createdBy: user.id, source: "long-form-render" });
  if (!ensured.ok) return err(req, ensured.message, ensured.status);
  const edit = { version: ensured.version, doc: ensured.doc };
  // Publish autopilot: render only if this edit version has no render yet (never a duplicate).
  if (body?.ifMissing === true) {
    const { data: has } = await admin.from("long_form_render_jobs").select("*").eq("project_id", projectId).is("parent_job_id", null).eq("edit_version", edit.version).in("status", ["queued", "rendering", "waiting", "done"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (has) return ok(req, { ok: true, exists: true, job: await jobView(has, projectId) });
  }
  const doc = edit.doc;
  const errors = validateEdit(doc);
  if (errors.length) return err(req, "This edit has a problem to fix first.", 422, { errors: errors.slice(0, 5) });
  // 2026-10-07: a render is never refused for a scene's picture. A split half that
  // has no picture of its own yet keeps showing the one it was split from; a scene
  // that could not be drawn is already covered in the edit (stickmanEdit.js).
  const { data: narr } = await admin.from("long_form_narration_audio_versions").select("narration").eq("id", doc.audio.narrationId).maybeSingle();
  const words = flattenWords(narr?.narration ?? []);
  await fillCenterFlatness(doc.clips); // an edit saved before this existed
  const edl: any = compileEdit(doc, words);
  const size = RESOLUTIONS[resolution];
  edl.width = size.width; edl.height = size.height; edl.resolution = resolution;
  // Full-res masters for the crop (never upsampled); the worker reads their size.
  const ids = [...new Set(edl.clips.map((c: any) => c.sceneId).filter(Boolean))];
  const { data: scenes } = ids.length ? await admin.from("long_form_scene_images").select("id, image_url, master_url, status, beat_sequence").in("id", ids) : { data: [] };
  // Every clip carries its own picture (validateEdit). A clip whose scene row has
  // since failed or gone renders with that picture; only its full-res master is skipped.
  const usable = (scenes ?? []).filter((s: any) => s.image_url && s.status === "ready");
  const coveredNow = (doc.clips ?? []).filter((c: any) => c.covered).length;
  const stale = ids.length - usable.length;
  if (coveredNow || stale > 0) await logEvent("long-form-render", "warn", "render_with_covered_scenes", { projectId, covered: coveredNow, clipsWithoutACurrentScene: Math.max(0, stale) });
  const masterOf = new Map(usable.map((s: any) => [s.id, s.master_url ?? null]));
  // (the worker falls back to the 1920x1080 picture if a master can't be fetched)
  for (const c of edl.clips) { const m = c.sceneId ? masterOf.get(c.sceneId) : null; if (m) c.masterImage = m; }
  if (edl.music) edl.musicVolumeExpr = musicVolumeExpr(edl.music);
  if (body?.dryRun === true) return ok(req, { ok: true, dryRun: true, editVersion: edit.version, resolution, pieces: edl.pieces.length, overlays: Object.keys(edl.overlays).length, totalFrames: edl.totalFrames, masters: edl.clips.filter((c: any) => c.masterImage).length, clips: edl.clips.length });
  const edlJson = JSON.stringify(edl);
  const sha = encodeHex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(edlJson))));
  const ranges = edl.totalFrames >= PARALLEL_MIN_FRAMES && RENDER_PARALLEL > 1 ? chunkPieces(edl.pieces, RENDER_PARALLEL) : [];
  const parallel = ranges.length > 1;
  // Phase 7: the 1440p version is a paid add-on (V2/V3: 2 credits/min, min 10; free on V4),
  // charged now from the balance, refunded if the job can't start or the render fails.
  const addonCredits = resolution === "1440p" ? render1440Credits(await projectTier(projectId), doc.audio?.durationMs ?? 0) : 0;
  const charge = await chargeAddon(admin, user.id, addonCredits, "render_1440p", logEvent, { projectId });
  if (!charge.ok) return err(req, charge.message, charge.status, { credits: addonCredits });
  const { data: row, error } = await admin.from("long_form_render_jobs").insert({ project_id: projectId, status: parallel ? "waiting" : "queued", edl, edl_sha256: sha, inputs_prefix: `${projectId}/edit-v${edit.version}`, edit_version: edit.version, resolution, stage: "queued", chunk_count: parallel ? ranges.length : 0, addon_credits: addonCredits }).select("*").single();
  if (error) {
    await refundAddon(admin, user.id, addonCredits, "render_1440p_not_started", logEvent, { projectId });
    if (/duplicate|one_live/.test(error.message)) { const { data: live } = await admin.from("long_form_render_jobs").select("*").eq("project_id", projectId).in("status", ["queued", "rendering"]).maybeSingle(); return ok(req, { ok: true, alreadyRunning: true, job: live ? await jobView(live, projectId) : null }); }
    return err(req, "Couldn't start the render.", 500);
  }
  await admin.from("long_form_projects").update({ current_render_job_id: row.id, status_reason: null }).eq("id", projectId);
  let m: any = { ok: true };
  if (parallel) {
    // One chunk job + one machine per range; the machine that finishes last joins them.
    const { data: chunks, error: chunkErr } = await admin.from("long_form_render_jobs").insert(ranges.map(([from, to], i) => ({ project_id: projectId, parent_job_id: row.id, chunk_index: i, chunk_count: ranges.length, piece_from: from, piece_to: to, status: "queued", edl, edl_sha256: sha, inputs_prefix: `${projectId}/${row.id}/chunk-${i}`, edit_version: edit.version, resolution, stage: "queued" }))).select("id");
    if (chunkErr) { await admin.from("long_form_render_jobs").update({ status: "failed", error_code: "CHUNKS", user_reason: "Couldn't start the render." }).eq("id", row.id); return err(req, "Couldn't start the render.", 500); }
    const started = await Promise.all((chunks ?? []).map(async (c: any) => { const r = await startMachine(c.id); await admin.from("long_form_render_jobs").update({ dispatched_at: new Date().toISOString(), machine_id: r.machineId ?? null }).eq("id", c.id); return r; }));
    m = { ok: started.every((x) => x.ok), machines: started.map((x) => x.machineId ?? null), reason: started.find((x) => !x.ok)?.reason ?? null };
    await admin.from("long_form_render_jobs").update({ dispatched_at: new Date().toISOString() }).eq("id", row.id);
  } else {
    m = await startMachine(row.id);
    await admin.from("long_form_render_jobs").update({ dispatched_at: new Date().toISOString(), machine_id: m.machineId ?? null }).eq("id", row.id);
  }
  await logEvent("long-form-render", m.ok ? "info" : "warn", "render_queued", { projectId, jobId: row.id, editVersion: edit.version, resolution, mode: RENDER_MODE, chunks: parallel ? ranges.length : 1, machines: m.machines ?? m.machineId ?? null, reason: m.reason ?? null });
  return ok(req, { ok: true, job: await jobView(row, projectId) });
});
