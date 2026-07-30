// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const OPENAI_RESPONSES = "https://api.openai.com/v1/responses";
const OPENAI_RESEARCH_TIMEOUT_MS = 25_000;
const OPENAI_PLAN_TIMEOUT_MS = 20_000;

// V2/V3/V4 quality tiers — same Nano Banana 2 engine at 1K/2K/4K (9:16).
// Must mirror src/components/viral-tools/two-am/api/twoAmApi.js's
// IMAGE_QUALITY_TIERS (Deno functions can't import from src/lib at runtime).
// The requested tier is clamped to the caller's actual plan_code below —
// this edge function is the trusted enforcement point since it resolves
// plan_code from the DB itself, not from client input.
const QUALITY_TIERS: Record<string, { toolKey: string; width: number; height: number; creditsPerImage: number; minPlan: string }> = {
  "twoam-v2": { toolKey: "image:twoam1k", width: 384, height: 688, creditsPerImage: 5, minPlan: "starter" },
  "twoam-v3": { toolKey: "image:twoam2k", width: 768, height: 1376, creditsPerImage: 7, minPlan: "pro" },
  "twoam-v4": { toolKey: "image:twoam4k", width: 1536, height: 2752, creditsPerImage: 10, minPlan: "generative" },
};
const DEFAULT_QUALITY = "twoam-v2";
const PLAN_TIER_ORDER = ["free", "starter", "pro", "generative"];

function planTierIndex(planCode: string) {
  const idx = PLAN_TIER_ORDER.indexOf(String(planCode ?? "").toLowerCase().trim());
  return idx === -1 ? 0 : idx;
}

// Clamps the client-requested tier down to the highest one the user's plan
// actually allows — mirrors the pattern used for every other viral tool's
// V2/V3/V4 video tiers this quarter (UI lock is cosmetic only; this is the
// real gate).
function resolveQualityTier(requested: string, planCode: string) {
  const userTier = planTierIndex(planCode);
  const candidate = QUALITY_TIERS[requested] ? requested : DEFAULT_QUALITY;
  if (planTierIndex(QUALITY_TIERS[candidate].minPlan) <= userTier) return candidate;
  // Requested tier isn't allowed — fall back to the highest tier that is.
  const order = ["twoam-v4", "twoam-v3", "twoam-v2"];
  return order.find((id) => planTierIndex(QUALITY_TIERS[id].minPlan) <= userTier) ?? DEFAULT_QUALITY;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...CORS, "Content-Type": "application/json" },
});

const SCENE_FAMILIES = [
  "sleeping", "bedroom", "quiet conversation", "late night snack", "empty city",
  "rooftop", "forest", "beach", "train station", "vehicle", "hideout",
  "hospital or healing center", "hallway", "school", "restaurant", "street",
  "viewpoint", "training", "secret room", "campfire", "rain", "window scene",
  "night shift", "characters wandering", "characters asleep", "creatures wandering",
  "background character moment", "iconic landmark",
];

function normalizeKey(value: string) {
  return value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 100);
}

function planPriority(planCode: string) {
  if (planCode === "generative" || planCode === "affiliate") return 1;
  if (planCode === "pro") return 2;
  if (planCode === "starter") return 3;
  return 9;
}

function extractOutputText(payload: any) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  for (const item of payload?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (typeof content?.text === "string") return content.text;
    }
  }
  return "";
}

function parseJson(raw: string) {
  const clean = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(clean);
}

