// Blocky Worlds builder: one entry point for the prepare job and local runs.
//   const b = makeBuilder({ provider, cache, budget, stillDir, log, renderer: "local" | "runpod" })
//                                     (renderer default: env BLOCKY_WORLDS_STILLS, else "local"; "runpod" = no local GPU)
//   b.prefetch(needs)                 start resolving early (the prepare job calls it with the needs of a plan made from
//                                     estimated timings, so designs run while the voice is being made)
//   await b.buildCritical(items)      the story-critical items (lib/critical.js) BEFORE planning -> { built, unbuilt, report }
//   await b.buildFor(tl, { plan, kit }) -> { report, applied, reverted, cards }   needs -> resolve -> apply + re-check
//   await b.close()                   the still renderer's Chrome
// Providers: "off" (kit + library only; everything else a card: the default until the owner turns on paid builds),
// "mock" (free: lib/builder/mock.js), "anthropic" (paid: ANTHROPIC_KEY). providerFromConfig picks one.
import { resolveNeeds, makePurse, DEFAULT_BUDGET } from "./resolve.js";
import { needsFromTimeline, applyResolved } from "./apply.js";
import { normName } from "./spec.js";

export async function providerFromConfig({ provider = process.env.BLOCKY_WORLDS_BUILDER ?? "off", apiKey = process.env.ANTHROPIC_KEY ?? null, designModel, visionModel, idea = null, mock = {} } = {}) {
  const p = String(provider).toLowerCase();
  if (p === "mock") return (await import("./mock.js")).mockProvider(mock);
  if (p === "anthropic" && apiKey) return (await import("./design.js")).anthropicProvider({ apiKey, designModel, visionModel, idea });
  return null;
}

/** the kit's view for resolveNeeds: an object the kit already builds (worlds: never; the planner already chose a set) */
export const kitView = (kit) => ({ resolveObject: kit?.resolveObject, has: (need) => (need.kind === "object" && kit?.resolveObject ? kit.resolveObject(need.name) ?? kit.resolveObject(need.phrase ?? "") ?? null : null) });

export function makeBuilder({ provider = null, cache = null, budget = {}, stillDir = null, render = null, renderer = process.env.BLOCKY_WORLDS_STILLS ?? "local", log = () => {}, beforeStills = null } = {}) {
  const B = { ...DEFAULT_BUDGET, ...budget };
  // the time cap (maxMs) runs from the first resolve, not from when the builder was made: the prepare job makes it
  // before the story director, which took 88 s in run 707609b1 and left the designs 32 s
  const purse = makePurse(B), memo = new Map();
  let t0 = null, stills = null, ready = null;
  // renderer "runpod" (2026-11-08, laptop runs): the stills go to the RunPod endpoint's objectStills role
  // (runpod/stillRendererRunpod.mjs, batched, no local GPU); "local": this machine's Chrome (and the prepare job's own GPU)
  const openStills = async () => {
    if (!stills) {
      stills = (async () => {
        if (renderer === "runpod") return (await import("../../runpod/stillRendererRunpod.mjs")).makeStillRenderer({ outDir: stillDir, log: (m) => log(`stills: ${m}`) });
        await beforeStills?.(); return (await import("./still.mjs")).makeStillRenderer({ outDir: stillDir });
      })();
    }
    return stills;
  };
  const renderFn = render ?? (async (kind, spec, opts) => (await openStills()).render(kind, spec, opts));
  // with a paid provider and the real still renderer: Chrome + the still page are opened BEFORE the first design, so a
  // renderer that can't start costs nothing (every need a card, the reason in the report)
  const preflight = () => (ready ??= (async () => {
    if (!provider || render) return null;
    try { const s = await openStills(); await s.ready?.(); return null; }
    catch (e) { const m = String(e?.message ?? e).split("\n")[0].slice(0, 160); log(`the still renderer failed: ${m}`); return m; }
  })());
  const run = async (needs, kit) => {
    t0 ??= Date.now();
    const broken = needs?.length ? await preflight() : null;
    return resolveNeeds(needs, { provider: broken ? null : provider, offReason: broken ? `the still renderer failed: ${broken}` : null, cache, render: renderFn, kit: kitView(kit), budget: B, purse, memo, t0, log });
  };
  return {
    prefetch(needs, kit) { return run(needs, kit).catch((e) => log(`builder prefetch: ${e.message}`)); },
    async buildFor(tl, { plan = null, kit = null } = {}) {
      const needs = needsFromTimeline(tl, { kit });
      const { results, report } = await run(needs, kit);
      const check = plan ? (t) => [...(plan.checkTimeline?.(t) ?? []), ...(plan.checkSubjects?.(t) ?? []).map((x) => `subject ${x.shot}: ${x.problem}`)] : null;
      const a = applyResolved(tl, needs, results, { check });
      return { report: { ...report, costUsd: Number(purse.spent.toFixed(5)), needs: needs.length }, ...a };
    },
    /**
     * STORY-CRITICAL FIRST (owner 2026-11-08: "The builder must build every story-critical object BEFORE planning, or
     * the plan must be rejected"). items = lib/critical.js's unresolved items ({ id, name, why }); the kit was already
     * asked WITH the head-noun guard (critical.js kitFor), so the builder's own kit view (no guard: a lookalike would
     * pass) is skipped: library -> design + check, within this video's purse (the critical ones get it first).
     * -> { built: { [name]: asset, [id]: asset }, unbuilt: [{ id, name, why, reason }], report }  never throws
     */
    async buildCritical(items) {
      const list = (items ?? []).filter((it) => it?.name);
      if (!list.length) return { built: {}, unbuilt: [], report: null };
      const needs = list.map((it, i) => ({ id: `critical${i + 1}`, kind: "object", name: String(it.name), phrase: String(it.name), critical: true, why: it.why ?? [] }));
      let out;
      try { out = await run(needs, null); }
      catch (e) { log(`critical build failed: ${e.message}`); return { built: {}, unbuilt: list.map((it) => ({ id: it.id, name: it.name, why: it.why ?? [], reason: `builder error: ${String(e.message).slice(0, 160)}` })), report: null }; }
      const built = {}, unbuilt = [];
      list.forEach((it, i) => {
        const r = out.results[needs[i].id];
        if (r && (r.source === "built" || r.source === "cache") && r.asset) { built[it.name] = r.asset; if (it.id) built[it.id] = r.asset; }
        else unbuilt.push({ id: it.id, name: it.name, why: it.why ?? [], reason: r?.reason ?? "not built" });
      });
      return { built, unbuilt, report: { ...out.report, costUsd: Number(purse.spent.toFixed(5)), needs: needs.length } };
    },
    get spent() { return purse.spent; },
    async close() { if (stills) await (await stills.catch(() => null))?.close(); },
    key: (n) => `${n.kind}|${normName(n.name)}`,
  };
}
