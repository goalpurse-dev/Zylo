import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { emailFooter } from "../supabase/functions/_shared/emailRules.js";
import { CAMPAIGNS, TOWN_URL } from "../supabase/functions/_shared/campaigns.js";

// "In This Town" launch (owner, 2026-11-17): plain, one link (the In This Town page) plus the unsubscribe; no gift line.
const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(root, p), "utf8");
const footer = emailFooter({ unsubscribeUrl: "https://www.tryzyvo.com/unsubscribe?u=1&t=2", why: "why", plain: true });

test("town_launch1: the owner's text with the honest Starter line, one link to In This Town", () => {
  const c = CAMPAIGNS.town_launch1;
  assert.equal(TOWN_URL, "https://www.tryzyvo.com/workspace/in-this-town");
  assert.equal(c.from, "Niko <niko@tryzyvo.com>");
  assert.equal(c.subject, "in this town is live");
  assert.equal(c.linkTo, "town");
  const { html, text } = c.render(footer, { link: TOWN_URL });
  assert.equal([...html.matchAll(/<a href=/g)].length, 2, "the page link plus the unsubscribe");
  assert.match(html, /<a href="https:\/\/www\.tryzyvo\.com\/workspace\/in-this-town"[^>]*>tryzyvo\.com\/workspace\/in-this-town<\/a>/);
  assert.doesNotMatch(html, /<img|<table|utm_/i);
  assert.doesNotMatch(text, /shards/i, "no gift line: the gift is not built");
  assert.ok(text.startsWith("Hey,\n\nIt's Niko from Zyvo.\n\nIt's here. You can now make \"In This Town\" Roblox shorts on Zyvo.\n\nThis one's different. Instead of just using AI video generators, it actually animates the whole story, so every scene stays clean and consistent from start to finish. It's the best thing we've ever made.\n\nIt's on the Starter plan and up. See it here: tryzyvo.com/workspace/in-this-town\n\nSend me what you make, I want to see it.\n\nNiko\n\n--\n"));
  assert.match(read("supabase/functions/campaign-sender/index.ts"), /if \(def\.linkTo === "town"\) return TOWN_URL;/);
});

test("town_launch1 pick: the owner's 4 groups first, then the fill to 1,000; only today", () => {
  const sql = read("supabase/migrations/20261207100000_town_launch.sql");
  assert.match(sql, /q\.campaign = 'town_early1'/, "group 2: Sunday's real openers");
  assert.match(sql, /o\.t > d\.t \+ interval '60 seconds'/);
  assert.match(sql, /e\.sent_at > p_ends - interval '24 hours'/);
  assert.match(sql, /e\.category = 'marketing'\) >= 2/);
  assert.match(sql, /when is_me then 1 when so_t is not null then 2 when ro_t is not null or cb_t is not null then 3/);
  assert.match(sql, /fill_town_launch\('town_launch1', 1000, array\['viola\.bernath@icloud\.com', 'djayehmisiedjan@gmail\.com'\]\)/);
  assert.match(sql, /status <> 'queued'\) then\s+return 0;  -- something already went out: never re-pick/);
  assert.match(sql, /'town-launch1-only-today', '5 19 17 11 \*'/);
  const go = read("supabase/migrations/20261207110000_town_launch_go.sql");
  assert.match(go, /'town-launch1-seed', '30 15 17 11 \*'/);
  assert.match(go, /set status = 'approved' where id = 'town_launch1' and status = 'waiting'/);
});
