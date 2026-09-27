// deno-lint-ignore-file no-explicit-any
// thirty-days-series-planner/index.ts
// Builds a persistent series bible + 5 reusable visual references for a new
// 30 Days Series. This must ground itself in the ACTUAL named franchise the
// same way thirty-days-planner (single-video) does — canon research, a
// strong model, explicit per-style directives, and a franchise-accuracy
// critic pass — otherwise it drifts into an "inspired by" generic substitute
// instead of the real world the user typed (e.g. LEGO Ninjago -> generic
// anime ninjas). See thirty-days-planner/index.ts for the pattern this
// mirrors; the franchise-accuracy prompt/critic loop below stays duplicated
// since it's single-video-specific, but franchise resolution, entity
// registry, roadmap beats, and pacing now come from the shared engine module
// (see the import below) rather than being reimplemented per function.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildStructuredRoadmapBeats,
  coerceFranchiseResolution,
  ensureVisuallyRequiredEntityReferences,
  pacingForDay,
  slug,
  SERIES_SCHEMA_VERSION,
  ROADMAP_VERSION,
  ENTITY_REGISTRY_VERSION,
} from "../_shared/thirtyDaysSeriesEngine.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY")!;
const OPENAI_RESPONSES = "https://api.openai.com/v1/responses";
// The series bible schema is bigger than the single-video planner's (adds
// medium/creatures/recurringProps/powers/palette/era/confidence plus richer
// per-field descriptions to force real canon grounding) — gpt-5-mini needs
// meaningfully more time to generate it than a smaller schema would.
// Measured live: research ~15-45s, resolution ~15-20s, the creative plan
// itself ~95s. These run inside the background pipeline (see
// runPlanningPipeline below) via EdgeRuntime.waitUntil, not inside the
// synchronous request the client is waiting on — the handler returns as soon
// as the draft row exists, so a genuinely slow generation here just takes
// longer; it no longer risks Supabase's platform request-idle ceiling
// killing an in-flight response. Budgets stay generous for the same reason:
// there is no benefit to cutting them tight now, and a prior attempt to do
// so (65s for the plan call) made every real generation abort before
// finishing.
const OPENAI_RESEARCH_TIMEOUT_MS = 60_000;
const OPENAI_RESOLUTION_TIMEOUT_MS = 30_000;
const OPENAI_PLAN_TIMEOUT_MS = 150_000;
const OPENAI_CRITIC_TIMEOUT_MS = 40_000;

// Per-stage wall-clock instrumentation. Every stage boundary is logged
// server-side (visible in `supabase functions logs`) AND returned in the
// response body (both success and failure) so timings are visible without
// needing log access — this is the "which stage, how long" evidence the
// architecture decision below is based on, not a guess.
function makeStageTimer() {
  const stages: { stage: string; ms: number }[] = [];
  let last = Date.now();
  return {
    mark(stage: string) {
      const now = Date.now();
      const ms = now - last;
      last = now;
      stages.push({ stage, ms });
      console.log(`[thirty-days-series-planner] ${stage}: ${(ms / 1000).toFixed(1)}s`);
    },
    stages,
  };
}

const STYLE_IDS = ["auto", "cinematic_3d", "anime_accurate", "realistic", "dark_cinematic"];
const STYLE_DIRECTIVES: Record<string, string> = {
  auto: "Franchise Accurate: this is the strictest mode. Ground every visual choice in the ACTUAL named franchise's real, verifiable canon — its real characters by their real names, real color-coding, real locations, real construction/rendering system (e.g. genuine LEGO minifigure proportions and brick-built sets for a LEGO property, genuine Pokemon creature anatomy for Pokemon, genuine anime cel-shading for an anime property). Never invent a substitute character, substitute location, or generic reinterpretation when the real one is knowable. If this is not a recognized franchise, invent a coherent, specific, non-generic world instead of vague filler.",
  cinematic_3d: "Reinterpret the universe as polished cinematic 3D feature-film imagery with dimensional materials, expressive lighting, and controlled depth, while preserving every recognizable identity, silhouette, signature color, outfit, prop, and world landmark by name.",
  anime_accurate: "Render in a polished anime language with deliberate linework, cel shading, expressive poses, and cinematic anime composition, while preserving every recognizable identity, signature color, outfit, anatomy, prop, and location by name.",
  realistic: "Reinterpret the universe as cinematic live action with physically believable materials, lighting, anatomy, costumes, and architecture, while keeping every canon character instantly recognizable through silhouette, colors, clothing, props, powers, and role.",
  dark_cinematic: "Use a dark cinematic interpretation with dramatic contrast, atmospheric depth, controlled shadows, and tense color grading, while preserving the franchise's recognizable identities, silhouettes, signature colors, props, and architecture by name.",
};
const REF_ROLES = ["protagonist", "pov_hands", "core_cast_style", "environment_primary", "environment_secondary", "antagonist", "companion", "artifact", "vehicle"];
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: any, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

function normalizeKey(value: string) {
  return value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 100);
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

/* ============================ Research stage ============================ */
// Identical grounding step to thirty-days-planner: resolve the real named
// franchise and its concrete canon facts before any creative writing, and
// share the same 30-day cache so a franchise researched once (single-video
// or series) benefits the other.

const RESEARCH_INSTRUCTIONS = `You are a canon researcher for a viral short-form video generator. Resolve the exact franchise/world named by the user before doing anything else — a specific series, movie, game, or fictional universe, not a vague guess.

Search for the world and produce concise factual research notes, not JSON. Identify: franchise name; main recognizable characters BY THEIR REAL NAMES and their exact visual design (colors, proportions, outfits); the medium/rendering style (e.g. LEGO stop-motion-style animation with minifigure construction, cel-shaded anime, photoreal live-action); primary and secondary iconic locations BY THEIR REAL NAMES and their architecture; recognizable creatures/species if any; signature props/objects; named powers or abilities if the world has them; and an overall color palette. Clearly distinguish canonical facts from reasonable visual extrapolations. Do not replace specific named characters/places with generic filler — if you know the real names, use them.`;

