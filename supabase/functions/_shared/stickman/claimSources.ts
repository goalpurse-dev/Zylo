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

// The unique real URLs behind a script's claims (verdict URLs first, then fact sources), at most `max`.
export function claimSourceList(doc: any, research: any, max = 8): { url: string; title: string | null }[] {
  const index = sourceIndex(research);
  const verdicts = new Map((doc?.claimVerification ?? []).map((v: any) => [v.claimId, v]));
  const out: { url: string; title: string | null }[] = [];
  const add = (s: any) => { if (s?.url && /^https?:\/\//.test(s.url) && !out.some((x) => x.url === s.url)) out.push({ url: s.url, title: s.title ?? null }); };
  for (const c of doc?.claims ?? []) {
    const v: any = verdicts.get(c.id) ?? {};
    for (const s of v.sources ?? []) add(s);
    if (v.url) add({ url: v.url, title: v.sourceName && !/research-lite/.test(v.sourceName) ? v.sourceName : null });
    for (const s of factSources(c.sourceFactId, research, index)) add(s);
  }
  return out.slice(0, max);
}
