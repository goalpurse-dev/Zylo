// Rewards end to end, offline and free: the REAL rewards-api + affiliate-api logic on the REAL migrations (PGlite).
// Videos: submit → approve 25k → +600 → re-check → approve 100k → +900 (the difference) → duplicate blocked → limits →
// free user locked. Invites: link → first purchase → +500 / +300 → refund takes back the unspent → affiliate beats invite.
// Run: PGLITE=<path to @electric-sql/pglite/dist/index.js> node scripts/rewards/e2e.mjs
import { makeHarness } from "../affiliate/harness.mjs";
import { createRewardsHandler } from "../../supabase/functions/_shared/rewards/api.js";
import { createAffiliateHandler } from "../../supabase/functions/_shared/affiliate/api.js";
import { REWARDS } from "../../supabase/functions/_shared/rewards/config.js";
import { freeVideos } from "../../supabase/functions/_shared/rewards/rules.js";

const h = await makeHarness();
const { pg, sb, newUser, getUser, caller, balance, check } = h;
const cors = () => ({ "content-type": "application/json" });
const rw = caller(createRewardsHandler({ sb, getUser, adminEmails: ["owner@zyvo.test"], salt: "t", cors }));
const af = caller(createAffiliateHandler({ sb, getUser, adminEmails: ["owner@zyvo.test"], salt: "t", cors }));
const owner = await newUser("owner@zyvo.test", "Owner", { plan: "pro" });
const pay = (u, id, intent = null) => sb.rpc("rewards_record_payment", {
  p_user_id: u.id, p_payment_id: id, p_payment_intent: intent, p_inviter_credits: REWARDS.invite.inviterCredits, p_friend_credits: REWARDS.invite.friendCredits,
  p_max_per_month: REWARDS.invite.maxPerMonth, p_ip_days: REWARDS.invite.ipCooldownDays, p_paid_plans: [...REWARDS.paidPlans],
}).then((r) => r.data ?? { error: r.error?.message });

console.log("0. Tiers and '≈ N free videos' (live price 313)");
const cfg = await rw(null, "config");
check("tiers from config", cfg.tiers.map((t) => [t.views, t.credits]), [[5000, 300], [25000, 600], [100000, 1500], [500000, 5000], [1000000, 10000]]);
check("the live In This Town price", cfg.freeVideo.credits, 313);
check("free videos per tier (round down, first at least 1)", cfg.tiers.map((t, i) => freeVideos(t.credits, i, cfg.freeVideo.credits)), [1, 1, 4, 15, 31]);

