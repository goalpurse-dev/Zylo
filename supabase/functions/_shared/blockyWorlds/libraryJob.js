// Blocky Worlds: the library batch job (docs/blocky-worlds-protocol.md, "The idea library"). One TICK does a few
// generation calls: plan slots from the mix weights -> write ideas -> code checks -> dedup -> AI judge -> store (live if
// accepted, rejected otherwise; rejected ideas are never served). A batch runs tick after tick until it has its target
// of accepted ideas, or its money cap. User ideas waiting as "pending" are judged first.
// The money cap: before EVERY call the job adds that call's worst case (all its output tokens used, llm.js worstCaseUsd)
// to what was spent, and stops if that could pass the cap. A failed call's cost still counts; 3 failures in a row stop.
// The store is passed in (Supabase in the endpoint and the local runner, memory in the tests).
import { duplicateOf, mixWeights, openerKey, planSlots, rankOf, BATCH_TOKENS } from "./library.js";
import { judgeIdeas, LIBRARY_MAX_TOKENS, reviseIdeas, worstCaseUsd, writeLibraryIdeas } from "./llm.js";
import { MODELS } from "./config.js";
import { cardProblems } from "./protocol.js";

/** The most one writing call / one judging call can cost (USD). */
export const WRITE_WORST_USD = worstCaseUsd(MODELS.library, LIBRARY_MAX_TOKENS.write);
export const JUDGE_WORST_USD = worstCaseUsd(MODELS.judge, LIBRARY_MAX_TOKENS.judge);
export const MAX_FAILS_IN_A_ROW = 3;
/** Rejected ideas scoring at least this get one revision with the judge's note (the accept line is 65). */
export const REVISE_FROM = 55;

/**
 * One tick of a batch. batch: { id, requested, accepted, cost_usd, ... }. Returns the updated batch numbers and a log.
 * @param {{store: object, batch: object, provider?: string, apiKey?: string, maxUsd: number, callsPerTick?: number, seed?: number}} input
 */