function fallbackWorld(prompt: string, style: string) {
  const lower = prompt.toLowerCase();
  const isChensIsland = (/\bchen'?s?\b/.test(lower) && lower.includes("island")) ||
    lower.includes("tournament of elements");
  const known = isChensIsland
    ? {
      franchise: "Ninjago",
      era: "Season 4: Tournament of Elements",
      medium: "animated LEGO series",
      visualStyle: "faithful Season 4 LEGO Ninjago cinematic animation",
      locations: [
        "Chen's Palace guest quarters",
        "Elemental Masters' sleeping quarters",
        "Chen's Royal Arena",
        "palace dining hall and noodle room",
        "underground noodle factory",
        "Chen's Island jungle paths",
      ],
      characters: [
        "Kai", "Jay", "Cole", "Lloyd", "Zane", "Master Chen", "Clouse", "Skylor",
        "Karlof", "Griffin Turner", "Shade", "Neuro", "Tox", "Paleman", "Bolobo",
        "Gravis", "Jacob", "Chamille",
      ],
      architecture: [
        "red-and-gold island palace built into a lush volcanic jungle",
        "Tournament of Elements arena and tiled guest chambers",
        "industrial underground noodle factory and hidden passages",
      ],
      recurringProps: ["Jadeblades", "Tournament of Elements banners", "noodle crates", "Chen's ornate staff"],
      canonSummary: "Chen's Island during Ninjago Season 4, where the ninja and invited Elemental Masters stay for Chen's Tournament of Elements while Zane is secretly held on the island.",
      sceneOpportunities: [
        "each ninja resting separately in an individual palace guest chamber",
        "Elemental Masters asleep or quietly awake in their own quarters",
        "Master Chen and Clouse awake elsewhere in the palace",
        "Skylor moving through the palace after midnight",
        "Zane in the hidden underground factory or holding area",
        "an empty arena or jungle path under moonlight",
      ],
    }
    : lower.includes("alola") || lower.includes("pokemon")
    ? {
      franchise: "Pokemon",
      era: lower.includes("alola") ? "Sun & Moon / Alola" : null,
      medium: "anime",
      visualStyle: "faithful clean cel-shaded Pokemon anime",
      locations: ["Pokemon Center", "quiet town street", "forest trail", "bedroom", "coastal viewpoint", "camp"],
      characters: ["Ash Ketchum", "Pikachu's trainer", "Nurse Joy", "Professor Kukui", "Officer Jenny"],
      creatures: ["Pikachu", "Eevee", "Snorlax", "Charizard", "Meowth", "Psyduck", "Rowlet", "Jigglypuff"],
      recurringProps: ["Poke Balls", "a red-roofed Pokemon Center", "a Pokedex", "a trainer backpack"],
    }
    : lower.includes("ninjago") || /\bkai\b/.test(lower)
    ? {
      franchise: "Ninjago",
      era: null,
      medium: "animated LEGO series",
      visualStyle: "faithful LEGO Ninjago cinematic animation",
      locations: ["monastery", "Ninjago City", "training hall", "rooftop", "vehicle bay", "quiet corridor"],
      characters: ["Kai", "Jay", "Cole", "Zane", "Lloyd", "Nya", "Sensei Wu"],
      creatures: [],
      recurringProps: ["elemental ninja masks", "golden weapons", "Ninjago dragons"],
    }
    : lower.includes("naruto")
    ? {
      franchise: "Naruto",
      era: lower.includes("shippuden") ? "Shippuden" : null,
      medium: "anime",
      visualStyle: "faithful Naruto anime cel animation",
      locations: ["Hidden Leaf street", "training ground", "ramen shop", "hospital hallway", "rooftop", "forest path"],
      characters: ["Naruto Uzumaki", "Sasuke Uchiha", "Sakura Haruno", "Kakashi Hatake"],
      creatures: ["Nine-Tailed Fox chakra aura", "ninja summon animals"],
      recurringProps: ["forehead protector with the Hidden Leaf symbol", "kunai and shuriken pouch", "orange jumpsuit"],
    }
    : { franchise: prompt, era: null, medium: style === "anime" ? "anime" : "cinematic", visualStyle: style === "realistic" ? "cinematic realism" : style === "dreamcore" ? "soft dreamcore" : style === "cinematic" ? "cinematic source-accurate imagery" : "faithful source-accurate visual language", locations: ["bedroom", "quiet street", "iconic landmark", "rooftop", "hallway", "viewpoint"] };

  return {
    world: prompt,
    medium: known.medium,
    visualStyle: known.visualStyle,
    architecture: known.architecture ?? ["recognizable canonical architecture", "era-accurate interiors"],
    locations: known.locations,
    characters: known.characters ?? [],
    creatures: known.creatures ?? [],
    recurringProps: known.recurringProps ?? [],
    nightMood: ["moonlight", "warm interior lights", "quiet 2 AM atmosphere", "empty paths"],
    nightPalette: "deep indigo shadows, muted blue moonlight, small pools of warm amber light",
    era: known.era,
    franchise: known.franchise,
    anchorCharacter: /\bkai\b/.test(lower) ? "Kai" : null,
    canonSummary: known.canonSummary ?? `A source-faithful 2 AM visit to ${known.franchise || prompt}.`,
    sceneOpportunities: known.sceneOpportunities ?? known.locations,
    confidence: 0.55,
  };
}

function fallbackScenes(worldBible: any, seed: string) {
  if (worldBible.franchise === "Ninjago" && String(worldBible.era).includes("Tournament of Elements")) {
    return [
      { title: "Kai's guest chamber at 2 AM", family: "sleeping", location: "Kai's private palace guest chamber", characters: ["Kai"], activity: "sleeping after the tournament beneath a folded red ninja outfit", lighting: "cool island moonlight through lattice windows and one dim amber lantern" },
      { title: "Jay's guest chamber at 2 AM", family: "bedroom", location: "Jay's private palace guest chamber", characters: ["Jay"], activity: "resting alone while distant machinery hums below the palace", lighting: "soft blue moonlight with a faint warm bedside lantern" },
      { title: "Cole and Lloyd's separate rooms at 2 AM", family: "window scene", location: "adjacent private palace guest chambers divided by a corridor", characters: ["Cole", "Lloyd"], activity: "shown in a split-depth composition, each asleep in his own distinct room", lighting: "indigo corridor shadows and separate pools of warm interior light" },
      { title: "Elemental Masters' quarters at 2 AM", family: "characters asleep", location: "Elemental Masters' sleeping wing", characters: ["Karlof", "Griffin Turner", "Neuro", "Tox"], activity: "sleeping or quietly settling into separate bunks and alcoves after the tournament", lighting: "low lantern light with jungle moonlight crossing the tiled floor" },
      { title: "Chen and Clouse after midnight", family: "secret room", location: "Master Chen's private palace chamber", characters: ["Master Chen", "Clouse"], activity: "whispering over the tournament plan while the island sleeps", lighting: "dramatic red-and-gold practical light surrounded by deep shadows" },
      { title: "Zane beneath Chen's Island", family: "hideout", location: "hidden underground noodle factory holding area", characters: ["Zane", "Skylor"], activity: "Zane waits in captivity as Skylor passes through the machinery level", lighting: "cold industrial light, small amber warning lamps, and deep factory shadows" },
    ].map((scene, index) => ({ id: crypto.randomUUID(), order: index + 1, ...scene }));
  }

  const locations = worldBible.locations?.length ? worldBible.locations : ["bedroom", "street", "rooftop", "hallway", "forest", "viewpoint"];
  const activities = ["resting after a long day", "walking quietly", "sharing a late-night snack", "looking through a window", "finishing a night shift", "watching the moon"];
  const identifiers = [
    ...(Array.isArray(worldBible.creatures) ? worldBible.creatures : []),
    ...(Array.isArray(worldBible.characters) ? worldBible.characters : []),
  ].filter(Boolean);
  return Array.from({ length: 6 }, (_, index) => {
    const location = locations[index % locations.length];
    const family = SCENE_FAMILIES[(index * 5 + seed.charCodeAt(index % seed.length)) % SCENE_FAMILIES.length];
    const title = `${location} at 2 AM`;
    const characters = identifiers.length ? [identifiers[index % identifiers.length]] : [];
    return { id: crypto.randomUUID(), order: index + 1, title, family, location, characters, activity: activities[index], lighting: index % 2 ? "warm practical lights against blue moonlight" : "soft moonlight with deep indigo shadows" };
  });
}

function styleDirective(style: string) {
  switch (style) {
    case "anime":
      return "VISUAL DIRECTION — ANIME ACCURATE: Strict 2D cel-shaded anime art style with hand-drawn animation linework and flat cel shading. Not photorealistic, not 3D rendered.";
    case "realistic":
      return "VISUAL DIRECTION — REALISTIC: Photorealistic live-action cinematography. True-to-life textures, lighting and anatomy, shot like a real photograph or film still. Not illustrated, not animated, not cel-shaded.";
    case "dreamcore":
      return "VISUAL DIRECTION — DREAMCORE: Hazy, surreal, liminal-space atmosphere with a soft glow and gentle blur. Slightly uncanny dreamlike quality, muted washed-out color grade.";
    case "cinematic":
      return "VISUAL DIRECTION — CINEMATIC: Dramatic film-still composition with anamorphic lens character, bold color grading and directional lighting like a blockbuster movie frame.";
    default:
      return "";
  }
}

function nostalgiaDirective(nostalgia: number) {
  const value = Number(nostalgia);
  if (!Number.isFinite(value)) return "";
  if (value <= 0.25) return "NOSTALGIA INTENSITY — SUBTLE: Mostly clean and grounded. Only a faint nostalgic warmth, minimal haze or grain.";
  if (value <= 0.5) return "NOSTALGIA INTENSITY — LIGHT: A gentle nostalgic glow and warmth without overwhelming the scene.";
  if (value <= 0.75) return "NOSTALGIA INTENSITY — STRONG: Noticeably warm nostalgic haze, soft glow, faint film grain, memory-like softness.";
  return "NOSTALGIA INTENSITY — DREAMLIKE: Deeply nostalgic, hazy soft-focus glow, heavy warm film grain, blurred memory-like quality, emotionally overwhelming wistful atmosphere.";
}

function recognizabilityDirective(worldBible: any, sceneCharacters: string[]) {
  if (sceneCharacters.length) return "";
  const pool = [
    ...(Array.isArray(worldBible?.creatures) ? worldBible.creatures : []),
    ...(Array.isArray(worldBible?.characters) ? worldBible.characters : []),
    ...(Array.isArray(worldBible?.recurringProps) ? worldBible.recurringProps : []),
    ...(Array.isArray(worldBible?.architecture) ? worldBible.architecture : []),
  ].filter(Boolean);
  if (!pool.length) return "";
  return `RECOGNIZABILITY REQUIREMENT: This scene was not assigned a named character, so it must instead include at least one other instantly recognizable, unmistakable signal of this exact source material — a canonical creature/species, a signature recurring prop, or an iconic building/landmark. Pull from: ${pool.slice(0, 10).join(", ")}. A fan glancing at this image for one second must recognize the franchise immediately. Never produce a generic frame that could belong to any other anime, game or franchise.`;
}

function buildImagePrompt(
  worldBible: any,
  scene: any,
  settings: any = {},
  sceneDetail = "",
  excludedSceneDetails: string[] = [],
) {
  const sceneCharacters = Array.isArray(scene.characters) ? scene.characters.filter(Boolean) : [];
  return [
    "Vertical 9:16 portrait. Create one frame from a nostalgic 2AM slideshow.",
    `WORLD BIBLE: ${JSON.stringify(worldBible)}`,
    `SCENE: ${scene.title}. ${scene.activity}.`,
    `LOCATION: ${scene.location}.`,
    `CHARACTERS: ${sceneCharacters.join(", ") || "natural world-appropriate background characters only when useful"}.`,
    sceneCharacters.length
      ? `Every character named above must be clearly visible, unmistakably identifiable by their signature colors, costume and design, and prominent in the composition — not a tiny, ambiguous, or obscured background figure.`
      : "",
    `LIGHTING: ${scene.lighting}. Approximately 2 AM.`,
    "Mood: quiet, nostalgic, cozy, intimate, slightly liminal, beautiful and emotionally familiar.",
    styleDirective(settings?.style),
    nostalgiaDirective(settings?.nostalgia),
    recognizabilityDirective(worldBible, sceneCharacters),
    "Maintain faithful character appearance, canonical clothing, world architecture, props, medium and era. This must look like an authentic frame from that universe, never generic AI artwork.",
    "Characters behave naturally and do not pose for the viewer. Strong foreground/background depth, clean composition, high detail, optimized for a vertical TikTok or Reels slideshow.",
    sceneDetail
      ? `MANDATORY REQUEST FOR THIS ONE FRAME ONLY: ${sceneDetail}. Satisfy it clearly in this frame, but do not treat it as a recurring world detail and do not copy it into any other scene.`
      : "",
    excludedSceneDetails.length
      ? `RESERVED FOR OTHER FRAMES — DO NOT SHOW IN THIS FRAME: ${excludedSceneDetails.join(" | ")}.`
      : "",
    "No captions. No text. No logos. No watermark. Full-bleed vertical 9:16 portrait frame edge-to-edge, no letterboxing, no pillarboxing, no borders.",
  ].filter(Boolean).join("\n");
}

const RESEARCH_INSTRUCTIONS = `You are a canon researcher for a visual scene generator. Resolve the exact subject in the user's phrase before doing anything else. A named island, city, arc, season, episode, character, faction, or misspelled alias is more specific than the overall franchise and must never be discarded.

Search for the exact phrase and its relationship to the franchise. Produce concise factual research notes, not JSON. Identify: franchise; exact season/arc/era; what the named place is; who is actually there during that era; character designs and clothing; architecture; rooms or plausible sleeping accommodations; landmarks; props; creatures; visual medium; and six distinct nighttime scene opportunities. Clearly distinguish canonical facts from reasonable visual extrapolations. Do not replace a specific place with generic franchise landmarks.

For example, "Chen's Island in Ninjago" resolves to Season 4 / Tournament of Elements, Chen's palace and arena, its jungle and underground factory, the participating ninja, Master Chen, Clouse, Skylor, Zane, and the invited Elemental Masters—not the generic monastery or Ninjago City.`;

const PLANNER_INSTRUCTIONS = `You are Zyvo's Viral 2AM Scene Director. Use the supplied canon research as the source of truth and return a strict structured plan for exactly six visually distinct moments from one coherent night at approximately 2 AM.

The most specific named place, season, arc, or era in the user input controls the entire set. Never fall back to generic franchise landmarks. If the request names an island, palace, school, ship, city, or other bounded setting, all six scenes must occur within or immediately around it. Make the night feel inhabited: private bedrooms or guest quarters, sleeping characters, awake characters, corridors, staff, villains, hidden spaces, and exterior landmarks can all appear when appropriate. Keep canonical character appearance, era, architecture, props, medium, and one shared night palette.

Use all six slides to tell a varied night. Do not clone the same subject or action across every scene. When the concept implies an ensemble staying at a location, distribute named characters across distinct rooms and activities. A request such as Chen's Island should use Tournament of Elements participants and island locations: individual ninja guest rooms where plausible, separate Elemental Masters' quarters, Chen/Clouse elsewhere, Skylor, Zane's hidden location, the arena, factory, palace, or jungle. Plausible unseen bedrooms are allowed as visual extrapolations, but they must use the canonical location's design language.

Every single one of the six scenes — with no exceptions — must include at least one instantly recognizable, unmistakable signal of the exact source material: a named canon character, a canonical creature or species, or a clearly identified iconic prop or landmark from the world bible. A scene with an empty characters list and only generic scenery (an unnamed street, an unnamed beach, an unnamed forest) is a failure — it could belong to any franchise and a fan would not recognize it. For a franchise built around specific creatures (for example Pokemon), populate worldBible.creatures with several of that franchise's actual named creatures and put at least one of them in the characters list of most scenes, even in quiet or scenic moments — a Pokemon sleeping on the bed, perched outside a window, or resting by a campfire is exactly the kind of detail that makes the scene recognizable. Never submit a worldBible with an empty creatures array for a franchise whose most iconic elements are its creatures.

Each advanced scene slot is a separate one-scene request. Assign every slot to exactly one different scene. Never turn a slot's character, prop, location, or action into a recurring detail in the other scenes.`;

const PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["entity", "worldBible", "scenes"],
  properties: {
    entity: {
      type: "object",
      additionalProperties: false,
      required: ["franchise", "era", "world", "anchorCharacter", "medium", "visualEra", "confidence"],
      properties: {
        franchise: { type: ["string", "null"] },
        era: { type: ["string", "null"] },
        world: { type: "string" },
        anchorCharacter: { type: ["string", "null"] },
        medium: { type: ["string", "null"] },
        visualEra: { type: ["string", "null"] },
        confidence: { type: "number" },
      },
    },
    worldBible: {
      type: "object",
      additionalProperties: false,
      required: ["world", "medium", "visualStyle", "architecture", "locations", "characters", "creatures", "recurringProps", "nightMood", "nightPalette", "era", "franchise", "anchorCharacter", "canonSummary", "sceneOpportunities", "confidence"],
      properties: {
        world: { type: "string" },
        medium: { type: "string" },
        visualStyle: { type: "string" },
        architecture: { type: "array", items: { type: "string" } },
        locations: { type: "array", items: { type: "string" } },
        characters: { type: "array", items: { type: "string" } },
        creatures: { type: "array", items: { type: "string" } },
        recurringProps: { type: "array", items: { type: "string" } },
        nightMood: { type: "array", items: { type: "string" } },
        nightPalette: { type: "string" },
        era: { type: ["string", "null"] },
        franchise: { type: ["string", "null"] },
        anchorCharacter: { type: ["string", "null"] },
        canonSummary: { type: "string" },
        sceneOpportunities: { type: "array", items: { type: "string" } },
        confidence: { type: "number" },
      },
    },
    scenes: {
      type: "array",
      minItems: 6,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "family", "location", "characters", "activity", "lighting"],
        properties: {
          title: { type: "string" },
          family: { type: "string" },
          location: { type: "string" },
          characters: { type: "array", items: { type: "string" } },
          activity: { type: "string" },
          lighting: { type: "string" },
        },
      },
    },
  },
};

