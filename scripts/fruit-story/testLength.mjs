// Live check of the length cap: the planner only (no pictures, no video), via
// the worker's planner_test, at 30 s (idea) and 20 s (prompt). ≈ $0.03.
//   FRUIT_ALLOW_PAID=1 node scripts/fruit-story/testLength.mjs
import { openBudget } from "./paidGuard.mjs";
import { admin, api, userSession, writeJson, SUPABASE_URL } from "./lib.mjs";
import { FRUIT_MODELS } from "../../supabase/functions/_shared/fruit/models.js";

const budget = openBudget("3c");
const { accessToken, userId } = await userSession();
const idea = (await api(accessToken, "getIdeas", { seed: 77 })).data[0];
const runs = [
  { label: "idea 30 s", input: { source: "idea", ideaId: idea.id, quality: "v2", lengthSec: 30, aspect: "9:16" } },
  { label: "prompt 20 s", input: { source: "prompt", prompt: "A barista realizes the regular who tips big is her new boss, and he just heard her roast him.", castIds: ["kiki", "gus"], quality: "v2", lengthSec: 20, aspect: "9:16" } },
];
const out = [];
for (const r of runs) {
  budget.reserve(0.03, r.label);
  const res = await (await fetch(`${SUPABASE_URL}/functions/v1/fruit-worker`, {
    method: "POST", headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "planner_test", userId, model: FRUIT_MODELS.planner, input: r.input }),
  })).json();
  const cost = Number(res.costUsd ?? 0);
  budget.record(cost, `length cap ${r.label}`, 0.03);
  const secs = res.plan?.scenes?.map((s) => s.durationSec) ?? [];
  out.push({ ...r, ok: res.ok, attempts: res.attempts, cost, total: res.plan?.lengthSec, secs, lines: res.plan?.scenes?.map((s) => s.line), error: res.message, details: res.details });
  console.log(`${r.label}: ${res.ok ? `${res.plan.lengthSec} s of clips [${secs.join(", ")}] in ${res.attempts} attempt(s)` : `${res.code} ${res.message} ${JSON.stringify(res.details ?? "")}`} · $${cost.toFixed(4)}`);
}
writeJson("data/fruit-phase3/length-cap.json", out);
console.log(budget.summary());
