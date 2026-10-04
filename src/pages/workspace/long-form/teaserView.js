// teaserView.js — the free Long Form teaser's pure helpers (no network), shared
// by the Create page and the teaser page. Server calls: teaserApi.js.

// The teaser starts by itself in exactly ONE case: right after a visitor signs
// up in the box that Generate opened. The flag for that is
//   - armed only when the sign-up really goes through (not when the box opens),
//   - kept in this tab only (sessionStorage: a new tab never sees it),
//   - removed the moment the Create page reads it, whatever happens next,
//   - honoured only for an account that was created in the last few minutes.
// In every other case nothing starts until "Generate video" is pressed.
export const TEASER_AUTOSTART_KEY = "zyvo:long-form:teaser-autostart:v2";
// v1 lived in localStorage for an hour, was set when the box opened and worked
// for any sign-in: it started teasers on a plain page load. Removed on sight.
export const TEASER_AUTOSTART_LEGACY_KEY = "zyvo:long-form:teaser-autostart";
export const TEASER_AUTOSTART_MAX_AGE_MS = 10 * 60 * 1000;
export const NEW_ACCOUNT_MAX_AGE_MS = 10 * 60 * 1000;

const tabStore = () => { try { return window.sessionStorage; } catch { return null; } };
export function armTeaserAutostart(store = tabStore(), now = Date.now()) {
  try { store?.setItem(TEASER_AUTOSTART_KEY, String(now)); } catch { /* no storage: they press Generate after signing up */ }
}
export function disarmTeaserAutostart(store = tabStore()) {
  try { store?.removeItem(TEASER_AUTOSTART_KEY); } catch { /* ignore */ }
}
// Reads the flag once: it is gone before the answer is used.
export function takeTeaserAutostart(store = tabStore(), now = Date.now()) {
  let at = 0;
  try { at = Number(store?.getItem(TEASER_AUTOSTART_KEY)) || 0; store?.removeItem(TEASER_AUTOSTART_KEY); } catch { return false; }
  return at > 0 && now >= at && now - at <= TEASER_AUTOSTART_MAX_AGE_MS;
}
// The whole rule in one place (pure): armed, signed in, free, a brand-new account, the setup filled in.
export function shouldAutostartTeaser({ armed, signedIn, isPaid, accountCreatedAt, setupFilled, now = Date.now() }) {
  if (!armed || !signedIn || isPaid || !setupFilled) return false;
  const created = Date.parse(accountCreatedAt ?? "");
  return Number.isFinite(created) && now - created <= NEW_ACCOUNT_MAX_AGE_MS;
}

// The loading screen's steps, from the teaser's real state (never a fake timer).
export function teaserSteps(teaser) {
  const total = teaser?.sceneCount ?? 3;
  const scenes = teaser?.scenes ?? [];
  const written = teaser && teaser.status !== "writing";
  const steps = [{ key: "title", label: written ? "Title and hook written" : "Writing your title…", state: written ? "done" : "active" }];
  for (let i = 0; i < total; i++) {
    const s = scenes[i];
    const done = s?.status === "ready", failed = s?.status === "failed" || s?.status === "skipped";
    const active = written && !done && !failed && scenes.slice(0, i).every((p) => ["ready", "failed", "skipped"].includes(p.status)) && teaser.status === "drawing";
    steps.push({ key: `scene-${i + 1}`, label: done ? `Scene ${i + 1} drawn` : failed ? `Scene ${i + 1} skipped` : `Drawing scene ${i + 1} of ${total}${active ? "…" : ""}`, state: done ? "done" : failed ? "skipped" : active ? "active" : "waiting" });
  }
  return steps;
}
export const teaserBusy = (teaser) => !teaser || teaser.status === "writing" || teaser.status === "drawing";
// What the full video would be, from the length picked on the Create page (~15 scenes a minute).
export function fullVideoFacts(teaser) {
  const minutes = Math.min(15, Math.max(8, Math.round(Number(teaser?.setup?.lengthMinutes) || 10)));
  return { minutes, scenes: Math.round((minutes * 15) / 10) * 10 };
}
