// Automatic picture check for AI Fruit Story v2: a cheap vision model
// (gpt-5-mini, the small-task model: about $0.001 per picture) looks at every
// scene picture, and at the last frame of every clip, and answers a fixed set
// of questions. Every call is logged to fruit_ai_calls with its cost. The
// engine redraws a failed picture once, and remakes a failed clip once, at our
// cost (engine.js).
//
// What fails a picture (launch review, Oct 2026):
//   - a cast member missing, or drawn without their fruit head
//   - a human head or face on anyone who is really in the scene
//   - human hair on a fruit head (leaf crowns and stems are not hair)
//   - the same cast member drawn twice, or an extra character up front
//   - readable writing (a name on a mug, a sign, a phone screen)
//   - the speaker too small: head under about a quarter of the frame height,
//     or shown down to the knees or feet (fruit heads are big, so a full-body
//     shot can still have a "large" head: four of those passed on size alone)
// What no longer fails it: small blurred extras far in the background, framed
// photos on a wall, faces on a screen. Those were 14 of the first 14 flags.
import { callLlm } from "./llm.js";
import { FRUIT_MODELS } from "./models.js";
import { FRUIT_LOOKS, headLook } from "./fruitLooks.js";

export const CHECK_PURPOSE = "picture_check";
export const CLIP_FRAME_PURPOSE = "clip_frame_check";

/**
 * The speaker's head must be at least this share of the frame height. The
 * brief is "about a quarter"; the model's own measuring is a few points off
 * either way, so the line sits just under it.
 */
export const MIN_HEAD_PERCENT = 22;

/** The lowest part of the speaker's body inside the frame. The last two are full-body shots. */
export const BODY_CUTS = ["shoulders", "chest", "waist", "knees", "feet", "unknown"];
const TOO_WIDE = new Set(["knees", "feet"]);

/**
 * A clip must carry no words of its own: the final video draws the ONE caption
 * track. Wan sometimes draws subtitles into a clip while the line is spoken
 * (found in Blocky Stories' first real story, 2026-10-08; the clip prompt is
 * the same here), and they are gone again by the last frame, so the clip check
 * also looks at two frames from the middle of the line.
 */
export const DRAWN_TEXT_PROBLEM = "the video model drew its own subtitles into the clip";

export const CHECK_SYSTEM = "You check pictures for an animated series where every character is an anthropomorphic FRUIT: a body with a whole fruit as the head (a mango head, a pineapple head...). Leaf crowns, stems and spikes are part of the fruit, not hair. Look at the whole picture carefully and answer the questions exactly. Framed photos or posters on a wall, faces on a screen or monitor, and small blurred figures far in the background are NOT characters in the scene: count them only where asked. Answer only with the JSON object.";

/** speech: a clip check with the second picture (two frames from the middle of the line), which adds drawnText. */
export function checkSchema({ speech = false } = {}) {
  const ch = { name: { type: "string" }, visible: { type: "boolean" }, hasFruitHead: { type: "boolean" } };
  const props = {
    characters: { type: "array", items: { type: "object", additionalProperties: false, required: Object.keys(ch), properties: ch } },
    mainFigures: { type: "integer" },
    backgroundFigures: { type: "integer" },
    humanHeads: { type: "integer" },
    humanHair: { type: "boolean" },
    duplicates: { type: "array", items: { type: "string" } },
    readableText: { type: "string" },
    speakerHeadPercent: { type: "integer" },
    speakerShownTo: { type: "string", enum: BODY_CUTS },
    ...(speech ? { drawnText: { type: "string" } } : {}),
    notes: { type: "string" },
  };
  return { type: "object", additionalProperties: false, required: Object.keys(props), properties: props };
}

/**
 * @param {{name:string, fruit:string}[]} expected characters meant to be in the frame
 * @param {{speaker?:string, speech?:boolean}} [o] speaker: the speaking character's name (scene pictures);
 *   speech: a SECOND picture is attached, two frames from the middle of the clip (clip checks)
 */
