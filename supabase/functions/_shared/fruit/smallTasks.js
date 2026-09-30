// Small LLM tasks for AI Fruit Story v2 (model: FRUIT_MODELS.small).
// Every call is logged to fruit_ai_calls. A failed small task never blocks
// the user: the caller falls back to the original text.
import { callLlm } from "./llm.js";
import { FRUIT_MODELS } from "./models.js";

const EDIT_SYSTEM = `You turn a user's request to change a picture into ONE short, clear, visual instruction for an image editor.
Keep the user's meaning exactly. Don't add new ideas, characters, text or captions. Plain English, at most 30 words, imperative ("Make the room dark with blue moonlight through the window").`;
const EDIT_SCHEMA = { type: "object", additionalProperties: false, required: ["instruction"], properties: { instruction: { type: "string" } } };

async function log(admin, row) {
  const { error } = await admin.from("fruit_ai_calls").insert(row);
  if (error) console.error("[fruit] log small task failed:", error.message);
}

/** Returns the cleaned instruction, or the user's own text if anything goes wrong. */
export async function cleanEditInstruction({ admin, env, userId, storyId, sceneId, instruction }) {
  const m = FRUIT_MODELS.small;
  const apiKey = m.provider === "anthropic" ? env.ANTHROPIC_API_KEY : env.OPENAI_API_KEY;
  if (!apiKey || String(env.FRUIT_PAID_CALLS ?? "").toLowerCase() === "off") return instruction;
  const base = { user_id: userId, story_id: storyId, scene_id: sceneId, provider: m.provider, model: m.model, purpose: "edit_cleanup" };
  try {
    const r = await callLlm({ provider: m.provider, model: m.model, apiKey, system: EDIT_SYSTEM, user: instruction, schema: EDIT_SCHEMA, name: "edit_instruction", maxOutputTokens: 2000, timeoutMs: 30_000 });
    const cleaned = String(r.data?.instruction ?? "").trim();
    await log(admin, { ...base, request: r.request, response: r.response, http_status: r.httpStatus, ok: true, cost_usd: r.costUsd, input_tokens: r.usage.inputTokens, output_tokens: r.usage.outputTokens, cache_read_tokens: r.usage.cacheReadTokens, latency_ms: r.latencyMs, completed_at: new Date().toISOString() });
    return cleaned && cleaned.length <= 500 ? cleaned : instruction;
  } catch (e) {
    const d = e?.details;
    await log(admin, { ...base, request: d?.request ?? { instruction }, response: d?.response ?? null, http_status: d?.httpStatus ?? null, ok: false, error: String(e?.message ?? e).slice(0, 500), cost_usd: d?.costUsd ?? 0, completed_at: new Date().toISOString() });
    return instruction;
  }
}

const REWRITE_SYSTEM = `A video model refused this prompt with a content-policy error. Rewrite the prompt so it passes a strict safety filter while describing the same scene: soften anything that could read as violent, sexual, hateful or dangerous, and keep it cartoon-friendly.
The spoken line in double quotes MUST stay exactly the same, character for character, in double quotes. Keep who speaks, the voice description, "only X speaks", and "No music. No subtitles, captions or on-screen text."
Return the full rewritten prompt, at most 1500 characters.`;
const REWRITE_SCHEMA = { type: "object", additionalProperties: false, required: ["prompt"], properties: { prompt: { type: "string" } } };

/**
 * One safe rewrite of a refused clip prompt. Returns the new prompt, or null
 * if it can't keep the exact line (the clip then fails and is refunded).
 */
export async function rewriteClipPrompt({ admin, env, userId, storyId, sceneId, jobId, prompt, line }) {
  const m = FRUIT_MODELS.small;
  const apiKey = m.provider === "anthropic" ? env.ANTHROPIC_API_KEY : env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const base = { user_id: userId, story_id: storyId, scene_id: sceneId, job_id: jobId, provider: m.provider, model: m.model, purpose: "clip_rewrite" };
  try {
    const r = await callLlm({ provider: m.provider, model: m.model, apiKey, system: REWRITE_SYSTEM, user: prompt, schema: REWRITE_SCHEMA, name: "clip_prompt", maxOutputTokens: 4000, timeoutMs: 45_000 });
    const next = String(r.data?.prompt ?? "").trim();
    const ok = next.length > 0 && next.length <= 1500 && next.includes(`"${line}"`);
    await log(admin, { ...base, request: r.request, response: r.response, http_status: r.httpStatus, ok, error: ok ? null : "rewrite dropped or changed the line", cost_usd: r.costUsd, input_tokens: r.usage.inputTokens, output_tokens: r.usage.outputTokens, latency_ms: r.latencyMs, completed_at: new Date().toISOString() });
    return ok ? next : null;
  } catch (e) {
    const d = e?.details;
    await log(admin, { ...base, request: d?.request ?? { prompt }, response: d?.response ?? null, ok: false, error: String(e?.message ?? e).slice(0, 500), cost_usd: d?.costUsd ?? 0, completed_at: new Date().toISOString() });
    return null;
  }
}
