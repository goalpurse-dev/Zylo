// Blocky Worlds: names shared by the route, the page and the menu.
export const BLOCKY_WORLDS_NAME = "Blocky Worlds";
export const BLOCKY_WORLDS_PATH = "/workspace/blocky-worlds";

/**
 * The page's build switch: OFF until launch (only testers, BLOCKY_WORLDS_TEST_USERS on the server, see the page through
 * the API's access action). VITE_BLOCKY_WORLDS_ENABLED=true (then a new production build) opens it for everyone.
 * The server's twin is the BLOCKY_WORLDS_ENABLED secret of blocky-worlds-api.
 */
export function blockyWorldsEnabled(env = {}) {
  return String(env.VITE_BLOCKY_WORLDS_ENABLED ?? "").trim().toLowerCase() === "true";
}
export const BLOCKY_WORLDS_ENABLED = blockyWorldsEnabled(import.meta.env ?? {});

/**
 * In the tool shelf and the bottom nav: on localhost (`npm run dev`, where the page runs in free mock mode) or when the
 * build switch is on. A production build (the live site, Vercel previews) has import.meta.env.DEV false, so it stays
 * hidden there until launch.
 */
export const BLOCKY_WORLDS_VISIBLE = BLOCKY_WORLDS_ENABLED || Boolean(import.meta.env?.DEV);