function researchInput(universe: string) {
  return `Research this exact world/franchise for a persistent 30-episode "30 days in this world" video series: "${universe}". Resolve its real characters, locations, creatures, props, powers, medium, and visual style before anything else.`;
}

const RESOLUTION_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["resolvedFranchise", "resolvedProperty", "resolvedWorld", "confidence", "aliases", "candidates", "rationale"],
  properties: {
    resolvedFranchise: { type: "string" },
    resolvedProperty: { type: "string" },
    resolvedWorld: { type: "string" },
    confidence: { type: "number" },
    aliases: { type: "array", items: { type: "string" } },
    candidates: { type: "array", items: { type: "object", additionalProperties: false, required: ["name", "confidence", "reason"], properties: { name: { type: "string" }, confidence: { type: "number" }, reason: { type: "string" } } } },
    rationale: { type: "string" },
  },
};

async function resolveFranchiseBoundary(rawUserInput: string, researchNotes: string) {
  const payload = await callOpenAI({
    model: "gpt-5-mini", store: false,
    input: `Resolve the user's fictional-universe input before creative planning. Preserve the broad property unless the user explicitly supplied a narrower title or the evidence is overwhelming and explained. Never silently turn a broad franchise into a game/spinoff.\nRAW USER INPUT: ${rawUserInput}\nRESEARCH: ${researchNotes || "No external research available."}\nReturn only the resolution audit object.`,
    text: { format: { type: "json_schema", name: "thirty_days_franchise_resolution", strict: true, schema: RESOLUTION_SCHEMA } },
  }, OPENAI_RESOLUTION_TIMEOUT_MS);
  return coerceFranchiseResolution(rawUserInput, parseJson(extractOutputText(payload)));
}

/* ============================ Planning stage ============================ */

