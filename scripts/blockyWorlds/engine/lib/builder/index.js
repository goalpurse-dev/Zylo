// Blocky Worlds builder: one entry point for the prepare job and local runs.
//   const b = makeBuilder({ provider, cache, budget, stillDir, log })
//   b.prefetch(needs)                 start resolving early (the prepare job calls it with the needs of a plan made from
//                                     estimated timings, so designs run while the voice is being made)
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

export function makeBuilder({ provider = null, cache = null, budget = {}, stillDir = null, render = null, log = () => {} } = {}) {
  const B = { ...DEFAULT_BUDGET, ...budget };
  const purse = makePurse(B), memo = new Map(), t0 = Date.now();
  let stills = null;
  const renderFn = render ?? (async (kind, spec, opts) => {
    stills ??= (await import("./still.mjs")).makeStillRenderer({ outDir: stillDir });
    return (await stills).render(kind, spec, opts);
  });
  const run = (needs, kit) => resolveNeeds(needs, { provider, cache, render: renderFn, kit: kitView(kit), budget: B, purse, memo, t0, log });
  return {
    prefetch(needs, kit) { return run(needs, kit).catch((e) => log(`builder prefetch: ${e.message}`)); },
    async buildFor(tl, { plan = null, kit = null } = {}) {
      const needs = needsFromTimeline(tl, { kit });
      const { results, report } = await run(needs, kit);
      const check = plan ? (t) => [...(plan.checkTimeline?.(t) ?? []), ...(plan.checkSubjects?.(t) ?? []).map((x) => `subject ${x.shot}: ${x.problem}`)] : null;
      const a = applyResolved(tl, needs, results, { check });
      return { report: { ...report, costUsd: Number(purse.spent.toFixed(5)), needs: needs.length }, ...a };
    },
    get spent() { return purse.spent; },
    async close() { if (stills) await (await stills).close(); },
    key: (n) => `${n.kind}|${normName(n.name)}`,
  };
}
