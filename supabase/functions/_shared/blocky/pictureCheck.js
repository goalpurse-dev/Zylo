// Automatic picture check for Blocky Stories: a cheap vision model
// (gpt-5-mini, the small-task model: about $0.001 per picture) looks at every
// scene picture, and at the last frame of every clip, and answers a fixed set
// of questions. Every call is logged to blocky_ai_calls with its cost. The
// engine redraws a failed picture once, and remakes a failed clip once, at our
// cost (engine.js).
//
// What fails a picture (rules.js#verdictOf):
//   - a cast member missing, or not drawn as a blocky game avatar
//   - a human figure anywhere
//   - a brick-toy look: studs, a studded floor, a round minifigure head, claw hands
//   - a realistic 3D mouth, teeth, lips, tongue or nose on a face
//   - the same cast member drawn twice, or an extra character up front
//   - any text on screen (decision 14), or a logo
//   - the speaker too small: cube head under about a fifth of the frame
//     height, or shown down to the knees or feet (decisions 15 and 21)
// The questions, the answer shape and the verdict are in rules.js.
import { callLlm } from "./llm.js";
import { BLOCKY_MODELS } from "./models.js";
import { BODY_CUTS, CHECK_SYSTEM, MIN_HEAD_PERCENT, checkPrompt, checkSchema, verdictOf } from "./rules.js";
export { BODY_CUTS, CHECK_SYSTEM, MIN_HEAD_PERCENT, checkPrompt, checkSchema, verdictOf };

export const CHECK_PURPOSE = "picture_check";
export const CLIP_FRAME_PURPOSE = "clip_frame_check";

/**
 * Checks one stored picture. Returns {ok, problems, fixes, costUsd} or throws
 * (the engine then keeps the picture: a check that can't run never blocks).
 * ids: {user_id, story_id, scene_id, job_id} for the log row.
 * @param {object} o  speaker: the speaking character's name; purpose: CHECK_PURPOSE or CLIP_FRAME_PURPOSE
 *   (a clip's last frame is not judged on framing: the camera has moved by then)
 */
export async function checkPicture({ admin, apiKey, imageUrl, expected, speaker = null, purpose = CHECK_PURPOSE, ids, fetchLlm = callLlm }) {
  const model = BLOCKY_MODELS.small;
  const t0 = Date.now();
  const framing = purpose === CHECK_PURPOSE && Boolean(speaker);
  const user = [{ type: "input_text", text: checkPrompt(expected, { speaker: framing ? speaker : null }) }, { type: "input_image", image_url: imageUrl, detail: "high" }];
  try {
    const r = await fetchLlm({ provider: model.provider, model: model.model, apiKey, system: CHECK_SYSTEM, user, schema: checkSchema(), name: "picture_check", maxOutputTokens: 2500, timeoutMs: 45_000 });
    const verdict = verdictOf(r.data, expected, { speaker, framing, missingOk: purpose === CLIP_FRAME_PURPOSE });
    await admin.from("blocky_ai_calls").insert({
      ...ids, provider: model.provider, model: model.model, purpose, request: { imageUrl, expected, speaker },
      response: { answer: r.data, verdict }, http_status: r.httpStatus, ok: true, cost_usd: r.costUsd,
      input_tokens: r.usage?.inputTokens ?? null, output_tokens: r.usage?.outputTokens ?? null, latency_ms: r.latencyMs ?? null, completed_at: new Date().toISOString(),
    });
    return { ...verdict, costUsd: r.costUsd };
  } catch (e) {
    const d = e?.details;
    await admin.from("blocky_ai_calls").insert({
      ...ids, provider: model.provider, model: model.model, purpose, request: { imageUrl, expected, speaker },
      response: d?.response ?? null, http_status: d?.httpStatus ?? null, ok: false, error: String(e?.message ?? e).slice(0, 300),
      cost_usd: d?.costUsd ?? 0, latency_ms: Date.now() - t0, completed_at: new Date().toISOString(),
    });
    throw e;
  }
}