export async function tick({ store, batch, provider = "anthropic", apiKey = "", maxUsd, callsPerTick = 3, seed = Date.now() % 100000 }) {
  const b = { generated: 0, dropped: 0, duplicates: 0, judged: 0, accepted: 0, rejected: 0, cost_usd: 0, fails: 0, ...batch };
  const log = [];
  const spend = async (usd) => { const u = Number(usd || 0); b.cost_usd = Number((Number(b.cost_usd) + u).toFixed(5)); await store.logCost("library", u); };
  const wouldPass = (worst) => Number(b.cost_usd) + worst > maxUsd;
  const judgedBefore = Number(b.judged || 0);
  const stop = (why) => { b.status = "stopped"; log.push(`stopped: ${why} ($${Number(b.cost_usd).toFixed(4)} spent of $${maxUsd})`); };
  const failed = async (e, what) => {
    await spend(e?.costUsd);
    b.fails = Number(b.fails || 0) + 1;
    log.push(`${what} failed (${b.fails} in a row): ${String(e?.message ?? e).slice(0, 160)}`);
    if (b.fails >= MAX_FAILS_IN_A_ROW) { b.status = "failed"; log.push(`stopped: ${MAX_FAILS_IN_A_ROW} failed calls in a row`); }
  };

  // 1. user ideas waiting for the judge (anonymised cards from good user videos)
  const pending = await store.pending(BATCH_TOKENS.perCall);
  if (pending.length) {
    if (wouldPass(JUDGE_WORST_USD)) { stop("the next judge call could pass the cap"); await store.saveBatch(b); return { batch: b, log }; }
    try {
      const j = await judgeIdeas({ apiKey, provider, ideas: pending.map((p) => p.idea) });
      await spend(j.costUsd); b.fails = 0;
      for (const [k, p] of pending.entries()) {
        const v = j.verdicts[k];
        await store.update(p.id, { status: v.accepted ? "live" : "rejected", score: v.score, judge: v, rank: rankOf({ score: v.score }) });
        log.push(`user idea "${p.idea.title}": ${v.accepted ? "live" : `rejected (${v.reason})`}`);
      }
    } catch (e) { await failed(e, "judging user ideas"); }
  }

  // 2. new ideas, judged
  const library = await store.library();
  const weights = mixWeights(library.filter((r) => r.status === "live"));
  for (let call = 0; call < callsPerTick && b.accepted < b.requested && b.status !== "failed"; call++) {
    // a writing call is always followed by its judging call: both must fit under the cap
    if (wouldPass(WRITE_WORST_USD + JUDGE_WORST_USD)) { stop("the next write + judge calls could pass the cap"); break; }
    const slots = planSlots(weights, BATCH_TOKENS.perCall, seed + call * 101 + Number(b.generated));
    const avoid = library.slice(-60).map((r) => r.opener);
    let w;
    try { w = await writeLibraryIdeas({ apiKey, provider, slots, avoid, seed: seed + call + Number(b.generated) }); }
    catch (e) { await failed(e, "writing"); continue; }
    await spend(w.costUsd); b.fails = 0;
    b.generated += w.ideas.length + w.dropped;
    b.dropped += w.dropped;
    const fresh = [];
    for (const idea of w.ideas) {
      if (cardProblems(idea).length) { b.dropped++; continue; }
      if (duplicateOf(idea, [...library, ...fresh])) { b.duplicates++; continue; }
      fresh.push({ ...idea, key: openerKey(idea.opener) });
    }
    if (!fresh.length) continue;
    if (wouldPass(JUDGE_WORST_USD)) { stop("the next judge call could pass the cap"); break; }
    let j;
    try { j = await judgeIdeas({ apiKey, provider, ideas: fresh }); }
    catch (e) { await failed(e, "judging"); continue; }
    await spend(j.costUsd); b.fails = 0;
    b.judged += fresh.length;
    const rows = fresh.map((idea, k) => {
      const v = j.verdicts[k];
      const { key, ...card } = idea;
      if (v.accepted) b.accepted++; else b.rejected++;
      return { idea: card, opener: card.opener, opener_key: key, formula: card.formula, twist: card.twistType, mood: card.mood, setting: card.setting, score: v.score, judge: v, status: v.accepted ? "live" : "rejected", source: "batch", batch_id: b.id, rank: rankOf({ score: v.score }) };
    });
    await store.insert(rows);
    library.push(...rows.map((r) => ({ ...r.idea, ...r, key: r.opener_key })));
    log.push(`call ${call + 1}: ${w.ideas.length} written, ${fresh.length} judged, ${rows.filter((r) => r.status === "live").length} live ($${Number(b.cost_usd).toFixed(4)} so far)`);

    // near misses get one revision with the judge's note, then the judge again (cheaper than writing new ones)
    const near = rows.filter((r) => r.status === "rejected" && r.score >= REVISE_FROM && r.judge.reason !== "not safe or names a real thing");
    if (!near.length || b.accepted >= b.requested) continue;
    if (wouldPass(WRITE_WORST_USD + JUDGE_WORST_USD)) { stop("the next revise + judge calls could pass the cap"); break; }
    let rv;
    try { rv = await reviseIdeas({ apiKey, provider, items: near.map((r) => ({ idea: r.idea, note: r.judge.better })) }); }
    catch (e) { await failed(e, "revising"); continue; }
    await spend(rv.costUsd); b.fails = 0;
    const others = (orig) => library.filter((x) => x.opener_key !== orig.opener_key);
    const unchanged = (idea, k) => JSON.stringify(idea) === JSON.stringify(near[k].idea); // nothing to judge again
    const revised = rv.ideas.map((idea, k) => (idea && !unchanged(idea, k) && !cardProblems(idea).length && !duplicateOf(idea, others(near[k])) ? { ...idea, key: openerKey(idea.opener) } : null)).filter(Boolean);
    if (!revised.length) continue;
    let jr;
    try { jr = await judgeIdeas({ apiKey, provider, ideas: revised }); }
    catch (e) { await failed(e, "judging revisions"); continue; }
    await spend(jr.costUsd);
    b.judged += revised.length; b.revised = Number(b.revised || 0) + revised.length;
    const rrows = revised.map((idea, k) => {
      const v = jr.verdicts[k];
      const { key, ...card } = idea;
      if (v.accepted) b.accepted++; else b.rejected++;
      return { idea: card, opener: card.opener, opener_key: key, formula: card.formula, twist: card.twistType, mood: card.mood, setting: card.setting, score: v.score, judge: { ...v, revised: true }, status: v.accepted ? "live" : "rejected", source: "batch", batch_id: b.id, rank: rankOf({ score: v.score }) };
    });
    await store.insert(rrows);
    library.push(...rrows.map((r) => ({ ...r.idea, ...r, key: r.opener_key })));
    log.push(`  revised ${revised.length}: ${rrows.filter((r) => r.status === "live").length} live ($${Number(b.cost_usd).toFixed(4)} so far)`);
  }
  if (b.accepted >= b.requested) b.status = "done";
  // a stall (every new idea a duplicate or dropped) costs money for nothing: two such ticks in a row end the batch
  if (b.status === "running") {
    b.stalls = Number(b.judged || 0) === judgedBefore ? Number(b.stalls || 0) + 1 : 0;
    if (b.stalls >= 2) { b.status = "stopped"; log.push("stopped: two ticks in a row brought no new idea to judge (all duplicates or failed checks)"); }
  }
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
    async logCost(purpose, usd) { if (usd > 0) costs.push({ purpose, usd }); },
  };
}

/**
 * The job's store on Supabase (the endpoint and the local runner share it). admin: a service-role supabase-js client.
 * @param {any} admin @param {string} provider
 */
export function supabaseStore(admin, provider) {
  const COLS = "id, idea, opener, opener_key, formula, twist, mood, setting, score, status, rank, shown, picked, rewritten, generated, downloaded, thumbs_up, thumbs_down, likes_total";
  return {
    async library() {
      const { data, error } = await admin.from("blocky_worlds_library").select(COLS).in("status", ["live", "pending", "rejected"]).order("created_at", { ascending: true }).limit(10000);
      if (error) throw new Error(`library read: ${error.message}`);
      return (data ?? []).map((r) => ({ ...r.idea, ...r, key: r.opener_key }));
    },
    async pending(limit) {
      const { data } = await admin.from("blocky_worlds_library").select(COLS).eq("status", "pending").order("created_at", { ascending: true }).limit(limit);
      return data ?? [];
    },
    async insert(rows) {
      for (const r of rows) { const { error } = await admin.from("blocky_worlds_library").insert(r); if (error && !/duplicate key/i.test(error.message)) throw new Error(`library insert: ${error.message}`); }
    },
    async update(id, patch) { await admin.from("blocky_worlds_library").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id); },
    async saveBatch(b) {
      await admin.from("blocky_worlds_idea_batches").update({ generated: b.generated, dropped: b.dropped, duplicates: b.duplicates, judged: b.judged, accepted: b.accepted, rejected: b.rejected, cost_usd: b.cost_usd, status: b.status ?? "running", finished_at: ["done", "stopped", "failed"].includes(b.status) ? new Date().toISOString() : null }).eq("id", b.id);
    },
    async logCost(purpose, usd) { if (usd > 0) await admin.from("blocky_worlds_ai_calls").insert({ user_id: null, purpose, provider, usd }); },
  };
}
