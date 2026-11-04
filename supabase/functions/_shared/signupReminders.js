// The follow-up reminders after sign-up (owner, 2026-11-04: the welcome email lands while people are still on the site, so
// it barely matters). Three emails, each at most once per account, from notify.tryzyvo.com in the plain personal-note style
// of the welcome email (welcomePlainEmail): one link, no button, no images, the plain footer.
//   preview_unpaid     about 2 hours after sign-up: made the free preview, didn't pay
//   preview_not_made   about 2 hours after sign-up: never made the free preview (or it failed and they didn't retry)
//   bonus_day2         day 2: ticked the email opt-in, hasn't paid, the +50 sign-up bonus ends tomorrow (its real end time)
// Never to someone who paid, never two reminders to one person within 24 hours, never to someone who unsubscribed, and not
// while they are on the site right now (the welcome email's lesson). Sent by the signup-reminders function, every 10 minutes,
// only while onboarding_settings.reminders_on is true. Pure, so the rules and texts are tested in node.
// Links carry ?from=email&r=<kind>: the app records the click (OnboardingGate), click tracking stays off at Resend.
import { APP_URL } from "./emailRules.js";
import { bonusEndText } from "./welcomeEmail.js";

const HOUR = 3600000;
export const REMINDER_KINDS = Object.freeze(["preview_unpaid", "preview_not_made", "bonus_day2"]);
// when each one may go: hours after sign-up (a later tick still catches someone who was on the site at the first one)
export const WINDOWS = Object.freeze({
  preview_unpaid: [2, 6],
  preview_not_made: [2, 6],
  bonus_day2: [47, 55], // the bonus ends 72 h after sign-up: 17 to 25 hours left, "tomorrow"
});
export const QUIET_MIN = 30;        // no email while they did something on the site in the last 30 minutes
export const BONUS_MIN_LEFT_H = 12; // and none about a bonus with less than 12 hours left

