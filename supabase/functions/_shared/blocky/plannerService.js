// Runs the story planner on the server: picks the model from models.js,
// calls it, logs EVERY call (success or failure) to blocky_ai_calls with the
// exact request, response, tokens and real cost, and returns the plan.
// Used by blocky-story-api (createStory) and blocky-worker (blind test).
import { callLlm, LlmError } from "./llm.js";
import { runPlanner } from "./planner.js";
import { runSeriesPlanner } from "./series.js";
import { reviewScript } from "./scriptReview.js";
import { BLOCKY_MODELS } from "./models.js";
import { BlockyError, MESSAGES } from "./errors.js";
import { llmOutOfBalance, raiseProviderAlert } from "./alerts.js";

/** Logs one LLM exchange; never throws (logging must not break the request). */
async function logCall(admin, row) {
  const { data, error } = await admin.from("blocky_ai_calls").insert(row).select("id").single();
  if (error) { console.error("[blocky] log llm call failed:", error.message); return null; }
  return data.id;
}

/** An llm() for the planners that logs every call and adds up its cost. */
function loggedLlm({ admin, env, userId, model: defaultModel, purposePrefix, seriesId }) {
  if (String(env.BLOCKY_PAID_CALLS ?? "").toLowerCase() === "off") throw new BlockyError("PAID_CALLS_DISABLED", undefined, 503);
  const keyFor = (m) => (m.provider === "anthropic" ? env.ANTHROPIC_API_KEY : env.OPENAI_API_KEY);
  if (!keyFor(defaultModel)) throw new BlockyError("PLANNER_FAILED", undefined, 502);
  const callIds = [];
  let costUsd = 0;

  // use: another model for this one call (the script review runs on BLOCKY_MODELS.review)
  // tools, strict: see llm.js#callLlm (the writer's two tools; answers that match the schema exactly)
  const llm = async ({ system, user, schema, name, purpose, use = null, maxOutputTokens, tools = null, strict = false }) => {
    const t0 = Date.now();
    const model = use ?? defaultModel;
    try {
      const r = await callLlm({ provider: model.provider, model: model.model, apiKey: keyFor(model), system, user, schema, name, ...(tools ? { tools } : {}), ...(strict ? { strict } : {}), ...(maxOutputTokens ? { maxOutputTokens } : {}) });
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
      // Our LLM account is out of balance: tell the admin, and the user "short break, nothing charged".
      if (llmOutOfBalance(d)) {
        await raiseProviderAlert(admin, env, { provider: model.provider, code: `http_${d?.httpStatus ?? "?"}`, message: String(e?.message ?? e), context: { model: model.model, purpose: purposePrefix + purpose, userId } });
        throw new BlockyError("PROVIDER_UNAVAILABLE", MESSAGES.PROVIDER_UNAVAILABLE, 503);
      }
      throw new BlockyError("PLANNER_FAILED", undefined, 502);
    }
  };

  return { llm, done: () => ({ callIds: callIds.filter(Boolean), costUsd: Number(costUsd.toFixed(6)) }) };
}

/**
 * @param {object} o
 * @param {object} o.admin     service-role supabase client
 * @param {object} o.env       {ANTHROPIC_API_KEY, OPENAI_API_KEY, BLOCKY_PAID_CALLS}
 * @param {string|null} o.userId
 * @param {object} o.plannerInput  buildPlannerPrompt input minus llm (source, cast rows, lengthSec, quality, idea/prompt/script/series,
 *                                 avoidPatterns: the twist pattern of this user's last story)
 * @param {{provider:string, model:string}} [o.model]  defaults to BLOCKY_MODELS.planner
 * @param {string} [o.purposePrefix]  e.g. "blind_test:"
 */
export async function planStory({ admin, env, userId, plannerInput, model = BLOCKY_MODELS.planner, purposePrefix = "", seriesId = null }) {
  const { llm, done } = loggedLlm({ admin, env, userId, model, purposePrefix, seriesId });
  try {
    // The script review (and one rewrite) is on unless BLOCKY_SCRIPT_REVIEW=off.
    const reviewOn = String(env.BLOCKY_SCRIPT_REVIEW ?? "").toLowerCase() !== "off";
    const reviewLlm = reviewOn ? (o) => llm({ ...o, use: BLOCKY_MODELS.review, maxOutputTokens: 2500, strict: true }) : undefined;
    const { plan, attempts, review } = await runPlanner({ ...plannerInput, llm, reviewLlm });
    return { plan, attempts, review, ...done(), model };
  } catch (e) {
    if (e instanceof BlockyError) { Object.assign(e, done()); throw e; }
    throw new BlockyError("PLANNER_FAILED", undefined, 502);
  }
}

/**
 * Admin test: the script editor's verdict on a script that already exists
 * (no rewrite). plan: {title, scenes:[{speakerId, line, presentIds, locationId}], locations, roles, outfits}.
 */
export async function reviewStoredScript({ admin, env, userId, plan, cast, source, series = null, purposePrefix = "blind_test:" }) {
  const { llm, done } = loggedLlm({ admin, env, userId, model: BLOCKY_MODELS.review, purposePrefix, seriesId: null });
  const review = await reviewScript({ plan, cast, source, series, llm: (o) => llm({ ...o, maxOutputTokens: 2000 }) });
  return { review, ...done(), model: BLOCKY_MODELS.review };
}

/**
 * Plans a series outline (title, logline, bible, episodes) with the same model
 * and logging as stories. Free for the user.
 * @param {object} o  {admin, env, userId, seriesId, input: {concept, cast rows, opener, tone, episodeCount}}
 */
export async function planSeries({ admin, env, userId, seriesId, input, model = BLOCKY_MODELS.planner }) {
  const { llm, done } = loggedLlm({ admin, env, userId, model, purposePrefix: "", seriesId });
  try {
    const { outline, attempts } = await runSeriesPlanner({ ...input, llm });
    return { outline, attempts, ...done(), model };
  } catch (e) {
    if (e instanceof BlockyError) { Object.assign(e, done()); throw e; }
    throw new BlockyError("PLANNER_FAILED", "We couldn't plan this series. Nothing was charged. Try again.", 502);
  }
}
