// In This Town's LIVE FEED in the chat (owner 2026-11-27; the contract is docs/in-this-town-live-feed.md, written with
// the engine). It rides on the status call the chat already makes every 8 s: `live` is there only for the owner's
// Three.js runs, so everything here is optional and the chat falls back to the step line + percent.
//   - the current step in plain words
//   - a grid that fills in one still at a time, with "17 of 38 shots"
//   - a repaired shot REPLACES its old still (same shot number, a higher version), never the other way round
//   - then the finished video (the existing finalUrl)

/**
 * about how long an In This Town video takes, in minutes (owner 2026-11-27: "about 10 minutes" on the making card).
 * From the owner's first chat run: 60 s finished in 8.4 min (planning ~3 min + ~5.5 min per minute of video).
 */
export const townMinutes = (seconds) => Math.max(5, Math.round(3 + (5.5 * (Number(seconds) || 60)) / 60));

/** keep a still's signed link while it is fresh (the server re-signs every answer; reloading 38 images every 8 s is waste) */
export const THUMB_KEEP_MS = 40 * 60 * 1000;

/** the steps the feed names, in order, with the words the chat shows when the engine sends none */
export const TOWN_STEPS = Object.freeze([
  { id: "voice", words: "Recording the voice" },
  { id: "directing", words: "Planning every shot" },
  { id: "previews", words: "Test-shooting every shot" },
  { id: "checking", words: "Checking every shot" },
  { id: "fixing", words: "Fixing weak shots" },
  { id: "rendering", words: "Making the final video" },
  { id: "finishing", words: "Finishing" },
  { id: "done", words: "Done" },
]);
const STAGE_OF = { queued: "voice", voice: "voice", plan: "directing", render: "rendering", done: "done" };

/**
 * merges one status answer's `live` into what the chat shows. prev = the last merged feed (or null), now = Date.now().
 * Returns null while there is no feed (a customer run, the old engine, or the planner hasn't started).
 */
export function mergeLive(prev, live, now = Date.now()) {
  if (!live || live.v !== 1 || !Array.isArray(live.shots)) return prev ?? null;
  const old = new Map((prev?.shots ?? []).map((s) => [s.n, s]));
  const shots = [];
  for (const s of live.shots) {
    const n = Number(s?.n);
    if (!Number.isInteger(n) || n < 1) continue;
    const o = old.get(n);
    const v = Math.max(0, Number(s.v) || 0);
    // an answer that is older than what is on screen never brings an old still back
    if (o && o.v > v) { shots.push(o); continue; }
    const sameStill = Boolean(o && o.v === v && o.thumbUrl);
    const keepLink = sameStill && now - o.linkAt < THUMB_KEEP_MS;
    shots.push({
      n, line: Number(s.line) || null, text: String(s.text ?? "").slice(0, 140),
      state: ["pending", "pass", "fail", "repaired", "safe"].includes(s.state) ? s.state : "pending",
      v, why: s.why ? String(s.why) : null,
      thumbUrl: keepLink ? o.thumbUrl : (s.thumbUrl ?? null),
      linkAt: keepLink ? o.linkAt : now,
      // a repair that arrived in THIS answer: the tile shows it with a short flash
      replacedAt: o && v > o.v && o.v > 0 ? now : (o?.replacedAt ?? null),
    });
  }
  shots.sort((a, b) => a.n - b.n);
  const total = Number(live.count?.total) || shots.length;
  const done = Number(live.count?.done) || shots.filter((s) => s.v > 0).length;
  return {
    stage: String(live.step?.stage ?? "directing"),
    words: String(live.step?.words ?? "") || stepWords(live.step?.stage),
    detail: String(live.step?.detail ?? "") || (total ? `${done} of ${total} shots` : ""),
    count: { done, total, pass: Number(live.count?.pass) || 0, fail: Number(live.count?.fail) || 0 },
    shots, videoReady: live.video?.ready === true, updatedAt: live.updatedAt ?? null,
    review: reviewOf(live.review),
  };
}

/**
 * THE REVIEW PAUSE (owner 2026-11-27; the proposed contract in docs/in-this-town-live-feed.md "review"): after the test
 * shots the run waits for the owner: Continue, or a change to one shot; with no answer it carries on by itself at
 * `until` (60 s). Absent = no pause (the chat shows nothing extra).
 *   live.review = { open: boolean, until: ISO, seconds: 60, notes: [{ n, note, state: "queued" | "done" | "skipped" }] }
 */
export function reviewOf(r) {
  if (!r || typeof r !== "object") return null;
  const until = Date.parse(r.until);
  return {
    open: r.open === true, until: Number.isFinite(until) ? until : null, seconds: Number(r.seconds) || 60,
    notes: Array.isArray(r.notes) ? r.notes.filter((x) => Number.isInteger(Number(x?.n))).map((x) => ({ n: Number(x.n), note: String(x.note ?? "").slice(0, 300), state: String(x.state ?? "queued") })) : [],
  };
}
/** seconds left in the pause (0 when it is over or has no end) */
export const reviewLeft = (review, now = Date.now()) => (review?.open && review.until ? Math.max(0, Math.ceil((review.until - now) / 1000)) : 0);
export const REVIEW_NOTE_MAX = 300;

export const stepWords = (stage) => TOWN_STEPS.find((s) => s.id === stage)?.words ?? "Making your video";

/** the step line for any run (with or without a feed): { words, detail } */
export function stepLine(status, feed) {
  if (feed) return { words: feed.words, detail: feed.detail };
  const stage = status?.progress?.stage ?? status?.stage ?? STAGE_OF[status?.status] ?? null;
  return { words: stepWords(stage), detail: String(status?.progress?.detail ?? "") };
}
