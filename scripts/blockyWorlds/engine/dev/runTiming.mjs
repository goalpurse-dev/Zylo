// Blocky Worlds: where the time and the money of real production runs went (docs/blocky-worlds-pipeline.md).
// Reads blocky_worlds_runs / _jobs / _cost_ledger / _capability_gaps and the run's visual-check.json + production.json
// with the service key from C:\Users\Public\Zylo\.env.local (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY; never printed).
// Read-only, free: no paid call, no write.
//   node scripts/blockyWorlds/engine/dev/runTiming.mjs                  the latest 2 runs
//   node scripts/blockyWorlds/engine/dev/runTiming.mjs latest 5
//   node scripts/blockyWorlds/engine/dev/runTiming.mjs <run id> [<run id> ...]
//   ... --json                                                          the numbers as JSON instead
// Per run: Generate pressed -> prepare (dispatched / started / finished; inside it: voice, director, builder, plan +
// checks, music, mix) -> planned -> render (first chunk start -> last chunk done; per-chunk min/max) -> finish -> total;
// the cost per ledger line and the total; the builder's picture-card fallbacks; the capability gaps.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { paths, BUCKET } from "../../../../supabase/functions/_shared/blockyWorlds/render.js";

const ENV_FILE = "C:/Users/Public/Zylo/.env.local";
const env = Object.fromEntries(fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/).map((l) => l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]));
const URL_ = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || "").replace(/\/$/, ""), KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) { console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing in .env.local"); process.exit(1); }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function rest(q, { optional = false } = {}) {
  const r = await fetch(`${URL_}/rest/v1/${q}`, { headers: H });
  if (!r.ok) { if (optional) return null; throw new Error(`${q.split("?")[0]}: ${r.status} ${(await r.text()).slice(0, 200)}`); }
  return r.json();
}
async function file(p) {
  try { const r = await fetch(`${URL_}/storage/v1/object/${BUCKET}/${p}`, { headers: H }); return r.ok ? JSON.parse(await r.text()) : null; } catch { return null; }
}

const ms = (t) => (t ? Date.parse(t) : null);
const s1 = (x) => (x == null || !Number.isFinite(x) ? "  -  " : `${x.toFixed(1)} s`);
const at = (t, t0) => (t == null ? "    -   " : `+${((t - t0) / 1000).toFixed(1).padStart(6)} s`);
const usd = (x) => `$${Number(x || 0).toFixed(4)}`;
const range = (l) => (l.length ? `${Math.min(...l).toFixed(1)}-${Math.max(...l).toFixed(1)} s` : "-");

