// _shared/opsHealth.js — the owner's health report (2026-10-26): every outside service we depend
// on, green or red, its balance and about how many days it lasts at the current rate, and what to
// do when something is red. Plain JS (no Deno imports): the ops-health function and the tests read it.
//   - a daily email at 9:00 Finnish time (dailyReport)
//   - an instant alert only when REAL users are failing or a balance runs out within 3 days
//     (instantAlerts); the owner's own tests never count; alerts are grouped (adminAlert.ts)

export const ALERT_DAYS = 3;          // a balance that runs out sooner than this is red, at once
export const REPORT_HOUR_HELSINKI = 9;

// Every outside service Zyvo depends on. kind: "balance" (prepaid, can run out), "plan" (monthly
// quota), "postpaid" (billed after use), "free"/"platform". checked: the report reads it.
export const SERVICES = [
  { id: "runware", name: "Runware", does: "pictures and videos (Long Form scenes, Fruit, Blocky, image and video tools)", kind: "balance", checked: true,
    fix: "Top up at my.runware.ai (Billing). Turn on auto-reload there so it never runs dry.", autoTopUp: "Yes: auto-reload with a threshold, in the Runware dashboard (Billing)." },
  { id: "elevenlabs", name: "ElevenLabs", does: "voiceovers (Long Form; Cutaway tests)", kind: "plan", checked: true,
    fix: "Upgrade the plan or buy extra credits at elevenlabs.io (Subscription).", autoTopUp: "No top-up as such: buy Pay As You Go credits (used when the monthly quota runs out), or a bigger plan. Older plans can turn on usage-based billing." },
  { id: "openai", name: "OpenAI", does: "writing and checks (Long Form scripts, picture checks, Fruit, Blocky)", kind: "balance", checked: true, statusPage: "status.openai.com", creditSite: "platform.openai.com",
    fix: "Add credit at platform.openai.com (Billing).", autoTopUp: "Yes: auto recharge (threshold + amount + optional monthly limit) in Billing." },
  { id: "anthropic", name: "Anthropic (Claude)", does: "writing (Long Form research and scripts, Fruit, Blocky, Content Machine)", kind: "balance", checked: true, statusPage: "status.anthropic.com",
    fix: "Add credit at console.anthropic.com (Plans & Billing).", autoTopUp: "Yes: auto-reload (minimum balance + reload amount) in Plans & Billing." },
  { id: "fly", name: "Fly.io", does: "the video renderers (Long Form, Fruit, Blocky final videos)", kind: "postpaid", checked: true,
    fix: "Check fly.io/dashboard (machines and billing).", autoTopUp: "Not needed: billed to the card after use." },
  { id: "runpod", name: "RunPod", does: "Cutaway Explainer rendering (not live yet, owner tests only)", kind: "balance", checked: true, ownerOnly: true,
    fix: "Top up at runpod.io (Billing).", autoTopUp: "Yes: auto-pay (threshold + amount, card) in Billing." },
  { id: "fal", name: "fal.ai", does: "lip-sync and an older video path", kind: "balance", checked: false,
    fix: "Top up at fal.ai (Billing).", autoTopUp: "Not found in fal's docs: top up by hand, check the dashboard." },
  { id: "atlascloud", name: "Atlas Cloud", does: "an older video path (no key is set: not in use)", kind: "balance", checked: false,
    fix: "-", autoTopUp: "Yes: auto top-up in Billing settings (only if it is used again)." },
  { id: "resend", name: "Resend", does: "all emails (sign-up, warm-up, alerts)", kind: "plan", checked: true,
    fix: "Check resend.com (plan limits, domain status).", autoTopUp: "Not needed: monthly plan." },
  { id: "stripe", name: "Stripe", does: "payments and subscriptions", kind: "platform", checked: true,
    fix: "Check dashboard.stripe.com.", autoTopUp: "Not applicable (it pays us)." },
  { id: "supabase", name: "Supabase", does: "database, sign-in, all server functions", kind: "postpaid", checked: true,
    fix: "Check supabase.com/dashboard.", autoTopUp: "Not needed: monthly plan." },
  { id: "vercel", name: "Vercel", does: "the website tryzyvo.com", kind: "postpaid", checked: true,
    fix: "Check vercel.com (deployments).", autoTopUp: "Not needed: monthly plan." },
  { id: "google", name: "Google (YouTube)", does: "publishing to YouTube and its stats", kind: "free", checked: false, fix: "-", autoTopUp: "Not applicable." },
  { id: "tiktok", name: "TikTok", does: "publishing to TikTok", kind: "free", checked: false, fix: "-", autoTopUp: "Not applicable." },
  { id: "instagram", name: "Instagram", does: "publishing to Instagram and its stats", kind: "free", checked: false, fix: "-", autoTopUp: "Not applicable." },
  { id: "cloudflare", name: "Cloudflare", does: "the domain's DNS and email forwarding", kind: "free", checked: false, fix: "-", autoTopUp: "Not applicable." },
];

