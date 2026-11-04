// The ranked list of missing capabilities (the engine's own to-do list), from a gap log.
//   node dev/gapReport.mjs                                  out/stress/gaps.jsonl (the free stress run)
//   node dev/gapReport.mjs --file out/stress/real-script-haiku/gaps.jsonl
//   node dev/gapReport.mjs --by detail|item --top 40        group by capability + what exactly / by item name
//   node dev/gapReport.mjs --supabase                       the live table's ranked view (needs SUPABASE_URL +
//                                                           SUPABASE_SERVICE_ROLE_KEY; the migration must be applied)
import path from "node:path";
import { fileURLToPath } from "node:url";
import { jsonlStore, supabaseStore, rankGaps, formatRanked } from "../lib/gaps.js";
import { registryTable } from "../lib/capabilities.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const a = process.argv.slice(2);
const opt = (k, d) => { const i = a.indexOf(`--${k}`); return i >= 0 ? a[i + 1] : d; };
const by = opt("by", "capability"), top = Number(opt("top", 25));

if (a.includes("--supabase")) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error("needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"); process.exit(2); }
  const rows = await supabaseStore({ url, serviceKey: key }).ranked({ limit: top });
  for (const [i, r] of rows.entries()) console.log(`${String(i + 1).padStart(2)}. ${`${r.capability} ${r.detail}`.padEnd(40)} ${String(r.stories).padStart(4)} stories, ${r.requests} requests [${r.source}]  items: ${(r.top_items ?? []).join(", ")}\n      ${(r.examples ?? []).map((e) => `"${e}"`).join("\n      ")}`);
} else {
  const file = path.resolve(ROOT, opt("file", "out/stress/gaps.jsonl"));
  const rows = await jsonlStore(file).all();
  if (!rows.length) { console.log(`no gaps in ${file} (run node dev/stress.mjs first)`); process.exit(0); }
  const stories = new Set(rows.map((r) => r.story_id)).size;
  const ranked = rankGaps(rows, { by });
  const status = Object.fromEntries(registryTable().map((r) => [r.id, r.status]));
  console.log(`${rows.length} gaps from ${stories} stories (${file})\n`);
  console.log(formatRanked(ranked.map((g) => ({ ...g, key: `${g.key} [${status[g.capability] ?? "?"}]` })), { top, totalStories: stories }));
}
