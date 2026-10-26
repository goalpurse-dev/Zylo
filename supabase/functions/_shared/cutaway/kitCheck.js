// Cutaway Explainer: the near-free kit check for a custom topic the free rules (topics.js kitCheck) can't decide.
// One Claude Haiku 5.5 call at low effort with a JSON answer: about 2.5k tokens in, 300 out (thinking included)
// = about $0.0005 at $0.10 / $0.50 per 1M tokens. Runs on the server before any charge; never charged to the user.
import { MODELS_3D } from "./pricing.js";
import { PREMADE } from "./topics.js";

const PRICE = { input: 0.1, output: 0.5 }; // USD per 1M tokens, Claude Haiku 5.5 (prompts up to 100k tokens)

export const KIT_SYSTEM = `You decide whether a topic can be a short "how it works" 3D cutaway video: one continuous shot of a toy-like
diorama (a yard, a street, a room, a garage) where the thing is built step by step and its working parts move. Any physical
thing people build or use can be one: the kit designs a part it lacks from building blocks (boxes, panels, pipes, wheels,
springs, gears, rails, lights, screens) that slide, swing, roll, spin, fill and flow. A machine, an appliance, a vehicle, a
building part, a gadget or a product named by its brand is buildable.
Answer "buildable": false ONLY when the topic cannot be such a video at all: the human or animal body, space and the sky,
an abstract idea (money, history, feelings, politics), a real named person, or something unsafe. Then put the reason in
missing as a few plain words ("a real person", "the human body", "space", "an idea, not a thing").
Also pick the 3 closest premade topics (by key) from this list: ${PREMADE.map((p) => `${p.key} (${p.topic})`).join(", ")}.`;

export const KIT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["buildable", "missing", "closest"],
  properties: {
    buildable: { type: "boolean" },
    // no maxItems: structured outputs reject array size limits (a 400 on every call); parseKitReply trims the lists
    missing: { type: "array", items: { type: "string" } },
    closest: { type: "array", items: { type: "string", enum: PREMADE.map((p) => p.key) } },
  },
};

/** The request body (exported for the tests; no call is made there). */
export function kitCheckRequest(topic) {
  return {
    model: MODELS_3D.kitCheck,
    max_tokens: 1500,
    system: KIT_SYSTEM,
    messages: [{ role: "user", content: `Topic: ${String(topic).slice(0, 120)}` }],
    output_config: { effort: "low", format: { type: "json_schema", schema: KIT_SCHEMA } },
  };
}

/** Parse the reply: {buildable, missing, closest, costUsd}. A refusal or a malformed reply counts as not buildable. */
export function parseKitReply(body) {
  const u = body?.usage ?? {};
  const costUsd = Number((((u.input_tokens ?? 0) * PRICE.input + (u.output_tokens ?? 0) * PRICE.output) / 1e6).toFixed(6));
  if (body?.stop_reason === "refusal") return { buildable: false, missing: ["this topic"], closest: [], costUsd };
  const text = (body?.content ?? []).filter((b) => b?.type === "text").map((b) => b.text).join("");
  try {
    const j = JSON.parse(text);
    const keys = new Set(PREMADE.map((p) => p.key));
    return { buildable: j.buildable === true, missing: (j.missing ?? []).map(String).slice(0, 5), closest: (j.closest ?? []).filter((k) => keys.has(k)).slice(0, 3), costUsd };
  } catch {
    return { buildable: false, missing: ["(the check could not be read)"], closest: [], costUsd };
  }
}

/** Anthropic's "out of credits" reply (a 400 whose message names the credit balance). */
export const isBalanceError = (status, body) => status === 400 && /credit balance/i.test(String(body?.error?.message ?? ""));

export async function checkKitFit({ apiKey, topic, timeoutMs = 20_000 }) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify(kitCheckRequest(topic)),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const e = new Error(`kit check: anthropic ${res.status} ${JSON.stringify(body?.error ?? body).slice(0, 300)}`);
    e.balance = isBalanceError(res.status, body);
    throw e;
  }
  return parseKitReply(body);
}
