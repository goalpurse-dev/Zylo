// Blocky Worlds director: the AI STORY DIRECTOR. Claude reads the script (+ the idea card) and writes the PRODUCTION
// LIST (spec.js productionSchema) through structured outputs, with the same call shape as
// supabase/functions/_shared/blockyWorlds/llm.js: fetch, the system prompt cached, output_config.format json_schema
// (Sonnet 5.5 refuses a forced tool_choice), Sonnet's server-side refusal fallback, effort "low", no maxItems.
//   anthropicDirector({ apiKey, model }) -> { direct({ lines, idea, feedback }) -> { data, costUsd, usage, ms, model }, worstCase() }
//   directorTokens({ lines, idea }) -> { system, user, schema, input, output }   (estimates, no call)
import { productionSchema } from "./spec.js";
import { registryForPrompt } from "../capabilities.js";
import { PRICE, costOf } from "../builder/design.js";
// the whole-video STORY PATTERNS block (lib/storyPatterns.js; built by shotlib/story.mjs): beat sequences, recurring
// wides, the arc, characters. Read once at load, so the cached system prompt stays byte-stable within a process.
import { storyPatternsForPrompt } from "../storyPatterns.js";

/** the models: Haiku 5.5 is the default (a reading + listing task); Sonnet 5.5 for the calibration sample */
export const DIRECTOR_MODELS = Object.freeze({ fast: "claude-haiku-5-5", strong: "claude-sonnet-5-5" });
export const DIRECTOR_MAX_TOKENS = 16000; // the first try's ceiling (DIRECTOR_LIMITS below)

export const DIRECTOR_SYSTEM = `You are the STORY DIRECTOR of "Blocky Worlds": 1-2 minute vertical story videos, narrated by a kid, set in an original blocky toy-like 3D world (realistic game-engine look: chunky blocky people, CC0 textures, warm sun, phone-at-street-level camera). A rendering engine builds every shot from your PRODUCTION LIST, so you decide what must exist on screen.

THE PERMANENT RULE: the scene always matches the narration. Every line's key nouns, its action and its subject (who or what the line is about) must be visible in that line's shot. Read for MEANING, not words: "the shell cracked" in a story about a town on a turtle means the giant turtle; "they" means whoever the last lines were about; "the whole town ran" is a crowd of townsfolk running.

THE WORLD CONTINUITY RULE (permanent): a story feels real only in ONE consistent world. Decide that world FIRST (the "bible" field), then put every line in it. Never a different street, map or building style mid-story. Inside the town you still feel you are on the creature (the shell edge, its head or neck in the background, the ground tilting as it walks); outside, wide shots always show that same town on its back.

WHAT YOU WRITE
- bible (write it first): creature_look (the host creature's colours and back: "mossy green shell with brown plates"; "" if no creature), town_name (an original name), building_style (one look for every building: "white timber houses with red tile roofs"), palette (3-6 colour words), streets (2-3 street names), places ({ name, kind }: the named buildings the story uses, kind home | school | market | hall | shop | landmark), landmarks (the town's fixed sights: "the bell tower", "the lookout at the shell edge"). The engine builds one seeded town from it and every shot stands in it.
- worlds: every place the story happens. kind: outdoor | indoor | enclosed (a cave, a room inside something, a fridge) | creature (the town is ON, INSIDE or right OUTSIDE a giant creature) | underwater | space | sky. base: the nearest hand-built set (street, woods, bedroom, school) used if the place cannot be built. creature: { species, relation: inside | on | outside | none, heightM }. A video may move between worlds (inside the turtle, then on the beach outside it): list each, and put every line in one.
- cast: every person or person-like character that appears (not crowds). id "me" is the narrator (role narrator). kind human | robot | animal | creature | object (a talking object); role kid | adult | elder | baby; look: 3-10 words of visual hints (clothes, colours, one feature); job if it matters to the picture ("dentist"); species: the animal of a kind "animal" member ("dog", "cat", "pigeon"; "" for everyone else).
- ANIMALS, TWO WAYS. (1) A NORMAL-SIZE animal character (a pet, a named or recurring animal: "my dog Biscuit got lost", "our cat Pepper on the roof") goes in CAST: kind "animal", species ("dog"), a name, look = its fixed look ("little brown dog, red collar, silver bell"). It is drawn at real size (dog ~0.8 m, cat ~0.5 m, pigeon ~0.3 m), keeps that one look in every shot, and is the line's subject when it acts ("Biscuit ran away", "the cat climbed onto the roof", "He sniffed the ground" after a Biscuit line): put its id in subject and who, its verb in action (run, walk, sit, sniff, bark, sleep, climb, hop, fly, eat, dig). An unnamed one-off animal at normal size ("a pigeon landed next to her") goes in creatures with scale small or human. (2) A GIANT animal (a town on a turtle, a wolf taller than the hill) goes in creatures with scale giant / colossal and heightM; only when the script makes it huge.
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

STYLE (learned from a viral video of exactly this format; docs/blocky-worlds-protocol.md section 8)
- The creature is the subject. In a creature-world story the giant (with its town visibly ON it) is in most lines' needs; give every line that does not name a person the creature as its subject. Ask for scaleMoments often: the giant next to houses, people or trees.
- A rival giant is the same size class as the hero creature (1.0-1.3x its heightM), never 3x.
- Every verb is an action on screen: lunged, clamped, fired, snapped, grabbed, climbed, blew are each the line's action (camera "action"), never a sign or card.
- The threat arrives as a reveal ladder: far and small first, then a close of its eyes (camera "reveal"), then what it carries (its city / army), then what they do. In an attack, follow every attacker line with the victim's consequence (the town shakes, houses fall, people slide).
- "Me" is my world: the narrator is on screen in only 1-2 lines of the "me" part; the rest is a tour of the creature, its town and its routine. When the narrator is on screen later they are doing something (asleep, running, climbing, blowing), never posing.
- Daylight is the default (light "day"), even for the crisis ("one morning"). Night only for threat lore; "warm" for the ending.
- The climax is a reaction chain: the hero uses the planted story prop (with an effect), then one line per giant reaction, then the physical resolution, then an affection beat; end on a visual gag between the two creatures.
- The camera follows general rules and the engine's shot library (push, track, fly over, low hero, close on a body part), chosen for each line's meaning; never copy another video's shots one for one.
- Worlds are dense: ask for the landscape the creature walks through (forest, trees it eats, rocks, dust) and the town's named places (school, grocery, hospital) as props or a landmark.

${storyPatternsForPrompt()}

WHAT THE ENGINE CAN DO TODAY (status in the matcher; ask for the story's needs either way):
${registryForPrompt()}

Return only the JSON object.`;

