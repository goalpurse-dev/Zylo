// Blocky Worlds builder: the AI designer. Claude writes a BLOCK BLUEPRINT (an object) or a WORLD SPEC (a place) as JSON
// through structured outputs (output_config.format json_schema; Sonnet 5.5 refuses a forced tool_choice, so no forced
// tool), with the same call shape as supabase/functions/_shared/blockyWorlds/llm.js: fetch, the system prompt cached,
// Sonnet's server-side refusal fallback (fallbacks "default" + beta server-side-fallback-2026-07-01), adaptive thinking
// kept short by effort "low". No maxItems in the schemas (validation clamps instead: spec.js).
// The worker gets no Supabase key, but it does need ANTHROPIC_KEY (a RunPod secret) for a live build.
//   anthropicProvider({ apiKey, designModel, visionModel }) -> { designObject, designWorld, vision, worstCase }
import { LIMITS, SHAPES, MATERIALS, PATTERNS, ANIMS, AXES, FACES, WORLD_KINDS, GROUNDS, GROUND_SHAPES, ENCLOSURES, WALL_PATTERNS, OPENINGS, PARTICLES, LIGHT_BASES, PROP_SPOTS } from "./spec.js";

// USD per 1M tokens: a copy of llm.js PRICE (the worker image ships engine/ only; keep the two in step)
export const PRICE = Object.freeze({
  "claude-sonnet-5-5": Object.freeze({ input: 2.0, output: 10.0, cacheRead: 0.2, cacheWrite: 2.5 }),
  "claude-haiku-5-5": Object.freeze({ input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 }),
});
export const costOf = (model, usage) => {
  const p = PRICE[model] ?? PRICE["claude-sonnet-5-5"], u = usage ?? {}; // an error reply may carry "usage": null
  return Number((((u.input_tokens ?? 0) * p.input + (u.output_tokens ?? 0) * p.output + (u.cache_read_input_tokens ?? 0) * p.cacheRead + (u.cache_creation_input_tokens ?? 0) * p.cacheWrite) / 1e6).toFixed(6));
};
/** the models (the recommendation: CONTRACT.md addendum "Built on demand") */
export const BUILDER_MODELS = Object.freeze({ design: "claude-sonnet-5-5", vision: "claude-sonnet-5-5" });
/**
 * output ceilings (thinking included): they bound what one call can cost. Measured 2026-11-07 (turtle + dog test runs,
 * Sonnet 5.5, effort low): object designs 993-2244 output tokens (no thinking), vision checks 43-182. The old ceilings
 * (9000 / 12000 / 2500) made one design + check reserve $0.13 against a $0.25 cap: only one need could run at a time.
 */
export const MAX_TOKENS = Object.freeze({ object: 5000, world: 8000, vision: 1000 });
/** the smallest ceiling worth a call (the last design of a video may run with less than MAX_TOKENS, never below this) */
export const MIN_TOKENS = Object.freeze({ object: 3000, world: 5000, vision: 1000 });
/** input sizes for the worst case: system ~5,000 (design) / ~1,900 (vision, one image) measured, plus a retry's fix text */
const WORST_INPUT = Object.freeze({ design: 6000, vision: 2200 });
/** the most one call can cost: every output token, the whole input written to the cache */
export function worstCaseUsd(model, step, kind, maxTokens = null) {
  const p = PRICE[model] ?? PRICE["claude-sonnet-5-5"];
  const out = maxTokens ?? (step === "vision" ? MAX_TOKENS.vision : MAX_TOKENS[kind]);
  const inp = step === "vision" ? WORST_INPUT.vision : WORST_INPUT.design;
  return Number(((out * p.output + inp * p.cacheWrite) / 1e6).toFixed(5));
}
/** the largest max_tokens whose worst case stays within maxUsd (null: no limit given) */
export function tokensFor(model, step, kind, maxUsd) {
  if (maxUsd == null || !Number.isFinite(maxUsd)) return null;
  const p = PRICE[model] ?? PRICE["claude-sonnet-5-5"];
  const inp = step === "vision" ? WORST_INPUT.vision : WORST_INPUT.design;
  return Math.max(0, Math.floor(((maxUsd * 1e6) - inp * p.cacheWrite) / p.output));
}
/**
 * the typical cost of one call (what the purse expects to spend; the worst case still bounds it). Sonnet 5.5, measured
 * 2026-11-07 from the test ledgers: object design $0.0114-0.0239 (mean $0.018, cached system), vision $0.0024-0.0047;
 * world: not yet measured (no world was designed), estimated at ~2x an object. Other models scale by output price.
 */