export function summarize(run, jobs, ledger, { check = null, production = null, gaps = null } = {}) {
  const t0 = ms(run.created_at), end = ms(run.finished_at);
  const by = (role) => jobs.filter((j) => j.role === role).sort((a, b) => a.idx - b.idx || a.attempt - b.attempt);
  const span = (j) => ({ attempt: j.attempt, state: j.state, code: j.error_code ?? null, dispatched: ms(j.dispatched_at ?? j.created_at), started: ms(j.started_at), finished: ms(j.finished_at),
    queueS: j.started_at && j.dispatched_at ? (ms(j.started_at) - ms(j.dispatched_at)) / 1000 : null, runS: j.started_at && j.finished_at ? (ms(j.finished_at) - ms(j.started_at)) / 1000 : null });
  const prep = by("prepare"), last = prep.at(-1), out = last?.output ?? {};
  const planned = out.planned ?? {};
  const inside = { ...(planned.timing ?? {}), ...(out.timing ?? {}) };
  const prepare = {
    tries: prep.map(span),
    inside: { voiceS: inside.voice ?? null, directorS: inside.director ?? (planned.director?.ms != null ? planned.director.ms / 1000 : null), builderS: planned.builder?.ms != null ? planned.builder.ms / 1000 : null, buildPassS: inside.build ?? null, planS: inside.plan ?? null, musicS: inside.music ?? null, mixS: inside.mix ?? null, totalS: out.totalS ?? null },
    director: planned.director ?? null, builder: planned.builder ?? null,
  };
  // the chunks: per index the done try (else the last); the render = first chunk start -> last chunk done
  const chunkJobs = by("chunk"), idxs = [...new Set(chunkJobs.map((j) => j.idx))];
  const chunks = idxs.map((i) => { const l = chunkJobs.filter((j) => j.idx === i); const j = l.find((x) => x.state === "done") ?? l.at(-1); return { idx: i, tries: l.length, ...span(j), out: j.output ?? null }; });
  const starts = chunks.map((c) => c.started ?? c.dispatched).filter(Boolean), dones = chunks.map((c) => c.finished).filter(Boolean);
  const render = chunks.length ? {
    chunks: chunks.length, retries: chunkJobs.length - chunks.length,
    firstDispatched: Math.min(...chunks.map((c) => c.dispatched).filter(Boolean)), firstStart: starts.length ? Math.min(...starts) : null, lastDone: dones.length ? Math.max(...dones) : null,
    runS: chunks.map((c) => c.runS).filter((x) => x != null), queueS: chunks.map((c) => c.queueS).filter((x) => x != null),
    gpuRenderS: chunks.map((c) => c.out?.timing?.render).filter((x) => x != null), loadS: chunks.map((c) => c.out?.loadS).filter((x) => x != null), msPerFrame: chunks.map((c) => c.out?.msPerFrame).filter((x) => x != null),
  } : null;
  if (render) render.wallS = render.firstStart && render.lastDone ? (render.lastDone - render.firstStart) / 1000 : null;
  const fin = by("finish");
  const costs = {};
  for (const l of ledger) { const k = l.stage; costs[k] ??= { rows: 0, usd: 0 }; costs[k].rows++; costs[k].usd += Number(l.usd) || 0; }
  const totalUsd = Object.values(costs).reduce((a, c) => a + c.usd, 0);
  const b = check?.builder ?? null;
  const cards = (b?.report?.byNeed ?? []).filter((n) => n.source === "card").map((n) => ({ name: n.name, kind: n.kind, reason: n.reason }));
  const built = (b?.report?.byNeed ?? []).filter((n) => n.source === "built").map((n) => ({ name: n.name, kind: n.kind, costUsd: n.costUsd, ms: n.ms, attempts: n.attempts }));
  const reused = (b?.report?.byNeed ?? []).filter((n) => n.source === "cache").map((n) => n.name);
  const gapList = gaps ?? (production?.gaps ?? []).map((g) => ({ capability: g.capability, detail: g.detail, name: g.name, line: g.line }));
  return {
    id: run.id, title: run.title, status: run.status, error: run.error_code ?? null, lengthSec: run.length_sec, t0, end,
    totalS: end ? (end - t0) / 1000 : null, plannedAt: ms(run.planned_at), production: run.render?.production ?? null,
    prepare, render, finish: fin.map(span), costs, totalUsd, runCostUsd: Number(run.cost_usd) || 0,
    builder: { built, cards, reused, applied: b?.applied?.length ?? null, cardShots: b?.cards?.length ?? null },
    gaps: gapList,
  };
}

