// Content Machine: wall-clock time in the owner's timezone (Europe/Helsinki) ↔ UTC. The owner types and reads
// every time (posted at, stats taken at) in Helsinki time; the database keeps UTC. Handles summer time.

/** The timezone's offset from UTC at that instant, in ms (Helsinki: +2 h in winter, +3 h in summer). */
export function tzOffsetMs(date, timeZone) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .formatToParts(date).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm" in the timezone → a Date (UTC instant), or null if malformed. */
export function localToUtc(local, timeZone) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?$/.exec(String(local ?? "").trim());
  if (!m) return null;
  const guess = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0));
  let t = guess - tzOffsetMs(new Date(guess), timeZone);
  t = guess - tzOffsetMs(new Date(t), timeZone);   // once more, for times next to a summer-time switch
  return new Date(t);
}

/** A UTC instant → "YYYY-MM-DDTHH:mm" in the timezone (the value a datetime-local input takes). */
export function utcToLocal(iso, timeZone) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() + tzOffsetMs(d, timeZone)).toISOString().slice(0, 16);
}
