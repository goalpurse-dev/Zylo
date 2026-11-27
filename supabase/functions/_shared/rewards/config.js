// "Rewards": paying users earn FREE CREDITS (owner's brief, 2026-11-25). Separate from the Affiliate program
// (creators, cash): _shared/affiliate/config.js. ONE file for every number: change it here, redeploy rewards-api
// and stripe-webhook, and push the site.
//
//   paidPlans            the plans that unlock Rewards (free users see the page, locked)
//   videoTiers           views reached → credits for a "Made with Zyvo" video; a re-check pays only the difference
//   freeVideo            what "≈ N free videos" is counted in
//   submissionsPerWeek   video links one user may send in 7 days
//   invite.*             a friend's FIRST purchase (plan or credit pack): inviterCredits to the inviter (only while
//                        the inviter is on a paid plan), friendCredits to the friend. Not for sign-ups.
//     windowDays         the friend opens the link before, or at most this many days after, creating the account
//     maxPerMonth        invite rewards one inviter can earn per calendar month (UTC)
//     ipCooldownDays     a friend's hashed IP that already got invite credits in this many days: counts, no credits
//     clawbackDays       a refund or dispute of that first purchase within this many days takes back the unspent
//                        reward credits of both
//     linkDays           how long ?invite=CODE is remembered in the browser
// One referrer per new user: an affiliate code or link always wins over an invite, and an affiliate's invite link IS
// their affiliate link.
export const REWARDS = Object.freeze({
  paidPlans: Object.freeze(["starter", "pro", "generative", "affiliate"]),
  // owner, 2026-11-25: the headline says "Earn up to <the last tier's credits>"
  videoTiers: Object.freeze([
    Object.freeze({ views: 5_000, credits: 300 }),
    Object.freeze({ views: 25_000, credits: 600 }),
    Object.freeze({ views: 100_000, credits: 1_500 }),
    Object.freeze({ views: 500_000, credits: 5_000 }),
    Object.freeze({ views: 1_000_000, credits: 10_000 }),
  ]),
  // "≈ N free videos" next to each tier: credits ÷ the LIVE price of one In This Town video of the default length
  // (tool_prices row toolKey, read by rewards-api), rounded down, at least 1 for the first tier. fallbackCredits is
  // only used when the price can't be read (it was 313 on 2026-11-25).
  freeVideo: Object.freeze({ toolKey: "blocky-worlds:video-90", label: "In This Town video", fallbackCredits: 313 }),
  submissionsPerWeek: 10,
  invite: Object.freeze({
    inviterCredits: 500,
    friendCredits: 300,
    windowDays: 7,
    maxPerMonth: 25,
    ipCooldownDays: 7,
    clawbackDays: 30,
    linkDays: 60,
  }),
  badgePath: "/rewards/made-with-zyvo.png",
  siteUrl: "https://tryzyvo.com",
});
