import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { emailFooter } from "../supabase/functions/_shared/emailRules.js";
import { CAMPAIGNS, CUTAWAY_URL, campaignReportText, ownerEmailsFrom, providerProblem, purchasesAfter } from "../supabase/functions/_shared/campaigns.js";

// Warm-up days 4–7 (owner, 2026-10-26): the "without showing your face" email, its one link going
// to the Cutaway Explainer page only while that template is on, no day starting while Runware or
// the voice provider failed in the last 3 hours, and plans bought within 48 hours in the report.
const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(root, p), "utf8");
const footer = emailFooter({ unsubscribeUrl: "https://www.tryzyvo.com/unsubscribe?u=1&t=2", why: "why", plain: true });

test("days 4–7: the owner's text, one link, no images, same sender and reply-to", () => {
  for (const id of ["warmup_day4", "warmup_day5", "warmup_day6", "warmup_day7"]) {
    const c = CAMPAIGNS[id];
    assert.equal(c.subject, "you can make this without showing your face");
    assert.equal(c.from, "Niko <niko@mail.tryzyvo.com>");
    assert.equal(c.replyTo, "niko@tryzyvo.com");
    assert.equal(c.linkTo, undefined, "owner, 2026-10-26: the link always goes to tryzyvo.com, never the Cutaway page");
  }
  const { html, text } = CAMPAIGNS.warmup_day4.render(footer, { at: "2026-11-02T12:00:00Z" }); // after the +50 offer
  assert.equal(text.split("\n\n--\n")[0], [
    "Hey,",
    "It's Niko from Zyvo. Thanks for signing up. Here's what you can make with it.",
    "Pick a template and Zyvo makes the whole faceless video for you. Ready to post on TikTok, Shorts or Reels. No camera, no editing.",
    "There are different styles, like 3D, so you can find one that fits your page.",
    "Try it here: tryzyvo.com",
    "If you make something, reply and send it to me. I want to see it.",
    "Niko",
  ].join("\n\n"));
  assert.doesNotMatch(html, /<img|<table|youtube|utm_|cutaway/i);
  assert.deepEqual([...html.matchAll(/<a href="([^"]+)"/g)].map((m) => m[1]), ["https://www.tryzyvo.com", "https://www.tryzyvo.com/unsubscribe?u=1&amp;t=2"], "one link, plus unsubscribe");
  // The sender's link choice gives tryzyvo.com to every campaign without linkTo "cutaway".
  const src = read("supabase/functions/campaign-sender/index.ts");
  assert.match(src, /def\.linkTo === "cutaway" && \(Deno\.env\.get\("CUTAWAY_ENABLED"\) \?\? ""\)\.trim\(\)\.toLowerCase\(\) === "true" \? CUTAWAY_URL : APP_URL/);
  assert.equal(src.split("render: (footer: any) => def.render(footer, { link: linkFor(def)").length - 1, 2, "both the real send and the proof copy");
  assert.ok(CUTAWAY_URL.endsWith("/workspace/cutaway-explainer"));
});

test("the +50 offer line: before 'Try it here' on days 4–7 while the offer is live at send time; never after Sunday, never in 'still want'", () => {
  const LINE = "This week only: get 50 bonus credits on top of any plan you upgrade to. Ends Sunday.";
  for (const id of ["warmup_day4", "warmup_day5", "warmup_day6", "warmup_day7"]) {
    const { html, text } = CAMPAIGNS[id].render(footer, { at: "2026-10-30T14:00:00Z" });
    const body = text.split("\n\n--\n")[0].split("\n\n");
    assert.equal(body[4], LINE, id);
    assert.equal(body[5], "Try it here: tryzyvo.com");
    assert.ok(html.includes(`<p style="margin:0 0 16px 0;">${LINE}</p>\n<p style="margin:0 0 16px 0;">Try it here: <a href=`));
    assert.equal([...html.matchAll(/<a href=/g)].length, 2, "still one link, plus unsubscribe");
  }
  assert.ok(CAMPAIGNS.warmup_day7.render(footer, { at: "2026-11-01T21:59:00Z" }).text.includes(LINE), "Sunday 23:59 Finnish: still in");
  for (const at of ["2026-11-01T22:00:00Z", "2026-11-02T16:00:00Z"]) {
    assert.ok(!CAMPAIGNS.warmup_day7.render(footer, { at }).text.includes(LINE), `a day moved past Sunday (${at}) goes without it`);
  }
  for (const id of ["still_want_updates", "still_want_updates_1", "still_want_updates_2"]) {
    assert.ok(!CAMPAIGNS[id].render(footer, { at: "2026-10-30T14:00:00Z" }).text.includes("bonus"), id);
  }
  for (const id of ["warmup_day1", "warmup_day2", "warmup_day3"]) {
    assert.ok(!CAMPAIGNS[id].render(footer, { at: "2026-10-30T14:00:00Z" }).text.includes("bonus"), id);
  }
});

test("a day that may not start because Runware or the voice provider failed moves forward with every later day; nothing is cancelled", () => {
  const src = read("supabase/functions/campaign-sender/index.ts");
  const tick = src.slice(src.indexOf("async function tick()"));
  assert.match(tick, /const down = await providersFailing\(\);\s*if \(down\) \{ out\[c\.id\] = await postpone\(c, `\$\{down\} in the last 3 hours`\); continue; \}/);
  assert.doesNotMatch(tick, /not started: \$\{down\}/, "no longer stopped for a provider failure");
  assert.match(src, /sb\.rpc\("postpone_campaigns", \{ p_from: c\.id \}\)/);
  assert.match(src, /MOVED one day/, "the owner is emailed");
  // Bounces or complaints still stop the day and, through depends_on, the days after it.
  assert.match(tick, /const stop = campaignStopReason\(n\);\s*if \(stop\) \{ await finish\(c, "stopped", stop\);/);
  const sql = read("supabase/migrations/20261108200000_email_campaign_postpone.sql");
  assert.match(sql, /where c\.status in \('approved', 'waiting'\) and c\.starts_at >= v_from/, "that day and every later one");
  assert.match(sql, /status in \('sending', 'sent'\)/, "a day that has sent anything is never moved");
  assert.match(sql, /send_after = q\.send_after \+ interval '24 hours'/);
  assert.match(sql, /set starts_at = c\.starts_at \+ interval '24 hours', ends_at = c\.ends_at \+ interval '24 hours'/);
  assert.match(sql, /revoke all on function public\.postpone_campaigns\(text\) from public, anon, authenticated/);
});

test("the 'still want to hear from me?' email is built, plain, and not part of the warm-up days", () => {
  const c = CAMPAIGNS.still_want_updates;
  assert.equal(c.subject, "still want to hear from me?");
  const { html, text } = c.render(footer);
  assert.match(text, /If yes, you don't need to do anything\. If not, the unsubscribe link is right below/);
  assert.doesNotMatch(html, /<img/);
  assert.equal(c.linkTo, undefined);
});

test("no day starts while Runware or the voice provider failed in the last 3 hours", () => {
  const since = "2026-10-27T11:00:00.000Z";
  assert.equal(providerProblem({ runware: { paused: false, alerted_at: null }, voiceLogs: [], sinceIso: since }), null);
  assert.equal(providerProblem({ runware: { paused: false, alerted_at: "2026-10-27T08:00:00Z" }, voiceLogs: [], sinceIso: since }), null, "an alert older than 3 hours");
  assert.match(providerProblem({ runware: { paused: true, last_error: "outage: backup failed" }, sceneLogs: [{ event: "scene_covered", details: { projectId: "user-1" } }], voiceLogs: [], sinceIso: since }), /Runware is paused \(outage: backup failed; 1 failed scenes of real users\)/);
  assert.match(providerProblem({ runware: { paused: false, alerted_at: "2026-10-27T12:00:00Z" }, sinceIso: since }), /Runware is alerting/);
  assert.match(providerProblem({ runware: null, voiceLogs: [{ event: "narration_failed", details: {} }], sinceIso: since }), /1 voiceovers failed for good/);
  assert.match(providerProblem({ voiceLogs: [{ event: "narration_paused", details: { tries: 1, error: "ElevenLabs 401: invalid_api_key" } }], sinceIso: since }), /1 refusals of our account/);
  assert.match(providerProblem({ voiceLogs: [{ event: "narration_paused", details: { tries: 3, error: "503" } }], sinceIso: since }), /1 paused 3\+ times/);
  assert.equal(providerProblem({ voiceLogs: [{ event: "narration_paused", details: { tries: 1, error: "429 too many requests" } }], sinceIso: since }), null, "one passing slowdown is not an outage");
  const src = read("supabase/functions/campaign-sender/index.ts");
  const tick = src.slice(src.indexOf("async function tick()"));
  assert.ok(tick.indexOf('if (c.status === "approved")') < tick.indexOf("await sendOne(c, def)"), "checked before the first email of the day");
  assert.match(src, /new Date\(Date\.now\(\) - 3 \* 3600_000\)/);
  assert.match(src, /\.eq\("provider", "runware"\)/);
});

test("plans bought within 48 hours of the email: first plans, upgrades, top-ups; not renewals", () => {
  const recipients = [
    { profile_id: "a", sent_at: "2026-10-27T14:00:00Z" }, // first plan the next day → counted
    { profile_id: "b", sent_at: "2026-10-27T14:00:00Z" }, // renewal of a plan they had → not counted
    { profile_id: "c", sent_at: "2026-10-27T14:00:00Z" }, // top-up after 3 days → too late
    { profile_id: "d", sent_at: "2026-10-27T14:00:00Z" }, // upgrade + top-up → one person
    { profile_id: "e", sent_at: "2026-10-27T14:00:00Z" }, // bought BEFORE the email → not counted
  ];
  const grants = [
    { user_id: "a", reason: "plan_renewal", created_at: "2026-10-28T09:00:00Z" },
    { user_id: "b", reason: "plan_renewal", created_at: "2026-09-28T09:00:00Z" },
    { user_id: "b", reason: "plan_renewal", created_at: "2026-10-28T09:00:00Z" },
    { user_id: "c", reason: "topup", created_at: "2026-10-30T15:00:00Z" },
    { user_id: "d", reason: "plan_upgrade", created_at: "2026-10-27T15:00:00Z" },
    { user_id: "d", reason: "topup", created_at: "2026-10-28T15:00:00Z" },
    { user_id: "e", reason: "plan_renewal", created_at: "2026-10-27T13:00:00Z" },
    { user_id: "x", reason: "topup", created_at: "2026-10-27T15:00:00Z" },
  ];
  assert.deepEqual(purchasesAfter(recipients, grants, 48), { people: 2, firstPlan: 1, upgrade: 1, topup: 1 });
  const report = campaignReportText("warmup_day4", { status: "done", planned: 1000 }, { sent: 1000, delivered: 998, bounced: 2, bouncedPermanent: 1, complained: 0, opened: 200, unsubscribed: 1, skipped: 0, failed: 0, queued: 0, purchases: { people: 7, firstPlan: 5, upgrade: 1, topup: 2 } });
  assert.ok(report.includes("Bought within 48 hours of their email: 7 (0.7%) — first plan 5, upgrade 1, credit top-up 2"));
  assert.ok(report.includes("Opened: 200 (20.0%)"));
});

test("pace for 1,500 in 7 hours: a tick every 10 seconds, one email per 8 seconds at most; the second report after 48 hours", () => {
  const sql = read("supabase/migrations/20261107100000_email_campaign_pace.sql");
  assert.match(sql, /claimed_at > now\(\) - interval '8 seconds'/);
  assert.match(sql, /cron\.alter_job\(jobid, schedule := '10 seconds'\) from cron\.job where jobname = 'email-campaign-sender'/);
  assert.match(sql, /finished_at < now\(\) - interval '48 hours'/);
  assert.match(read("supabase/functions/campaign-sender/index.ts"), /const cutoff = new Date\(Date\.now\(\) - 48 \* 3600_000\)\.toISOString\(\);/);
  // The admin script can aim at the earlier recipients and at a sign-up window minus earlier queues.
  const script = read("scripts/warmupCampaign.mjs");
  assert.match(script, /if \(excluded\.has\(p\.id\)\) \{ passed\.alreadyInExcludedCampaigns\+\+; continue; \}/);
  assert.match(script, /for \(const c of recipientsOf\) for \(const r of await queueOf\(c, true\)\) only\.add\(r\);/);
});

test("only real users on live templates block a day: the owner's own projects and Cutaway are ignored (owner, 2026-10-26)", () => {
  const since = "2026-10-27T11:00:00.000Z";
  const quota = { tries: 1, error: "NARRATION_TTS_PROVIDER_FAILED: 401 quota_exceeded" };
  // Voice: the owner's own project → ignored; a real user's → counts.
  assert.equal(providerProblem({ voiceLogs: [{ event: "narration_paused", details: { ...quota, projectId: "own-1" } }], ownerProjectIds: ["own-1"], sinceIso: since }), null);
  assert.match(providerProblem({ voiceLogs: [{ event: "narration_paused", details: { ...quota, projectId: "user-1" } }], ownerProjectIds: ["own-1"], sinceIso: since }), /failing for real users \(0 voiceovers failed for good, 1 refusals/);
  // Anything from the Cutaway template → ignored.
  assert.equal(providerProblem({ voiceLogs: [{ source: "cutaway-api", event: "narration_failed", details: {} }], sinceIso: since }), null);
  assert.equal(providerProblem({ voiceLogs: [{ event: "narration_failed", details: { template: "cutaway" } }], sinceIso: since }), null);
  // Runware "outage" (scenes failing): counts only when a real user's scene failed.
  const outage = { paused: true, last_error: "outage: backup: TypeError" };
  assert.equal(providerProblem({ runware: outage, sceneLogs: [{ event: "scene_covered", details: { projectId: "own-1" } }], ownerProjectIds: ["own-1"], sinceIso: since }), null);
  assert.equal(providerProblem({ runware: outage, sceneLogs: [], sinceIso: since }), null, "no real user's scene failed");
  assert.match(providerProblem({ runware: outage, sceneLogs: [{ event: "scene_retry_deferred", details: { projectId: "user-9" } }], ownerProjectIds: ["own-1"], sinceIso: since }), /Runware is paused .*1 failed scenes of real users/);
  // A low or empty balance stops everyone: it always counts.
  assert.match(providerProblem({ runware: { paused: true, last_error: "balance read failed" }, sinceIso: since }), /Runware is paused/);
  assert.match(providerProblem({ runware: { paused: false, alerted_at: "2026-10-27T12:00:00Z", last_error: null }, sinceIso: since }), /Runware is alerting/);
  // The owner's accounts come from the ADMIN_EMAILS and CUTAWAY_TEST_USERS settings.
  assert.deepEqual(ownerEmailsFrom("Owner@Example.com, b@example.com", "owner@example.com", undefined), ["owner@example.com", "b@example.com"]);
  const src = read("supabase/functions/campaign-sender/index.ts");
  assert.match(src, /ownerEmailsFrom\(Deno\.env\.get\("ADMIN_EMAILS"\), Deno\.env\.get\("CUTAWAY_TEST_USERS"\)\)/);
  assert.match(src, /\.eq\("source", "render-long-form-scene"\)\.in\("event", \["scene_retry_deferred", "scene_covered"\]\)/);
});

test("proof copies (owner, 2026-10-28): asSent keeps the real subject, offer: false leaves the +50 line out", () => {
  const footer = emailFooter({ why: "why", unsubscribeUrl: "https://x/u" });
  const live = Date.parse("2026-10-28T12:00:00Z");
  assert.match(CAMPAIGNS.warmup_day4.render(footer, { at: live }).text, /50 bonus credits/);
  assert.doesNotMatch(CAMPAIGNS.warmup_day4.render(footer, { at: live, offer: false }).text, /50 bonus credits/);
  const src = readFileSync(join(root, "supabase/functions/campaign-sender/index.ts"), "utf8");
  assert.match(src, /subject: asSent \? def\.subject : `\[TEST\] \$\{def\.subject\}`/);
  assert.match(src, /asSent: body\.asSent === true, offer: body\.offer !== false/);
});
