// publishText.js — Phase 6f. The YouTube text rules, shared by the Publish
// page and the long-form-youtube-text function (plain JS, no deps).
export const TITLE_MAX = 60, TAGS_MAX_CHARS = 500, SOURCES_MAX = 8;
export const CHAPTER_MIN_MS = 10000, CHAPTERS_MIN = 3;
export const CREDIT_LINE = "🎬 Made with tryzyvo.com — turn any idea into a video like this";
export const HASHTAGS_MIN = 3, HASHTAGS_MAX = 5, HASHTAGS_YOUTUBE_LIMIT = 15;
// Niche-aware disclaimers (Description V2): the model writes one; these are the fallbacks.
export const DISCLAIMERS = {
  history: "This video summarizes published research for general educational purposes. Some details rely on inference from limited evidence and remain debated among researchers.",
  health: "This video is for general educational purposes only and is not medical advice. Talk to a qualified professional about your own situation.",
  money: "This video is for general educational purposes only and is not financial advice.",
};
export const disclaimerFor = (text) => /\b(health|medic|disease|diet|sleep|drug|doctor|symptom|body|brain|mental)\w*/i.test(text) ? DISCLAIMERS.health : /\b(money|invest|stock|crypto|financ|wealth|debt|tax|income|budget)\w*/i.test(text) ? DISCLAIMERS.money : DISCLAIMERS.history;
// 3-5 hashtags (YouTube ignores all of them past 15), #CamelCase, deduped.
export function cleanHashtags(tags) {
  const out = [];
  for (const raw of tags ?? []) {
    const t = `#${String(raw ?? "").replace(/^#+/, "").replace(/[^\p{L}\p{N}]+/gu, "")}`;
    if (t.length < 3 || out.some((x) => x.toLowerCase() === t.toLowerCase())) continue;
    out.push(t);
  }
  return out.slice(0, HASHTAGS_MAX);
}