export function print(x) {
  const t0 = x.t0, L = (s) => console.log(s);
  L(`\n=== ${x.id}  "${x.title ?? ""}"  ${x.status}${x.error ? ` (${x.error})` : ""}  ${x.lengthSec ?? "?"} s video  ${new Date(t0).toISOString()}`);
  if (x.production) L(`    settings: director ${x.production.director}, builder ${x.production.builder} (cap $${x.production.builderMaxUsd})`);
  L(`  Generate pressed                 ${at(t0, t0)}`);
  for (const p of x.prepare.tries) L(`  prepare try ${p.attempt}  dispatched ${at(p.dispatched, t0)}  started ${at(p.started, t0)}  finished ${at(p.finished, t0)}   queue ${s1(p.queueS)}, ran ${s1(p.runS)}  ${p.state}${p.code ? ` ${p.code}` : ""}`);
  const i = x.prepare.inside;
  L(`     inside: voice ${s1(i.voiceS)} | director ${s1(i.directorS)} (parallel with the voice) | builder ${s1(i.builderS)} (from the job's start; final pass ${s1(i.buildPassS)}) | plan+checks ${s1(i.planS)} | music ${s1(i.musicS)} | mix ${s1(i.mixS)} | job ${s1(i.totalS)}`);
  if (x.prepare.director) L(`     director: ${x.prepare.director.provider}${x.prepare.director.model ? ` ${x.prepare.director.model}` : ""}${x.prepare.director.fellBack ? " (FELL BACK to the mock)" : ""}, ${usd(x.prepare.director.costUsd)}`);
  if (x.prepare.builder) L(`     builder: ${x.prepare.builder.built ?? 0} built, ${x.prepare.builder.cards ?? 0} card shot(s), ${usd(x.prepare.builder.costUsd)} by "planned"`);
  L(`  planned (frames split)           ${at(x.plannedAt, t0)}`);
  if (x.render) {
    const r = x.render;
    L(`  render: ${r.chunks} chunks${r.retries ? ` (+${r.retries} retries)` : ""}  first sent ${at(r.firstDispatched, t0)}  first start ${at(r.firstStart, t0)}  last done ${at(r.lastDone, t0)}   wall ${s1(r.wallS)}`);
    L(`     per chunk: ran ${range(r.runS)}, queue ${range(r.queueS)}, GPU render ${range(r.gpuRenderS)}, page load ${range(r.loadS)}, ${r.msPerFrame.length ? `${Math.min(...r.msPerFrame).toFixed(0)}-${Math.max(...r.msPerFrame).toFixed(0)} ms a frame` : "-"}`);
  } else L("  render: no chunks");
  for (const f of x.finish) L(`  finish try ${f.attempt}   dispatched ${at(f.dispatched, t0)}  started ${at(f.started, t0)}  finished ${at(f.finished, t0)}   queue ${s1(f.queueS)}, ran ${s1(f.runS)}  ${f.state}${f.code ? ` ${f.code}` : ""}`);
  L(`  TOTAL Generate -> ${x.status}: ${s1(x.totalS)}`);
  L("  cost:");
  for (const [k, c] of Object.entries(x.costs).sort((a, b) => b[1].usd - a[1].usd)) L(`     ${k.padEnd(14)} ${usd(c.usd)}  (${c.rows} row${c.rows === 1 ? "" : "s"})`);
  L(`     ${"TOTAL".padEnd(14)} ${usd(x.totalUsd)}  (run.cost_usd ${usd(x.runCostUsd)})`);
  const b = x.builder;
  if (b.built.length) L(`  built now: ${b.built.map((n) => `${n.name} (${n.kind}, ${usd(n.costUsd)}, ${s1(n.ms / 1000)}, ${n.attempts} tries)`).join("; ")}`);
  if (b.reused.length) L(`  from the library: ${b.reused.join(", ")}`);
  L(`  picture-card fallbacks: ${b.cards.length ? b.cards.map((c) => `${c.name} (${c.kind}: ${c.reason ?? "?"})`).join("; ") : "none"}${b.cardShots != null ? `  [${b.cardShots} card shot(s) in the timeline]` : ""}`);
  if (x.gaps.length) {
    const top = {};
    for (const g of x.gaps) { const k = `${g.capability}${g.detail ? ` ${g.detail}` : ""}`; top[k] = (top[k] ?? 0) + 1; }
    L(`  gaps (${x.gaps.length}): ${Object.entries(top).sort((a, c) => c[1] - a[1]).slice(0, 10).map(([k, n]) => `${k} x${n}`).join(", ")}`);
  } else L("  gaps: none logged");
}

async function main() {
  const args = process.argv.slice(2), json = args.includes("--json");
  const rest_ = args.filter((a) => a !== "--json");
  let runs;
  const ids = rest_.filter((a) => /^[0-9a-f-]{36}$/i.test(a));
  if (ids.length) runs = await rest(`blocky_worlds_runs?select=*&id=in.(${ids.join(",")})&order=created_at.asc`);
  else {
    const n = Math.max(1, Math.min(20, Number(rest_[rest_.indexOf("latest") + 1] ?? rest_.find((a) => /^\d+$/.test(a))) || 2));
    runs = (await rest(`blocky_worlds_runs?select=*&order=created_at.desc&limit=${n}`)).reverse();
  }
  if (!runs.length) { console.log("no runs"); return; }
  const all = [];
  for (const run of runs) {
    const [jobs, ledger, gaps] = await Promise.all([
      rest(`blocky_worlds_jobs?select=*&run_id=eq.${run.id}&order=created_at.asc`),
      rest(`blocky_worlds_cost_ledger?select=stage,provider,model,usd,units,ref,created_at&run_id=eq.${run.id}&order=created_at.asc`),
      rest(`blocky_worlds_capability_gaps?select=capability,detail,name,line&run_id=eq.${run.id}&limit=500`, { optional: true }),
    ]);
    const P = paths(run);
    const [check, production] = await Promise.all([file(P.visualCheck), file(P.production)]);
    const x = summarize(run, jobs, ledger, { check, production, gaps: gaps?.length ? gaps : null });
    all.push(x);
    if (!json) print(x);
  }
  if (json) console.log(JSON.stringify(all, null, 1));
  else if (all.length > 1) console.log(`\n${all.length} runs: ${usd(all.reduce((a, x) => a + x.totalUsd, 0))} in all; ${all.map((x) => s1(x.totalS)).join(" / ")}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch((e) => { console.error(String(e?.message ?? e).replace(KEY, "<key>")); process.exit(1); });