export const TYPICAL_USD = Object.freeze({ object: 0.022, world: 0.04, vision: 0.005 });
export function typicalUsd(model, step, kind) {
  const base = step === "vision" ? TYPICAL_USD.vision : TYPICAL_USD[kind] ?? TYPICAL_USD.object;
  const p = PRICE[model] ?? PRICE["claude-sonnet-5-5"];
  return Number((base * (p.output / PRICE["claude-sonnet-5-5"].output)).toFixed(5));
}

// ---------------------------------------------------------------------------------------------- the style guide
export const STYLE_GUIDE = `THE LOCKED LOOK (every design must look like it belongs in this frame)
- A bright, realistic game-engine town at street level, filmed on a phone in 9:16, eye level, medium shots. Warm sun,
  soft shadows, a deep blue sky with soft clouds; the image is graded punchy (saturation x1.58, contrast x1.24).
- Everything is made of chunky, slightly bevelled BLOCKS and simple shapes: boxes, rounded boxes, cylinders, cones,
  spheres, wedges, tori. No curves beyond those shapes, no thin wires, no tiny details below ~3 cm.
- Bold, saturated, friendly colours with strong contrast between neighbouring parts (a red body with a white stripe,
  a yellow handle on a blue box). Avoid muddy greys and all-one-colour objects. Two to four main colours per object.
- Readable at phone size in under a second: the one feature that makes it THAT thing is big and obvious (a dentist's
  giant tooth and drill, a ladder's rungs, a turtle's patterned shell). Exaggerate the key feature 1.5-2x.
- People in this world are blocky avatars about 1.7 m tall (kids 1.2 m), so objects keep real-world scale unless the
  story says giant / tiny.
- Words on things (a shop sign, a badge) are short, in capitals, in our bold rounded font (labels).
- Original designs only: no logos, brands, famous characters, game-platform words, or real people. PG: no gore.`;

const BLUEPRINT_RULES = `BLUEPRINT RULES
- Units are metres; y is up; +z is the FRONT (the side the camera sees). Put every part's centre ("pos") in ONE shared
  frame: x = 0 is the middle, y = 0 the floor, the object's front near z = +depth/2. The engine re-centres, puts it on
  the floor, and scales it to "height".
- "size" is [width x, height y, depth z]. cylinder / cone / sphere: their diameter is size x (and z), height size y.
  wedge: a ramp, low at the front, tall at the back. torus: a ring standing in the x-y plane, outer diameter size x,
  tube thickness size z.
- "rot" is degrees [x, y, z] about the part's own centre.
- "parent": another part's id when this part must MOVE with it (a hand with its arm), else "". Positions stay in the
  shared frame either way. "pivot": the hinge point (shared frame) for a part that swings / opens, else [].
- Materials: matte (paint, default), plastic (glossy), metal, glass (see-through), glow (lights, screens, eyes,
  magic), fabric (cloth; pattern stripes | dots | plaid | none), wood (planks), stone (blocks).
- Labels: short words on one face of a part (front | back | left | right | top).
- Anims (subtle, looping): bob (move along axis, amount metres), spin (speed turns/s), swing (amount degrees),
  blink (on/off, speed per s), wobble (amount degrees), open (rotate to amount degrees over 1/speed s).
- "focus" = [x, y, z] of the key feature the camera should centre on.
- ${LIMITS.parts} parts at most; 12-45 is usual. Spend parts on the KEY feature, not on hidden insides.`;

