// THE ZYVO CONNECTOR: the site's own calls (tryzyvo.com, the user's normal login; never an MCP token).
//   GET  /account/studio            the Studio projects tab: every project card, the balance, the free finish
//                                   (?peek=1: only { open }, for the links on other pages)
//   POST /account/studio/voice      Create voice   { id, credits }   the click IS the yes: the price the card showed
//   POST /account/studio/finish     Finish video   { id, credits }   must still be the price (else PRICE_CHANGED)
//   POST /account/studio/upload     { id, format, bytes }  a signed upload link for the recording (the browser PUTs it)
//   POST /account/studio/uploaded   { id }  the upload landed: it becomes the project's recording
//   POST /account/studio/remove     { id }  hides a project (never while its voice / finish is being made)
//   POST /account/kit               the free kit's zip: a 10-minute link, each download counted
// The paid clicks go through the SAME tool code as Claude's calls (tools.js: limits, cap check, safety check, the
// one-transaction start, refunds): the site asks for the price, compares it with the one the card showed, and only
// then uses the confirm token itself. No second money path.
import { FINISH_CREDITS, KIT, LIMITS, OAUTH, secondsOfScript, UPLOAD, voiceCredits } from "./config.js";
import { randomToken } from "./crypto.js";
import { statusOf } from "./tools.js";

const UUID = /^[0-9a-f-]{36}$/i;
const json = (status, body) => ({ status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body });
const refuse = (status, code, message, extra = {}) => json(status, { error: code, message, ...extra });

/** a job as the card shows it */
function jobCard(j) {
  if (!j) return null;
  return {
    id: j.id, kind: j.kind, status: j.status, stage: j.stage ?? null, pct: j.pct ?? 0, free: Boolean(j.free), credits: j.credits_charged ?? 0,
    refunded: Boolean(j.refunded_at), error: j.status === "failed" ? j.error_message ?? "It didn't work. Your credits were given back." : null,
    createdAt: j.created_at, finishedAt: j.finished_at ?? null,
  };
}

