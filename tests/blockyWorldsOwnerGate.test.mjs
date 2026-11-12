// Blocky Worlds: the owner-only gate (owner, 2026-11-12). One server switch, BLOCKY_WORLDS_ACCESS = owner | allowlist |
// everyone (default owner, fail-closed); the server refuses everyone else on every action; the page shows the menu
// item, the tool shelf card, pinned tools and the route only on the server's { visible: true }. All free: pure helpers
// and the source files read as text.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { ACCESS_MODES, accessModeFrom, BLOCKY_OWNER_EMAILS, blockyOwners, closedReply, DEFAULT_ACCESS, guestAllowed, viewerAccess } from "../supabase/functions/_shared/blockyWorlds/gate.js";
import { adminEmailList } from "../supabase/functions/_shared/contentMachine/adminGuard.js";
import { accessStatusFrom, blockyWorldsRoute, showBlockyWorlds } from "../src/data/blockyWorlds.js";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n"); // CRLF checkouts too
const OWNERS = adminEmailList("Owner@Example.com, second-admin@example.com");
const TESTERS = adminEmailList("tester@example.com");
const user = (email, verified = true) => ({ id: email, email, email_confirmed_at: verified ? "2026-01-01T00:00:00Z" : null });
const OWNER = user("owner@example.com"), TESTER = user("tester@example.com"), NORMAL = user("someone@example.com");
const at = (mode, u) => viewerAccess({ mode, user: u, owners: OWNERS, testers: TESTERS });

// ---------- the switch ----------
test("the switch: owner | allowlist | everyone; default owner; anything unknown is owner (fail closed)", () => {
  assert.deepEqual([...ACCESS_MODES], ["owner", "allowlist", "everyone"]);
  assert.equal(DEFAULT_ACCESS, "owner");
  assert.equal(accessModeFrom("owner"), "owner");
  assert.equal(accessModeFrom(" Allowlist "), "allowlist");
  assert.equal(accessModeFrom("EVERYONE"), "everyone");
  for (const bad of [undefined, null, "", "true", "on", "all", "everyone,", "1", "public"]) assert.equal(accessModeFrom(bad), "owner", String(bad));
});

// ---------- the server's rule ----------
test("owner mode (the default): only the owner; a tester, a normal account and a guest are refused", () => {
  for (const mode of ["owner", undefined, "typo"]) {
    assert.equal(at(mode, OWNER).allowed, true);
    assert.equal(at(mode, OWNER).owner, true);
    assert.equal(at(mode, TESTER).allowed, false);
    assert.equal(at(mode, TESTER).tester, false); // no tester powers (dryRun) in owner mode
    assert.equal(at(mode, NORMAL).allowed, false);
    assert.equal(at(mode, null).allowed, false);
    assert.equal(guestAllowed(mode), false);
  }
});

test("the owner must have a VERIFIED email in the owner list (case-insensitive); an unverified look-alike is refused", () => {
  assert.equal(at("owner", user("OWNER@example.com")).allowed, true);
  assert.equal(at("owner", user("second-admin@example.com")).allowed, true);
  assert.equal(at("owner", user("owner@example.com", false)).allowed, false);
  assert.equal(viewerAccess({ mode: "owner", user: OWNER, owners: [], testers: [] }).allowed, false); // an empty list: nobody
});

// ---------- the Blocky-only owner list (owner, 2026-11-12): a server constant, not ADMIN_EMAILS ----------
test("owner list: one address, a server constant; the optional secret BLOCKY_WORLDS_OWNER_EMAILS overrides it; ADMIN_EMAILS opens nothing", () => {
  assert.equal(BLOCKY_OWNER_EMAILS.length, 1);
  assert.deepEqual(blockyOwners(undefined), [...BLOCKY_OWNER_EMAILS]);
  assert.deepEqual(blockyOwners(""), [...BLOCKY_OWNER_EMAILS]);
  assert.deepEqual(blockyOwners(" , "), [...BLOCKY_OWNER_EMAILS], "an empty secret never empties the list");
  assert.deepEqual(blockyOwners("Other@Example.com, second@example.com"), ["other@example.com", "second@example.com"], "the secret replaces the list");
  assert.ok(Object.isFrozen(BLOCKY_OWNER_EMAILS));
  const mine = user(BLOCKY_OWNER_EMAILS[0]);
  const viewer = (u, raw) => viewerAccess({ mode: "owner", user: u, owners: blockyOwners(raw), testers: [] });
  assert.equal(viewer(mine).allowed, true);
  assert.equal(viewer(mine).owner, true);
  assert.equal(viewer(user(BLOCKY_OWNER_EMAILS[0], false)).allowed, false, "an unverified email is refused");
  // another admin of the other tools (an ADMIN_EMAILS address) is refused in owner mode
  assert.equal(viewer(user("second-admin@example.com")).allowed, false);
  assert.equal(viewer(OWNER).allowed, false);
  // the secret overrides: its address is in, the built-in one is out
  assert.equal(viewer(OWNER, "owner@example.com").allowed, true);
  assert.equal(viewer(mine, "owner@example.com").allowed, false);
  // owner mode = only that list: testers never count
  assert.equal(viewerAccess({ mode: "owner", user: TESTER, owners: blockyOwners(), testers: TESTERS }).allowed, false);
});

