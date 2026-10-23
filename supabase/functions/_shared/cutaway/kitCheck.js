// Cutaway Explainer: the near-free kit check for a custom topic the free rules (topics.js kitCheck) can't decide.
// One Claude Haiku 5.5 call at low effort with a JSON answer: about 2.5k tokens in, 300 out (thinking included)
// = about $0.0005 at $0.10 / $0.50 per 1M tokens. Runs on the server before any charge; never charged to the user.
import { MODELS_3D } from "./pricing.js";
import { PREMADE } from "./topics.js";

const PRICE = { input: 0.1, output: 0.5 }; // USD per 1M tokens, Claude Haiku 5.5 (prompts up to 100k tokens)

export const KIT_SYSTEM = `You decide whether a short "how it works" 3D cutaway video about a topic can be built from a fixed parts kit.
The video is one continuous shot of a diorama: a house, a lawn and trees, and a soil cut face (soil layers, stones, roots, groundwater) in front.
The kit can build only these:
- the ground: pits, trenches, ditches and holes dug into it (with flying dirt and a mound), and fills that rise in them: gravel, water, soil, clay
- pipes along any path (solid or perforated) with flowing water or liquid, tanks and boxes, sheets and liners, fabric wraps
- rain, runoff, puddles, water levels and seepage through the soil, a crack in a concrete wall, a foundation
- trucks dumping loads, simple props (a sign, a book, a flag, bushes, fences, posts), arrows and outlines, number cards
It CANNOT build: appliances or machines' insides, electronics, engines, vehicles' insides, the human body, space, tall buildings, bridges, dams, tunnels, factories, or ideas without a physical build.
Answer "buildable": true only if every important part of the topic can be shown with the kit. List what is missing otherwise, in a few plain words each.
Also pick the 3 closest premade topics (by key) from this list: ${PREMADE.map((p) => `${p.key} (${p.topic})`).join(", ")}.`;

export const KIT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["buildable", "missing", "closest"],
  properties: {
    buildable: { type: "boolean" },
    missing: { type: "array", items: { type: "string" }, maxItems: 5 },
    closest: { type: "array", items: { type: "string", enum: PREMADE.map((p) => p.key) }, maxItems: 3 },
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

export async function checkKitFit({ apiKey, topic, timeoutMs = 20_000 }) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify(kitCheckRequest(topic)),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`kit check: anthropic ${res.status} ${JSON.stringify(body?.error ?? body).slice(0, 200)}`);
  return parseKitReply(body);
}
