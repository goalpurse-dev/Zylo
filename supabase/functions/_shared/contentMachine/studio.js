// Content Machine: the Studio tab (Master Prompt v2, owner 2026-10-31). "How I made this" became "videos people watch":
// each video picks ONE angle (cm_studio_angles), starts on the viewer's problem and has Zyvo as the answer. A batch is
// genuinely different videos: different angles, creations, worlds, lengths and end triggers; rendered on the laptop by
// the studio worker (scripts/studio/worker.mjs), which writes each script and checks it against the batch.
//   What the platforms reward (keep in mind when changing this): TikTok weighs interactions and finishing a longer video,
//   and avoids repetition; YouTube Shorts starts with a seed audience, watching vs swiping away, and reduces re-uploads;
//   near-identical templated videos get demoted. So: different footage and concept each time; value over length.
// Pure parts are exported for the tests; studioActions() is the API.
import { ApiError } from "./errors.js";

export const OWNER_EMAIL = "upwardlift6@gmail.com";
export const REUSE_DAYS = 60;              // the owner's finished creations this far back
export const NO_REPEAT_DAYS = 14;          // within this a creation may be reused once, with a different angle and clips
export const WORLDS = ["factory", "cozy", "studio", "sunny"];
export const WINNERS_AFTER_POSTS = 10;     // posts with numbers before batches = 3 winners + 2 experiments
export const VIDEO_USD = 0.1;              // the script (~$0.02) and its new voice lines (~$0.05–0.10); the render is $0

/** The templates the Studio can make (the worker has a capture kit for "ready" ones). */
export const STUDIO_TEMPLATES = Object.freeze({
  ai_fruit_story: { name: "AI Fruit Story", ready: true, source: "fruit_story", menu: ["Short Form", "AI Fruit Story"], route: "/workspace/ai-fruit-story", generate_usd: 1.7, generate_credits: 174 },
  blocky_stories: { name: "Blocky Stories", ready: true, source: "blocky_story", menu: ["Short Form", "Blocky Stories"], route: "/workspace/blocky-stories", angles: ["A5", "A8", "A9"],
    // the owner's filter: no Roblox-lookalike characters (checked by eye, 2026-11-01): these contain the yellow-head, blue-body "noob"
    excluded: ["418ba8bd-b692-40d0-9c0e-a2bdd0762e89", "e12c6d68-5aac-4fe0-ac15-20ad9696c222"] },
  cutaway: { name: "Cutaway Explainer", ready: true, source: "cutaway_run", menu: ["Short Form", "Cutaway Explainer"], route: "/workspace/cutaway-explainer", angles: ["A1", "A4", "A5", "A6"] },
  long_form: { name: "Long Form", ready: true, source: "long_form_project", menu: ["Long Form"], route: "/long-form", angles: ["A6", "A10", "A12"] },
  clay_rescue: { name: "Clay Rescue", ready: false, why: "needs real facts on the fact sheet and a capture kit first" },
});
const TRIGGERS = ["comment", "repost", "save"];

