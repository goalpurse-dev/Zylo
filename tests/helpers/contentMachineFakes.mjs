// Content Machine test helpers: an in-memory database (the pipeline's db + the Budget Guard's store),
// fake providers that behave like the real ones (they check the guard's ticket), and the admin API on top.
// Used by tests/contentMachineSlideshows.test.mjs and the browser check scripts/contentMachine/qaPage.mjs.
import { createBudgetGuard, assertTicket } from "../../supabase/functions/_shared/contentMachine/budgetGuard.js";
import { runJob } from "../../supabase/functions/_shared/contentMachine/pipeline.js";
import { costOfUsage } from "../../supabase/functions/_shared/contentMachine/providers/anthropic.js";
import { createHandler } from "../../supabase/functions/_shared/contentMachine/api.js";
import { cors } from "../../supabase/functions/shared/cors.ts";

/* ─── a library like the seeded one (smaller) ────────────────────────── */
export const LIB = {
  formats: ["tool_listicle", "numbered_steps", "pov_text", "myth_fact", "tier_list", "quiz", "meme"].map((key) => ({ key, name: key, description: key, spec: { slides: [5, 7] } })),
  styles: [
    { key: "neon_grid", name: "Neon", description: "", spec: { bg_prompt: "dark grid, no text", bg: "#07060d", fg: "#ffffff", accent: "#a855f7", highlight: "#facc15", font: "anton", grid: true } },
    { key: "minimal_clean", name: "Minimal", description: "", spec: { bg_prompt: "paper, no text", bg: "#f6f3ee", fg: "#111111", accent: "#2563eb", highlight: "#fde047", font: "inter" } },
    { key: "luxury_night", name: "Luxury", description: "", spec: { bg_prompt: "night city, no text", bg: "#0b0b0f", fg: "#ffffff", accent: "#f5c542", highlight: "#f5c542", font: "anton" } },
  ],
  hooks: ["question", "bold_statement", "number_list", "pov", "warning"].map((key) => ({ key, name: key, description: key, spec: {} })),
};

// The Zyvo brand account's part of the library (lanes: ["zyvo"]); the database returns LIB + ZLIB.
export const ZLIB = {
  formats: ["feature_hero", "how_it_works"].map((key) => ({ key, name: key, description: key, spec: { slides: [4, 6], layout: "zyvo" }, lanes: ["zyvo"] })),
  styles: [{ key: "zyvo_brand", name: "Zyvo brand", description: "", spec: { bg: "#090A0A", fg: "#ffffff", accent: "#BEF264", highlight: "#BEF264", font: "inter", brand: true }, lanes: ["zyvo"] }],
  hooks: [{ key: "benefit_promise", name: "Benefit promise", description: "", spec: {}, lanes: ["zyvo"] }],
};
export const FACTS = [
  { key: "lf_length", category: "long_form", claim: "Turn one idea into an 8–15 minute YouTube explainer", detail: "8–15 min", source: "lengthEstimates.js" },
  { key: "fruit_series", category: "fruit_story", claim: "Make a series of up to 10 episodes with the same cast", detail: "3–10", source: "limits.js" },
  { key: "no_autopost", category: "not_feature", claim: "Zyvo does NOT post or schedule to social platforms", detail: null, source: "unreleasedFeatures.js" },
];

/** A Zyvo-account slideshow that passes the checks (real assets aaaa1111 / bbbb2222, cited facts). */
export function validZyvoSlideshow(recipe, title = "One idea in, a finished video out") {
  const S = (kind, headline, extra = {}) => ({ kind, headline, body: null, label: null, items: [], items_right: [], tool: null, image_prompt: null, asset_id: null, assets: [], prompt: null, callout: null, fact_ids: ["lf_length"], is_zyvo: true, ...extra });
  return {
    title, topic: recipe.topic ?? "what Zyvo makes", hook: "One idea in. A finished video out.", hypothesis: "a benefit hook with real outputs",
    slides: [
      S("feature_hero", "One idea in. A *finished video* out.", { assets: [{ asset_id: "aaaa1111", label: "Long Form" }, { asset_id: "bbbb2222", label: "AI Fruit Story" }], callout: "8–15 minute YouTube videos" }),
      S("ui_prompt", "Type one idea", { label: "1", prompt: "Why the Romans built roads that still stand" }),
      S("spotlight", "A whole series, same cast", { assets: [{ asset_id: "bbbb2222", label: "AI Fruit Story" }], body: "Up to 10 episodes with the same characters.", fact_ids: ["fruit_series"] }),
      S("cta_button", "Your first video is one idea away", { body: "Make your first video →", fact_ids: [] }),
    ],
    tools_checked: [], ai_label_required: false, why_it_could_go_viral: "proof with real outputs", virality_score: 6,
    items_right: undefined,
  };
}