console.log("1. Videos");
const ana = await newUser("ana@example.com", "Ana", { plan: "pro" });
const URL1 = "https://www.tiktok.com/@ana.makes/video/7312345678901234567?is_from_webapp=1";
const s1 = await rw(ana, "submit", { url: URL1, views: "27,000" });
check("paid user submits a TikTok link", [s1.ok, s1.platform], [true, "tiktok"]);
let me = await rw(ana, "me");
check("in review, views saved", [me.submissions[0].status, me.submissions[0].claimedViews], ["in_review", 27000]);
const id1 = me.submissions[0].id;
check("a non-admin can't review", (await rw(ana, "adminReview", { id: id1, approve: true, tierViews: 1000000 })).code, "NOT_FOUND");
check("admin must pick a real tier", (await rw(owner, "adminReview", { id: id1, approve: true, tierViews: 12345 })).problem, "Pick a tier.");
const before = await balance(ana);
const a1 = await rw(owner, "adminReview", { id: id1, approve: true, tierViews: 25000 });
check("approve 25k tier → +600 at once", [a1.result, a1.credits_added, (await balance(ana)) - before], ["approved", 600, 600]);
check("re-check the same day → too soon", (await rw(ana, "recheck", { id: id1, views: "120000" })).problem, "too_soon");
await pg.query("update reward_submissions set reviewed_at = now() - interval '2 days' where id = $1", [id1]);
check("re-check later → back in review", (await rw(ana, "recheck", { id: id1, views: "120000" })).ok, true);
const ov = await rw(owner, "adminOverview");
check("the queue shows it as a re-check with what's paid", [ov.queue[0].recheck, ov.queue[0].creditsPaid, ov.queue[0].email], [true, 600, "ana@example.com"]);
const a2 = await rw(owner, "adminReview", { id: id1, approve: true, tierViews: 100000 });
check("approve 100k → only the difference (+900)", [a2.credits_added, (await balance(ana)) - before], [900, 1500]);
me = await rw(ana, "me");
check("my submissions: approved, 100k tier, 1,500 credits", [me.submissions[0].status, me.submissions[0].tierViews, me.submissions[0].creditsPaid], ["approved", 100000, 1500]);
check("approving the same tier again pays nothing", await (async () => {
  await pg.query("update reward_submissions set status = 'in_review' where id = $1", [id1]);
  return (await rw(owner, "adminReview", { id: id1, approve: true, tierViews: 100000 })).credits_added;
})(), 0);
const bob = await newUser("bob@example.com", "Bob", { plan: "starter" });
check("the same video (another link form, another user) → duplicate", (await rw(bob, "submit", { url: "tiktok.com/@ana.makes/video/7312345678901234567" })).problem, "duplicate");
check("a link that isn't TikTok/Reels/Shorts → refused", (await rw(bob, "submit", { url: "https://www.youtube.com/watch?v=abcdefghijk" })).problem, "url");
check("Instagram Reel accepted", (await rw(bob, "submit", { url: "https://www.instagram.com/reel/C1abcDEF234/" })).platform, "instagram");
check("YouTube Short accepted", (await rw(bob, "submit", { url: "https://youtube.com/shorts/aBcDeFgHiJk" })).platform, "youtube");
for (let k = 0; k < 8; k++) await rw(bob, "submit", { url: `https://www.tiktok.com/@bob/video/70000000000000000${k}` });
check("11th in a week → weekly limit", (await rw(bob, "submit", { url: "https://www.tiktok.com/@bob/video/7999999999999999999" })).problem, "weekly_limit");
const rej = (await rw(owner, "adminOverview")).queue.find((s) => s.email === "bob@example.com");
check("reject needs a reason, then shows it", [(await rw(owner, "adminReview", { id: rej.id, approve: false, reason: "No badge" })).result, (await rw(bob, "me")).submissions.find((s) => s.id === rej.id).rejectReason], ["rejected", "No badge"]);
const free = await newUser("free@example.com", "Free");
const fm = await rw(free, "me");
check("free user: sees the page data, locked", [fm.paid, fm.config.tiers.length], [false, 5]);
check("free user can't submit", (await rw(free, "submit", { url: "https://www.tiktok.com/@free/video/7111111111111111111" })).problem, "locked");

console.log("2. Invites");
const ivy = await newUser("ivy@example.com", "Ivy", { plan: "pro" });
const im = await rw(ivy, "me");
check("invite link", [im.invite.kind, /^https:\/\/tryzyvo\.com\/\?invite=[A-Z0-9]{8}$/.test(im.invite.link)], ["invite", true]);
const code = im.invite.code;
check("the code stays the same", (await rw(ivy, "me")).invite.code, code);
check("self-invite refused", (await rw(ivy, "claimInvite", { code })).result, "self");
const fr = await newUser("friend@example.com", "Fred");
check("friend opens the link and signs up → joined", (await rw(fr, "claimInvite", { code }, "4.4.4.4")).result, "joined");
check("signing up alone pays nothing", [await balance(ivy) - 0, await balance(fr)], [0, 0]);
check("stats: joined 1, bought 0", [(await rw(ivy, "me")).inviteStats.joined, (await rw(ivy, "me")).inviteStats.bought], [1, 0]);
const p1 = await pay(fr, "in_fr1", "pi_fr1");
check("friend's first purchase → +500 inviter, +300 friend", [p1.result, await balance(ivy), await balance(fr)], ["rewarded", 500, 300]);
check("a second purchase → nothing more", [(await pay(fr, "in_fr2")).result, await balance(ivy)], ["done", 500]);
check("stats: bought 1, 500 earned", [(await rw(ivy, "me")).inviteStats.bought, (await rw(ivy, "me")).inviteStats.credits], [1, 500]);
await pg.query("update profiles set credit_balance = credit_balance - 100 where id = $1", [fr.id]); // the friend spends 100
const rv = (await sb.rpc("rewards_reverse_payment", { p_payment_id: null, p_payment_intent: "pi_fr1", p_window_days: 30, p_reason: "charge.refunded" })).data;
check("refund → reward taken back (inviter 500, friend only the unspent 200)", [rv.reversed, await balance(ivy), await balance(fr)], [1, 0, 0]);
check("taken back once", [(await sb.rpc("rewards_reverse_payment", { p_payment_id: null, p_payment_intent: "pi_fr1", p_window_days: 30, p_reason: "again" })).data.reversed, await balance(ivy)], [0, 0]);
check("ledger has the negative rows", (await pg.query("select count(*)::int as n from credit_grants where reason = 'invite_clawback'")).rows[0].n, 2);

