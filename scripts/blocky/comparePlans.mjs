// The plan step at MEDIUM effort against LOW effort, on the same five ideas (decision 66). Text only,
// and only the plan step: three plans and the judge, no script.
//   medium: the three plans round four's stories were written from, taken from the log (not paid for
//           again) and judged again by today's judge (seven points, with "motive"), so both sides are
//           scored by the same judge;
//   low:    the plan step run once per idea at low effort, with the same "last pattern" and "last lines"
//           each idea had in round four.
// One attempt per idea. Paid calls are switched on for the run and off again whatever happens.
//   BLOCKY_ALLOW_PAID=1 node scripts/blocky/comparePlans.mjs
import fs from "fs";
import path from "path";
import { ROOT, admin, worker, writeJson } from "./lib.mjs";
import { openBlockyBudget } from "./paidGuard.mjs";

const OUT = "data/blocky-tests/stories";
const stories = JSON.parse(fs.readFileSync(path.join(ROOT, OUT, "results.json"), "utf8")).stories;
const FILE = path.join(ROOT, OUT, "planCompare.json");
const out = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { ideas: {} };
const NAMES = ["admin", "trade", "glitch", "rule", "countdown"];
const db = admin();
// Round four's five plan calls, in the order the stories were written.
const { data: logged, error } = await db.from("blocky_ai_calls").select("created_at, cost_usd, latency_ms, output_tokens, response").eq("purpose", "blind_test:twist_plan").eq("model", "claude-opus-5-5").eq("ok", true).gte("created_at", "2026-10-08T13:55:00Z").lte("created_at", "2026-10-08T14:10:00Z").order("created_at");
if (error) throw new Error(error.message);
if (logged.length !== 5) throw new Error(`expected round four's 5 plan calls in the log, found ${logged.length}`);
const budget = openBlockyBudget("plans");
const set = async (on) => { const { error: e } = await db.from("blocky_settings").update({ paid_calls: on }).eq("id", true); if (e) throw new Error(e.message); };
const brief = (r) => ({
  kept: r.plan.judged.chosen, judgeNote: r.plan.judged.note ?? null, why: r.plan.judged.why,
  plans: r.plans.map((c, i) => ({ ...c.plan, judged: undefined, faults: c.errors, score: r.plan.judged.plans[i]?.scores ?? null, total: r.plan.judged.plans[i]?.total ?? null, gated: r.plan.judged.plans[i]?.gated ?? null })),
});
await set(true);
try {
  for (const [i, name] of NAMES.entries()) {
    const story = stories[`r6-${name}-30`];
    const row = (out.ideas[name] ??= { prompt: story.prompt });
    const input = { source: "prompt", castIds: story.castIds, prompt: story.prompt, quality: "v2", lengthSec: 30, aspect: "9:16" };
    const before = NAMES.slice(0, i).map((n) => stories[`r6-${n}-30`]);
    const avoid = { ...(story.avoided ? { avoidPatterns: [story.avoided] } : {}), avoidOpeners: before.map((s) => s.lines.at(-1).line) };
    if (!row.medium) {
      const text = (logged[i].response?.content ?? []).filter((b) => b.type === "text").map((b) => b.text).join("");
      budget.reserve(0.02, `judge ${name}`);
      row.medium = { state: "sent" }; writeJson(`${OUT}/planCompare.json`, out);
      const r = await worker({ action: "plan_test", input, rawPlans: JSON.parse(text), ...avoid });
      if (!r.ok) throw new Error(`judge ${name}: ${r.code} ${r.message}`);
      row.medium = { planUsd: Number(logged[i].cost_usd), planSec: Math.round(logged[i].latency_ms / 1000), outTokens: logged[i].output_tokens, judgeUsd: r.costUsd, ...brief(r) };
      budget.record(r.costUsd, `plans: ${name}, round four's plans judged again`, 0.02);
      writeJson(`${OUT}/planCompare.json`, out);
    }
    if (!row.low) {
      budget.reserve(0.12, `low ${name}`);
      row.low = { state: "sent" }; writeJson(`${OUT}/planCompare.json`, out);
      const r = await worker({ action: "plan_test", input, effort: "low", ...avoid });
      if (!r.ok) { row.low = { state: "failed", error: `${r.code}: ${r.message}`, details: r.details ?? null, usd: Number(r.costUsd ?? 0) }; budget.record(row.low.usd, `plans: ${name} at low effort (failed)`, 0.12); writeJson(`${OUT}/planCompare.json`, out); continue; }
      row.low = { usd: r.costUsd, sec: Math.round(r.ms / 1000), ...brief(r) };
      budget.record(r.costUsd, `plans: ${name} at low effort`, 0.12);
      writeJson(`${OUT}/planCompare.json`, out);
    }
    const m = row.medium, l = row.low;
    console.log(`${name}: medium kept plan ${m.kept} (${m.plans[m.kept - 1].patternId}, ${m.plans[m.kept - 1].total}/35), plan step $${m.planUsd.toFixed(4)} ${m.planSec}s | low kept plan ${l.kept} (${l.plans[l.kept - 1].patternId}, ${l.plans[l.kept - 1].total}/35), plan step and judge $${l.usd.toFixed(4)} ${l.sec}s`);
  }
} finally {
  await set(false);
}
console.log(budget.summary());
const { data: paid } = await db.rpc("blocky_paid_state", { p_add_usd: 0 });
console.log(`Paid calls are ${paid.paid_calls ? "ON (!)" : "OFF"} again.`);
