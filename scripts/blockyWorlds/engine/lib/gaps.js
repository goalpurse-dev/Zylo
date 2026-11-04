// Blocky Worlds: the CAPABILITY GAP LOG (owner: DIRECTOR, 2026-11-05). The engine finds its own missing systems: every
// request the matcher (lib/director/match.js) could not meet is logged with the capability id, the item, the line, the
// story / run and a timestamp. The ranked list (most-requested first, with example lines) says what to build next.
//   makeGapLog({ store }) -> { record(gaps, { runId, storyId, source, title }), list(), rank(opts) }
//   stores: memoryStore(), jsonlStore(file) (Node: out/gaps/gaps.jsonl), supabaseStore({ url, serviceKey })
//     (table blocky_worlds_capability_gaps + view blocky_worlds_capability_gap_rank:
//      supabase/migrations/20261204100000_blocky_worlds_capability_gaps.sql, NOT applied)
//   rankGaps(rows, { by: "capability" | "detail" | "item" }) -> [{ key, capability, requests, stories, details, items, examples, lastAt }]
// Never throws into a run: directStory catches; the stores themselves only throw on a broken file / HTTP error.

/** gap -> a row (the table's columns) */
export function gapRows(gaps, { runId = null, storyId = null, source = null, title = null, at = null } = {}) {
  const ts = at ?? new Date().toISOString();
  return (gaps ?? []).map((g) => ({
    capability: String(g.capability), detail: String(g.detail ?? "").slice(0, 120), item: String(g.item ?? "").slice(0, 60), item_kind: String(g.itemKind ?? "").slice(0, 20),
    name: String(g.name ?? "").slice(0, 80), line: Number.isInteger(g.line) ? g.line : null, line_text: String(g.lineText ?? "").slice(0, 300),
    story_id: storyId == null ? null : String(storyId).slice(0, 120), run_id: runId ?? null, source: source ?? null, title: title == null ? null : String(title).slice(0, 120), created_at: ts,
  }));
}

export function memoryStore(seed = []) {
  const rows = [...seed];
  return { async append(r) { rows.push(...r); }, async all() { return [...rows]; } };
}

/** Node: one JSON object a line, appended (the local store; dev/gapReport.mjs reads it) */
export function jsonlStore(file) {
  return {
    file,
    async append(rows) {
      if (!rows.length) return;
      const fs = await import("node:fs"), path = await import("node:path");
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.appendFileSync(file, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
    },
    async all() {
      const fs = await import("node:fs");
      if (!fs.existsSync(file)) return [];
      return fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    },
  };
}

/** Supabase REST (server side, service role; the worker has no key: it sends its gaps in its "planned" event) */
export function supabaseStore({ url, serviceKey, fetchFn = fetch, table = "blocky_worlds_capability_gaps", view = "blocky_worlds_capability_gap_rank" }) {
  const h = { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, "content-type": "application/json" };
  return {
    async append(rows) {
      if (!rows.length) return;
      const res = await fetchFn(`${url}/rest/v1/${table}`, { method: "POST", headers: { ...h, prefer: "return=minimal" }, body: JSON.stringify(rows.map(({ created_at, ...r }) => r)) });
      if (!res.ok) throw new Error(`gap insert ${res.status}`);
    },
    async all({ limit = 5000 } = {}) {
      const res = await fetchFn(`${url}/rest/v1/${table}?select=*&order=created_at.desc&limit=${limit}`, { headers: h });
      if (!res.ok) throw new Error(`gap read ${res.status}`);
      return res.json();
    },
    async ranked({ limit = 50 } = {}) {
      const res = await fetchFn(`${url}/rest/v1/${view}?select=*&limit=${limit}`, { headers: h });
      if (!res.ok) throw new Error(`gap rank read ${res.status}`);
      return res.json();
    },
  };
}

/** most-requested first: distinct stories, then requests; with the top details / items and up to 3 example lines */
export function rankGaps(rows, { by = "capability", examples = 3 } = {}) {
  const groups = new Map();
  for (const r of rows ?? []) {
    const key = by === "detail" ? `${r.capability} ${r.detail}` : by === "item" ? `${r.capability} ${r.name}` : r.capability;
    if (!groups.has(key)) groups.set(key, { key, capability: r.capability, requests: 0, storySet: new Set(), details: new Map(), items: new Map(), examples: [], lastAt: null });
    const g = groups.get(key);
    g.requests++; g.storySet.add(r.story_id ?? r.run_id ?? `row${g.requests}`);
    g.details.set(r.detail, (g.details.get(r.detail) ?? 0) + 1);
    g.items.set(r.name, (g.items.get(r.name) ?? 0) + 1);
    if (r.line_text && g.examples.length < examples && !g.examples.some((e) => e.text === r.line_text)) g.examples.push({ text: r.line_text, story: r.title ?? r.story_id ?? null, item: r.name });
    if (!g.lastAt || (r.created_at ?? "") > g.lastAt) g.lastAt = r.created_at ?? null;
  }
  const top = (m, n = 5) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ key: k, n: v }));
  return [...groups.values()].map((g) => ({ key: g.key, capability: g.capability, requests: g.requests, stories: g.storySet.size, details: top(g.details), items: top(g.items), examples: g.examples, lastAt: g.lastAt }))
    .sort((a, b) => b.stories - a.stories || b.requests - a.requests || (a.key < b.key ? -1 : 1));
}

export function makeGapLog({ store = memoryStore() } = {}) {
  return {
    store,
    async record(gaps, meta = {}) { const rows = gapRows(gaps, meta); await store.append(rows); return rows.length; },
    list: () => store.all(),
    async rank(opts = {}) { return rankGaps(await store.all(), opts); },
  };
}

/** the ranked list as plain text (dev/gapReport.mjs, dev/stress.mjs) */
export function formatRanked(ranked, { top = 25, totalStories = null } = {}) {
  const out = [];
  ranked.slice(0, top).forEach((g, i) => {
    const share = totalStories ? ` (${Math.round((g.stories / totalStories) * 100)}% of stories)` : "";
    out.push(`${String(i + 1).padStart(2)}. ${g.key.padEnd(34)} ${String(g.stories).padStart(4)} stories${share}, ${g.requests} requests`);
    out.push(`      asks: ${g.details.map((d) => `${d.key} x${d.n}`).join(", ")}`);
    out.push(`      items: ${g.items.map((d) => `${d.key} x${d.n}`).join(", ")}`);
    for (const e of g.examples) out.push(`      e.g. "${e.text}"${e.story ? ` (${e.story})` : ""}`);
  });
  return out.join("\n");
}