const maya = await newUser("maya@example.com", "Maya", { plan: "pro" });
await af(maya, "join", { handles: [{ platform: "tiktok", handle: "maya.makes" }] }, "9.9.9.9");
const f2 = await newUser("f2@example.com", "F2");
await af(f2, "claim", { code: "MAYAMAKES", source: "link" }, "5.5.5.5");
check("affiliate link + invite link → the affiliate wins (invite refused)", (await rw(f2, "claimInvite", { code }, "5.5.5.5")).result, "affiliate_referred");
const f3 = await newUser("f3@example.com", "F3");
await rw(f3, "claimInvite", { code }, "6.6.6.6");
await af(f3, "claim", { code: "MAYAMAKES", source: "code" }, "6.6.6.6");
check("invite first, affiliate code later → at purchase the affiliate wins, no invite credits", [(await pay(f3, "in_f3")).result, await balance(ivy)], ["affiliate", 0]);
check("an affiliate's invite link IS their affiliate link", [(await rw(maya, "me")).invite.kind, (await rw(maya, "me")).invite.link], ["affiliate", "https://tryzyvo.com/?ref=MAYAMAKES"]);
const mcode = (await pg.query("select code from invite_codes where user_id = $1", [maya.id])).rows[0]?.code ?? null;
check("(an affiliate gets no separate invite code)", mcode, null);

const old = await newUser("old@example.com", "Old", { ageDays: 9 });
check("friend's account older than 7 days → too old", (await rw(old, "claimInvite", { code })).result, "too_old");
const f4 = await newUser("f4@example.com", "F4");
await rw(f4, "claimInvite", { code }, "7.7.7.7");
await pg.query("update profiles set plan_code = 'free' where id = $1", [ivy.id]);
check("inviter on the free plan → counts, no credits", [(await pay(f4, "in_f4")).reason, await balance(f4)], ["inviter_not_paid", 0]);
await pg.query("update profiles set plan_code = 'pro' where id = $1", [ivy.id]);
const f5 = await newUser("f5@example.com", "F5");
await rw(f5, "claimInvite", { code }, "8.8.8.8");
check("rewarded", (await pay(f5, "in_f5")).result, "rewarded");
const f6 = await newUser("f6@example.com", "F6");
await rw(f6, "claimInvite", { code }, "8.8.8.8");
check("same IP got invite credits in the last 7 days → counts, no credits", [(await pay(f6, "in_f6")).reason, await balance(f6)], ["ip_recent", 0]);
await pg.query("update invites set status = 'rewarded', rewarded_at = now() where inviter_user_id = $1", [ivy.id]);
const extra = [];
for (let k = 0; k < 20; k++) { const u = await newUser(`cap${k}@example.com`, "C"); await rw(u, "claimInvite", { code }, `10.0.${k}.1`); extra.push(u); }
// 5 of Ivy`s invites are marked rewarded above; 20 more make 25 this month
for (const u of extra) await pay(u, `in_cap_${u.id}`);
const over = await newUser("cap-over@example.com", "C"); await rw(over, "claimInvite", { code }, "10.9.9.9");
{ const last = await pay(over, "in_cap_last"); if (last.error) console.log("ERR", last.error); check("25 invite rewards a month, then counts without credits", last.reason, "monthly_cap"); }
const ov2 = await rw(owner, "adminOverview");
const one = ov2.invites.find((x) => x.friend === "f5@example.com");
check("admin cancel of a rewarded invite → taken back", (await rw(owner, "adminCancelInvite", { id: one.id })).result, "taken_back");
const f7 = await newUser("f7@example.com", "F7");
await rw(f7, "claimInvite", { code }, "11.0.0.1");
await pg.query("update invites set status = 'cancelled' where status = 'rewarded' and inviter_user_id = $1", [ivy.id]);
check("admin test tools: a friend's simulated first purchase", (await rw(owner, "adminTestInvitePayment", { email: "f7@example.com" })).result, "rewarded");
check("…and its simulated refund", (await rw(owner, "adminTestInviteRefund", { email: "f7@example.com" })).reversed, 1);

const n = h.failed();
console.log(n ? `\n${n} FAILED` : "\nall rewards checks passed");
process.exit(n ? 1 : 0);
