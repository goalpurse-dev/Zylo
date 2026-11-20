// THE ZYVO CONNECTOR's worker jobs (zyvo_studio_jobs: voice, finish), taken by the Studio worker when no video run is
// waiting (worker.mjs). One at a time; a failure refunds once (zyvo_mcp_refund: the credits, or the free finish back).
//   voice   the project's script -> the SAME voice as In This Town videos (steps.voice: Scruffy Duck on eleven_v3,
//           1.25x, the pause cuts) -> voice.mp3 + words.json in the zyvo-studio bucket
//   finish  (the voice first when the project has none) -> studioFinish.mjs -> final, no-music copy, web, poster
// Real costs are logged into blocky_worlds_ai_calls (purpose 'studio'): the $25 alert and the $50 pause count them.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { restClient } from "./rest.mjs";
import { finishStudio, FinishRefused } from "./studioFinish.mjs";

const UUID = "[0-9a-f-]{36}";
const OWN = new RegExp(`^${UUID}/${UUID}/[A-Za-z0-9._-]+$`, "i");

export function restStudio({ url, key, fetchFn = fetch, now = () => Date.now() }) {
  const call = restClient({ url, key, fetchFn });
  const big = restClient({ url, key, fetchFn, timeoutMs: 600_000 });
  const iso = () => new Date(now()).toISOString();
  const id = (v) => encodeURIComponent(String(v));
  const enc = (p) => p.split("/").map(encodeURIComponent).join("/");
  return {
    async claim(workerId) { const r = await call("POST", "/rest/v1/rpc/zyvo_studio_claim_job", { p_worker: workerId }); return Array.isArray(r) ? r[0] ?? null : null; },
    async sweep() { return Number(await call("POST", "/rest/v1/rpc/zyvo_studio_sweep", {}).catch(() => 0)) || 0; },
    async update(jobId, patch, worker) {
      const rows = await call("PATCH", `/rest/v1/zyvo_studio_jobs?id=eq.${id(jobId)}&status=eq.running${worker ? `&worker_id=eq.${id(worker)}` : ""}&select=id`, { ...patch, heartbeat_at: iso() }, { Prefer: "return=representation" });
      return Array.isArray(rows) && rows.length > 0;
    },
    async refund(jobId, why) { return Number(await call("POST", "/rest/v1/rpc/zyvo_mcp_refund", { p_job: jobId, p_why: why })) || 0; },
    async project(projectId, userId) { return (await call("GET", `/rest/v1/zyvo_studio_projects?id=eq.${id(projectId)}&user_id=eq.${id(userId)}&deleted_at=is.null&select=*`))?.[0] ?? null; },
    async saveProject(projectId, userId, patch) { await call("PATCH", `/rest/v1/zyvo_studio_projects?id=eq.${id(projectId)}&user_id=eq.${id(userId)}`, { ...patch, updated_at: iso() }, { Prefer: "return=minimal" }); },
    async cost(userId, usd, provider = "anthropic") { if (usd > 0) await call("POST", "/rest/v1/blocky_worlds_ai_calls", { user_id: userId, purpose: "studio", provider, usd: +usd.toFixed(6), ok: true }, { Prefer: "return=minimal" }).catch(() => {}); },
    async upload(p, file, type) {
      if (!OWN.test(p)) throw new Error(`refusing an upload outside a user's project folder: ${p}`);
      await big("POST", `/storage/v1/object/zyvo-studio/${enc(p)}`, Buffer.isBuffer(file) ? file : fs.readFileSync(file), { "Content-Type": type, "x-upsert": "true" });
      return p;
    },
    async download(p, to) {
      if (!OWN.test(p)) throw new Error(`refusing a download outside a user's project folder: ${p}`);
      const res = await fetchFn(`${String(url).replace(/\/$/, "")}/storage/v1/object/authenticated/zyvo-studio/${enc(p)}`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(600_000) });
      if (!res.ok) throw new Error(`storage download ${res.status}`);
      fs.writeFileSync(to, Buffer.from(await res.arrayBuffer()));
      return to;
    },
    async remove(paths) { if (paths.length) await call("DELETE", "/storage/v1/object/zyvo-studio", { prefixes: paths.filter((p) => OWN.test(p)) }).catch(() => {}); },
    /** recordings older than 7 days: deleted (the plan's upload rule) */
    async oldRecordings(days = 7) { return (await call("GET", `/rest/v1/zyvo_studio_projects?recording->>uploaded_at=lt.${id(new Date(now() - days * 86400_000).toISOString())}&select=id,user_id,recording&limit=100`)) ?? []; },
  };
}

/** a cheap gate before an expensive step: the job is still ours and still running (a sweep may have failed it) */
async function stillOurs(db, job, workerId, patch) {
  if (!(await db.update(job.id, patch, workerId))) throw Object.assign(new Error("the job was stopped elsewhere (swept or cancelled)"), { code: "STOPPED" });
}

