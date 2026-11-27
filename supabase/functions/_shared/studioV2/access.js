// Studio v2 (the chat-style Maestro, the Create hub and its studios, the Director, Quick Generate, the new menu, Home
// and Library): WHO SEES IT (owner, 2026-11-27: "owner-only, checked on the server, not just hidden in the browser").
//
// ONE switch, the function secret STUDIO_V2_ACCESS on maestro-api AND director-api:
//   owner  (the default, also for a missing or misspelled value) only the owner: a signed-in user whose VERIFIED email
//          is in the Blocky owner list (_shared/blockyWorlds/gate.js blockyOwners, the list Maestro already used)
//   off    nobody, the owner included: the one-step rollback. Every page shows today's site again on its next load
//          (the browser's answer is kept at most 10 minutes), and both functions refuse every request.
//
// The page never decides: it asks maestro-api { action: "access" } (src/lib/studioV2.js) and shows Studio v2 only on
// { studioV2: true }. Every other action of both functions is refused (404, the same as an unknown function) before
// anything is read, written or sent to a model.
import { isAdmin } from "../contentMachine/adminGuard.js";

export const STUDIO_V2_MODES = Object.freeze(["owner", "off"]);

/** the switch's value; anything but "off" is "owner" (the gate fails closed to the owner list) */
export function studioV2Mode(raw) {
  return String(raw ?? "").trim().toLowerCase() === "off" ? "off" : "owner";
}

/** may this signed-in user (supabase-js user: email + email_confirmed_at) see and use Studio v2? */
export function studioV2Allowed({ mode, user, owners = [] }) {
  if (studioV2Mode(mode) === "off") return false;
  return isAdmin(user, owners);
}

export const STUDIO_V2_CLOSED = Object.freeze({ code: "NOT_FOUND", message: "Requested function was not found" });
