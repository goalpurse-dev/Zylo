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
      const rows = must(await db.from("cm_library").select("kind,key,name,description,spec,lanes").eq("status", "active").order("key"), "library");
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
    /** Ideas with their slideshow generation, its packages and its posts. filters: runId | {from, to, before, format,
     *  style, status, notStatus (a list), account, title (a part of it)}. */
    async listIdeas({ runId = null, from = null, to = null, format = null, style = null, status = null, notStatus = null, account = null, title = null, before = null, limit = 60 } = {}) {
      let q = db.from("cm_ideas").select("*, cm_generations(*, cm_packages(*)), cm_posts(platform, posted_at)").order("created_at", { ascending: false }).limit(limit);
      if (runId) q = q.eq("run_id", runId);
      if (from) q = q.gte("created_at", from);
      if (to) q = q.lte("created_at", to);
      if (before) q = q.lt("created_at", before);
      if (format) q = q.eq("format", format);
      if (style) q = q.eq("recipe->>style", style);
      if (status) q = q.eq("status", status);
      if (notStatus?.length) q = q.not("status", "in", `(${notStatus.join(",")})`);
      if (account) q = q.eq("account", account);
      if (title) q = q.ilike("title", `%${title}%`);
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
      return must(await db.from("cm_assets").select("ref,path,kind,tool,style,subject,tags,subtitles,prompt").eq("status", "active").order("tool").limit(400), "active assets");
    },
    async getAssets(ids) { return must(await db.from("cm_assets").select("*").in("id", ids), "assets"); },
    async listAssets({ status = null, tool = null, kind = null, limit = 300 } = {}) {
      let q = db.from("cm_assets").select("*").order("created_at", { ascending: false }).limit(limit);
      if (status) q = q.eq("status", status);
      if (tool) q = q.eq("tool", tool);
      if (kind) q = q.eq("kind", kind);
      return must(await q, "list assets");
    },
    async markAssetsFlawed(list) {
      for (const { ref, reason } of list) must(await db.from("cm_assets").update({ status: "flawed", flaw_reason: reason, updated_at: nowIso() }).eq("ref", ref).eq("status", "active").select("id"), "flag asset");
    },
    async updateAsset(id, patch) { return must(await db.from("cm_assets").update({ ...patch, updated_at: nowIso() }).eq("id", id).select("*").single(), "update asset"); },

    /* ─── the logo library ─── */
    async approvedLogos() {
      // Every row: approved files are used, and the display rules (name only, initials tile) apply to all.
      return must(await db.from("cm_logos").select("name,domain,logo_path,approved,display"), "logo rows");
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

    /* ─── the two accounts (lanes) and the Zyvo fact sheet ─── */
    async lanes() { return Object.fromEntries(must(await db.from("cm_lanes").select("*"), "lanes").map((l) => [l.key, l])); },
    async saveLane(key, patch) { return must(await db.from("cm_lanes").update({ ...patch, updated_at: nowIso() }).eq("key", key).select("*").single(), "save lane"); },
    async facts() { return must(await db.from("cm_facts").select("key,category,claim,detail,source").eq("status", "active").order("category").order("key"), "facts"); },
    async listFacts() { return must(await db.from("cm_facts").select("*").order("category").order("key"), "fact sheet"); },
    async saveFact(row) {
      if (row.id) { const { id, ...patch } = row; return must(await db.from("cm_facts").update({ ...patch, updated_at: nowIso() }).eq("id", id).select("*").single(), "save fact"); }
      return must(await db.from("cm_facts").insert(row).select("*").single(), "add fact");
    },

    /* ─── Phase 3: analyses and scout reports ─── */
    async createAnalysis(row) { return must(await db.from("cm_analyses").insert(row).select("*").single(), "create analysis"); },
    async getAnalysis(id) { return must(await db.from("cm_analyses").select("*").eq("id", id).single(), "analysis"); },
    async updateAnalysis(id, patch) { return must(await db.from("cm_analyses").update({ ...patch, updated_at: nowIso() }).eq("id", id).select("*").single(), "update analysis"); },
    async listAnalyses(limit = 10) { return must(await db.from("cm_analyses").select("*").order("created_at", { ascending: false }).limit(limit), "analyses"); },
    async saveScout(row) { return must(await db.from("cm_scout_reports").insert(row).select("*").single(), "save scout report"); },
    async listScouts(limit = 5) { return must(await db.from("cm_scout_reports").select("*").order("created_at", { ascending: false }).limit(limit), "scout reports"); },
    async firstScoutJobAt(iso) { return must(await db.from("cm_jobs").select("created_at").eq("stage", "scout").gte("created_at", iso).order("created_at").limit(1), "scout job")[0]?.created_at ?? null; },
    async scoutQueuedSince(iso) { return must(await db.from("cm_jobs").select("id").eq("stage", "scout").gte("created_at", iso).limit(1), "scout jobs").length > 0; },

    /* ─── Part 2: posts and their stats snapshots ─── */
    async createPost(row) { return must(await db.from("cm_posts").insert(row).select("*").single(), "create post"); },
    async getPost(id) { return must(await db.from("cm_posts").select("*").eq("id", id).single(), "post"); },
    async updatePost(id, patch) { return must(await db.from("cm_posts").update({ ...patch, updated_at: nowIso() }).eq("id", id).select("*").single(), "update post"); },
    async deletePost(id) { must(await db.from("cm_posts").delete().eq("id", id).select("id"), "delete post"); },
    async postsOfIdea(ideaId) { return must(await db.from("cm_posts").select("*").eq("idea_id", ideaId), "posts of idea"); },
    /** Every post with its slideshow (title, recipe, first PNG) and its snapshots. */
    async listPosts({ limit = 500 } = {}) {
      return must(await db.from("cm_posts").select("*, cm_ideas(id,title,recipe,status,account,script,cm_generations(files)), cm_post_stats(*)").not("idea_id", "is", null).order("posted_at", { ascending: false }).limit(limit), "posts");
    },
    async getStats(id) { return must(await db.from("cm_post_stats").select("*").eq("id", id).single(), "stats"); },
    async saveStats(row) {
      if (row.id) { const { id, ...patch } = row; return must(await db.from("cm_post_stats").update({ ...patch, updated_at: nowIso() }).eq("id", id).select("*").single(), "update stats"); }
      return must(await db.from("cm_post_stats").insert(row).select("*").single(), "save stats");
    },
    async deleteStats(id) { must(await db.from("cm_post_stats").delete().eq("id", id).select("id"), "delete stats"); },
    async statsOfPost(postId) { return must(await db.from("cm_post_stats").select("*").eq("post_id", postId), "stats of post"); },

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
    /** opts.download: a file name → the link downloads the file under that name (Content-Disposition). */
    async signedUrl(path, seconds = 900, opts = {}) {
      const { data, error } = await bucket().createSignedUrl(path, seconds, opts.download ? { download: opts.download } : undefined);
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
    async upload(path, bytes, contentType) {
      const { error } = await bucket().upload(path, bytes, { contentType, upsert: true });
      if (error) throw new Error(`couldn't save ${path}: ${error.message}`);
    },
    async remove(path) { await bucket().remove([path]); },
    async writeJson(path, value) {
      const { error } = await bucket().upload(path, new Blob([JSON.stringify(value)], { type: "application/json" }), { contentType: "application/json", upsert: true });
      if (error) throw new Error(`couldn't save ${path}: ${error.message}`);
    },
  };
}