/** the user message: the idea card + the numbered script (or the card's fields as lines when there is no script yet) */
export function directorPrompt({ lines, idea = null, feedback = null }) {
  // the user's own typed topic (card.topic, 2026-11-06): its world, characters and villain ("a big bad wolf with an
  // army") are what the user asked to see, so they lead the list even where the script only hints at them
  const topic = idea?.topic ? `THE USER'S TOPIC (what they typed: its world, characters and villain must be on screen where the story is about them)\n"${String(idea.topic).replace(/\s+/g, " ").trim().slice(0, 300)}"\n\n` : "";
  const card = idea ? `${topic}THE IDEA CARD\n${JSON.stringify({ title: idea.title, opener: idea.opener, premise: idea.premise, setting: idea.setting, narrator: idea.narrator, prop: idea.prop, twist: idea.twist, mood: idea.mood })}\n\n` : "";
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
  const system = tokensOf(DIRECTOR_SYSTEM_JSON) + 40; void schema; // the plain-JSON system prompt carries the shape (no format)
  const user = tokensOf(directorPrompt({ lines, idea }));
  const answer = outputJson ? tokensOf(typeof outputJson === "string" ? outputJson : JSON.stringify(outputJson), true) : 60 * lines.length + 600;
  return { system, user, input: system + user, output: Math.ceil(answer * 1.25), answer };
}

/** USD of a call: the system part as a cache write (first call) or read (later calls within 5 minutes) */
export function callUsd(model, { system, user, output }, { cached = false } = {}) {
  const p = PRICE[model] ?? PRICE["claude-sonnet-5-5"];
  return ((cached ? system * p.cacheRead : system * p.cacheWrite) + user * p.input + output * p.output) / 1e6;
}

/**
 * The schema sent to the API: the production list's shape without its enum lists. The full schema with every enum
 * compiled into a grammar too large for structured outputs ("The compiled grammar is too large", every call refused in
 * the first stress run, 2026-11-05); the allowed values are in the system prompt, and validateProduction checks and
 * repairs them after the reply.
 */
export function apiSchema(schema = productionSchema()) {
  const strip = (x) => {
    if (Array.isArray(x)) return x.map(strip);
    if (!x || typeof x !== "object") return x;
    const out = {};
    for (const [k, v] of Object.entries(x)) if (k !== "enum") out[k] = strip(v);
    return out;
  };
  return strip(schema);
}
const GRAMMAR_TOO_LARGE = /compiled grammar is too large|grammar/i;

/**
 * The production list's shape in one compact line (keys, nested lists, enum values inline as a|b|c), for the plain-JSON
 * path: no structured output, so the model needs the shape in words. Built once from productionSchema() (byte-stable:
 * it is part of the cached system prompt).
 */
