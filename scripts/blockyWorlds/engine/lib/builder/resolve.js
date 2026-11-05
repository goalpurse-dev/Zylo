// Blocky Worlds builder: resolveNeeds, the owner's rule "a missing kit object or world never fails a run".
// For every need (plan.mjs collectNeeds, or an object the kit can't build), in parallel:
//   1. the kit            kit.has(need) -> a kit name                                     (free, instant)
//   2. the library        cache.lookup(kind, [name, phrase])                             (free, instant)
//   3. design + check     provider.designObject / designWorld -> spec.js validation -> a still (render) -> vision;
//                         a miss is retried with the vision's fix (or the validation problems), at most 2 retries
//   4. a picture card     { kind: "card", text, icon } when all that fails, the money or time runs out, or the
//                         provider is off. Never a failed run: nothing here throws.
// Everything built and passed is saved to the library (blueprint + still + name/aliases + verdict).
//   resolveNeeds(needs, { provider, cache, render, kit, budget: { maxUsd, maxMs, maxDesigns }, idea, log })
//     -> { results: { [needId]: result }, report: { costUsd, ms, designs, visionCalls, cards, built, cached, kit, byNeed } }
//   result = { needId, kind, name, source: "kit" | "cache" | "built" | "card", asset?, kitName?, card?, attempts,
//              costUsd, ms, reason?, verdicts: [] }
import { normName, validateBlueprint, validateWorld } from "./spec.js";
import { cardLabel } from "../planText.js";

export const DEFAULT_BUDGET = Object.freeze({ maxUsd: 0.6, maxMs: 120000, maxDesigns: 6, minConfidence: 0.6, retries: 2 });

const ICONS = { robot: "🤖", tooth: "🦷", dentist: "🦷", turtle: "🐢", moon: "🌙", space: "🚀", sea: "🌊", underwater: "🌊", cave: "🕳️", water: "💧", puddle: "💧", flood: "🌊", leak: "💧", drip: "💧", bathtub: "🛁", bath: "🛁", golf: "⛳", kazoo: "🎺", curtain: "🪟", curtains: "🪟", pumpkin: "🎃", ladder: "🪜" };
/** the last resort: a clear picture card of that very thing */
export function cardOf(need) {
  const words = normName(need.phrase || need.name).split(" ");
  const icon = words.map((w) => ICONS[w]).find(Boolean) ?? "✨";
  return { kind: "card", text: cardLabel(need.phrase || need.name), icon };
}

/** one shared purse per video: a call is only started when its worst case still fits */
export function makePurse({ maxUsd, maxDesigns }) {
  let spent = 0, reserved = 0, designs = 0;
  return {
    get spent() { return spent; }, get designs() { return designs; },
    reserve(usd) { if (spent + reserved + usd > maxUsd + 1e-9) return false; reserved += usd; return true; },
    settle(reservedUsd, actualUsd) { reserved = Math.max(0, reserved - reservedUsd); spent += Math.max(0, Number(actualUsd) || 0); },
    takeDesign() { if (designs >= maxDesigns) return false; designs++; return true; },
  };
}

const withDeadline = (p, deadline, what) => {
  const left = deadline - Date.now();
  if (left <= 0) return Promise.reject(Object.assign(new Error(`time cap reached before ${what}`), { timeout: true }));
  let t;
  return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(Object.assign(new Error(`time cap reached during ${what}`), { timeout: true })), left); })]).finally(() => clearTimeout(t));
};

