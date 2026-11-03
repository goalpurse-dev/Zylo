import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { emailFooter } from "../supabase/functions/_shared/emailRules.js";
import { CAMPAIGNS, campaignNumbers, openRateProblem } from "../supabase/functions/_shared/campaigns.js";

// The Gmail reputation week (owner, 2026-10-29): "did you get to try it?", plain, no link, no offer;
// seed copies before every day; no marketing for anyone with 2 marketing emails and no open;
// later days stop when a day's opens are under 10% 12 hours after its start.
const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(root, p), "utf8");
const footer = emailFooter({ why: "why", unsubscribeUrl: "https://www.tryzyvo.com/unsubscribe?u=x&t=y", plain: true });

test("check-in days 1–7: the owner's text, plain, no link but the footer's unsubscribe, no offer", () => {
  for (let d = 1; d <= 7; d++) {
    const def = CAMPAIGNS[`checkin_day${d}`];
    assert.ok(def, `checkin_day${d}`);
    assert.equal(def.subject, "did you get to try it?");
    assert.equal(def.plain, true);
    assert.equal(def.opensTracked, true);
    const { html, text } = def.render(footer, { link: "https://www.tryzyvo.com", at: Date.parse("2026-10-30T12:00:00Z") });
    assert.equal(text.split("\n\n--\n")[0], [
      "Hey,",
      "It's Niko from Zyvo. Quick check-in.",
      "Did you get to make a video with Zyvo yet? What kind of page are you making videos for?",
      "Just hit reply, I read every answer.",
      "Niko",
    ].join("\n\n"));
    const links = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(links.every((l) => l.includes("/unsubscribe")), `only the unsubscribe link: ${links}`);
    assert.doesNotMatch(html + text, /bonus|<img/i);
  }
});

test("the 12-hour open check: under the rate stops, at or over it does not, nothing sent says nothing", () => {
  assert.match(openRateProblem(0.1, { sent: 50, opened: 4 }), /8\.0%.*under 10%/);
  assert.equal(openRateProblem(0.1, { sent: 50, opened: 5 }), null);
  assert.equal(openRateProblem(0.1, { sent: 0, opened: 0 }), null);
  assert.equal(openRateProblem(null, { sent: 50, opened: 0 }), null);
});

test("a failed count throws instead of reading as 0, so a day can't close early", async () => {
  const fake = (result) => {
    const q = { select: () => q, eq: () => q, ilike: () => q, gte: () => q, order: () => q, range: async () => ({ data: [] }), then: (ok) => ok(result) };
    return { from: () => q };
  };
  await assert.rejects(campaignNumbers(fake({ count: null, error: { message: "timeout" } }), "checkin_day1", "2026-10-30T14:00:00Z"), /could not be counted: timeout/);
  await assert.rejects(campaignNumbers(fake({ count: null, error: null }), "checkin_day1", "2026-10-30T14:00:00Z"), /could not be counted/);
  const n = await campaignNumbers(fake({ count: 41, error: null }), "checkin_day1", "2026-10-30T14:00:00Z");
  assert.equal(n.queued, 82); // queued + sending, both 41 here
});

test("the sender: seed copies only for waiting days, once, real subject; open check stops later days of the series", () => {
  const src = read("supabase/functions/campaign-sender/index.ts");
  assert.match(src, /from\("email_campaigns"\)\.select\("\*"\)\.in\("status", \["waiting", "approved"\]\)\.not\("seed_to", "is", null\)\.is\("seed_sent_at", null\)/);
  assert.match(src, /update\(\{ seed_sent_at: now\.toISOString\(\) \}\)\.eq\("id", c\.id\)\.is\("seed_sent_at", null\)/);
  assert.match(src, /await test\(c\.id, c\.seed_to, \{ asSent: true \}\)/);
  assert.match(src, /\.like\("id", `\$\{series\}%`\)\.in\("status", \["waiting", "approved"\]\)\.gt\("starts_at", c\.starts_at\)/);
  // The tick still only SENDS approved or sending campaigns.
  assert.match(src, /select\("\*"\)\.in\("status", \["approved", "sending"\]\)\.lte\("starts_at", now\)/);
});

test("the gate: 2 marketing emails and no open → unengaged; the cron wakes for seeds and open checks", () => {
  const sql = read("supabase/migrations/20261128100000_email_reputation_week.sql");
  assert.match(sql, /\(select count\(\*\) from email_sends where email = v_email and category = 'marketing'\) >= 2\s+and not exists \(select 1 from email_events where email = v_email and type = 'email\.opened'\)/);
  assert.match(sql, /'reason', 'unengaged'/);
  assert.match(sql, /status = 'waiting' and seed_to is not null and seed_sent_at is null and seed_at <= now\(\)/);
  assert.match(sql, /seed_at = c\.seed_at \+ interval '24 hours'/);
  assert.match(sql, /revoke all on function public\.fill_campaign_from_engaged/);
});

test("checkin_root1 (owner, 2026-11-04): the same check-in, only the sender is niko@tryzyvo.com", () => {
  const root = CAMPAIGNS.checkin_root1, day = CAMPAIGNS.checkin_day1;
  assert.equal(root.from, "Niko <niko@tryzyvo.com>");
  assert.equal(day.from, "Niko <niko@mail.tryzyvo.com>");
  for (const k of ["replyTo", "subject", "why", "plain"]) assert.equal(root[k], day[k], k);
  assert.equal(root.opensTracked, false, "no open tracking on tryzyvo.com: the report says opens were not measured");
  assert.deepEqual(root.render(footer, {}), day.render(footer, {}));
});