test("allowlist mode: the owner + BLOCKY_WORLDS_TEST_USERS; a normal account and a guest are refused", () => {
  assert.equal(at("allowlist", OWNER).allowed, true);
  assert.equal(at("allowlist", TESTER).allowed, true);
  assert.equal(at("allowlist", TESTER).tester, true);
  assert.equal(at("allowlist", user("tester@example.com", false)).allowed, false);
  assert.equal(at("allowlist", NORMAL).allowed, false);
  assert.equal(guestAllowed("allowlist"), false);
});

test("everyone mode (launch): every signed-in user; signed-out visitors may browse", () => {
  assert.equal(at("everyone", NORMAL).allowed, true);
  assert.equal(at("everyone", NORMAL).tester, false);
  assert.equal(at("everyone", OWNER).allowed, true);
  assert.equal(guestAllowed("everyone"), true);
});

test("a closed `access` reply says nothing about the template (no prices, plans, settings)", () => {
  assert.deepEqual(closedReply(true), { visible: false, signedIn: true, enabled: false });
  assert.deepEqual(closedReply(false), { visible: false, signedIn: false, enabled: false });
});

test("blocky-worlds-api: the switch is read once, every action except `access` goes through requireUser / requireWriter, which refuse OFF", () => {
  const src = read("supabase/functions/blocky-worlds-api/index.ts");
  assert.match(src, /const ACCESS = accessModeFrom\(Deno\.env\.get\("BLOCKY_WORLDS_ACCESS"\)\)/);
  assert.doesNotMatch(src, /env\.get\("BLOCKY_WORLDS_ENABLED"\)|flag\("BLOCKY_WORLDS_ENABLED"\)/, "the retired switch must not open anything");
  assert.match(src, /viewerAccess\(\{ mode: ACCESS, user, owners: OWNERS, testers: TESTERS \}\)/);
  assert.match(src, /const OWNERS = blockyOwners\(Deno\.env\.get\("BLOCKY_WORLDS_OWNER_EMAILS"\)\)/);
  assert.doesNotMatch(src, /env\.get\("ADMIN_EMAILS"\)/, "ADMIN_EMAILS opens nothing in the Blocky Worlds API");
  const requireUser = src.slice(src.indexOf("async function requireUser"), src.indexOf("const writerOk"));
  assert.match(requireUser, /if \(!who\) throw new ApiError\("SIGN_IN"\)/);
  assert.match(requireUser, /if \(!who\.allowed\) throw new ApiError\("OFF"\)/);
  assert.match(src, /async function requireWriter[^}]*await requireUser\(req, trace\)/);

  const handle = src.slice(src.indexOf("async function handle("), src.indexOf("Deno.serve("));
  const tail = handle.indexOf("\n  const who = await requireUser(req, trace);\n");
  assert.ok(tail > 0, "the results actions sit behind one requireUser");
  const branches = handle.slice(0, tail).split("\n  if (action === ").slice(1);
  assert.ok(branches.length >= 5);
  for (const b of branches) {
    const name = b.slice(0, b.indexOf(")"));
    if (name === '"access"') {
      assert.match(b, /const visible = who \? who\.allowed : guestAllowed\(ACCESS\);\n\s+if \(!visible\) return closedReply\(Boolean\(who\)\);/);
      assert.ok(b.indexOf("closedReply") < b.indexOf("blocky_worlds_guard"), "closed before any database read");
      continue;
    }
    assert.match(b, /await require(User|Writer)\(req, trace\)/, `${name} must be gated`);
  }
  // everything after the tail (list, status, event, remove, unknown) uses that `who`
  assert.doesNotMatch(handle.slice(tail + 10), /whoIs\(req\)/);
});