const REF_ROLES_LIST = REF_ROLES.join(", ");
const REFERENCE_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["id", "role", "label", "prompt", "visualLock"],
  properties: {
    id: { type: "string" }, role: { type: "string", enum: REF_ROLES }, label: { type: "string" },
    prompt: { type: "string", description: "A detailed single-subject reference image prompt. For a recognized franchise this MUST name the real canon character(s)/location by name and lock their real, specific visual traits — never a vague generic description like 'a group of ninja heroes' or 'a colorful city'." },
    visualLock: { type: "string", description: "2-4 non-negotiable concrete visual traits that must stay identical every reuse — real names, real colors, real proportions/construction system, never generic phrasing." },
  },
};
const PLAN_SCHEMA = {
  name: "thirty_days_series_bible", strict: true,
  schema: {
    type: "object", additionalProperties: false,
    required: ["title", "hook", "cameraMode", "worldBible", "seriesBible", "hiddenFutureBeats", "visualReferences"],
    properties: {
      title: { type: "string", description: "A specific, catchy title for THIS series' premise and world — never the literal product name '30 Days' alone and never just the world name alone. E.g. 'Pokemon: Thirty Days as a Trainer' or 'Ninjago: Thirty Days of Darkness', built from this exact premise." }, hook: { type: "string" }, cameraMode: { type: "string", enum: ["third_person", "first_person"] },
      worldBible: {
        type: "object", additionalProperties: false,
        required: ["world", "franchise", "era", "confidence", "medium", "visualStyle", "characters", "creatures", "locations", "recurringProps", "powers", "palette", "hardVisualRules", "negativeRules", "viewerProtagonist"],
        properties: {
          world: { type: "string" },
          franchise: { type: "string", description: "The real, resolved franchise/title name if this is a recognized property, otherwise the same as world." },
          era: { type: ["string", "null"], description: "The specific era/season/continuity of the franchise this draws from, if applicable, else null." },
          confidence: { type: "number", description: "0-1 confidence that this is a recognized real franchise resolved from actual canon (not invented). Use 0.85+ only when the research notes clearly identified a real, specific franchise." },
          medium: { type: "string", description: "The franchise's real medium/construction/rendering system, e.g. 'LEGO minifigure stop-motion-style CG animation with brick-built environments', or 'cel-shaded anime', or 'the franchise's native medium' if unrecognized." },
          visualStyle: { type: "string" },
          hardVisualRules: { type: "array", items: { type: "string" }, description: "Imperative, concrete rendering rules naming the real construction/anatomy/proportions system, e.g. 'Genuine LEGO minifigure proportions: cylindrical hands, block feet, stud-topped brick-built sets — never realistic human anatomy.'" },
          negativeRules: { type: "array", items: { type: "string" }, description: "What to explicitly avoid, e.g. 'No generic anime redesign of the cast', 'No realistic human faces replacing minifigures', 'No off-brand invented characters replacing the real named cast.'" },
          viewerProtagonist: {
            type: "object", additionalProperties: false,
            required: ["identity", "visualIdentity", "goal", "emotionalAnchor", "arrival"],
            properties: {
              identity: { type: "string" }, visualIdentity: { type: "string" }, goal: { type: "string" }, emotionalAnchor: { type: "string" },
              arrival: { type: "string", description: "Concretely how YOU enter this world on Day 1 — fall in, wake up, walk through a door, teleport, etc. Episode 1 must dramatize this exact arrival, not skip past it." },
            },
          },
          characters: { type: "array", items: { type: "string" }, description: "Real, named canon characters (with a one-clause visual identity each, e.g. 'Kai — red ninja, fire elemental power') when this is a recognized franchise. Never generic placeholders like 'a ninja hero'." },
          creatures: { type: "array", items: { type: "string" } },
          locations: { type: "array", items: { type: "string" }, description: "Real, named canon locations, e.g. 'Ninjago City', 'Monastery of Spinjitzu'. Never a generic description like 'a colorful city'." },
          recurringProps: { type: "array", items: { type: "string" } },
          powers: { type: "array", items: { type: "string" } },
          palette: { type: "string" },
        },
      },
      seriesBible: {
        type: "object", additionalProperties: false,
        required: ["longTermGoal", "emotionalAnchor", "centralConflict", "longTermThreat", "importantRelationships", "characterProgression", "majorMystery", "climaxDirection", "day30Payoff", "roadmap", "growthArc", "informationRelease"],
        properties: {
          longTermGoal: { type: "string" }, emotionalAnchor: { type: "string" }, centralConflict: { type: "string" }, longTermThreat: { type: "string" },
          importantRelationships: { type: "array", items: { type: "string" } }, characterProgression: { type: "array", items: { type: "string" } },
          majorMystery: { type: "string" }, climaxDirection: { type: "string" }, day30Payoff: { type: "string" },
          informationRelease: {
            type: "array", minItems: 3, maxItems: 6,
            description: "Every concept central enough to eventually be NAMED (the antagonist force, a mystery object, the source of the growth-arc power, etc.) gets an explicit unexplained -> named -> understood curve, so early episodes never dump lore the viewer hasn't earned yet. The growth arc's own identity and any pivotal named power/threat should each get an entry here unless they're meant to be obvious from day 1.",
            items: {
              type: "object", additionalProperties: false, required: ["concept", "firstAppearanceDay", "nameRevealDay", "fullyUnderstoodDay"],
              properties: {
                concept: { type: "string", description: "The real name of the thing being paced, e.g. 'the Void', 'the Resonance Key'." },
                firstAppearanceDay: { type: "integer", minimum: 1, maximum: 30, description: "Earliest day this may appear ON SCREEN, unexplained and unnamed (e.g. as a strange glow, an odd symbol)." },
                nameRevealDay: { type: "integer", minimum: 1, maximum: 30, description: "Earliest day its actual NAME may be said or written anywhere (dialogue, narration, on-screen text). Must be >= firstAppearanceDay." },
                fullyUnderstoodDay: { type: "integer", minimum: 1, maximum: 30, description: "Earliest day its full nature/rules may be explained. Must be >= nameRevealDay." },
              },
            },
          },
          roadmap: {
            type: "array", minItems: 7, maxItems: 7,
            items: { type: "object", additionalProperties: false, required: ["startDay", "endDay", "purpose", "allowedDevelopments"], properties: {
              startDay: { type: "integer" }, endDay: { type: "integer" }, purpose: { type: "string" }, allowedDevelopments: { type: "array", items: { type: "string" } },
            } },
          },
          growthArc: {
            type: "object", additionalProperties: false,
            required: ["type", "identity", "acquisitionDay", "milestones", "majorGrowthDay", "majorGrowthDescription"],
            description: "The ONE persistent companion/power/skill the protagonist acquires almost immediately and visibly develops all series — e.g. catching and training a single named Pokemon that evolves at the midpoint, or being granted an elemental power on day 1 that is trained into a mastered form at the midpoint.",
            properties: {
              type: { type: "string", enum: ["companion", "power", "skill", "tool"] },
              identity: { type: "string", description: "The specific, named, stable identity — e.g. 'a young Charmander named Ember' or 'the elemental power of Ice' — never generic." },
              acquisitionDay: { type: "integer", minimum: 1, maximum: 3 },
              milestones: {
                type: "array", minItems: 3, maxItems: 6,
                items: { type: "object", additionalProperties: false, required: ["day", "development"], properties: {
                  day: { type: "integer", minimum: 1, maximum: 30 }, development: { type: "string" },
                } },
              },
              majorGrowthDay: { type: "integer", minimum: 12, maximum: 20 },
              majorGrowthDescription: { type: "string", description: "The concrete midpoint transformation — an evolution, an awakened form, a mastered technique, a new move learned." },
            },
          },
        },
      },
      hiddenFutureBeats: {
        type: "array", minItems: 3, maxItems: 8,
        items: { type: "object", additionalProperties: false, required: ["id", "revealDay", "secret", "allowedSetup"], properties: {
          id: { type: "string" }, revealDay: { type: "integer", minimum: 2, maximum: 30 }, secret: { type: "string" }, allowedSetup: { type: "string" },
        } },
      },
      visualReferences: { type: "array", minItems: 5, maxItems: 5, items: REFERENCE_SCHEMA },
    },
  },
};