// Third-party brands a line of a reused creation must not name (it is shown with its sound: such a scene is skipped)
const BRANDS = /\b(google|tiktok|instagram|youtube|facebook|whatsapp|snapchat|twitter|netflix|amazon|apple|iphone|android|samsung|microsoft|uber|tinder|starbucks|mcdonald'?s|coca[- ]?cola|pepsi|nike|adidas|disney|marvel|spotify|chatgpt|openai)\b/i;

/** Scenes of a story that may not be shown (a line naming a brand), and whether enough is left to make a video. */
export function sceneFilter(scenes) {
  const skip = scenes.filter((s) => BRANDS.test(s.line ?? "")).map((s) => s.idx);
  const ok = scenes.filter((s) => !skip.includes(s.idx) && s.clip_status === "ready");
  return { skip, usable: ok.length >= 2, reason: ok.length >= 2 ? null : "fewer than 2 clean, finished scenes" };
}

/**
 * Reusable creations, best first. recent: {id: [angles used in the last 14 days]}. A creation may be reused once within 14
 * days, with a different angle (and different clips: the worker keeps out of the segments already shown).
 */
export function rankSources(stories, usedCounts = {}, recent = {}) {
  return stories
    .map((s) => ({ ...s, used: usedCounts[s.id] ?? 0, recent_angles: recent[s.id] ?? [] }))
    .filter((s) => s.filter.usable && s.recent_angles.length < 2)
    .sort((a, b) => a.recent_angles.length - b.recent_angles.length || a.used - b.used || String(b.created_at).localeCompare(String(a.created_at)));
}

/** Which angles fit which creation: its template's list, never an angle it was just used with; each angle once a batch. */
export function assignVideos(recipes, sources, count) {
  const out = [], left = [...sources], taken = new Set();
  for (const src of left) {
    if (out.length >= count) break;
    const fit = STUDIO_TEMPLATES[src.template]?.angles;
    const r = recipes.find((x) => !taken.has(x.angle) && (!fit || fit.includes(x.angle)) && !src.recent_angles?.includes(x.angle));
    if (!r) continue;
    taken.add(r.angle); out.push({ recipe: { ...r, template: src.template }, source: src });
  }
  return out;
}

/** A Studio post's score (0–100): 40% 3 s hold, 30% average % watched, 20% shares + saves per view, 10% comments + likes. */
export function studioScore(st, seconds) {
  if (!st) return null;
  const views = Number(st.views) || 0;
  const rate = (n, k) => (views ? Math.min(1, ((Number(n) || 0) / views) * k) : null);
  const hold3 = st.hold_3s_pct != null ? Number(st.hold_3s_pct) / 100 : null;
  const watch = st.avg_watch_sec != null && seconds ? Math.min(1, Number(st.avg_watch_sec) / seconds) : null;
  if (hold3 == null && watch == null) return null;
  const parts = [[hold3, 0.4], [watch, 0.3], [rate((Number(st.shares) || 0) + (Number(st.saves) || 0), 20), 0.2], [rate((Number(st.comments) || 0) + (Number(st.likes) || 0), 10), 0.1]];
  const known = parts.filter(([v]) => v != null), w = known.reduce((a, [, k]) => a + k, 0);
  return Math.round((known.reduce((a, [v, k]) => a + v * k, 0) / w) * 1000) / 10;
}

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/** Angles with 4 or more posts below the median: retired from new batches. */
export function retiredAngles(history) {
  const scored = history.filter((h) => h.score != null && h.recipe?.angle);
  if (!scored.length) return [];
  const med = median(scored.map((h) => h.score)), below = {};
  for (const h of scored) if (h.score < med) below[h.recipe.angle] = (below[h.recipe.angle] ?? 0) + 1;
  return Object.entries(below).filter(([, n]) => n >= 4).map(([k]) => k);
}

/**
 * The recipes of a batch. Fewer than 10 posts with numbers: different angles, least tried first, lengths mixed (one
 * short, one 60–90 s when there's room). After that: 3 × the best recipe + experiments, each changing ONE variable.
 * Worlds and triggers differ across the batch. only: restrict to these angle keys (the prompt bar).
 */
export function planRecipes({ angles, history = [], n = 5, only = null }) {
  const retired = retiredAngles(history);
  const pool = angles.filter((a) => a.status !== "retired" && !retired.includes(a.key) && (!only || only.includes(a.key)));
  if (!pool.length) return [];
  const tried = {}; for (const h of history) if (h.recipe?.angle) tried[h.recipe.angle] = (tried[h.recipe.angle] ?? 0) + 1;
  const scored = history.filter((h) => h.score != null && h.recipe?.angle);
  const base = (a) => ({ angle: a.key, angle_name: a.name, length_bucket: a.length_bucket, example_hook: a.hooks?.[0] ?? null });
  let out;
  if (scored.length >= WINNERS_AFTER_POSTS && !only) {
    const by = {};
    for (const h of scored) { const k = `${h.recipe.angle}|${h.recipe.world ?? ""}|${h.recipe.end_trigger ?? ""}`; (by[k] ??= { recipe: h.recipe, s: [] }).s.push(h.score); }
    const best = Object.values(by).map((x) => ({ ...x, avg: x.s.reduce((a, b) => a + b, 0) / x.s.length })).sort((a, b) => b.avg - a.avg)[0];
    const W = pool.find((a) => a.key === best.recipe.angle) ?? pool[0], winner = { ...base(W), world: best.recipe.world, end_trigger: best.recipe.end_trigger };
    out = Array.from({ length: Math.min(3, n) }, () => ({ ...winner, why: `the best recipe so far (score ${best.avg.toFixed(1)} over ${best.s.length} posts), a new topic and new footage` }));
    const ex = [
      ...pool.filter((a) => a.key !== W.key).sort((a, b) => (tried[a.key] ?? 0) - (tried[b.key] ?? 0)).map((a) => ({ ...winner, ...base(a), changes: "angle", why: `experiment: the angle "${a.name}" instead of "${W.name}"` })),
      ...WORLDS.filter((x) => x !== winner.world).map((x) => ({ ...winner, world: x, changes: "world", why: `experiment: the ${x} world` })),
      ...TRIGGERS.filter((x) => x !== winner.end_trigger).map((x) => ({ ...winner, end_trigger: x, changes: "end trigger", why: `experiment: ends on "${x}"` })),
    ];
    // every experiment changes one variable; two of them change different ones
    const seen = new Set(); for (const e of ex) { if (out.length >= n) break; if (seen.has(e.changes)) continue; seen.add(e.changes); out.push(e); }
    for (const e of ex) { if (out.length >= n) break; if (!out.includes(e)) out.push(e); }
  } else {
    const sorted = [...pool].sort((a, b) => (tried[a.key] ?? 0) - (tried[b.key] ?? 0) || (a.sort ?? 0) - (b.sort ?? 0));
    const pick = sorted.slice(0, n);
    // the length mix: at least one 60–90 s and one 20–35/30–45 s
    if (n >= 3 && !pick.some((a) => a.length_bucket === "60-90")) { const l = sorted.find((a) => a.length_bucket === "60-90"); if (l) pick[pick.length - 1] = l; }
    if (n >= 3 && !pick.some((a) => ["20-35", "30-45"].includes(a.length_bucket))) { const s = sorted.find((a) => ["20-35", "30-45"].includes(a.length_bucket)); if (s) pick[0] = s; }
    out = pick.map((a) => ({ ...base(a), why: tried[a.key] ? `tried ${tried[a.key]}×` : "not tried yet" }));
  }
  // worlds and end triggers differ across the batch
  const usedW = new Set(out.map((r) => r.world).filter(Boolean)); let wi = 0;
  for (const r of out) { if (r.world) continue; while (usedW.has(WORLDS[wi % WORLDS.length]) && usedW.size < WORLDS.length) wi++; r.world = WORLDS[wi++ % WORLDS.length]; usedW.add(r.world); }
  out.forEach((r, i) => { r.end_trigger ??= TRIGGERS[i % TRIGGERS.length]; r.famous_name = r.angle === "A2"; r.template = "ai_fruit_story"; });
  return out;
}

/** One screen's worth of cost and time, before anything starts. */
export function studioEstimate({ count, reused, generateUsd = 1.7 }) {
  const fresh = Math.max(0, count - reused), usd = Math.round((count * VIDEO_USD + fresh * generateUsd) * 100) / 100;
  return { usd, generation_usd: Math.round(fresh * generateUsd * 100) / 100, minutes: [8 * count, 14 * count + 8 * fresh],
    why: `About $${VIDEO_USD.toFixed(2)} a video: the script and its new voice lines; the render is on the laptop ($0).${fresh ? ` ${fresh} new creation${fresh > 1 ? "s" : ""} on the internal account after your go (~$${generateUsd.toFixed(2)} each).` : " Reuses your finished creations: no generation."}` };
}

const WORKER_FRESH_S = 90;
export function workerState(rows, now) {
  const last = rows.map((r) => new Date(r.last_seen).getTime()).sort((a, b) => b - a)[0];
  const ago = last ? Math.round((now.getTime() - last) / 1000) : null;
  return { online: ago != null && ago <= WORKER_FRESH_S, last_seen_s: ago, workers: rows.map((r) => ({ id: r.id, last_seen: r.last_seen, info: r.info })),
    note: "Jobs wait until the laptop worker runs (the desktop file). A GPU server instead: about $0.50–1.00 an hour on demand, not set up." };
}

/** "Let AI decide": the ready template whose Studio posts score best, else the first ready one. */
export function pickTemplate(history) {
  const ready = Object.entries(STUDIO_TEMPLATES).filter(([, t]) => t.ready).map(([k]) => k);
  const avg = {};
  for (const h of history) if (h.score != null && ready.includes(h.template)) (avg[h.template] ??= []).push(h.score);
  const best = Object.entries(avg).map(([k, v]) => [k, v.reduce((a, b) => a + b, 0) / v.length]).sort((a, b) => b[1] - a[1])[0];
  return best?.[0] ?? ready[0];
}

/** The prompt bar: the template a prompt names ("fruit", "long form"), or null. */
export function templateFromPrompt(text) {
  const t = String(text ?? "").toLowerCase();
  for (const [k, v] of Object.entries(STUDIO_TEMPLATES)) if (t.includes(k.replace(/_/g, " ")) || t.includes(v.name.toLowerCase())) return k;
  if (/\bfruit/.test(t)) return "ai_fruit_story";
  if (/blocky/.test(t)) return "blocky_stories";
  if (/cutaway/.test(t)) return "cutaway";
  if (/long ?form/.test(t)) return "long_form";
  if (/clay/.test(t)) return "clay_rescue";
  return null;
}
/** The prompt bar: the angles a prompt names ("make an A2 one", "a tutorial", "idea list"). */
export function anglesFromPrompt(text, angles) {
  const t = String(text ?? ""), keys = [...t.matchAll(/\bA(\d{1,2})\b/gi)].map((m) => `A${m[1]}`).filter((k) => angles.some((a) => a.key === k));
  if (keys.length) return keys;
  const low = t.toLowerCase(), named = angles.filter((a) => low.includes(a.name.toLowerCase().split(/\s+/).slice(0, 2).join(" "))).map((a) => a.key);
  if (/tutorial|how to/.test(low)) named.push("A6");
  if (/idea/.test(low)) named.push("A7");
  if (/\bclaude|chatgpt\b/.test(low)) named.push("A2");
  return named.length ? [...new Set(named)] : null;
}

/* ─── the API ─────────────────────────────────────────────────────────── */
export function studioActions({ cm, store, now, files }) {
  async function history() {
    const rows = await cm.studioPostHistory();
    return rows.map((r) => ({ recipe: r.recipe, template: r.template, score: studioScore(r.stats, r.seconds) }));
  }
  /** The owner's reusable creations of these templates (the asset filters applied), best first. */
  async function sources(templates) {
    const at = (days) => new Date(now().getTime() - days * 864e5).toISOString();
    const used = await cm.studioSourceUse(), recent = await cm.studioRecentSources(at(NO_REPEAT_DAYS));
    const all = [];
    for (const template of templates) {
      const T = STUDIO_TEMPLATES[template];
      for (const s of await cm.ownerCreations(template, OWNER_EMAIL, at(REUSE_DAYS))) {
        if (T.excluded?.includes(s.id) || BRANDS.test(s.title ?? "")) continue;
        all.push({ kind: T.source, template, id: s.id, title: s.title, created_at: s.created_at, length_sec: s.length_sec, final_url: s.final_url,
          filter: s.scenes ? sceneFilter(s.scenes) : { skip: [], usable: true, reason: null } });
      }
    }
    return rankSources(all, used, recent);
  }

  async function plan(body) {
    const mode = body?.mode === "ai_decide" ? "ai_decide" : "prompt";
    const s = await cm.settings();
    const h = await history(), angles = await cm.studioAngles();
    const named = STUDIO_TEMPLATES[body?.template] ? body.template : templateFromPrompt(body?.prompt);
    const T = named ? STUDIO_TEMPLATES[named] : null;
    if (mode === "prompt" && T && !T.ready) throw new ApiError("VALIDATION", `${T.name} can't be made yet: ${T.why}.`);
    const ready = Object.keys(STUDIO_TEMPLATES).filter((k) => STUDIO_TEMPLATES[k].ready);
    const template = mode === "prompt" && named ? named : pickTemplate(h);
    const only = mode === "prompt" ? anglesFromPrompt(body?.prompt, angles) : null;
    if (mode === "prompt" && !only && !templateFromPrompt(body?.prompt)) throw new ApiError("VALIDATION", `Name a template (${Object.values(STUDIO_TEMPLATES).map((t) => t.name).join(", ")}) or an angle (A1–A12), or let AI decide.`);
    const count = Math.min(10, Math.max(1, Number(body?.count) || (mode === "ai_decide" ? s.studio_batch_size ?? 5 : 1)));
    const found = await sources(mode === "prompt" && named ? [named] : ready);
    const recipes = planRecipes({ angles, history: h, n: angles.length, only });
    // a different creation for each video, its angle fitting its template; none left: a new one (with your go), Fruit only
    const videos = assignVideos(recipes, found, count);
    const fresh = body?.reuse_only ? 0 : count - videos.length;
    for (const r of recipes.filter((x) => !videos.some((v) => v.recipe.angle === x.angle)).slice(0, fresh)) videos.push({ recipe: { ...r, template: "ai_fruit_story" }, source: { kind: "generate" } });
    const reused = videos.filter((v) => v.source.kind !== "generate").length;
    return {
      mode, template, name: mode === "prompt" && named ? STUDIO_TEMPLATES[named].name : "Mixed templates", count: videos.length, videos,
      estimate: studioEstimate({ count: videos.length, reused, generateUsd: STUDIO_TEMPLATES.ai_fruit_story.generate_usd }),
      worker: workerState(await cm.studioWorkers(), now()),
      learning: { posts_with_numbers: h.filter((x) => x.score != null).length, retired: retiredAngles(h), rule: `After ${WINNERS_AFTER_POSTS} posts with numbers: 3 winning recipes + 2 one-change experiments; an angle retires after 4 posts below the median.` },
    };
  }

  return {
    studioPlan: async ({ body }) => plan(body),

    // One job per video. Reuse → queued for the worker; a new creation waits for the owner's go with its cost.
    studioStart: async ({ user, body }) => {
      const p = await plan(body);
      const batch = crypto.randomUUID(), t0 = now().getTime();
      const rows = p.videos.map(({ recipe, source }, i) => ({ created_at: new Date(t0 + i).toISOString(), batch_id: batch, template: recipe.template ?? p.template, mode: p.mode, prompt: body?.prompt ? String(body.prompt).slice(0, 300) : null, recipe,
        source: source.kind === "generate" ? { kind: "generate" } : { kind: source.kind, id: source.id, title: source.title, skip_scenes: source.filter?.skip ?? [] },
        estimate: studioEstimate({ count: 1, reused: source.kind === "generate" ? 0 : 1, generateUsd: STUDIO_TEMPLATES.ai_fruit_story.generate_usd }), status: source.kind === "generate" ? "waiting_go" : "queued", created_by: user.email }));
      const jobs = await cm.createStudioJobs(rows);
      await store.audit(user.email, "studio.start", { batch, template: p.template, count: rows.length, angles: rows.map((r) => r.recipe.angle), estimate: p.estimate });
      return { batch, jobs, estimate: p.estimate, worker: p.worker };
    },

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

    // "Remake same idea" before posting (owner, 2026-11-01): a new job with the same recipe and creation, a new script
    // and voices. The first video stays in the Queue, as with a slideshow's remake.
    studioRemake: async ({ user, body }) => {
      const s = await store.readSettings();
      if (s.kill_switch) throw new ApiError("KILL_SWITCH", "The kill switch is on. Turn it off first.", 409);
      const job = (await cm.listStudioJobs(100)).find((j) => j.id === String(body?.id ?? ""));
      if (!job || job.status !== "done" || !job.idea_id) throw new ApiError("VALIDATION", "Only a finished Studio video can be remade.");
      if (!job.recipe?.angle) throw new ApiError("VALIDATION", "This older video has no angle to remake.");
      const idea = (await cm.studioJobIdeas([job.idea_id]))[job.idea_id];
      if (idea?.status === "posted") throw new ApiError("VALIDATION", "This video is already posted.");
      const [copy] = await cm.createStudioJobs([{ created_at: now().toISOString(), batch_id: crypto.randomUUID(), template: job.template, mode: job.mode, prompt: job.prompt, recipe: job.recipe,
        source: { ...job.source, remake_of: job.id }, estimate: studioEstimate({ count: 1, reused: 1, generateUsd: STUDIO_TEMPLATES.ai_fruit_story.generate_usd }), status: "queued", created_by: user.email }]);
      await store.audit(user.email, "studio.remake", { id: job.id, newId: copy.id, angle: job.recipe.angle });
      return { job: copy };
    },

    // A finished job carries its video at once (owner, 2026-10-30): each one is watchable as soon as it is ready
    studioJobs: async ({ body }) => {
      const jobs = await cm.listStudioJobs(Math.min(100, Math.max(1, Number(body?.limit) || 40)));
      const finished = jobs.filter((j) => j.status === "done" && j.idea_id).map((j) => j.idea_id);
      const videos = await cm.studioJobVideos(finished);
      const ideas = await cm.studioJobIdeas(finished);
      const urls = await files.signedUrls(Object.values(videos), 3600);
      return {
        jobs: jobs.map((j) => ({ ...j, video_url: urls[videos[j.idea_id]] ?? null, idea: ideas[j.idea_id] ?? null })),
        worker: workerState(await cm.studioWorkers(), now()),
        templates: Object.entries(STUDIO_TEMPLATES).map(([k, t]) => ({ key: k, name: t.name, ready: t.ready, why: t.why ?? null })),
      };
    },

    studioAngles: async () => ({ angles: await cm.studioAngles(true) }),

    saveStudioAngle: async ({ user, body }) => {
      const key = String(body?.key ?? "");
      const patch = {};
      if (body?.status != null) { if (!["active", "retired"].includes(body.status)) throw new ApiError("VALIDATION", "Status: active or retired."); patch.status = body.status; }
      for (const f of ["name", "viewer_gets", "zyvo_role", "structure"]) if (body?.[f] != null) { const v = String(body[f]).trim(); if (!v || v.length > 500) throw new ApiError("VALIDATION", `${f}: 1 to 500 characters.`); patch[f] = v; }
      if (body?.hooks != null) patch.hooks = (Array.isArray(body.hooks) ? body.hooks : String(body.hooks).split("\n")).map((x) => String(x).trim()).filter(Boolean).slice(0, 10);
      const angle = await cm.saveStudioAngle(key, { ...patch, updated_by: user.email });
      if (!angle) throw new ApiError("VALIDATION", "No such angle.");
      await store.audit(user.email, "studio.angle", { key, fields: Object.keys(patch) });
      return { angle };
    },
  };
}
