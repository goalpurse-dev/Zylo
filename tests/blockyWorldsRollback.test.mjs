// THE 1-MINUTE HIDE (docs/blocky-worlds-launch.md "Rollback"): which secret value closes Blocky Worlds for EVERYONE,
// the owner included. BLOCKY_WORLDS_ACCESS has no "off": an unknown value fails closed to "owner", so the owner would
// still see it. Setting BLOCKY_WORLDS_OWNER_EMAILS to an address nobody signs in with replaces the owner list: nobody is
// an owner, and in owner mode nobody else is allowed.
import test from "node:test";
import assert from "node:assert/strict";
import { accessModeFrom, blockyOwners, guestAllowed, viewerAccess } from "../supabase/functions/_shared/blockyWorlds/gate.js";

const owner = { email: "upwardlift6@gmail.com", email_confirmed_at: "2026-01-01T00:00:00Z" };
const other = { email: "someone@example.com", email_confirmed_at: "2026-01-01T00:00:00Z" };
const HIDE = "closed@blocky-worlds.invalid";

test("today: owner-only (BLOCKY_WORLDS_ACCESS=owner): the owner sees it, nobody else, no guest", () => {
  assert.equal(viewerAccess({ mode: "owner", user: owner, owners: blockyOwners("") }).allowed, true);
  assert.equal(viewerAccess({ mode: "owner", user: other, owners: blockyOwners("") }).allowed, false);
  assert.equal(guestAllowed("owner"), false);
});

test("BLOCKY_WORLDS_ACCESS=off is NOT a hide: it fails closed to owner mode (the owner still sees it)", () => {
  assert.equal(accessModeFrom("off"), "owner");
  assert.equal(viewerAccess({ mode: "off", user: owner, owners: blockyOwners("") }).allowed, true);
});

test("THE HIDE: BLOCKY_WORLDS_OWNER_EMAILS=<an address nobody uses> closes it for everyone, the owner included", () => {
  for (const mode of ["owner", "off", ""]) {
    for (const user of [owner, other, null]) assert.equal(viewerAccess({ mode, user, owners: blockyOwners(HIDE) }).allowed, false, `${mode} ${user?.email}`);
    assert.equal(guestAllowed(mode), false);
  }
  // undo: unset the secret (the built-in owner list comes back)
  assert.equal(viewerAccess({ mode: "owner", user: owner, owners: blockyOwners("") }).allowed, true);
});