/* ─── the in-memory database (pipelineDb + the guard's store) ─────────── */
export function fakeWorld(settings = {}) {
  let n = 0;
  const id = (p) => `${p}-${String(++n).padStart(4, "0")}-aaaa-bbbb-cccc`;
  const s = {
    dry_run: false, kill_switch: false, daily_budget_usd: 3, monthly_budget_usd: 90, per_provider_daily_caps: { runware: 2, anthropic: 1.5, fly: 0.5 },
    lane_daily_caps: { slideshow: 3 }, slideshows_per_day: 2, timezone: "Europe/Helsinki", models: {}, brand_rules: "- Be honest.", experiment_days: 14,
    experiment_started_on: null, daily_auto_run: true, playbook: "", half_life_days: 14, winner_min_successes: 3, analysis_suggest_after: 10, daily_scout: false, run_time_local: "07:00", winners_per_day: 3, experiments_per_day: 2, use_batch_for_daily: true, ...settings,
  };
  const runs = [], ideas = [], gens = [], pkgs = [], jobs = [], ledger = [], audit = [], posts = [], stats = [], stored = {}, analyses = [], scouts = [], facts = FACTS.map((x, n) => ({ id: `F-${n}`, status: "active", ...x }));
  const lanes = {
    creator: { key: "creator", name: "Creator account", brand_rules: "- Be honest. (creator)", cta_style: "soft", post_times: {}, playbook: "", slideshows_per_day: 3 },
    zyvo: { key: "zyvo", name: "Zyvo account", brand_rules: "- Only claims on the fact sheet. (zyvo)", cta_style: "button", post_times: {}, playbook: "", slideshows_per_day: 2 },
  };
  const assets = [
    { id: "A1", ref: "aaaa1111", path: "library/aaaa1111.webp", source_path: "public/lp/stickman/a.webp", kind: "scene", tool: "long_form", subject: "a stickman explaining history", tags: ["stickman"], status: "active" },
    { id: "A2", ref: "bbbb2222", path: "library/bbbb2222.webp", source_path: "public/lp/fruit/b.webp", kind: "output", tool: "ai_fruit_story", subject: "a strawberry on a stage", tags: ["fruit"], status: "active" },
    { id: "A3", ref: "cccc3333", path: "library/cccc3333.webp", source_path: "public/face/c.webp", kind: "output", tool: null, subject: null, tags: [], status: "pending" },
  ];
  const logos = [
    { id: "LOGO-zyvo", name: "Zyvo", domain: "tryzyvo.com", logo_path: "logos/tryzyvo.com.png", source_url: "https://www.tryzyvo.com", approved: true },
    { id: "LOGO-descript", name: "Descript", domain: "descript.com", logo_path: null, source_url: null, approved: false },
  ];
  const cost = (r) => r.actual_usd ?? r.estimated_usd;
  const store = {
    async readSettings() { return { ...s }; },
    async updateSettings(p) { Object.assign(s, p); return { ...s }; },
    async reserve({ provider, operation, estimatedUsd, lane, runId, ideaId, dryRun }) {
      const sum = (f) => ledger.filter(f).reduce((a, r) => a + cost(r), 0);
      const pc = s.per_provider_daily_caps[provider], lc = lane ? s.lane_daily_caps[lane] : null;
      const reason = s.kill_switch ? "kill_switch" : !(estimatedUsd >= 0) ? "bad_estimate" : sum(() => true) + estimatedUsd > s.daily_budget_usd ? "daily_cap"
        : pc != null && sum((r) => r.provider === provider) + estimatedUsd > pc ? "provider_cap" : lc != null && sum((r) => r.lane === lane) + estimatedUsd > lc ? "lane_cap" : null;
      if (reason) return { ok: false, reason };
      const row = { id: id("L"), provider, operation, lane, run_id: runId, idea_id: ideaId, estimated_usd: dryRun ? 0 : estimatedUsd, actual_usd: null, status: "reserved", dry_run: dryRun, would_cost_usd: dryRun ? estimatedUsd : null };
      ledger.push(row);
      return { ok: true, ledger_id: row.id };
    },
    async settle({ ledgerId, actualUsd, status, requestRef, error }) {
      const r = ledger.find((x) => x.id === ledgerId && x.status === "reserved");
      if (!r) return false;
      Object.assign(r, { actual_usd: r.dry_run ? 0 : actualUsd, status, request_ref: requestRef, error });
      return true;
    },
    async ledgerSince() { return [...ledger]; },
    async audit(email, action, payload) { audit.push({ email, action, payload }); },
    async auditLog() { return [...audit]; },
  };
  const db = {
    async settings() { return { ...s }; },
    async updateSettings(p) { Object.assign(s, p); },
    async library() { return { formats: [...LIB.formats, ...ZLIB.formats], styles: [...LIB.styles, ...ZLIB.styles], hooks: [...LIB.hooks, ...ZLIB.hooks] }; },
    async getRun(i) { return runs.find((r) => r.id === i); },
    async updateRun(i, p) { Object.assign(runs.find((r) => r.id === i), p); },
    async createRun(row) {
      if (row.kind === "daily" && runs.some((r) => r.kind === "daily" && r.run_date === row.run_date)) throw new Error("duplicate key value violates unique constraint");
      const r = { id: id("R"), input: {}, ...row }; runs.push(r); return r;
    },
    async recentRecipes() { return ideas.filter((i) => !i.dry_run).map((i) => i.recipe); },
    async recentTitles(_d, ex) { return ideas.filter((i) => !i.dry_run && i.id !== ex && i.title !== "(being written)").map((i) => ({ id: i.id, title: i.title, hook: i.hook })); },
    async createIdeas(rows) { const out = rows.map((r) => ({ id: id("I"), compliance: {}, script: {}, ...r })); ideas.push(...out); return out; },
    async getIdea(i) { return ideas.find((x) => x.id === i); },
    async updateIdea(i, p) { const x = ideas.find((y) => y.id === i); Object.assign(x, p); return x; },
    async ideasOfRun(r) { return ideas.filter((i) => i.run_id === r); },
    async runSpend(r) { return ledger.filter((l) => l.run_id === r).reduce((a, l) => a + cost(l), 0); },
    async ensureGeneration(ideaId) { let g = gens.find((x) => x.idea_id === ideaId); if (!g) { g = { id: id("G"), idea_id: ideaId, kind: "slideshow", status: "queued", source_assets: {}, files: {} }; gens.push(g); } return g; },
    async updateGeneration(i, p) { Object.assign(gens.find((g) => g.id === i), p); },
    async savePackages(g, rows) { for (const r of rows) { const old = pkgs.findIndex((p) => p.generation_id === g && p.platform === r.platform); if (old >= 0) pkgs.splice(old, 1); pkgs.push({ id: id("P"), generation_id: g, ...r }); } },
    async enqueue(rows) { for (const r of rows) jobs.push({ id: id("J"), status: "queued", attempts: 0, max_attempts: 2, payload: {}, run_after: new Date(0).toISOString(), created_at: clock.now.toISOString(), ...r }); },
    async claimJobs(limit) {
      const due = jobs.filter((j) => j.status === "queued" && new Date(j.run_after) <= clock.now).slice(0, limit);
      for (const j of due) { j.status = "running"; j.attempts += 1; }
      return due.map((j) => ({ ...j }));
    },
    async finishJob(i, status, error) { Object.assign(jobs.find((j) => j.id === i), { status, error }); },
    async requeueJob(i, { delaySec, error, keepAttempt, payload }) {
      const j = jobs.find((x) => x.id === i);
      Object.assign(j, { status: "queued", run_after: new Date(clock.now.getTime() + delaySec * 1000).toISOString(), error });
      if (payload) j.payload = payload;
      if (keepAttempt) j.attempts = Math.max(0, j.attempts - 1);
    },
    async dailyRunExists(day) { return runs.some((r) => r.kind === "daily" && r.run_date === day); },
    // The two accounts and the fact sheet
    async lanes() { return JSON.parse(JSON.stringify(lanes)); },
    async saveLane(k, patch) { Object.assign(lanes[k], patch); return { ...lanes[k] }; },
    async facts() { return facts.filter((x) => (x.status ?? "active") === "active"); },
    async listFacts() { return [...facts]; },
    async saveFact(row) { if (row.id) return Object.assign(facts.find((x) => x.id === row.id), row); const x = { id: id("F"), status: "active", category: "other", ...row }; facts.push(x); return x; },
    // Phase 3: analyses and scout reports
    async createAnalysis(row) { const a = { id: id("AN"), created_at: clock.now.toISOString(), ...row }; analyses.unshift(a); return a; },
    async getAnalysis(i) { return analyses.find((a) => a.id === i); },
    async updateAnalysis(i, p) { return Object.assign(analyses.find((a) => a.id === i), p); },
    async listAnalyses(n = 10) { return analyses.slice(0, n); },
    async saveScout(row) { const r = { id: id("SC"), created_at: clock.now.toISOString(), ...row }; scouts.unshift(r); return r; },
    async listScouts(n = 5) { return scouts.slice(0, n); },
    async firstScoutJobAt(iso) { return jobs.filter((j) => j.stage === "scout" && (j.created_at ?? "") >= iso).map((j) => j.created_at).sort()[0] ?? null; },
    async scoutQueuedSince(iso) { return jobs.some((j) => j.stage === "scout" && (j.created_at ?? new Date(0).toISOString()) >= iso); },
    // Part 2: posts and stats snapshots
    async createPost(row) { const p = { id: id("P"), created_at: clock.now.toISOString(), ...row }; posts.push(p); return p; },
    async getPost(i) { const p = posts.find((x) => x.id === i); if (!p) throw new Error("post: not found"); return p; },
    async updatePost(i, patch) { return Object.assign(posts.find((x) => x.id === i), patch); },
    async deletePost(i) { posts.splice(posts.findIndex((x) => x.id === i), 1); for (let k = stats.length - 1; k >= 0; k--) if (stats[k].post_id === i) stats.splice(k, 1); },
    async postsOfIdea(i) { return posts.filter((p) => p.idea_id === i); },
    async listPosts() { return posts.map((p) => { const idea = ideas.find((x) => x.id === p.idea_id); return { ...p, cm_ideas: idea && { ...idea, cm_generations: gens.filter((g) => g.idea_id === idea.id) }, cm_post_stats: stats.filter((x) => x.post_id === p.id) }; }); },
    async getStats(i) { const x = stats.find((y) => y.id === i); if (!x) throw new Error("stats: not found"); return x; },
    async saveStats(row) { if (row.id) { const { id: sid, ...patch } = row; return Object.assign(stats.find((x) => x.id === sid), patch); } const x = { id: id("S"), ...row }; stats.push(x); return x; },
    async deleteStats(i) { stats.splice(stats.findIndex((x) => x.id === i), 1); },
    async statsOfPost(i) { return stats.filter((x) => x.post_id === i); },
    async activeAssets() { return assets.filter((a) => a.status === "active"); },
    async getAssets(ids) { return assets.filter((a) => ids.includes(a.id)); },
    async listAssets({ status = null } = {}) { return assets.filter((a) => !status || a.status === status); },
    async markAssetsFlawed(list) { for (const { ref, reason } of list) { const a = assets.find((x) => x.ref === ref && x.status === "active"); if (a) Object.assign(a, { status: "flawed", flaw_reason: reason }); } },
    async updateAsset(i, p) { const a = assets.find((x) => x.id === i); Object.assign(a, p); return a; },
    async jobsOfRun(r) { return jobs.filter((j) => j.run_id === r); },
    async cancelQueuedJobs(r) { for (const j of jobs) if (j.run_id === r && j.status === "queued") j.status = "cancelled"; },
    async pastRuns() { return runs.filter((r) => r.status === "done" && !r.dry_run && r.finished_at); },
    async approvedLogos() { return logos.map((l) => ({ display: "logo", ...l })); },
    async listLogos() { return [...logos]; },
    async getLogo(i) { const l = logos.find((x) => x.id === i); if (!l) throw new Error("no logo"); return l; },
    async saveLogo(row) { if (row.id) { const l = logos.find((x) => x.id === row.id); Object.assign(l, row); return l; } const l = { id: id("LOGO"), approved: false, logo_path: null, ...row }; logos.push(l); return l; },
    async uploadLogoFile(path, bytes) { uploads.push({ path, size: bytes.length }); },
  };
  const uploads = [];
  const clock = { now: new Date("2026-10-20T06:30:00Z") };   // 09:30 in Helsinki
  return { s, runs, ideas, gens, pkgs, jobs, ledger, audit, logos, uploads, assets, store, db, clock, posts, stats, stored, analyses, scouts, facts, lanes };
}

