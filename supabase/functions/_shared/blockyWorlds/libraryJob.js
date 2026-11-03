// Blocky Worlds: the library batch job (docs/blocky-worlds-protocol.md, "The idea library"). One TICK does a few
// generation calls: plan slots from the mix weights -> write ideas -> code checks -> dedup -> AI judge -> store (live if
// accepted, rejected otherwise; rejected ideas are never served). A batch runs tick after tick until it has its target
// of accepted ideas, or its money cap. User ideas waiting as "pending" are judged first.
// The store is passed in (the edge function's Supabase store, or an in-memory one in the tests): no network here
// except through llm.js.
import { duplicateOf, mixWeights, openerKey, planSlots, rankOf, BATCH_TOKENS } from "./library.js";
import { judgeIdeas, writeLibraryIdeas } from "./llm.js";
import { cardProblems } from "./protocol.js";

/** What one generation + judge call costs at most (USD, Sonnet 5.5 list prices, generous): the cap is checked with it. */
export const CALL_CAP_USD = 0.06;

/**
 * One tick of a batch. batch: { id, requested, accepted, cost_usd, ... }. Returns the updated batch numbers and a log.
 * @param {{store: object, batch: object, provider?: string, apiKey?: string, maxUsd: number, callsPerTick?: number, seed?: number}} input
 */
export async function tick({ store, batch, provider = "anthropic", apiKey = "", maxUsd, callsPerTick = 3, seed = Date.now() % 100000 }) {
  const b = { generated: 0, dropped: 0, duplicates: 0, judged: 0, accepted: 0, rejected: 0, cost_usd: 0, ...batch };
  const log = [];
  const spend = (usd) => { b.cost_usd = Number((Number(b.cost_usd) + Number(usd || 0)).toFixed(5)); };
  const capReached = () => Number(b.cost_usd) + CALL_CAP_USD > maxUsd;

  // 1. user ideas waiting for the judge (anonymised cards from good user videos)
  const pending = await store.pending(BATCH_TOKENS.perCall);
  if (pending.length && !capReached()) {
    const j = await judgeIdeas({ apiKey, provider, ideas: pending.map((p) => p.idea) });
    spend(j.costUsd);
    await store.logCost("library", j.costUsd);
    for (const [k, p] of pending.entries()) {
      const v = j.verdicts[k];
      await store.update(p.id, { status: v.accepted ? "live" : "rejected", score: v.score, judge: v, rank: rankOf({ score: v.score }) });
      log.push(`user idea "${p.idea.title}": ${v.accepted ? "live" : `rejected (${v.reason})`}`);
    }
  }

  // 2. new ideas, judged
  const library = await store.library();
  const weights = mixWeights(library.filter((r) => r.status === "live"));
  for (let call = 0; call < callsPerTick && b.accepted < b.requested; call++) {
    if (capReached()) { log.push(`stopped: the next call could pass the $${maxUsd} cap ($${b.cost_usd} spent)`); b.status = "stopped"; break; }
    const slots = planSlots(weights, BATCH_TOKENS.perCall, seed + call * 101 + Number(b.generated));
    const avoid = library.slice(-60).map((r) => r.opener);
    const w = await writeLibraryIdeas({ apiKey, provider, slots, avoid, seed: seed + call + Number(b.generated) });
    spend(w.costUsd);
    await store.logCost("library", w.costUsd);
    b.generated += w.ideas.length + w.dropped;
    b.dropped += w.dropped;
    const fresh = [];
    for (const idea of w.ideas) {
      const problems = cardProblems(idea);
      if (problems.length) { b.dropped++; continue; }
      const dup = duplicateOf(idea, [...library, ...fresh]);
      if (dup) { b.duplicates++; continue; }
      fresh.push({ ...idea, key: openerKey(idea.opener) });
    }
    if (!fresh.length) continue;
    const j = await judgeIdeas({ apiKey, provider, ideas: fresh });
    spend(j.costUsd);
    await store.logCost("library", j.costUsd);
    b.judged += fresh.length;
    const rows = fresh.map((idea, k) => {
      const v = j.verdicts[k];
      const { key, ...card } = idea;
      if (v.accepted) b.accepted++; else b.rejected++;
      return { idea: card, opener: card.opener, opener_key: key, formula: card.formula, twist: card.twistType, mood: card.mood, setting: card.setting, score: v.score, judge: v, status: v.accepted ? "live" : "rejected", source: "batch", batch_id: b.id, rank: rankOf({ score: v.score }) };
    });
    await store.insert(rows);
    library.push(...rows.map((r) => ({ ...r.idea, ...r, key: r.opener_key })));
    log.push(`call ${call + 1}: ${fresh.length} judged, ${rows.filter((r) => r.status === "live").length} live`);
  }
  if (b.accepted >= b.requested) b.status = "done";
  await store.saveBatch(b);
  return { batch: b, log };
}

/** Recompute every live idea's rank from its stats (run daily, or after the owner enters post likes). */
export async function rerank({ store }) {
  const rows = await store.library();
  let changed = 0;
  for (const r of rows.filter((x) => x.status === "live")) {
    const rank = rankOf(r);
    if (Math.abs(rank - Number(r.rank ?? 0)) > 0.0005) { await store.update(r.id, { rank }); changed++; }
  }
  return { ranked: rows.filter((x) => x.status === "live").length, changed };
}

/** A store in memory: the tests and the free local mock run use it. */
export function memoryStore(seedRows = []) {
  const rows = seedRows.map((r, i) => ({ id: r.id ?? `seed-${i}`, status: "live", shown: 0, picked: 0, generated: 0, ...r }));
  const batches = [], costs = [];
  let n = 0;
  return {
    rows, batches, costs,
    async library() { return rows.map((r) => ({ ...r.idea, ...r, key: r.opener_key ?? openerKey(r.opener) })); },
    async pending(limit) { return rows.filter((r) => r.status === "pending").slice(0, limit); },
    async insert(list) { for (const r of list) rows.push({ id: `new-${++n}`, shown: 0, picked: 0, generated: 0, ...r }); },
    async update(id, patch) { Object.assign(rows.find((r) => r.id === id), patch); },
    async saveBatch(b) { const i = batches.findIndex((x) => x.id === b.id); if (i >= 0) batches[i] = { ...b }; else batches.push({ ...b }); },
    async logCost(purpose, usd) { costs.push({ purpose, usd }); },
  };
}
