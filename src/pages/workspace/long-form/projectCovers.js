import { supabase } from "../../../lib/supabaseClient";
import { NICHE_GROUPS, findNiche, nicheImagePath } from "./niches";

// A project's cover: its chosen YouTube thumbnail, else its first finished
// scene, else its niche's art (older projects saved a group id, e.g.
// "history": use that group's first niche). Never one shared fallback.
export function nicheImageFor(niche) {
  if (!niche) return null;
  if (findNiche(niche)) return nicheImagePath(niche);
  const group = NICHE_GROUPS.find((g) => g.id === niche);
  return group?.niches?.[0] ? nicheImagePath(group.niches[0].id) : null;
}

// project id -> cover url, for the signed-in user's own projects.
export async function fetchProjectCovers() {
  const { data, error } = await supabase.rpc("long_form_project_covers");
  if (error) return new Map();
  return new Map((data ?? []).map((r) => [r.project_id, r.thumbnail_url ?? r.scene_url ?? nicheImageFor(r.niche)]).filter(([, url]) => url));
}