/* ─── fake providers that behave like the real ones ──────────────────── */
export function validSlideshow(recipe, title = "5 AI tools that replace a video editor") {
  const n = recipe.slide_count;
  const slides = Array.from({ length: n }, (_, i) => ({
    kind: i === 0 ? "cover" : i === n - 1 ? "cta" : "item", headline: i === 0 ? title : `Point ${i}`, body: null, label: null, items: [],
    tool: i > 0 && i < n - 1 ? { name: i === 2 ? "Zyvo" : `Tool${i}`, url: "https://x.com", what_it_does: "Does a real thing." } : null,
    image_prompt: i === 2 ? null : `subject ${i}`, asset_id: null, is_zyvo: i === 2,
  }));
  return { title, topic: "AI tools", hook: "Number 3 surprised me", hypothesis: "question hook beats statement", slides,
    tools_checked: slides.filter((s) => s.tool && s.tool.name !== "Zyvo").map((s) => ({ name: s.tool.name, url: s.tool.url, source_url: s.tool.url })),
    ai_label_required: false, why_it_could_go_viral: "useful", virality_score: 7 };
}
export const PKG = (ok = true) => ({
  tiktok: { title: "3 AI tools that replace a video editor", caption: "Which would you try first?", hashtags: ["#aitools", "#faceless", "#aivideo"], on_screen_text: ["3 tools"] },
  instagram: { caption: "Save this.\nLink in bio → tryzyvo.com", hashtags: ["#aitools", "#faceless", "#aivideo", "#creator", "#youtube"] },
  youtube: { title: "AI tools that replace an editor", description: "Link: https://www.tryzyvo.com/", hashtags: ["#shorts", "#aitools", "#ai"] },
  sound_suggestion: "an upbeat lo-fi sound", compliance: ok ? { ok: true, problems: [] } : { ok: false, problems: ["slide 3 claims an income"] },
});
export const msg = (obj, usage = { input_tokens: 9000, output_tokens: 4000, server_tool_use: { web_search_requests: 3 } }) => ({ id: `msg_${Math.random().toString(36).slice(2, 8)}`, model: "claude-sonnet-5-5", stop_reason: "end_turn", usage, content: [{ type: "text", text: JSON.stringify(obj) }] });

