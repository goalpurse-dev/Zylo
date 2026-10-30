// Content Machine: the Studio tab (owner, 2026-10-30). Short "how I made this with Zyvo" videos, rendered on the
// laptop by the local studio worker (scripts/studio/worker.mjs, $0) from a REAL finished creation:
//   1. reuse first: the owner's own finished creations of that template (last 30 days; lines naming a third-party
//      brand are skipped), no generation cost; only when nothing is usable, a new one on the internal account, which
//      waits for the owner's go with the cost
//   2. the recipe (hook type, length, end trigger, loop): the five starters until there is data; after 3+ Studio
//      posts above the median, "Let AI decide" makes 3 of the winning recipe + 2 experiments, each changing ONE thing
//   3. the score: 3 s hold first, then average watch %, completion %, then shares, saves, comments, likes
// Pure parts are exported for the tests; studioActions() is the API.
import { ApiError } from "./errors.js";

export const OWNER_EMAIL = "upwardlift6@gmail.com";
export const REUSE_DAYS = 30;

/** The templates the Studio can make (the worker has a capture kit and a script for "ready" ones). */
export const STUDIO_TEMPLATES = Object.freeze({
  ai_fruit_story: { name: "AI Fruit Story", ready: true, source: "fruit_story", menu: ["Short Form", "AI Fruit Story"], generate_usd: 1.7, generate_credits: 174 },
  long_form: { name: "Long Form", ready: false, why: "parked by the owner (2026-10-30)" },
  clay_rescue: { name: "Clay Rescue", ready: false, why: "needs real facts on the fact sheet first" },
});

/** The five starter recipes (the first experiments, rendered 2026-10-30 from "Ten Years Out of Date"). */
export const STARTERS = Object.freeze([
  { variant: "V1", hook_type: "result_first", length_s: [25, 30], end_trigger: "comment", loop: true },
  { variant: "V2", hook_type: "result_first_fast", length_s: [15, 20], end_trigger: "save", loop: true },
  { variant: "V3", hook_type: "pov", length_s: [25, 30], end_trigger: "repost", loop: true },
  { variant: "V4", hook_type: "question", length_s: [30, 35], end_trigger: "comment", loop: true },
  { variant: "V5", hook_type: "cliffhanger", length_s: [25, 30], end_trigger: "repost", loop: true },
]);
const TRIGGERS = ["comment", "save", "repost"];

