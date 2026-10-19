// Content Machine: what fits on a slide, as ONE table (owner, 2026-10-19). The writer is told these limits up front,
// the program checks them, and a deterministic shortener applies them (no model call). Every limit is proven by the
// maximum-length grid (scripts/contentMachine/renderZyvoMaxGrid.mjs): text at the limit, with every picture, fits
// the TikTok safe zone with the footer, no overlaps, no highlight touching another line. A rule the layout can't
// satisfy is caught here, when the format is designed, never at render time.
//
// Per Zyvo slide kind: headline / body / callout / prompt = max characters (0 = not used); items / right =
// [min, max] lines with itemChars / rightChars characters each; assets = [min, max] real outputs.
export const ZYVO_SLOTS = Object.freeze({
  feature_hero: { headline: 52, body: 90, callout: 52, assets: [2, 3] },
  style_grid: { headline: 40, body: 80, assets: [4, 6] },
  template_showcase: { headline: 48, body: 80, assets: [2, 6] },
  spotlight: { headline: 48, body: 110, callout: 52, items: [0, 3], itemChars: 32, assets: [1, 3] },
  ui_prompt: { headline: 36, body: 80, prompt: 72, assets: [0, 0] },
  ui_checklist: { headline: 36, items: [3, 5], itemChars: 32, assets: [0, 0] },
  ui_result: { headline: 36, body: 100, assets: [1, 1] },
  prompt_result: { headline: 40, prompt: 72, assets: [1, 1] },
  // "By hand vs with Zyvo": 3 short lines a side (about 4 words each) and ONE smaller real output. The first
  // version allowed 5 + 5 and an image: that never fit, and the shorter rewrite dropped the image instead.
  by_hand: { headline: 40, items: [2, 3], itemChars: 26, right: [2, 3], rightChars: 26, assets: [1, 1] },
  cta_button: { headline: 44, body: 28, assets: [0, 3] },
});

const plain = (s) => String(s ?? "").replace(/\*/g, "");
const len = (s) => plain(s).length;

/** The limits as the writer reads them (in its system prompt). */
export function slotLimitsText() {
  const line = ([kind, L]) => {
    const parts = [];
    if (L.headline) parts.push(`headline ≤ ${L.headline}`);
    parts.push(L.body ? `body ≤ ${L.body}` : "body null");
    if (L.callout) parts.push(`callout ≤ ${L.callout}`);
    if (L.prompt) parts.push(`prompt ≤ ${L.prompt}`);
    if (L.items) parts.push(L.items[1] ? `items ${L.items[0]}–${L.items[1]} × ≤ ${L.itemChars}` : "items []");
    if (L.right) parts.push(`items_right ${L.right[0]}–${L.right[1]} × ≤ ${L.rightChars}`);
    parts.push(L.assets[1] ? `real outputs ${L.assets[0] === L.assets[1] ? `exactly ${L.assets[0]}` : `${L.assets[0]}–${L.assets[1]}`}` : "no pictures (the UI is the visual)");
    return `- ${kind}: ${parts.join(", ")}`;
  };
  return `SLOT LIMITS (hard; characters, not counting *asterisks*; the slide is drawn at exactly these sizes, so longer text is cut):\n${Object.entries(ZYVO_SLOTS).map(line).join("\n")}`;
}

/** Problems against the table (empty = fits). */
export function slotProblems(slide, at) {
  const L = ZYVO_SLOTS[slide.kind];
  if (!L) return [];
  const p = [];
  for (const k of ["headline", "body", "callout", "prompt"]) {
    const v = slide[k];
    if (L[k] && len(v) > L[k]) p.push(`${at}: ${k} ${len(v)} characters (max ${L[k]})`);
    else if (!L[k] && k !== "headline" && String(v ?? "").trim()) p.push(`${at}: ${slide.kind} has no ${k} (leave it null)`);
  }
  const lists = [["items", L.items ?? [0, 0], L.itemChars], ["items_right", L.right ?? [0, 0], L.rightChars]];
  for (const [k, [lo, hi], chars] of lists) {
    const rows = (slide[k] ?? []).filter((x) => String(x).trim());
    if (rows.length < lo || rows.length > hi) p.push(`${at}: ${k} ${rows.length} lines (${lo}–${hi})`);
    rows.forEach((r, n) => { if (chars && len(r) > chars) p.push(`${at}: ${k} line ${n + 1} is ${len(r)} characters (max ${chars})`); });
  }
  const assets = (slide.assets ?? []).filter((a) => a?.asset_id).length;
  if (assets < L.assets[0] || assets > L.assets[1]) p.push(`${at}: ${slide.kind} needs ${L.assets[0] === L.assets[1] ? L.assets[0] : `${L.assets[0]}–${L.assets[1]}`} real output${L.assets[1] === 1 ? "" : "s"} (has ${assets})`);
  return p;
}

