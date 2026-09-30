// The AI Fruit Story v2 worker: submits paid Runware jobs, takes results
// (webhook or poll), stores media permanently, completes scenes, retries
// provider hiccups and refunds anything that finally fails. Idempotent: every
// transition is a conditional update, so duplicate webhooks, overlapping cron
// runs and retried requests can't double-submit, double-complete or
// double-refund.
//
// Dependencies are injected so node tests can replay recorded responses:
//   store   database operations (see supabaseStore.js; tests use a memory store)
//   runware { submit(envelope) -> {httpStatus, body}, poll(taskUUID) -> {httpStatus, body} }
//           Either may throw on network errors / timeouts.
//   media   { store({url, path, contentType}) -> publicUrl }
//   env     { FRUIT_PAID_CALLS, webhookBase, webhookSecret }
import { buildEnvelope, parseRunware, redactEnvelope, webhookToken } from "./runware.js";
import { MESSAGES } from "./errors.js";
import { SERVER_LIMITS } from "./limits.js";

export const TIMING = Object.freeze({
  leaseSec: 90,                         // a claimed job not acknowledged by then is polled
  retryDelaysSec: [20, 60, 180],        // after a retryable provider error, by attempt
  pollAfterSec: { image: 45, clip: 90 },
  // No result this long after submit: ask Runware directly. Lost (Runware has no
  // task) → sent again once; still rendering → keep waiting (a resend would pay
  // twice and start from zero) until giveUpAfterSec, then refund.
  stallCheckSec: { image: 120, clip: 240 },
  giveUpAfterSec: { image: 8 * 60, clip: 12 * 60 },
  storeGiveUpSec: 15 * 60,              // provider result we can't store (URL expires)
});

const failCode = (kind, cls) => cls.providerBalance ? "PROVIDER_UNAVAILABLE" : cls.contentPolicy
  ? (kind === "clip" ? "CLIP_BLOCKED" : "IMAGE_FAILED")
  : cls.retryable ? "PROVIDER_BUSY" : (kind === "clip" ? "CLIP_FAILED" : "IMAGE_FAILED");

const ageSec = (now, iso) => (iso ? (now.getTime() - new Date(iso).getTime()) / 1000 : Infinity);