/**
 * refuse: refuse the main model's writes ("once" or "always"); imageFailures: that many image calls fail
 * first (Infinity: all); layoutFails: that many renders come back with a failed layout check.
 */
export function fakeProviders(world, { packageOk = [true], badFirstWrite = false, badAlways = false, refuse = null, imageFailures = 0, layoutFails = 0, qaFlags = [] } = {}) {
  const calls = { messages: [], images: 0, imageAttempts: 0, renders: 0, batches: [], renderJobs: [] };
  let pkgN = 0, writeN = 0, refused = 0;
  const ai = {
    async createMessage(ticket, { request }) {
      assertTicket(ticket, "anthropic");
      calls.messages.push(request);
      if (/final quality check/i.test(request.system[0].text.slice(0, 120))) {
        // The vision QA check: qaFlags[k] = the slide numbers flagged on the k-th check.
        const n = request.messages[0].content.filter((c) => c.type === "image").length;
        const flagged = new Set(qaFlags[calls.qa ?? 0] ?? []);
        calls.qa = (calls.qa ?? 0) + 1;
        const slides = Array.from({ length: n }, (_, i) => ({ slide: i + 1, cut_off_subject: flagged.has(i + 1), garbled_text_in_image: false, distorted_hands_or_faces: false,
          unreadable_text: false, large_empty_area: false, resembles_real_person_or_brand: false, note: flagged.has(i + 1) ? "the head is cut off" : null }));
        const body = msg({ slides }, { input_tokens: 9000, output_tokens: 400 });
        body.model = "claude-haiku-5-5";
        return { body, costUsd: costOfUsage(body.usage, body.model), model: body.model };
      }
      if (/catalogue images/i.test(request.system[0].text.slice(0, 120))) {
        // The asset tagger: anything from a "face" folder shows a realistic human.
        const refs = request.messages[0].content.filter((c) => c.type === "text" && c.text.startsWith("ref ")).map((c) => /^ref (\S+) · from (\S+)/.exec(c.text));
        const images = refs.map(([, ref, from]) => ({ ref, tool: /fruit/.test(from) ? "ai_fruit_story" : "other", kind: "output", style: "cartoon", subject: `a picture from ${from}`, tags: ["test"],
          realistic_human: /face/.test(from), celebrity_or_lookalike: false, third_party_character_or_brand: false, text_heavy: false, usable: !/face/.test(from), reason: /face/.test(from) ? "a realistic face" : null }));
        const body = msg({ images }, { input_tokens: 12000, output_tokens: 800 });
        body.model = "claude-haiku-5-5";
        calls.tagged = (calls.tagged ?? 0) + images.length;
        return { body, costUsd: costOfUsage(body.usage, body.model), model: body.model };
      }
      const isPackage = /package/i.test(request.system[0].text.slice(0, 80));
      if (isPackage) {
        const ok = packageOk[Math.min(pkgN++, packageOk.length - 1)];
        const body = msg(PKG(ok), { input_tokens: 5000, output_tokens: 900 });
        body.model = "claude-haiku-5-5";
        return { body, costUsd: costOfUsage(body.usage, body.model), model: body.model };
      }
      if (refuse && request.model === "claude-sonnet-5-5" && (refuse === "always" || refused === 0)) {
        refused += 1;
        throw Object.assign(new Error("refused (cyber)"), { actualUsd: 0.002, refusal: true });
      }
      const recipe = JSON.parse(/RECIPE: (.*)/.exec(request.messages[0].content)[1]);
      writeN += 1;
      const s = recipe.account === "zyvo" ? validZyvoSlideshow(recipe, `Zyvo ${writeN}: ${recipe.format}`) : validSlideshow(recipe, `Title ${writeN}: 5 tools ${recipe.format} ${recipe.style}`);
      if (badAlways || (badFirstWrite && writeN === 1)) s.slides[0].kind = "item";
      const body = msg(s);
      return { body, costUsd: costOfUsage(body.usage, body.model), model: body.model };
    },
    async createBatch(ticket, { requests }) { assertTicket(ticket, "anthropic"); const b = { id: "batch_1", processing_status: "in_progress", requests }; calls.batches.push(b); return b; },
    async getBatch({ batchId }) { const b = calls.batches.find((x) => x.id === batchId); return { id: b.id, processing_status: b.processing_status, results_url: "https://results" }; },
    async batchResults() {
      const out = {};
      for (const r of calls.batches[0].requests) {
        const recipe = JSON.parse(/RECIPE: (.*)/.exec(r.params.messages[0].content)[1]);
        const m = msg(validSlideshow(recipe, `Batch ${recipe.format} in ${recipe.style}`));
        out[r.custom_id] = { type: "succeeded", message: m, costUsd: costOfUsage(m.usage, m.model, { batch: true }) };
      }
      return out;
    },
  };
  const images = { async generateImage(ticket, { prompt, kind }) {
    assertTicket(ticket, "runware");
    calls.imageAttempts += 1;
    calls.lastImage = { prompt, kind };
    if (calls.imageAttempts <= imageFailures) throw Object.assign(new Error("runware 500"), { actualUsd: 0 });
    calls.images += 1;
    return { url: `https://im.runware.ai/${calls.images}.jpg`, costUsd: 0.0012, taskUUID: `t${calls.images}` };
  } };
  const manifests = new Map();
  const uploaded = new Set();
  const fly = { async startRender(ticket, { job }) {
    assertTicket(ticket, "fly");
    calls.renders += 1; calls.lastRender = job; calls.renderJobs.push(job);
    uploaded.add(job.uploads.manifest);
    manifests.set(job.uploads.manifest, calls.renders <= layoutFails
      ? { ok: false, error: "layout check failed", layout: [{ slide: 2, problems: ["headline needs more than 4 lines: shorten it", "headline overlaps card"] }] }
      : { ok: true, durationSec: 19, sizes: { zip: 1, mp4: 2 } });
    return { machineId: `m${calls.renders}`, startedAt: world.clock.now.getTime() };
  } };
  const files = {
    async signedUpload(p) { return `https://upload/${p}`; },
    async signedUrl(p) { return `https://signed/${p}`; },
    async exists(p) { return [...uploaded].some((u) => u.endsWith(p)); },
    async readJson(p) { const hit = [...manifests.entries()].find(([u]) => u.endsWith(p)); return hit ? hit[1] : null; },
    async signedUrls(ps) { return Object.fromEntries(ps.map((p) => [p, `https://signed/${p}`])); },
    async writeJson(p, v) { world.written = { ...(world.written ?? {}), [p]: v }; },
  };
  return { ai, images, fly, files, calls };
}