export const fmtChapter = (ms) => { const s = Math.floor(ms / 1000); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60; return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`; };

// Chapters from the rendered edit: the first clip of each section. YouTube
// rules: the first at 0:00, at least 3, each at least 10 s (a too-short one
// merges into the one before). Fewer than 3 = no chapters at all.
export function buildChapters(clips, sectionOfBeat, titleOfSection, durationMs) {
  const starts = [];
  let last = null;
  for (const c of [...clips].sort((a, b) => a.startMs - b.startMs)) {
    const sec = sectionOfBeat[c.beatSequence] ?? null;
    if (sec && sec !== last) { starts.push({ ms: starts.length ? c.startMs : 0, section: sec, title: titleOfSection[sec] ?? sec }); last = sec; }
  }
  const out = [];
  for (const ch of starts) {
    const prev = out[out.length - 1];
    // The chapter before would be under 10 s: it gives way to this one (the 0:00 chapter always stays).
    if (prev && ch.ms - prev.ms < CHAPTER_MIN_MS) { if (out.length === 1) continue; out.pop(); }
    out.push({ ms: ch.ms, title: String(ch.title).trim() });
  }
  while (out.length > 1 && durationMs - out[out.length - 1].ms < CHAPTER_MIN_MS) out.pop(); // the last one too
  if (out.length) out[0].ms = 0;
  return out.length >= CHAPTERS_MIN ? out : [];
}

// ONE title (never "A | B"), <= 60 chars, cut at a word.
export const cleanTitle = (t) => {
  let s = String(t ?? "").replace(/\s+/g, " ").trim().split(/\s*[|•]\s*/)[0].trim();
  if (s.length > TITLE_MAX) s = s.slice(0, TITLE_MAX + 1).replace(/\s+\S*$/, "").replace(/[\s,:;–—-]+$/, "").slice(0, TITLE_MAX);
  return s;
};
// Lecture-style titles read like a syllabus, not a video people click.
export const LECTURE_TITLE = /\b(explained|an overview|introduction to|a history of|what you need to know)\b|\b(myth|evidence|caveat|fact)s?,\s/i;
// Chapter names are 2-5 word hooks; never structural labels.
export const BORING_CHAPTER = /^(final image|intro(duction)?|outro|conclusion|cold open|summary|recap|chapter \d+|section \d+|the end)$/i;
export function chapterHook(title, fallback) {
  const t = String(title ?? "").replace(/[.]+$/, "").replace(/\s+/g, " ").trim();
  const n = t.split(" ").filter(Boolean).length;
  if (t && n >= 2 && n <= 5 && !BORING_CHAPTER.test(t)) return titleCase(t);
  const f = String(fallback ?? "").replace(/\s+/g, " ").trim().split(" ").slice(0, 5).join(" ");
  return BORING_CHAPTER.test(f) || f.split(" ").length < 2 ? "What It Means" : titleCase(f);
}
// A hook starts with the story, not "Find out whether…".
export const LAME_HOOK = /^(find out|learn|discover|in this video|this video|today we|we explore|let's)\b/i;
export function limitTags(tags) {
  const out = [];
  let n = 0;
  for (const raw of tags ?? []) {
    const t = String(raw ?? "").replace(/[<>,]/g, "").replace(/\s+/g, " ").trim();
    if (!t || out.some((x) => x.toLowerCase() === t.toLowerCase())) continue;
    const add = t.length + (out.length ? 1 : 0);
    if (n + add > TAGS_MAX_CHARS) break;
    out.push(t); n += add;
  }
  return out;
}
// Title Case for chapter names: small words stay lower case unless first/last ("Night by the Fire").
const SMALL_WORDS = new Set("a an and as at but by for from in into nor of off on onto or out over per the to up via vs with".split(" "));
export function titleCase(s) {
  const ws = String(s ?? "").replace(/\s+/g, " ").trim().split(" ");
  return ws.map((w, i) => {
    const bare = w.toLowerCase().replace(/[^a-z']/g, "");
    if (i > 0 && i < ws.length - 1 && SMALL_WORDS.has(bare)) return w.toLowerCase();
    if (/[A-Z].*[A-Z]/.test(w.slice(1)) || /\d/.test(w)) return w; // acronyms, "DNA", "300,000"
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(" ");
}
// The Zyvo line and instructions are added by CODE: any echo of them in the model's text is removed.
export const stripInstructionEchoes = (text) => String(text ?? "").split(/\n/).filter((l) => !/^\s*(end with|made with tryzyvo|🎬|🎨|disclaimer:|hashtags?:|return:|note:)/i.test(l) && !/tryzyvo\.com/i.test(l)).join("\n").replace(/\n{3,}/g, "\n\n").trim();
// Tags only for names/terms the video actually has: every significant word must appear in the narration or the verified facts.
const TAG_STOP = new Set("a an and are as at be by for from in into is it its of on or the to with how why what who when where did does do was were history facts science documentary explained".split(" "));
const tagStem = (w) => w.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/(ies)$/, "y").replace(/(es|s|ed|ing)$/, "");
// Names (capitalised words in a tag, e.g. "Ian Hodder") must appear as such; ordinary
// terms may be another form of a word the video uses ("archaeology" ~ "archaeologists",
// a shared 6-letter start).
export function tagsInVideo(tags, corpus) {
  const words = String(corpus ?? "").split(/[^A-Za-z0-9À-ÿ]+/).filter(Boolean);
  const have = new Set(words.map(tagStem));
  const prefixes = new Set(words.filter((w) => w.length >= 6).map((w) => w.slice(0, 6).toLowerCase()));
  return (tags ?? []).filter((t) => {
    const raw = String(t ?? "");
    const hashtag = raw.startsWith("#");
    const ws = raw.replace(/^#/, "").replace(/([a-z])([A-Z])/g, "$1 $2").split(/[\s\-_/]+/).filter((w) => w.length >= 3 && !TAG_STOP.has(w.toLowerCase()));
    return ws.length > 0 && ws.every((w) => {
      if (have.has(tagStem(w))) return true;
      const isName = !hashtag && /^[A-ZÀ-Ý]/.test(w);
      return !isName && w.length >= 6 && prefixes.has(w.slice(0, 6).toLowerCase());
    });
  });
}
export const realSources = (sources) => {
  const seen = new Set();
  return (sources ?? []).filter((s) => /^https?:\/\/[^\s]+\.[^\s]+/.test(String(s?.url ?? "")) && !seen.has(s.url) && seen.add(s.url)).slice(0, SOURCES_MAX);
};

// The description (V2), top to bottom: the intro (hook paragraph, "We look at…"
// paragraph, thesis line — stored together as `hook`), chapters, sources (omitted
// when none), the disclaimer, the Zyvo line (toggle), 3-5 hashtags at the very end.
export function composeDescription(meta) {
  const parts = [stripInstructionEchoes(meta.hook)];
  if (meta.includeChapters !== false && meta.chapters?.length) parts.push(meta.chapters.map((c) => `${fmtChapter(c.ms)} ${c.title}`).join("\n"));
  const src = meta.includeSources === false ? [] : realSources(meta.sources);
  if (src.length) parts.push(["Sources:", ...src.map((s) => `• ${s.title ? `${s.title} — ` : ""}${s.url}`)].join("\n"));
  if (meta.disclaimer) parts.push(String(meta.disclaimer).trim());
  if (meta.includeCredit !== false) parts.push(CREDIT_LINE);
  const tags = cleanHashtags(meta.hashtags);
  if (tags.length) parts.push(tags.join(" "));
  return parts.filter(Boolean).join("\n\n");
}
// Download file names: a short slug from the title (<= 40 chars, cut at a word),
// e.g. "how-did-ancient-humans-actually-hunt-1080p.mp4", "...-thumbnail.png".
export function fileSlug(title, max = 40) {
  const s = String(title ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (s.length <= max) return s || "zyvo-video";
  const cut = s.slice(0, max + 1);
  return (cut.lastIndexOf("-") > 10 ? cut.slice(0, cut.lastIndexOf("-")) : s.slice(0, max)).replace(/-+$/, "") || "zyvo-video";
}