const PLANNER_INSTRUCTIONS = `You are Zyvo's master showrunner for a persistent 30-episode short-form series called "30 Days". Use the supplied canon research as ground truth.

FRANCHISE RESOLUTION (critical, read first): when the user names a real, recognizable franchise, you MUST resolve it to its actual identity, not invent an "inspired by" substitute. This is not optional and it is not a style choice — it is a factual-accuracy requirement that applies regardless of the selected visual style.
- "LEGO Ninjago" must resolve to the real Ninjago cast (Lloyd, Kai, Jay, Cole, Zane, Nya), the real locations (Ninjago City, the Monastery of Spinjitzu), and the real LEGO minifigure construction system — never a generic anime ninja squad in a generic stylized city.
- "Pokemon" must resolve to real Pokemon anatomy/species, the real trainer/Poke Ball world identity — never generic fantasy monsters.
- "Hogwarts" must resolve to the real Hogwarts castle, houses, and magical-school identity — never a generic unrelated fantasy school.
Apply the same standard to any other recognized franchise (Naruto, One Piece, Minecraft, etc.): name real characters and locations by their real names in worldBible.characters/locations, and describe the franchise's REAL construction/rendering system in worldBible.medium and hardVisualRules. Set worldBible.confidence high (0.85+) only when you are actually resolving real canon from the research notes, not guessing. If the named world is genuinely not a recognizable existing franchise, invent one coherent, specific, non-generic world instead — set confidence low and be explicit and non-vague about the invented specifics.

WORLD: {{universe}}
PREMISE: {{premise}}
VISUAL STYLE MODE: {{visualStyle}}
STYLE DIRECTIVE (apply throughout, but never let style reinterpretation erase the resolved franchise identity above): {{styleDirective}}
DAYS PER EPISODE: {{daysPerEpisode}}

CANON RESEARCH:
{{researchNotes}}

Create a SERIES BIBLE, not 30 complete scripts. The viewer is always YOU: a concrete universe-adapted protagonist whose exact identity persists for the entire series. Canon characters support YOUR story. Preserve recognizable franchise anatomy, outfits, colors, props, architecture, and rendering rules even when the chosen style reinterprets materials or lighting.

Build exactly seven flexible roadmap phases: Days 1-5 arrival/discovery, 6-10 adaptation and a material Day 10 change, 11-15 growing consequences, 16-20 revelation and serious setback, 21-25 recovery/preparation, 26-29 final escalation, Day 30 payoff. Each phase stores direction, not episode scripts.

GROWTH ARC — this is what makes fans of the actual franchise want to watch, not just a random made-up story wearing the franchise's skin: establish exactly ONE persistent, singular growth element the protagonist acquires almost immediately (acquisitionDay 1-3) — a specific companion creature, a specific power, or a specific skill — with a stable, NAMED identity that is never swapped for something different later in the series. This element must visibly develop through training, bonding, or practice across several roadmap milestones, and must reach one major transformation near the midpoint (majorGrowthDay, roughly day 12-20) — an evolution, an awakened form, a mastered technique, a meaningful new ability.

Concrete examples of the feel required (adapt to the actual world, do not copy literally): in a Pokemon world, the protagonist catches ONE specific starter Pokemon on day 1, trains it and has it learn moves scene by scene across episodes, and it evolves around the midpoint. In a Ninjago-style world, the protagonist is granted ONE specific elemental power on day 1 and spends the series training and mastering it, awakening a stronger form at the midpoint. In a Naruto-style world, the protagonist learns or awakens ONE specific jutsu/technique on day 1 and refines it into a perfected or advanced version at the midpoint. This growth arc must be the emotional throughline every single episode advances a little — never invent per-episode events disconnected from it, and never replace the established companion/power/skill with a different one partway through the series.

EARNED, NOT STATED: acquiring the growth-arc element on day 1-3 must be an on-screen EVENT the protagonist witnesses and reacts to — triggered by something concrete (an encounter, an accident, a gift, a discovery) — never a fact that's just already true when the episode starts. The viewer must see the moment it happens.

ARRIVAL AND ONBOARDING (critical — this is what the current failure mode looks like without it): viewerProtagonist.arrival must be a single concrete mechanism for how YOU physically enter this world on day 1 (fall in, wake up, walk through a door, teleport — pick one that fits the premise). The first roadmap phase (days 1-5, or less if daysPerEpisode is smaller) must be spent on: arrival, realizing where YOU are, meeting ONE character first, and one small explicable problem — not the central mystery, not the full cast, not named lore. informationRelease exists specifically to pace this: any concept significant enough to eventually be NAMED (the antagonist force, a mystery object, the origin of the growth-arc power if it isn't self-evident) gets its own entry with firstAppearanceDay (may appear unexplained), nameRevealDay (its name may first be spoken), and fullyUnderstoodDay (its nature may be explained) — these almost always land later than day 1-3, even if the growth-arc element itself is acquired that early. A brand-new viewer of episode 1 should understand who YOU are, how YOU got there, and who YOU just met — nothing more needs explaining yet.

Future-spoiler safety is critical. Put every secret, betrayal, true villain identity, twist, or final solution in hiddenFutureBeats with a revealDay. allowedSetup may foreshadow without revealing the answer. Early episodes must never know or narrate later secrets.

Create exactly 5 persistent reference designs generated once and reused: reference 1 must be YOU (protagonist, or pov_hands only for strict first-person), then a "core_cast_style" reference naming the real recognizable cast AND establishing the franchise's real rendering system, a primary environment reference naming a real iconic location, and two more story-critical references (secondary environment/companion/antagonist/artifact) — all naming real canon specifics when the franchise is recognized. Make the protagonist reference id "you". Every OTHER id must be a short slug built from the actual subject's name, never the bare role word alone (e.g. "eevee_nova" or "companion_nova" for a companion named Nova, never just "companion"; "pallet_town" for that environment, never just "environment_primary") — future episodes add their own new references by role, and a bare role word as an id will collide with one of theirs. Valid roles: ${REF_ROLES_LIST}.

The premise must sustain relationship evolution, varied locations/problems, natural cliffhangers, escalating stakes, a painful middle defeat, and a concrete Day 30 answer. No repetitive daily training/exploration.

TITLE: write a specific, catchy title for THIS series' premise — never just "30 Days" by itself and never just the world name by itself. Build it from the actual premise, e.g. "Pokemon: Thirty Days as a Trainer" or "Ninjago: Thirty Days of Darkness" or "Hogwarts: Frozen in Time" — a real viewer should be able to tell what this specific series is about from the title alone. Return structured JSON only.`;

