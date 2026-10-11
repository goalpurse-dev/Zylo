// Blocky Stories: what the app shell needs to know (menus, page title, route)
// without loading the tool itself. The name comes from the one constant the
// server uses too.
export { BLOCKY_STORIES_NAME } from "../../supabase/functions/_shared/blocky/names.js";
export const BLOCKY_STORIES_PATH = "/workspace/blocky-stories";
/** Hidden until launch: on for an account (user_feature_flags) or for everyone (global_feature_flags). */
export const BLOCKY_STORIES_FLAG = "blocky_v1";
/**
 * Launched for everyone on 2026-10-09. Home's build-time HTML shows Blocky's card and section from this
 * (that HTML is what crawlers read, and it is made before any browser can ask the switch). In the browser
 * the live global switch still decides: switch it off and Blocky leaves Home a moment after the page loads.
 * Set this to false as well if Blocky is ever taken down for longer than a moment.
 */
export const BLOCKY_STORIES_LAUNCHED = true;
/**
 * Series inside Blocky Stories: its own switch, OFF for everyone (there is no row for it yet, and no
 * account has it). The page then shows single videos only, and the API refuses every series action.
 * To switch it on later: a row in global_feature_flags, or the flag on one account in user_feature_flags.
 */
export const BLOCKY_SERIES_FLAG = "blocky_series_v1";
/** 880×1168 PNG, like the other template thumbnails (scripts/blocky/thumbnails.mjs). */
export const BLOCKY_STORIES_THUMBNAIL = "/templates/BLOCKY/thumbnail.png";