export async function resolveNeeds(needs, { provider = null, cache = null, render = null, kit = null, budget = {}, log = () => {}, purse: sharedPurse = null, memo = null, t0: start = null, offReason = null } = {}) {
  const B = { ...DEFAULT_BUDGET, ...budget };
  // purse / memo / t0 may be shared by several calls of one video (index.js: the early prefetch and the final pass);
  // budget.until (epoch ms) is a hard end on top of maxMs (the prepare job's own time limit)
  const t0 = start ?? Date.now(), deadline = Math.min(t0 + B.maxMs, Number(B.until) || Infinity), purse = sharedPurse ?? makePurse(B);
  const results = {};
  // one job per distinct thing (two lines needing "ladder" share one design)
  const groups = new Map();
  for (const n of needs ?? []) { const k = `${n.kind}|${normName(n.name)}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(n); }
  let visionCalls = 0;

  async function one(need) {
    const r = { needId: need.id, kind: need.kind, name: need.name, source: "card", attempts: 0, costUsd: 0, ms: 0, verdicts: [] };
    const s0 = Date.now();
    const done = (patch) => { Object.assign(r, patch, { ms: Date.now() - s0 }); if (r.source === "card") r.card ??= cardOf(need); return r; };
    try {
      // 1. the kit
      const kitName = kit?.has?.(need) ?? null;
      if (kitName) return done({ source: "kit", kitName });
      // 2. the library
      try {
        const hit = await cache?.lookup(need.kind, [need.name, need.phrase].filter(Boolean));
        if (hit) { cache.used?.(hit.id)?.catch?.(() => {}); return done({ source: "cache", asset: hit }); }
      } catch (e) { log(`library lookup failed for "${need.name}": ${e.message}`); }
      // 3. design + check
      if (!provider || !render) return done({ reason: provider ? "no still renderer" : offReason ?? "the builder is off (no provider)" });
      if (purse.stillBroken) return done({ reason: `the still renderer failed (${purse.stillBroken}): no design is bought without a way to check it` });
      if (!purse.takeDesign()) return done({ reason: `more than ${B.maxDesigns} new designs in one video` });
      let feedback = null, last = null;
      for (let attempt = 1; attempt <= 1 + B.retries; attempt++) {
        r.attempts = attempt;
        const designCost = provider.worstCase?.(need.kind, "design") ?? 0, visionCost = provider.worstCase?.(need.kind, "vision") ?? 0;
        if (!purse.reserve(designCost + visionCost)) return done({ reason: `money cap ($${B.maxUsd}) reached` });
        let spec, problems, still;
        try {
          const d = await withDeadline(need.kind === "world" ? provider.designWorld({ need, feedback, attempt }) : provider.designObject({ need, feedback, attempt }), deadline, "the design");
          purse.settle(designCost, d.costUsd); r.costUsd += d.costUsd ?? 0;
          ({ blueprint: spec, problems } = need.kind === "world" ? (({ spec: s, problems: p }) => ({ blueprint: s, problems: p }))(validateWorld(d.data)) : validateBlueprint(d.data));
          if (d.data?.generic) spec.generic = true; // (mock) a labelled crate
          spec.name = need.name; // the library keys it by the need's name; the designer's words become aliases
          spec.aliases = [...new Set([...(spec.aliases ?? []), d.data?.name, need.phrase].filter(Boolean))].slice(0, 12);
        } catch (e) {
          purse.settle(designCost, e.costUsd ?? 0); r.costUsd += e.costUsd ?? 0; purse.settle(visionCost, 0);
          if (e.timeout) return done({ reason: e.message });
          if (e.balance) return done({ reason: "the AI account is out of credit" });
          feedback = e.refused ? "the last try was declined; design a friendly, simple, PG version" : `the last reply failed (${String(e.message).slice(0, 120)})`;
          r.verdicts.push({ attempt, error: String(e.message).slice(0, 200) }); continue;
        }
        const empty = need.kind === "world" ? false : !spec.parts.length;
        const serious = problems.filter((p) => !/only the first|used twice/.test(p));
        if (empty || serious.length > Math.max(4, (spec.parts?.length ?? 0) / 3)) {
          purse.settle(visionCost, 0);
          feedback = `the blueprint had problems: ${serious.slice(0, 8).join("; ")}`;
          r.verdicts.push({ attempt, problems: serious.slice(0, 8) }); continue;
        }
        // the still: a failure is the renderer's, not the design's, so it is tried once more with the SAME blueprint and
        // never answered with a new (paid) design; a renderer that fails twice stops every design of this video
        // (run 707609b1: Chrome could not start in the prepare job, every still failed, each failure bought a new design:
        // $0.23 for 0 things built)
        try {
          const name = `${need.kind}-${normName(need.name).replace(/ /g, "_")}-${attempt}`;
          try { still = await withDeadline(render(need.kind, spec, { name }), deadline, "the still"); }
          catch (e) { if (e.timeout) throw e; r.verdicts.push({ attempt, error: `still: ${String(e.message).slice(0, 200)} (tried again)` }); still = await withDeadline(render(need.kind, spec, { name: `${name}b` }), deadline, "the still"); }
        } catch (e) {
          purse.settle(visionCost, 0);
          if (e.timeout) return done({ reason: e.message });
          purse.stillBroken ??= String(e.message).slice(0, 160);
          r.verdicts.push({ attempt, error: `still: ${String(e.message).slice(0, 200)}` });
          return done({ reason: `the still renderer failed: ${String(e.message).slice(0, 160)}` });
        }
        let v;
        try { visionCalls++; v = await withDeadline(provider.vision({ need, kind: need.kind, still, spec, attempt }), deadline, "the vision check"); purse.settle(visionCost, v.costUsd); r.costUsd += v.costUsd ?? 0; }
        catch (e) { purse.settle(visionCost, e.costUsd ?? 0); r.costUsd += e.costUsd ?? 0; if (e.timeout) return done({ reason: e.message }); r.verdicts.push({ attempt, error: `vision: ${String(e.message).slice(0, 200)}` }); continue; }
        const verdict = { attempt, ...v.data, still: still.file ?? null };
        r.verdicts.push(verdict); last = { spec, still, verdict };
        if (v.data.ok && v.data.confidence >= B.minConfidence) {
          let asset = { id: `local-${normName(need.name).replace(/ /g, "_")}`, kind: need.kind, name: need.name, aliases: spec.aliases, blueprint: spec, still_path: still.file ?? null, verdict };
          try { if (cache) asset = await cache.save({ kind: need.kind, name: need.name, aliases: spec.aliases, blueprint: spec, still: still.jpeg ?? null, verdict: { ...verdict, attempts: attempt }, model: provider.designModel ?? provider.name, costUsd: r.costUsd }); }
          catch (e) { log(`library save failed for "${need.name}": ${e.message}`); }
          return done({ source: "built", asset });
        }
        feedback = v.data.fix || `it read as "${v.data.reads_as}", not as ${need.name}`;
      }
      void last;
      return done({ reason: `not clear after ${r.attempts} tries` });
    } catch (e) {
      return done({ reason: `builder error: ${String(e.message).slice(0, 200)}` });
    }
  }

  await Promise.all([...groups.values()].map(async (list) => {
    const key = `${list[0].kind}|${normName(list[0].name)}`;
    let p = memo?.get(key);
    if (!p) { p = one(list[0]); memo?.set(key, p); }
    const r = await p;
    for (const n of list) results[n.id] = { ...r, needId: n.id, ...(r.source === "card" ? { card: cardOf(n) } : {}) };
    log(`need "${list[0].name}" (${list[0].kind}): ${r.source}${r.reason ? ` (${r.reason})` : ""}, ${r.attempts} tries, $${r.costUsd.toFixed(4)}, ${r.ms} ms`);
  }));
  const all = Object.values(results), uniq = [...groups.values()].map((l) => results[l[0].id]);
  const report = {
    costUsd: Number(uniq.reduce((s, r) => s + r.costUsd, 0).toFixed(5)), ms: Date.now() - t0,
    designs: purse.designs, visionCalls,
    kit: all.filter((r) => r.source === "kit").length, cached: all.filter((r) => r.source === "cache").length,
    built: all.filter((r) => r.source === "built").length, cards: all.filter((r) => r.source === "card").length,
    byNeed: uniq.map((r) => ({ name: r.name, kind: r.kind, source: r.source, attempts: r.attempts, costUsd: Number(r.costUsd.toFixed(5)), ms: r.ms, reason: r.reason ?? null, verdicts: r.verdicts.map(({ still, ...v }) => ({ ...v, still: still ? String(still).split(/[\\/]/).pop() : null })) })),
  };
  return { results, report };
}
