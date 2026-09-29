// deno-lint-ignore-file no-explicit-any
// stickman/claimSources.ts — the REAL URLs behind a script's claims (Phase 6f).
// A claim backed by a research fact -> the fact's sourceIds -> the research
// sources (URLs live-checked when research ran). A claim checked by the
// fact-check's web search -> the URL the search cited, kept only if a live
// fetch confirms it. Nothing is ever invented: no URL = no source.

// Every research source object ({ id: "src_…", url, title }) anywhere in the research row.
export function sourceIndex(research: any): Map<string, { url: string; title: string | null }> {
  const out = new Map<string, { url: string; title: string | null }>();
  const walk = (n: any, d = 0) => {
    if (!n || d > 6 || typeof n !== "object") return;
    if (!Array.isArray(n) && typeof n.id === "string" && typeof n.url === "string" && /^https?:\/\//.test(n.url)) out.set(n.id, { url: n.url, title: n.title ?? n.sourceName ?? n.publisher ?? null });
    for (const v of Array.isArray(n) ? n : Object.values(n)) walk(v, d + 1);
  };
  walk(research);
  return out;
}

export function factSources(factId: string | null | undefined, research: any, index = sourceIndex(research)) {
  if (!factId) return [];
  const fact = (research?.fact_graph?.facts ?? []).find((f: any) => f.id === factId);
  return (fact?.sourceIds ?? []).map((id: string) => index.get(id)).filter(Boolean) as { url: string; title: string | null }[];
}

// A URL is kept only if it answers (HEAD, then GET) with a non-error status.
export async function isLiveUrl(url: string, timeoutMs = 6000): Promise<boolean> {
  if (!/^https?:\/\/[^\s]+\.[^\s]+/.test(String(url ?? ""))) return false;
  for (const method of ["HEAD", "GET"]) {
    try {
      const r = await fetch(url, { method, redirect: "follow", signal: AbortSignal.timeout(timeoutMs), headers: { "User-Agent": "Mozilla/5.0 (compatible; ZyvoSourceCheck/1.0)" } });
      await r.body?.cancel();
      if (r.status < 400) return true;
      if (method === "GET" || ![403, 405].includes(r.status)) return r.status < 400;
    } catch { /* try GET, then give up */ }
  }
  return false;
}

// Source quality by host. WEAK (never listed): document mirrors / uploads,
// user-generated Q&A and content farms. STRONG (listed first): journals and
// publishers, .edu / .gov / .ac.*, museums, official research-project pages.
// Everything else is neutral. A claim whose only URL is weak keeps the claim
// (the fact-check verdict stands) — just no link.
const WEAK_HOSTS = /(^|\.)(fliphtml5\.com|scribd\.com|slideshare\.net|issuu\.com|pdfdrive\.com|dokumen\.pub|docplayer\.\w+|studocu\.com|coursehero\.com|quizlet\.com|academia\.edu|yumpu\.com|pdfcoffee\.com|epdf\.pub|vdoc\.pub|dokumen\.tips|kupdf\.net|documents\.pub|answers\.com|quora\.com|reddit\.com|pinterest\.\w+|ehow\.com|wikihow\.com|reference\.com|thoughtco\.com|ranker\.com|listverse\.com|allthatsinteresting\.com|factslegend\.org|brainly\.\w+|chegg\.com|bartleby\.com|ipl\.org|ukessays\.com|gradesaver\.com|enotes\.com|blogspot\.com|wordpress\.com|medium\.com|substack\.com|tumblr\.com|fandom\.com)$/i;
const STRONG_HOSTS = /(^|\.)(nature\.com|science\.org|pnas\.org|cell\.com|sciencedirect\.com|springer\.com|link\.springer\.com|wiley\.com|onlinelibrary\.wiley\.com|tandfonline\.com|sagepub\.com|cambridge\.org|oup\.com|academic\.oup\.com|jstor\.org|plos\.org|journals\.plos\.org|frontiersin\.org|mdpi\.com|royalsocietypublishing\.org|biorxiv\.org|arxiv\.org|nih\.gov|ncbi\.nlm\.nih\.gov|pmc\.ncbi\.nlm\.nih\.gov|pubmed\.ncbi\.nlm\.nih\.gov|doi\.org|britishmuseum\.org|si\.edu|smithsonianmag\.com|metmuseum\.org|nhm\.ac\.uk|amnh\.org|nps\.gov|unesco\.org|europeana\.eu|natmus\.dk|historiska\.se|khm\.uio\.no)$/i;
export function sourceTier(url: string): 0 | 1 | 2 {
  let host = "";
  try { host = new URL(url).hostname.toLowerCase().replace(/^www\./, ""); } catch { return 0; }
  if (WEAK_HOSTS.test(host)) return 0;
  if (STRONG_HOSTS.test(host) || /\.(edu|gov|mil)$/.test(host) || /\.(ac|edu|gov)\.[a-z]{2}$/.test(host) || /(^|\.)(museum|museet|museo|musee)/.test(host)) return 2;
  return 1;
}
export const isWeakSource = (url: string) => sourceTier(url) === 0;

// The unique real URLs behind a script's claims (verdict URLs first, then fact
// sources), weak hosts dropped, strong ones first, at most `max`.
export function claimSourceList(doc: any, research: any, max = 8): { url: string; title: string | null }[] {
  const index = sourceIndex(research);
  const verdicts = new Map((doc?.claimVerification ?? []).map((v: any) => [v.claimId, v]));
  const out: { url: string; title: string | null; tier: number }[] = [];
  const add = (s: any) => { if (s?.url && /^https?:\/\//.test(s.url) && !out.some((x) => x.url === s.url)) { const tier = sourceTier(s.url); if (tier > 0) out.push({ url: s.url, title: s.title ?? null, tier }); } };
  for (const c of doc?.claims ?? []) {
    const v: any = verdicts.get(c.id) ?? {};
    for (const s of v.sources ?? []) add(s);
    if (v.url) add({ url: v.url, title: v.sourceName && !/research-lite/.test(v.sourceName) ? v.sourceName : null });
    for (const s of factSources(c.sourceFactId, research, index)) add(s);
  }
  return out.map((s, i) => ({ ...s, i })).sort((a, b) => b.tier - a.tier || a.i - b.i).slice(0, max).map(({ url, title }) => ({ url, title }));
}