export function depsFor(world, providers, guardOpts = {}) {
  return {
    db: world.db, guard: createBudgetGuard({ store: world.store, ...guardOpts }), ...providers,
    env: { anthropicKey: "k", runwareKey: "k", flyToken: "t", flyApp: "zyvo-render", flyImage: "img", fallbacks: true },
    now: () => world.clock.now,
  };
}

/** Runs claimed jobs until none are due (moving the clock past waits). */
export async function drain(world, deps, maxRounds = 80) {
  for (let i = 0; i < maxRounds; i++) {
    const due = await world.db.claimJobs(10);
    if (!due.length) {
      const waiting = world.jobs.filter((j) => j.status === "queued");
      if (!waiting.length) return;
      world.clock.now = new Date(Math.max(...waiting.map((j) => new Date(j.run_after).getTime())) + 1000);
      continue;
    }
    for (const j of due) await runJob(j, deps);
  }
  throw new Error("the pipeline did not settle");
}

export async function startRun(world, { kind = "slideshows", dry = false, count = 2, topic = null } = {}) {
  const run = await world.db.createRun({ run_date: "2026-10-20", kind, status: "pending", dry_run: dry, input: { count, topic } });
  await world.db.enqueue([{ run_id: run.id, stage: "plan" }]);
  return run;
}