async function makeVoice({ job, project, db, steps, makeLedger, dir, workerId }) {
  await stillOurs(db, job, workerId, { stage: "voice", pct: 10 });
  const vdir = path.join(dir, "voice");
  fs.mkdirSync(vdir, { recursive: true });
  const L = makeLedger(path.join(dir, "ledger"), { capUsd: 1.5, agentCapUsd: 0.2 });
  const v = await steps.voice({ script: { lines: project.script.lines }, dir: vdir, L });
  const mp3 = path.join(vdir, "voice_final.mp3");
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", v.wav, "-c:a", "libmp3lame", "-b:a", "192k", mp3]);
  const words = v.words.map((w) => ({ word: w.word, start: w.start, end: w.end }));
  const tag = job.id.slice(0, 8);
  const voice = {
    mp3: await db.upload(`${job.user_id}/${project.id}/voice-${tag}.mp3`, mp3, "audio/mpeg"),
    words: await db.upload(`${job.user_id}/${project.id}/words-${tag}.json`, Buffer.from(JSON.stringify(words)), "application/json"),
    seconds: +Number(v.duration).toFixed(2), made_at: new Date().toISOString(),
  };
  await db.saveProject(project.id, job.user_id, { voice });
  const usd = Number(L.costs?.voice ?? 0) || +(v.chars * 0.44 * 0.0002).toFixed(4);
  await db.cost(job.user_id, usd, "elevenlabs");
  return { voice, words, wav: v.wav, mp3, usd };
}

/**
 * runStudioJob(job, { db, steps, makeLedger, workDir, workerId, anthropicKey, log }) -> { ok, code?, usd }
 * Never throws: every failure is written to the job and refunded once.
 */
export async function runStudioJob(job, deps) {
  const { db, workDir, workerId, log = () => {} } = deps;
  const dir = path.join(workDir, `studio-${job.id}`);
  fs.mkdirSync(dir, { recursive: true });
  let usd = 0;
  const beat = setInterval(() => { db.update(job.id, {}, workerId).catch(() => {}); }, 30_000);
  try {
    const project = await db.project(job.project_id, job.user_id);
    if (!project) throw new FinishRefused("NOT_FOUND", "The project was removed.");
    if (job.kind === "voice") {
      const v = await makeVoice({ job, project, dir, ...deps });
      usd += v.usd;
      await db.update(job.id, { status: "done", stage: "done", pct: 100, output: { seconds: v.voice.seconds, words: v.words.length }, cost_usd: usd, finished_at: new Date().toISOString() }, workerId);
      return { ok: true, usd };
    }
    // finish: the voice first when the project has none (the price included it)
    let voice = project.voice;
    let words;
    if (!voice?.mp3) {
      const v = await makeVoice({ job, project, dir, ...deps });
      usd += v.usd; voice = v.voice; words = v.words;
    }
    await stillOurs(db, job, workerId, { stage: "download", pct: 8 });
    const ext = path.extname(job.input?.recording ?? project.recording?.path ?? ".mp4") || ".mp4";
    const rec = await db.download(job.input?.recording ?? project.recording.path, path.join(dir, `recording${ext}`));
    const mp3 = await db.download(voice.mp3, path.join(dir, "voice.mp3"));
    if (!words) words = JSON.parse(fs.readFileSync(await db.download(voice.words, path.join(dir, "words.json")), "utf8"));
    const out = await finishStudio({
      recording: rec, voiceMp3: mp3, words, lines: project.script.lines, shots: Array.isArray(project.shot_plan?.shots) ? project.shot_plan.shots : [],
      dir: path.join(dir, "finish"), anthropicKey: deps.anthropicKey, log,
      // the end card (Free / Starter, decided by the connector when the user paid; older jobs: none)
      endCard: job.input?.end_card === true,
      stage: (stage, pct) => stillOurs(db, job, workerId, { stage, pct }),
    });
    usd += out.costUsd;
    await db.cost(job.user_id, out.costUsd);
    await stillOurs(db, job, workerId, { stage: "uploading", pct: 95 });
    const tag = job.id.slice(0, 8), at = (n) => `${job.user_id}/${project.id}/${n}-${tag}`;
    const files = {
      final: await db.upload(`${at("final")}.mp4`, out.files.final, "video/mp4"),
      noMusic: await db.upload(`${at("final_nomusic")}.mp4`, out.files.noMusic, "video/mp4"),
      web: await db.upload(`${at("web")}.mp4`, out.files.web, "video/mp4"),
      poster: await db.upload(`${at("poster")}.jpg`, out.files.poster, "image/jpeg"),
    };
    await db.saveProject(project.id, job.user_id, { final: { ...files, seconds: out.seconds, made_at: new Date().toISOString(), notes: out.notes } });
    await db.update(job.id, { status: "done", stage: "done", pct: 100, output: { ...files, seconds: out.seconds, notes: out.notes, stats: out.stats }, cost_usd: +usd.toFixed(5), finished_at: new Date().toISOString() }, workerId);
    return { ok: true, usd };
  } catch (e) {
    const refused = e instanceof FinishRefused;
    const code = refused ? e.code : e?.code === "STOPPED" ? "STOPPED" : e?.code === "VOICE_CUT" ? "VOICE_CUT" : "FAILED";
    const message = refused ? e.message
      : code === "VOICE_CUT" ? "The voice came out cut off at the end twice, so we didn't hand it over. Your credits were given back. Try again in a few minutes."
      : "It didn't work on our side. Your credits were given back.";
    log(`studio job ${job.id} (${job.kind}) failed ${code}: ${String(e?.message ?? e).slice(0, 400)}`);
    if (code !== "STOPPED") {
      await db.update(job.id, { status: "failed", stage: "failed", error_code: code, error_message: message, cost_usd: +usd.toFixed(5), finished_at: new Date().toISOString() }, workerId).catch(() => {});
      await db.refund(job.id, code).catch((err) => log(`REFUND FAILED for job ${job.id}, refund by hand: ${err?.message ?? err}`));
    }
    return { ok: false, code, usd };
  } finally {
    clearInterval(beat);
    if (!deps.keepWork) fs.rmSync(dir, { recursive: true, force: true });
  }
}
