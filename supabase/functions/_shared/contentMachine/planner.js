// Content Machine: the experiment planner. Every slideshow is a labelled experiment; its recipe says what
// is being tried (format, hook type, visual style, Zyvo placement, CTA, platform, posting time, text
// density). In the experiment phase each day spreads across as many DIFFERENT formats, styles and hooks as
// possible, and no format + style pair repeats until most pairs have been tried. Pure: no database, no
// clock, no randomness except the seeded one, so a day's plan can be reproduced in a test.

export const ZYVO_POSITIONS = ["early", "middle", "late", "cta_only"];
export const CTA_TYPES = ["link_in_bio", "comment_keyword", "soft_mention", "question"];
export const PLATFORMS = ["tiktok", "instagram", "youtube"];
export const TEXT_DENSITY = ["low", "medium", "high"];
// Helsinki local times to try per platform (the owner posts by hand; the time is part of the experiment).
export const POST_TIMES = { tiktok: ["12:00", "17:00", "19:30", "21:00"], instagram: ["08:00", "12:30", "18:00", "20:30"], youtube: ["11:00", "15:00", "18:00", "20:00"] };

/** A small seeded PRNG (mulberry32) from a string such as the run id. */
export function rng(seed) {
  let h = 1779033703 ^ String(seed).length;
  for (const c of String(seed)) { h = Math.imul(h ^ c.charCodeAt(0), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const countBy = (rows, key) => rows.reduce((m, r) => (r?.[key] ? m.set(r[key], (m.get(r[key]) ?? 0) + 1) : m), new Map());

/** Least-used first; ties broken by the seeded random order. Values used today go to the back. */
function leastUsed(values, history, key, usedToday, random) {
  const counts = countBy(history, key);
  const order = new Map(values.map((v) => [v, random()]));
  return [...values].sort((a, b) =>
    (usedToday.has(a) ? 1 : 0) - (usedToday.has(b) ? 1 : 0)
    || (counts.get(a) ?? 0) - (counts.get(b) ?? 0)
    || order.get(a) - order.get(b));
}

/** Days since the experiment phase started (null: not started yet, i.e. still experimenting). */
export function inExperimentPhase({ startedOn, today, days }) {
  if (!startedOn) return true;
  const elapsed = Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${startedOn}T00:00:00Z`)) / 86_400_000);
  return elapsed < days;
}

/**
 * library: { formats: [{key, spec}], styles: [{key}], hooks: [{key}] } (active only)
 * history: recipes of earlier REAL slideshows (dry runs excluded), oldest first
 * winners: proven recipes from Phase 3's playbook (empty during the experiment phase)
 * Returns `count` recipes; each has a `mode` of "experiment" or "winner".
 */
export function planRecipes({ library, history = [], count, seed, topic = null, experimentPhase = true, winners = [], winnersPerDay = 3 }) {
  const random = rng(seed);
  const formats = library.formats.map((f) => f.key);
  const styles = library.styles.map((s) => s.key);
  const hooks = library.hooks.map((h) => h.key);
  if (!formats.length || !styles.length || !hooks.length) throw new Error("The library needs at least one active format, style and hook type.");

  const recipes = [];
  const today = { format: new Set(), style: new Set(), hook_type: new Set(), zyvo_position: new Set(), cta_type: new Set(), platform: new Set(), text_density: new Set(), pair: new Set() };
  const pairCounts = new Map();
  for (const h of history) if (h?.format && h?.style) pairCounts.set(`${h.format}|${h.style}`, (pairCounts.get(`${h.format}|${h.style}`) ?? 0) + 1);
  const all = [...history];
  const mark = (r) => { for (const k of Object.keys(today)) if (k !== "pair") today[k].add(r[k]); today.pair.add(`${r.format}|${r.style}`); all.push(r); };

  // Winners (after the experiment phase): a varied copy of a proven recipe, never the same pair twice a day.
  const winnerSlots = experimentPhase ? 0 : Math.min(winnersPerDay, winners.length, count);
  for (const w of winners.slice(0, winnerSlots)) {
    const r = finish({ ...w, mode: "winner" }, all, today, random, topic);
    mark(r);
    recipes.push(r);
  }

  while (recipes.length < count) {
    // The format + style pair tried least so far; then formats and styles not used today; then random.
    const order = new Map();
    const pairs = [];
    for (const f of formats) for (const s of styles) { pairs.push([f, s]); order.set(`${f}|${s}`, random()); }
    pairs.sort(([fa, sa], [fb, sb]) => {
      const ka = `${fa}|${sa}`, kb = `${fb}|${sb}`;
      return (today.pair.has(ka) ? 1 : 0) - (today.pair.has(kb) ? 1 : 0)
        || (pairCounts.get(ka) ?? 0) - (pairCounts.get(kb) ?? 0)
        || (today.format.has(fa) ? 1 : 0) - (today.format.has(fb) ? 1 : 0)
        || (today.style.has(sa) ? 1 : 0) - (today.style.has(sb) ? 1 : 0)
        || order.get(ka) - order.get(kb);
    });
    const [format, style] = pairs[0];
    pairCounts.set(`${format}|${style}`, (pairCounts.get(`${format}|${style}`) ?? 0) + 1);
    const r = finish({ format, style, mode: "experiment" }, all, today, random, topic, hooks);
    mark(r);
    recipes.push(r);
  }

  const spec = Object.fromEntries(library.formats.map((f) => [f.key, f.spec ?? {}]));
  return recipes.map((r) => ({ ...r, slide_count: r.slide_count ?? slideCount(spec[r.format], random) }));
}

function finish(base, all, today, random, topic, hooks = null) {
  const pick = (values, key) => base[key] ?? leastUsed(values, all, key, today[key], random)[0];
  const platform = pick(PLATFORMS, "platform");
  return {
    format: base.format,
    style: base.style,
    hook_type: hooks ? pick(hooks, "hook_type") : base.hook_type,
    zyvo_position: pick(ZYVO_POSITIONS, "zyvo_position"),
    cta_type: pick(CTA_TYPES, "cta_type"),
    platform,
    post_time: base.post_time ?? leastUsed(POST_TIMES[platform], all.filter((r) => r.platform === platform), "post_time", new Set(), random)[0],
    text_density: pick(TEXT_DENSITY, "text_density"),
    topic: topic ?? base.topic ?? null,
    slide_count: base.slide_count ?? null,
    mode: base.mode,
  };
}

function slideCount(spec, random) {
  const [lo, hi] = Array.isArray(spec?.slides) ? spec.slides : [5, 7];
  return lo + Math.floor(random() * (hi - lo + 1));
}

/** How much of the format × style grid has been tried at least once (shown in admin). */
export function coverage(library, history) {
  const tried = new Set(history.filter((h) => h?.format && h?.style).map((h) => `${h.format}|${h.style}`));
  const total = library.formats.length * library.styles.length;
  let hit = 0;
  for (const f of library.formats) for (const s of library.styles) if (tried.has(`${f.key}|${s.key}`)) hit += 1;
  return { tried: hit, total, share: total ? hit / total : 0 };
}
