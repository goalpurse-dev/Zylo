// Automatic picture check for AI Fruit Story v2 scene pictures: a cheap vision
// model (gpt-5-mini, the small-task model: about $0.001 per picture) confirms
// every character has their fruit head (no human heads anywhere) and that the
// number of characters is right. Every call is logged to fruit_ai_calls with
// its cost. The engine redraws a failed picture once at our cost (engine.js).
import { callLlm } from "./llm.js";
import { FRUIT_MODELS } from "./models.js";
import { FRUIT_LOOKS, headLook } from "./fruitLooks.js";

export const CHECK_PURPOSE = "picture_check";

export const CHECK_SYSTEM = "You check pictures for an animated series where every character is an anthropomorphic FRUIT: a body with a whole fruit as the head (a mango head, a pineapple head...). A human head, human face, human skin or human hair on anyone, even far in the background, is a failure. Look at the whole picture, including blurry background figures. Answer only with the JSON object.";

export function checkSchema() {
  const ch = { name: { type: "string" }, visible: { type: "boolean" }, hasFruitHead: { type: "boolean" } };
  return {
    type: "object",
    additionalProperties: false,
    required: ["characters", "figuresInPicture", "humanHeads", "notes"],
    properties: {
      characters: { type: "array", items: { type: "object", additionalProperties: false, required: Object.keys(ch), properties: ch } },
      figuresInPicture: { type: "integer" },
      humanHeads: { type: "integer" },
      notes: { type: "string" },
    },
  };
}

/** @param {{name:string, fruit:string}[]} expected characters meant to be in the frame */
export function checkPrompt(expected) {
  return [
    `This picture should show exactly ${expected.length} character${expected.length > 1 ? "s" : ""}, each with a fruit head:`,
    // The exact look from the library: Kai is a GREEN young coconut (a check told only
    // "coconut" failed him for not being brown); leaf crowns are not hair.
    ...expected.map((c) => `- ${c.name}: ${headLook(c.fruit)}`),
    "For each one: is it visible, and does it have its fruit head (not a human head)? Count every figure in the picture (fruit or human, background included) and how many have a human head. notes: one short sentence on anything wrong, or an empty string.",
  ].join("\n");
}

/** Turns the model's answer into {ok, problems}. */
export function verdictOf(data, expected) {
  const problems = [];
  const byName = new Map((data?.characters ?? []).map((c) => [String(c.name).toLowerCase(), c]));
  for (const c of expected) {
    const seen = byName.get(c.name.toLowerCase()) ?? byName.get(c.name.split(" ")[0].toLowerCase());
    if (!seen || !seen.visible) problems.push(`${c.name} is missing`);
    else if (!seen.hasFruitHead) problems.push(`${c.name} is drawn without their ${FRUIT_LOOKS[c.fruit]?.label ?? c.fruit} head`);
  }
  const humans = Number(data?.humanHeads) || 0;
  if (humans > 0) problems.push(`${humans} human head${humans > 1 ? "s" : ""} in the picture`);
  if (Number.isFinite(data?.figuresInPicture) && data.figuresInPicture > expected.length) problems.push(`${data.figuresInPicture} figures instead of ${expected.length}`);
  return { ok: problems.length === 0, problems: [...new Set(problems)] };
}

/**
 * Checks one stored scene picture. Returns {ok, problems, costUsd} or throws
 * (the engine then keeps the picture: a check that can't run never blocks).
 * ids: {user_id, story_id, scene_id, job_id} for the log row.
 */
export async function checkPicture({ admin, apiKey, imageUrl, expected, ids, fetchLlm = callLlm }) {
  const model = FRUIT_MODELS.small;
  const t0 = Date.now();
  const user = [{ type: "input_text", text: checkPrompt(expected) }, { type: "input_image", image_url: imageUrl, detail: "high" }];
  try {
    const r = await fetchLlm({ provider: model.provider, model: model.model, apiKey, system: CHECK_SYSTEM, user, schema: checkSchema(), name: "picture_check", maxOutputTokens: 2000, timeoutMs: 45_000 });
    const verdict = verdictOf(r.data, expected);
    await admin.from("fruit_ai_calls").insert({
      ...ids, provider: model.provider, model: model.model, purpose: CHECK_PURPOSE, request: { imageUrl, expected },
      response: { answer: r.data, verdict }, http_status: r.httpStatus, ok: true, cost_usd: r.costUsd,
      input_tokens: r.usage?.inputTokens ?? null, output_tokens: r.usage?.outputTokens ?? null, latency_ms: r.latencyMs ?? null, completed_at: new Date().toISOString(),
    });
    return { ...verdict, costUsd: r.costUsd };
  } catch (e) {
    const d = e?.details;
    await admin.from("fruit_ai_calls").insert({
      ...ids, provider: model.provider, model: model.model, purpose: CHECK_PURPOSE, request: { imageUrl, expected },
      response: d?.response ?? null, http_status: d?.httpStatus ?? null, ok: false, error: String(e?.message ?? e).slice(0, 300),
      cost_usd: d?.costUsd ?? 0, latency_ms: Date.now() - t0, completed_at: new Date().toISOString(),
    });
    throw e;
  }
}