// two or three hand-written blueprints of things already in our kit (kit/objects.js, kit/things.js), as few-shot
export const EXAMPLES = [
  { name: "mailbox", aliases: ["mailbox", "letterbox"], height: 1.25, width: 0.5, parts: [
    { id: "post", shape: "box", size: [0.1, 0.95, 0.1], pos: [0, 0.475, 0], rot: [0, 0, 0], color: "#6b4a30", material: "wood", pattern: "none", parent: "", pivot: [] },
    { id: "box", shape: "roundedBox", size: [0.36, 0.3, 0.55], pos: [0, 1.08, 0.05], rot: [0, 0, 0], color: "#2e86de", material: "metal", pattern: "none", parent: "", pivot: [] },
    { id: "lid", shape: "cylinder", size: [0.36, 0.55, 0.3], pos: [0, 1.22, 0.05], rot: [90, 0, 0], color: "#2e86de", material: "metal", pattern: "none", parent: "", pivot: [] },
    { id: "door", shape: "box", size: [0.34, 0.3, 0.03], pos: [0, 1.1, 0.33], rot: [0, 0, 0], color: "#1f6fb8", material: "metal", pattern: "none", parent: "", pivot: [0, 0.95, 0.33] },
    { id: "flag", shape: "box", size: [0.04, 0.22, 0.12], pos: [0.21, 1.25, 0.1], rot: [0, 0, 0], color: "#ff3b2f", material: "plastic", pattern: "none", parent: "", pivot: [0.21, 1.15, 0.1] },
  ], labels: [{ part: "box", text: "MAIL", color: "#ffffff", bg: "", face: "left" }], anims: [{ part: "flag", kind: "swing", axis: "z", amount: 8, speed: 0.6 }], focus: [0, 1.1, 0.1] },
  { name: "fire hydrant", aliases: ["hydrant", "fire hydrant"], height: 0.9, width: 0.45, parts: [
    { id: "base", shape: "cylinder", size: [0.42, 0.08, 0.42], pos: [0, 0.04, 0], rot: [0, 0, 0], color: "#c0392b", material: "plastic", pattern: "none", parent: "", pivot: [] },
    { id: "body", shape: "cylinder", size: [0.3, 0.6, 0.3], pos: [0, 0.38, 0], rot: [0, 0, 0], color: "#e74c3c", material: "plastic", pattern: "none", parent: "", pivot: [] },
    { id: "band", shape: "cylinder", size: [0.34, 0.06, 0.34], pos: [0, 0.62, 0], rot: [0, 0, 0], color: "#f5f5f0", material: "plastic", pattern: "none", parent: "", pivot: [] },
    { id: "cap", shape: "sphere", size: [0.3, 0.24, 0.3], pos: [0, 0.72, 0], rot: [0, 0, 0], color: "#e74c3c", material: "plastic", pattern: "none", parent: "", pivot: [] },
    { id: "nut", shape: "box", size: [0.08, 0.06, 0.08], pos: [0, 0.86, 0], rot: [0, 45, 0], color: "#f1c40f", material: "metal", pattern: "none", parent: "", pivot: [] },
    { id: "nozzle_l", shape: "cylinder", size: [0.12, 0.12, 0.12], pos: [-0.2, 0.45, 0], rot: [0, 0, 90], color: "#f1c40f", material: "metal", pattern: "none", parent: "", pivot: [] },
    { id: "nozzle_r", shape: "cylinder", size: [0.12, 0.12, 0.12], pos: [0.2, 0.45, 0], rot: [0, 0, 90], color: "#f1c40f", material: "metal", pattern: "none", parent: "", pivot: [] },
    { id: "nozzle_f", shape: "cylinder", size: [0.16, 0.12, 0.16], pos: [0, 0.4, 0.18], rot: [90, 0, 0], color: "#f1c40f", material: "metal", pattern: "none", parent: "", pivot: [] },
  ], labels: [], anims: [], focus: [0, 0.5, 0] },
  { name: "bakery stall", aliases: ["bread stall", "bakery stand"], height: 2.5, width: 2.2, parts: [
    { id: "counter", shape: "box", size: [2.0, 1.0, 0.8], pos: [0, 0.5, 0], rot: [0, 0, 0], color: "#c98b4a", material: "wood", pattern: "none", parent: "", pivot: [] },
    { id: "top", shape: "box", size: [2.1, 0.08, 0.9], pos: [0, 1.04, 0], rot: [0, 0, 0], color: "#f5ead6", material: "plastic", pattern: "none", parent: "", pivot: [] },
    { id: "pole_l", shape: "cylinder", size: [0.07, 1.4, 0.07], pos: [-0.95, 1.75, -0.3], rot: [0, 0, 0], color: "#f5f5f0", material: "metal", pattern: "none", parent: "", pivot: [] },
    { id: "pole_r", shape: "cylinder", size: [0.07, 1.4, 0.07], pos: [0.95, 1.75, -0.3], rot: [0, 0, 0], color: "#f5f5f0", material: "metal", pattern: "none", parent: "", pivot: [] },
    { id: "awning", shape: "wedge", size: [2.3, 0.4, 1.1], pos: [0, 2.5, 0.05], rot: [0, 0, 0], color: "#ff5e57", material: "fabric", pattern: "stripes", parent: "", pivot: [] },
    { id: "loaf1", shape: "roundedBox", size: [0.36, 0.16, 0.18], pos: [-0.5, 1.16, 0.15], rot: [0, 15, 0], color: "#d9913f", material: "matte", pattern: "none", parent: "", pivot: [] },
    { id: "loaf2", shape: "roundedBox", size: [0.36, 0.16, 0.18], pos: [0.1, 1.16, 0.2], rot: [0, -10, 0], color: "#c47a2c", material: "matte", pattern: "none", parent: "", pivot: [] },
    { id: "bun", shape: "sphere", size: [0.18, 0.12, 0.18], pos: [0.55, 1.14, 0.18], rot: [0, 0, 0], color: "#e3a24f", material: "matte", pattern: "none", parent: "", pivot: [] },
    { id: "sign", shape: "box", size: [1.3, 0.34, 0.05], pos: [0, 0.62, 0.42], rot: [0, 0, 0], color: "#fff6e3", material: "plastic", pattern: "none", parent: "", pivot: [] },
  ], labels: [{ part: "sign", text: "FRESH BREAD", color: "#8a4a1c", bg: "", face: "front" }], anims: [], focus: [0, 1.1, 0.2] },
];

