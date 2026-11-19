import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { emailFooter } from "../supabase/functions/_shared/emailRules.js";
import { CAMPAIGNS, TOWN_URL, TOWN_LAUNCH2_DEAL } from "../supabase/functions/_shared/campaigns.js";

// "In This Town" launch, round 2 (owner, 2026-11-19): plain, one link (In This Town) plus the unsubscribe, the deal
// line while the launch deal runs (_shared/launchDeal.js), left out by itself outside it.
const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(root, p), "utf8");
const footer = emailFooter({ unsubscribeUrl: "https://www.tryzyvo.com/unsubscribe?u=1&t=2", why: "why", plain: true });
const HEAD = "Hey,\n\nIt's Niko from Zyvo.\n\nIt's here. You can now make \"In This Town\" Roblox shorts on Zyvo.\n\nThis one's different. Instead of just using AI video generators, it actually animates the whole story, so every scene stays clean and consistent from start to finish. It's the best thing we've ever made.\n\n";
const TAIL = "Make your first one here: tryzyvo.com/workspace/in-this-town\n\nSend me what you make, I want to see it.\n\nNiko\n\n--\n";

test("town_launch2: the owner's text, the deal line during the deal, one link to In This Town", () => {
  const c = CAMPAIGNS.town_launch2;
  assert.equal(TOWN_LAUNCH2_DEAL, true);
  assert.equal(c.from, "Niko <niko@tryzyvo.com>");
  assert.equal(c.subject, "in this town is live");
  assert.equal(c.linkTo, "town");
  const thu = c.render(footer, { link: TOWN_URL, at: "2026-11-19T14:00:00Z" });
  assert.ok(thu.text.startsWith(HEAD + "Launch deal: Starter is 20% off your first month, until Sunday.\n\n" + TAIL), thu.text.slice(0, 900));
  assert.equal([...thu.html.matchAll(/<a href=/g)].length, 2, "the page link plus the unsubscribe");
  assert.match(thu.html, /<a href="https:\/\/www\.tryzyvo\.com\/workspace\/in-this-town"[^>]*>tryzyvo\.com\/workspace\/in-this-town<\/a>/);
  assert.doesNotMatch(thu.html, /<img|<table|utm_/i);
  const after = c.render(footer, { link: TOWN_URL, at: "2026-11-22T22:00:01Z" });
  assert.ok(after.text.startsWith(HEAD + TAIL), "after Sunday 23:59 the deal line is gone by itself");
});

test("town_launch2 pick: never-emailed first, then openers since 4 Nov, then 1 email no open; nobody who got the launch email", () => {
  const sql = read("supabase/migrations/20261208100000_town_launch2.sql");
  assert.match(sql, /q\.campaign like 'town_launch%'\s+and q\.campaign <> p_campaign and q\.status in \('sent', 'sending', 'queued'\)/);
  assert.match(sql, /e\.category = 'marketing'\) >= 2/, "the 2 emails, no opens rule");
  assert.match(sql, /e\.sent_at > p_ends - interval '24 hours'/);
  assert.match(sql, /o\.t > d\.t \+ interval '60 seconds'/);
  assert.match(sql, /case when mk = 0 then 1 when ro_t is not null then 2 else 3 end/);
  assert.match(sql, /timestamptz '2026-11-19 13:00\+00', timestamptz '2026-11-19 19:00\+00'/);
  assert.match(sql, /fill_town_launch2\('town_launch2', 2000\)/);
  assert.match(sql, /'town-launch2-only-today', '5 19 19 11 \*'/);
  const go = read("supabase/migrations/20261208110000_town_launch2_go.sql");
  assert.match(go, /'town-launch2-seed', '30 12 19 11 \*'/);
  assert.match(go, /set status = 'approved' where id = 'town_launch2' and status = 'waiting'/);
});

test("2,000 (owner, 2026-11-19 00:55): the unengaged rule off for ALL marketing, the 347 still first", () => {
  const sql = read("supabase/migrations/20261208120000_town_launch2_fill_2000.sql");
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.claim_email_send\(p_email text, p_kind text, p_category text\)/);
  assert.doesNotMatch(sql, /'reason', 'unengaged'/, "the gate no longer refuses 2 emails without an open");
  for (const keep of ["bad_address", "suppressed", "no_consent", "signed_up_today", "already_sent", "daily_limit"]) assert.match(sql, new RegExp(`'reason', '${keep}'`), keep);
  assert.match(sql, /case when mk = 0 then 1 when ro_t is not null then 2\s+when not \(mk >= 2 and not opened_ever\) then 3\s+else 3 \+ least\(mk, 4\)::int - 1 end/);
  assert.match(sql, /q\.campaign like 'town_launch%'/, "nobody who got the launch email");
  assert.match(sql, /e\.sent_at > p_ends - interval '24 hours'/);
  assert.match(sql, /fill_town_launch2\('town_launch2', 2000\)/);
});
