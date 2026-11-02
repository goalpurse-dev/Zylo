// The funnel dashboard's numbers, from the raw rows. Pure, so it is tested in node. "How far do the people who signed up in
// this period get": every count is of distinct people in that group, whenever they took the step.
export const FUNNEL_STEPS = Object.freeze([
  { key: "signed_up", label: "Signed up" },
  { key: "survey_started", label: "Survey started" },
  { key: "survey_done", label: "Survey completed or skipped" },
  { key: "plan_screen_finished", label: "Building your plan finished" },
  { key: "tutorial_started", label: "Pick your first video" },
  { key: "generate_clicked", label: "Generate clicked" },
  { key: "preview_generated", label: "Preview finished" },
  { key: "upgrade_screen_shown", label: "Upgrade screen shown" },
  { key: "checkout_opened", label: "Checkout opened" },
  { key: "upgraded", label: "Paid" },
]);
const LABELS = {
  goals: { faceless: "Faceless TikTok, Reels or Shorts", longform: "Long-form YouTube videos", business: "My business or brand", exploring: "Just exploring" },
  experience: { never: "Never", few: "A few", regular: "I post regularly" },
  heard: { tiktok_creator: "TikTok creator", tiktok_ad: "TikTok ad", instagram: "Instagram", youtube: "YouTube", google: "Google", friend: "Friend", other: "Other" },
  buttons: { finish: "Finish my video", compare: "Compare plans", explore: "Explore Zyvo first" },
};
const pct = (n, of) => (of > 0 ? Math.round((n / of) * 100) : 0);
const ranked = (counts, labels = {}) => Object.entries(counts).map(([key, n]) => ({ key, label: labels[key] ?? key, n })).sort((a, b) => b.n - a.n);
const bump = (o, k) => { o[k] = (o[k] ?? 0) + 1; };

/**
 * events: funnel_events rows { user_id, event, props, created_at }, from the start of the period on.
 * onboarding: user_onboarding rows of those people. excluded: user ids left out (the owner, test accounts).
 * from, to: the period (ISO): the group is who signed up inside it. emailEvents: email_events rows of the welcome email.
 * sends: email_sends rows of the welcome email.
 */
export function funnelStats({ events = [], onboarding = [], excluded = [], from, to, emailEvents = [], sends = [] }) {
  const skip = new Set(excluded), start = Date.parse(from), end = Date.parse(to);
  const signedUp = new Set(events.filter((e) => e.event === "signed_up" && !skip.has(e.user_id) && Date.parse(e.created_at) >= start && Date.parse(e.created_at) < end).map((e) => e.user_id));
  const mine = events.filter((e) => signedUp.has(e.user_id));
  const who = (test) => new Set(mine.filter(test).map((e) => e.user_id));
  const is = (...names) => (e) => names.includes(e.event);
  const reached = {
    signed_up: signedUp,
    survey_started: who(is("survey_started", "survey_answer", "survey_completed", "survey_skipped")),
    survey_done: who(is("survey_completed", "survey_skipped")),
    plan_screen_finished: who(is("plan_screen_finished")),
    tutorial_started: who(is("tutorial_started")),
    generate_clicked: who((e) => e.event === "tutorial_step_completed" && Number(e.props?.step) === 2),
    preview_generated: who(is("preview_generated")),
    upgrade_screen_shown: who(is("upgrade_screen_shown")),
    checkout_opened: who(is("checkout_opened")),
    upgraded: who(is("upgraded")),
  };
  const total = signedUp.size;
  let before = total;
  // steps whose event didn't exist yet: nobody in the data at all means "not tracked", not "everyone dropped off"
  const NEW_EVENTS = { plan_screen_finished: "plan_screen_finished", checkout_opened: "checkout_opened" };
  const steps = FUNNEL_STEPS.map((s) => {
    const users = reached[s.key].size;
    if (NEW_EVENTS[s.key] && !events.some((e) => e.event === NEW_EVENTS[s.key])) return { ...s, users, pctOfSignups: 0, lostFromPrevious: 0, notTracked: true };
    const row = { ...s, users, pctOfSignups: pct(users, total), lostFromPrevious: Math.max(0, before - users) };
    before = users;
    return row;
  });
  const surveyEnds = { completed: who(is("survey_completed")).size, skipped: who(is("survey_skipped")).size };

  // the buttons on the upgrade screen, each person counted once per button
  const clickCounts = {};
  for (const [button, set] of Object.entries(mine.filter(is("upgrade_click")).reduce((m, e) => { const b = String(e.props?.button ?? "?"); (m[b] ??= new Set()).add(e.user_id); return m; }, {}))) clickCounts[button] = set.size;
  const comparePlans = {};
  for (const [plan, set] of Object.entries(mine.filter(is("compare_plan_click")).reduce((m, e) => { const p = String(e.props?.plan ?? "?"); (m[p] ??= new Set()).add(e.user_id); return m; }, {}))) comparePlans[plan] = set.size;
  const clickLabels = { ...LABELS.buttons, ...Object.fromEntries(Object.keys(clickCounts).filter((k) => k.startsWith("plan:")).map((k) => [k, `Plan button: ${k.slice(5)}`])) };

  // what the group answered
  const answers = onboarding.filter((o) => signedUp.has(o.user_id));
  const goals = {}, experience = {}, heard = {}, creators = {};
  for (const o of answers) {
    for (const g of o.goals ?? []) bump(goals, g);
    if (o.experience) bump(experience, o.experience);
    if (o.heard_from) bump(heard, o.heard_from);
    const c = String(o.heard_creator ?? "").trim();
    if (c) bump(creators, c.toLowerCase());
  }
  const answered = answers.filter((o) => o.survey_done_at).length, optedIn = answers.filter((o) => o.survey_done_at && o.email_consent_at).length;

  // the video each person generated (their last Generate)
  const lastTopic = new Map();
  for (const e of [...mine].filter((x) => x.event === "tutorial_step_completed" && Number(x.props?.step) === 2 && x.props?.topic).sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))) lastTopic.set(e.user_id, String(e.props.topic));
  const topics = {};
  for (const t of lastTopic.values()) bump(topics, t);

  // the welcome email: one row per Resend event, so each type counts each email once
  const emailCount = (type) => new Set(emailEvents.filter((e) => e.type === type).map((e) => e.resend_id)).size;
  const email = {
    sent: sends.length,
    delivered: emailCount("email.delivered"),
    opened: emailCount("email.opened"),
    clicked: new Set(events.filter((e) => e.event === "welcome_email_clicked" && !skip.has(e.user_id)).map((e) => e.user_id)).size,
    bounced: emailCount("email.bounced"),
    spam: emailCount("email.complained"),
  };

  return {
    total, steps, surveyEnds,
    clicks: ranked(clickCounts, clickLabels), comparePlans: ranked(comparePlans),
    survey: { goals: ranked(goals, LABELS.goals), experience: ranked(experience, LABELS.experience), heard: ranked(heard, LABELS.heard), creators: ranked(creators), answered, optedIn, optInPct: pct(optedIn, answered) },
    topics: ranked(topics), email,
  };
}