export const OBJECT_SYSTEM = `You design 3D objects for "Blocky Worlds", short story videos set in a blocky toy-like town. You answer with ONE
block blueprint as JSON (the schema is enforced). The engine builds it from your parts.

${STYLE_GUIDE}

${BLUEPRINT_RULES}

EXAMPLES (things already in our kit, in the exact format):
${EXAMPLES.map((e) => JSON.stringify(e)).join("\n")}`;

export const WORLD_SYSTEM = `You design PLACES (worlds) for "Blocky Worlds", short story videos set in a blocky toy-like world. You answer with ONE
world spec as JSON (the schema is enforced). The engine builds it from procedural parts.

${STYLE_GUIDE}

WORLD RULES
- The camera stands at eye level and looks down a 13 m wide corridor; the story's people stand in the middle of it.
  The frame is tall and narrow (9:16): the place must read INSTANTLY from the ground, the walls / ceiling around the
  people and ONE big signature landmark behind them.
- kind: outdoor | indoor | enclosure. enclosure.type: sky (open air), cave, room, inside_creature (a giant animal's
  insides: curved walls, ribs, a mouth opening far away), underwater (sea dome, seaweed, bubbles), space (stars).
  enclosure.pattern for the walls: ribs | scales | flesh | rock | panels | bricks | planks | none; opening: mouth |
  hole | window | door | none (the far end); glow: the opening's light colour.
- ground: material grass | dirt | sand | rock | snow | tiles | wood | flesh | metal | water | moon | gravel; colour;
  shape flat | hilly | rocky | wet.
- palette: 3-5 bold colours the props and hills use. fog: colour + density 0-1 (0 = clear). particles: dust | bubbles |
  snow | spores | none.
- light: base day | night | warm (the story's time decides it later; pick the place's natural one), tint (a colour
  over the light, or ""), ambient 0.5-1.6, practicals (a few coloured point lights: colour, pos [x, y, z], intensity).
- landmark: ONE big blueprint (3-12 m tall) that says "this place" in one glance (a turtle's beating heart, a
  dentist's giant chair, a moon rocket). Same blueprint rules as objects:
${BLUEPRINT_RULES}
- props: a few small blueprints (or a kit name in "kit" with an empty blueprint) at side_left | side_right |
  back_left | back_right | far | scatter (scatter = many copies around the edges); count 1-3 (scatter up to 24).
  Keep the middle of the corridor clear.`;

