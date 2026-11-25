// The affiliate program's business rules: ONE file, read by the Stripe webhook, the affiliate-api
// function and the /affiliate + /admin/affiliates pages. Change a number here, redeploy stripe-webhook
// and affiliate-api, and push the site. (Owner's brief, 2026-11-17.)
//
// What each rule does:
//   cashRate / creditRate   the default share of a referred user's FIRST payment. Each affiliate gets
//                           these when they join; the admin page can override them per affiliate.
//   creditValueEur          what one credit is worth when a commission is paid in credits (user price).
//   holdDays                a commission waits this long ("pending") before it becomes "available".
//   minCashPayoutEur        cash is paid out (by hand, PayPal or Wise) once available cash reaches this.
//   signupBonusCredits      a new user who uses a valid creator code gets these, once per account.
//   linkSignupBonus         true: someone who arrived through a ?ref link (and didn't type a code) gets
//                           the same bonus. The link stands for "use my code", so they expect it.
//   claimWindowDays         a code can be attached only to an account younger than this, and only before
//                           its first payment ("set at sign-up, never changed after").
//   refStorageDays          how long a ?ref=CODE click is remembered in the browser.
//   reverseOnPartialRefund  true: any refund (not only a full one) reverses an unpaid commission.
//   excludeTax              see below.
//   codeMinLength / codeMaxLength, reservedCodes: what a code may be. Codes are A-Z and 0-9, matched
//                           without regard to case, and may be edited once by the affiliate.
//   flagSameIp              a referral whose hashed IP matches one the affiliate used is held for review.
//   maxReferralsPerIp       more sign-ups than this for one affiliate from one hashed IP are held too.
//   siteUrl                 the address in the affiliate's link.
export const AFFILIATE = Object.freeze({
  cashRate: 0.2,
  creditRate: 0.4,
  creditValueEur: 0.02,
  holdDays: 30,
  minCashPayoutEur: 25,
  signupBonusCredits: 30,
  linkSignupBonus: true,
  claimWindowDays: 7,
  refStorageDays: 60,
  reverseOnPartialRefund: true,
  // false: commission on what the buyer paid (Pro €38 → €7.60, the brief's numbers). true: on the amount
  // without the VAT Stripe shows on the invoice/checkout.
  excludeTax: false,
  codeMinLength: 3,
  codeMaxLength: 20,
  codeEditsAllowed: 1,
  flagSameIp: true,
  maxReferralsPerIp: 2,
  // code checks (live lookups + claims) allowed per minute, per hashed IP and per account
  codeChecksPerMinute: 10,
  // the same hashed IP gets creator credits once in this many days (later sign-ups still count for the creator)
  ipBonusCooldownDays: 7,
  // "Where did you hear about Zyvo?" answers that ask for the creator's code
  creatorPlatforms: Object.freeze(["tiktok", "youtube", "instagram"]),
  currency: "EUR",
  siteUrl: "https://tryzyvo.com",
  // the "10 people buy Pro" example on the page (the Pro price is read live; this is the fallback)
  example: { buyers: 10, plan: "pro", planName: "Pro", fallbackPriceEur: 38 },
  reservedCodes: Object.freeze([
    "zyvo", "tryzyvo", "admin", "administrator", "support", "help", "free", "staff", "team", "official",
    "root", "system", "owner", "mod", "moderator", "billing", "pay", "payment", "payments", "refund",
    "stripe", "paypal", "wise", "test", "null", "undefined", "api", "www", "mail", "email", "info",
    "contact", "affiliate", "affiliates", "ref", "referral", "promo", "discount", "coupon", "credits",
    "credit", "bonus", "gift", "pro", "starter", "generative", "anthropic", "openai", "claude",
  ]),
});
