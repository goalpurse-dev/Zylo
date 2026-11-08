// Blocky Worlds: the prepare job's STORY-CRITICAL FIRST order for the past-run replays (free; no builder call).
// The worker (runpod/worker.mjs prepare) plans early in report mode, builds the critical items the kit / library can't
// give BEFORE the real plan, then plans with criticalMode "reject" and the built set. The replays do the same with a fake
// "built" set (a one-part blueprint per unresolved item) standing in for the builder's results.
//   fakeBuilt(items)                         -> { [name]: asset, [id]: asset }
//   planCriticalFirst(plan, args)            -> { tl, early, built }   (args = planVideo's own)
export function fakeBuilt(items = []) {
  const out = {};
  for (const it of items) {
    const id = `fake-${String(it.name).toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
    const asset = { id, kind: "object", name: it.name, aliases: [], blueprint: { name: it.name, parts: [{ shape: "box", size: [1, 1, 1], color: "#888888" }] } };
    out[it.name] = asset;
    if (it.id) out[it.id] = asset;
  }
  return out;
}

export function planCriticalFirst(plan, args) {
  const early = plan.planVideo({ ...args, words: plan.estimateWords ? plan.estimateWords(args.script) : undefined, criticalMode: "report" });
  const built = fakeBuilt(early.critical?.unresolved ?? []);
  const tl = plan.planVideo({ ...args, built, criticalMode: args.direction?.production ? "reject" : null });
  return { tl, early, built };
}
