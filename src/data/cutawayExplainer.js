// Cutaway Explainer: names shared by the menu, the route and the page.
export const CUTAWAY_NAME = "Cutaway Explainer";
export const CUTAWAY_PATH = "/workspace/cutaway-explainer";

/**
 * The one switch for the whole template (the page, the Short Form menu and the server use it; no per-user flag).
 * Launched: ON everywhere. VITE_CUTAWAY_ENABLED=false (then a new production build) is the way to switch the page off.
 * The server's twin is the CUTAWAY_ENABLED secret of the cutaway-api function (off unless "true").
 */
export function cutawayEnabled(env = {}) {
  const v = String(env.VITE_CUTAWAY_ENABLED ?? "").trim().toLowerCase();
  return v !== "false";
}

export const CUTAWAY_ENABLED = cutawayEnabled(import.meta.env ?? {});