export function schemaShape(schema = productionSchema(), maxEnum = 30) {
  const shape = (x) => {
    if (!x || typeof x !== "object") return "?";
    if (x.enum) return `"${x.enum.length > maxEnum ? `${x.enum.slice(0, maxEnum).join("|")}|...` : x.enum.join("|")}"`;
    if (x.type === "array") return `[${shape(x.items)}]`;
    if (x.type === "object") return `{${Object.entries(x.properties ?? {}).map(([k, v]) => `"${k}":${shape(v)}`).join(",")}}`;
    return x.type === "number" ? "num" : x.type === "boolean" ? "bool" : "str";
  };
  return shape(schema);
}
/** the plain-JSON system prompt: the director's prompt + the shape + "JSON only" (cached as one block) */
export const DIRECTOR_SYSTEM_JSON = `${DIRECTOR_SYSTEM}

ANSWER FORMAT: one JSON object of exactly this shape (str = text, num = number, [x] = a list of x, "a|b" = one of those words; every key present, [] or "" when empty):
${schemaShape()}
Return only the JSON object: no prose, no code fence.`;

/**
 * Output ceilings (thinking included). Haiku 5.5 at effort "low" measured 2026-11-07: 4,628-6,258 output tokens on a
 * first try (1,073-1,601 thinking), but the turtle RETRY thought 7,178 tokens and hit the old 12,000 ceiling (cut off,
 * 45 s, paid for nothing). So: a roomier first try, and the retry (a repair of a listed problem) runs WITHOUT thinking
 * (Haiku 5.5 accepts thinking "disabled" at effort high or below), which is both faster and bounded.
 */
export const DIRECTOR_LIMITS = Object.freeze({ first: 16000, retry: 10000 });

/**
 * structured: false (default since 2026-11-07): every structured try answered a free 400 "compiled grammar is too large"
 * (both test runs, every call) and was re-sent as plain JSON, so the plain-JSON path is the one that runs, straight away.
 * structured: true keeps the old try-then-fall-back path (if a smaller schema ever fits the grammar limit).
 */
export function anthropicDirector({ apiKey, model = DIRECTOR_MODELS.fast, fetchFn = fetch, effort = "low", timeoutMs = 120000, structured = false } = {}) {
  if (!apiKey) throw new Error("anthropicDirector: no apiKey");
  const sonnet = model.startsWith("claude-sonnet-5-5"), haiku = model.startsWith("claude-haiku");
  const P = PRICE[model] ?? PRICE["claude-sonnet-5-5"];
  return {
    model,
    worstCase: () => Number(((DIRECTOR_LIMITS.first * P.output + 12000 * P.cacheWrite) / 1e6).toFixed(5)),
    async direct({ lines, idea = null, feedback = null }) {
      const t0 = Date.now();
      // a retry (feedback given) is a repair: no thinking on Haiku, a smaller ceiling
      const repair = Boolean(feedback?.length) && haiku;
      const send = (asStructured) => fetchFn("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json", ...(sonnet ? { "anthropic-beta": "server-side-fallback-2026-07-01" } : {}) },
        body: JSON.stringify({
          model, max_tokens: repair ? DIRECTOR_LIMITS.retry : DIRECTOR_LIMITS.first,
          system: [{ type: "text", text: asStructured ? DIRECTOR_SYSTEM : DIRECTOR_SYSTEM_JSON, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content: directorPrompt({ lines, idea, feedback }) }],
          ...(repair ? { thinking: { type: "disabled" } } : {}),
          output_config: asStructured ? { effort, format: { type: "json_schema", schema: apiSchema() } } : { effort },
          ...(sonnet ? { fallbacks: "default" } : {}),
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      let res = await send(structured);
      let body = await res.json().catch(() => null);
      if (structured && res.status === 400 && GRAMMAR_TOO_LARGE.test(JSON.stringify(body?.error ?? ""))) { res = await send(false); body = await res.json().catch(() => null); }
      const costUsd = costOf(body?.model ?? model, body?.usage);
      const base = { costUsd, usage: body?.usage ?? null, ms: Date.now() - t0, model: body?.model ?? model };
      if (!res.ok) throw Object.assign(new Error(`anthropic ${res.status} ${JSON.stringify(body?.error ?? body).slice(0, 300)}`), base, { balance: res.status === 400 && /credit balance/i.test(JSON.stringify(body?.error ?? "")) });
      if (body?.stop_reason === "refusal") throw Object.assign(new Error("REFUSED"), base, { refused: true });
      if (body?.stop_reason === "max_tokens") throw Object.assign(new Error("output truncated"), base);
      const text = (body?.content ?? []).filter((b) => b?.type === "text").map((b) => b.text).join("");
      const json = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      try { return { data: JSON.parse(json), ...base }; } catch { throw Object.assign(new Error("the reply was not JSON"), base); }
    },
  };
}
