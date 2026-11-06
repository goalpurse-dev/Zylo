// Blocky Worlds shot review (owner, 2026-11-06: "make the honest frame review part of the pipeline"). Before any chunk
// renders, the prepare job renders a still of every shot (lib/vision/stills.mjs: the real engine page, no captions,
// 432 x 768), an AI vision judge compares the frames of each narration line with what the STORY says it must show
// (lib/vision/requirements.js: who, the things, the action, the place, the time, the feeling) and every line that is
// not a match is re-planned in the planner's vocabulary (lib/vision/replan.js), its shots rendered again and judged
// again. What is still missing after the last pass gets the permanent rule's fallback (a picture card of that very
// thing) and is recorded. It never fails a run: any error, the money cap or the time budget ends the review and the
// timeline goes on as it is (the pre-render checks run after it, as always).
//
//   const { tl, report } = await reviewShots({
//     tl, script, premise,                  the planned timeline (changed in place), the script, the user's topic
//     judge,                                anthropicJudge(...) | mockJudge(...) | null (null: the review is off)
//     stills,                               makeShotStills(...) or an async factory () => it (opened only when needed)
//     check,                                (tl) => problems[]: checkTimeline + checkVisuals + checkSubjects (+ checkProduction)
//     rebuild,                              async (tl) => report: the builder over needs a fix added (builder.buildFor)
//     replan,                               async ({ tl, fixes, verdicts, reqs, pass }) => applyFixes' result (default: applyFixes)
//     budget: { maxUsd, until, maxMs, replanRounds, batchSize, maxImages, concurrency, loadMs, stillMs, callMs },
//     outDir, log })
//   report (shot-review.json): { v, model, passes: [...], lines: [{ line, text, verdict, types, missing, fix, history }],
//     fixes, cards, unresolved, counts, costUsd, ms, stopped }
import fs from "node:fs";
import path from "node:path";
import { lineRequirements, stillPicks, subTimeline } from "./requirements.js";
import { batchesOf } from "./judge.js";
import { suggestFixes, applyFixes, settleObjects, finalFallback } from "./replan.js";


export const DEFAULT_REVIEW_BUDGET = Object.freeze({
  maxUsd: 0.1,          // per video (Haiku 5.5: a full pass ~$0.015, worst ~$0.04)
  maxMs: 120000,        // from the start of the review
  until: null,          // epoch ms: a hard end (the prepare job's limit minus the music + mix + uploads after it)
  replanRounds: 2,      // re-plan rounds: pass 1 (all lines) -> fix -> pass 2 (the fixed lines) -> fix -> pass 3
  batchSize: 8, maxImages: 14, concurrency: 4,
  loadMs: 40000,        // the engine page's load (estimates for "does the next pass fit": GPU ~30 s, this laptop 64 s)
  stillMs: 250,         // one still (GPU ~0.1 s, laptop median 0.15 s)
  callMs: 30000,        // one judge request (Haiku, ~12 frames, effort low)
  minPassMs: 20000,     // a pass needs at least this long
});

const withDeadline = (p, deadline, what) => {
  const left = deadline - Date.now();
  if (left <= 0) return Promise.reject(Object.assign(new Error(`time budget reached before ${what}`), { timeout: true }));
  let t;
  return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(Object.assign(new Error(`time budget reached during ${what}`), { timeout: true })), left); })]).finally(() => clearTimeout(t));
};
async function pool(items, n, fn) {
  const out = new Array(items.length); let k = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (k < items.length) { const i = k++; out[i] = await fn(items[i], i); } }));
  return out;
}
/** the same purse as the builder's (resolve.js makePurse): a call starts only when its worst case still fits */
function makePurse(maxUsd) {
  let spent = 0, reserved = 0;
  return { get spent() { return spent; }, reserve(usd) { if (spent + reserved + usd > maxUsd + 1e-9) return false; reserved += usd; return true; }, settle(r, a) { reserved = Math.max(0, reserved - r); spent += Math.max(0, Number(a) || 0); } };
}
const counts = (vs) => vs.reduce((c, v) => { c[v.verdict] = (c[v.verdict] ?? 0) + 1; return c; }, { match: 0, partial: 0, miss: 0, unjudged: 0 });

