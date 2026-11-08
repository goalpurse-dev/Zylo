import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { stopReason } from "../supabase/functions/_shared/emailRules.js";
import { campaignStopReason, previousCampaignProblem } from "../supabase/functions/_shared/campaigns.js";

// Owner, 2026-11-08: "mailbox full" bounces never stop a day; those addresses are switched off for good;
// only real bounces (bad address, blocked) count. blocky_niche2 today 18–21 Finnish only; blocky_niche3 cancelled.
const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(root, p), "utf8");

test("mailbox full: the address is switched off, other soft bounces are not", () => {
  assert.equal(stopReason("email.bounced", { bounce: { type: "Transient", subType: "MailboxFull" } }), "bounced");
  assert.equal(stopReason("email.bounced", { bounce: { type: "Transient", subType: "ContentRejected" } }), null);
  assert.equal(stopReason("email.bounced", { bounce: { type: "Transient" } }), null);
  assert.equal(stopReason("email.bounced", { bounce: { type: "Permanent", subType: "General" } }), "bounced");
});

test("only real bounces count toward the stop rules", () => {
  const done = { id: "blocky_niche1", status: "done" };
  // Saturday: 3 of 130, all mailbox full → no longer a stop
  assert.equal(previousCampaignProblem(done, { sent: 130, bounced: 3, realBounced: 0, complained: 0 }), null);
  assert.match(previousCampaignProblem(done, { sent: 130, bounced: 5, realBounced: 3, complained: 0 }), /bounces over 2%: 3 of 130/);
  assert.equal(campaignStopReason({ sent: 100, bounced: 4, realBounced: 1, complained: 0 }), null);
  assert.match(campaignStopReason({ sent: 100, bounced: 4, realBounced: 3, complained: 0 }), /bounces over 2%: 3 of 100/);
  assert.match(campaignStopReason({ sent: 100, bounced: 0, complained: 1 }), /spam complaint/);
  assert.match(campaignStopReason({ sent: 100, bounced: 3, complained: 0 }), /3 of 100/, "without realBounced every bounce counts");
  assert.match(read("supabase/functions/_shared/campaigns.js"), /ilike\("detail", "%mailboxfull%"\)/);
});

test("Sunday evening only, Monday cancelled", () => {
  const sql = read("supabase/migrations/20261203100000_blocky_niche2_sunday_evening.sql");
  assert.match(sql, /'bounced', 'mailbox_full'/);
  assert.match(sql, /starts_at = timestamptz '2026-11-08 16:00\+00', ends_at = timestamptz '2026-11-08 19:00\+00',\s+depends_on = null/);
  assert.match(sql, /status = 'stopped', stop_reason = 'cancelled by the owner \(2026-11-08\)'/);
  assert.match(sql, /cron\.unschedule\(jobname\) from cron\.job where jobname in \('blocky-niche3-fill', 'blocky-niche3-seed'\)/);
  assert.match(sql, /'blocky-niche2-only-today', '5 19 8 11 \*'/);
});

test("Mon 9 Nov 250 and Tue 10 Nov 400 (owner, 2026-11-08): Tuesday needs 0 complaints, under 2 real bounces, 5% real opens", async () => {
  const { CAMPAIGNS, realOpensProblem } = await import("../supabase/functions/_shared/campaigns.js");
  assert.deepEqual(CAMPAIGNS.blocky_niche4.render, CAMPAIGNS.blocky_niche1.render, "the same email");
  assert.equal(CAMPAIGNS.blocky_niche4.from, "Niko <niko@tryzyvo.com>");
  const def = CAMPAIGNS.blocky_niche5;
  const done = { id: "blocky_niche4", status: "done" };
  assert.equal(previousCampaignProblem(done, { sent: 250, bounced: 1, realBounced: 1, complained: 0 }, def), null);
  assert.match(previousCampaignProblem(done, { sent: 250, bounced: 2, realBounced: 2, complained: 0 }, def), /2 real bounces/, "2 of 250 is under 2%, still a stop");
  assert.equal(previousCampaignProblem(done, { sent: 250, bounced: 4, realBounced: 1, complained: 0 }, def), null, "mailbox full does not count");
  assert.match(previousCampaignProblem(done, { sent: 250, bounced: 0, complained: 1 }, def), /spam complaint/);
  assert.equal(realOpensProblem("blocky_niche4", 13, 250, def), null, "13 of 250 = 5.2%");
  assert.match(realOpensProblem("blocky_niche4", 12, 250, def), /4\.8%.*under 5%/);
  const sql = read("supabase/migrations/20261204100000_blocky_niche_mon_tue.sql");
  assert.match(sql, /e\.sent_at > c\.ends_at - interval '24 hours'/, "nobody emailed in the last 24 hours");
  assert.match(sql, /fill_blocky_niche\('blocky_niche4', 250\)/);
  assert.match(sql, /fill_blocky_niche\('blocky_niche5', 400\)/);
  assert.match(sql, /'blocky_niche5', 'approved', 0, timestamptz '2026-11-10 09:00\+00', timestamptz '2026-11-10 11:00\+00', 'blocky_niche4'/);
  assert.match(read("supabase/functions/campaign-sender/index.ts"), /previousCampaignProblem\(prev, prevN, def\)/);
});
