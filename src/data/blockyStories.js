// Blocky Stories: what the app shell needs to know (menus, page title, route)
// without loading the tool itself. The name comes from the one constant the
// server uses too.
export { BLOCKY_STORIES_NAME } from "../../supabase/functions/_shared/fruit/niches/names.js";
export const BLOCKY_STORIES_PATH = "/workspace/blocky-stories";
/** Hidden until launch: on for an account (user_feature_flags) or for everyone (global_feature_flags). */
export const BLOCKY_STORIES_FLAG = "blocky_v1";
/** 880×1168 PNG, like the other template thumbnails (scripts/blocky/thumbnails.mjs). */
export const BLOCKY_STORIES_THUMBNAIL = "/templates/BLOCKY/thumbnail.png";