export async function reviewShots({ tl, script = null, premise = null, judge = null, stills = null, check = null, rebuild = null, replan = null, budget = {}, outDir = null, log = () => {} } = {}) {
  const B = { ...DEFAULT_REVIEW_BUDGET, ...budget };
  const T0 = Date.now(), deadline = Math.min(T0 + B.maxMs, Number(B.until) || Infinity);
  const purse = makePurse(B.maxUsd);
  const report = { v: 1, model: judge?.model ?? null, provider: judge?.name ?? "off", budget: { maxUsd: B.maxUsd, maxMs: B.maxMs, until: B.until ?? null, replanRounds: B.replanRounds }, passes: [], lines: [], fixes: { applied: [], reverted: [], unapplied: [] }, cards: [], unresolved: [], counts: null, first: null, costUsd: 0, ms: 0, stopped: null };
  const finish = (stopped = null) => {
    report.stopped ??= stopped; report.costUsd = Number(purse.spent.toFixed(5)); report.ms = Date.now() - T0;
    report.counts = counts(report.lines.filter((l) => l.verdict));
    if (outDir) { try { fs.mkdirSync(outDir, { recursive: true }); fs.writeFileSync(path.join(outDir, "shot-review.json"), JSON.stringify(report, null, 1)); } catch (e) { log(`shot-review.json: ${e.message}`); } }
    return { tl, report };
  };
  if (!judge) return finish("off (no judge)");
  if (!tl?.shots?.length) return finish("no shots");
  let renderer = null;
  try {
    let reqs = lineRequirements(tl, { script, premise });
    const byLine = new Map();   // line -> the latest verdict
    let todo = new Set(reqs.map((r) => r.line)), onlyShots = null;
    const castIds = Object.keys(tl.cast ?? {});
    const tried = new Set(), fixKey = (f) => `${f.op}|${f.shot}|${f.id ?? f.actor ?? f.name ?? f.kind ?? f.set ?? f.light ?? ""}|${f.pose ?? f.expr ?? f.hold ?? f.action ?? ""}`;
    for (let pass = 1; pass <= 1 + B.replanRounds; pass++) {
      const P = { pass, lines: todo.size, stills: 0, loadMs: 0, stillsMs: 0, judgeMs: 0, calls: 0, costUsd: 0, counts: null, errors: [] };
      report.passes.push(P);
      // 1. the frames: pass 1 the whole timeline, later passes a sub-timeline of the changed shots only
      let picks = stillPicks(tl, { lines: todo, only: onlyShots });
      // a later pass loads only its shots' sets: its load is estimated from pass 1's measured load by its share of the
      // shots (x2, at least 5 s; the laptop: 71 s for 64 shots, 9.7 s for 5)
      const p1 = report.passes[0];
      const loadEst = pass > 1 && p1?.loadMs ? Math.min(B.loadMs || Infinity, Math.max(5000, (2 * p1.loadMs * (onlyShots?.size ?? tl.shots.length)) / tl.shots.length)) : B.loadMs;
      const est = loadEst + picks.length * B.stillMs + Math.ceil(Math.ceil(picks.length / B.maxImages) / B.concurrency) * B.callMs;
      if (deadline - Date.now() < Math.max(B.minPassMs, est)) { P.skipped = `time: ~${Math.round(est / 1000)} s needed, ${Math.max(0, Math.round((deadline - Date.now()) / 1000))} s left`; report.stopped = `pass ${pass}: ${P.skipped}`; break; }
      if (!picks.length) { P.skipped = "nothing to look at"; break; }
      renderer ??= typeof stills === "function" ? await stills() : stills;
      if (!renderer) { report.stopped = "no still renderer"; break; }
      let rtl = tl, times = picks;
      if (onlyShots) { const sub = subTimeline(tl, [...onlyShots]); rtl = sub.tl; times = picks.map((p) => ({ ...p, t: +sub.map(p.shot, p.t).toFixed(3) })); }
      const s0 = Date.now();
      const got = await withDeadline(renderer.renderTimeline(rtl, times.map((p) => ({ key: p.key, t: p.t, shot: p.shot, line: p.line })), { name: `pass${pass}`, onLoad: (ms) => { P.loadMs = ms; } }), deadline, "the stills");
      P.stillsMs = Date.now() - s0 - P.loadMs; P.stills = got.stills.filter((s) => !s.error).length;
      for (const s of got.stills) if (s.error) P.errors.push(`still ${s.key}: ${s.error}`);
      const byKey = new Map(got.stills.filter((s) => !s.error).map((s) => [s.key, s]));
      // 2. the items (a line with no frame is not judged this pass)
      const items = reqs.filter((r) => todo.has(r.line)).map((r) => {
        const st = picks.filter((p) => p.line === r.line).map((p) => byKey.get(p.key)).filter(Boolean).map((s) => ({ key: s.key, shot: picks.find((p) => p.key === s.key).shot, jpeg: s.jpeg, w: s.w, h: s.h, file: s.file }));
        return { ...r, stills: st, castIds, plan: [...new Set(st.map((s) => s.shot))].map((i) => tl.shots[i]).filter(Boolean) };
      }).filter((it) => it.stills.length);
      // 3. the judge, batches in parallel; each request only when its worst case fits under the money cap
      const j0 = Date.now();
      const batches = batchesOf(items, { size: B.batchSize, maxImages: B.maxImages });
      const results = await pool(batches, B.concurrency, async (batch) => {
        const worst = judge.worstCase?.(batch) ?? 0;
        if (!purse.reserve(worst)) return batch.map((it) => ({ line: it.line, verdict: "unjudged", types: [], bad_shots: [], missing: [], fix: "", shows: "", reason: `money cap ($${B.maxUsd})` }));
        try {
          P.calls++;
          const r = await withDeadline(judge.judge(batch), deadline, "the judge");
          purse.settle(worst, r.costUsd); P.costUsd += r.costUsd ?? 0;
          return r.lines;
        } catch (e) {
          purse.settle(worst, e.costUsd ?? 0); P.costUsd += e.costUsd ?? 0;
          P.errors.push(`judge: ${String(e.message).slice(0, 160)}`);
          return batch.map((it) => ({ line: it.line, verdict: "unjudged", types: [], bad_shots: [], missing: [], fix: "", shows: "", reason: String(e.message).slice(0, 120) }));
        }
      });
      P.judgeMs = Date.now() - j0; P.costUsd = Number(P.costUsd.toFixed(5));
      const verdicts = results.flat();
      // a line the judge could not answer keeps its earlier verdict
      for (const v of verdicts) {
        const prev = byLine.get(v.line);
        if (v.verdict === "unjudged" && prev && prev.verdict !== "unjudged") { prev.history.push({ pass, verdict: "unjudged", reason: v.reason }); continue; }
        byLine.set(v.line, { ...v, history: [...(prev?.history ?? []), { pass, verdict: v.verdict, types: v.types, missing: v.missing, shows: v.shows, frames: items.find((it) => it.line === v.line)?.stills.map((s) => path.basename(s.file ?? s.key)) ?? [] }] });
      }
      P.counts = counts(verdicts);
      if (pass === 1) report.first = { ...P.counts, matchPct: Math.round((100 * P.counts.match) / Math.max(1, verdicts.length)) };
      log(`review pass ${pass}: ${verdicts.length} lines, ${P.stills} stills (load ${P.loadMs} ms, stills ${P.stillsMs} ms), ${P.calls} calls ${P.judgeMs} ms, $${P.costUsd.toFixed(4)}: ${JSON.stringify(P.counts)}`);
      if (pass > B.replanRounds) break;
      // 4. re-plan the lines that are not a match
      const bad = [...byLine.values()].filter((v) => todo.has(v.line) && (v.verdict === "partial" || v.verdict === "miss"));
      if (!bad.length) break;
      // a fix that was undone, removed or could not apply in an earlier pass is not tried again
      const fixes = bad.flatMap((v) => suggestFixes(v, reqs.find((r) => r.line === v.line), tl, reqs).map((f) => ({ ...f, line: v.line, pass }))).filter((f) => !tried.has(fixKey(f)));
      P.fixes = fixes.length;
      if (!fixes.length) { report.stopped = `pass ${pass}: no fix the planner vocabulary can express for the ${bad.length} lines left`; break; }
      let res;
      try { res = replan ? await replan({ tl, fixes, verdicts: bad, reqs, pass }) : applyFixes(tl, fixes, { check }); }
      catch (e) { P.errors.push(`replan: ${String(e.message).slice(0, 160)}`); break; }
      res ??= { applied: [], reverted: [], unapplied: [], changedShots: [] };
      report.fixes.applied.push(...(res.applied ?? [])); report.fixes.reverted.push(...(res.reverted ?? [])); report.fixes.unapplied.push(...(res.unapplied ?? []));
      P.applied = res.applied?.length ?? 0; P.reverted = res.reverted?.length ?? 0;
      for (const f of [...(res.reverted ?? []), ...(res.unapplied ?? [])]) tried.add(fixKey(f));
      if (!res.changedShots?.length) { report.stopped = `pass ${pass}: none of the ${fixes.length} fixes could be applied`; break; }
      // the changed shots by reference: the builder may cut or merge shots (a card given back to its host)
      const changedRefs = res.changedShots.map((i) => tl.shots[i]).filter(Boolean);
      // a thing a fix put in that the kit can't build: the builder (kit -> library -> builder -> card), each re-checked
      if (rebuild && (res.pendingObjects?.length || (res.applied ?? []).some((f) => f.op === "replaceCard"))) {
        try { const b = await withDeadline(Promise.resolve(rebuild(tl)), deadline, "the builder"); P.rebuild = b?.report ? { costUsd: b.report.costUsd ?? 0, built: b.applied?.length ?? 0, cards: b.cards?.length ?? 0 } : null; } catch (e) { P.errors.push(`rebuild: ${String(e.message).slice(0, 160)}`); }
      }
      // what the builder did not make is taken out again (it stays missing: the final fallback's card)
      const settled = settleObjects(tl, res.pendingObjects ?? [], { check });
      if (settled.removed.length) {
        P.removed = settled.removed.length;
        report.fixes.reverted.push(...settled.removed.map((p) => ({ op: "needObject", shot: p.shot, name: p.name, why: "the kit / library / builder has no such object (yet)" })));
        for (const p of settled.removed) tried.add(fixKey({ op: "needObject", shot: p.shot, name: p.name }));
      }
      // a shot whose only change was taken out again did not change
      const really = new Set((res.applied ?? []).filter((f) => !settled.removed.some((p) => p.shot === f.shot && p.name === f.name)).map((f) => f.shot));
      reqs = lineRequirements(tl, { script, premise });   // shots may have moved (a card cut, a builder card)
      onlyShots = new Set(changedRefs.filter((s, k) => really.has(res.changedShots[k])).map((s) => tl.shots.indexOf(s)).filter((i) => i >= 0));
      if (!onlyShots.size) { report.stopped = `pass ${pass}: nothing changed after the builder`; break; }
      todo = new Set(reqs.filter((r) => r.shots.some((i) => onlyShots.has(i))).map((r) => r.line));
      for (const l of todo) { const v = byLine.get(l); if (v) v.pendingFix = true; }
    }
    // 5. what is still not a match: the permanent rule's last fallback (a picture card of the thing), else recorded
    const left = [...byLine.values()].filter((v) => v.verdict === "partial" || v.verdict === "miss");
    try {
      const fb = finalFallback(tl, left.filter((v) => !v.pendingFix), reqs, { check });
      report.cards = fb.cards; report.unresolved = fb.unresolved;
    } catch (e) { report.unresolved = left.map((v) => ({ line: v.line, verdict: v.verdict, why: `fallback error: ${e.message}` })); }
    for (const v of left.filter((x) => x.pendingFix)) report.unresolved.push({ line: v.line, verdict: v.verdict, types: v.types, fix: v.fix, why: "fixed but not re-judged (time / money)", unverified: true });
    report.lines = reqs.map((r) => { const v = byLine.get(r.line); return { line: r.line, text: r.text, verdict: v?.verdict ?? null, types: v?.types ?? [], missing: v?.missing ?? [], shows: v?.shows ?? "", fix: v?.fix ?? "", bad_shots: v?.bad_shots ?? [], history: v?.history ?? [] }; });
    return finish();
  } catch (e) {
    report.error = String(e.message ?? e).slice(0, 300);
    log(`review stopped: ${report.error}`);
    return finish(`error: ${report.error}`);
  } finally {
    if (renderer && typeof stills === "function") await renderer.close?.().catch?.(() => {});
  }
}