export function checkPrompt(expected, { speaker = null, speech = false } = {}) {
  return [
    `This picture should show exactly ${expected.length} character${expected.length > 1 ? "s" : ""}, each with a fruit head:`,
    // The exact look from the library: Kai is a GREEN young coconut (a check told only
    // "coconut" failed him for not being brown); leaf crowns are not hair.
    ...expected.map((c) => `- ${c.name}: ${headLook(c.fruit)}`),
    "characters: for each one listed, is it visible, and does it have its fruit head (not a human head)?",
    "mainFigures: how many figures are really in the scene (foreground or middle ground, in focus, large enough to see a face). Count every one, listed or not.",
    "backgroundFigures: how many small or blurred figures are far in the background, plus any in photos, posters or on screens.",
    "humanHeads: how many figures ANYWHERE in the scene, foreground or background, have a human head, a human face or human skin instead of a fruit head. A person walking past in the background counts. Framed photos, posters and screens do not.",
    "humanHair: true if any main figure has human hair, a haircut, a beard or a moustache on its head. Leaves, stems and spikes of the fruit are not hair; hats, caps, beanies, durags, veils and headscarves are clothing, not hair.",
    "duplicates: names of listed characters that are drawn more than once as main figures (an empty list if none).",
    "readableText: any words, names or letters a viewer could read in the picture (on a sign, a mug, a screen, clothes), copied as you read them; an empty string if there are none. Unreadable scribbles and blank signs don't count.",
    speaker
      ? `speakerHeadPercent: ${speaker} is the speaker. Measure the height of ${speaker}'s head (chin to the top of the fruit, leaves not counted) as a percentage of the full picture height, 0 to 100. A chest-up shot is about 30 to 45; a full-body shot is about 10 to 18.`
      : "speakerHeadPercent: 0.",
    speaker
      ? `speakerShownTo: the lowest part of ${speaker}'s body that is inside the picture: shoulders, chest, waist, knees or feet. If you can see their shoes or the floor under them, answer feet.`
      : "speakerShownTo: unknown.",
    ...(speech ? ["drawnText: every question above is about the FIRST picture. A SECOND picture is attached: two earlier moments of the same clip, side by side, taken while the line is being spoken. Copy any words, subtitles, captions or lyrics drawn anywhere on that second picture, exactly as you read them; an empty string if there are none. Plain shapes on clothes are not text."] : []),
    "notes: one short sentence on anything wrong, or an empty string.",
  ].join("\n");
}

/**
 * Turns the model's answer into {ok, problems, fixes}. fixes are plain
 * sentences the redraw adds to the picture prompt (pictures.js#withRedrawHint).
 * @param {{speaker?:string, framing?:boolean, missingOk?:boolean}} [o] framing: also judge the speaker's size (scene
 *   pictures only); missingOk: a listed character out of frame is fine (a clip's last frame, after the camera pushed in)
 */
export function verdictOf(data, expected, { speaker = null, framing = Boolean(speaker), missingOk = false } = {}) {
  const problems = [];
  const fixes = [];
  const byName = new Map((data?.characters ?? []).map((c) => [String(c.name).toLowerCase(), c]));
  for (const c of expected) {
    const seen = byName.get(c.name.toLowerCase()) ?? byName.get(c.name.split(" ")[0].toLowerCase());
    if (!seen || !seen.visible) { if (!missingOk) { problems.push(`${c.name} is missing`); fixes.push(`${c.name} must be clearly visible.`); } }
    else if (!seen.hasFruitHead) { problems.push(`${c.name} is drawn without their ${FRUIT_LOOKS[c.fruit]?.label ?? c.fruit} head`); fixes.push(`${c.name}'s head is a whole ${FRUIT_LOOKS[c.fruit]?.label ?? c.fruit}, not a human head.`); }
  }
  const humans = Number(data?.humanHeads) || 0;
  if (humans > 0) { problems.push(`${humans} human head${humans > 1 ? "s" : ""} in the picture`); fixes.push("No humans anywhere: every figure has a fruit head."); }
  if (data?.humanHair === true) { problems.push("human hair on a character"); fixes.push("No hair on anyone: fruit heads are bare fruit, with only their own leaves or stem."); }
  // mainFigures (new answers) or figuresInPicture (answers logged before Oct 2026).
  const main = Number.isFinite(data?.mainFigures) ? data.mainFigures : null;
  if (main != null && main > expected.length) { problems.push(`${main} characters up front instead of ${expected.length}`); fixes.push(`Exactly ${expected.length} character${expected.length > 1 ? "s" : ""} in the scene and nobody else.`); }
  const twice = (Array.isArray(data?.duplicates) ? data.duplicates : []).map((n) => String(n).trim()).filter(Boolean);
  if (twice.length) { problems.push(`${twice.join(" and ")} drawn twice`); fixes.push("Each character appears exactly once."); }
  const text = String(data?.readableText ?? "").trim();
  if (text.replace(/[^a-z0-9]/gi, "").length >= 2) { problems.push(`readable writing in the picture ("${text.slice(0, 40)}")`); fixes.push("No readable writing anywhere: blank signs, blank mugs, blank screens, plain clothes."); }
  const drawn = String(data?.drawnText ?? "").trim();
  if (drawn.replace(/[^\p{L}\p{N}]/gu, "").length >= 2) { problems.push(`${DRAWN_TEXT_PROBLEM} ("${drawn.slice(0, 60)}")`); fixes.push("No subtitles, captions or words drawn in the clip."); }
  const head = Number(data?.speakerHeadPercent);
  const small = Number.isFinite(head) && head > 0 && head < MIN_HEAD_PERCENT;
  if (framing && speaker && (small || TOO_WIDE.has(data?.speakerShownTo))) {
    problems.push(small ? `${speaker} is too small in the frame (head about ${Math.round(head)}% of the height)` : `${speaker} is shown full body (down to the ${data.speakerShownTo}), not chest-up`);
    fixes.push(`Reframe much closer: a tight chest-up shot of ${speaker}, the head filling a third of the frame height, cropped at the chest. No legs, no feet, no floor.`);
  }
  return { ok: problems.length === 0, problems: [...new Set(problems)], fixes: [...new Set(fixes)] };
}

