// Blocky Worlds director: the AI STORY DIRECTOR. Claude reads the script (+ the idea card) and writes the PRODUCTION
// LIST (spec.js productionSchema) through structured outputs, with the same call shape as
// supabase/functions/_shared/blockyWorlds/llm.js: fetch, the system prompt cached, output_config.format json_schema
// (Sonnet 5.5 refuses a forced tool_choice), Sonnet's server-side refusal fallback, effort "low", no maxItems.
//   anthropicDirector({ apiKey, model }) -> { direct({ lines, idea, feedback }) -> { data, costUsd, usage, ms, model }, worstCase() }
//   directorTokens({ lines, idea }) -> { system, user, schema, input, output }   (estimates, no call)
import { productionSchema } from "./spec.js";
import { registryForPrompt } from "../capabilities.js";
import { PRICE, costOf } from "../builder/design.js";

/** the models: Haiku 5.5 is the default (a reading + listing task); Sonnet 5.5 for the calibration sample */
export const DIRECTOR_MODELS = Object.freeze({ fast: "claude-haiku-5-5", strong: "claude-sonnet-5-5" });
export const DIRECTOR_MAX_TOKENS = 12000;

export const DIRECTOR_SYSTEM = `You are the STORY DIRECTOR of "Blocky Worlds": 1-2 minute vertical story videos, narrated by a kid, set in an original blocky toy-like 3D world (realistic game-engine look: chunky blocky people, CC0 textures, warm sun, phone-at-street-level camera). A rendering engine builds every shot from your PRODUCTION LIST, so you decide what must exist on screen.

THE PERMANENT RULE: the scene always matches the narration. Every line's key nouns, its action and its subject (who or what the line is about) must be visible in that line's shot. Read for MEANING, not words: "the shell cracked" in a story about a town on a turtle means the giant turtle; "they" means whoever the last lines were about; "the whole town ran" is a crowd of townsfolk running.

WHAT YOU WRITE
- worlds: every place the story happens. kind: outdoor | indoor | enclosed (a cave, a room inside something, a fridge) | creature (the town is ON, INSIDE or right OUTSIDE a giant creature) | underwater | space | sky. base: the nearest hand-built set (street, woods, bedroom, school) used if the place cannot be built. creature: { species, relation: inside | on | outside | none, heightM }. A video may move between worlds (inside the turtle, then on the beach outside it): list each, and put every line in one.
- cast: every person or person-like character that appears (not crowds). id "me" is the narrator (role narrator). kind human | robot | animal | creature | object (a talking object); role kid | adult | elder | baby; look: 3-10 words of visual hints (clothes, colours, one feature); job if it matters to the picture ("dentist").
- creatures: animals and monsters that appear. scale tiny | small | human | big | giant (bigger than a house) | colossal (a town fits on it); heightM; count (1-3; more is a crowd); behaviours they visibly do; monster: true only for the story's monster.
- crowds: many of one kind at once (the whole town, an army of wolves, 300 robots). member person | creature | robot | vehicle; of: the creature id the crowd is made of ("" for people); count; actions (march, charge, flee, cheer...).
- vehicles: name, kind (car, bus, boat, rocket...), motion (parked, drive, fly, sail, crash, launch, float).
- props: objects that must be seen. size hand (held) | object | big | landmark; heldBy a cast id or ""; storyProp: true for the planted object that wins the climax.
- effects: fire, explosion, glow, magic, transformation (target -> into), grow, shrink, vanish, appear, smoke, sparkles. target: the item id or what burns.
- events: weather and big happenings: rain, snow, storm, fog, wind, lightning, flood, earthquake, eruption, tornado, falling (what falls: "the moon falls into the lake"), eclipse, meteor, heatwave, hail, night_falls. scope shot | world.
- scaleMoments: lines where size must be felt: { line, big: item id, small: item id }.
- lines: EXACTLY one entry for every script line, in order (line = its index from 0): world (a world id), subject (the id the line is about), who (cast ids on screen), action (what the subject does: one verb such as walk, run, point, carry, cheer, yell, sleep, sit, fly, swim, climb, fight, eat, dig, stomp...), needs (EVERY item id that must be visible for this line to match the narration: the nouns, the creature, the crowd, the effect), camera (normal | scale: show how big something is | shake: an impact, a stomp, an explosion | action: a charge, chase or fight | reveal: the first look at something hidden), light (day | night | warm).

RULES
- Ids: short lower_snake_case, unique across all lists ("giant_turtle", "wolf_army", "mr_plunk"). Every id in lines must be an item.
- Ask for what the STORY needs, even if you think it is hard to build: the engine builds what it can and logs the rest. Never leave a noun out because it seems difficult; never invent things the narration does not imply.
- Abstract words (rules, luck, time, a promise) are not items. A thing only mentioned as absent ("no one has a dog") is not needed on that line.
- Keep look hints visual and short. Original designs only: no brands, famous characters, game-platform words or real people.

WHAT THE ENGINE CAN DO TODAY (status in the matcher; ask for the story's needs either way):
${registryForPrompt()}

Return only the JSON object.`;

