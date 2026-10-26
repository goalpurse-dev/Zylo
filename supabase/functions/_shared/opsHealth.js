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
  { id: "openai", name: "OpenAI", does: "writing and checks (Long Form scripts, picture checks, Fruit, Blocky)", kind: "balance", checked: true,
    fix: "Add credit at platform.openai.com (Billing).", autoTopUp: "Yes: auto recharge (threshold + amount + optional monthly limit) in Billing." },
  { id: "anthropic", name: "Anthropic (Claude)", does: "writing (Long Form research and scripts, Fruit, Blocky, Content Machine)", kind: "balance", checked: true,
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

// One service's state → { ok, red, lines }. s: what the function measured:
//   { reachable, error, balance, unit, perDay, perDaySource, failingUsers, failures, note, resetsInDays }
export function judge(service, s) {
  const red = [];
  if (s.reachable === false) red.push(`not reachable: ${s.error ?? "no answer"}`);
  const left = daysLeft(s.balance, s.perDay);
  // A monthly quota that resets before it runs out is fine.
  const runsOutFirst = left != null && (s.resetsInDays == null || left < s.resetsInDays);
  if (runsOutFirst && left < ALERT_DAYS) red.push(`runs out in about ${left < 1 ? "less than a day" : `${left.toFixed(1)} days`}`);
  if (Number(s.balance) <= 0 && s.balance != null && service.kind === "balance") red.push("balance is empty");
  if ((s.failingUsers ?? 0) >= 1 && (s.failures ?? 0) >= 3) red.push(`${s.failures} failures for ${s.failingUsers} real user${s.failingUsers === 1 ? "" : "s"} in the last hour`);
  if (service.ownerOnly) return { ok: red.length === 0, red: [], info: red, left }; // owner-only (Cutaway): shown, never red
  return { ok: red.length === 0, red, info: [], left };
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
  const why = j.red.length ? `\n   Problem: ${j.red.join("; ")}\n   What to do: ${service.fix}` : j.info.length ? `\n   (owner tests only, not live: ${j.info.join("; ")})` : "";
  return `${head}\n${body}${why}`;
}

// The daily email. results: [{ service, state, judged }]
export function dailyReport(results, nowIso) {
  const red = results.filter((r) => r.judged.red.length);
  const day = new Date(nowIso).toLocaleDateString("en-GB", { timeZone: "Europe/Helsinki", weekday: "long", day: "numeric", month: "long" });
  const subject = red.length ? `Zyvo health: ${red.length} RED (${red.map((r) => r.service.name).join(", ")})` : "Zyvo health: all green";
  const text = [
    `Good morning. Zyvo's outside services, ${day}:`,
    "",
    ...(red.length ? ["NEEDS YOU:", ...red.map((r) => `- ${r.service.name}: ${r.judged.red.join("; ")}. ${r.service.fix}`), ""] : ["Nothing needs you today.", ""]),
    ...results.map((r) => serviceLine(r.service, r.state, r.judged)),
    "",
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
    text: [`${r.service.name} (${r.service.does}) needs you now:`, ...r.judged.red.map((x) => `- ${x}`), "", `What to do: ${r.service.fix}`, "", serviceLine(r.service, r.state, r.judged)].join("\n"),
  }));
}

// Is it 9:00 in Helsinki (the first tick from 9:00 on), and which Helsinki date is it?
export function helsinkiClock(nowIso) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Helsinki", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false }).formatToParts(new Date(nowIso)).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) % 24 };
}
