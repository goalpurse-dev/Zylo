// The engine's store on Supabase (service role). Every state change is a
// conditional update on the job's current status (and task_uuid), so racing
// webhooks, polls and cron runs can't move a job twice. Credits only move
// inside the SQL functions blocky_charge_step / blocky_refund_job.

const IN_FLIGHT = ["submitting", "submitted", "provider_done"];

function must({ data, error }, what) {
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

export function createSupabaseStore(admin) {
  async function setSceneStatus(job, status) {
    const col = job.kind === "image" ? { image_status: status } : { clip_status: status };
    const key = job.kind === "image" ? "image_job_id" : "clip_job_id";
    must(await admin.from("blocky_story_scenes").update(col).eq("id", job.scene_id).eq(key, job.id), "scene status");
  }

  return {
    async dueQueuedJobs({ storyId, limit, now }) {
      let q = admin.from("blocky_jobs").select("*").eq("status", "queued").lte("next_attempt_at", now.toISOString())
        .order("created_at", { ascending: true }).limit(limit);
      if (storyId) q = q.eq("story_id", storyId);
      return must(await q, "due jobs");
    },

    async countInFlight() {
      const { count, error } = await admin.from("blocky_jobs").select("id", { count: "exact", head: true }).in("status", IN_FLIGHT);
      if (error) throw new Error(`count in flight: ${error.message}`);
      return count ?? 0;
    },

    async countInFlightByStory(storyIds) {
      const map = new Map();
      if (!storyIds.length) return map;
      const rows = must(await admin.from("blocky_jobs").select("story_id, kind").in("status", IN_FLIGHT).in("story_id", storyIds), "count by story");
      for (const r of rows) map.set(`${r.story_id}:${r.kind}`, (map.get(`${r.story_id}:${r.kind}`) ?? 0) + 1);
      return map;
    },

    async claimJob(id, taskUUID, leaseSec, now) {
      const job = must(await admin.from("blocky_jobs").select("*").eq("id", id).maybeSingle(), "read job");
      if (!job || job.status !== "queued") return null;
      const rows = must(await admin.from("blocky_jobs")
        .update({ status: "submitting", task_uuid: taskUUID, attempt: job.attempt + 1, lease_until: new Date(now.getTime() + leaseSec * 1000).toISOString(), submitted_at: null })
        .eq("id", id).eq("status", "queued").eq("attempt", job.attempt).select("*"), "claim job");
      if (!rows.length) return null;
      await setSceneStatus(rows[0], "generating");
      return rows[0];
    },

    async markSubmitted(id, taskUUID) {
      must(await admin.from("blocky_jobs").update({ status: "submitted", submitted_at: new Date().toISOString(), lease_until: null })
        .eq("id", id).eq("task_uuid", taskUUID).eq("status", "submitting"), "mark submitted");
    },

    async markProviderDone(id, taskUUID, { result, outputUrl, cost, now }) {
      const job = must(await admin.from("blocky_jobs").select("cost_usd, status, task_uuid").eq("id", id).maybeSingle(), "read job");
      if (!job || job.task_uuid !== taskUUID || !["submitting", "submitted"].includes(job.status)) return false;
      const rows = must(await admin.from("blocky_jobs")
        .update({ status: "provider_done", provider_done_at: now.toISOString(), result, output_url: outputUrl, cost_usd: Number(job.cost_usd) + (cost || 0), lease_until: null })
        .eq("id", id).eq("task_uuid", taskUUID).in("status", ["submitting", "submitted"]).select("id"), "provider done");
      return rows.length > 0;
    },

    async requeueJob(id, taskUUID, delaySec, error, cost) {
      const job = must(await admin.from("blocky_jobs").select("*").eq("id", id).maybeSingle(), "read job");
      if (!job || job.task_uuid !== taskUUID || !["submitting", "submitted"].includes(job.status)) return false;
      const rows = must(await admin.from("blocky_jobs")
        .update({ status: "queued", next_attempt_at: new Date(Date.now() + delaySec * 1000).toISOString(), error, cost_usd: Number(job.cost_usd) + (cost || 0), lease_until: null, submitted_at: null })
        .eq("id", id).eq("task_uuid", taskUUID).in("status", ["submitting", "submitted"]).select("*"), "requeue");
      if (rows.length) await setSceneStatus(rows[0], "queued");
      return rows.length > 0;
    },

    async wasRewritten(jobId) {
      const { count, error } = await admin.from("blocky_ai_calls").select("id", { count: "exact", head: true }).eq("job_id", jobId).eq("purpose", "clip_rewrite");
      if (error) throw new Error(`was rewritten: ${error.message}`);
      return (count ?? 0) > 0;
    },

    // Swaps in the rewritten request and queues the job again; the scene's
    // clip_prompt follows, so what is saved stays what is sent.
    async replaceRequest(id, taskUUID, request, cost, note = "content policy: rewritten once") {
      const job = must(await admin.from("blocky_jobs").select("*").eq("id", id).maybeSingle(), "read job");
      if (!job || job.task_uuid !== taskUUID || !["submitting", "submitted"].includes(job.status)) return false;
      const rows = must(await admin.from("blocky_jobs")
        .update({ status: "queued", request, next_attempt_at: new Date().toISOString(), cost_usd: Number(job.cost_usd) + (cost || 0), lease_until: null, submitted_at: null, error: note })
        .eq("id", id).eq("task_uuid", taskUUID).in("status", ["submitting", "submitted"]).select("*"), "replace request");
      if (!rows.length) return false;
      must(await admin.from("blocky_story_scenes").update({ clip_prompt: request.positivePrompt, clip_status: "queued" }).eq("id", job.scene_id).eq("clip_job_id", id), "scene prompt");
      return true;
    },

    async refundJob(id, code, message, cost) {
      return must(await admin.rpc("blocky_refund_job", { p_job_id: id, p_error_code: code, p_error: message, p_cost_usd: cost || 0 }), "refund job");
    },

    async completeJob(id, storedUrl, cost, result) {
      return must(await admin.rpc("blocky_complete_job", { p_job_id: id, p_stored_url: storedUrl, p_cost_usd: cost || 0, p_result: result }), "complete job");
    },

    // A picture that failed the automatic check is drawn again ONCE on the same
    // job (same charge; the extra provider cost is ours). note marks it redrawn.
    // request (optional): the same request with what to fix added to the prompt; the
    // scene's image_prompt follows, so what is saved stays what is sent.
    async redrawPicture(id, note, request = null) {
      const rows = must(await admin.from("blocky_jobs")
        .update({ status: "queued", next_attempt_at: new Date().toISOString(), output_url: null, lease_until: null, submitted_at: null, provider_done_at: null, error: note, ...(request ? { request } : {}) })
        .eq("id", id).eq("status", "provider_done").select("*"), "redraw picture");
      if (rows.length) await setSceneStatus(rows[0], "queued");
      if (rows.length && request) must(await admin.from("blocky_story_scenes").update({ image_prompt: request.positivePrompt }).eq("id", rows[0].scene_id).eq("image_job_id", id), "scene prompt");
      return rows.length > 0;
    },

    // A clip that failed its check is made again ONCE on the same job (same
    // charge; the extra provider cost is ours). note marks it remade.
    // request: only when the clip moves to another model (drawn subtitles: the tier's fallback model)
    async remakeClip(id, note, request = null) {
      const rows = must(await admin.from("blocky_jobs")
        .update({ status: "queued", next_attempt_at: new Date().toISOString(), output_url: null, lease_until: null, submitted_at: null, provider_done_at: null, error: note, ...(request ? { request } : {}) })
        .eq("id", id).eq("status", "provider_done").eq("kind", "clip").select("*"), "remake clip");
      if (rows.length) await setSceneStatus(rows[0], "queued");
      return rows.length > 0;
    },

    // The clip's last frame has been asked for: remember where it will land and
    // the clip's stored URL (kept on the job result until the frame arrives).
    async noteClipFrame(id, frame) {
      const job = must(await admin.from("blocky_jobs").select("result, status").eq("id", id).maybeSingle(), "read job");
      if (!job || job.status !== "provider_done") return false;
      const rows = must(await admin.from("blocky_jobs").update({ result: { ...(job.result ?? {}), _frame: frame } }).eq("id", id).eq("status", "provider_done").select("id"), "note clip frame");
      return rows.length > 0;
    },

    async jobById(id) {
      return must(await admin.from("blocky_jobs").select("*").eq("id", id).maybeSingle(), "job by id");
    },

    async setImageCheck(sceneId, status, notes) {
      must(await admin.from("blocky_story_scenes").update({ image_check: status, image_check_notes: notes }).eq("id", sceneId).select("id"), "image check");
    },

    async jobByTask(taskUUID) {
      return must(await admin.from("blocky_jobs").select("*").eq("task_uuid", taskUUID).maybeSingle(), "job by task");
    },

    async openJobs() {
      return must(await admin.from("blocky_jobs").select("*").in("status", IN_FLIGHT).order("created_at", { ascending: true }).limit(200), "open jobs");
    },

    async logCall({ job, request }) {
      const { error } = await admin.from("blocky_ai_calls").insert({
        user_id: job.user_id, story_id: job.story_id, scene_id: job.scene_id, job_id: job.id,
        provider: "runware", model: String(request.model ?? ""), purpose: job.kind, attempt: job.attempt, request,
      });
      if (error) console.error("[blocky] log call failed:", error.message);   // logging never blocks the job
    },

    async finishCall(jobId, attempt, patch) {
      const { error } = await admin.from("blocky_ai_calls").update({ ...patch, completed_at: new Date().toISOString() })
        .eq("job_id", jobId).eq("attempt", attempt).eq("provider", "runware");
      if (error) console.error("[blocky] finish call failed:", error.message);
    },
  };
}

/** Copies provider media into the public `generated` bucket. */
export function createSupabaseMedia(admin, { bucket = "generated" } = {}) {
  return {
    async store({ url, path, contentType }) {
      const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      if (!res.ok) throw new Error(`download ${res.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      const { error } = await admin.storage.from(bucket).upload(path, bytes, { contentType, upsert: true, cacheControl: "31536000" });
      if (error) throw new Error(`upload: ${error.message}`);
      return admin.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    },
  };
}
