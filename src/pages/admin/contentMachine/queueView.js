// Content Machine: what the Queue shows (owner, 2026-10-23). Every slideshow not posted yet, from ANY day, newest
// first, grouped under day headers ("Today", "Yesterday", "Oct 21"). Nothing is hidden by date: only Rejected and
// Outdated are left out of the default view, and both have their own filter (and are always in the All tab).
// Pure functions, so tests can check them without a browser.

// [key, label, test]. "" is the default view.
export const QUEUE_FILTERS = [
  ["", "All", (i) => i.status !== "rejected" && !i.outdated],
  ["ready", "Ready", (i) => i.status === "done" && !i.compliance?.flagged && !i.outdated],
  ["approved", "Approved", (i) => i.status === "approved" && !i.outdated],
  ["flagged", "Flagged", (i) => Boolean(i.compliance?.flagged) && !["rejected", "posted"].includes(i.status)],
  ["rejected", "Rejected", (i) => i.status === "rejected"],
  ["outdated", "Outdated", (i) => Boolean(i.outdated) && i.status !== "rejected"],
];

/** The Queue's list for one filter, and the count of every filter (all days, posted never included). */
export function queueView(ideas, filter = "") {
  const unposted = (ideas ?? []).filter((i) => i.status !== "posted");
  const counts = Object.fromEntries(QUEUE_FILTERS.map(([k, , f]) => [k, unposted.filter(f).length]));
  const test = (QUEUE_FILTERS.find(([k]) => k === filter) ?? QUEUE_FILTERS[0])[2];
  return { shown: unposted.filter(test), counts, total: unposted.length };
}

/** The calendar day (YYYY-MM-DD) of a time in the owner's time zone. */
export function dayKey(iso, timeZone = "Europe/Helsinki") {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

/** "Today", "Yesterday", "Oct 21" (and the year when it isn't this year). */
export function dayLabel(key, now = new Date(), timeZone = "Europe/Helsinki") {
  const today = dayKey(now, timeZone);
  if (key === today) return "Today";
  if (key === dayKey(new Date(now.getTime() - 86_400_000), timeZone)) return "Yesterday";
  const d = new Date(`${key}T12:00:00Z`);
  const sameYear = key.slice(0, 4) === today.slice(0, 4);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }), timeZone: "UTC" });
}

/** [{ key, label, ideas }] newest day first; the ideas keep their order (newest first). */
export function groupByDay(ideas, now = new Date(), timeZone = "Europe/Helsinki") {
  const groups = [];
  for (const i of ideas) {
    const key = dayKey(i.created_at ?? now, timeZone);
    let g = groups.find((x) => x.key === key);
    if (!g) { g = { key, label: dayLabel(key, now, timeZone), ideas: [] }; groups.push(g); }
    g.ideas.push(i);
  }
  return groups.sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0));
}
