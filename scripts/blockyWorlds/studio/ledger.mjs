// Blocky Worlds STUDIO MODE (prototype, owner-only, 2026-11-12): the run's ledger. Every step's time and money goes to
// <out>/steps.jsonl (one JSON line per step or call) and the running totals to <out>/costs.json. Two hard caps:
//   the experiment cap (everything: script + voice + agent + RunPod), checked BEFORE every paid step with its worst case;
//   the agent cap (Sonnet tokens x price), checked before every agent call and after it (abort above it).
import fs from "node:fs";
import path from "node:path";

export function ledger(out, { capUsd = 5, agentCapUsd = 3 } = {}) {
  fs.mkdirSync(out, { recursive: true });
  const costsFile = path.join(out, "costs.json"), stepsFile = path.join(out, "steps.jsonl");
  const costs = fs.existsSync(costsFile) ? JSON.parse(fs.readFileSync(costsFile, "utf8")) : {};
  const save = () => fs.writeFileSync(costsFile, JSON.stringify(costs, null, 1));
  const total = () => +Object.values(costs).reduce((a, b) => a + (Number(b) || 0), 0).toFixed(5);
  const agentTotal = () => +Object.entries(costs).filter(([k]) => k.startsWith("agent")).reduce((a, [, b]) => a + (Number(b) || 0), 0).toFixed(5);
  const L = {
    out, capUsd, agentCapUsd, costs, total, agentTotal,
    /** one JSONL record (tokens, cost, time, whatever the step reports) */
    log(rec) { fs.appendFileSync(stepsFile, JSON.stringify({ at: new Date().toISOString(), ...rec }) + "\n"); },
    /** a paid step's worst case must fit in what is left of the experiment cap (and the agent cap for agent calls) */
    check(name, worstUsd, { agent = false } = {}) {
      if (total() + worstUsd > capUsd + 1e-9) throw Object.assign(new Error(`CAP: ${name} could cost up to $${worstUsd.toFixed(4)}; $${total().toFixed(4)} of the $${capUsd} experiment cap is spent`), { code: "CAP" });
      if (agent && agentTotal() + worstUsd > agentCapUsd + 1e-9) throw Object.assign(new Error(`AGENT CAP: ${name} could cost up to $${worstUsd.toFixed(4)}; $${agentTotal().toFixed(4)} of the $${agentCapUsd} agent cap is spent`), { code: "AGENT_CAP" });
    },
    /** book a cost (key: one per step; repeated keys add up) */
    add(key, usd) { costs[key] = +((Number(costs[key]) || 0) + (Number(usd) || 0)).toFixed(5); save(); return costs[key]; },
    /** time a step: its seconds go to the log; returns the step's value */
    async step(name, fn, extra = {}) {
      const t0 = Date.now();
      try { const v = await fn(); L.log({ step: name, sec: +((Date.now() - t0) / 1000).toFixed(2), ok: true, ...extra }); return v; }
      catch (e) { L.log({ step: name, sec: +((Date.now() - t0) / 1000).toFixed(2), ok: false, error: String(e.message ?? e).slice(0, 400), ...extra }); throw e; }
    },
  };
  save();
  return L;
}

/** the per-step seconds of a run (summed by step name) from its steps.jsonl */
export function stepTimes(out) {
  const f = path.join(out, "steps.jsonl"); if (!fs.existsSync(f)) return {};
  const t = {};
  for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/).filter(Boolean)) { const r = JSON.parse(l); if (r.step && r.sec != null) t[r.step] = +((t[r.step] ?? 0) + r.sec).toFixed(2); }
  return t;
}