export function apiFor(world, extra = {}) {
  const guard = createBudgetGuard({ store: world.store });
  let kicks = 0;
  const cm = {
    ...world.db,
    async listRuns() { return [...world.runs].reverse(); },
    async listIdeas({ runId = null, account = null, status = null } = {}) { return [...world.ideas].reverse().filter((i) => (!runId || i.run_id === runId) && (!account || (i.account ?? "creator") === account) && (!status || i.status === status)).map((i) => ({ ...i, cm_generations: world.gens.filter((g) => g.idea_id === i.id).map((g) => ({ ...g, cm_packages: world.pkgs.filter((p) => p.generation_id === g.id) })) })); },
    async ideaCosts(ids) { return Object.fromEntries(ids.map((i) => [i, { usd: world.ledger.filter((l) => l.idea_id === i).reduce((a, l) => a + (l.actual_usd ?? l.estimated_usd), 0), wouldUsd: 0, byProvider: {}, calls: 0 }])); },
    async libraryAll() { return [...LIB.styles.map((s) => ({ ...s, kind: "style", status: "active" })), ...LIB.formats.map((f) => ({ ...f, kind: "format", status: "active" }))]; },
    async saveLibrary(row) { return row; },
    async getPackage(id) { return world.pkgs.find((p) => p.id === id); },
    async updatePackage(id, patch) { return Object.assign(world.pkgs.find((p) => p.id === id), patch); },
  };
  const handle = createHandler({
    getUser: async () => ({ data: { user: { email: "upwardlift6@gmail.com", email_confirmed_at: "x" } }, error: null }), emails: ["upwardlift6@gmail.com"],
    store: world.store, guard, cors, now: () => world.clock.now, cm, files: { signedUrls: async (ps) => Object.fromEntries(ps.map((p) => [p, `https://signed/${p}`])), signedUrl: async (p) => (p === "assets/zyvo-ui-picker.png" ? "https://signed/shot" : `https://signed/${p}`), upload: async (p, bytes, type) => { world.stored[p] = { bytes: bytes.length, type }; }, remove: async (p) => { delete world.stored[p]; } },
    kick: async () => { kicks += 1; }, ...extra,
  });
  const call = async (body) => (await handle(new Request("https://x", { method: "POST", headers: { Authorization: "Bearer t", Origin: "https://tryzyvo.com" }, body: JSON.stringify(body) }))).json();
  return { call, handle, kicks: () => kicks };
}