export function makeSite({ store, storage, user, allowed, tools, now = () => Date.now() }) {
  const day = () => new Date(now() - 86400_000).toISOString();
  const ctx = (userId) => ({ userId, clientId: "site", scopes: [...OAUTH.scopes] });
  async function own(userId, id) {
    if (!UUID.test(String(id ?? ""))) return null;
    return await store.getProject(userId, String(id));
  }
  async function freeFinish(userId, u) {
    return Boolean(u.emailConfirmed) && !(await store.freeFinishUsed(userId)) && (await store.freeFinishesToday(day())) < LIMITS.freeFinishPerDay;
  }

  /** one card: what the project has, what it costs next, its latest job (signed links for an hour) */
  function card(p, job, links, freeLeft) {
    const status = statusOf(p);
    const sec = secondsOfScript(p.script?.lines);
    const link = (path) => (path ? links.get(path) ?? null : null);
    const busy = job && (job.status === "queued" || job.status === "running") ? job : null;
    return {
      id: p.id, kitProjectId: p.kit_project_id, title: p.title, status, createdAt: p.created_at, updatedAt: p.updated_at,
      kitVersion: p.kit_version ?? null,
      lines: (p.script?.lines ?? []).map((l) => ({ text: l.text, ...(l.speaker ? { speaker: l.speaker } : {}) })),
      estimatedSeconds: sec,
      shots: Array.isArray(p.shot_plan?.shots) ? p.shot_plan.shots.length : 0,
      voice: p.voice?.mp3 ? { seconds: p.voice.seconds ?? null, madeAt: p.voice.made_at ?? null, mp3: link(p.voice.mp3), words: link(p.voice.words) } : null,
      recording: p.recording?.path ? { bytes: p.recording.bytes ?? null, uploadedAt: p.recording.uploaded_at ?? null } : null,
      final: p.final?.final ? { seconds: p.final.seconds ?? null, madeAt: p.final.made_at ?? null, video: link(p.final.web) ?? link(p.final.final), download: link(p.final.final), noMusic: link(p.final.noMusic), poster: link(p.final.poster), notes: (p.final.notes ?? []).slice(0, 6) } : null,
      prices: {
        voice: voiceCredits(sec),
        finish: FINISH_CREDITS + (p.voice?.mp3 ? 0 : voiceCredits(sec)),
        finishFree: freeLeft,
      },
      job: jobCard(job), busy: Boolean(busy),
    };
  }

  /** a paid click: the tool's own price first; it must be the price the card showed; then the tool's own start */
  async function paidClick(userId, tool, projectId, expect) {
    const c = ctx(userId);
    const q = await tools.call(c, tool, { project_id: projectId });
    const sc = q?.structuredContent ?? {};
    if (q?.isError) return refuse(sc.error === "NOT_FOUND" ? 404 : 409, sc.error ?? "ERROR", sc.message ?? "That didn't work. Nothing was charged.", sc.retry_after_sec ? { retryAfterSec: sc.retry_after_sec } : {});
    if (sc.step === "upload") return refuse(409, "NEED_UPLOAD", "Upload the recording first.");
    if (!sc.confirm_token) return refuse(500, "SERVER", "Something went wrong on our side. Nothing was charged.");
    if (Number(expect) !== Number(sc.price_credits)) return refuse(409, "PRICE_CHANGED", sc.free ? "This one is free now. Press the button again." : `The price is now ${sc.price_credits} credits. Press the button again to pay that.`, { credits: sc.price_credits, free: Boolean(sc.free) });
    if (!sc.enough) return refuse(402, "CREDITS", `You need ${sc.price_credits} credits. Nothing was charged.`, { credits: sc.price_credits, balance: sc.balance });
    const r = await tools.call(c, tool, { project_id: projectId, confirm_token: sc.confirm_token });
    const out = r?.structuredContent ?? {};
    if (r?.isError) return refuse(out.error === "CREDITS" ? 402 : 409, out.error ?? "ERROR", out.message ?? "That didn't work. Nothing was charged.", out.credits ? { credits: out.credits } : {});
    return json(200, { ok: true, job: { id: out.job_id, kind: out.kind, status: out.status, stage: out.stage, pct: out.pct, free: out.free, credits: out.credits } });
  }

  return {
    async studio(u, query = {}) {
      const open = await allowed(u.id);
      // ?peek=1: only "is it open for me" (the In This Town header asks once per session)
      if (query.peek) return json(200, { open });
      const me = await user(u.id);
      if (!open) return json(200, { open: false, balance: me.balance ?? 0, projects: [] });
      const [projects, jobs] = await Promise.all([store.listProjects(u.id, 50), store.listJobs(u.id, 100)]);
      const latest = new Map();
      for (const j of jobs) if (j.project_id && (j.kind === "voice" || j.kind === "finish") && !latest.has(j.project_id)) latest.set(j.project_id, j);
      // a stuck job is failed + refunded before anyone sees it spinning for ever
      for (const [pid, j] of latest) latest.set(pid, await store.sweepJob(j));
      const paths = [];
      for (const p of projects) {
        if (p.voice?.mp3) paths.push(p.voice.mp3, p.voice.words);
        if (p.final?.final) paths.push(p.final.final, p.final.noMusic, p.final.web, p.final.poster);
      }
      const links = await storage.signDownloads(paths.filter(Boolean));
      const freeLeft = await freeFinish(u.id, me);
      return json(200, { open: true, balance: me.balance ?? 0, freeFinish: freeLeft, projects: projects.map((p) => card(p, latest.get(p.id), links, freeLeft)) });
    },

    async voice(u, body) {
      if (!(await allowed(u.id))) return refuse(403, "NOT_OPEN", "Studio projects aren't open for this account yet.");
      const p = await own(u.id, body?.id);
      if (!p) return refuse(404, "NOT_FOUND", "No such project on this account.");
      return await paidClick(u.id, "make_voice", p.id, body?.credits);
    },

    async finish(u, body) {
      if (!(await allowed(u.id))) return refuse(403, "NOT_OPEN", "Studio projects aren't open for this account yet.");
      const p = await own(u.id, body?.id);
      if (!p) return refuse(404, "NOT_FOUND", "No such project on this account.");
      if (!p.recording?.path) return refuse(409, "NEED_UPLOAD", "Upload the recording first.");
      return await paidClick(u.id, "finish_my_video", p.id, body?.credits);
    },

    async upload(u, body) {
      if (!(await allowed(u.id))) return refuse(403, "NOT_OPEN", "Studio projects aren't open for this account yet.");
      const p = await own(u.id, body?.id);
      if (!p) return refuse(404, "NOT_FOUND", "No such project on this account.");
      if (await store.activeJob(u.id, p.id, ["voice", "finish"])) return refuse(409, "BUSY", "Wait until the voice or finish being made is done.");
      const ext = UPLOAD.types[body?.format] ? body.format : null;
      if (!ext) return refuse(400, "BAD_INPUT", "Upload an mp4, mov or webm file.");
      if (Number(body?.bytes) > UPLOAD.maxBytes) return refuse(400, "TOO_BIG", "The recording is over 500 MB. Record a shorter take or a lower bitrate.");
      const path = `${u.id}/${p.id}/recording-${randomToken("", 9)}.${ext}`;
      const up = await storage.signUpload(path);
      await store.updateProject(u.id, p.id, { upload: { path, ext, created_at: new Date(now()).toISOString() } });
      return json(200, { url: up.url, method: "PUT", contentType: UPLOAD.types[ext], maxBytes: UPLOAD.maxBytes });
    },

    async uploaded(u, body) {
      const p = await own(u.id, body?.id);
      if (!p) return refuse(404, "NOT_FOUND", "No such project on this account.");
      const got = p.upload?.path ? await storage.exists(p.upload.path) : null;
      if (!got) return refuse(409, "NOT_UPLOADED", "We don't see the file yet. Try the upload again.");
      if (got.bytes > UPLOAD.maxBytes) { await storage.remove([p.upload.path]); await store.updateProject(u.id, p.id, { upload: null }); return refuse(400, "TOO_BIG", "The recording is over 500 MB. Record a shorter take or a lower bitrate."); }
      const old = p.recording?.path && p.recording.path !== p.upload.path ? p.recording.path : null;
      await store.updateProject(u.id, p.id, { recording: { path: p.upload.path, bytes: got.bytes, uploaded_at: new Date(now()).toISOString() }, upload: null });
      if (old) await storage.remove([old]);
      return json(200, { ok: true });
    },

    async remove(u, body) {
      const p = await own(u.id, body?.id);
      if (!p) return refuse(404, "NOT_FOUND", "No such project on this account.");
      if (await store.activeJob(u.id, p.id, ["voice", "finish"])) return refuse(409, "BUSY", "Wait until the voice or finish being made is done.");
      await store.updateProject(u.id, p.id, { deleted_at: new Date(now()).toISOString() });
      return json(200, { ok: true });
    },

    /** the free kit: signed-in users only, each download counted (owner 2026-11-19) */
    async kit(u) {
      if (!(await allowed(u.id))) return refuse(403, "NOT_OPEN", "The Studio kit isn't open for this account yet.");
      const url = await storage.signDownload(KIT.path, KIT.fileName, KIT.linkTtlSec);
      if (!url) return refuse(503, "NOT_READY", "The kit download isn't ready yet. Try again in a few minutes.");
      await store.logKitDownload({ user_id: u.id, version: KIT.version }).catch(() => {});
      return json(200, { url, version: KIT.version, fileName: KIT.fileName });
    },
  };
}
