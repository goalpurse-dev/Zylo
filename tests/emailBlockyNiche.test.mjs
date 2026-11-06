import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { emailFooter } from "../supabase/functions/_shared/emailRules.js";
import { BLOCKY_URL, CAMPAIGNS, realOpensProblem } from "../supabase/functions/_shared/campaigns.js";

// The Blocky niche email (owner, 2026-11-06): the owner's text, plain, one link to the Blocky Stories page,
// from the main domain; Mon 150, Tue 250, Wed 400; days 2 and 3 need 8% real opens the day before.
const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(root, p), "utf8");
const footer = emailFooter({ why: "why", unsubscribeUrl: "https://www.tryzyvo.com/unsubscribe?u=x&t=y", plain: true });

test("blocky_niche 1–3: the owner's words, from niko@tryzyvo.com, one link to the Blocky page shown in full", () => {
  assert.equal(BLOCKY_URL, "https://www.tryzyvo.com/workspace/blocky-stories");
  assert.match(read("src/data/blockyStories.js"), /BLOCKY_STORIES_PATH = "\/workspace\/blocky-stories"/, "the page the link points to");
  for (const id of ["blocky_niche1", "blocky_niche2", "blocky_niche3"]) {
    const def = CAMPAIGNS[id];
    assert.equal(def.from, "Niko <niko@tryzyvo.com>");
    assert.equal(def.replyTo, "niko@tryzyvo.com");
    assert.equal(def.subject, "this niche is blowing up right now");
    assert.equal(def.plain, true);
    assert.equal(def.opensTracked, true);
    assert.equal(def.linkTo, "blocky");
    const { html, text } = def.render(footer, { link: BLOCKY_URL });
    assert.equal(text.split("\n\n--\n")[0], [
      "Hey,",
      "It's Niko from Zyvo.",
      "Roblox-style blocky videos are one of the biggest niches on TikTok right now. Some get hundreds of thousands of likes.",
      "You can make them with Zyvo now. Pick an idea and it makes the whole video for you.",
      "Try it here: tryzyvo.com/workspace/blocky-stories",
      "If you make one, reply and send it to me. I want to see it.",
      "Niko",
    ].join("\n\n"));
    const links = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(links, ["https://www.tryzyvo.com/workspace/blocky-stories", "https://www.tryzyvo.com/unsubscribe?u=x&amp;t=y"], "one link plus the unsubscribe");
    assert.match(html, /<a href="https:\/\/www\.tryzyvo\.com\/workspace\/blocky-stories" style="color:#1a56db;">tryzyvo\.com\/workspace\/blocky-stories<\/a>/);
    assert.doesNotMatch(html, /<img|bonus|\+50/i, "no images, no offer");
  }
  assert.equal(CAMPAIGNS.blocky_niche1.minRealOpenRateBefore, undefined);
  assert.equal(CAMPAIGNS.blocky_niche2.minRealOpenRateBefore, 0.08);
  assert.equal(CAMPAIGNS.blocky_niche3.minRealOpenRateBefore, 0.08);
  assert.match(read("supabase/functions/campaign-sender/index.ts"), /if \(def\.linkTo === "blocky"\) return BLOCKY_URL;/);
});

test("the other plain emails keep their short 'tryzyvo.com' link", () => {
  const { html } = CAMPAIGNS.warmup_day4.render(footer, { link: "https://www.tryzyvo.com", offer: false });
  assert.match(html, /<a href="https:\/\/www\.tryzyvo\.com" style="color:#1a56db;">tryzyvo\.com<\/a>/);
});

test("real opens rule: at least 8% of what the day before sent", () => {
  const def = CAMPAIGNS.blocky_niche2;
  assert.equal(realOpensProblem("blocky_niche1", 12, 150, def), null, "12 of 150 = 8%: enough");
  assert.match(realOpensProblem("blocky_niche1", 11, 150, def), /real opens of 7\.3% \(11 of 150\), under 8%/);
  assert.match(realOpensProblem("blocky_niche1", 0, 0, def), /0 of 0/, "sent nothing: no start");
  assert.equal(realOpensProblem("checkin_root2", 2, 40, CAMPAIGNS.checkin_root3), null, "the count rule of the check-in days is unchanged");
  assert.match(realOpensProblem("checkin_root2", 1, 40, CAMPAIGNS.checkin_root3), /1 real opens, under 2/);
});

test("the group and the days are in the migration: ON, active 30 days or opened since October, never twice", () => {
  const sql = read("supabase/migrations/20261202100000_blocky_niche_days.sql");
  assert.match(sql, /create or replace function public\.fill_blocky_niche\(p_campaign text, p_count int\)/);
  assert.match(sql, /p\.email_updates is true/);
  assert.match(sql, /interval '30 days'/);
  assert.match(sql, /type = 'email\.opened' and created_at >= timestamptz '2026-10-01 00:00\+03'/);
  assert.match(sql, /q\.campaign like 'blocky_niche%' and q\.status in \('sent', 'sending', 'queued'\)/, "nobody gets it twice");
  assert.match(sql, /'unengaged'|>= 2\s+and not exists/, "the 2-emails-no-opens rule");
  assert.match(sql, /order by last_seen desc/, "most recently active first");
  for (const [id, n, day] of [["blocky_niche1", 150, "9"], ["blocky_niche2", 250, "10"], ["blocky_niche3", 400, "11"]]) {
    assert.match(sql, new RegExp(`fill_blocky_niche\\('${id}', ${n}\\)`));
    assert.match(sql, new RegExp(`'50 8 ${day} 11 \\*'`));
    assert.match(sql, new RegExp(`'0 13 ${day} 11 \\*'`));
  }
  assert.match(sql, /\('blocky_niche2', 'approved', 0, timestamptz '2026-11-10 09:00\+00', timestamptz '2026-11-10 11:00\+00', 'blocky_niche1'\)/);
  assert.match(sql, /\('blocky_niche3', 'approved', 0, timestamptz '2026-11-11 09:00\+00', timestamptz '2026-11-11 11:00\+00', 'blocky_niche2'\)/);
});