/** the user message: the idea card + the numbered script (or the card's fields as lines when there is no script yet) */
export function directorPrompt({ lines, idea = null, feedback = null }) {
  const card = idea ? `THE IDEA CARD\n${JSON.stringify({ title: idea.title, opener: idea.opener, premise: idea.premise, setting: idea.setting, narrator: idea.narrator, prop: idea.prop, twist: idea.twist, mood: idea.mood })}\n\n` : "";
  const fb = feedback?.length ? `\n\nFIX THESE PROBLEMS FROM YOUR LAST ANSWER:\n${feedback.slice(0, 20).map((p) => `- ${p}`).join("\n")}` : "";
  return `${card}THE SCRIPT (${lines.length} lines, numbered from 0)\n${lines.map((l, i) => `${i} [${l.part || "-"}] ${l.text}`).join("\n")}${fb}`;
}

/** tokens from text: ~3.6 characters a token for English prose, ~3.0 for JSON (Claude's tokenizer, rounded up) */
export const tokensOf = (s, json = false) => Math.ceil(String(s ?? "").length / (json ? 3.0 : 3.6));

/**
 * Token estimate of one director call (no call is made). output = the production list's JSON (measured from the mock's
 * answer for the same lines when given) + a thinking allowance (effort "low": ~25% on top).
 */
export function directorTokens({ lines, idea = null, outputJson = null }) {
  const schema = JSON.stringify(productionSchema());
  const system = tokensOf(DIRECTOR_SYSTEM) + tokensOf(schema, true) + 40; // the schema is sent as the format (counted as input)
  const user = tokensOf(directorPrompt({ lines, idea }));
  const answer = outputJson ? tokensOf(typeof outputJson === "string" ? outputJson : JSON.stringify(outputJson), true) : 60 * lines.length + 600;
  return { system, user, input: system + user, output: Math.ceil(answer * 1.25), answer };
}

/** USD of a call: the system part as a cache write (first call) or read (later calls within 5 minutes) */
export function callUsd(model, { system, user, output }, { cached = false } = {}) {
  const p = PRICE[model] ?? PRICE["claude-sonnet-5-5"];
  return ((cached ? system * p.cacheRead : system * p.cacheWrite) + user * p.input + output * p.output) / 1e6;
}

export function anthropicDirector({ apiKey, model = DIRECTOR_MODELS.fast, fetchFn = fetch, effort = "low", timeoutMs = 120000 } = {}) {
  if (!apiKey) throw new Error("anthropicDirector: no apiKey");
  const sonnet = model.startsWith("claude-sonnet-5-5");
  return {
    model,
    worstCase: () => Number(((DIRECTOR_MAX_TOKENS * (PRICE[model] ?? PRICE["claude-sonnet-5-5"]).output + 9000 * (PRICE[model] ?? PRICE["claude-sonnet-5-5"]).cacheWrite) / 1e6).toFixed(5)),
    async direct({ lines, idea = null, feedback = null }) {
      const t0 = Date.now();
      const res = await fetchFn("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json", ...(sonnet ? { "anthropic-beta": "server-side-fallback-2026-07-01" } : {}) },
        body: JSON.stringify({
          model, max_tokens: DIRECTOR_MAX_TOKENS,
          system: [{ type: "text", text: DIRECTOR_SYSTEM, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content: directorPrompt({ lines, idea, feedback }) }],
          output_config: { effort, format: { type: "json_schema", schema: productionSchema() } },
          ...(sonnet ? { fallbacks: "default" } : {}),
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const body = await res.json().catch(() => null);
      const costUsd = costOf(body?.model ?? model, body?.usage);
      const base = { costUsd, usage: body?.usage ?? null, ms: Date.now() - t0, model: body?.model ?? model };
      if (!res.ok) throw Object.assign(new Error(`anthropic ${res.status} ${JSON.stringify(body?.error ?? body).slice(0, 300)}`), base, { balance: res.status === 400 && /credit balance/i.test(JSON.stringify(body?.error ?? "")) });
      if (body?.stop_reason === "refusal") throw Object.assign(new Error("REFUSED"), base, { refused: true });
      if (body?.stop_reason === "max_tokens") throw Object.assign(new Error("output truncated"), base);
      const text = (body?.content ?? []).filter((b) => b?.type === "text").map((b) => b.text).join("");
      try { return { data: JSON.parse(text), ...base }; } catch { throw Object.assign(new Error("the reply was not JSON"), base); }
    },
  };
}
