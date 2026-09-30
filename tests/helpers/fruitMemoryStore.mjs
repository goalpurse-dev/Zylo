// In-memory stand-in for the Fruit v2 database, implementing the engine's
// store interface with the same rules as the SQL functions
// (fruit_charge_step / fruit_complete_job / fruit_refund_job /
// fruit_refresh_story_status in 20260927123135_fruit_story_backend.sql).
// Used by offline tests only.

export function createMemoryDb({ balance = 1000 } = {}) {
  const db = { balance, stories: new Map(), scenes: new Map(), jobs: new Map(), ledger: [], calls: [] };
  let seq = 0;
  const id = (p) => `${p}-${String(++seq).padStart(4, "0")}`;

  db.addStory = ({ quality = "v2", sceneCount = 3, status = "draft" } = {}) => {
    const storyId = id("story");
    db.stories.set(storyId, { id: storyId, user_id: "user-1", status, quality });
    for (let i = 0; i < sceneCount; i++) {
      const sceneId = id("scene");
      db.scenes.set(sceneId, { id: sceneId, story_id: storyId, idx: i, image_status: "queued", clip_status: "none", image_job_id: null, clip_job_id: null, image_url: null, clip_url: null, error_code: null, error: null });
    }
    return storyId;
  };

  const refresh = (storyId) => {
    const story = db.stories.get(storyId);
    const scenes = [...db.scenes.values()].filter((s) => s.story_id === storyId);
    if (story.status === "pictures" && !scenes.some((s) => ["queued", "generating"].includes(s.image_status))) story.status = "pictures_ready";
    if (story.status === "animating" && !scenes.some((s) => ["queued", "generating"].includes(s.clip_status))) story.status = "clips_ready";
  };

  /** fruit_charge_step, minus pricing (items carry credits). */
  db.chargeStep = (storyId, { from, to, items }) => {
    const story = db.stories.get(storyId);
    if (!from.includes(story.status)) throw new Error(`WRONG_STATUS: story is ${story.status}`);
    const total = items.reduce((s, it) => s + it.credits, 0);
    if (db.balance < total) throw new Error("INSUFFICIENT_CREDITS");
    db.balance -= total;
    const jobs = items.map((it) => {
      const jobId = id("job");
      db.jobs.set(jobId, {
        id: jobId, user_id: "user-1", story_id: storyId, scene_id: it.scene_id, kind: it.kind, credits: it.credits,
        request: it.request, status: "queued", attempt: 0, max_attempts: 3, task_uuid: null,
        next_attempt_at: new Date(0).toISOString(), lease_until: null, submitted_at: null, provider_done_at: null,
        output_url: null, stored_url: null, cost_usd: 0, error_code: null, error: null, refunded_at: null, created_at: new Date(seq).toISOString(),
      });
      db.ledger.push({ op: "charge", job: jobId, credits: it.credits, key: `job:${jobId}:charge` });
      const scene = db.scenes.get(it.scene_id);
      if (it.kind === "image") Object.assign(scene, { image_status: "queued", image_job_id: jobId });
      else Object.assign(scene, { clip_status: "queued", clip_job_id: jobId });
      return jobId;
    });
    story.status = to;
    return jobs;
  };

  const sceneOf = (job) => db.scenes.get(job.scene_id);
  const setScene = (job, patch) => {
    const s = sceneOf(job);
    if ((job.kind === "image" ? s.image_job_id : s.clip_job_id) === job.id) Object.assign(s, patch);
  };
  const IN_FLIGHT = ["submitting", "submitted", "provider_done"];

  const store = {
    async dueQueuedJobs({ storyId, limit, now }) {
      return [...db.jobs.values()].filter((j) => j.status === "queued" && new Date(j.next_attempt_at) <= now && (!storyId || j.story_id === storyId))
        .sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(0, limit).map((j) => ({ ...j }));
    },
    async countInFlight() { return [...db.jobs.values()].filter((j) => IN_FLIGHT.includes(j.status)).length; },
    async countInFlightByStory(ids) {
      const m = new Map();
      for (const j of db.jobs.values()) if (IN_FLIGHT.includes(j.status) && ids.includes(j.story_id)) m.set(`${j.story_id}:${j.kind}`, (m.get(`${j.story_id}:${j.kind}`) ?? 0) + 1);
      return m;
    },
    async claimJob(jobId, taskUUID, leaseSec, now) {
      const j = db.jobs.get(jobId);
      if (!j || j.status !== "queued") return null;
      Object.assign(j, { status: "submitting", task_uuid: taskUUID, attempt: j.attempt + 1, lease_until: new Date(now.getTime() + leaseSec * 1000).toISOString(), submitted_at: null });
      setScene(j, j.kind === "image" ? { image_status: "generating" } : { clip_status: "generating" });
      return { ...j };
    },
    async markSubmitted(jobId, taskUUID) {
      const j = db.jobs.get(jobId);
      if (j && j.task_uuid === taskUUID && j.status === "submitting") Object.assign(j, { status: "submitted", submitted_at: db.clock().toISOString(), lease_until: null });
    },
    async markProviderDone(jobId, taskUUID, { result, outputUrl, cost, now }) {
      const j = db.jobs.get(jobId);
      if (!j || j.task_uuid !== taskUUID || !["submitting", "submitted"].includes(j.status)) return false;
      Object.assign(j, { status: "provider_done", provider_done_at: now.toISOString(), result, output_url: outputUrl, cost_usd: j.cost_usd + (cost || 0), lease_until: null });
      return true;
    },
    async redrawPicture(jobId, note) {
      const j = db.jobs.get(jobId);
      if (!j || j.status !== "provider_done") return false;
      Object.assign(j, { status: "queued", next_attempt_at: db.clock().toISOString(), output_url: null, lease_until: null, submitted_at: null, provider_done_at: null, error: note });
      setScene(j, { image_status: "queued" });
      return true;
    },
    async setImageCheck(sceneId, status, notes) {
      const s = db.scenes.get(sceneId);
      if (s) Object.assign(s, { image_check: status, image_check_notes: notes });
    },
    async requeueJob(jobId, taskUUID, delaySec, error, cost) {
      const j = db.jobs.get(jobId);
      if (!j || j.task_uuid !== taskUUID || !["submitting", "submitted"].includes(j.status)) return false;
      Object.assign(j, { status: "queued", next_attempt_at: new Date(db.clock().getTime() + delaySec * 1000).toISOString(), error, cost_usd: j.cost_usd + (cost || 0), lease_until: null, submitted_at: null });
      setScene(j, j.kind === "image" ? { image_status: "queued" } : { clip_status: "queued" });
      return true;
    },
    async wasRewritten(jobId) { return db.calls.some((c) => c.job === jobId && c.purpose === "clip_rewrite"); },
    async replaceRequest(jobId, taskUUID, request, cost) {
      const j = db.jobs.get(jobId);
      if (!j || j.task_uuid !== taskUUID || !["submitting", "submitted"].includes(j.status)) return false;
      Object.assign(j, { status: "queued", request, next_attempt_at: db.clock().toISOString(), cost_usd: j.cost_usd + (cost || 0), lease_until: null, submitted_at: null });
      setScene(j, { clip_status: "queued", clip_prompt: request.positivePrompt });
      return true;
    },
    async refundJob(jobId, code, message, cost) {
      const j = db.jobs.get(jobId);
      if (!j || ["succeeded", "failed", "canceled"].includes(j.status) || j.refunded_at) return false;
      db.balance += j.credits;
      if (!db.ledger.some((l) => l.key === `job:${jobId}:refund`)) db.ledger.push({ op: "refund", job: jobId, credits: j.credits, key: `job:${jobId}:refund`, reason: code });
      Object.assign(j, { status: "failed", error_code: code, error: message, refunded_at: db.clock().toISOString(), cost_usd: j.cost_usd + (cost || 0) });
      setScene(j, j.kind === "image" ? { image_status: "failed", error_code: code, error: message } : { clip_status: "failed", error_code: code, error: message });
      refresh(j.story_id);
      return true;
    },
    async completeJob(jobId, storedUrl, cost) {
      const j = db.jobs.get(jobId);
      if (!j || ["succeeded", "failed", "canceled"].includes(j.status) || j.refunded_at) return false;
      Object.assign(j, { status: "succeeded", stored_url: storedUrl, cost_usd: j.cost_usd + (cost || 0) });
      setScene(j, j.kind === "image" ? { image_status: "ready", image_url: storedUrl, error: null } : { clip_status: "ready", clip_url: storedUrl, error: null });
      refresh(j.story_id);
      return true;
    },
    async jobByTask(taskUUID) { const j = [...db.jobs.values()].find((x) => x.task_uuid === taskUUID); return j ? { ...j } : null; },
    async openJobs() { return [...db.jobs.values()].filter((j) => IN_FLIGHT.includes(j.status)).map((j) => ({ ...j })); },
    async logCall({ job, request }) { db.calls.push({ job: job.id, attempt: job.attempt, request, done: null }); },
    async finishCall(jobId, attempt, patch) { const c = db.calls.find((x) => x.job === jobId && x.attempt === attempt); if (c) c.done = patch; },
  };

  let clockMs = Date.parse("2026-09-27T12:00:00Z");
  db.clock = () => new Date(clockMs);
  db.advance = (sec) => { clockMs += sec * 1000; };
  db.store = store;
  return db;
}
