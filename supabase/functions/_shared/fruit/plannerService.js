// Runs the story planner on the server: picks the model from models.js,
// calls it, logs EVERY call (success or failure) to fruit_ai_calls with the
// exact request, response, tokens and real cost, and returns the plan.
// Used by fruit-story-api (createStory) and fruit-worker (blind test).
import { callLlm, LlmError } from "./llm.js";
import { runPlanner } from "./planner.js";
import { FRUIT_MODELS } from "./models.js";
import { FruitError } from "./errors.js";

/** Logs one LLM exchange; never throws (logging must not break the request). */
async function logCall(admin, row) {
  const { data, error } = await admin.from("fruit_ai_calls").insert(row).select("id").single();
  if (error) { console.error("[fruit] log llm call failed:", error.message); return null; }
  return data.id;
}

/**
 * @param {object} o
 * @param {object} o.admin     service-role supabase client
 * @param {object} o.env       {ANTHROPIC_API_KEY, OPENAI_API_KEY, FRUIT_PAID_CALLS}
 * @param {string|null} o.userId
 * @param {object} o.plannerInput  buildPlannerPrompt input minus llm (source, cast rows, lengthSec, quality, idea/prompt/script/series)
 * @param {{provider:string, model:string}} [o.model]  defaults to FRUIT_MODELS.planner
 * @param {string} [o.purposePrefix]  e.g. "blind_test:"
 */
export async function planStory({ admin, env, userId, plannerInput, model = FRUIT_MODELS.planner, purposePrefix = "", seriesId = null }) {
  if (String(env.FRUIT_PAID_CALLS ?? "").toLowerCase() === "off") throw new FruitError("PAID_CALLS_DISABLED", undefined, 503);
  const apiKey = model.provider === "anthropic" ? env.ANTHROPIC_API_KEY : env.OPENAI_API_KEY;
  if (!apiKey) throw new FruitError("PLANNER_FAILED", undefined, 502);
  const callIds = [];
  let costUsd = 0;

  const llm = async ({ system, user, schema, name, purpose }) => {
    const t0 = Date.now();
    try {
      const r = await callLlm({ provider: model.provider, model: model.model, apiKey, system, user, schema, name });
      costUsd += r.costUsd;
      callIds.push(await logCall(admin, {
        user_id: userId, series_id: seriesId, provider: model.provider, model: model.model, purpose: purposePrefix + purpose,
        request: r.request, response: r.response, http_status: r.httpStatus, ok: true, cost_usd: r.costUsd,
        input_tokens: r.usage.inputTokens, output_tokens: r.usage.outputTokens, cache_read_tokens: r.usage.cacheReadTokens,
        cache_write_tokens: r.usage.cacheWriteTokens, latency_ms: r.latencyMs, completed_at: new Date().toISOString(),
      }));
      return r;
    } catch (e) {
      const d = e instanceof LlmError ? e.details : null;
      if (d?.costUsd) costUsd += d.costUsd;
      callIds.push(await logCall(admin, {
        user_id: userId, series_id: seriesId, provider: model.provider, model: model.model, purpose: purposePrefix + purpose,
        request: d?.request ?? { system, user, schema }, response: d?.response ?? null, http_status: d?.httpStatus ?? null, ok: false,
        error: String(e?.message ?? e).slice(0, 500), cost_usd: d?.costUsd ?? 0, input_tokens: d?.usage?.inputTokens ?? null,
        output_tokens: d?.usage?.outputTokens ?? null, latency_ms: d?.latencyMs ?? Date.now() - t0, completed_at: new Date().toISOString(),
      }));
      throw new FruitError("PLANNER_FAILED", undefined, 502);
    }
  };

  try {
    const { plan, attempts } = await runPlanner({ ...plannerInput, llm });
    return { plan, attempts, callIds: callIds.filter(Boolean), costUsd: Number(costUsd.toFixed(6)), model };
  } catch (e) {
    if (e instanceof FruitError) { e.callIds = callIds.filter(Boolean); e.costUsd = costUsd; throw e; }
    throw new FruitError("PLANNER_FAILED", undefined, 502);
  }
}
