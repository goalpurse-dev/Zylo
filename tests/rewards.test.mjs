// Rewards: the config the brief asks for, the pure helpers, and the wiring (nav, page, admin, webhook). The money flow
// runs end to end in scripts/rewards/e2e.mjs (real SQL, offline) and tests/stripe-webhook/simulate.ts (section 16).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { REWARDS } from "../supabase/functions/_shared/rewards/config.js";
import { freeVideos, freeVideosLabel, isPaidPlan, maxCredits, newInviteCode, parseVideoUrl, tierByViews, tierFor, upgradeCredits, viewsLabel } from "../supabase/functions/_shared/rewards/rules.js";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("the owner's numbers are the config", () => {
  assert.deepEqual(REWARDS.videoTiers.map((t) => [t.views, t.credits]), [[5000, 300], [25000, 600], [100000, 1500], [500000, 5000], [1000000, 10000]]);
  assert.equal(maxCredits(), 10000);
  assert.equal(REWARDS.submissionsPerWeek, 10);
  assert.deepEqual([REWARDS.invite.inviterCredits, REWARDS.invite.friendCredits, REWARDS.invite.windowDays, REWARDS.invite.maxPerMonth, REWARDS.invite.ipCooldownDays, REWARDS.invite.clawbackDays], [500, 300, 7, 25, 7, 30]);
  assert.equal(REWARDS.freeVideo.toolKey, "blocky-worlds:video-90");
});

test("'≈ N free videos': credits ÷ the video price, rounded down, the first tier at least 1", () => {
  assert.deepEqual(REWARDS.videoTiers.map((t, i) => freeVideos(t.credits, i, 313)), [1, 1, 4, 15, 31]);
  assert.deepEqual(REWARDS.videoTiers.map((t, i) => freeVideos(t.credits, i, 124)), [2, 4, 12, 40, 80], "a cheaper video: more");
  assert.equal(freeVideos(300, 0, null), 1, "no live price: the fallback");
  assert.equal(freeVideosLabel(1), "≈ 1 free video");
  assert.equal(freeVideosLabel(31), "≈ 31 free videos");
});

test("video links: TikTok, Reels, Shorts only; the same video is one key whatever the link form", () => {
  const a = parseVideoUrl("https://www.tiktok.com/@ana.makes/video/7312345678901234567?is_from_webapp=1");
  const b = parseVideoUrl("tiktok.com/@ana.makes/video/7312345678901234567");
  assert.equal(a.platform, "tiktok");
  assert.equal(a.key, b.key);
  assert.equal(parseVideoUrl("https://vm.tiktok.com/ZMabc123/").key, "tiktok-share:ZMabc123");
  assert.equal(parseVideoUrl("https://www.instagram.com/reel/C1abcDEF234/?igsh=x").platform, "instagram");
  assert.equal(parseVideoUrl("https://instagram.com/p/C1abcDEF234").key, "instagram:C1abcDEF234");
  assert.equal(parseVideoUrl("https://youtube.com/shorts/aBcDeFgHiJk?si=1").platform, "youtube");
  assert.equal(parseVideoUrl("https://www.youtube.com/watch?v=aBcDeFgHiJk"), null, "a normal YouTube video is not a Short");
  assert.equal(parseVideoUrl("https://example.com/video/1"), null);
  assert.equal(parseVideoUrl("javascript:alert(1)"), null);
});

test("tiers, upgrades, labels, plans, codes", () => {
  assert.equal(tierFor(4999), null);
  assert.equal(tierFor(27000).credits, 600);
  assert.equal(tierByViews(100000).credits, 1500);
  assert.equal(tierByViews(12345), null);
  assert.equal(upgradeCredits(1500, 600), 900, "a re-check pays only the difference");
  assert.equal(upgradeCredits(600, 1500), 0);
  assert.equal(viewsLabel(1000000), "1M+");
  assert.equal(viewsLabel(25000), "25,000+");
  assert.ok(isPaidPlan("pro") && isPaidPlan("Starter") && !isPaidPlan("free") && !isPaidPlan(null));
  assert.match(newInviteCode(), /^[A-HJ-NP-Z2-9]{8}$/);
});

test("the badge is a transparent PNG", () => {
  const png = readFileSync(new URL("../public/rewards/made-with-zyvo.png", import.meta.url));
  assert.equal(png.toString("latin1", 1, 4), "PNG");
  assert.equal(png[25], 6, "RGBA (colour type 6): transparent");
  assert.ok(statSync(new URL("../public/rewards/made-with-zyvo.png", import.meta.url)).size < 200_000);
});

test("navigation: sidebar Rewards + 'Free credits'; More sheet Creations · Rewards · Affiliate; top bar 'Earn credits'", () => {
  const shell = read("src/components/workspace/toolshell.jsx");
  assert.match(shell, /label="Rewards"\s+earn="Free credits"/);
  assert.ok(shell.indexOf('label="Rewards"') < shell.indexOf('label="Affiliate"'), "Rewards right before Affiliate");
  const nav = read("src/components/workspace/MobileBottomNav.jsx");
  assert.deepEqual([...nav.matchAll(/\{ id: "(creations|rewards|affiliate)"/g)].map((m) => m[1]), ["creations", "rewards", "affiliate"]);
  assert.match(read("src/components/workspace/toprow.jsx"), /data-testid="topbar-earn-credits"/);
  const vercel = JSON.parse(read("vercel.json"));
  assert.ok(vercel.rewrites.some((r) => r.source === "/rewards" && r.destination === "/app-shell"));
});

test("pages: headline, locked for free plans, cross-links both ways, admin review", () => {
  const page = read("src/pages/workspace/rewards/RewardsPage.jsx");
  assert.match(page, /Post your Zyvo videos\. Earn up to \{fmt\(maxCredits\(\)\)\} credits\./);
  assert.match(page, /Included with every paid plan/);
  assert.match(page, /Want cash instead\? Become an affiliate/);
  assert.match(page, /Invite a friend\. You both get credits\./);
  assert.match(read("src/pages/workspace/affiliate/AffiliatePage.jsx"), /Just want free credits\? See Rewards/);
  const admin = read("src/pages/admin/Rewards.jsx");
  assert.match(admin, /adminReview/);
  assert.match(admin, /adminCancelInvite/);
  assert.match(admin, /upgradeCredits\(t\.credits, s\.creditsPaid\)/, "a re-check shows what it would add");
});

test("webhook: the friend's first purchase and its refund go through the rewards functions", () => {
  const hook = read("supabase/functions/stripe-webhook/index.ts");
  assert.match(hook, /affiliateRpc\("rewards_record_payment"/);
  assert.match(hook, /affiliateRpc\("rewards_reverse_payment"/);
  const sql = read("supabase/migrations/20261218100000_rewards.sql");
  assert.match(sql, /url_key       text not null unique/, "the same video only once");
  assert.match(sql, /invited_user_id uuid not null unique/, "one inviter per new user");
  assert.match(sql, /exists \(select 1 from referrals where referred_user_id = p_user_id\)/, "the affiliate wins");
});
