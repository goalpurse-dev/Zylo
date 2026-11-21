import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { emailFooter } from "../supabase/functions/_shared/emailRules.js";
import { CAMPAIGNS, TOWN_FREE_URL } from "../supabase/functions/_shared/campaigns.js";

// "You can try it free now" (owner, 2026-11-21): plain, one link (the free In This Town) plus the unsubscribe, the deal
// line while the launch deal runs, left out by itself after it.
const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(root, p), "utf8");
const footer = emailFooter({ unsubscribeUrl: "https://www.tryzyvo.com/unsubscribe?u=1&t=2", why: "why", plain: true });
const HEAD = "Hey,\n\nIt's Niko from Zyvo.\n\nSome of you told me you wanted to try In This Town before paying. So now you can.\n\nThere's a free version of In This Town. Make your first Roblox short without paying anything.\n\nTry it here: tryzyvo.com/workspace/mcp/templates/in-this-town\n\n(or in Zyvo: MCP → Templates → In This Town)\n\n";
const DEAL = "And if you want the full version, Starter is still 20% off until Sunday.\n\n";
const TAIL = "Send me what you make, I want to see it.\n\nNiko\n\n--\n";

test("town_free1: the owner's text, the deal line during the deal, one link to the free In This Town", () => {
  const c = CAMPAIGNS.town_free1;
  assert.equal(TOWN_FREE_URL, "https://www.tryzyvo.com/workspace/mcp/templates/in-this-town");
  assert.equal(c.from, "Niko <niko@tryzyvo.com>");
  assert.equal(c.subject, "you can try it free now");
  assert.equal(c.linkTo, "town_free");
  assert.equal(c.plain, true);
  assert.equal(c.skipProviderCheck, true, "owner 2026-11-21: this one email skips the Runware/voice start check");
  for (const [id, d] of Object.entries(CAMPAIGNS)) if (id !== "town_free1") assert.notEqual(d.skipProviderCheck, true, id);
  const sat = c.render(footer, { link: TOWN_FREE_URL, at: "2026-11-21T15:00:00Z" });
  assert.ok(sat.text.startsWith(HEAD + DEAL + TAIL), sat.text.slice(0, 900));
  assert.equal([...sat.html.matchAll(/<a href=/g)].length, 2, "the page link plus the unsubscribe");
  assert.match(sat.html, /<a href="https:\/\/www\.tryzyvo\.com\/workspace\/mcp\/templates\/in-this-town"[^>]*>tryzyvo\.com\/workspace\/mcp\/templates\/in-this-town<\/a>/);
  assert.doesNotMatch(sat.html, /<img|<table|utm_/i);
  const after = c.render(footer, { link: TOWN_FREE_URL, at: "2026-11-22T22:00:01Z" });
  assert.ok(after.text.startsWith(HEAD + TAIL), "after Sunday 23:59 the deal line is gone by itself");
});

test("the sender links town_free to the free In This Town", () => {
  const src = read("supabase/functions/campaign-sender/index.ts");
  assert.match(src, /if \(def\.linkTo === "town_free"\) return TOWN_FREE_URL;/);
  assert.match(src, /if \(c\.status === "approved" && def\?\.skipProviderCheck !== true\) \{\s+const down = await providersFailing\(\);/);
});

test("town_free1 pick + the unengaged rule back ON in the gate", () => {
  const sql = read("supabase/migrations/20261221100000_town_free1.sql");
  assert.match(sql, /return jsonb_build_object\('ok', false, 'reason', 'unengaged'\);/, "the gate has the rule again");
  assert.match(sql, /q\.campaign in \('town_early1', 'town_launch1', 'town_launch2'\)/);
  assert.match(sql, /case when town_t is not null then 1 when cb_t is not null then 2 when ro_t is not null then 3 else 4 end/);
  assert.match(sql, /where town_t is not null or cb_t is not null or ro_t is not null or mk = 0;/);
  assert.match(sql, /e\.category = 'marketing'\) >= 2/, "unengaged people are left out of the pick too");
  assert.match(sql, /e\.sent_at > p_ends - interval '24 hours'/);
  assert.match(sql, /o\.t > d\.t \+ interval '60 seconds'/);
  assert.match(sql, /timestamptz '2026-11-21 19:00\+00'/);
  assert.match(sql, /fill_town_free1\('town_free1', 3000\)/);
  assert.match(sql, /'town-free1-only-today', '5 19 21 11 \*'/);
});
