// Stage 3c blind test: the same 3 inputs (idea, prompt, script) at 15 s through
// Claude Sonnet 5 and GPT-5.6 Sol, via the deployed fruit-worker planner_test
// action (same validation + planner as createStory).
//   FRUIT_ALLOW_PAID=1 node scripts/fruit-story/blindTest3c.mjs
// Output: data/fruit-phase3/3c-blind-test.md (labels A/B only) and a sealed
// key in data/fruit-phase3/3c-blind-key.json (not printed).
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { openBudget } from "./paidGuard.mjs";
import { ROOT, SUPABASE_URL, writeJson } from "./lib.mjs";

const MODELS = [
  { provider: "anthropic", model: "claude-sonnet-5", expectUsd: 0.03 },
  { provider: "openai", model: "gpt-5.6-sol", expectUsd: 0.12 },
];
const INPUTS = [
  { name: "Idea", input: { source: "idea", ideaId: "marriage-the-perfect-revenge-dinner", quality: "v2", aspect: "9:16", lengthSec: 15 } },
  { name: "Prompt", input: { source: "prompt", prompt: "A CEO throws a surprise party for his wife's birthday. The intern shows up wearing the exact same dress as the wife, and it turns out he bought both.", castIds: ["rick", "marg", "bella"], quality: "v2", aspect: "9:16", lengthSec: 15 } },
  { name: "Script", input: { source: "script", quality: "v2", aspect: "9:16", lengthSec: 15, script: [
    { speakerId: "lemz", line: "Why is Uncle Tay saying you ordered two boxes last night?" },
    { speakerId: "roxy", line: "Because I was hungry. Is being hungry a crime now?" },
    { speakerId: "uncle", line: "Both boxes went to the flat above the barbershop, darling." },
  ] } },
];

const budget = openBudget("3c");
const out = [];
const key = {};
for (const { name } of INPUTS) {
  const order = crypto.randomInt(2) ? [MODELS[1], MODELS[0]] : [MODELS[0], MODELS[1]];
  key[name] = { A: order[0].model, B: order[1].model };
}
// Cheaper model first for every input, so its real cost is known before the pricier calls.
for (const m of MODELS) {
  for (const { name, input } of INPUTS) {
    const label = key[name].A === m.model ? "A" : "B";
    budget.reserve(m.expectUsd * 2, `${name} ${label}`);          // room for one repair
    const res = await fetch(`${SUPABASE_URL}/functions/v1/fruit-worker`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "planner_test", model: { provider: m.provider, model: m.model }, input }),
    });
    const body = await res.json().catch(() => ({ ok: false, code: `HTTP_${res.status}` }));
    const cost = Number(body.costUsd ?? 0);
    budget.record(cost, `3c blind ${name} ${label}`, m.expectUsd * 2);
    out.push({ name, label, ok: body.ok, cost, attempts: body.attempts, plan: body.plan, error: body.ok ? null : `${body.code}: ${body.message} ${JSON.stringify(body.details ?? "")}` });
    process.stdout.write(`${name} ${label}: ${body.ok ? "ok" : "FAILED"} $${cost.toFixed(4)}\n`);
  }
}
writeJson("data/fruit-phase3/3c-blind-key.json", key);
writeJson("data/fruit-phase3/3c-blind-results.json", out);

const md = [`# Stage 3c blind test (labels only; the key is sealed)\n`];
for (const { name } of INPUTS) {
  md.push(`## ${name}\n`);
  for (const r of out.filter((x) => x.name === name).sort((a, b) => a.label.localeCompare(b.label))) {
    md.push(`### ${name} ${r.label} (cost $${r.cost.toFixed(4)}${r.attempts === 2 ? ", needed one repair" : ""})\n`);
    if (!r.ok) { md.push(`Failed: ${r.error}\n`); continue; }
    md.push(`**${r.plan.title}** (${r.plan.lengthSec} s)\n`);
    md.push(`Locations: ${r.plan.locations.map((l) => `${l.id}: ${l.description}`).join(" · ")}\n`);
    r.plan.scenes.forEach((s, i) => md.push(`${i + 1}. **${s.speakerId}** (${s.durationSec}s, ${s.shot}, ${s.emotion}): "${s.line}"  \n   _in frame: ${s.presentIds.join(", ")} · ${s.locationId} · ${s.action}_`));
    md.push("");
  }
}
fs.writeFileSync(path.join(ROOT, "data/fruit-phase3/3c-blind-test.md"), md.join("\n"));
console.log(budget.summary());
