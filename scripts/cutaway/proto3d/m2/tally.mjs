// M2: the spend tally in BUILD_PLAN.md, rebuilt from the call log (one JSON line per paid call). Calls cut off by a
// dropped connection have an unknown cost: they are counted at a worst-case estimate so the total never under-reports.
//   node m2/tally.mjs <spend.jsonl> <BUILD_PLAN.md> [budget 10]
import fs from "node:fs";

const [logFile, planFile, budget = "10"] = process.argv.slice(2);
const rows = fs.readFileSync(logFile, "utf8").trim().split("\n").map((l) => JSON.parse(l)).filter((r) => r.label !== "stream test" || r.costUsd);
// worst case for a dropped call: what that kind of call cost when it went through (rounded up)
const WORST = { "scene plan": 0.25, "fact research": 0.15, "scene repair": 0.1, "preview repair": 0.25 };
const service = (r) => (/voice/.test(r.label) ? "ElevenLabs" : /Haiku/.test(r.label) ? "Claude Haiku 5.5" : r.model === "claude-opus-5-5" ? "Claude Opus 5.5" : "Claude Sonnet 5.5");
let total = 0, unknown = 0;
const lines = rows.map((r) => {
  const day = r.at.slice(0, 10);
  if (r.status === "network" && /ENOTFOUND|ECONNREFUSED/.test(r.error)) return `| ${day} | ${r.label}: no connection (${r.error}), never sent | ${service(r)} | $0.00 |`;
  if (r.status === "network") { const w = WORST[r.label] ?? 0.1; unknown += w; return `| ${day} | ${r.label}: connection dropped (${r.error}); may be billed | ${service(r)} | ≤ $${w.toFixed(2)} (est.) |`; }
  if (r.status === 400 || r.costUsd === 0) return `| ${day} | ${r.label}: refused (${r.status}), not billed | ${service(r)} | $0.00 |`;
  total += r.costUsd;
  const searches = r.usage?.server_tool_use?.web_search_requests;
  return `| ${day} | ${r.label}${searches ? ` (${searches} web searches)` : ""} | ${service(r)} | $${r.costUsd.toFixed(4)} |`;
});
const block = `## M2 spend tally (owner pre-approved $10 on 2026-10-21, $8 more for the Gate 2 tuning round on 2026-10-22, $3 for the M2 finish, $5 for the cost round on 2026-10-23 and $10 for the production round on 2026-10-24)

Every paid call for M2: date, what, model or service, cost (from \`work/m2spend.jsonl\`, rebuilt by \`m2/tally.mjs\`). Running total at the bottom.

| Date | What | Service | Cost |
|---|---|---|---|
${lines.join("\n")}

**Total M2: $${total.toFixed(2)} measured + up to $${unknown.toFixed(2)} for dropped calls = at most $${(total + unknown).toFixed(2)} of $${Number(budget).toFixed(2)}**
`;
let s = fs.readFileSync(planFile, "utf8");
const a = s.indexOf("## M2 spend tally"), b = s.indexOf("Before M2 (for the record)", a);
if (a < 0 || b < 0) throw new Error("tally section not found");
s = s.slice(0, a) + block + "\n" + s.slice(b);
fs.writeFileSync(planFile, s);
console.log(`measured $${total.toFixed(4)}, dropped calls up to $${unknown.toFixed(2)}`);
