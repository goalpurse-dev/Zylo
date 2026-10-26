import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { emailFooter } from "../supabase/functions/_shared/emailRules.js";
import { CAMPAIGNS, campaignReportText, previousCampaignProblem } from "../supabase/functions/_shared/campaigns.js";

// Warm-up days 2 and 3 (owner, 2026-10-12): the next 300 and the next 500, the
// same plain email with one line changed, opens counted, and day 3 only if day 2
// had 0 spam complaints and bounces under 2%.
const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(root, p), "utf8");
const footer = emailFooter({ unsubscribeUrl: "https://www.tryzyvo.com/unsubscribe?u=1&t=2", why: "why", plain: true });

test("days 2 and 3: day 1's email with the one line changed, same sender and reply-to", () => {
  const day1 = CAMPAIGNS.warmup_day1.render(footer).text;
  for (const id of ["warmup_day2", "warmup_day3"]) {
    const c = CAMPAIGNS[id];
    assert.equal(c.from, "Niko <niko@mail.tryzyvo.com>");
    assert.equal(c.replyTo, "niko@tryzyvo.com");
    assert.equal(c.subject, "quick question");
    const { html, text } = c.render(footer);
    assert.equal(text, day1.replace("You signed up recently and", "You signed up for Zyvo a while ago and"), `${id}: only that line differs from day 1`);
    assert.ok(text.includes("I'm Niko, I built Zyvo. You signed up for Zyvo a while ago and I wanted to say thanks."));
    assert.doesNotMatch(html, /<img|<table|youtube|utm_/i);
    assert.equal([...html.matchAll(/<a href=/g)].length, 2, "one link, plus unsubscribe");
  }
  assert.ok(day1.includes("You signed up recently and I wanted to say thanks."), "day 1 is unchanged");
  assert.equal(CAMPAIGNS.warmup_day2.render(footer).text, CAMPAIGNS.warmup_day3.render(footer).text, "day 3 is the same email as day 2");
});

test("day 3 only if day 2 went well: finished, 0 spam complaints, bounces under 2%", () => {
  const done = { id: "warmup_day2", status: "done" };
  assert.equal(previousCampaignProblem(done, { sent: 300, bounced: 0, complained: 0 }), null);
  assert.equal(previousCampaignProblem(done, { sent: 300, bounced: 5, complained: 0 }), null, "5 of 300 is 1.7%: under");
  assert.match(previousCampaignProblem(done, { sent: 300, bounced: 6, complained: 0 }), /bounces of 2% or more: 6 of 300/, "exactly 2% is not under 2%");
  assert.match(previousCampaignProblem(done, { sent: 300, bounced: 0, complained: 1 }), /spam complaint/);
  assert.match(previousCampaignProblem({ id: "warmup_day2", status: "stopped", stop_reason: "a spam complaint (1)" }, { sent: 40, bounced: 0, complained: 1 }), /was stopped \(a spam complaint \(1\)\)/);
  assert.match(previousCampaignProblem({ id: "warmup_day2", status: "sending" }, { sent: 100, bounced: 0, complained: 0 }), /has not finished/);
  assert.match(previousCampaignProblem({ id: "warmup_day2", status: "approved" }, { sent: 0 }), /has not finished/);
  assert.match(previousCampaignProblem(done, { sent: 0, bounced: 0, complained: 0 }), /sent nothing/);
  assert.match(previousCampaignProblem(null, null), /does not exist/);
  // The sender asks before anything else, on every tick, and tells the owner when it says no.
  const src = read("supabase/functions/campaign-sender/index.ts");
  const tick = src.slice(src.indexOf("async function tick()"), src.indexOf("async function followUpReports"));
  assert.ok(tick.indexOf("if (c.depends_on)") > 0 && tick.indexOf("if (c.depends_on)") < tick.indexOf("await sendOne(c, def)"));
  assert.match(tick, /previousCampaignProblem\(prev, prev \? await campaignNumbers\(sb, prev\.id, prev\.starts_at\) : null\)/);
  assert.match(tick, /await finish\(c, "stopped", why\);/, "not started: the campaign is stopped and the owner gets the email");
  assert.match(read("scripts/warmupCampaign.mjs"), /depends_on: dependsOn \?\? null/);
});

test("opens are counted for days 2 and 3, and the owner gets the numbers again later (48 hours since 2026-10-26)", () => {
  const n = { sent: 300, delivered: 298, bounced: 2, bouncedPermanent: 1, complained: 0, opened: 120, unsubscribed: 3, skipped: 0, failed: 0, queued: 0 };
  assert.ok(campaignReportText("warmup_day2", { status: "done", planned: 300 }, n).includes("Opened: 120 (40.0%)"));
  assert.ok(campaignReportText("warmup_day1", { status: "done", planned: 200 }, { ...n, opened: 0 }).includes("Opens: not measured"), "day 1 went out before open tracking was on");
  assert.match(read("supabase/functions/_shared/campaigns.js"), /ev\("email\.opened"\)/);
  const src = read("supabase/functions/campaign-sender/index.ts");
  assert.match(src, /const cutoff = new Date\(Date\.now\(\) - 48 \* 3600_000\)\.toISOString\(\);/);
  assert.match(src, /\.is\("followup_report_at", null\)\.lt\("finished_at", cutoff\)/);
  assert.match(src, /\.eq\("id", c\.id\)\.is\("followup_report_at", null\)\.select\("id"\);\s*if \(!mine\?\.length\) continue;/, "once per campaign");
});

test("pace for 500 in 7 hours: a tick every 30 seconds, one email per 25 seconds at most", () => {
  const sql = read("supabase/migrations/20261106100000_email_campaign_days.sql");
  assert.match(sql, /claimed_at > now\(\) - interval '25 seconds'/);
  assert.match(sql, /cron\.alter_job\(jobid, schedule := '30 seconds'\) from cron\.job where jobname = 'email-campaign-sender'/);
  assert.match(sql, /status in \('approved', 'sending'\) and starts_at <= now\(\) and ends_at > now\(\)/, "a waiting, stopped or finished campaign still gives nothing");
  assert.match(sql, /add column if not exists depends_on text references public\.email_campaigns\(id\)/);
  assert.match(sql, /followup_report_at is null and finished_at < now\(\) - interval '12 hours'/);
  // "The next N": older than everyone in the earlier days, and none of their recipients.
  const script = read("scripts/warmupCampaign.mjs");
  assert.match(script, /if \(oldest && oldest < cutoff\) cutoff = oldest;/);
  assert.match(script, /if \(earlier\.has\(p\.id\)\) continue;/);
});