// Spend per day from balance readings: only the drops count (a rise is a top-up).
// points: [{ balance, at }] oldest first. → usd (or units) per day, or null without enough history.
export function ratePerDay(points, minHours = 6) {
  const p = [...points].filter((x) => Number.isFinite(Number(x.balance))).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  if (p.length < 2) return null;
  const hours = (Date.parse(p.at(-1).at) - Date.parse(p[0].at)) / 3600_000;
  if (hours < minHours) return null;
  let used = 0;
  for (let i = 1; i < p.length; i++) used += Math.max(0, Number(p[i - 1].balance) - Number(p[i].balance));
  return (used / hours) * 24;
}

export function daysLeft(balance, perDay) {
  if (balance == null || perDay == null) return null; // unknown is not zero
  if (!Number.isFinite(Number(balance)) || !Number.isFinite(Number(perDay)) || perDay <= 0) return null;
  return Number(balance) / Number(perDay);
}

// The owner's own accounts: the emails in ADMIN_EMAILS and CUTAWAY_TEST_USERS (comma-separated).
export const ownerEmails = (...lists) => [...new Set(lists.flatMap((v) => String(v ?? "").split(/[,\s]+/)).map((e) => e.trim().toLowerCase()).filter((e) => e.includes("@")))];

// Why a service check got no good answer, from its error ("401 ...", "Signal timed out."):
//   quota    the provider says the money or quota ran out (402, insufficient_quota, "credit balance is too low")
//   key      our key was refused (401/403)
//   timeout  no answer in time
//   down     anything else (5xx, a dropped connection)
// Only "quota" means "add credit" (owner, 2026-11-05: two lone timeouts said "Add credit" with $10 left).
export function checkFailure(error) {
  const e = String(error ?? "");
  const status = Number(/^(\d{3})\b/.exec(e)?.[1] ?? 0);
  if (status === 402 || /insufficient_quota|exceeded your current quota|credit balance|billing|payment required/i.test(e)) return "quota";
  if (status === 401 || status === 403) return "key";
  if (!status && /timed? ?out|timeout/i.test(e)) return "timeout";
  return "down";
}

// openaiBackup.js's log rows since the last tick → { covered, coverFailed, coverReasons }.
export function summarizeBackup(rows) {
  const used = rows.filter((r) => r.event === "backup_used"), failed = rows.filter((r) => r.event === "backup_failed");
  return { covered: used.length, coverFailed: failed.length, coverReasons: [...new Set([...used, ...failed].map((r) => r.details?.reason).filter(Boolean))] };
}

// What to do when a service didn't answer properly, by why.
function downAdvice(service, failure) {
  const status = service.statusPage ? `check ${service.statusPage}` : "check the provider's status page";
  if (failure === "quota") return service.fix;
  if (failure === "key") return `${service.name} refused our API key: check the key in the Supabase secrets is still active.`;
  if (failure === "timeout") return `${service.name} didn't respond in time. Usually a short hiccup on their side: ${status}. Nothing to top up (a billing problem would say so). If it repeats for an hour, real users are likely affected.`;
  return `${service.name} answered with an error: ${status}. If it repeats for an hour, real users are likely affected.`;
}