/**
 * Checks one stored picture. Returns {ok, problems, fixes, costUsd} or throws
 * (the engine then keeps the picture: a check that can't run never blocks).
 * ids: {user_id, story_id, scene_id, job_id} for the log row.
 * @param {object} o  speaker: the speaking character's name; purpose: CHECK_PURPOSE or CLIP_FRAME_PURPOSE
 *   (a clip's last frame is not judged on framing: the camera has moved by then)
 *   speechFramesUrl: a clip check's second picture, two frames from the middle of the line, looked at for
 *   subtitles the video model drew itself (they are usually gone by the last frame)
 */
export async function checkPicture({ admin, apiKey, imageUrl, expected, speaker = null, purpose = CHECK_PURPOSE, speechFramesUrl = null, ids, fetchLlm = callLlm }) {
  const model = FRUIT_MODELS.small;
  const t0 = Date.now();
  const framing = purpose === CHECK_PURPOSE && Boolean(speaker);
  const speech = Boolean(speechFramesUrl);
  const user = [
    { type: "input_text", text: checkPrompt(expected, { speaker: framing ? speaker : null, speech }) },
    { type: "input_image", image_url: imageUrl, detail: "high" },
    ...(speech ? [{ type: "input_image", image_url: speechFramesUrl, detail: "high" }] : []),
  ];
  try {
    const r = await fetchLlm({ provider: model.provider, model: model.model, apiKey, system: CHECK_SYSTEM, user, schema: checkSchema({ speech }), name: "picture_check", maxOutputTokens: 2500, timeoutMs: 45_000 });
    const verdict = verdictOf(r.data, expected, { speaker, framing, missingOk: purpose === CLIP_FRAME_PURPOSE });
    await admin.from("fruit_ai_calls").insert({
      ...ids, provider: model.provider, model: model.model, purpose, request: { imageUrl, expected, speaker, ...(speech ? { speechFramesUrl } : {}) },
      response: { answer: r.data, verdict }, http_status: r.httpStatus, ok: true, cost_usd: r.costUsd,
      input_tokens: r.usage?.inputTokens ?? null, output_tokens: r.usage?.outputTokens ?? null, latency_ms: r.latencyMs ?? null, completed_at: new Date().toISOString(),
    });
    return { ...verdict, costUsd: r.costUsd };
  } catch (e) {
    const d = e?.details;
    await admin.from("fruit_ai_calls").insert({
      ...ids, provider: model.provider, model: model.model, purpose, request: { imageUrl, expected, speaker },
      response: d?.response ?? null, http_status: d?.httpStatus ?? null, ok: false, error: String(e?.message ?? e).slice(0, 300),
      cost_usd: d?.costUsd ?? 0, latency_ms: Date.now() - t0, completed_at: new Date().toISOString(),
    });
    throw e;
  }
}
