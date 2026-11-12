// Blocky Worlds: who may see and use the template at all (owner, 2026-11-12). ONE switch, a function secret of
// blocky-worlds-api:
//
//   BLOCKY_WORLDS_ACCESS=owner       (the default, also for a missing or misspelled value) only the owner: a signed-in
//                                    user whose VERIFIED email is in ADMIN_EMAILS (comma-separated, the same list the
//                                    ops / admin pages and blocky-worlds-library use)
//   BLOCKY_WORLDS_ACCESS=allowlist   the owner + BLOCKY_WORLDS_TEST_USERS (comma-separated verified emails)
//   BLOCKY_WORLDS_ACCESS=everyone    launch: everyone (signed out visitors may browse; doing anything needs sign-in)
//
// The page never decides: it asks the API's `access` action and shows the template only on { visible: true }
// (src/data/blockyWorlds.js). Every other action is refused with OFF before anything is read or charged.
// The old BLOCKY_WORLDS_ENABLED secret is retired: it opens nothing any more.
import { isAdmin } from "../contentMachine/adminGuard.js";

export const ACCESS_MODES = Object.freeze(["owner", "allowlist", "everyone"]);
export const DEFAULT_ACCESS = "owner";

/** The switch's value; anything unknown (empty, a typo) is "owner": the gate fails closed. */
export function accessModeFrom(raw) {
  const v = String(raw ?? "").trim().toLowerCase();
  return ACCESS_MODES.includes(v) ? v : DEFAULT_ACCESS;
}

/**
 * One signed-in user under the switch: owner (ADMIN_EMAILS), tester (the owner, or BLOCKY_WORLDS_TEST_USERS while the
 * switch is allowlist or everyone; in owner mode nobody else is a tester), allowed (may see and use the template).
 */
export function viewerAccess({ mode, user, owners = [], testers = [] }) {
  const m = accessModeFrom(mode);
  const owner = Boolean(user) && isAdmin(user, owners);
  const tester = owner || (m !== "owner" && Boolean(user) && isAdmin(user, testers));
  const allowed = Boolean(user) && (m === "everyone" || (m === "allowlist" ? tester : owner));
  return { owner, tester, allowed };
}

/** A signed-out visitor sees the template only once it is open to everyone. */
export const guestAllowed = (mode) => accessModeFrom(mode) === "everyone";

/** The whole `access` reply for someone the template is closed to: nothing about it (no prices, no settings). */
export const closedReply = (signedIn) => ({ visible: false, signedIn: Boolean(signedIn), enabled: false });