function plannerInput({ universe, premise, visualStyle, daysPerEpisode, researchNotes, franchiseResolution, correction = "" }: Record<string, any>) {
  // Replacement functions, never replacement strings — premise/universe are
  // raw user input and a literal "$&"/"$1" etc. inside them would otherwise
  // be given special meaning by String.replace's string-replacement form.
  const filled = `AUTHORITATIVE RESOLUTION BOUNDARY (do not reinterpret or narrow it): ${JSON.stringify(franchiseResolution)}\n\n${PLANNER_INSTRUCTIONS}`
    .replace("{{universe}}", () => universe)
    .replace("{{premise}}", () => premise)
    .replace("{{visualStyle}}", () => visualStyle)
    .replace("{{styleDirective}}", () => STYLE_DIRECTIVES[visualStyle] ?? STYLE_DIRECTIVES.auto)
    .replace("{{daysPerEpisode}}", () => String(daysPerEpisode))
    .replace("{{researchNotes}}", () => researchNotes || `(no research available — use general knowledge of ${universe})`);
  return correction ? `${filled}\n\nPREVIOUS ATTEMPT HAD ISSUES — FIX THESE SPECIFICALLY:\n${correction}` : filled;
}

async function callPlan(input: Record<string, any>) {
  const payload = await callOpenAI({
    model: "gpt-5-mini",
    store: false,
    input: plannerInput(input),
    text: { format: { type: "json_schema", name: "thirty_days_series_bible", strict: true, schema: PLAN_SCHEMA.schema } },
  }, OPENAI_PLAN_TIMEOUT_MS);
  return parseJson(extractOutputText(payload));
}

/* ============================ Critic stage ============================ */
// Focused specifically on the failure mode this fix targets: a recognized
// franchise drifting into a generic "inspired by" substitute.

const CRITIC_INSTRUCTIONS = `You are a strict franchise-accuracy critic for a video series generator. Given a world name, research notes, and a generated series bible, check specifically for GENERIC DRIFT: does the bible actually use the real franchise's real characters, locations, and rendering system, or did it invent a vague generic substitute?

Checks:
1. If the research notes or world name clearly identify a real, recognizable franchise, worldBible.characters must contain REAL named canon characters (not "a ninja hero", "a trainer", or other generic placeholders).
2. worldBible.locations must contain REAL named canon locations (not "a colorful city" or "a magic school").
3. worldBible.medium and hardVisualRules must describe the franchise's ACTUAL construction/rendering system in concrete terms (e.g. real LEGO minifigure proportions for a LEGO property) rather than vague generic style language.
4. Every visualReferences[].prompt and visualLock must name concrete real canon specifics when the franchise is recognized — reject vague descriptions like "a group of ninja heroes" or "a colorful Asian-style city" when a real name/color/identity is knowable.
5. worldBible.confidence must be consistent with the actual specificity shown — reject a high confidence score paired with generic/vague content.
Return passed=true only if the bible is clearly, specifically grounded in the real franchise (or, if the world is genuinely not a recognizable franchise, is at least specific and non-generic). Otherwise list the specific issues found, one per array item, naming exactly which field is too generic and what the real specific answer should be if known from the research notes.`;
const CRITIC_SCHEMA = {
  name: "thirty_days_series_franchise_critic", strict: true,
  schema: { type: "object", additionalProperties: false, required: ["passed", "issues"], properties: { passed: { type: "boolean" }, issues: { type: "array", items: { type: "string" } } } },
};

function deterministicFranchiseIssues(plan: any): string[] {
  const issues: string[] = [];
  const world = plan?.worldBible ?? {};
  const confidence = Number(world?.confidence ?? 0);
  const generic = /^(a |an |the )?(group of|team of|band of)?\s*(ninja|hero|warrior|monster|creature|trainer|student|wizard|magic|fantasy|anime)s?\b.*(heroes|world|city|school|characters?)?$/i;
  const characters: string[] = Array.isArray(world.characters) ? world.characters : [];
  const locations: string[] = Array.isArray(world.locations) ? world.locations : [];
  if (confidence >= 0.6) {
    if (!characters.length) issues.push("worldBible.characters is empty despite claiming a recognized franchise — name the real cast.");
    if (characters.some((entry) => generic.test(String(entry).trim()))) issues.push("worldBible.characters contains a generic placeholder instead of a real named character.");
    if (!locations.length) issues.push("worldBible.locations is empty despite claiming a recognized franchise — name real canon locations.");
    if (locations.some((entry) => generic.test(String(entry).trim()))) issues.push("worldBible.locations contains a generic placeholder instead of a real named location.");
    if (String(world.medium ?? "").trim().length < 8) issues.push("worldBible.medium is missing the franchise's real construction/rendering system.");
  }
  const refs = Array.isArray(plan?.visualReferences) ? plan.visualReferences : [];
  refs.forEach((ref: any, index: number) => {
    if (confidence >= 0.6 && generic.test(String(ref?.prompt ?? "").trim())) {
      issues.push(`visualReferences[${index}] ("${ref?.label ?? ""}") prompt reads as a generic substitute rather than naming real canon specifics.`);
    }
  });
  if (!String(world?.viewerProtagonist?.arrival ?? "").trim()) {
    issues.push("worldBible.viewerProtagonist.arrival is missing — state concretely how YOU enter this world on day 1.");
  }
  const informationRelease = Array.isArray(plan?.seriesBible?.informationRelease) ? plan.seriesBible.informationRelease : [];
  informationRelease.forEach((entry: any) => {
    const first = Number(entry?.firstAppearanceDay);
    const named = Number(entry?.nameRevealDay);
    const understood = Number(entry?.fullyUnderstoodDay);
    if (named < first) issues.push(`informationRelease "${entry?.concept}" has nameRevealDay before firstAppearanceDay.`);
    if (understood < named) issues.push(`informationRelease "${entry?.concept}" has fullyUnderstoodDay before nameRevealDay.`);
  });
  return issues;
}

