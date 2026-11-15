import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { emailFooter } from "../supabase/functions/_shared/emailRules.js";
import { CAMPAIGNS, TOWN_DAY, campaignStopReason } from "../supabase/functions/_shared/campaigns.js";

// "In This Town" early access (owner, 2026-11-15): plain, no link but the unsubscribe, from Niko on the main domain.
const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(root, p), "utf8");
const footer = emailFooter({ unsubscribeUrl: "https://www.tryzyvo.com/unsubscribe?u=1&t=2", why: "why", plain: true });

test("town_early1: the owner's text, no link but the unsubscribe, the day filled in", () => {
  const c = CAMPAIGNS.town_early1;
  assert.equal(c.from, "Niko <niko@tryzyvo.com>");
  assert.equal(c.replyTo, "niko@tryzyvo.com");
  assert.equal(c.subject, "i've been working on this for weeks");
  assert.equal(c.opensTracked, true);
  const { html, text } = c.render(footer, { link: "https://www.tryzyvo.com/workspace/blocky-stories" });
  assert.doesNotMatch(TOWN_DAY, /\[|\]/, "the launch day must be filled in");
  assert.doesNotMatch(text + html, /\[day\]/);
  assert.equal([...html.matchAll(/<a href=/g)].length, 1, "only the unsubscribe link");
  assert.match(html, /unsubscribe\?u=1/);
  assert.doesNotMatch(html, /<img|<table|blocky-stories|utm_/i);
  assert.doesNotMatch(text.split("--\n")[0], /tryzyvo\.com|https?:/, "no link in the body text");
  assert.ok(text.startsWith("Hey,\n\nIt's Niko from Zyvo.\n\nI've been working on the biggest thing we've ever made, and I wanted you to hear about it first.\n\nIt makes \"In This Town\" Roblox shorts, the ones blowing up on TikTok and YouTube right now. Instead of using AI video generators, it animates the whole story, so every scene looks clean and consistent from start to finish.\n\n"));
  assert.ok(text.includes(`It's coming ${TOWN_DAY}.\n\nWant early access? Just reply "me" and I'll let you in before everyone else.\n\nNiko\n\n--\n`));
});

test("town_early1: stop rules as before (0 complaints, real bounces only)", () => {
  assert.match(campaignStopReason({ sent: 100, bounced: 0, complained: 1 }), /spam complaint/);
  assert.equal(campaignStopReason({ sent: 100, bounced: 5, realBounced: 1, complained: 0 }), null, "mailbox full does not stop it");
});

test("town_early1 pick: group 1 then group 2, the owner's rules, only today", () => {
  const sql = read("supabase/migrations/20261206100000_town_early_access.sql");
  assert.match(sql, /o\.t > d\.t \+ interval '60 seconds'/, "real opens only");
  assert.match(sql, /timestamptz '2026-11-04 00:00\+02'/);
  assert.match(sql, /e\.sent_at > p_ends - interval '24 hours'/);
  assert.match(sql, /e\.category = 'marketing'\) >= 2/, "the 2 emails, no opens rule");
  assert.match(sql, /not exists \(select 1 from email_sends e where e\.email = o\.email and e\.category = 'marketing'\)/, "group 2: no marketing email yet");
  assert.match(sql, /order by t\.grp, t\.last_seen desc/);
  assert.match(sql, /\('town_early1', 'waiting', 0, timestamptz '2026-11-15 16:00\+00', timestamptz '2026-11-15 19:00\+00', null\)/);
  assert.match(sql, /fill_town_early\('town_early1', 500\)/);
  assert.match(sql, /'town-early1-only-today', '5 19 15 11 \*'/);
});