// Third-party brands a line must not name (the real result is shown with its sound: such a scene is skipped)
const BRANDS = /\b(google|tiktok|instagram|youtube|facebook|whatsapp|snapchat|twitter|netflix|amazon|apple|iphone|android|samsung|microsoft|uber|tinder|starbucks|mcdonald'?s|coca[- ]?cola|pepsi|nike|adidas|disney|marvel|spotify|chatgpt|openai)\b/i;

/** Scenes of a story that may not be shown (a line naming a brand), and whether enough is left to make a video. */
export function sceneFilter(scenes) {
  const skip = scenes.filter((s) => BRANDS.test(s.line ?? "")).map((s) => s.idx);
  const ok = scenes.filter((s) => !skip.includes(s.idx) && s.clip_status === "ready");
  return { skip, usable: ok.length >= 2, reason: ok.length >= 2 ? null : "fewer than 2 clean, finished scenes" };
}

/** Reusable creations, best first: usable, used least by earlier Studio jobs, newest. */
export function rankSources(stories, usedCounts = {}) {
  return stories
    .map((s) => ({ ...s, used: usedCounts[s.id] ?? 0 }))
    .filter((s) => s.filter.usable)
    .sort((a, b) => a.used - b.used || String(b.created_at).localeCompare(String(a.created_at)));
}

/** A Studio post's score (0–100): 3 s hold first, then watch %, completion %, then shares, saves, comments, likes. */
export function studioScore(st, seconds) {
  if (!st) return null;
  const views = Number(st.views) || 0;
  const rate = (n) => (views ? Math.min(1, (Number(n) || 0) / views) : 0);
  const hold3 = st.hold_3s_pct != null ? Number(st.hold_3s_pct) / 100 : null;
  const watch = st.avg_watch_sec != null && seconds ? Math.min(1, Number(st.avg_watch_sec) / seconds) : null;
  const full = st.watched_full_pct != null ? Number(st.watched_full_pct) / 100 : null;
  const parts = [[hold3, 0.35], [watch, 0.25], [full, 0.2], [Math.min(1, rate(st.shares) * 20), 0.08], [Math.min(1, rate(st.saves) * 20), 0.06], [Math.min(1, rate(st.comments) * 20), 0.04], [Math.min(1, rate(st.likes) * 10), 0.02]];
  const known = parts.filter(([v]) => v != null);
  if (!known.length || (hold3 == null && watch == null && full == null)) return null;
  const w = known.reduce((a, [, k]) => a + k, 0);
  return Math.round((known.reduce((a, [v, k]) => a + v * k, 0) / w) * 1000) / 10;
}

const key = (r) => `${r.variant}|${r.end_trigger}|${r.loop ? 1 : 0}`;
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/**
 * The recipes for a batch. history: [{recipe, score}] of posted Studio videos with numbers.
 * Fewer than 3 posts above the median: the starters, least tried first. Otherwise 3 × the winner + experiments that
 * each change ONE thing (the format/hook, the end trigger or the loop), never one already tried as often.
 */
export function chooseRecipes(history, n = 5) {
  const scored = history.filter((h) => h.score != null && h.recipe?.variant);
  const med = scored.length ? median(scored.map((h) => h.score)) : null;
  const above = scored.filter((h) => h.score > med);
  const tried = {};
  for (const h of history) if (h.recipe?.variant) tried[key(h.recipe)] = (tried[key(h.recipe)] ?? 0) + 1;
  if (above.length < 3) {
    const starters = STARTERS.map((r, i) => ({ r, i, t: tried[key(r)] ?? 0 })).sort((a, b) => a.t - b.t || a.i - b.i).map((x) => ({ ...x.r, why: x.t ? `starter, tried ${x.t}×` : "starter, not tried yet" }));
    return Array.from({ length: n }, (_, i) => starters[i % starters.length]);
  }
  const byKey = {};
  for (const h of scored) (byKey[key(h.recipe)] ??= { recipe: h.recipe, scores: [] }).scores.push(h.score);
  const best = Object.values(byKey).map((x) => ({ ...x, avg: x.scores.reduce((a, b) => a + b, 0) / x.scores.length })).sort((a, b) => b.avg - a.avg)[0];
  const W = { variant: best.recipe.variant, hook_type: best.recipe.hook_type, length_s: best.recipe.length_s, end_trigger: best.recipe.end_trigger, loop: best.recipe.loop !== false };
  const winners = Math.min(3, n), out = Array.from({ length: winners }, () => ({ ...W, why: `the winner (average score ${best.avg.toFixed(1)} over ${best.scores.length} posts)` }));
  const candidates = [
    ...STARTERS.filter((s) => s.variant !== W.variant).map((s) => ({ ...W, variant: s.variant, hook_type: s.hook_type, length_s: s.length_s, changes: "format + hook", why: `experiment: the ${s.hook_type} format instead of ${W.hook_type}` })),
    ...TRIGGERS.filter((t) => t !== W.end_trigger).map((t) => ({ ...W, end_trigger: t, changes: "end trigger", why: `experiment: ends on "${t}" instead of "${W.end_trigger}"` })),
    { ...W, loop: !W.loop, changes: "loop", why: `experiment: ${W.loop ? "no" : "a"} seamless loop` },
  ].map((c) => ({ ...c, experiment_of: key(W) })).sort((a, b) => (tried[key(a)] ?? 0) - (tried[key(b)] ?? 0));
  for (const c of candidates) { if (out.length >= n) break; out.push(c); }
  return out;
}

/** What a batch will cost and take, before anything starts. */
export function studioEstimate({ count, reuse, rateFrame0, generateUsd = 1.7 }) {
  const rate = rateFrame0 ? 0.0006 : 0;
  if (reuse) return { usd: Math.round(count * rate * 10000) / 10000, generation_usd: 0, minutes: [6 * count, 10 * count],
    why: `Reuses a finished creation: no generation. The voices are reused takes; the render runs on the laptop ($0).${rateFrame0 ? " The fast model rates each frame 0 (~$0.0006 a video)." : ""}` };
  return { usd: Math.round((generateUsd + count * rate) * 100) / 100, generation_usd: generateUsd, minutes: [6 * count + 5, 10 * count + 8],
    why: `No usable creation in the last ${REUSE_DAYS} days: a new one is made on the internal account first (~$${generateUsd.toFixed(2)}, measured on the live run). It waits for your go.` };
}

const WORKER_FRESH_S = 90;
export function workerState(rows, now) {
  const last = rows.map((r) => new Date(r.last_seen).getTime()).sort((a, b) => b - a)[0];
  const ago = last ? Math.round((now.getTime() - last) / 1000) : null;
  return { online: ago != null && ago <= WORKER_FRESH_S, last_seen_s: ago, workers: rows.map((r) => ({ id: r.id, last_seen: r.last_seen, info: r.info })),
    note: "Jobs wait until the laptop worker runs (node scripts/studio/worker.mjs). A GPU server instead: about $0.50–1.00 an hour on demand (a 25 s video renders in ~6–10 min), not set up." };
}

/** "Let AI decide": the ready template whose Studio posts score best, else the first ready one. */
export function pickTemplate(history) {
  const ready = Object.entries(STUDIO_TEMPLATES).filter(([, t]) => t.ready).map(([k]) => k);
  const avg = {};
  for (const h of history) if (h.score != null && ready.includes(h.template)) (avg[h.template] ??= []).push(h.score);
  const best = Object.entries(avg).map(([k, v]) => [k, v.reduce((a, b) => a + b, 0) / v.length]).sort((a, b) => b[1] - a[1])[0];
  return best?.[0] ?? ready[0];
}

/** "Type a template": the template a prompt names ("fruit", "make a fruit story video"), or null. */
export function templateFromPrompt(text) {
  const t = String(text ?? "").toLowerCase();
  for (const [k, v] of Object.entries(STUDIO_TEMPLATES)) if (t.includes(k.replace(/_/g, " ")) || t.includes(v.name.toLowerCase())) return k;
  if (/\bfruit/.test(t)) return "ai_fruit_story";
  if (/long ?form|youtube/.test(t)) return "long_form";
  if (/clay/.test(t)) return "clay_rescue";
  return null;
}

/* ─── the API ─────────────────────────────────────────────────────────── */
export function studioActions({ cm, store, now }) {
  async function history() {
    const rows = await cm.studioPostHistory();
    return rows.map((r) => ({ recipe: r.recipe, template: r.template, score: studioScore(r.stats, r.seconds) }));
  }
  async function sources(template) {
    const T = STUDIO_TEMPLATES[template];
    if (T?.source !== "fruit_story") return [];
    const since = new Date(now().getTime() - REUSE_DAYS * 864e5).toISOString();
    const stories = await cm.ownerFruitStories(OWNER_EMAIL, since);
    const used = await cm.studioSourceUse();
    return rankSources(stories.map((s) => ({ kind: "fruit_story", id: s.id, title: s.title, created_at: s.created_at, length_sec: s.length_sec, final_url: s.final_url, input: s.input,
      filter: sceneFilter(s.scenes ?? []), scenes: (s.scenes ?? []).length })), used);
  }

  async function plan(body) {
    const mode = body?.mode === "ai_decide" ? "ai_decide" : "prompt";
    const s = await cm.settings();
    const h = await history();
    const template = mode === "ai_decide" ? pickTemplate(h) : (STUDIO_TEMPLATES[body?.template] ? body.template : templateFromPrompt(body?.prompt));
    if (!template) throw new ApiError("VALIDATION", `Name a template (${Object.values(STUDIO_TEMPLATES).map((t) => t.name).join(", ")}) or let AI decide.`);
    const T = STUDIO_TEMPLATES[template];
    if (!T.ready) throw new ApiError("VALIDATION", `${T.name} can't be made yet: ${T.why}.`);
    const count = Math.min(10, Math.max(1, Number(body?.count) || (mode === "ai_decide" ? s.studio_batch_size ?? 5 : 1)));
    const found = await sources(template);
    const recipes = chooseRecipes(h, count);
    const reuse = found.length > 0;
    return {
      mode, template, name: T.name, count, recipes,
      sources: found.slice(0, 8).map(({ input, ...x }) => x), source: found[0] ?? { kind: "generate" },
      estimate: studioEstimate({ count, reuse, rateFrame0: Boolean(s.studio_rate_frame0), generateUsd: T.generate_usd }),
      worker: workerState(await cm.studioWorkers(), now()),
      learning: { posts_with_numbers: h.filter((x) => x.score != null).length, rule: "3+ Studio posts above the median → 3 × the winning recipe + 2 one-change experiments" },
    };
  }

  return {
    studioPlan: async ({ body }) => plan(body),

    // Starts a batch: one job per recipe. Reuse → queued for the worker; a new generation waits for the owner's go.
    studioStart: async ({ user, body }) => {
      const p = await plan(body);
      if (body?.sourceId && !p.sources.some((x) => x.id === body.sourceId)) throw new ApiError("VALIDATION", "That creation can't be reused (too old, deleted, or not clean).");
      const source = body?.sourceId ? p.sources.find((x) => x.id === body.sourceId) : p.source;
      const batch = crypto.randomUUID();
      const rows = p.recipes.map((r) => ({ batch_id: batch, template: p.template, mode: p.mode, prompt: body?.prompt ? String(body.prompt).slice(0, 300) : null, recipe: r,
        source: source.kind === "generate" ? { kind: "generate" } : { kind: source.kind, id: source.id, title: source.title, skip_scenes: source.filter?.skip ?? [] },
        estimate: { ...p.estimate, usd: Math.round((p.estimate.usd / p.count) * 10000) / 10000 }, status: source.kind === "generate" ? "waiting_go" : "queued", created_by: user.email }));
      const jobs = await cm.createStudioJobs(rows);
      await store.audit(user.email, "studio.start", { batch, template: p.template, count: rows.length, source: rows[0].source, estimate: p.estimate });
      return { batch, jobs, estimate: p.estimate, worker: p.worker };
    },

    // The owner's go for a paid generation (the cost was shown on the job)
    studioApprove: async ({ user, body }) => {
      const job = await cm.updateStudioJob(String(body?.id ?? ""), { status: "queued", approved_by: user.email }, ["waiting_go"]);
      if (!job) throw new ApiError("VALIDATION", "Only a job waiting for your go can be approved.");
      await store.audit(user.email, "studio.approve", { id: job.id, estimate: job.estimate });
      return { job };
    },

    studioCancel: async ({ user, body }) => {
      const job = await cm.updateStudioJob(String(body?.id ?? ""), { status: "cancelled", finished_at: now().toISOString() }, ["waiting_go", "queued"]);
      if (!job) throw new ApiError("VALIDATION", "Only a job that hasn't started can be cancelled.");
      await store.audit(user.email, "studio.cancel", { id: job.id });
      return { job };
    },

    studioJobs: async ({ body }) => ({
      jobs: await cm.listStudioJobs(Math.min(100, Math.max(1, Number(body?.limit) || 40))),
      worker: workerState(await cm.studioWorkers(), now()),
      templates: Object.entries(STUDIO_TEMPLATES).map(([k, t]) => ({ key: k, name: t.name, ready: t.ready, why: t.why ?? null })),
    }),
  };
}
