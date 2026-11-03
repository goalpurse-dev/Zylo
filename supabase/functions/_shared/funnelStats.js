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
// "What do you hope Zyvo will help you create?": a simple grouping by words. A wish can land in more than one group.
export const HOPE_GROUPS = Object.freeze([
  { key: "short", label: "TikTok, Reels or Shorts", test: /tik ?tok|reels?\b|shorts?\b|instagram|\binsta\b/i },
  { key: "faceless", label: "Faceless videos", test: /faceless|no face|without (showing )?my face/i },
  { key: "youtube", label: "YouTube or long videos", test: /youtube|\byt\b|long[- ]?form|long videos?|documentar/i },
  { key: "history", label: "History", test: /histor|ancient|war\b|wars\b|empire/i },
  { key: "stories", label: "Stories, horror, true crime", test: /\bstor(y|ies)|storytell|horror|scary|creepy|crime|myster|reddit/i },
  { key: "learning", label: "Explainers, facts, education", test: /explain|educat|learn|teach|science|facts?\b|how (it|things) works?|tutorial/i },
  { key: "business", label: "Business, products, ads", test: /business|brand|product|\bads?\b|advert|marketing|shop|store|client|compan/i },
  { key: "growth", label: "Growing an audience or income", test: /viral|views|followers|grow|money|income|earn|monetiz|passive/i },
  { key: "kids", label: "Kids, cartoons, animation", test: /kids?\b|child|cartoon|anim/i },
  { key: "motivation", label: "Motivation, quotes, self-improvement", test: /motivat|inspir|quotes?\b|mindset|self[- ]?improv|stoic/i },
  { key: "gaming", label: "Gaming, Minecraft, Roblox", test: /gam(e|ing)|minecraft|roblox|fortnite/i },
  { key: "music", label: "Music", test: /music|songs?\b|lyric/i },
]);
export function hopeGroupsOf(text) {
  const t = String(text ?? "");
  const hit = HOPE_GROUPS.filter((g) => g.test.test(t)).map((g) => g.key);
  return hit.length ? hit : ["other"];
}
const pct = (n, of) => (of > 0 ? Math.round((n / of) * 100) : 0);
const ranked = (counts, labels = {}) => Object.entries(counts).map(([key, n]) => ({ key, label: labels[key] ?? key, n })).sort((a, b) => b.n - a.n);
const bump = (o, k) => { o[k] = (o[k] ?? 0) + 1; };

/**
 * The welcome email's open rate per day (owner, 2026-11-03), the last `days` days in Finnish time, newest first: the emails
 * delivered that day, how many of them were opened (at any time since), and how many were first opened over a minute after
 * delivery (an open within seconds is mostly mail software, not a person). rows: email_events of the welcome email
 * { resend_id, type, created_at }.
 */
export function welcomeDaily(rows = [], { days = 14, now = Date.now() } = {}) {
  const dayOf = (t) => new Date(t).toLocaleDateString("en-CA", { timeZone: "Europe/Helsinki" }); // YYYY-MM-DD
  const first = (type) => {
    const m = new Map();
    for (const r of rows) {
      if (r.type !== type) continue;
      const t = Date.parse(r.created_at);
      if (!m.has(r.resend_id) || t < m.get(r.resend_id)) m.set(r.resend_id, t);
    }
    return m;
  };
  const delivered = first("email.delivered"), opened = first("email.opened");
  const byDay = new Map();
  for (let i = 0; byDay.size < days && i < days + 2; i++) {
    const day = dayOf(now - i * 86400000);
    if (!byDay.has(day)) byDay.set(day, { day, delivered: 0, opened: 0, openedLater: 0 });
  }
  for (const [id, t] of delivered) {
    const r = byDay.get(dayOf(t));
    if (!r) continue;
    r.delivered++;
    const o = opened.get(id);
    if (o === undefined) continue;
    r.opened++;
    if (o - t > 60000) r.openedLater++;
  }
  return [...byDay.values()].map((r) => ({ ...r, openPct: pct(r.opened, r.delivered), laterPct: pct(r.openedLater, r.delivered) }));
}

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

  // the optional last question: every answer, newest first, with what the same person picked before it
  const hopes = answers.filter((o) => String(o.hope ?? "").trim())
    .map((o) => ({
      text: String(o.hope).trim(), at: o.survey_done_at ?? null, groups: hopeGroupsOf(o.hope),
      goals: (o.goals ?? []).map((g) => LABELS.goals[g] ?? g), experience: LABELS.experience[o.experience] ?? o.experience ?? null,
      heard: LABELS.heard[o.heard_from] ?? o.heard_from ?? null, creator: String(o.heard_creator ?? "").trim() || null,
    }))
    .sort((a, b) => Date.parse(b.at ?? 0) - Date.parse(a.at ?? 0));
  const hopeCounts = {};
  for (const h of hopes) for (const g of h.groups) bump(hopeCounts, g);
  const hopeLabels = { ...Object.fromEntries(HOPE_GROUPS.map((g) => [g.key, g.label])), other: "Something else" };

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
    // the "check your spam" note: people it was shown to, and who tapped "I found it"
    noteShown: who(is("spam_note_shown")).size,
    noteFound: who(is("spam_note_found")).size,
    // replies go straight to the owner's inbox (Reply-To): we can't count them here
    replies: null,
  };

  return {
    total, steps, surveyEnds,
    clicks: ranked(clickCounts, clickLabels), comparePlans: ranked(comparePlans),
    survey: { goals: ranked(goals, LABELS.goals), experience: ranked(experience, LABELS.experience), heard: ranked(heard, LABELS.heard), creators: ranked(creators), answered, optedIn, optInPct: pct(optedIn, answered), hopes: hopes.slice(0, 300), hopeCount: hopes.length, hopeGroups: ranked(hopeCounts, hopeLabels) },
    topics: ranked(topics), email,
  };
}