// Non-throwing on purpose: a cold first draft from the model frequently gets
// one structural detail slightly wrong (an off-by-one roadmap day, a
// duplicate ref id), and that deserves the same one-repair-attempt chance as
// a franchise-accuracy issue rather than crashing the request immediately.
// assertStructurallyValid (below) is the actual hard gate, run only once,
// after the repair attempt has had its chance.
function structuralIssues(plan: any): string[] {
  const issues: string[] = [];
  const refs = Array.isArray(plan?.visualReferences) ? plan.visualReferences : [];
  if (refs.length !== 5) issues.push("visualReferences must contain exactly 5 entries.");
  if (refs[0]?.id !== "you" || !["protagonist", "pov_hands"].includes(refs[0]?.role)) issues.push(`visualReferences[0] must have id "you" and role "protagonist" (or "pov_hands" for strict first-person) — got id "${refs[0]?.id}", role "${refs[0]?.role}".`);
  if (new Set(refs.map((ref: any) => ref.id)).size !== refs.length) issues.push("visualReferences ids must all be unique.");
  const roadmap = plan?.seriesBible?.roadmap || [];
  const expected = [[1,5],[6,10],[11,15],[16,20],[21,25],[26,29],[30,30]];
  if (roadmap.length !== 7 || roadmap.some((arc: any, index: number) => arc.startDay !== expected[index][0] || arc.endDay !== expected[index][1])) {
    issues.push(`seriesBible.roadmap must contain exactly these 7 startDay/endDay pairs in order: ${expected.map(([s, e]) => `${s}-${e}`).join(", ")}.`);
  }
  const secrets = plan?.hiddenFutureBeats || [];
  if (secrets.some((beat: any) => Number(beat.revealDay) < 2 || Number(beat.revealDay) > 30)) issues.push("hiddenFutureBeats revealDay must be between 2 and 30.");
  return issues;
}

function assertStructurallyValid(plan: any) {
  const issues = structuralIssues(plan);
  if (issues.length) throw new Error(`SERIES_PLAN_STRUCTURALLY_INVALID: ${issues.join(" ")}`);
}

// The prompt asks for unique, subject-derived reference ids, but a model
// asked to "keep it simple" will still sometimes just use the bare role word
// ("companion", "artifact") as the id. That's a real problem: episodes add
// their OWN new references by role too, and begin_thirty_days_series_episode
// correctly hard-rejects any new reference id that collides with an existing
// one — so a bare-role id baked in at series creation permanently blocks any
// future episode that naturally reuses that same role word. Enforced here
// deterministically rather than trusting prompt compliance alone.
function ensureUniqueReferenceIds(references: any[]) {
  for (const ref of references) {
    if (ref.id === "you" || !REF_ROLES.includes(ref.id)) continue;
    const taken = new Set(references.map((other: any) => other.id).filter((id: string) => id !== ref.id));
    const base = slug(ref.label || ref.id, ref.id);
    let candidate = base;
    let suffix = 2;
    while (taken.has(candidate)) candidate = `${base}_${suffix++}`;
    ref.id = candidate;
  }
  return references;
}

/* ============================ Background pipeline ============================
   Measured live against the dev project: a best-case run (cached research)
   takes ~129s; an uncached run comfortably exceeds Supabase's ~150s platform
   request-idle ceiling and the platform kills the whole isolate with an
   ungraceful 504 and NO response body — no error message, no partial
   progress. No combination of per-call AbortSignal budgets fixes this: the
   mandatory sequential cost (research + resolution + plan [+ critic +
   repair]) can exceed the ceiling on its own, before a single retry. This
   runs the whole pipeline in the background via EdgeRuntime.waitUntil
   (mirroring the proven pattern in runware-video/index.ts for the same class
   of problem) while the handler returns immediately with a seriesId the
   client polls. Every stage persists its result to planning_payload via
   service_update_thirty_days_series_planning so a retry after a failure
   RESUMES from the failed stage instead of re-running already-paid-for
   OpenAI calls (this also fixes a real bug: research was previously only
   cached on full pipeline SUCCESS, so a franchise that failed downstream —
   observed for LEGO Ninjago on every attempt — never benefited from caching
   on retry; the cache write now happens the moment research itself succeeds).
================================================================================ */

type PlanningInput = { universe: string; premise: string; visualStyle: string; daysPerEpisode: number };