/** Cut text to max characters at a word boundary; a *highlight* left open is closed or dropped. */
export function trimText(s, max) {
  if (s == null) return s;
  const text = String(s);
  if (len(text) <= max) return text;
  let out = "", visible = 0;
  for (const word of text.split(/(\s+)/)) {
    const w = plain(word).length;
    if (visible + w > max - 1) break;
    out += word; visible += w;
  }
  out = out.replace(/[\s,;:–-]+$/, "");
  if ((out.match(/\*/g) ?? []).length % 2) out = out.replace(/\*(?=[^*]*$)/, "");
  return `${out}…`;
}

/**
 * Makes a slideshow fit the table without any model call (owner, 2026-10-19). level 0: to the limits; level 1
 * (after a layout failure): one list line fewer (never under the minimum), text at 80 %, one picture fewer
 * where the kind allows. Returns { slideshow, changes } (changes: what was cut, for the owner).
 */
export function fitSlideshow(slideshow, level = 0) {
  const changes = [];
  const scale = level ? 0.8 : 1;
  const slides = (slideshow?.slides ?? []).map((slide, i) => {
    const L = ZYVO_SLOTS[slide.kind];
    if (!L) return slide;
    const s = { ...slide };
    const at = `slide ${i + 1}`;
    for (const k of ["headline", "body", "callout", "prompt"]) {
      if (!L[k] || s[k] == null) continue;
      if (k === "prompt" && s.kind === "prompt_result") continue;   // a recorded prompt is never changed
      const max = k === "headline" ? L[k] : Math.floor(L[k] * scale);
      const t = trimText(s[k], max);
      if (t !== s[k]) { changes.push(`${at}: ${k} shortened`); s[k] = t; }
    }
    if (!L.body && s.body && s.kind !== "cta_button") { s.body = null; changes.push(`${at}: body removed`); }
    const fitList = (k, [lo, hi], chars) => {
      let rows = (s[k] ?? []).filter((x) => String(x).trim());
      const cap = level ? Math.max(lo, hi - 1) : hi;
      if (rows.length > cap) { rows = rows.slice(0, cap); changes.push(`${at}: ${k} cut to ${cap}`); }
      if (chars) rows = rows.map((r) => { const t = trimText(r, Math.floor(chars * (level ? 0.9 : 1))); if (t !== r) changes.push(`${at}: a ${k} line shortened`); return t; });
      s[k] = rows;
    };
    if (L.items) fitList("items", L.items, L.itemChars); else if ((s.items ?? []).length) { s.items = []; changes.push(`${at}: items removed`); }
    if (L.right) fitList("items_right", L.right, L.rightChars); else if ((s.items_right ?? []).length) { s.items_right = []; }
    const maxAssets = level ? Math.max(L.assets[0], L.assets[1] - 1) : L.assets[1];
    if ((s.assets ?? []).length > maxAssets) { s.assets = s.assets.slice(0, maxAssets); changes.push(`${at}: pictures cut to ${maxAssets}`); }
    return s;
  });
  return { slideshow: { ...slideshow, slides }, changes: [...new Set(changes)] };
}

/**
 * The creator account's deterministic shortening after a layout failure (no model call): one list line fewer
 * (never under 2), body and tool text at 75 %, versus sides at 80 %. Headlines stay (they carry the hook).
 */
export function shortenCreator(slideshow) {
  const changes = [];
  const slides = (slideshow?.slides ?? []).map((slide, i) => {
    const s = { ...slide };
    const at = `slide ${i + 1}`;
    if (s.body && len(s.body) > 60) { s.body = trimText(s.body, Math.floor(len(s.body) * 0.75)); changes.push(`${at}: body shortened`); }
    if ((s.items ?? []).length > 2 && s.kind !== "versus" && s.kind !== "quiz_question") { s.items = s.items.slice(0, s.items.length - 1); changes.push(`${at}: one list line fewer`); }
    if (s.kind === "versus" && (s.items ?? []).length) s.items = s.items.map((t) => (len(t) > 50 ? trimText(t, Math.floor(len(t) * 0.8)) : t));
    if (s.tool?.what_it_does && len(s.tool.what_it_does) > 60) { s.tool = { ...s.tool, what_it_does: trimText(s.tool.what_it_does, Math.floor(len(s.tool.what_it_does) * 0.75)) }; changes.push(`${at}: tool text shortened`); }
    return s;
  });
  return { slideshow: { ...slideshow, slides }, changes: [...new Set(changes)] };
}
