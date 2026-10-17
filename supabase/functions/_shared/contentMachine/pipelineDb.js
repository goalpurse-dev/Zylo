// Content Machine: the pipeline's database and storage calls (service role). The rules live in
// pipeline.js; this file only reads and writes. Files go to the PRIVATE content-machine bucket.
export const BUCKET = "content-machine";
const PLACEHOLDER = "(being written)";

const must = ({ data, error }, what) => {
  if (error) throw new Error(`[content-machine] ${what}: ${error.message}`);
  return data;
};
const daysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString();
const nowIso = () => new Date().toISOString();

export function createPipelineDb(db) {
  const api = {
    async settings() { return must(await db.from("cm_settings").select("*").eq("id", true).single(), "settings"); },
    async updateSettings(patch) { must(await db.from("cm_settings").update({ ...patch, updated_at: nowIso() }).eq("id", true), "update settings"); },
    async library() {
      const rows = must(await db.from("cm_library").select("kind,key,name,description,spec").eq("status", "active").order("key"), "library");
      return { formats: rows.filter((r) => r.kind === "format"), styles: rows.filter((r) => r.kind === "style"), hooks: rows.filter((r) => r.kind === "hook") };
    },
    async getRun(id) { return must(await db.from("cm_runs").select("*").eq("id", id).single(), "run"); },
    async updateRun(id, patch) { must(await db.from("cm_runs").update(patch).eq("id", id), "update run"); },
    async createRun(row) { return must(await db.from("cm_runs").insert(row).select("*").single(), "create run"); },
    async recentRecipes(days) {
      const rows = must(await db.from("cm_ideas").select("recipe").eq("dry_run", false).gte("created_at", daysAgo(days)).order("created_at"), "recent recipes");
      return rows.map((r) => r.recipe).filter((r) => r?.format);
    },
    async recentTitles(days, excludeId) {
      let q = db.from("cm_ideas").select("id,title,hook").eq("dry_run", false).neq("title", PLACEHOLDER).gte("created_at", daysAgo(days)).order("created_at", { ascending: false }).limit(200);
      if (excludeId) q = q.neq("id", excludeId);
      return must(await q, "recent titles");
    },
    async createIdeas(rows) { return must(await db.from("cm_ideas").insert(rows).select("*"), "create ideas"); },
    async getIdea(id) { return must(await db.from("cm_ideas").select("*").eq("id", id).single(), "idea"); },
    async updateIdea(id, patch) { return must(await db.from("cm_ideas").update({ ...patch, updated_at: nowIso() }).eq("id", id).select("*").single(), "update idea"); },
    async ideasOfRun(runId) { return must(await db.from("cm_ideas").select("*").eq("run_id", runId).order("created_at"), "ideas of run"); },
    async runSpend(runId) {
      const rows = must(await db.from("cm_spend_ledger").select("estimated_usd,actual_usd").eq("run_id", runId), "run spend");
      return Math.round(rows.reduce((a, r) => a + Number(r.actual_usd ?? r.estimated_usd ?? 0), 0) * 1e6) / 1e6;
    },
    async ensureGeneration(ideaId) {
      const found = must(await db.from("cm_generations").select("*").eq("idea_id", ideaId).eq("kind", "slideshow").limit(1), "generation");
      if (found.length) return found[0];
      return must(await db.from("cm_generations").insert({ idea_id: ideaId, kind: "slideshow", status: "queued" }).select("*").single(), "create generation");
    },
    async updateGeneration(id, patch) { must(await db.from("cm_generations").update({ ...patch, updated_at: nowIso() }).eq("id", id), "update generation"); },
    async savePackages(generationId, rows) {
      must(await db.from("cm_packages").upsert(rows.map((r) => ({ ...r, generation_id: generationId, updated_at: nowIso() })), { onConflict: "generation_id,platform" }), "save packages");
    },
    async enqueue(rows) {
      if (!rows.length) return;
      must(await db.from("cm_jobs").insert(rows.map((r) => ({ payload: {}, ...r }))), "enqueue");
    },
    async claimJobs(limit, leaseSeconds) { return must(await db.rpc("cm_claim_jobs", { p_limit: limit, p_lease_seconds: leaseSeconds }), "claim jobs") ?? []; },
    async finishJob(id, status, error = null) {
      must(await db.from("cm_jobs").update({ status, error: error ? String(error).slice(0, 1000) : null, locked_until: null, updated_at: nowIso() }).eq("id", id), "finish job");
    },
    async requeueJob(id, { delaySec, error = null, keepAttempt = false, payload }) {
      const patch = { status: "queued", run_after: new Date(Date.now() + delaySec * 1000).toISOString(), locked_until: null, error: error ? String(error).slice(0, 1000) : null, updated_at: nowIso() };
      if (payload) patch.payload = payload;
      if (keepAttempt) {
        // Waiting (a batch, a render, the kill switch) is not a failed attempt.
        const row = must(await db.from("cm_jobs").select("attempts").eq("id", id).single(), "job");
        patch.attempts = Math.max(0, row.attempts - 1);
      }
      must(await db.from("cm_jobs").update(patch).eq("id", id), "requeue job");
    },
    async dailyRunExists(day) {
      return must(await db.from("cm_runs").select("id").eq("kind", "daily").eq("run_date", day).limit(1), "daily run").length > 0;
    },

    /* ─── reads for the admin page ─── */
    async listRuns(limit = 20) {
      return must(await db.from("cm_runs").select("*").order("created_at", { ascending: false }).limit(limit), "runs");
    },
    /** Ideas with their slideshow generation and its packages. filters: runId | {from, to, format, style, status}. */
    async listIdeas({ runId = null, from = null, to = null, format = null, style = null, status = null, limit = 60 } = {}) {
      let q = db.from("cm_ideas").select("*, cm_generations(*, cm_packages(*))").order("created_at", { ascending: false }).limit(limit);
      if (runId) q = q.eq("run_id", runId);
      if (from) q = q.gte("created_at", from);
      if (to) q = q.lte("created_at", to);
      if (format) q = q.eq("format", format);
      if (style) q = q.eq("recipe->>style", style);
      if (status) q = q.eq("status", status);
      return must(await q, "ideas");
    },
    async ideaCosts(ideaIds) {
      if (!ideaIds.length) return {};
      const rows = must(await db.from("cm_spend_ledger").select("idea_id,provider,estimated_usd,actual_usd,dry_run,would_cost_usd").in("idea_id", ideaIds), "idea costs");
      const out = {};
      for (const r of rows) {
        const o = (out[r.idea_id] ??= { usd: 0, wouldUsd: 0, byProvider: {}, calls: 0 });
        const c = Number(r.actual_usd ?? r.estimated_usd ?? 0);
        o.usd += c; o.calls += 1;
        o.byProvider[r.provider] = (o.byProvider[r.provider] ?? 0) + c;
        if (r.dry_run) o.wouldUsd += Number(r.would_cost_usd ?? 0);
      }
      return out;
    },
    async libraryAll() { return must(await db.from("cm_library").select("*").order("kind").order("key"), "library"); },
    async saveLibrary(row) {
      return must(await db.from("cm_library").upsert({ ...row, updated_at: nowIso() }, { onConflict: "kind,key" }).select("*").single(), "save library");
    },
    /* ─── live progress and cancel ─── */
    async jobsOfRun(runId) {
      return must(await db.from("cm_jobs").select("id,idea_id,stage,status,created_at,updated_at").eq("run_id", runId).order("created_at"), "jobs of run");
    },
    async cancelQueuedJobs(runId) {
      must(await db.from("cm_jobs").update({ status: "cancelled", error: "the run was cancelled", updated_at: nowIso() }).eq("run_id", runId).eq("status", "queued"), "cancel jobs");
    },
    /** Finished real runs, newest first: how long they took, for "about X min left". */
    async pastRuns(limit = 10) {
      return must(await db.from("cm_runs").select("id,started_at,finished_at,input,kind").eq("status", "done").eq("dry_run", false).not("finished_at", "is", null).order("finished_at", { ascending: false }).limit(limit), "past runs");
    },

    /* ─── the asset library ─── */
    /** Usable assets as the writer and the image step see them. */
    async activeAssets() {
      return must(await db.from("cm_assets").select("ref,path,kind,tool,style,subject,tags").eq("status", "active").order("tool").limit(400), "active assets");
    },
    async getAssets(ids) { return must(await db.from("cm_assets").select("*").in("id", ids), "assets"); },
    async listAssets({ status = null, tool = null, kind = null, limit = 300 } = {}) {
      let q = db.from("cm_assets").select("*").order("created_at", { ascending: false }).limit(limit);
      if (status) q = q.eq("status", status);
      if (tool) q = q.eq("tool", tool);
      if (kind) q = q.eq("kind", kind);
      return must(await q, "list assets");
    },
    async updateAsset(id, patch) { return must(await db.from("cm_assets").update({ ...patch, updated_at: nowIso() }).eq("id", id).select("*").single(), "update asset"); },

    /* ─── the logo library ─── */
    async approvedLogos() {
      return must(await db.from("cm_logos").select("name,domain,logo_path").eq("approved", true).not("logo_path", "is", null), "approved logos");
    },
    async listLogos() { return must(await db.from("cm_logos").select("*").order("name"), "logos"); },
    async getLogo(id) { return must(await db.from("cm_logos").select("*").eq("id", id).single(), "logo"); },
    async saveLogo(row) {
      if (row.id) return must(await db.from("cm_logos").update({ ...row, updated_at: nowIso() }).eq("id", row.id).select("*").single(), "save logo");
      return must(await db.from("cm_logos").insert(row).select("*").single(), "add logo");
    },
    async uploadLogoFile(path, bytes, contentType) {
      const { error } = await db.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: true });
      if (error) throw new Error(`[content-machine] upload logo: ${error.message}`);
    },

    async getPackage(id) { return must(await db.from("cm_packages").select("*").eq("id", id).single(), "package"); },
    async updatePackage(id, patch) { return must(await db.from("cm_packages").update({ ...patch, updated_at: nowIso() }).eq("id", id).select("*").single(), "update package"); },
  };
  return api;
}

export function createFiles(db) {
  const bucket = () => db.storage.from(BUCKET);
  return {
    async signedUpload(path) {
      const { data, error } = await bucket().createSignedUploadUrl(path, { upsert: true });
      if (error || !data?.signedUrl) throw new Error(`couldn't prepare the upload of ${path}`);
      return data.signedUrl;
    },
    async signedUrl(path, seconds = 900) {
      const { data, error } = await bucket().createSignedUrl(path, seconds);
      if (error || !data?.signedUrl) return null;
      return data.signedUrl;
    },
    async signedUrls(paths, seconds = 900) {
      if (!paths.length) return {};
      const { data, error } = await bucket().createSignedUrls(paths, seconds);
      if (error) return {};
      return Object.fromEntries((data ?? []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
    },
    async exists(path) {
      const dir = path.slice(0, path.lastIndexOf("/"));
      const name = path.slice(path.lastIndexOf("/") + 1);
      const { data } = await bucket().list(dir, { search: name });
      return (data ?? []).some((f) => f.name === name);
    },
    async readJson(path) {
      const { data, error } = await bucket().download(path);
      if (error || !data) return null;
      try { return JSON.parse(await data.text()); } catch { return null; }
    },
  };
}
