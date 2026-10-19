// Content Machine, Part 2: the Posted and Analytics tabs' actions (owner, 2026-10-18).
//   markPosted          a slideshow is posted: platform, post URL, posted time (Helsinki) → it leaves Today
//   posts               every post with its slideshow, thumbnail, snapshots and numbers
//   savePost/deletePost edit or undo a post (undo: the slideshow goes back to Today)
//   saveStats           one stats snapshot (new or edited): its own Helsinki time, the numbers, the screenshot
//   deleteStats
//   readStatsScreenshot the fast model reads the numbers off a pasted screenshot (paid, through the guard)
//   analytics           totals, the posts table, averages, top 5, views over time (analytics.js)
// Every time the owner types or reads is Helsinki wall-clock time; the database keeps UTC.
import { ApiError } from "./errors.js";
import { analytics, postMetrics } from "./analytics.js";
import { estimateUsd, jsonFromMessage } from "./providers/anthropic.js";
import { localToUtc, utcToLocal } from "./localTime.js";
import { cleanStats, statsRequest, STAT_FIELDS } from "./statsReader.js";

export const PLATFORM_HOSTS = Object.freeze({ tiktok: /(^|\.)tiktok\.com$/, instagram: /(^|\.)instagram\.com$/, youtube: /(^|\.)(youtube\.com|youtu\.be)$/ });
const IMAGE_TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const MAX_IMAGE_B64 = 7_000_000;   // about 5 MB of image

export function cleanPostUrl(platform, url) {
  let u;
  try { u = new URL(String(url ?? "").trim()); } catch { throw new ApiError("VALIDATION", "The post URL must be a full link (https://…)."); }
  if (u.protocol !== "https:") throw new ApiError("VALIDATION", "The post URL must start with https://.");
  if (!PLATFORM_HOSTS[platform]?.test(u.hostname.toLowerCase())) throw new ApiError("VALIDATION", `That isn't a ${{ tiktok: "TikTok", instagram: "Instagram", youtube: "YouTube" }[platform]} link.`);
  return u.toString().slice(0, 500);
}