// ---------------------------------------------------------------------------------------------- the schemas
const str = { type: "string" }, num = { type: "number" }, nums = { type: "array", items: num };
const en = (list) => ({ type: "string", enum: [...list] });
const obj = (properties) => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });
export function blueprintSchema() {
  return obj({
    name: str, aliases: { type: "array", items: str }, height: num, width: num,
    parts: { type: "array", items: obj({ id: str, shape: en(SHAPES), size: nums, pos: nums, rot: nums, color: str, material: en(MATERIALS), pattern: en(PATTERNS), parent: str, pivot: nums }) },
    labels: { type: "array", items: obj({ part: str, text: str, color: str, bg: str, face: en(FACES) }) },
    anims: { type: "array", items: obj({ part: str, kind: en(ANIMS), axis: en(AXES), amount: num, speed: num }) },
    focus: nums,
  });
}
export function worldSchema() {
  return obj({
    name: str, aliases: { type: "array", items: str }, kind: en(WORLD_KINDS),
    ground: obj({ material: en(GROUNDS), color: str, shape: en(GROUND_SHAPES) }),
    enclosure: obj({ type: en(ENCLOSURES), color: str, color2: str, pattern: en(WALL_PATTERNS), opening: en(OPENINGS), glow: str }),
    palette: { type: "array", items: str },
    fog: obj({ color: str, density: num }),
    particles: en(PARTICLES),
    light: obj({ base: en(LIGHT_BASES), tint: str, ambient: num, practicals: { type: "array", items: obj({ color: str, pos: nums, intensity: num }) } }),
    landmark: blueprintSchema(),
    props: { type: "array", items: obj({ kit: str, blueprint: blueprintSchema(), spot: en(PROP_SPOTS), count: num }) },
  });
}