test("server: a non-owner is refused and the owner allowed, end to end through the same rule the function uses", () => {
  const OFF = Symbol("OFF"), SIGN_IN = Symbol("SIGN_IN");
  const requireUser = (mode, u) => { if (!u) return SIGN_IN; return at(mode, u).allowed ? "ok" : OFF; };
  assert.equal(requireUser(undefined, NORMAL), OFF);
  assert.equal(requireUser(undefined, TESTER), OFF);
  assert.equal(requireUser(undefined, OWNER), "ok");
  assert.equal(requireUser(undefined, null), SIGN_IN);
  assert.equal(requireUser("everyone", NORMAL), "ok");
});

test("the other blocky-worlds functions: library is owner-only (404), render takes no user session (signed run tokens / cron secret only)", () => {
  const fns = readdirSync(new URL("../supabase/functions/", import.meta.url)).filter((f) => f.startsWith("blocky-worlds"));
  assert.deepEqual(fns.sort(), ["blocky-worlds-api", "blocky-worlds-library", "blocky-worlds-render"], "a new blocky-worlds function needs its own gate check here");
  const lib = read("supabase/functions/blocky-worlds-library/index.ts");
  assert.match(lib, /isAdmin\(data\.user, OWNERS\)/);
  assert.match(lib, /const OWNERS = blockyOwners\(Deno\.env\.get\("BLOCKY_WORLDS_OWNER_EMAILS"\)\)/);
  assert.doesNotMatch(lib, /env\.get\("ADMIN_EMAILS"\)/);
  assert.match(lib, /if \(!cron && !who\) return \{ status: 404/);
  const render = read("supabase/functions/blocky-worlds-render/index.ts");
  assert.match(render, /if \(!RENDER_CONFIG\.callbackSecret\) return json\(\{ error: "not configured" \}, 503\)/);
  assert.match(render, /sameToken\(cron, RENDER_CONFIG\.cronSecret\)/);
  assert.doesNotMatch(render, /auth\.getUser/);
});

// ---------- the page ----------
test("UI: the access answer fails closed (loading and errors hide everything)", () => {
  assert.equal(accessStatusFrom(undefined), "loading");
  assert.equal(accessStatusFrom({ visible: true }), "allowed");
  for (const r of [null, {}, { visible: false }, { visible: "true" }, { visible: 1 }, "ok", { error: "x" }, closedReply(true)]) assert.equal(accessStatusFrom(r), "denied", JSON.stringify(r));
  assert.equal(showBlockyWorlds("allowed"), true);
  assert.equal(showBlockyWorlds("loading"), false);
  assert.equal(showBlockyWorlds("denied"), false);
  assert.equal(showBlockyWorlds(undefined), false);
  assert.equal(blockyWorldsRoute("allowed"), "show");
  assert.equal(blockyWorldsRoute("loading"), "wait");
  assert.equal(blockyWorldsRoute("denied"), "redirect");
  assert.equal(blockyWorldsRoute(undefined), "redirect");
});

test("UI: the access hook asks blocky-worlds-api, maps through accessStatusFrom, never caches a failure", () => {
  const hook = read("src/components/viral-tools/blocky-worlds/api/blockyWorldsAccess.js");
  assert.match(hook, /functions\.invoke\("blocky-worlds-api", \{ body: \{ action: "access" \} \}\)/);
  assert.match(hook, /if \(error \|\| !data\) return "denied";/);
  assert.match(hook, /const status = accessStatusFrom\(data\);\n\s+writeCache\(who, status\);/);
  assert.match(hook, /catch \{\n\s+return "denied";/);
  assert.match(hook, /if \(loading\) return "loading";/);
  // the mock is localhost only: import.meta.env.DEV is false in every build
  assert.match(hook, /const DEV_MOCK = Boolean\(import\.meta\.env\?\.DEV\) &&/);
});

test("UI: menu, tool shelf, bottom-nav menu and pinned tools follow the server's answer only", () => {
  const menu = read("src/components/workspace/CreateMenu.jsx");
  const entry = menu.slice(menu.indexOf('id: "blocky-worlds"'), menu.indexOf('after: "ai-fruit-story"', menu.indexOf('id: "blocky-worlds"')));
  assert.match(entry, /enabled: false,/);
  assert.match(menu, /const worlds = showBlockyWorlds\(useBlockyWorldsAccess\(\)\);/);
  assert.match(menu, /"blocky-worlds": worlds/);
  // the one list every panel uses (desktop panel, mobile bottom-nav menu, toolshell)
  assert.equal((menu.match(/const tools = useShortFormTools\(\);/g) ?? []).length, 2);
  assert.ok(!/CREATE_TOOLS = \[[\s\S]*?id: "blocky-worlds"[\s\S]*?\]\.map/.test(menu.slice(0, menu.indexOf("FLAGGED_CREATE_TOOLS = ["))), "never in the always-on CREATE_TOOLS");
  const shell = read("src/components/workspace/toolshell.jsx");
  assert.match(shell, /\.filter\(\(tool\) => !\(tool\.flag \|\| "enabled" in tool\) \|\| shortFormTools\.some\(\(t\) => t\.id === tool\.id\)\)/);
  assert.doesNotMatch(read("src/components/workspace/MobileBottomNav.jsx"), /blocky-worlds|BLOCKY_WORLDS/i);
});

test("UI: the route is wrapped in the gate, which waits on loading and redirects on denied", () => {
  const app = read("src/App.jsx");
  assert.match(app, /<Route path=\{BLOCKY_WORLDS_PATH\} element=\{<BlockyWorldsGate><BlockyWorlds \/><\/BlockyWorldsGate>\} \/>/);
  assert.equal((app.match(/BLOCKY_WORLDS_PATH/g) ?? []).length, 2, "one import, one route");
  const gate = read("src/components/viral-tools/blocky-worlds/BlockyWorldsGate.jsx");
  assert.match(gate, /blockyWorldsRoute\(useBlockyWorldsAccess\(\)\)/);
  assert.match(gate, /return <Navigate to="\/" replace \/>;/);
  assert.doesNotMatch(gate.slice(gate.indexOf("export default")), /Blocky Worlds/, "the waiting screen says nothing");
  const studio = read("src/components/viral-tools/blocky-worlds/BlockyWorldsStudio.jsx");
  assert.match(studio, /if \(!import\.meta\.env\.DEV\) return <Navigate to="\/" replace \/>;/);
});

test("UI: no build switch and no owner email in front-end code", () => {
  const files = [];
  const walk = (dir) => {
    for (const e of readdirSync(new URL(`../${dir}/`, import.meta.url), { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(p); else if (/\.(jsx?|mjs|json)$/.test(e.name)) files.push(p);
    }
  };
  walk("src");
  for (const f of files) {
    const s = read(f);
    assert.doesNotMatch(s, /VITE_BLOCKY_WORLDS_ENABLED|BLOCKY_WORLDS_VISIBLE|BLOCKY_WORLDS_ENABLED\b/, f);
  }
  for (const f of ["src/data/blockyWorlds.js", "src/components/viral-tools/blocky-worlds/api/blockyWorldsAccess.js", "src/components/viral-tools/blocky-worlds/BlockyWorldsGate.jsx"]) {
    assert.doesNotMatch(read(f), /[\w.+-]+@[\w-]+\.[a-z]{2,}/i, `${f}: no email addresses`);
  }
  // the owner's address lives ONLY in the server constant (gate.js): not one file under src/ or public/ has it
  const owner = BLOCKY_OWNER_EMAILS[0].toLowerCase();
  const front = [];
  const walkFront = (dir) => {
    for (const e of readdirSync(new URL(`../${dir}/`, import.meta.url), { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) walkFront(p); else front.push(p);
    }
  };
  for (const dir of ["src", "public"]) walkFront(dir);
  for (const f of front) if (/\.(jsx?|mjs|json|html|css|txt|xml|svg)$/.test(f)) assert.ok(!read(f).toLowerCase().includes(owner), `${f}: the owner's email must never be in a front-end file`);
  assert.ok(read("supabase/functions/_shared/blockyWorlds/gate.js").includes(owner), "the server constant holds it");
});

test("SEO and public files: no Blocky Worlds in the sitemap, robots, vercel.json, the route SEO policy or the Blocky Stories landing", () => {
  for (const f of ["public/sitemap.xml", "public/robots.txt", "vercel.json", "src/data/routeSeoPolicy.js", "src/data/publicSeoMetadata.js", "src/data/blockyStoryLanding.js", "src/pages/landing/BlockyStoriesLanding.jsx", "scripts/generateSitemap.js", "scripts/generateSeoHtml.js"]) {
    assert.doesNotMatch(read(f), /blocky-worlds|blockyWorlds|Blocky Worlds/i, f);
  }
});