export function postsActions({ cm, files, store, guard, now, ai = null, env = {}, models }) {
  const tz = async () => (await cm.settings()).timezone || "Europe/Helsinki";
  const when = (local, zone, label) => {
    if (local == null || local === "") return now();
    const d = localToUtc(local, zone);
    if (!d) throw new ApiError("VALIDATION", `${label}: a date and time like 2026-10-18 09:30.`);
    if (d.getTime() > now().getTime() + 10 * 60_000) throw new ApiError("VALIDATION", `${label} is in the future.`);
    return d;
  };
  const hoursSince = (postedAt, takenAt) => Math.round(((Date.parse(takenAt) - Date.parse(postedAt)) / 3_600_000) * 100) / 100;

  /** A post as the page shows it: Helsinki times, snapshots with screenshot links, the numbers. */
  const view = (p, zone, urls) => {
    const idea = p.cm_ideas ?? null;
    const stats = (p.cm_post_stats ?? []).sort((a, b) => Date.parse(a.taken_at) - Date.parse(b.taken_at));
    const m = postMetrics({ ...p, stats }, now());
    const png = idea?.cm_generations?.[0]?.files?.pngs?.[0] ?? null;
    return {
      id: p.id, platform: p.platform, account: p.account ?? idea?.account ?? "creator", post_url: p.post_url, posted_at: p.posted_at, posted_local: utcToLocal(p.posted_at, zone),
      idea: idea && { id: idea.id, title: idea.title, recipe: idea.recipe, account: idea.account ?? "creator" }, thumbnail: png ? urls[png] ?? null : null,
      stats: stats.map((s) => ({ ...s, taken_local: utcToLocal(s.taken_at, zone), screenshot: s.screenshot_path ? urls[s.screenshot_path] ?? null : null })),
      metrics: m,
    };
  };

  return {
    markPosted: async ({ user, body }) => {
      const idea = await cm.getIdea(String(body?.ideaId ?? ""));
      if (!["done", "approved", "posted"].includes(idea.status)) throw new ApiError("VALIDATION", "Only a finished slideshow can be marked as posted.");
      const platform = String(body?.platform ?? "");
      if (!PLATFORM_HOSTS[platform]) throw new ApiError("VALIDATION", "Platform: TikTok, Instagram or YouTube.");
      const zone = await tz();
      const account = ["creator", "zyvo"].includes(body?.account) ? body.account : idea.account ?? "creator";   // pre-selected from the slideshow
      const post = await cm.createPost({ idea_id: idea.id, platform, account, post_url: cleanPostUrl(platform, body?.postUrl), posted_at: when(body?.postedAt, zone, "Posted at").toISOString(), posted_by: user.email });
      await cm.updateIdea(idea.id, { status: "posted" });
      await store.audit(user.email, "post.create", { idea: idea.id, platform, url: post.post_url });
      return { post };
    },

    savePost: async ({ user, body }) => {
      const post = await cm.getPost(String(body?.id ?? ""));
      const zone = await tz();
      const platform = body?.platform ? String(body.platform) : post.platform;
      if (!PLATFORM_HOSTS[platform]) throw new ApiError("VALIDATION", "Platform: TikTok, Instagram or YouTube.");
      const patch = { platform, post_url: cleanPostUrl(platform, body?.postUrl ?? post.post_url) };
      if (body?.postedAt) patch.posted_at = when(body.postedAt, zone, "Posted at").toISOString();
      const saved = await cm.updatePost(post.id, patch);
      // The snapshots' "hours since posting" follow the post's time.
      if (patch.posted_at) for (const s of await cm.statsOfPost(post.id)) await cm.saveStats({ id: s.id, hours_since_post: hoursSince(saved.posted_at, s.taken_at) });
      await store.audit(user.email, "post.edit", { id: post.id, patch });
      return { post: saved };
    },

    deletePost: async ({ user, body }) => {
      const post = await cm.getPost(String(body?.id ?? ""));
      for (const s of await cm.statsOfPost(post.id)) if (s.screenshot_path) await files.remove?.(s.screenshot_path);
      await cm.deletePost(post.id);
      const left = await cm.postsOfIdea(post.idea_id);
      if (!left.length) await cm.updateIdea(post.idea_id, { status: "approved" });   // back to Today
      await store.audit(user.email, "post.delete", { id: post.id, idea: post.idea_id, platform: post.platform });
      return { deleted: post.id };
    },

    posts: async () => {
      const zone = await tz();
      const rows = await cm.listPosts();
      const paths = rows.flatMap((p) => [p.cm_ideas?.cm_generations?.[0]?.files?.pngs?.[0], ...(p.cm_post_stats ?? []).map((s) => s.screenshot_path)]).filter(Boolean);
      const urls = await files.signedUrls(paths, 900);
      return { posts: rows.map((p) => view(p, zone, urls)), timezone: zone, fields: STAT_FIELDS };
    },

    saveStats: async ({ user, body }) => {
      const post = await cm.getPost(String(body?.postId ?? ""));
      const zone = await tz();
      let numbers;
      try { numbers = cleanStats(body?.stats); } catch (e) { throw new ApiError("VALIDATION", e.message); }
      const taken = when(body?.takenAt, zone, "Taken at");
      if (taken.getTime() < Date.parse(post.posted_at) - 60 * 60_000) throw new ApiError("VALIDATION", "Taken at is before the post went up.");
      const existing = body?.id ? await cm.getStats(String(body.id)) : null;
      if (existing && existing.post_id !== post.id) throw new ApiError("VALIDATION", "That snapshot belongs to another post.");
      const shot = body?.screenshot;
      if (shot && (!IMAGE_TYPES[shot.contentType] || String(shot.dataBase64 ?? "").length > MAX_IMAGE_B64)) throw new ApiError("VALIDATION", "The screenshot must be a PNG, JPEG or WebP under 5 MB.");
      let row = await cm.saveStats({
        ...(existing ? { id: existing.id } : { post_id: post.id, created_by: user.email }),
        taken_at: taken.toISOString(), hours_since_post: hoursSince(post.posted_at, taken.toISOString()), ...numbers,
        source: shot || existing?.screenshot_path || body?.source === "screenshot" ? "screenshot" : "manual",
      });
      if (shot) {
        const path = `posts/${post.id}/${row.id}.${IMAGE_TYPES[shot.contentType]}`;
        await files.upload(path, Uint8Array.from(atob(shot.dataBase64), (c) => c.charCodeAt(0)), shot.contentType);
        row = await cm.saveStats({ id: row.id, screenshot_path: path });
      }
      await store.audit(user.email, existing ? "stats.edit" : "stats.add", { post: post.id, id: row.id, views: row.views });
      return { stats: row };
    },

    deleteStats: async ({ user, body }) => {
      const s = await cm.getStats(String(body?.id ?? ""));
      if (s.screenshot_path) await files.remove?.(s.screenshot_path);
      await cm.deleteStats(s.id);
      await store.audit(user.email, "stats.delete", { post: s.post_id, id: s.id });
      return { deleted: s.id };
    },

    readStatsScreenshot: async ({ body }) => {
      const contentType = String(body?.contentType ?? "");
      const dataBase64 = String(body?.dataBase64 ?? "");
      if (!IMAGE_TYPES[contentType] || !dataBase64 || dataBase64.length > MAX_IMAGE_B64) throw new ApiError("VALIDATION", "Paste a PNG, JPEG or WebP screenshot under 5 MB.");
      if (!ai?.createMessage || !env.anthropicKey) throw new ApiError("UNAVAILABLE", "Reading screenshots isn't set up on the server.");
      const model = models(await store.readSettings()).fast;
      // An owner-ordered paid call (the paste): through the Budget Guard like every other, lane "stats".
      const r = await guard.spend("anthropic", "anthropic.read_stats", estimateUsd({ model, inputTokens: 2500, outputTokens: 200 }), async (ticket) => {
        const out = await ai.createMessage(ticket, { apiKey: env.anthropicKey, request: statsRequest({ model, contentType, dataBase64 }), timeoutMs: 60_000 });
        return { result: out.body, actualUsd: out.costUsd, requestRef: out.body?.id };
      }, { lane: "stats", live: true });
      return { numbers: jsonFromMessage(r.result), costUsd: r.actualUsd ?? null };
    },

    analytics: async ({ body }) => {
      const rows = await cm.listPosts();
      const posts = rows.map((p) => ({ ...p, idea: p.cm_ideas ?? null, stats: p.cm_post_stats ?? [] }));
      const f = {};
      for (const k of ["platform", "format", "style", "hook", "from", "to", "account"]) if (body?.[k] && body[k] !== "both") f[k] = String(body[k]).slice(0, 40);
      const a = analytics(posts, { filters: f, now: now(), sort: String(body?.sort ?? "score"), dir: body?.dir === "asc" ? "asc" : "desc" });
      const slim = (r) => ({ id: r.post.id, platform: r.post.platform, account: r.post.account ?? "creator", post_url: r.post.post_url, posted_at: r.post.posted_at, title: r.post.idea?.title ?? null, recipe: r.recipe, m: r.m });
      return { ...a, table: a.table.map(slim), top5: a.top5.map(slim) };
    },
  };
}