function researchInput(prompt: string, settings: any) {
  return `Research this exact 2AM world request: "${prompt}". Visual direction: ${settings.style || "auto"}. Resolve every named place, season, arc, and character before describing the wider franchise.`;
}

function plannerInput(prompt: string, settings: any, seed: string, researchNotes: string, sceneDirectives: string[]) {
  const advancedSlots = sceneDirectives.length
    ? sceneDirectives.map((directive, index) => `${index + 1}. ${directive}`).join("\n")
    : "none";
  return `USER INPUT: ${prompt}\nVISUAL DIRECTION: ${settings.style || "auto"}\nNOSTALGIA: ${settings.nostalgia ?? 0.7}\nRANDOM SEED: ${seed}\n\nCANON RESEARCH / CACHED WORLD:\n${researchNotes}\n\nSCENE FAMILIES TO CHOOSE FROM: ${SCENE_FAMILIES.join(", ")}\nADVANCED SCENE SLOTS:\n${advancedSlots}\n\nMake all six scenes materially different. Preserve the exact requested setting and era in every scene. Do not put image prompts in scenes; the server adds them.`;
}

async function callOpenAI(request: any, timeoutMs: number) {
  const response = await fetch(OPENAI_RESPONSES, {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${(await response.text()).slice(0, 500)}`);
  return response.json();
}

function planResolvesSpecificSubject(prompt: string, plan: any) {
  if (!plan?.worldBible || !Array.isArray(plan?.scenes) || plan.scenes.length !== 6) return false;
  const lower = prompt.toLowerCase();
  const planned = JSON.stringify(plan).toLowerCase();
  if ((/\bchen'?s?\b/.test(lower) && lower.includes("island")) || lower.includes("tournament of elements")) {
    return planned.includes("chen") &&
      (planned.includes("tournament of elements") || planned.includes("season 4")) &&
      planned.includes("island");
  }
  return true;
}

function referenceResolvesSpecificSubject(prompt: string, reference: any) {
  const lower = prompt.toLowerCase();
  const serialized = JSON.stringify(reference ?? {}).toLowerCase();
  if ((/\bchen'?s?\b/.test(lower) && lower.includes("island")) || lower.includes("tournament of elements")) {
    return serialized.includes("chen") &&
      serialized.includes("island") &&
      (serialized.includes("tournament of elements") || serialized.includes("season 4"));
  }
  return true;
}

function cleanSceneDirective(value: string) {
  return value
    .replace(/^\s*(?:and\s+)?(?:make|create|include|show|add|please)\s+/i, "")
    .replace(/^\s*(?:at\s+least\s+)?(?:one|1)\s+(?:scene|image|slide)\s+(?:with|of|showing)?\s*/i, "")
    .replace(/^\s*(?:a|an)\s+scene\s+(?:with|of|showing)?\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCustomSceneDirectives(value: string): string[] {
  const normalized = value.replace(/\r/g, "\n").trim();
  if (!normalized) return [];

  const hardParts = normalized.split(/\n+|;+/).map((part) => part.trim()).filter(Boolean);
  const parts = hardParts.flatMap((part) => {
    const commaParts = part.split(/\s*,\s*/).filter(Boolean);
    const eachLooksLikeScene = commaParts.length > 1 && commaParts.every((chunk) =>
      (chunk.match(/[a-z0-9]+/gi) ?? []).length >= 2
    );
    return eachLooksLikeScene ? commaParts : [part];
  });

  return parts.map(cleanSceneDirective).filter(Boolean).slice(0, 6);
}

function assignCustomSceneDirectives(scenes: any[], directives: string[], seed: string) {
  const assignments = new Map<number, string>();
  if (!directives.length || !scenes.length) return assignments;
  const ignored = new Set(["with", "from", "that", "this", "have", "make", "scene", "scenes", "image", "images", "slide", "slides", "least", "only"]);
  const offset = Array.from(seed).reduce((total, character) => total + character.charCodeAt(0), 0) % scenes.length;
  const available = new Set(scenes.map((_, index) => index));

  directives.forEach((directive, directiveIndex) => {
    const tokens = directive.toLowerCase().match(/[a-z0-9]+/g)
      ?.filter((token) => token.length > 2 && !ignored.has(token)) ?? [];
    const ranked = scenes
      .map((scene, index) => {
        const searchable = [
          scene?.title,
          scene?.family,
          scene?.location,
          scene?.activity,
          ...(Array.isArray(scene?.characters) ? scene.characters : []),
        ].filter(Boolean).join(" ").toLowerCase();
        const score = tokens.reduce((total, token) => total + (searchable.includes(token) ? 1 : 0), 0);
        const tieBreak = (index - offset - directiveIndex + scenes.length * 2) % scenes.length;
        return { index, score, tieBreak };
      })
      .filter((entry) => available.has(entry.index))
      .sort((left, right) => right.score - left.score || left.tieBreak - right.tieBreak);

    const chosen = ranked[0]?.index;
    if (chosen !== undefined) {
      assignments.set(chosen, directive);
      available.delete(chosen);
    }
  });

  return assignments;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authorization = req.headers.get("Authorization") ?? "";
  const token = authorization.replace("Bearer ", "");
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return json({ error: "Unauthorized" }, 401);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });

  const body = await req.json().catch(() => ({}));
  const prompt = String(body.prompt ?? "").trim().slice(0, 240);

  // Resolve plan_code up front (trusted — from the DB, not the client) so the
  // requested quality tier can be clamped before any credits are reserved.
  const { data: earlyProfile } = await admin.from("profiles").select("plan_code").eq("id", user.id).single();
  const planCode = String(earlyProfile?.plan_code ?? "free").toLowerCase();
  const resolvedQuality = resolveQualityTier(String(body?.settings?.quality ?? ""), planCode);
  const tier = QUALITY_TIERS[resolvedQuality];

  const settings = {
    style: ["auto", "anime", "realistic", "dreamcore", "cinematic"].includes(body?.settings?.style) ? body.settings.style : "auto",
    nostalgia: Math.max(0, Math.min(1, Number(body?.settings?.nostalgia ?? 0.7))),
    customInstructions: String(body?.settings?.customInstructions ?? "").trim().slice(0, 800),
    quality: resolvedQuality,
  };
  const customSceneDirectives = parseCustomSceneDirectives(settings.customInstructions);
  if (prompt.length < 2) return json({ error: "Tell us where you are at 2AM." }, 400);

  const seed = crypto.randomUUID();
  const totalCost = tier.creditsPerImage * 6;
  const { data: generation, error: reserveError } = await userClient.rpc("begin_two_am_generation", {
    p_prompt: prompt,
    p_settings: settings,
    p_random_seed: seed,
    p_cost: totalCost,
  });
  if (reserveError) {
    const insufficient = String(reserveError.message).includes("INSUFFICIENT_CREDITS");
    return json({ error: insufficient ? "INSUFFICIENT_CREDITS" : "Could not reserve slideshow credits" }, insufficient ? 402 : 500);
  }

  const normalizedKey = normalizeKey(prompt);
  const { data: cacheRow } = await admin.from("universe_reference_cache")
    .select("reference_json")
    .eq("normalized_key", normalizedKey)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  // Never reuse a low-confidence fallback as a canonical reference. Earlier
  // planner failures could otherwise poison this prompt's cache for 30 days.
  const cachedWorld = cacheRow?.reference_json &&
      Number(cacheRow.reference_json.confidence ?? 0) >= 0.7 &&
      referenceResolvesSpecificSubject(prompt, cacheRow.reference_json)
    ? cacheRow.reference_json
    : null;

  let plan: any = null;
  const deterministicWorld = fallbackWorld(prompt, settings.style);
  if (OPENAI_KEY) {
    let researchNotes = cachedWorld
      ? JSON.stringify(cachedWorld)
      : "";

    if (!researchNotes) {
      try {
        const researchPayload = await callOpenAI({
          model: "gpt-5-mini",
          store: false,
          instructions: RESEARCH_INSTRUCTIONS,
          input: researchInput(prompt, settings),
          tools: [{ type: "web_search", search_context_size: "medium" }],
        }, OPENAI_RESEARCH_TIMEOUT_MS);
        researchNotes = extractOutputText(researchPayload).trim().slice(0, 14_000);
        if (!researchNotes) throw new Error("OpenAI research returned no text");
      } catch (error) {
        const message = String(error);
        if (message.includes("TimeoutError") || message.toLowerCase().includes("timed out")) {
          console.warn("[two-am-planner] canon research timed out; planning from deterministic reference");
        } else {
          console.error("[two-am-planner] canon research fallback:", message);
        }
        researchNotes = JSON.stringify(deterministicWorld);
      }
    }

    try {
      const planningPayload = await callOpenAI({
        model: "gpt-5-mini",
        store: false,
        instructions: PLANNER_INSTRUCTIONS,
        input: plannerInput(prompt, settings, seed, researchNotes, customSceneDirectives),
        text: {
          format: {
            type: "json_schema",
            name: "two_am_scene_plan",
            strict: true,
            schema: PLAN_SCHEMA,
          },
        },
      }, OPENAI_PLAN_TIMEOUT_MS);
      const candidate = parseJson(extractOutputText(planningPayload));
      if (!planResolvesSpecificSubject(prompt, candidate)) {
        throw new Error("Structured plan did not preserve the exact requested subject");
      }
      plan = candidate;
    } catch (error) {
      const message = String(error);
      if (message.includes("TimeoutError") || message.toLowerCase().includes("timed out")) {
        console.warn("[two-am-planner] structured planning timed out; using fallback plan");
      } else {
        console.error("[two-am-planner] structured planning fallback:", message);
      }
    }
  }

  const worldBible = plan?.worldBible && typeof plan.worldBible === "object"
    ? plan.worldBible
    : cachedWorld || deterministicWorld;
  const plannedScenes = Array.isArray(plan?.scenes) && plan.scenes.length === 6
    ? plan.scenes
    : fallbackScenes(worldBible, seed);

  // The planner is instructed to put a named character or creature in every
  // scene, but an LLM can still slip and leave one empty — an empty-character
  // scene reliably renders as generic, unrecognizable scenery (a nameless
  // street, an unbadged garage). Deterministically backfill any gap with a
  // real cast member so every frame is guaranteed to show someone from the
  // actual franchise, not just "suggest" one that the image model may skip.
  const castPool = [
    ...(Array.isArray(worldBible.characters) ? worldBible.characters : []),
    ...(Array.isArray(worldBible.creatures) ? worldBible.creatures : []),
  ].filter(Boolean);
  let castBackfillIndex = 0;
  const rawScenes = plannedScenes.map((scene: any) => {
    const existing = Array.isArray(scene.characters) ? scene.characters.filter(Boolean) : [];
    if (existing.length || !castPool.length) return scene;
    const picked = castPool[castBackfillIndex % castPool.length];
    castBackfillIndex += 1;
    return { ...scene, characters: [picked] };
  });

  const customSceneAssignments = assignCustomSceneDirectives(
    rawScenes,
    customSceneDirectives,
    seed,
  );
  const scenes = rawScenes.slice(0, 6).map((scene: any, index: number) => {
    const userDetail = customSceneAssignments.get(index) ?? "";
    const normalized = {
      id: scene.id || crypto.randomUUID(),
      order: index + 1,
      title: String(scene.title || `Scene ${index + 1}`),
      family: String(scene.family || SCENE_FAMILIES[index]),
      location: String(scene.location || worldBible.locations?.[index] || worldBible.world || prompt),
      characters: Array.isArray(scene.characters) ? scene.characters.map(String).slice(0, 6) : [],
      activity: String(scene.activity || "a quiet late-night moment"),
      lighting: String(scene.lighting || "moonlight and warm practical lights"),
      userDetail: userDetail || null,
      imageUrl: null,
      jobId: null,
      status: "queued",
    };
    const excludedSceneDetails = customSceneDirectives.filter((directive) => directive !== userDetail);
    return {
      ...normalized,
      excludedUserDetails: excludedSceneDetails,
      prompt: buildImagePrompt(worldBible, normalized, settings, userDetail, excludedSceneDetails),
    };
  });

  const entity = {
    franchise: plan?.entity?.franchise ?? worldBible.franchise ?? null,
    world: plan?.entity?.world ?? worldBible.world ?? prompt,
    era: plan?.entity?.era ?? worldBible.era ?? null,
    anchorCharacter: plan?.entity?.anchorCharacter ?? worldBible.anchorCharacter ?? null,
    medium: plan?.entity?.medium ?? worldBible.medium ?? null,
    confidence: Number(plan?.entity?.confidence ?? worldBible.confidence ?? 0.55),
  };

  if (!cachedWorld && plan?.worldBible && typeof plan.worldBible === "object") {
    const bytes = new TextEncoder().encode(JSON.stringify(worldBible));
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))).map((b) => b.toString(16).padStart(2, "0")).join("");
    await admin.from("universe_reference_cache").upsert({
      normalized_key: normalizedKey,
      franchise: entity.franchise,
      era: entity.era,
      reference_json: worldBible,
      source_hash: digest,
      updated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 86400_000).toISOString(),
    }, { onConflict: "normalized_key" });
  }

  // Child jobs are created by this trusted function only after the
  // per-tier credit reservation succeeds. Their zero charge cannot be
  // selected by a browser caller and therefore cannot become a
  // free-generation bypass. tool_key is the dedicated per-tier key (not the
  // shared image:nano.2) so job-worker's plan gate on twoam2k/4k covers this
  // path too, as defense in depth alongside the clamp above.
  const jobRows = scenes.map((scene: any) => ({
    id: crypto.randomUUID(),
    user_id: user.id,
    type: "image",
    tool_key: tier.toolKey,
    prompt: scene.prompt,
    settings: {
      tool_key: tier.toolKey,
      size: `${tier.width}x${tier.height}`,
      credits: 0,
      priceUSD: 0,
      creation_type: "photo",
      two_am_generation_id: generation.id,
      provider_hint: {
        engine: "runware",
        mode: "t2i",
        edgeFn: "/functions/v1/runware-image",
        airTag: "google:4@3",
        settings: {},
      },
    },
    input: {
      tool: "image",
      subject: scene.prompt,
      creation_type: "photo",
      negative: "text, letters, watermark, logo, caption, blurry, low-res, artifact",
      brand: { id: null, use_palette: false },
      width: tier.width,
      height: tier.height,
    },
    status: "queued",
    progress: 0,
    charge_credits: 0,
    charged: false,
    priority: planPriority(planCode),
    plan_code: planCode,
    provider: "runware",
    attempts: 0,
    max_attempts: 5,
    retry_after: new Date().toISOString(),
  }));

  const { data: queuedJobs, error: queueError } = await admin.from("jobs").insert(jobRows).select("id");
  if (queueError || queuedJobs?.length !== 6) {
    await userClient.rpc("settle_two_am_generation", { p_generation_id: generation.id, p_completed_scenes: 0 });
    return json({ error: "Could not queue the six-image slideshow" }, 500);
  }

  const queuedScenes = scenes.map((scene: any, index: number) => ({
    ...scene,
    jobId: jobRows[index].id,
    status: "queued",
  }));

  const { data: saved, error: saveError } = await admin.from("two_am_generations").update({
    franchise: entity.franchise,
    world: entity.world,
    era: entity.era,
    anchor_character: entity.anchorCharacter,
    world_bible: worldBible,
    scenes: queuedScenes,
    status: "generating",
  }).eq("id", generation.id).eq("user_id", user.id).select("*").single();

  if (saveError) {
    await admin.from("jobs").delete().in("id", jobRows.map((job: any) => job.id));
    await userClient.rpc("settle_two_am_generation", { p_generation_id: generation.id, p_completed_scenes: 0 });
    return json({ error: "Could not save the planned night" }, 500);
  }

  // Dispatch the six trusted child jobs concurrently with server credentials.
  // A browser JWT is unnecessary here and can be rejected by a stale gateway
  // configuration, leaving every row queued at 0%. Consume and validate every
  // response so a failed handoff becomes terminal immediately instead of making
  // the client wait for its six-minute safety timeout.
  const handoffs = await Promise.allSettled(jobRows.map(async (job: any) => {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/job-worker`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ jobId: job.id }),
      signal: AbortSignal.timeout(15_000),
    });
    const responseBody = await response.text();
    if (!response.ok) {
      throw new Error(`job-worker ${response.status}: ${responseBody.slice(0, 180)}`);
    }
  }));

  await Promise.all(handoffs.map(async (handoff, index) => {
    if (handoff.status === "fulfilled") return;
    const message = `Worker handoff failed: ${String(handoff.reason).slice(0, 240)}`;
    await new Promise((resolve) => setTimeout(resolve, 750));
    const { data: currentJob } = await admin
      .from("jobs")
      .select("status")
      .eq("id", jobRows[index].id)
      .maybeSingle();
    if (currentJob && currentJob.status !== "queued") {
      console.warn("[two-am-planner] worker response lost after claim; job remains active", {
        jobId: jobRows[index].id,
        status: currentJob.status,
      });
      return;
    }

    console.error("[two-am-planner]", message, { jobId: jobRows[index].id });
    await admin.rpc("finish_job_failed", {
      p_id: jobRows[index].id,
      p_error: message,
    });
  }));

  return json({ ok: true, generation: saved, entity, worldBible, scenes: queuedScenes, randomSeed: seed, cacheHit: Boolean(cachedWorld) });
});
