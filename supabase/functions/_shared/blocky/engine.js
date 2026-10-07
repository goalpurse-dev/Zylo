// The Blocky Stories worker: submits paid Runware jobs, takes results
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
//   env     { BLOCKY_PAID_CALLS, webhookBase, webhookSecret }
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
  // 2026-10-07: 30 minutes for both (it was 8 and 12). On 6-7 Oct Runware delivered six clips
  // AFTER we had given up on them and refunded: the user lost the clip and we paid for it.
  giveUpAfterSec: { image: 30 * 60, clip: 30 * 60 },
  // Our provider account refused us (balance): the job WAITS and is sent again every 5 minutes;
  // only after 30 minutes of that is it refunded.
  balanceHoldSec: 5 * 60,
  balanceGiveUpSec: 30 * 60,
  storeGiveUpSec: 15 * 60,              // provider result we can't store (URL expires)
  // A provider_done job the first finalize didn't finish is picked up again after
  // this long. Clips take longer: their check listens to the clip first.
  finalizeAfterSec: { image: 20, clip: 75 },
  frameWaitSec: 90,                     // a clip's last frame that never arrives: the clip is kept unchecked
});

const failCode = (kind, cls) => cls.providerBalance ? "PROVIDER_UNAVAILABLE" : cls.contentPolicy
  ? (kind === "clip" ? "CLIP_BLOCKED" : "IMAGE_FAILED")
  : cls.retryable ? "PROVIDER_BUSY" : (kind === "clip" ? "CLIP_FAILED" : "IMAGE_FAILED");

/** Job note that marks a picture already redrawn after a failed check. */
export const REDRAW_NOTE = "picture check, redrawn at our cost:";
/** Job note of a job waiting for our provider balance; it carries when the wait began. */
export const BALANCE_NOTE = "provider balance, waiting since";
/** Job note that marks a clip already remade after a failed check (the wrong words, a human in the last frame). */
export const REMAKE_NOTE = "clip check, remade at our cost:";

const ageSec = (now, iso) => (iso ? (now.getTime() - new Date(iso).getTime()) / 1000 : Infinity);

