// Cutaway Explainer: the planning call (Anthropic tool use -> JSON). fetch only.

import { MODELS } from "./pricing.js";
import { PLAN_SCHEMA, PLANNER_SYSTEM, plannerUser, validatePlan } from "./planner.js";

// USD per 1M tokens (same figures as the other templates' llm.js).
const PRICE = { input: 2.0, output: 10.0, cacheRead: 0.2, cacheWrite: 2.5 };

export async function planVideo({ apiKey, topic, lengthSec }) {
  const request = {
    model: MODELS.llm.model,
    max_tokens: 8000,
    system: [{ type: "text", text: PLANNER_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: plannerUser({ topic, lengthSec }) }],
    tools: [{ name: "cutaway_plan", description: "Return the plan.", input_schema: PLAN_SCHEMA }],
    tool_choice: { type: "tool", name: "cutaway_plan" },
  };
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(120_000),
  });
  const body = await res.json().catch(() => null);
  const u = body?.usage ?? {};
  const costUsd = Number((((u.input_tokens ?? 0) * PRICE.input + (u.output_tokens ?? 0) * PRICE.output + (u.cache_read_input_tokens ?? 0) * PRICE.cacheRead + (u.cache_creation_input_tokens ?? 0) * PRICE.cacheWrite) / 1e6).toFixed(5));
  if (!res.ok) throw Object.assign(new Error(`PLAN_FAILED: anthropic ${res.status} ${JSON.stringify(body?.error ?? body).slice(0, 300)}`), { costUsd });
  if (body?.stop_reason === "max_tokens") throw Object.assign(new Error("PLAN_FAILED: output truncated"), { costUsd });
  const block = (body?.content ?? []).find((b) => b?.type === "tool_use");
  if (!block) throw Object.assign(new Error("PLAN_FAILED: no plan returned"), { costUsd });
  return { plan: validatePlan(block.input, lengthSec), costUsd };
}
