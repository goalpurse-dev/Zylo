import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { emailFooter } from "../supabase/functions/_shared/emailRules.js";
import { CAMPAIGNS, TOWN_FREE_URL } from "../supabase/functions/_shared/campaigns.js";

// "Your In This Town video is waiting" (owner, 2026-11-23): plain, one link (the free In This Town) plus the unsubscribe.
const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(root, p), "utf8");
const footer = emailFooter({ unsubscribeUrl: "https://www.tryzyvo.com/unsubscribe?u=1&t=2", why: "why", plain: true });
const TEXT = "Hey,\n\nIt's Niko from Zyvo.\n\nIn This Town is the best thing we've ever made, and people are already making their first Roblox shorts with it.\n\nYou can make yours for free. Open Zyvo, go to MCP, then Templates, then In This Town.\n\nMake yours here: tryzyvo.com/workspace/mcp/templates/in-this-town\n\nSend me what you make, I want to see it.\n\nNiko\n\n--\n";

test("town_free2: the owner's text, one link to the free In This Town, the normal start check", () => {
  const c = CAMPAIGNS.town_free2;
  assert.equal(c.from, "Niko <niko@tryzyvo.com>");
  assert.equal(c.subject, "your in this town video is waiting");
  assert.equal(c.linkTo, "town_free");
  assert.equal(c.plain, true);
  assert.equal(c.opensTracked, true);
  assert.notEqual(c.skipProviderCheck, true, "only town_free1 skipped the Runware/voice check");
  const m = c.render(footer, { link: TOWN_FREE_URL });
  assert.ok(m.text.startsWith(TEXT), m.text.slice(0, 900));
  assert.equal([...m.html.matchAll(/<a href=/g)].length, 2, "the page link plus the unsubscribe");
  assert.match(m.html, /<a href="https:\/\/www\.tryzyvo\.com\/workspace\/mcp\/templates\/in-this-town"[^>]*>tryzyvo\.com\/workspace\/mcp\/templates\/in-this-town<\/a>/);
  assert.doesNotMatch(m.html, /<img|<table|utm_|20%/i);
});

test("town_free2 pick: 4 groups, the In This Town emails incl. town_free1, the rules", () => {
  const sql = read("supabase/migrations/20261223100000_town_free2.sql");
  assert.match(sql, /q\.campaign in \('town_early1', 'town_launch1', 'town_launch2', 'town_free1'\)/);
  assert.match(sql, /case when town_t is not null then 1 when cb_t is not null then 2 when ro_t is not null then 3 else 4 end/);
  assert.match(sql, /where town_t is not null or cb_t is not null or ro_t is not null or mk = 0;/);
  assert.match(sql, /e\.category = 'marketing'\) >= 2/, "unengaged people are left out");
  assert.match(sql, /e\.sent_at > p_ends - interval '24 hours'/);
  assert.match(sql, /e\.kind = 'campaign:' \|\| p_campaign\)/, "nobody twice (the sends' kind is campaign:<id>)");
  assert.match(sql, /o\.t > d\.t \+ interval '30 seconds'/);
  assert.match(sql, /\('town_free2', 'waiting', 0, timestamptz '2026-11-23 11:00\+00', timestamptz '2026-11-23 19:00\+00', null\)/);
  assert.match(sql, /fill_town_free2\('town_free2', 4000\)/);
  assert.match(sql, /'town-free2-seeds', '30 10 23 11 \*'/);
  assert.match(sql, /status in \('approved', 'sending'\)\);\nselect cron\.unschedule\('town-free2-seeds'\);/, "seeds only once approved");
  assert.match(sql, /'town-free2-only-today', '5 19 23 11 \*'/);
});

test("town_free2 without the rules (owner 2026-11-23 16:07): 16:30, 4,000, only this email skips the choice rules", () => {
  const sql = read("supabase/migrations/20261223120000_town_free2_no_rules.sql");
  assert.match(sql, /v_no_rules boolean := \(p_kind = 'campaign:town_free2'\)/);
  assert.match(sql, /if not v_no_rules and v_signed_up > now\(\) - interval '24 hours'/);
  assert.match(sql, /if not v_no_rules\n\s+and \(select count\(\*\) from email_sends where email = v_email and category = 'marketing'\) >= 2/);
  assert.match(sql, /return jsonb_build_object\('ok', false, 'reason', 'suppressed'\)/, "unsubscribed / bounced / complained are never emailed");
  assert.match(sql, /return jsonb_build_object\('ok', false, 'reason', 'no_consent'\)/, "email updates must be ON");
  assert.match(sql, /'reason', 'already_sent'/);
  assert.match(sql, /p\.email_updates is true/);
  assert.match(sql, /not exists \(select 1 from email_suppressions s/);
  assert.match(sql, /when mk = 0 then 4 else 5 end/);
  assert.match(sql, /starts_at = timestamptz '2026-11-23 14:30\+00'/);
  assert.match(sql, /fill_town_free2\('town_free2', 4000\)/);
  assert.match(sql, /schedule := '3 seconds'/);
  assert.match(sql, /'town-free2-pace-back', '10 19 23 11 \*'/);
  assert.match(sql, /schedule := '10 seconds'/);
});
