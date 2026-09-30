import { supabase } from "../../lib/supabaseClient";
import { trackSeoEvent } from "../../lib/seoAnalytics";

// Long Form launch — change the date to move the "NEW" badge window.
export const LONG_FORM_LAUNCH_DATE = "2026-09-29";
export const NEW_BADGE_DAYS = 30;
// One-time "What's new" popup key, stored on profiles.seen_announcements.
export const LONG_FORM_ANNOUNCEMENT = "long_form_launch_2026";

const STORAGE = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/showcase`;
export const LONG_FORM_PREVIEW = {
  mp4: `${STORAGE}/preview/long-form-preview.mp4`,
  webm: `${STORAGE}/preview/long-form-preview.webm`,
  poster: `${STORAGE}/preview/long-form-preview.jpg`,
};

export function isLongFormNew(now = Date.now()) {
  const start = Date.parse(`${LONG_FORM_LAUNCH_DATE}T00:00:00Z`);
  return now >= start && now < start + NEW_BADGE_DAYS * 86_400_000;
}

// YouTube's own thumbnail as the fallback when a row has no file of ours.
export function youtubeId(url) {
  const m = String(url ?? "").match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/)([\w-]{11})/);
  return m ? m[1] : null;
}
export function showcaseThumb(video) {
  if (video.thumbnail_url) return video.thumbnail_url;
  const id = youtubeId(video.youtube_url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

// A real YouTube watch link (11-character video id), or null. Links come only
// from showcase_videos; a row without one is never shown (no broken links).
export function validYoutubeUrl(url) {
  const s = String(url ?? "").trim();
  if (!/^https:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//.test(s)) return null;
  const id = youtubeId(s);
  return id && /^[\w-]{11}$/.test(id) ? s : null;
}

// Active showcase rows with a valid link, for one placement ('home' |
// 'long_form'), in order. Cached for 30 s only (dedupes one page's calls),
// so a changed link shows on the next visit without a full reload.
const CACHE_MS = 30_000;
const cache = new Map();
export function fetchShowcase(placement, kind = "example") {
  const key = `${placement}:${kind}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.rows;
  const rows = supabase.from("showcase_videos").select("id, title, youtube_url, thumbnail_url, kind, niche")
    .eq("is_active", true).eq("kind", kind).contains("placements", [placement])
    .order("sort_order").order("created_at")
    .then(({ data, error }) => {
      if (error) { cache.delete(key); return []; }
      return (data ?? []).map((r) => ({ ...r, youtube_url: validYoutubeUrl(r.youtube_url) })).filter((r) => r.youtube_url);
    });
  cache.set(key, { at: Date.now(), rows });
  return rows;
}

// Click tracking: Vercel Analytics (existing) + our marketing_events table,
// which the dashboard can query. Never throws, never blocks the click.
export function trackLaunch(event, { placement = null, target = null, ...meta } = {}) {
  trackSeoEvent(event, { placement, target });
  try {
    supabase.from("marketing_events").insert({ event, placement, target, path: window.location.pathname, meta })
      .then(() => {}, () => {});
  } catch {
    // tracking must never break the page
  }
}