//   rewriteClip (optional) async (job) -> new request | null   one content-policy rewrite for clips
//   fallbackClip (optional) (request) -> fallback request | null   e.g. clips.js#fallbackClipTask
//   onProviderBalance (optional) async ({job, code, message}) -> void   admin alert (alerts.js)
//   checkPicture (optional) async (job, storedUrl) -> {ok, problems[], fixes[]} | null   picture check (pictureCheck.js)
//   redrawRequest (optional) (job, verdict) -> request | null   the redraw's request, with what to fix added (pictures.js#withRedrawHint)
//   checkClipWords (optional) async (job, storedUrl) -> {ok, problems[]} | null   did the voice say the line (clipCheck.js)
//   requestClipFrame (optional) async (job, storedUrl) -> {path, ...} | null   asks for the clip's last frame; the answer arrives at onClipFrame
//   checkClipFrame (optional) async (job, frame) -> {ok, problems[]} | null   picture check on that frame
//   drawnTextProblem (optional) the start of the problem text that means "the video model drew its own subtitles"
//   onCompleted (optional) async (job) -> void   after a scene's picture or clip is ready
export function createEngine({ store, runware, media, env, rewriteClip = null, fallbackClip = null, onProviderBalance = null, checkPicture = null, redrawRequest = null, checkClipWords = null, requestClipFrame = null, checkClipFrame = null, drawnTextProblem = null, onCompleted = null, now = () => new Date(), uuid = () => crypto.randomUUID(), log = console }) {
  // Read each time it is asked: the switch and the daily cap can change between two jobs (spendGuard.js).
  const paidOff = () => String(env.BLOCKY_PAID_CALLS ?? "").toLowerCase() === "off";

  async function webhookFor(taskUUID) {
    if (!env.webhookBase || !env.webhookSecret) return null;
    const t = await webhookToken(env.webhookSecret, taskUUID);
    return `${env.webhookBase}?action=webhook&t=${t}`;
  }

  async function fail(job, cls, { cost = 0, code, message } = {}) {
    // Our provider account refused us for balance (no fallback on the same account). 2026-10-07:
    // the job is PAUSED, not failed: it waits and is sent again every 5 minutes (Runware's refusal
    // is often its "reserved for requests in progress" throttle, gone minutes later). The admin is
    // told on the first refusal. Only after 30 minutes of waiting is it refunded.
    if (cls.providerBalance) {
      const waiting = String(job.error ?? "").startsWith(BALANCE_NOTE);
      const since = waiting ? String(job.error).slice(BALANCE_NOTE.length).trim() : now().toISOString();
      if (!waiting && onProviderBalance) await onProviderBalance({ job, code, message }).catch((e) => log.error?.("[blocky] alert hook failed:", e?.message ?? e));
      if (ageSec(now(), since) < TIMING.balanceGiveUpSec && (await store.requeueJob(job.id, job.task_uuid, TIMING.balanceHoldSec, `${BALANCE_NOTE} ${since}`, cost))) return "held";
      await store.refundJob(job.id, "PROVIDER_UNAVAILABLE", MESSAGES.PROVIDER_UNAVAILABLE, cost);
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
      if (paidOff()) {
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
    // result: the new attempt's (a remade clip must not inherit the first attempt's frame wait)
    return finalize({ ...job, status: "provider_done", output_url: parsed.url, provider_done_at: now().toISOString(), result: { ...body, _via: via } });
  }

  /** The scene is done: mark it ready and start the story's next queued job. */
  async function complete(job, storedUrl, verdict = null) {
    const ok = await store.completeJob(job.id, storedUrl, 0, null);   // cost was added at provider_done
    if (ok && verdict) await store.setImageCheck(job.scene_id, verdict.ok ? "passed" : "failed", verdict.ok ? null : (verdict.problems ?? []).join("; ").slice(0, 500));
    if (ok) await kick({ storyId: job.story_id });
    if (ok && onCompleted) await onCompleted(job).catch((e) => log.error?.("[blocky] onCompleted failed:", e?.message ?? e));
    return ok ? "completed" : "ignored";
  }

  const remadeBefore = (job) => String(job.error ?? "").startsWith(REMAKE_NOTE);
  async function remake(job, problems) {
    if (!(await store.remakeClip(job.id, `${REMAKE_NOTE} ${(problems ?? []).join("; ")}`.slice(0, 500)))) return false;
    await kick({ storyId: job.story_id });
    return true;
  }

  /**
   * A clip's last frame arrived (or couldn't be made: ok false). A failed
   * frame check remakes the clip once; anything else keeps it.
   */
  async function onClipFrame(jobId, ok) {
    const job = await store.jobById(jobId);
    const frame = job?.result?._frame;
    if (!job || job.status !== "provider_done" || !frame) return "ignored";
    let verdict = null;
    if (ok && checkClipFrame) {
      try { verdict = await checkClipFrame(job, frame); } catch (err) { log.error?.(`[blocky] clip frame check failed to run for ${job.id}: ${String(err?.message ?? err)}`); }
    }
    if (verdict && !verdict.ok && !remadeBefore(job) && (await remake(job, verdict.problems))) return "remade";
    // Made again already and the video model drew its own subtitles AGAIN: one last try on the tier's
    // next clip model (V2: Wan -> Seedance 2.0 Mini), at our cost. Only for drawn words, only once (the
    // request is then the fallback's, and that has no fallback of its own). If that clip carries them
    // too, it is kept and the final video leaves its own caption off it.
    const drawn = Boolean(drawnTextProblem) && (verdict?.problems ?? []).some((p) => String(p).includes(drawnTextProblem));
    if (verdict && !verdict.ok && drawn && remadeBefore(job) && fallbackClip) {
      const next = fallbackClip(job.request);
      if (next && (await store.remakeClip(job.id, `${REMAKE_NOTE} ${verdict.problems.join("; ")}; then on the next clip model`.slice(0, 500), next))) {
        await kick({ storyId: job.story_id });
        return "remade_on_fallback";
      }
    }
    return complete(job, frame.storedUrl);
  }

  /** Copies the provider media into permanent storage and completes the scene. */
  async function finalize(job) {
    // A clip waiting for its last frame: keep waiting, or give up on the check and keep the clip.
    const waiting = job.kind === "clip" ? job.result?._frame : null;
    if (waiting) return ageSec(now(), waiting.at) < TIMING.frameWaitSec ? "frame_pending" : complete(job, waiting.storedUrl);
    const ext = job.kind === "clip" ? "mp4" : "jpg";
    const path = `blocky/${job.user_id}/${job.story_id}/${job.id}-a${job.attempt}.${ext}`;
    let storedUrl;
    try {
      storedUrl = await media.store({ url: job.output_url, path, contentType: job.kind === "clip" ? "video/mp4" : "image/jpeg" });
    } catch (err) {
      log.error?.(`[blocky] store failed for ${job.id}: ${String(err?.message ?? err)}`);
      if (ageSec(now(), job.provider_done_at) > TIMING.storeGiveUpSec) {
        // cost was already added at provider_done
        await store.refundJob(job.id, job.kind === "clip" ? "CLIP_FAILED" : "IMAGE_FAILED", MESSAGES[job.kind === "clip" ? "CLIP_FAILED" : "IMAGE_FAILED"], 0);
        return "refunded";
      }
      return "store_retry";                          // reconcile tries again
    }
    // Picture check: every avatar there and blocky, the right number of characters. A
    // failed check is redrawn ONCE on the same job (our cost, not the user's);
    // failing again, the picture is kept with a warning and a free regenerate.
    // A check that can't run never blocks the picture.
    let verdict = null;
    if (job.kind === "image" && checkPicture) {
      try { verdict = await checkPicture(job, storedUrl); } catch (err) { log.error?.(`[blocky] picture check failed to run for ${job.id}: ${String(err?.message ?? err)}`); }
      const redrawnBefore = String(job.error ?? "").startsWith(REDRAW_NOTE);
      if (verdict && !verdict.ok && !redrawnBefore) {
        // The redraw is told what to fix (a tighter frame, no writing...), so it isn't the same roll of the dice.
        const next = redrawRequest ? redrawRequest(job, verdict) : null;
        if (await store.redrawPicture(job.id, `${REDRAW_NOTE} ${(verdict.problems ?? []).join("; ")}`.slice(0, 500), next)) {
          await kick({ storyId: job.story_id });
          return "redrawn";
        }
      }
    }
    // Clip check: did the voice say the line, and are its frames clean (no
    // human, no new character, no writing, no subtitles the model drew
    // itself)? A clip that fails is made again ONCE on the same job (our
    // cost). A remade clip is never made a third time, but its frames are
    // still looked at, so the final video knows whether the clip carries drawn
    // words (it then leaves its own caption off that clip). A check that
    // can't run never blocks the clip.
    if (job.kind === "clip") {
      const remade = remadeBefore(job);
      let words = null;
      if (!remade && checkClipWords) {
        try { words = await checkClipWords(job, storedUrl); } catch (err) { log.error?.(`[blocky] clip word check failed to run for ${job.id}: ${String(err?.message ?? err)}`); }
      }
      if (words && !words.ok && (await remake(job, words.problems))) return "remade";
      if (requestClipFrame && !(words && !words.ok)) {
        let frame = null;
        try { frame = await requestClipFrame(job, storedUrl); } catch (err) { log.error?.(`[blocky] clip frame request failed for ${job.id}: ${String(err?.message ?? err)}`); }
        if (frame && (await store.noteClipFrame(job.id, { ...frame, storedUrl, at: now().toISOString() }))) return "frame_pending";
      }
    }
    return complete(job, storedUrl, verdict);
  }

  /** Cron (every minute): find lost, stuck or unstored work and move it on. */
  async function reconcile() {
    const t = now();
    const report = { polled: 0, requeued: 0, refunded: 0, finalized: 0, started: 0 };
    for (const job of await store.openJobs()) {
      if (job.status === "provider_done") {
        if (ageSec(t, job.provider_done_at) > TIMING.finalizeAfterSec[job.kind]) {
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
      // 2026-10-07: a status read the provider refused or fumbled (429, 5xx, a balance refusal) says
      // nothing about the task. It used to count as the task failing: the job was sent again under a
      // new id while the first one was still rendering (paid twice, the first result lost). Now it
      // is "no news yet": asked again next time, given up on only by the clock below.
      const readFailed = !(res.httpStatus >= 200 && res.httpStatus < 300);
      const parsed = readFailed ? { state: "pending" } : parseRunware(res.body, job.task_uuid, res.httpStatus);
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

  return { kick, submit, onResult, onClipFrame, finalize, reconcile };
}