// Why a real user's job failed, from its error code and text (owner, 2026-11-07: "3 failures for
// 1 real user" said "top up" with $22 left; the failures were Runware's own internal errors and
// pictures stuck on our side, and a week of "failures" were half users out of their own credits).
//   user      the user's own limits (their Zyvo credits, free allowance, plan): not counted at all
//   balance   the provider refused us for money: the only kind where topping up helps
//   provider  the provider took the request and failed it (an internal error, a rejection)
//   stuck     it never finished on our side (STUCK_TIMEOUT, refunded by the sweeper)
//   other     anything else (our own checks, a bad reference picture)
export const USER_SIDE_CODES = /^(INSUFFICIENT_CREDITS|FREE_LIMIT|PLAN_UPGRADE_REQUIRED|BILLING_RESERVATION_REQUIRED|INVALID_BILLING_RESERVATION|INVALID_JOB_SIGNATURE)$/;
const MONEY_REFUSED = /insufficient (?:balance|funds)|not enough (?:balance|funds)|low balance|out of credit|payment.?required|\(402\)|\b402\b/i;
export function failureKind(code, error) {
  const c = String(code ?? "").toUpperCase().trim(), e = String(error ?? "");
  if (USER_SIDE_CODES.test(c)) return "user";
  if (MONEY_REFUSED.test(e)) return "balance";
  if (c === "STUCK_TIMEOUT") return "stuck";
  if (c.startsWith("PROVIDER_") || /internalError|serviceOverloaded|provider couldn't|provider rejected/i.test(e)) return "provider";
  return "other";
}
// rows: [{ code, error }] → { balance, provider, stuck, other } (the user's own limits left out)
export function countFailureKinds(rows) {
  const out = {};
  for (const r of rows) { const k = failureKind(r.code, r.error); if (k !== "user") out[k] = (out[k] ?? 0) + 1; }
  return out;
}
const KIND_LABEL = { balance: "refused for money", provider: "errors on SERVICE's side", stuck: "stuck on our side", other: "other errors" };
const KIND_ORDER = ["balance", "provider", "stuck", "other"];
export function failureLabel(service, kinds) {
  return KIND_ORDER.filter((k) => kinds[k]).map((k) => KIND_LABEL[k].replace("SERVICE", service.name)).join(", ");
}
// What to do, matched to why they failed. Only a money refusal says "top up".
export function failureAdvice(service, kinds) {
  const n = (k) => kinds[k] ?? 0;
  const out = [];
  if (n("balance")) out.push(service.fix);
  if (n("provider")) out.push(`${n("provider")} failed with an error on ${service.name}'s side (for example "internal error, your request was not processed"). That is not a balance problem: topping up does not fix it. Users can simply try again; if it keeps happening for an hour, tell ${service.name} support (they can look up the job ids from /admin/ops).`);
  if (n("stuck")) out.push(`${n("stuck")} never finished on our side and were refunded automatically (users were not charged). Nothing to top up: it is a bug on our side to look at (failed jobs on /admin/ops).`);
  if (n("other")) out.push(`${n("other")} failed for other reasons (our own checks or the user's input): see the failed jobs on /admin/ops. Nothing to top up.`);
  return out.join(" ");
}

// One service's state → { ok, red, info, left, todo }. s: what the function measured:
//   { reachable, error, tries, balance, unit, perDay, perDaySource, failingUsers, failures, failureKinds, note, resetsInDays }
//   failureKinds: { balance, provider, stuck, other } — when given, the advice follows the cause
export function judge(service, s) {
  const red = [], todo = [];
  // Real calls failing over to Claude (OpenAI only): first, so the alert says so.
  const status = service.statusPage ? `check ${service.statusPage}` : "check the provider's status page";
  const creditEmpty = (s.coverReasons ?? []).some((x) => /credit is empty/.test(x));
  if (s.coverFailed >= 1) {
    // No plural forms: the alert's subject must read the same for 1 and for 14 (adminAlert groups by it).
    red.push(`failing, and the Claude backup failed too (${s.coverFailed} in the last 10 minutes): users are seeing failures`);
    todo.push(creditEmpty ? service.fix : `${status} and status.anthropic.com.`);
  } else if (s.covered >= 1) {
    red.push(`failing, Claude is covering (${s.covered} in the last 10 minutes)`);
    todo.push(creditEmpty ? service.fix : `Nothing breaks for users: their requests go to Claude until ${service.name} answers again. ${status[0].toUpperCase()}${status.slice(1)}.`);
  }
  if (s.reachable === false) {
    const failure = checkFailure(s.error);
    red.push(failure === "timeout" ? `didn't respond in time${s.tries > 1 ? ` (${s.tries} tries)` : ""}`
      : failure === "quota" && service.creditSite ? `credit is empty, add credit at ${service.creditSite}`
      : `not reachable: ${s.error ?? "no answer"}`);
    todo.push(downAdvice(service, failure));
  }
  const left = daysLeft(s.balance, s.perDay);
  // A monthly quota that resets before it runs out is fine.
  const runsOutFirst = left != null && (s.resetsInDays == null || left < s.resetsInDays);
  const before = red.length;
  if (runsOutFirst && left < ALERT_DAYS) red.push(`runs out in about ${left < 1 ? "less than a day" : `${left.toFixed(1)} days`}`);
  if (Number(s.balance) <= 0 && s.balance != null && service.kind === "balance") red.push("balance is empty");
  const balanceRed = red.length > before;
  if (balanceRed) todo.push(service.fix);
  if ((s.failingUsers ?? 0) >= 1 && (s.failures ?? 0) >= 3) {
    const kinds = s.failureKinds;
    red.push(`${s.failures} failures for ${s.failingUsers} real user${s.failingUsers === 1 ? "" : "s"} in the last hour${kinds && failureLabel(service, kinds) ? ` (${failureLabel(service, kinds)})` : ""}`);
    todo.push(kinds ? failureAdvice(service, kinds) : service.fix);
  }
  const what = [...new Set(todo)].join(" ");
  if (service.ownerOnly) return { ok: red.length === 0, red: [], info: red, left, todo: what }; // owner-only (Cutaway): shown, never red
  return { ok: red.length === 0, red, info: [], left, todo: what };
}

const money = (v, unit) => (unit === "usd" ? `$${Number(v).toFixed(2)}` : `${Math.round(Number(v)).toLocaleString("en-US")} ${unit}`);

export function serviceLine(service, s, j) {
  const parts = [];
  parts.push(s.reachable === false ? "NOT WORKING" : s.reachable === true ? "working" : "not checked");
  if (s.balance != null) parts.push(`balance ${money(s.balance, s.unit ?? "usd")}`);
  if (s.perDay != null) parts.push(`uses about ${money(s.perDay, s.unit ?? "usd")} a day${s.perDaySource === "estimate" ? " (estimate)" : ""}`);
  if (j.left != null) parts.push(`lasts about ${j.left >= 60 ? "60+" : j.left < 1 ? "less than 1" : Math.floor(j.left)} days${s.resetsInDays != null ? ` (quota resets in ${Math.ceil(s.resetsInDays)} days)` : ""}`);
  if (s.note) parts.push(s.note);
  const head = `${j.red.length ? "🔴 RED" : "🟢 GREEN"}  ${service.name}`;
  const body = `   ${parts.join(" · ")}`;
  const why = j.red.length ? `\n   Problem: ${j.red.join("; ")}\n   What to do: ${j.todo}` :j.info.length ? `\n   (owner tests only, not live: ${j.info.join("; ")})` : "";
  return `${head}\n${body}${why}`;
}

// Stuck jobs in the daily email (2026-11-07: they used to be one email each, every few hours).
// rows: the sweeper's stuck_job_refunded log rows of the last 24 h ([{ tool_key, details }]).
export function stuckJobsLines(rows) {
  if (!rows?.length) return ["Stuck jobs in the last 24 hours: none."];
  const byTool = {};
  for (const r of rows) byTool[r.tool_key ?? "?"] = (byTool[r.tool_key ?? "?"] ?? 0) + 1;
  const credits = rows.reduce((a, r) => a + Number(r.details?.creditsRefunded ?? 0), 0);
  return [`Stuck jobs in the last 24 hours: ${rows.length}, refunded automatically (${credits} credits went back to users). ${Object.entries(byTool).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ×${n}`).join(", ")}.`,
    "An email comes at once only when 5 or more get stuck within an hour."];
}

// The daily email. results: [{ service, state, judged }]; extra: more lines (stuck jobs).
export function dailyReport(results, nowIso, extra = []) {
  const red = results.filter((r) => r.judged.red.length);
  const day = new Date(nowIso).toLocaleDateString("en-GB", { timeZone: "Europe/Helsinki", weekday: "long", day: "numeric", month: "long" });
  const subject = red.length ? `Zyvo health: ${red.length} RED (${red.map((r) => r.service.name).join(", ")})` : "Zyvo health: all green";
  const text = [
    `Good morning. Zyvo's outside services, ${day}:`,
    "",
    ...(red.length ? ["NEEDS YOU:", ...red.map((r) => `- ${r.service.name}: ${r.judged.red.join("; ")}. ${r.judged.todo}`), ""] : ["Nothing needs you today.", ""]),
    ...results.map((r) => serviceLine(r.service, r.state, r.judged)),
    "",
    ...(extra.length ? [...extra, ""] : []),
    "Not checked here (no balance to run out): Google/YouTube, TikTok, Instagram, Cloudflare, fal.ai (no balance reading available), Atlas Cloud (not in use).",
    "Days left are at the rate of the last days; 'estimate' means from our own cost records until enough balance readings exist.",
    "Instant alerts come only when real users are failing or a balance runs out within 3 days; your own tests never count.",
  ].join("\n");
  return { subject, text };
}

// Instant alerts (grouped per subject by adminAlert.ts). → [{ subject, text }]
export function instantAlerts(results) {
  return results.filter((r) => r.judged.red.length).map((r) => ({
    subject: `Zyvo ALERT: ${r.service.name} — ${r.judged.red[0]}`,
    text: [`${r.service.name} (${r.service.does}) needs you now:`, ...r.judged.red.map((x) => `- ${x}`), "", `What to do: ${r.judged.todo}`, "", serviceLine(r.service, r.state, r.judged)].join("\n"),
  }));
}

// Is it 9:00 in Helsinki (the first tick from 9:00 on), and which Helsinki date is it?
export function helsinkiClock(nowIso) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Helsinki", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false }).formatToParts(new Date(nowIso)).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) % 24 };
}
