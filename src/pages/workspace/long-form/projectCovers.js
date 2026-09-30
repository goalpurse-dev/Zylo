import { supabase } from "../../../lib/supabaseClient";
import { NICHE_GROUPS, findNiche, nicheImagePath } from "./niches";
import { optUrl } from "../../../lib/optImage";

// A project's cover: its chosen YouTube thumbnail, else its first finished
// scene, else the chosen idea's thumbnail, else null -> a neutral cover with
// the title (projectTitle). Never the niche's art: a new project's niche image
// (e.g. "NO FIRE?") looked like a different video while it was drawing.
export function nicheImageFor(niche) {
  if (!niche) return null;
  // The 480 px WebP variant (cards show niche art at 16:9, up to ~300 px wide).
  if (findNiche(niche)) return optUrl(nicheImagePath(niche), 480);
  const group = NICHE_GROUPS.find((g) => g.id === niche);
  return group?.niches?.[0] ? optUrl(nicheImagePath(group.niches[0].id), 480) : null;
}

// A card-sized copy of a storage image (the idea thumbnails are ~7 MB PNGs).
export const smallCover = (url, w = 480) => (url?.includes("/storage/v1/object/public/")
  ? `${url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/")}?width=${w}&height=${Math.round((w * 9) / 16)}&resize=cover&quality=72`
  : url);

// The title a neutral cover shows.
export const projectTitle = (p) => p?.selected_title || p?.selected_idea_title || p?.topic || "Untitled video";

// project id -> cover url, or null (= show the neutral title cover), for the signed-in user's own projects.
export async function fetchProjectCovers() {
  const { data, error } = await supabase.rpc("long_form_project_covers");
  if (error) return new Map();
  return new Map((data ?? []).map((r) => [r.project_id, r.thumbnail_url ?? r.scene_url ?? (r.idea_thumbnail_url ? smallCover(r.idea_thumbnail_url) : null)]));
}
// The cover to show: the covers map wins when it knows the project (null = neutral).
export const coverFor = (covers, p) => (covers.has(p.id) ? covers.get(p.id) : p._thumbnailUrl ?? null);
