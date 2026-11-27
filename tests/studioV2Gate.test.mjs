// Studio v2 owner-only go-live (owner 2026-11-27): the server switch, the functions' gate, the routes, the chat's
// In This Town handover (the plan's lines as written) and the "only what is live" switch.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { STUDIO_V2_CLOSED, studioV2Allowed, studioV2Mode } from "../supabase/functions/_shared/studioV2/access.js";
import { LIVE } from "../supabase/functions/_shared/liveFeatures.js";
import { zyvoKnowledge } from "../supabase/functions/_shared/maestro/knowledge.js";
import { systemPrompt } from "../supabase/functions/_shared/maestro/brain.js";
import { STYLES } from "../supabase/functions/_shared/director/styles.js";
import { narrationOf } from "../supabase/functions/_shared/director/storyboard.js";
import { TOWN_LINE_MAX, prepareTown, townLength, townLines } from "../src/lib/townHandover.js";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const OWNER = "owner@example.com";
const verified = (email) => ({ email, email_confirmed_at: "2026-01-01T00:00:00Z" });

test("the switch: owner by default (and for typos), off closes it for the owner too; only a verified listed email", () => {
  for (const raw of [undefined, "", "owner", "OWNER", "everyone", "of"]) assert.equal(studioV2Mode(raw), "owner", String(raw));
  assert.equal(studioV2Mode(" Off "), "off");
  assert.equal(studioV2Allowed({ mode: undefined, user: verified(OWNER), owners: [OWNER] }), true);
  assert.equal(studioV2Allowed({ mode: "everyone", user: verified("someone@else.com"), owners: [OWNER] }), false, "no open mode exists");
  assert.equal(studioV2Allowed({ mode: "owner", user: { email: OWNER }, owners: [OWNER] }), false, "an unverified email is not the owner");
  assert.equal(studioV2Allowed({ mode: "off", user: verified(OWNER), owners: [OWNER] }), false);
  assert.equal(studioV2Allowed({ mode: "owner", user: null, owners: [OWNER] }), false);
  assert.equal(STUDIO_V2_CLOSED.code, "NOT_FOUND");
});

test("maestro-api and director-api check the switch before anything else; access answers only true/false", () => {
  for (const f of ["supabase/functions/maestro-api/index.ts", "supabase/functions/director-api/index.ts"]) {
    const src = read(f);
    const gate = src.indexOf("studioV2Allowed({ mode: Deno.env.get(\"STUDIO_V2_ACCESS\")");
    const handle = src.search(/(maestro|director)\.handle\(u\.id, body\)/);
    assert.ok(gate > 0 && handle > gate, `${f}: the gate runs before the handler`);
    assert.match(src, /status: 404/);
    assert.match(src, /blockyOwners\(Deno\.env\.get\("BLOCKY_WORLDS_OWNER_EMAILS"\)\)/, `${f}: the Blocky owner list`);
  }
  const m = read("supabase/functions/maestro-api/index.ts");
  assert.match(m, /if \(body\?\.action === "access"\) return ok\(req, \{ studioV2: allowed \}\);/);
});

test("the site: every Studio v2 route is wrapped; the browser asks maestro-api and fails closed", () => {
  const app = read("src/App.jsx");
  for (const p of ["/create", "/maestro", "/maestro/:chatId", "/generate", "/ai-studio", "/create/director/:draftId", "/create/:studioId"]) {
    const line = app.split("\n").find((l) => l.includes(`<Route path="${p}" `));
    assert.ok(line, p);
    assert.match(line, /<StudioV2Only>/, `${p} is owner-only`);
  }
  const hook = read("src/lib/studioV2.js");
  assert.match(hook, /functions\.invoke\("maestro-api", \{ body: \{ action: "access" \} \}\)/);
  assert.match(hook, /if \(error\) return false;/, "an error is no, and it isn't remembered");
  assert.match(hook, /data\?\.studioV2 === true/);
  assert.match(read("src/components/StudioV2Only.jsx"), /return <NotFoundRedirect \/>;/);
});

test("In This Town from the chat: the plan's lines word for word, no rewrite, one press at the price on the button", async () => {
  const draft = { title: "The Sneeze", hook: "In this town, nobody sneezes.", scenes: [
    { narration: "In this town, nobody sneezes. Except me." },
    { narration: "Mom says it's rude." },
    { narration: `${"Every morning I hold it in until my ears pop and my eyes water and the whole bus stares at me. ".repeat(6)}Then it happens.` },
  ] };
  const lines = townLines(draft);
  assert.equal(lines[0], "In this town, nobody sneezes. Except me.", "the hook is the first scene's line: not doubled");
  assert.ok(lines.every((l) => l.length <= TOWN_LINE_MAX));
  const words = (t) => t.split(/\s+/).filter(Boolean);
  assert.deepEqual(words(lines.join(" ")), words(narrationOf(draft).replace(/\n/g, " ")), "every word, in order, nothing added or changed");
  assert.deepEqual([25, 45, 60, 64, 86, 200].map(townLength), [60, 60, 60, 60, 90, 120], "60-120 s, the same rounding as the price");
  const calls = [];
  const call = async (action, body) => { calls.push([action, body]); return { id: "d1", check: { problems: [] } }; };
  const p = await prepareTown(call, draft, 60);
  assert.deepEqual(calls.map((c) => c[0]), ["saveScript"], "nothing is started (or charged) while preparing");
  assert.deepEqual(calls[0][1].lines.map((l) => l.text), lines);
  assert.equal(calls[0][1].lengthSec, 60);
  assert.deepEqual(p, { draftId: "d1", credits: 219, lengthSec: 60, problems: [] }, "the price on the button (TOWN_PRICES[60])");
  const card = read("src/components/maestro/MaestroCards.jsx");
  assert.doesNotMatch(card, /adaptStory/, "the chat never sends the plan through the rewriter");
  assert.match(card, /prepareTown\(worldsCall, draft, card\.seconds\)/);
  assert.doesNotMatch(card, /second press/, "one press starts it");
});

test("only what is live: Rewards, Affiliate and the reference scanner stay out until switched on", () => {
  assert.deepEqual({ ...LIVE }, { rewards: false, affiliate: false, referenceScan: false, referenceImages: true });
  const off = zyvoKnowledge({ prices: null, at: Date.parse("2026-12-01T00:00:00Z") });
  assert.doesNotMatch(off, /^REWARDS|^AFFILIATE/m);
  const on = zyvoKnowledge({ prices: null, at: Date.parse("2026-12-01T00:00:00Z"), live: { rewards: true, affiliate: true } });
  assert.match(on, /^REWARDS/m);
  assert.match(on, /^AFFILIATE/m);
  assert.doesNotMatch(systemPrompt(STYLES), /REFERENCE VIDEOS|Rewards, Affiliate/);
  assert.match(systemPrompt(STYLES, { rewards: true, affiliate: true, referenceScan: true }), /REFERENCE VIDEOS/);
  assert.match(read("src/lib/references.js"), /export const REFERENCE_UI = LIVE\.referenceScan \|\| REFERENCE_MOCK;/);
  assert.match(read("src/components/home-v2/HomeHero.jsx"), /if \(!LIVE\.rewards && !LIVE\.affiliate\) return null;/);
});
