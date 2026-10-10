import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { emailFooter } from "../supabase/functions/_shared/emailRules.js";
import { CAMPAIGNS, campaignReportText, campaignStopReason } from "../supabase/functions/_shared/campaigns.js";

// Scheduled campaigns (2026-10-10, the warm-up): a fixed queue in the database,
// sent one email a minute at most by the campaign-sender function, which stops
// by itself on a spam complaint or on bounces over 2%. Nothing is sent while a
// campaign is "waiting" (the owner has not said go).
const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(root, p), "utf8");

test("warm-up day 1: the owner's words, plain, one link, from Niko at mail.tryzyvo.com, replies to niko@tryzyvo.com", () => {
  const c = CAMPAIGNS.warmup_day1;
  assert.equal(c.from, "Niko <niko@mail.tryzyvo.com>");
  assert.equal(c.replyTo, "niko@tryzyvo.com");
  assert.equal(c.subject, "quick question");
  const footer = emailFooter({ unsubscribeUrl: "https://www.tryzyvo.com/unsubscribe?u=1&t=2", why: c.why, plain: true });
  const { html, text } = c.render(footer);
  assert.equal(text, [
    "Hey,",
    "",
    "I'm Niko, I built Zyvo. You signed up recently and I wanted to say thanks.",
    "",
    "Quick question: what are you hoping to make with Zyvo?",
    "",
    "Just hit reply, I read every answer.",
    "",
    "Niko",
    "tryzyvo.com",
    "",
    "--",
    "You're getting this because product updates are turned on for your Zyvo account.",
    "Unsubscribe: https://www.tryzyvo.com/unsubscribe?u=1&t=2",
    "ZyvoAI · support@tryzyvo.com",
  ].join("\n"));
  assert.doesNotMatch(html, /<img|<table|youtube|ytimg|utm_/i, "no images, no layout, no YouTube, no tracking tags");
  const links = [...html.matchAll(/<a href="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(links, ["https://www.tryzyvo.com", "https://www.tryzyvo.com/unsubscribe?u=1&amp;t=2"], "one link in the email, plus the unsubscribe link in the footer");
  assert.match(html, /I&#39;m Niko, I built Zyvo\./);
  assert.match(html, /ZyvoAI · support@tryzyvo\.com/);
});

test("the stop rules: any spam complaint, or bounces over 2% of what was sent", () => {
  assert.equal(campaignStopReason({ sent: 0 }), null);
  assert.equal(campaignStopReason({ sent: 150, bounced: 0, complained: 0 }), null);
  assert.match(campaignStopReason({ sent: 3, complained: 1 }), /spam complaint/);
  assert.equal(campaignStopReason({ sent: 10, bounced: 1 }), null, "one bounce alone says nothing yet");
  assert.match(campaignStopReason({ sent: 10, bounced: 2 }), /bounces over 2%: 2 of 10/);
  assert.match(campaignStopReason({ sent: 99, bounced: 2 }), /bounces over 2%/);
  assert.equal(campaignStopReason({ sent: 100, bounced: 2 }), null, "2 of 100 is 2%, not over");
  assert.match(campaignStopReason({ sent: 100, bounced: 3 }), /bounces over 2%/);
  assert.equal(campaignStopReason({ sent: 200, bounced: 4 }), null);
  assert.match(campaignStopReason({ sent: 200, bounced: 5 }), /bounces over 2%: 5 of 200/);
  assert.match(campaignStopReason({ sent: 20, failed: 5 }), /Resend refused 5 sends/);
  const report = campaignReportText("warmup_day1", { status: "done", planned: 200 }, { sent: 198, delivered: 195, bounced: 3, bouncedPermanent: 1, complained: 0, unsubscribed: 2, skipped: 2, failed: 0, queued: 0 });
  for (const line of ["Sent: 198", "Bounced: 3 (1.5%) — permanent 1, temporary 2", "Spam complaints: 0", "Unsubscribes: 2 (1.0%)", "Opens: not measured", "Replies:"]) assert.ok(report.includes(line), line);
});

test("the sender: only with the secret, one email a tick, consent and the gate before every send, stop rules first", () => {
  const src = read("supabase/functions/campaign-sender/index.ts");
  assert.match(src, /if \(!SECRET \|\| req\.headers\.get\("x-campaign-secret"\) !== SECRET\) return json\(\{ error: "Unauthorized" \}, 401\);/);
  assert.match(src, /\.in\("status", \["approved", "sending"\]\)\.lte\("starts_at", now\)/, "a waiting campaign is never touched");
  const tick = src.slice(src.indexOf("async function tick()"));
  assert.ok(tick.indexOf("campaignStopReason(n)") < tick.indexOf("await sendOne(c, def)"), "the stop rules are checked before anything is sent");
  assert.equal(src.split("await sendOne(").length - 1, 1, "one email per campaign per tick");
  const one = src.slice(src.indexOf("async function sendOne"), src.indexOf("async function tick()"));
  assert.match(one, /if \(!p \|\| p\.email_updates !== true\) \{ await settle\("skipped", \{ reason: "no_consent" \}\); return "skipped"; \}/);
  assert.match(one, /claimEmail\(sb, row\.email, `campaign:\$\{c\.id\}`, "marketing"\)/);
  assert.ok(one.indexOf("claimEmail(") < one.indexOf("sendClaimedEmailWithId("), "the gate comes before the send");
  assert.doesNotMatch(src, /api\.resend\.com/, "the function does not talk to Resend itself");
  assert.match(src, /await alertAdmin\(head,/, "the owner is told when a campaign stops or finishes");
  assert.match(src, /status: "skipped", reason: "window_closed"/, "an email not sent in its window is dropped, not sent late");
  assert.match(read("supabase/config.toml"), /\[functions\.campaign-sender\]\s*verify_jwt = false/);
});

test("the queue: service-role only, one email per 45 seconds at most, cron does nothing unless a campaign may send", () => {
  const sql = read("supabase/migrations/20261105100000_email_campaigns.sql");
  for (const t of ["email_campaigns", "email_campaign_queue", "email_events"]) assert.match(sql, new RegExp(`alter table public\\.${t} enable row level security`));
  assert.match(sql, /status\s+text not null default 'waiting'/, "a new campaign may not send until it is approved");
  assert.match(sql, /status in \('approved', 'sending'\) and starts_at <= now\(\) and ends_at > now\(\)/);
  assert.match(sql, /claimed_at > now\(\) - interval '45 seconds'/);
  assert.match(sql, /for update skip locked/);
  assert.match(sql, /unique \(campaign, profile_id\)/);
  assert.match(sql, /if not exists \(select 1 from public\.email_campaigns where status in \('approved', 'sending'\) and starts_at <= now\(\)\) then\s+return;/);
  assert.match(sql, /cron\.schedule\('email-campaign-sender', '\* \* \* \* \*'/);
  assert.match(sql, /revoke all on function public\.claim_campaign_email\(text\) from public, anon, authenticated/);
  // The admin script fills the queue and never sends.
  const script = read("scripts/warmupCampaign.mjs");
  assert.doesNotMatch(script, /resend|api\.resend\.com/i);
  assert.match(script, /status: "waiting"/);
  assert.match(script, /\.eq\("email_updates", true\)/);
  assert.match(script, /if \(flag\("--approve"\)\) await move\(\["waiting"\], "approved"\);/);
});

test("the webhook keeps campaign events for the stop rules", () => {
  const src = read("supabase/functions/resend-webhook/index.ts");
  assert.match(src, /let campaign = tagValue\(tags, "campaign"\);/);
  assert.match(src, /from\("email_campaign_queue"\)\.select\("campaign"\)\.eq\("resend_id", resendId\)/, "an event without the tag is matched by the email's Resend id");
  assert.match(src, /from\("email_events"\)\.upsert\(/);
  assert.match(src, /onConflict: "resend_id,type", ignoreDuplicates: true/);
});
