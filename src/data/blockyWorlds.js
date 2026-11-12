// Blocky Worlds: names shared by the route, the page and the menu.
export const BLOCKY_WORLDS_NAME = "Blocky Worlds";
export const BLOCKY_WORLDS_PATH = "/workspace/blocky-worlds";

/*
 * Who sees Blocky Worlds is decided by the SERVER only (owner, 2026-11-12): blocky-worlds-api's `access` action, under
 * its BLOCKY_WORLDS_ACCESS secret (owner | allowlist | everyone; supabase/functions/_shared/blockyWorlds/gate.js).
 * There is no build switch and no email in this code: the menu, the bottom nav, the tool shelf, pinned tools and the
 * route all follow the one answer below, and it FAILS CLOSED: while the answer is loading, or the call failed, or the
 * reply is anything but { visible: true }, nothing shows and the route sends the visitor home.
 */

/** "loading" (not asked yet / in flight) | "allowed" | "denied" (closed, or the call failed) */
export function accessStatusFrom(reply) {
  if (reply === undefined) return "loading";
  return reply && typeof reply === "object" && reply.visible === true ? "allowed" : "denied";
}

/** In the tool shelf, the menus and the pinned tools: only on a confirmed "allowed". */
export const showBlockyWorlds = (status) => status === "allowed";

/** The route: "show" the page, "wait" (render nothing Blocky Worlds), or "redirect" home. */
export function blockyWorldsRoute(status) {
  if (status === "allowed") return "show";
  if (status === "loading") return "wait";
  return "redirect";
}
