// In This Town's LIVE FEED in the chat (owner 2026-11-27; the contract is docs/in-this-town-live-feed.md, written with
// the engine). It rides on the status call the chat already makes every 8 s: `live` is there only for the owner's
// Three.js runs, so everything here is optional and the chat falls back to the step line + percent.
//   - the current step in plain words
//   - a grid that fills in one still at a time, with "17 of 38 shots"
//   - a repaired shot REPLACES its old still (same shot number, a higher version), never the other way round
//   - then the finished video (the existing finalUrl)

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
  };
}

export const stepWords = (stage) => TOWN_STEPS.find((s) => s.id === stage)?.words ?? "Making your video";

/** the step line for any run (with or without a feed): { words, detail } */
export function stepLine(status, feed) {
  if (feed) return { words: feed.words, detail: feed.detail };
  const stage = status?.progress?.stage ?? status?.stage ?? STAGE_OF[status?.status] ?? null;
  return { words: stepWords(stage), detail: String(status?.progress?.detail ?? "") };
}