async function runPlanningPipeline(admin: any, seriesId: string, input: PlanningInput, resumePayload: Record<string, any>) {
  const timer = makeStageTimer();
  const { universe, premise, visualStyle, daysPerEpisode } = input;
  const setStage = (stage: string, patch: Record<string, any> = {}) =>
    admin.rpc("service_update_thirty_days_series_planning", { p_series_id: seriesId, p_stage: stage, p_payload_patch: patch })
      .then(({ error }: any) => { if (error) console.error("[thirty-days-series-planner] stage update failed:", stage, error); });
  const fail = async (error: unknown) => {
    const message = String((error as any)?.message || error).slice(0, 500);
    console.error(`[thirty-days-series-planner] pipeline failed for ${seriesId}:`, error, "timings:", JSON.stringify(timer.stages));
    await admin.rpc("service_update_thirty_days_series_planning", {
      p_series_id: seriesId, p_stage: null, p_payload_patch: {}, p_error: message,
    }).catch((e: any) => console.error("[thirty-days-series-planner] failed to persist failure:", e));
  };

  try {
    const normalizedKey = normalizeKey(universe);
    let franchiseResolution = resumePayload.franchiseResolution;
    let researchNotes = resumePayload.researchNotes ?? "";

    if (!franchiseResolution) {
      await setStage("resolving");
      const { data: cacheRow } = await admin.from("universe_reference_cache")
        .select("reference_json").eq("normalized_key", normalizedKey)
        .gt("expires_at", new Date().toISOString()).maybeSingle();
      const cachedResearch = cacheRow?.reference_json && Number(cacheRow.reference_json.confidence ?? 0) >= 0.6
        ? String(cacheRow.reference_json.researchNotes || JSON.stringify(cacheRow.reference_json))
        : null;
      console.log(`[thirty-days-series-planner] research cache ${cachedResearch ? "HIT" : "MISS"} for "${normalizedKey}"`);
      timer.mark("cache_lookup");

      researchNotes = cachedResearch ?? researchNotes;
      if (!researchNotes) {
        await setStage("researching");
        try {
          const researchPayload = await callOpenAI({
            model: "gpt-5-mini", store: false, instructions: RESEARCH_INSTRUCTIONS,
            input: researchInput(universe), tools: [{ type: "web_search", search_context_size: "medium" }],
          }, OPENAI_RESEARCH_TIMEOUT_MS);
          researchNotes = extractOutputText(researchPayload).trim().slice(0, 14_000);
          // Cache the moment research itself succeeds — not at the end of the
          // whole pipeline — so a franchise that fails at a LATER stage still
          // benefits from this on its next retry instead of re-paying for
          // research every single time (the bug that made every LEGO Ninjago
          // attempt this session redo a full, uncached web-search research call).
          if (researchNotes) {
            const bytes = new TextEncoder().encode(researchNotes);
            const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))).map((b) => b.toString(16).padStart(2, "0")).join("");
            await admin.from("universe_reference_cache").upsert({
              normalized_key: normalizedKey, franchise: universe, era: null,
              reference_json: { franchise: universe, era: null, researchNotes, confidence: 0.6 },
              source_hash: digest, updated_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 30 * 86400_000).toISOString(),
            }, { onConflict: "normalized_key" });
          }
        } catch (error) {
          console.error("[thirty-days-series-planner] research fallback:", String(error));
        }
      }
      timer.mark(cacheRow ? "research_skipped_cache_hit" : "research");

      try {
        franchiseResolution = await resolveFranchiseBoundary(universe, researchNotes);
      } catch (error) {
        console.warn("[thirty-days-series-planner] resolution fallback:", String(error));
        franchiseResolution = coerceFranchiseResolution(universe, {
          resolvedFranchise: universe, resolvedProperty: universe, resolvedWorld: universe,
          confidence: researchNotes ? 0.65 : 0.25,
          rationale: "Resolution service unavailable; preserved the user's exact scope without narrowing.",
        });
      }
      timer.mark("franchise_resolution");
      await setStage("planning", { franchiseResolution, researchNotes, normalizedKey });
    } else {
      console.log(`[thirty-days-series-planner] resuming ${seriesId} with cached franchiseResolution/researchNotes from a prior attempt`);
    }

    let plan = resumePayload.draftPlan;
    if (!plan) {
      plan = await callPlan({ universe: franchiseResolution.resolvedWorld, premise, visualStyle, daysPerEpisode, researchNotes, franchiseResolution });
      timer.mark("creative_plan");
      await setStage("validating", { draftPlan: plan });
    } else {
      console.log(`[thirty-days-series-planner] resuming ${seriesId} with a cached draft plan from a prior attempt`);
    }

    // Deterministic pre-filter (structural + franchise-accuracy), then one
    // critic pass, then one automatic repair attempt with the issues
    // appended — matching thirty-days-planner's "N attempts, then accept"
    // philosophy. Nothing here throws on the first draft alone; the only
    // hard gate is assertStructurallyValid, run once at the very end. No
    // request-wall-clock budget guard is needed here anymore: this runs in
    // the background, so a slow critic/repair pass just takes longer — it no
    // longer risks the platform killing an in-flight synchronous response.
    let issues = [...structuralIssues(plan), ...deterministicFranchiseIssues(plan)];
    if (!issues.length) {
      try {
        const criticPayload = await callOpenAI({
          model: "gpt-5-mini", store: false, instructions: CRITIC_INSTRUCTIONS,
          input: JSON.stringify({ universe, researchNotes, plan }),
          text: { format: { type: "json_schema", name: "thirty_days_series_franchise_critic", strict: true, schema: CRITIC_SCHEMA.schema } },
        }, OPENAI_CRITIC_TIMEOUT_MS);
        const critic = parseJson(extractOutputText(criticPayload));
        if (!critic?.passed && Array.isArray(critic?.issues) && critic.issues.length) issues = critic.issues;
      } catch (error) {
        console.warn("[thirty-days-series-planner] critic pass skipped:", String(error));
      }
    }
    if (issues.length) {
      try {
        const repaired = await callPlan({ universe: franchiseResolution.resolvedWorld, premise, visualStyle, daysPerEpisode, researchNotes, franchiseResolution, correction: issues.join("\n") });
        // Only take the repaired draft if it's at least as structurally
        // sound as the first one — never trade a valid draft for a broken
        // repair. Franchise-accuracy issues alone are not worth discarding a
        // structurally valid plan over.
        if (structuralIssues(repaired).length <= structuralIssues(plan).length) plan = repaired;
      } catch (error) {
        console.warn("[thirty-days-series-planner] repair pass failed, keeping first draft:", String(error));
      }
    }
    timer.mark("critic_and_repair");
    assertStructurallyValid(plan);
    timer.mark("validation");

    // Defensive fallback: the schema/prompt ask for a specific title, but an
    // LLM can still echo the product name or the bare world name. Never ship
    // a title that's just "30 Days" or just the universe by itself.
    const genericTitles = new Set(["30 days", universe.trim().toLowerCase()]);
    if (!plan.title || plan.title.trim().length < 6 || genericTitles.has(plan.title.trim().toLowerCase())) {
      plan.title = `30 Days in ${universe}${premise ? `: ${premise.split(/[.!?]/)[0].slice(0, 60).trim()}` : ""}`;
    }
    plan.worldBible.styleMode = visualStyle;
    plan.worldBible.styleDirective = STYLE_DIRECTIVES[visualStyle] ?? STYLE_DIRECTIVES.auto;
    plan.seriesBible.worldBible = plan.worldBible;
    plan.franchiseResolution = franchiseResolution;
    plan.visualReferences = ensureUniqueReferenceIds(plan.visualReferences);
    const identity = ensureVisuallyRequiredEntityReferences(plan);
    plan.entityRegistry = identity.entities;
    plan.visualReferences = identity.references;
    plan.roadmapBeats = buildStructuredRoadmapBeats(plan);
    plan.pacingState = {
      ...pacingForDay(1), mysteryProgress: 0, antagonistRevealLevel: 0,
      protagonistPowerLevel: 0, relationshipProgress: 0,
      consumedBeatIds: [], availableBeatIds: [], lockedBeatIds: plan.roadmapBeats.map((beat: any) => beat.beatId),
    };
    plan.versions = { series_schema_version: SERIES_SCHEMA_VERSION, roadmap_version: ROADMAP_VERSION, entity_registry_version: ENTITY_REGISTRY_VERSION };
    timer.mark("entity_registry_and_roadmap");

    await setStage("reserving", { draftPlan: plan });
    const { data: series, error } = await admin.rpc("service_finalize_thirty_days_series", { p_series_id: seriesId, p_master_plan: plan });
    if (error) throw error;
    timer.mark("billing_reservation_and_db_insert");
    const { error: persistArchitectureError } = await admin.from("thirty_days_series").update({
      raw_user_input: franchiseResolution.rawUserInput,
      normalized_input: franchiseResolution.normalizedInput,
      franchise_resolution: franchiseResolution,
      entity_registry: plan.entityRegistry,
      roadmap_beats: plan.roadmapBeats,
      pacing_state: plan.pacingState,
      verified_story_state: { entities: plan.entityRegistry, relationships: {}, inventory: [], abilities: [], mysteries: {}, events: [], consumedBeatIds: [] },
      reference_library: plan.visualReferences,
      series_schema_version: SERIES_SCHEMA_VERSION,
      roadmap_version: ROADMAP_VERSION,
      entity_registry_version: ENTITY_REGISTRY_VERSION,
    }).eq("id", series.id);
    if (persistArchitectureError) throw persistArchitectureError;
    timer.mark("response_assembly");
    console.log(`[thirty-days-series-planner] TOTAL for ${seriesId}: ${(timer.stages.reduce((sum, s) => sum + s.ms, 0) / 1000).toFixed(1)}s`, JSON.stringify(timer.stages));
  } catch (error) {
    await fail(error);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return reply({ ok: false, error: "Method not allowed" }, 405);
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return reply({ ok: false, error: "Unauthorized" }, 401);
  const body = await req.json().catch(() => ({}));

  try {
    // Retry/resume path: { seriesId } only. Reuses whatever the draft row's
    // planning_payload already has (resolved franchise, research, draft plan)
    // rather than restarting the whole pipeline from scratch.
    const resumeSeriesId = String(body.seriesId || "").trim();
    if (resumeSeriesId) {
      const { data: existing, error: lookupError } = await admin.from("thirty_days_series")
        .select("*").eq("id", resumeSeriesId).eq("user_id", user.id).maybeSingle();
      if (lookupError) throw lookupError;
      if (!existing) return reply({ ok: false, error: "Series not found" }, 404);
      if (!["planning", "failed"].includes(existing.status)) {
        return reply({ ok: true, series: existing, alreadyDone: true });
      }
      EdgeRuntime.waitUntil(runPlanningPipeline(admin, existing.id, {
        universe: existing.universe, premise: existing.premise,
        visualStyle: existing.visual_style, daysPerEpisode: existing.days_per_episode,
      }, existing.planning_payload || {}));
      return reply({ ok: true, series: { ...existing, status: "planning", planning_stage: existing.planning_payload?.franchiseResolution ? "planning" : "resolving", planning_error: null } }, 202);
    }

    const universe = String(body.universe || "").trim().slice(0, 120);
    const premise = String(body.premise || "").trim().slice(0, 500);
    const visualStyle = STYLE_IDS.includes(body.visualStyle) ? body.visualStyle : "auto";
    const quality = String(body.quality || "thirtydays-v2");
    const daysPerEpisode = Number(body.daysPerEpisode || 1);
    if (universe.length < 2 || premise.length < 5 || ![1,2,3,5].includes(daysPerEpisode)) return reply({ ok: false, error: "Invalid series setup" }, 400);

    const { data: draft, error: draftError } = await admin.rpc("begin_thirty_days_series_draft", {
      p_user_id: user.id, p_universe: universe, p_premise: premise, p_visual_style: visualStyle,
      p_quality_tier: quality, p_days_per_episode: daysPerEpisode,
    });
    if (draftError) throw draftError;

    EdgeRuntime.waitUntil(runPlanningPipeline(admin, draft.id, { universe, premise, visualStyle, daysPerEpisode }, {}));
    return reply({ ok: true, series: draft }, 202);
  } catch (error) {
    console.error("[thirty-days-series-planner]", error);
    const message = String((error as any)?.message || error);
    return reply({ ok: false, error: message.includes("INSUFFICIENT_CREDITS") ? "INSUFFICIENT_CREDITS" : message.includes("PLAN_UPGRADE_REQUIRED") ? "PLAN_UPGRADE_REQUIRED" : `Series planning failed to start: ${message.slice(0, 400)}` }, 500);
  }
});