// ---------------------------------------------------------------------------------------------- the user prompts
const ideaLines = (idea) => (idea ? [idea.title && `Title: ${idea.title}`, idea.opener && `Rule: ${idea.opener}`, idea.premise && `Premise: ${idea.premise}`, idea.setting && `Setting: ${idea.setting}`].filter(Boolean).join("\n") : "");
export function objectPrompt({ need, idea = null, feedback = null }) {
  return [
    `Design: "${need.name}"${need.phrase && need.phrase !== need.name ? ` (the script says "${need.phrase}")` : ""}.`,
    need.lineText ? `The narration line it appears in: "${need.lineText}"` : "",
    ideaLines(idea),
    need.mood ? `Mood: ${need.mood}.` : "",
    `It must read instantly as "${need.name}" in a tall phone frame, next to blocky people. Aliases: the words a script would use for it (singular and plural).`,
    feedback ? `YOUR PREVIOUS TRY DID NOT READ CLEARLY. Fix this: ${feedback}` : "",
  ].filter(Boolean).join("\n");
}
export function worldPrompt({ need, idea = null, feedback = null }) {
  return [
    `Design the place: "${need.name}"${need.phrase && need.phrase !== need.name ? ` (the idea's setting: "${need.phrase}")` : ""}.`,
    need.lineText ? `The video's first line: "${need.lineText}"` : "",
    ideaLines(idea),
    need.mood ? `Mood: ${need.mood}.` : "",
    "The viewer must know where they are in under a second. Aliases: the words a script would use for this place.",
    feedback ? `YOUR PREVIOUS TRY DID NOT READ CLEARLY. Fix this: ${feedback}` : "",
  ].filter(Boolean).join("\n");
}

// ---------------------------------------------------------------------------------------------- the call
/** one Claude call; content may be a string or content blocks (an image + text). -> { data, costUsd, usage, model, ms } */
export async function callClaude({ apiKey, model, system, content, schema, effort = "low", maxTokens = 8000, timeoutMs = 120000, fetchFn = fetch }) {
  if (!apiKey) throw Object.assign(new Error("no Anthropic key for the builder"), { code: "NOT_CONFIGURED" });
  const sonnet = model.startsWith("claude-sonnet-5-5");
  const t0 = Date.now();
  const res = await fetchFn("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json", ...(sonnet ? { "anthropic-beta": "server-side-fallback-2026-07-01" } : {}) },
    body: JSON.stringify({
      model, max_tokens: maxTokens,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content }],
      output_config: { effort, format: { type: "json_schema", schema } },
      ...(sonnet ? { fallbacks: "default" } : {}),
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = await res.json().catch(() => null);
  const costUsd = costOf(body?.model ?? model, body?.usage);
  const ms = Date.now() - t0;
  if (!res.ok) {
    const balance = res.status === 400 && /credit balance/i.test(JSON.stringify(body?.error ?? ""));
    throw Object.assign(new Error(`anthropic ${res.status} ${JSON.stringify(body?.error ?? body).slice(0, 300)}`), { costUsd, balance, ms });
  }
  if (body?.stop_reason === "refusal") throw Object.assign(new Error("REFUSED"), { costUsd, refused: true, ms });
  if (body?.stop_reason === "max_tokens") throw Object.assign(new Error("output truncated"), { costUsd, ms });
  const text = (body?.content ?? []).filter((b) => b?.type === "text").map((b) => b.text).join("");
  try { return { data: JSON.parse(text), costUsd, usage: body?.usage ?? null, model: body?.model ?? model, ms }; }
  catch { throw Object.assign(new Error("the reply was not JSON"), { costUsd, ms }); }
}

/**
 * The real provider (paid). Designs with `designModel`, checks with `visionModel` (vision.js).
 * Every method -> { data, costUsd, usage, model, ms }; worstCase(kind, step) bounds a call for the money cap.
 */
export function anthropicProvider({ apiKey, designModel = BUILDER_MODELS.design, visionModel = BUILDER_MODELS.vision, idea = null, fetchFn = fetch, effort = "low" } = {}) {
  return {
    name: "anthropic", designModel, visionModel,
    // maxUsd (the purse's grant): a smaller max_tokens when the money left is less than the full ceiling's worst case
    designObject: ({ need, feedback, maxUsd = null }) => callClaude({ apiKey, model: designModel, system: OBJECT_SYSTEM, content: objectPrompt({ need, idea, feedback }), schema: blueprintSchema(), effort, maxTokens: Math.min(MAX_TOKENS.object, tokensFor(designModel, "design", "object", maxUsd) ?? Infinity), fetchFn }),
    designWorld: ({ need, feedback, maxUsd = null }) => callClaude({ apiKey, model: designModel, system: WORLD_SYSTEM, content: worldPrompt({ need, idea, feedback }), schema: worldSchema(), effort, maxTokens: Math.min(MAX_TOKENS.world, tokensFor(designModel, "design", "world", maxUsd) ?? Infinity), timeoutMs: 180000, fetchFn }),
    async vision(args) { const { visionCall } = await import("./vision.js"); return visionCall({ apiKey, model: visionModel, fetchFn, ...args }); },
    worstCase: (kind, step) => worstCaseUsd(step === "vision" ? visionModel : designModel, step, kind),
    typicalCase: (kind, step) => typicalUsd(step === "vision" ? visionModel : designModel, step, kind),
    minCase: (kind, step) => worstCaseUsd(step === "vision" ? visionModel : designModel, step, kind, step === "vision" ? MIN_TOKENS.vision : MIN_TOKENS[kind]),
  };
}
