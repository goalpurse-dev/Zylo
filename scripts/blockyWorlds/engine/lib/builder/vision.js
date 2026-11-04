// Blocky Worlds builder: the AI vision check. The still of a newly built object / world + the line + what it should be
// go to Claude with the image; the reply (json_schema) says whether it reads clearly as that thing at phone size.
//   visionCall({ apiKey, model, need, kind, still: { jpeg, w, h }, spec }) -> { data: { ok, confidence, reads_as, fix }, costUsd, ... }
// Pass rule (resolve.js): ok AND confidence >= 0.6.
import { callClaude, MAX_TOKENS, STYLE_GUIDE } from "./design.js";

export const VISION_SYSTEM = `You check renders for "Blocky Worlds" story videos before they are used. You see ONE still of a newly built
${"object or place"} in our blocky style and say whether a viewer would recognise it, at phone size, in under a second, as what the
narration names. Be strict: a vague shape, the wrong thing, a labelled box standing in for the thing, or a key feature
that is missing or hidden is NOT ok. Judge only recognisability and fit with the look, not artistic taste.

${STYLE_GUIDE}

Answer: ok (true / false), confidence 0-1, reads_as (what a viewer would call it, a few words), fix (one or two concrete
changes to the design that would make it read as the target: which part, bigger / colour / position; "" when ok).`;

export const visionSchema = () => ({
  type: "object", additionalProperties: false, required: ["ok", "confidence", "reads_as", "fix"],
  properties: { ok: { type: "boolean" }, confidence: { type: "number" }, reads_as: { type: "string" }, fix: { type: "string" } },
});

export function visionText({ need, kind }) {
  return [
    `Target ${kind === "world" ? "place" : "object"}: "${need.name}".`,
    need.lineText ? `Narration line: "${need.lineText}"` : "",
    kind === "world" ? "The still is the video's wide establishing shot (a kid stands in the middle for scale)." : "The still shows the object alone on plain pavement.",
    `Does it read clearly as "${need.name}"?`,
  ].filter(Boolean).join("\n");
}

/** image tokens Claude bills for a still (Anthropic's rule of thumb: width x height / 750) */
export const imageTokens = (w, h) => Math.ceil((w * h) / 750);

export async function visionCall({ apiKey, model, need, kind, still, fetchFn = fetch }) {
  const content = [
    { type: "image", source: { type: "base64", media_type: "image/jpeg", data: Buffer.from(still.jpeg).toString("base64") } },
    { type: "text", text: visionText({ need, kind }) },
  ];
  const r = await callClaude({ apiKey, model, system: VISION_SYSTEM, content, schema: visionSchema(), effort: "low", maxTokens: MAX_TOKENS.vision, timeoutMs: 60000, fetchFn });
  const d = r.data ?? {};
  return { ...r, data: { ok: d.ok === true, confidence: Math.max(0, Math.min(1, Number(d.confidence) || 0)), reads_as: String(d.reads_as ?? "").slice(0, 120), fix: String(d.fix ?? "").slice(0, 400) } };
}
