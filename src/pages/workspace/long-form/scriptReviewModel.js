// Phase 6a — pure helpers for the Script review page (plain-Node testable).

// Readable sections for users — never internal ids or roles. The writer's
// chapter "title" is sometimes a slug ("hook_spear_in_dirt") and its ids
// don't match the plan's, so: the plan chapter's real title when the plan
// has a chapter in the same position with the same role, else the slug
// humanized; the opening beats (cold open / stakes / core question) are one
// "Opening" section instead of three 5-second ones.
const OPENING_ROLES = new Set(["cold_open", "hook", "stakes", "core_question", "promise"]);
const humanize = (s) => { const t = String(s ?? "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim(); return t ? t.charAt(0).toUpperCase() + t.slice(1) : ""; };
const isSlug = (s) => /^[a-z0-9]+(?:[_-][a-z0-9]+)+$/.test(String(s ?? "").trim());
// Any title a user sees: slugs ("persistence_hunting") become words ("Persistence hunting").
export const displayTitle = (s) => (isSlug(s) ? humanize(s) : String(s ?? "").trim());
export function readableSections(docChapters, planChapters = []) {
  const out = [];
  docChapters.forEach((c, i) => {
    const segmentIds = c.segmentIds ?? [];
    if (OPENING_ROLES.has(c.role) && out.length && out[out.length - 1].opening) { out[out.length - 1].segmentIds.push(...segmentIds); return; }
    if (OPENING_ROLES.has(c.role)) { out.push({ title: "Opening", segmentIds: [...segmentIds], opening: true }); return; }
    const plan = planChapters[i];
    const title = displayTitle(plan && plan.role === c.role && plan.title ? plan.title : c.title || c.chapterId);
    out.push({ title, segmentIds: [...segmentIds], opening: false });
  });
  return out.map(({ title, segmentIds }) => ({ title, segmentIds }));
}

// Seconds per section at the voice pace, rounded so the parts sum EXACTLY to
// the rounded total (largest-remainder) — the m:ss shown never disagree.
export function sectionSeconds(wordCounts, wpm) {
  const raw = wordCounts.map((w) => (w / wpm) * 60);
  const total = Math.round(raw.reduce((a, b) => a + b, 0));
  const floors = raw.map(Math.floor);
  let rest = total - floors.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) { if (rest <= 0) break; floors[i] += 1; rest -= 1; }
  return { parts: floors, total };
}