//   rewriteClip (optional) async (job) -> new request | null   one content-policy rewrite for clips
//   fallbackClip (optional) (request) -> fallback request | null   e.g. clips.js#fallbackClipTask
//   onProviderBalance (optional) async ({job, code, message}) -> void   admin alert (alerts.js)
export function createEngine({ store, runware, media, env, rewriteClip = null, fallbackClip = null, onProviderBalance = null, now = () => new Date(), uuid = () => crypto.randomUUID(), log = console }) {
  const paidOff = String(env.FRUIT_PAID_CALLS ?? "").toLowerCase() === "off";

  async function webhookFor(taskUUID) {
    if (!env.webhookBase || !env.webhookSecret) return null;
    const t = await webhookToken(env.webhookSecret, taskUUID);
    return `${env.webhookBase}?action=webhook&t=${t}`;
  }

  async function fail(job, cls, { cost = 0, code, message } = {}) {
    // Our provider account is out of balance: refund now (no retries, no
    // fallback on the same account), tell the admin; the user retries later.
    if (cls.providerBalance) {
      await store.refundJob(job.id, "PROVIDER_UNAVAILABLE", MESSAGES.PROVIDER_UNAVAILABLE, cost);
      if (onProviderBalance) await onProviderBalance({ job, code, message }).catch((e) => log.error?.("[fruit] alert hook failed:", e?.message ?? e));
      return "refunded";
    }
    // A clip refused by the content filter gets ONE safe rewrite (the exact line kept), then fails.
    if (cls.contentPolicy && job.kind === "clip" && rewriteClip && !(await store.wasRewritten(job.id))) {
      const next = await rewriteClip(job);
      if (next && (await store.replaceRequest(job.id, job.task_uuid, next, cost))) return "rewritten";
    }
    const retryable = cls.retryable && !cls.contentPolicy;
    if (retryable && job.attempt < job.max_attempts) {
      const delay = TIMING.retryDelaysSec[Math.min(job.attempt - 1, TIMING.retryDelaysSec.length - 1)];
      await store.requeueJob(job.id, job.task_uuid, delay, `${code ?? "error"}: ${message ?? ""}`.slice(0, 500), cost);
      return "requeued";
    }
    // Giving up on this model: a clip gets one re-send on its tier's fallback model
    // (V2: Wan2.6 Flash -> Seedance 2.0 Mini). The fallback request has no fallback, so this can't loop.
    const fallback = job.kind === "clip" && fallbackClip ? fallbackClip(job.request) : null;
    if (fallback && (await store.replaceRequest(job.id, job.task_uuid, fallback, cost, `fallback after ${code ?? "error"}: ${message ?? ""}`.slice(0, 500)))) {
      return "fallback";
    }
    const finalCode = failCode(job.kind, cls);
    await store.refundJob(job.id, finalCode, MESSAGES[finalCode], cost);
    return "refunded";
  }

  /** Sends one claimed job to Runware. */
  async function submit(job) {
    const envelope = buildEnvelope(job.request, { taskUUID: job.task_uuid, webhookURL: await webhookFor(job.task_uuid) });
    await store.logCall({ job, request: redactEnvelope(envelope) });
    let res;
    try {
      res = await runware.submit(envelope);
    } catch (err) {
      // Ambiguous: Runware may or may not have the task. The lease expires and
      // reconcile polls by taskUUID before doing anything else.
      await store.finishCall(job.id, job.attempt, { ok: false, error: `submit threw: ${String(err?.message ?? err)}`.slice(0, 500) });
      return "ambiguous";
    }
    const parsed = parseRunware(res.body, job.task_uuid, res.httpStatus);
    if (parsed.state === "error") {
      await store.finishCall(job.id, job.attempt, { ok: false, http_status: res.httpStatus, response: res.body, error: parsed.message, cost_usd: parsed.cost });
      return fail(job, parsed, { cost: parsed.cost, code: parsed.code, message: parsed.message });
    }
    await store.markSubmitted(job.id, job.task_uuid);
    if (parsed.state === "success") return onResult(job.task_uuid, res.body, res.httpStatus);
    return "submitted";
  }

  /** Starts queued jobs, within per-story and global limits. */
  async function kick({ storyId = null } = {}) {
    const due = await store.dueQueuedJobs({ storyId, limit: 40, now: now() });
    if (!due.length) return { started: 0 };
    let global = await store.countInFlight();
    const perStory = await store.countInFlightByStory([...new Set(due.map((j) => j.story_id))]);
    let started = 0;
    for (const job of due) {
      const key = `${job.story_id}:${job.kind}`;
      const cap = job.kind === "image" ? SERVER_LIMITS.picturesInFlightPerStory : SERVER_LIMITS.clipsInFlightPerStory;
      if (global >= SERVER_LIMITS.jobsInFlightGlobal || (perStory.get(key) ?? 0) >= cap) continue;
      if (paidOff) {
        await store.refundJob(job.id, "PAID_CALLS_DISABLED", MESSAGES.PAID_CALLS_DISABLED, 0);
        continue;
      }
      const claimed = await store.claimJob(job.id, uuid(), TIMING.leaseSec, now());
      if (!claimed) continue;                       // someone else took it
      global += 1;
      perStory.set(key, (perStory.get(key) ?? 0) + 1);
      started += 1;
      await submit(claimed);
    }
    return { started };
  }

  /** A provider result arrived (webhook or poll) for taskUUID. */
  async function onResult(taskUUID, body, httpStatus = 200, via = "webhook") {
    const job = await store.jobByTask(taskUUID);
    if (!job || !["submitting", "submitted"].includes(job.status)) return "ignored";   // late, duplicate or unknown
    const parsed = parseRunware(body, taskUUID, httpStatus);
    if (parsed.state === "pending" || parsed.state === "accepted" || parsed.state === "unknown") {
      if (job.status === "submitting") await store.markSubmitted(job.id, taskUUID);
      return "pending";
    }
    if (parsed.state === "error") {
      await store.finishCall(job.id, job.attempt, { ok: false, http_status: httpStatus, response: body, error: parsed.message, cost_usd: parsed.cost });
      return fail(job, parsed, { cost: parsed.cost, code: parsed.code, message: parsed.message });
    }
    // _via: did the webhook bring it, or did the reconciler have to fetch it?
    const moved = await store.markProviderDone(job.id, taskUUID, { result: { ...body, _via: via }, outputUrl: parsed.url, cost: parsed.cost, now: now() });
    if (!moved) return "ignored";
    await store.finishCall(job.id, job.attempt, { ok: true, http_status: httpStatus, response: body, cost_usd: parsed.cost });
    return finalize({ ...job, status: "provider_done", output_url: parsed.url, provider_done_at: now().toISOString() });
  }

  /** Copies the provider media into permanent storage and completes the scene. */
  async function finalize(job) {
    const ext = job.kind === "clip" ? "mp4" : "jpg";
    const path = `fruit/${job.user_id}/${job.story_id}/${job.id}-a${job.attempt}.${ext}`;
    let storedUrl;
    try {
      storedUrl = await media.store({ url: job.output_url, path, contentType: job.kind === "clip" ? "video/mp4" : "image/jpeg" });
    } catch (err) {
      log.error?.(`[fruit] store failed for ${job.id}: ${String(err?.message ?? err)}`);
      if (ageSec(now(), job.provider_done_at) > TIMING.storeGiveUpSec) {
        // cost was already added at provider_done
        await store.refundJob(job.id, job.kind === "clip" ? "CLIP_FAILED" : "IMAGE_FAILED", MESSAGES[job.kind === "clip" ? "CLIP_FAILED" : "IMAGE_FAILED"], 0);
        return "refunded";
      }
      return "store_retry";                          // reconcile tries again
    }
    const ok = await store.completeJob(job.id, storedUrl, 0, null);   // cost was added at provider_done
    if (ok) await kick({ storyId: job.story_id });   // start the next queued job of this story
    return ok ? "completed" : "ignored";
  }

  /** Cron (every minute): find lost, stuck or unstored work and move it on. */
  async function reconcile() {
    const t = now();
    const report = { polled: 0, requeued: 0, refunded: 0, finalized: 0, started: 0 };
    for (const job of await store.openJobs()) {
      if (job.status === "provider_done") {
        if (ageSec(t, job.provider_done_at) > 20) {
          const r = await finalize(job);
          if (r === "completed") report.finalized += 1;
          if (r === "refunded") report.refunded += 1;
        }
        continue;
      }
      if (job.status === "submitting" && ageSec(t, job.lease_until) < 0) continue;       // lease still valid
      if (job.status === "submitted" && ageSec(t, job.submitted_at) < TIMING.pollAfterSec[job.kind]) continue;
      if (job.status !== "submitting" && job.status !== "submitted") continue;

      let res;
      try {
        res = await runware.poll(job.task_uuid);
      } catch {
        continue;                                    // try again next minute
      }
      report.polled += 1;
      const parsed = parseRunware(res.body, job.task_uuid, res.httpStatus);
      const gaveUp = ageSec(t, job.submitted_at ?? job.lease_until) > TIMING.giveUpAfterSec[job.kind];
      const stalled = job.status === "submitted" && ageSec(t, job.submitted_at) > TIMING.stallCheckSec[job.kind];
      if (parsed.state === "success" || parsed.state === "error") {
        const r = await onResult(job.task_uuid, res.body, res.httpStatus, "poll");
        if (r === "completed") report.finalized += 1;
        if (r === "requeued") report.requeued += 1;
        if (r === "refunded") report.refunded += 1;
      } else if (job.status === "submitting" && parsed.state === "unknown") {
        // The submit never reached Runware: send it again (counts as an attempt).
        const r = await fail(job, { retryable: true, contentPolicy: false }, { code: "lost_submit", message: "no task at provider" });
        report[r === "requeued" ? "requeued" : "refunded"] += 1;
      } else if (stalled && parsed.state === "unknown") {
        // Runware has no such task after 4 min (lost): send it again ONCE, then refund.
        if (job.attempt < 2) {
          const r = await fail(job, { retryable: true, contentPolicy: false }, { code: "lost_task", message: `no result after ${TIMING.stallCheckSec[job.kind]} s; sent again` });
          report[r === "requeued" ? "requeued" : "refunded"] += 1;
        } else {
          await store.refundJob(job.id, "PROVIDER_TIMEOUT", MESSAGES.PROVIDER_TIMEOUT, 0);
          report.refunded += 1;
        }
      } else if (gaveUp) {
        await store.refundJob(job.id, "PROVIDER_TIMEOUT", MESSAGES.PROVIDER_TIMEOUT, 0);
        report.refunded += 1;
      } else if (job.status === "submitting") {
        await store.markSubmitted(job.id, job.task_uuid);
      }
    }
    report.started = (await kick()).started;
    return report;
  }

  return { kick, submit, onResult, finalize, reconcile };
}
