// Cutaway Explainer: names shared by the menu, the route and the page.
export const CUTAWAY_NAME = "Cutaway Explainer";
export const CUTAWAY_PATH = "/workspace/cutaway-explainer";

/**
 * The one switch for the whole template (the page, the Short Form menu and the server use it; no per-user flag).
 * VITE_CUTAWAY_ENABLED=true or false always wins. Unset: ON in local dev and on Vercel preview builds,
 * OFF in production builds, so a merge never shows the unfinished template to real users until it is set to true.
 * The server's twin is the CUTAWAY_ENABLED secret of the cutaway-api function (off unless "true").
 */
export function cutawayEnabled(env = {}) {
  const v = String(env.VITE_CUTAWAY_ENABLED ?? "").trim().toLowerCase();
  if (v === "true") return true;
  if (v === "false") return false;
  return env.DEV === true || env.VITE_VERCEL_ENV === "preview";
}

export const CUTAWAY_ENABLED = cutawayEnabled(import.meta.env ?? {});