const link = (path, kind) => `${APP_URL}${path}${path.includes("?") ? "&" : "?"}from=email&r=${kind}`;
export const REMINDER_LINKS = Object.freeze({
  preview_unpaid: link("/welcome/first-video?unlock=1", "preview_unpaid"),   // the upgrade screen, the preview above it
  preview_not_made: link("/welcome/first-video", "preview_not_made"),
  bonus_day2: link("/pricing", "bonus_day2"),
  bonus_day2_with_preview: link("/welcome/first-video?unlock=1", "bonus_day2"),
});
const shown = (url) => url.replace(/^https:\/\//, "").replace(/\?.*$/, "");

export const REMINDER_LABELS = Object.freeze({
  preview_unpaid: "2 h: made the preview, didn't pay",
  preview_not_made: "2 h: never made the preview",
  bonus_day2: "Day 2: +50 bonus ends tomorrow (opt-in only)",
});
// the gate's category: the two 2-hour reminders are about their own account, like the welcome email (the gate's marketing
// rule allows none in the first 24 hours); the bonus is an offer, so marketing: email_updates = true, 1 a day
export const REMINDER_CATEGORY = Object.freeze({ preview_unpaid: "account", preview_not_made: "account", bonus_day2: "marketing" });
const WHY = {
  account: "You're getting this because you created a Zyvo account.",
  marketing: "You're getting this because you asked to hear about offers when you signed up for Zyvo.",
};

/**
 * Which reminder, if any, this person gets now. → { kind } or { kind: null, why }.
 *   signedUpAt, enrolled (the new flow), paid (any plan or payment), owner (an owner or test account), unsubscribed (their
 *   last unsubscribe-page action was "unsubscribe"), optedIn (ticked the opt-in and email_updates still on),
 *   preview: null | { status } (cutaway_free_previews), bonusEndsAt, lastActiveAt (their newest funnel event),
 *   sent: [{ kind, sentAt }] (reminders they already got)
 */
export function reminderFor(p, now = Date.now()) {
  if (!p?.enrolled) return { kind: null, why: "not in the new flow" };
  if (p.owner) return { kind: null, why: "owner or test account" };
  if (p.paid) return { kind: null, why: "paid" };
  if (p.unsubscribed) return { kind: null, why: "unsubscribed" };
  const sent = p.sent ?? [];
  if (sent.some((s) => now - Date.parse(s.sentAt) < 24 * HOUR)) return { kind: null, why: "a reminder in the last 24 hours" };
  const age = (now - Date.parse(p.signedUpAt)) / HOUR;
  if (!Number.isFinite(age)) return { kind: null, why: "no sign-up time" };
  const inWindow = (kind) => age >= WINDOWS[kind][0] && age < WINDOWS[kind][1] && !sent.some((s) => s.kind === kind);
  const status = p.preview?.status ?? null;
  let kind = null;
  if (inWindow("preview_unpaid") && status === "ready") kind = "preview_unpaid";
  else if (inWindow("preview_not_made") && (status === null || status === "failed")) kind = "preview_not_made";
  else if (inWindow("bonus_day2") && p.optedIn) {
    const left = Date.parse(p.bonusEndsAt ?? "") - now;
    if (left > BONUS_MIN_LEFT_H * HOUR) kind = "bonus_day2";
  }
  if (!kind) return { kind: null, why: "nothing due" };
  // on the site right now: the next tick tries again (until the window closes)
  if (p.lastActiveAt && now - Date.parse(p.lastActiveAt) < QUIET_MIN * 60000) return { kind: null, why: "on the site now" };
  return { kind };
}

const para = (s) => `<p style="margin:0 0 14px">${s}</p>`;
// lines: text, or { before, link }: "before <a>www.tryzyvo.com/path</a>"
function plain(lines, footer) {
  const html = `
    <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#222222">
      ${lines.map((l) => para(typeof l === "string" ? l : `${l.before} <a href="${l.link}">${shown(l.link)}</a>`)).join("\n      ")}
      ${footer.html}
    </div>`;
  const text = [...lines.flatMap((l) => [typeof l === "string" ? l : `${l.before} ${l.link}`, ""]), footer.text].join("\n");
  return { html, text };
}

/**
 * The email for a kind: { subject, why, category, render(footer) }. bonusEndsAt: bonus_day2 only (its real end time);
 * hasPreview: bonus_day2 links to the upgrade screen when they have a finished preview, else to the plans.
 */
export function reminderEmail(kind, { bonusEndsAt = null, hasPreview = false } = {}) {
  const category = REMINDER_CATEGORY[kind];
  if (!category) throw new Error(`unknown reminder ${kind}`);
  const why = WHY[category];
  if (kind === "preview_unpaid") return {
    subject: "Your video is still waiting: unlock the other 20 seconds", why, category,
    render: (footer) => plain([
      "Hi,",
      "Your free preview is ready, and the other 20 seconds of your video are waiting for you.",
      { before: "You can unlock the full video here:", link: REMINDER_LINKS.preview_unpaid },
      "If something held you back, just hit reply and tell me. I read every answer.",
      "Niko",
    ], footer),
  };
  if (kind === "preview_not_made") return {
    subject: "Your free video preview is still waiting", why, category,
    render: (footer) => plain([
      "Hi,",
      "Your free video preview is still waiting, it only takes a minute.",
      { before: "Pick a topic and start it here:", link: REMINDER_LINKS.preview_not_made },
      "If something got in the way, just hit reply and tell me. I read every answer.",
      "Niko",
    ], footer),
  };
  const ends = bonusEndsAt ? bonusEndText(bonusEndsAt) : null; // (new Date(null) would be 1970)
  if (!ends) throw new Error("bonus_day2 needs the bonus's end time");
  return {
    subject: "Your +50 bonus credits end tomorrow", why, category,
    render: (footer) => plain([
      "Hi,",
      `A quick reminder: the 50 bonus credits you got for signing up end tomorrow, ${ends}.`,
      "Start any plan before then and the 50 credits are added on top of it.",
      { before: hasPreview ? "You can finish your video and pick a plan here:" : "You can see the plans here:", link: hasPreview ? REMINDER_LINKS.bonus_day2_with_preview : REMINDER_LINKS.bonus_day2 },
      "Niko",
    ], footer),
  };
}

/**
 * The dashboard's numbers per reminder (owner, 2026-11-04): sent, delivered, opened, opened after the first minute, clicked,
 * came back, made the preview, paid. Everything after each person's own send.
 *   sends: signup_reminders rows { user_id, kind, resend_id, sent_at }
 *   emailEvents: email_events rows of the reminders { resend_id, type, created_at }
 *   events: funnel_events { user_id, event, props, created_at } (from before the oldest send on)
 *   excluded: user ids left out (owner, test accounts)
 */
export function reminderStats({ sends = [], emailEvents = [], events = [], excluded = [] } = {}) {
  const skip = new Set(excluded);
  const first = (type) => {
    const m = new Map();
    for (const e of emailEvents) if (e.type === type) { const t = Date.parse(e.created_at); if (!m.has(e.resend_id) || t < m.get(e.resend_id)) m.set(e.resend_id, t); }
    return m;
  };
  const delivered = first("email.delivered"), opened = first("email.opened"), bounced = first("email.bounced"), spam = first("email.complained");
  const byUser = new Map();
  for (const e of events) { if (!byUser.has(e.user_id)) byUser.set(e.user_id, []); byUser.get(e.user_id).push(e); }
  const pct = (n, of) => (of > 0 ? Math.round((n / of) * 100) : 0);
  return REMINDER_KINDS.map((kind) => {
    const rows = sends.filter((s) => s.kind === kind && !skip.has(s.user_id));
    const r = { kind, label: REMINDER_LABELS[kind], sent: rows.length, delivered: 0, bounced: 0, spam: 0, opened: 0, openedLater: 0, clicked: 0, cameBack: 0, madePreview: 0, paid: 0 };
    for (const s of rows) {
      const id = s.resend_id, at = Date.parse(s.sent_at);
      if (id && delivered.has(id)) r.delivered++;
      if (id && bounced.has(id)) r.bounced++;
      if (id && spam.has(id)) r.spam++;
      if (id && opened.has(id)) { r.opened++; if (opened.get(id) - (delivered.get(id) ?? at) > 60000) r.openedLater++; }
      const after = (byUser.get(s.user_id) ?? []).filter((e) => Date.parse(e.created_at) > at);
      if (after.some((e) => e.event === "welcome_email_clicked" && e.props?.email === kind)) r.clicked++;
      // came back: anything they did on the site after the email (the email skips people who are on the site)
      if (after.length) r.cameBack++;
      if (after.some((e) => e.event === "preview_generated")) r.madePreview++;
      if (after.some((e) => e.event === "upgraded")) r.paid++;
    }
    return { ...r, openPct: pct(r.opened, r.delivered), laterPct: pct(r.openedLater, r.delivered) };
  });
}
