// deno-lint-ignore-file no-explicit-any
// thirty-days-planner/index.ts
// Canon research + world bible + reusable visual references + a strict
// 8-scene, four-milestone (2 scenes per day) viral story plan, with a cheap
// critic/repair pass.
// The client never talks to OpenAI directly — this function is the trusted
// boundary that resolves plan_code, clamps the quality tier, reserves
// credits, and returns the saved generation row. Reference/scene image and
// video JOBS are created client-side afterward (staged, unlike Two-AM's
// flat parallel-6 — this template's dependency graph needs sequencing).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const OPENAI_RESPONSES = "https://api.openai.com/v1/responses";
const OPENAI_RESEARCH_TIMEOUT_MS = 25_000;
const OPENAI_PLAN_TIMEOUT_MS = 25_000;
const OPENAI_CRITIC_TIMEOUT_MS = 12_000;

type QualityTier = {
  id: string; label: string; minPlan: string;
  referenceToolKey: string; referenceWidth: number; referenceHeight: number; referenceCredits: number;
  imageToolKey: string; imageWidth: number; imageHeight: number; imageCredits: number;
  videoToolKey: string; videoProvider: string; videoModel: string;
  videoWidth: number; videoHeight: number; videoDurationSec: number; videoCredits: number; withSound: false;
};
const DEFAULT_QUALITY = "thirtydays-v2";
const DEFAULT_VISUAL_STYLE = "auto";
const PLAN_TIER_ORDER = ["free", "starter", "pro", "generative"];
const SCENE_COUNT = 8;
const MILESTONE_DAYS = [1, 1, 10, 10, 20, 20, 30, 30] as const;
const REF_COUNT = 5;
const BEAT_TYPES = ["hook", "consequence", "adaptation", "turning_point", "reveal", "lowpoint", "climax", "payoff"];
const REF_ROLES = ["protagonist", "pov_hands", "core_cast_style", "environment_primary", "environment_secondary", "antagonist", "companion", "artifact", "vehicle"];
const STYLE_DIRECTIVES: Record<string, string> = {
  auto: "Franchise Accurate: infer and preserve the universe's native visual language, construction, anatomy, proportions, silhouettes, materials, outfits, architecture, props, palette, and canonical identity. Do not impose a generic house style.",
  cinematic_3d: "Reinterpret the universe as polished cinematic 3D feature-film imagery with dimensional materials, expressive lighting, and controlled depth, while preserving every recognizable identity, silhouette, signature color, outfit, prop, and world landmark.",
  anime_accurate: "Render in a polished anime language with deliberate linework, cel shading, expressive poses, and cinematic anime composition, while preserving every recognizable identity, signature color, outfit, anatomy, prop, and location.",
  realistic: "Reinterpret the universe as cinematic live action with physically believable materials, lighting, anatomy, costumes, and architecture, while keeping every canon character instantly recognizable through silhouette, colors, clothing, props, powers, and role.",
  dark_cinematic: "Use a dark cinematic interpretation with dramatic contrast, atmospheric depth, controlled shadows, and tense color grading, while preserving the franchise's recognizable identities, silhouettes, signature colors, props, and architecture.",
};

function ensureViewerPremise(value: string, universe: string) {
  const premise = value.trim().replace(/[.!?]+$/, "");
  if (/\b(you|your|i|my|me)\b/i.test(premise)) return `${premise}.`;
  return `You are in ${universe} when ${premise.charAt(0).toLowerCase()}${premise.slice(1)}.`;
}

function planTierIndex(planCode: string) {
  const normalized = String(planCode ?? "").toLowerCase().trim() === "affiliate" ? "starter" : String(planCode ?? "").toLowerCase().trim();
  const idx = PLAN_TIER_ORDER.indexOf(normalized);
  return idx === -1 ? 0 : idx;
}

function resolveQualityTier(requested: string, planCode: string, tiers: Record<string, QualityTier>) {
  const userTier = planTierIndex(planCode);
  const candidate = tiers[requested] ? requested : DEFAULT_QUALITY;
  if (planTierIndex(tiers[candidate].minPlan) <= userTier) return candidate;
  const order = ["thirtydays-v4", "thirtydays-v3", "thirtydays-v2"];
  return order.find((id) => tiers[id] && planTierIndex(tiers[id].minPlan) <= userTier) ?? DEFAULT_QUALITY;
}

function resolveVisualStyle(requested: string) {
  return STYLE_DIRECTIVES[requested] ? requested : DEFAULT_VISUAL_STYLE;
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

const RESEARCH_INSTRUCTIONS = `You are a canon researcher for a viral short-form video generator. Resolve the exact franchise/world named by the user before doing anything else — a specific series, movie, game, or fictional universe, not a vague guess.

Search for the world and produce concise factual research notes, not JSON. Identify: franchise name; main recognizable characters and their exact visual design (colors, proportions, outfits); the medium/rendering style (e.g. LEGO stop-motion-style animation, cel-shaded anime, photoreal live-action); primary and secondary iconic locations and their architecture; recognizable creatures/species if any; signature props/objects; named powers or abilities if the world has them; and an overall color palette. Clearly distinguish canonical facts from reasonable visual extrapolations. Do not replace specific named characters/places with generic filler.`;

function researchInput(universe: string) {
  return `Research this exact world/franchise for a "30 days in this world" viral video: "${universe}". Resolve its real characters, locations, creatures, props, powers, medium, and visual style before anything else.`;
}

/* ============================ Planning stage ============================ */

const PLANNER_INSTRUCTIONS = `You are Zyvo's Viral 30-Day Story Director. Viral performance is the primary requirement — not just technically valid output. Use the supplied canon research as ground truth and return a strict structured plan for a "What would happen if [world] for 30 days?" short-form video: a world bible, exactly 5 reusable visual references, and exactly 8 escalating scenes grouped into four fixed milestone days with 2 scenes per day.

V1 VIEWER-INSERT CONTRACT (mandatory, never optional):
- This story is "YOU in that universe for 30 days." The viewer-insert is the protagonist; canon characters and lore support the viewer's story rather than replacing it.
- Reinterpret even a world-level or canon-character premise as what happens to YOU while it unfolds. The story must materially change if the viewer protagonist is removed.
- Define worldBible.viewerProtagonist with a concrete identity, reusable visual identity, goal, relationship to the world/cast, emotional anchor, and eight-step progression.
- In third-person mode, visualReferences[0] must be role "protagonist" and depict a distinct full-sized viewer-insert outsider—not a canon lead. In first-person mode it must be role "pov_hands" and lock the viewer's hands/body/style cues.
- Reference 1 must be assigned to every scene. Every scene must give YOU a concrete protagonistAction; YOU must witness, decide, discover, help, fail, fight, rescue, or choose—not merely stand in the background.
- The viewer protagonist must be compositionally important. Never let canon characters do the core action while YOU become a tiny background extra.
- Include at least one emotional relationship anchor, such as Pikachu choosing YOU, Lloyd learning to trust YOU, YOU saving a teammate, or YOU deciding whether to stay or leave.

STORYTELLING RULES (all required):
- INSTANT HOOK: scene 1 (day 1) must immediately show the impossible premise happening — never a normal establishing shot, walking, or exposition. A viewer must instantly understand "wait, what happened?"
- ESCALATION: every scene materially changes the story with a new action, danger, discovery, relationship beat, reveal, or consequence. Never repeat the same location, action, or framing across adjacent scenes.
- MILESTONE STRUCTURE: use exactly these day/dayScene pairs in order: Day 1 scene 1, Day 1 scene 2, Day 10 scene 1, Day 10 scene 2, Day 20 scene 1, Day 20 scene 2, Day 30 scene 1, Day 30 scene 2. Never invent intermediate days.
- TWO-BEAT DAYS: the first scene on each milestone day is setup/discovery/major event/first beat; the second is reaction/consequence/escalation/emotional beat/payoff for that same day. The pair must feel causally connected, not like duplicate shots.
- BEAT STRUCTURE: assign each scene exactly one beatType, all 8 must be used in this order: hook (Day 1 scene 1), consequence (Day 1 scene 2), adaptation (Day 10 scene 1), turning_point (Day 10 scene 2), reveal (Day 20 scene 1), lowpoint (Day 20 scene 2), climax (Day 30 scene 1), payoff (Day 30 scene 2).
- CHARACTER RELATIONSHIP: whenever the world has recognizable characters, the protagonist should build a relationship with at least one of them across the story (trust, companionship, rescue, sacrifice) so the audience has someone to care about.
- RECOGNIZABILITY: every scene must include at least one unmistakable signal of the exact source material (a named canon character, a signature creature/species, an iconic prop, or an iconic location) — never a generic frame that could belong to any other franchise.
- VISUAL EVENT: every scene needs one concrete visible event/action (something opens, breaks, activates, arrives, transforms) — never a static "everyone stands around" moment. Put this in "visualEvent" as a short phrase.
- DAY NUMBERS: day and dayScene must exactly match [1/1, 1/2, 10/1, 10/2, 20/1, 20/2, 30/1, 30/2].

CAMERA MODE: choose "first_person" only if the premise strongly implies POV / "you wake up" / immersive life-simulation framing; otherwise default to "third_person" cinematic so relationships and actions can be shown clearly.

VISUAL REFERENCES (exactly 5 total):
- Reference 1 is mandatory: include a "protagonist" reference (full-body viewer identity: exact clothing/colors/silhouette) UNLESS cameraMode is first_person, in which case Reference 1 must be "pov_hands" (POV hands/arms/body cues in the world's rendering style).
- Include a "core_cast_style" reference when the world has recognizable named characters — this reference should establish both the cast AND the franchise's rendering style (e.g. genuine LEGO minifigure proportions, or correct anime cel-shading, or correct creature anatomy — never generic).
- Include "environment_primary" (the main recognizable location) and, when the story needs a second distinct location, "environment_secondary".
- Include "antagonist" only when the story has a clear villain/threat character.
- Include "artifact", "companion", or "vehicle" only when genuinely central to the story (e.g. a magic object the plot revolves around).
- Each reference needs: a short "label", a detailed "prompt" (enough detail for a high-fidelity single-subject reference image, describing exactly what it should show against a clean neutral background), and a "visualLock" (the 2-4 non-negotiable visual traits that must stay identical every time this reference is reused — exact colors, proportions, outfit, or design details).

SCENE REFERENCE ASSIGNMENT: each scene gets "referenceIds" — an array of 1-3 reference ids (referencing the "id" field of the visualReferences you defined) that should anchor that scene's identity. Reference 1 (protagonist/pov_hands) must be the first id in every scene, with no exceptions in V1. Choose the other 1-2 references based on what that scene actually needs.

FRANCHISE STYLE LOCK: worldBible.hardVisualRules must state the franchise's exact rendering language in imperative form (e.g. "genuine plastic LEGO minifigure proportions with LEGO hands/heads/legs, brick-built environments" or "recognizable Pokemon anatomy and proportions, polished cinematic 3D style, never a random generic animal"). worldBible.negativeRules must list what to avoid (e.g. "no realistic human faces replacing LEGO characters", "no flat cartoon or anime style drift").

SELECTED VISUAL STYLE (pipeline-wide): obey the supplied style mode and directive throughout the world bible, viewer protagonist design, core cast, environments, antagonist/artifact references, visual locks, negative rules, every scene image prompt, and QA expectations. Style changes rendering interpretation, never canon identity. For Auto / Franchise Accurate, infer the franchise's native visual language from research instead of imposing generic 3D, anime, or realism. For a reinterpretation such as Ninjago + realistic, retain unmistakable Lloyd/Kai/etc. silhouettes, signature colors, outfits, props, and roles even though materials and rendering become live action.

Never put collage/reference-panel explanations in the scene prompts — the server adds those separately. imagePrompt should describe the actual frame content (who, where, doing what, camera framing, emotion) at high detail — describe an actual movie frame, not a vague summary. videoPrompt should describe the ~5 second action chain (what happens across the clip, camera movement, character movement) ending on the visualEvent — no dialogue, no captions, no on-screen text, silent clip.`;

const REFERENCE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["id", "role", "label", "prompt", "visualLock"],
  properties: {
    id: { type: "string" },
    role: { type: "string", enum: REF_ROLES },
    label: { type: "string" },
    prompt: { type: "string" },
    visualLock: { type: "string" },
  },
};

const VIEWER_PROTAGONIST_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["identity", "visualIdentity", "goal", "worldRelationship", "emotionalAnchor", "progression"],
  properties: {
    identity: { type: "string" },
    visualIdentity: { type: "string" },
    goal: { type: "string" },
    worldRelationship: { type: "string" },
    emotionalAnchor: { type: "string" },
    progression: { type: "array", minItems: SCENE_COUNT, maxItems: SCENE_COUNT, items: { type: "string" } },
  },
};

const SCENE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["day", "dayScene", "title", "beatType", "location", "characters", "referenceIds", "protagonistAction", "visualGoal", "storyDevelopment", "imagePrompt", "videoPrompt", "visualEvent"],
  properties: {
    day: { type: "integer" },
    dayScene: { type: "integer", minimum: 1, maximum: 2 },
    title: { type: "string" },
    beatType: { type: "string", enum: BEAT_TYPES },
    location: { type: "string" },
    characters: { type: "array", items: { type: "string" } },
    referenceIds: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 },
    protagonistAction: { type: "string" },
    visualGoal: { type: "string" },
    storyDevelopment: { type: "string" },
    imagePrompt: { type: "string" },
    videoPrompt: { type: "string" },
    visualEvent: { type: "string" },
  },
};

const PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "hook", "cameraMode", "visualStyle", "worldBible", "visualReferences", "scenes"],
  properties: {
    title: { type: "string" },
    hook: { type: "string" },
    cameraMode: { type: "string", enum: ["third_person", "first_person"] },
    visualStyle: { type: "string", enum: Object.keys(STYLE_DIRECTIVES) },
    worldBible: {
      type: "object",
      additionalProperties: false,
      required: ["world", "medium", "visualStyle", "viewerProtagonist", "architecture", "locations", "characters", "creatures", "recurringProps", "powers", "palette", "hardVisualRules", "negativeRules", "franchise", "era", "confidence"],
      properties: {
        world: { type: "string" },
        medium: { type: "string" },
        visualStyle: { type: "string" },
        viewerProtagonist: VIEWER_PROTAGONIST_SCHEMA,
        architecture: { type: "array", items: { type: "string" } },
        locations: { type: "array", items: { type: "string" } },
        characters: { type: "array", items: { type: "string" } },
        creatures: { type: "array", items: { type: "string" } },
        recurringProps: { type: "array", items: { type: "string" } },
        powers: { type: "array", items: { type: "string" } },
        palette: { type: "string" },
        hardVisualRules: { type: "array", items: { type: "string" } },
        negativeRules: { type: "array", items: { type: "string" } },
        franchise: { type: ["string", "null"] },
        era: { type: ["string", "null"] },
        confidence: { type: "number" },
      },
    },
    visualReferences: { type: "array", minItems: REF_COUNT, maxItems: REF_COUNT, items: REFERENCE_SCHEMA },
    scenes: { type: "array", minItems: SCENE_COUNT, maxItems: SCENE_COUNT, items: SCENE_SCHEMA },
  },
};

function plannerInput(universe: string, premise: string, researchNotes: string, visualStyle: string, correction = "") {
  return [
    `WORLD: ${universe}`,
    `PREMISE (the "what happens for 30 days" idea — build the story around exactly this): ${premise}`,
    `SELECTED VISUAL STYLE MODE: ${visualStyle}`,
    `STYLE DIRECTIVE (apply across the entire pipeline): ${STYLE_DIRECTIVES[visualStyle]}`,
    `CANON RESEARCH:`,
    researchNotes,
    correction ? `\nPREVIOUS ATTEMPT HAD ISSUES — FIX THESE SPECIFICALLY:\n${correction}` : "",
  ].filter(Boolean).join("\n\n");
}

/* ============================ Critic stage ============================ */

const CRITIC_INSTRUCTIONS = `You are a strict viral-video story critic. Given an 8-scene "30 days" story plan grouped into four milestone days, check it against these rules and report failures:
1. Scene 1 (day 1) must show the impossible premise happening immediately — not a normal/calm moment.
2. No two scenes share the same location AND the same core action.
3. All 8 beatTypes (hook, consequence, adaptation, turning_point, reveal, lowpoint, climax, payoff) must be present in order with no duplicates.
4. There must be a genuine reveal/twist (not just "things continue") and a genuine setback/low point (not just "things are hard").
5. The climax scene must be more visually significant than the early scenes.
6. The payoff (day 30) must be a satisfying, specific ending beat — not a flat "they won" with no detail.
7. The exact day/dayScene sequence must be 1/1, 1/2, 10/1, 10/2, 20/1, 20/2, 30/1, 30/2. Each same-day pair must form setup/event → reaction/consequence, not repeat the same beat.
8. worldBible.viewerProtagonist must define a distinct YOU-character with a goal, world/cast relationship, emotional anchor, and progression. Reject a canon lead masquerading as the viewer.
9. visualReferences[0] must be the viewer protagonist (or pov_hands in first-person), and its id must be first in every scene's referenceIds.
10. Every scene must give YOU a concrete protagonistAction and meaningful participation. Reject the plan if canon characters could perform the same story without YOU, or if YOU disappears/becomes a background extra.
11. The selected visual style must be reflected consistently in worldBible.visualStyle, hardVisualRules, negativeRules, every reference prompt/visualLock, and every scene imagePrompt without erasing franchise identity.
Return passed=true only if ALL checks pass. Otherwise list the specific issues found, one per array item, each naming the scene/day it applies to.`;

const CRITIC_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["passed", "issues"],
  properties: {
    passed: { type: "boolean" },
    issues: { type: "array", items: { type: "string" } },
  },
};

function deterministicCriticIssues(plan: any): string[] {
  const issues: string[] = [];
  const scenes = Array.isArray(plan?.scenes) ? plan.scenes : [];
  if (scenes.length !== SCENE_COUNT) return ["Plan does not have exactly 8 scenes."];

  const cameraMode = plan?.cameraMode === "first_person" ? "first_person" : "third_person";
  const requiredRole = cameraMode === "first_person" ? "pov_hands" : "protagonist";
  const refs = Array.isArray(plan?.visualReferences) ? plan.visualReferences : [];
  const selectedStyle = resolveVisualStyle(String(plan?.visualStyle ?? plan?.worldBible?.styleMode ?? ""));
  if (plan?.worldBible?.styleMode && plan.worldBible.styleMode !== selectedStyle) issues.push("World bible style mode does not match the selected visual style.");
  if (String(plan?.worldBible?.visualStyle ?? "").trim().length < 12) issues.push("World bible is missing a concrete visual style interpretation.");
  if (!Array.isArray(plan?.worldBible?.hardVisualRules) || !plan.worldBible.hardVisualRules.length) issues.push("World bible is missing hard visual style rules.");
  if (!Array.isArray(plan?.worldBible?.negativeRules) || !plan.worldBible.negativeRules.length) issues.push("World bible is missing negative style rules.");
  const viewerRef = refs[0];
  if (!viewerRef || viewerRef.role !== requiredRole) issues.push(`Reference 1 must use role ${requiredRole}.`);
  const viewer = plan?.worldBible?.viewerProtagonist;
  for (const field of ["identity", "visualIdentity", "goal", "worldRelationship", "emotionalAnchor"]) {
    if (String(viewer?.[field] ?? "").trim().length < 5) issues.push(`Viewer protagonist is missing ${field}.`);
  }
  if (!Array.isArray(viewer?.progression) || viewer.progression.length !== SCENE_COUNT) {
    issues.push("Viewer protagonist progression must contain exactly 8 story steps.");
  }
  if (viewerRef?.id) {
    scenes.forEach((scene: any, index: number) => {
      if (scene?.referenceIds?.[0] !== viewerRef.id) issues.push(`Scene ${index + 1} must use Reference 1 as its first identity anchor.`);
      if (String(scene?.protagonistAction ?? "").trim().length < 5) issues.push(`Scene ${index + 1} is missing a concrete YOU action.`);
    });
  }

  scenes.forEach((scene: any, index: number) => {
    const expectedDay = MILESTONE_DAYS[index];
    const expectedDayScene = index % 2 + 1;
    if (Number(scene.day) !== expectedDay || Number(scene.dayScene) !== expectedDayScene) {
      issues.push(`Scene ${index + 1} must be Day ${expectedDay}, scene ${expectedDayScene}.`);
    }
  });

  const beatTypes = scenes.map((s: any) => String(s.beatType));
  const missingBeats = BEAT_TYPES.filter((b) => !beatTypes.includes(b));
  if (missingBeats.length) issues.push(`Missing required beat types: ${missingBeats.join(", ")}.`);
  if (beatTypes.some((beat, index) => beat !== BEAT_TYPES[index])) {
    issues.push(`Beat types must follow this exact order: ${BEAT_TYPES.join(", ")}.`);
  }

  const locationActionKeys = scenes.map((s: any) => `${String(s.location).toLowerCase()}|${String(s.visualEvent).toLowerCase()}`);
  const seen = new Map<string, number>();
  locationActionKeys.forEach((key) => seen.set(key, (seen.get(key) ?? 0) + 1));
  const repeated = [...seen.entries()].filter(([, count]) => count >= 2);
  if (repeated.length) issues.push("Two or more scenes repeat the same location and visual event — increase visual variety.");

  return issues;
}

/* ============================ Fallback plan ============================ */

function fallbackPlan(universe: string, premise: string, visualStyle = DEFAULT_VISUAL_STYLE) {
  const world = universe;
  const styleDirective = STYLE_DIRECTIVES[visualStyle];
  const worldBible = {
    world, medium: visualStyle === "auto" ? "the franchise's native medium" : "selected cinematic reinterpretation",
    visualStyle: styleDirective, styleMode: visualStyle, styleDirective,
    architecture: ["recognizable canonical architecture"], locations: ["a central hub location", "a secondary iconic location"],
    viewerProtagonist: {
      identity: `YOU, a distinct outsider living in ${world} for 30 days`,
      visualIdentity: `A full-sized viewer-insert protagonist with one consistent ${world}-appropriate outfit, silhouette, and color signature`,
      goal: `Survive the 30-day crisis and help protect ${world}`,
      worldRelationship: `An outsider who gradually earns the trust of ${world}'s recognizable cast`,
      emotionalAnchor: "A canon ally begins trusting YOU, and the final choice tests that bond",
      progression: ["witnesses the crisis", "is pulled into the conflict", "adapts with an ally", "earns a first meaningful win", "discovers the real threat", "suffers a personal setback", "takes the decisive action", "resolves the goal and relationship"],
    },
    characters: [], creatures: [], recurringProps: [], powers: [],
    palette: "the world's canonical color palette",
    hardVisualRules: [`Faithful, recognizable ${world} character and environment design.`, styleDirective],
    negativeRules: ["No generic or off-model designs.", "Never erase canon identity while applying the selected rendering style.", "No text, captions, or watermarks."],
    franchise: world, era: null, confidence: 0.4,
  };
  const refs = [
    { id: "ref_protagonist", role: "protagonist", label: "Protagonist", prompt: `A full-body reference portrait of the protagonist entering ${world}, neutral standing pose, clean neutral background. ${styleDirective}`, visualLock: `consistent outfit, colors, silhouette, identity, and ${visualStyle} rendering` },
    { id: "ref_cast_style", role: "core_cast_style", label: "Core cast and style", prompt: `A clean reference sheet of the most recognizable cast designs in ${world}. ${styleDirective}`, visualLock: `canonical proportions, faces, signature colors, identities, and ${visualStyle} rendering` },
    { id: "ref_environment", role: "environment_primary", label: "Primary location", prompt: `A wide establishing reference image of the main iconic location in ${world}. ${styleDirective}`, visualLock: `consistent canonical architecture, landmarks, palette, and ${visualStyle} rendering` },
    { id: "ref_environment_secondary", role: "environment_secondary", label: "Secondary location", prompt: `A wide reference image of a second distinct and recognizable location in ${world}. ${styleDirective}`, visualLock: `consistent landmarks, materials, atmosphere, and ${visualStyle} rendering` },
    { id: "ref_story_anchor", role: "artifact", label: "Story-critical threat or artifact", prompt: `A clean single-subject reference of the central threat, opponent, vehicle, creature, or artifact driving the conflict in ${world}. ${styleDirective}`, visualLock: `identical silhouette, materials, signature colors, scale, and ${visualStyle} rendering` },
  ];
  const beatDescriptions = [
    ["hook", `The premise happens immediately: ${premise}`],
    ["consequence", "The protagonist reacts and is pulled directly into the conflict."],
    ["adaptation", "The protagonist and an ally act together and make visible progress."],
    ["turning_point", "Their progress triggers a first danger, mini-win, or important turn."],
    ["reveal", "A concrete reveal exposes the real problem behind the premise."],
    ["lowpoint", "The reveal causes a serious loss, damage, or emotional setback."],
    ["climax", "The protagonist makes the biggest, most visually dramatic final attempt."],
    ["payoff", "The final action concretely resolves the original goal with a specific outcome."],
  ] as const;
  const scenes = beatDescriptions.map(([beatType, storyDevelopment], index) => ({
    day: MILESTONE_DAYS[index],
    dayScene: index % 2 + 1,
    title: `Day ${MILESTONE_DAYS[index]} · Scene ${index % 2 + 1}`,
    beatType,
    location: refs[1].label,
    characters: [`YOU — the viewer-insert protagonist in ${world}`],
    referenceIds: [refs[0].id, index < 6 ? refs[1].id : refs[4].id, index < 4 ? refs[2].id : refs[3].id],
    protagonistAction: `YOU ${storyDevelopment.charAt(0).toLowerCase()}${storyDevelopment.slice(1)}`,
    visualGoal: storyDevelopment,
    storyDevelopment,
    imagePrompt: `${storyDevelopment} Set in ${world}. ${styleDirective} Cinematic framing, full-bleed vertical 9:16, no text, no watermark.`,
    videoPrompt: `Animate this frame with one clear visual event that matches: ${storyDevelopment}. Silent, no dialogue, no captions.`,
    visualEvent: storyDevelopment,
  }));
  return {
    title: `30 Days in ${world}`,
    hook: `What would happen if ${premise}?`,
    visualStyle,
    cameraMode: "third_person",
    worldBible,
    visualReferences: refs,
    scenes,
  };
}

/* ============================ Post-processing ============================ */

function normalizePlan(plan: any, universe: string, premise: string, visualStyle = DEFAULT_VISUAL_STYLE) {
  const cameraMode = plan.cameraMode === "first_person" ? "first_person" : "third_person";
  const requiredRole = cameraMode === "first_person" ? "pov_hands" : "protagonist";
  const fallback = fallbackPlan(universe, premise, visualStyle);
  const rawReferences = Array.isArray(plan.visualReferences) ? plan.visualReferences : [];
  const suppliedViewerRef = rawReferences.find((ref: any) => ref?.role === requiredRole);
  const viewerRefSeed = suppliedViewerRef ?? (cameraMode === "first_person" ? {
    id: "ref_pov_identity",
    role: "pov_hands",
    label: "YOU — POV identity",
    prompt: `A first-person identity reference for YOU in ${universe}: both hands, forearms, sleeves, body-type cues, and one distinctive accessory, clean neutral background. ${STYLE_DIRECTIVES[visualStyle]}`,
    visualLock: `identical hands, sleeves, body cues, colors, distinctive accessory, and ${visualStyle} rendering`,
  } : fallback.visualReferences[0]);
  const orderedReferenceSeeds = [
    { ...viewerRefSeed, role: requiredRole, id: String(viewerRefSeed.id || (cameraMode === "first_person" ? "ref_pov_identity" : "ref_protagonist")) },
    ...rawReferences.filter((ref: any) => ref !== suppliedViewerRef && ref?.role !== "protagonist" && ref?.role !== "pov_hands"),
  ].slice(0, REF_COUNT);
  const visualReferences = orderedReferenceSeeds.map((ref: any, index: number) => ({
    id: String(ref.id || `ref_${index}`),
    role: REF_ROLES.includes(ref.role) ? ref.role : "environment_primary",
    label: String(ref.label || `Reference ${index + 1}`),
    prompt: String(ref.prompt || ""),
    visualLock: String(ref.visualLock || ""),
    imageUrl: null, jobId: null, status: "idle",
  }));
  const refIds = new Set(visualReferences.map((ref: any) => ref.id));
  const protagonistRef = visualReferences[0];

  const scenes = (plan.scenes ?? []).slice(0, SCENE_COUNT).map((scene: any, index: number) => {
    let referenceIds = Array.isArray(scene.referenceIds) ? scene.referenceIds.filter((id: string) => refIds.has(id)).slice(0, 3) : [];
    referenceIds = [protagonistRef.id, ...referenceIds.filter((id: string) => id !== protagonistRef.id)].slice(0, 3);
    return {
      index,
      day: MILESTONE_DAYS[index],
      dayScene: index % 2 + 1,
      title: String(scene.title || `Day ${MILESTONE_DAYS[index]} · Scene ${index % 2 + 1}`),
      beatType: BEAT_TYPES.includes(scene.beatType) ? scene.beatType : BEAT_TYPES[index],
      location: String(scene.location || universe),
      characters: Array.isArray(scene.characters) ? scene.characters.map(String).slice(0, 6) : [],
      referenceIds,
      protagonistAction: String(scene.protagonistAction || `YOU actively shape this beat: ${scene.storyDevelopment || scene.visualEvent || scene.title}`),
      visualGoal: String(scene.visualGoal || ""),
      storyDevelopment: String(scene.storyDevelopment || ""),
      imagePrompt: String(scene.imagePrompt || ""),
      videoPrompt: String(scene.videoPrompt || ""),
      visualEvent: String(scene.visualEvent || "something visibly changes"),
      collageUrl: null, imageUrl: null, imageJobId: null, imageStatus: "idle",
      videoUrl: null, videoJobId: null, videoStatus: "idle",
    };
  });

  // Deterministic milestone repair — the format contract is fixed for V1.
  scenes.forEach((scene: any, index: number) => {
    scene.day = MILESTONE_DAYS[index];
    scene.dayScene = index % 2 + 1;
  });

  return {
    title: String(plan.title || `30 Days in ${universe}`),
    hook: String(plan.hook || `What would happen if ${premise}?`),
    cameraMode,
    visualStyle,
    worldBible: {
      ...(plan.worldBible ?? {}),
      styleMode: visualStyle,
      styleDirective: STYLE_DIRECTIVES[visualStyle],
      visualStyle: String(plan.worldBible?.visualStyle || STYLE_DIRECTIVES[visualStyle]),
      hardVisualRules: [...new Set([...(plan.worldBible?.hardVisualRules ?? []), STYLE_DIRECTIVES[visualStyle]])],
      negativeRules: [...new Set([...(plan.worldBible?.negativeRules ?? []), "Never erase recognizable franchise identity while applying the selected visual style."])],
      viewerProtagonist: plan.worldBible?.viewerProtagonist ?? fallback.worldBible.viewerProtagonist,
    },
    visualReferences,
    scenes,
  };
}

/* ============================ Main handler ============================ */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authorization = req.headers.get("Authorization") ?? "";
  const token = authorization.replace("Bearer ", "");
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return json({ error: "Unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  const universe = String(body.universe ?? "").trim().slice(0, 120);
  const rawPremise = String(body.premise ?? "").trim().slice(0, 300);
  const aiIdeaMode = Boolean(body.aiIdeaMode ?? true);
  if (universe.length < 2) return json({ error: "Tell us what world we're entering." }, 400);
  if (rawPremise.length < 5) return json({ error: "Tell us what happens for 30 days." }, 400);
  const premise = ensureViewerPremise(rawPremise, universe).slice(0, 300);

  const { data: earlyProfile } = await admin.from("profiles").select("plan_code").eq("id", user.id).single();
  const planCode = String(earlyProfile?.plan_code ?? "free").toLowerCase();
  if (!["starter", "affiliate", "pro", "generative"].includes(planCode)) {
    return json({ error: "PLAN_UPGRADE_REQUIRED" }, 403);
  }
  const requestedVisualStyle = resolveVisualStyle(String(body?.settings?.visualStyle ?? ""));
  const { data: tierRows, error: tierError } = await admin.from("thirty_days_quality_tiers").select("*");
  if (tierError || !tierRows?.length) {
    console.error("[thirty-days-planner] pricing unavailable", tierError);
    return json({ error: "PRICING_NOT_CONFIGURED", message: "30 Days pricing is not configured." }, 503);
  }
  const tiers = Object.fromEntries(tierRows.map((row: any) => [row.quality_tier, {
    id: row.quality_tier, label: row.label, minPlan: row.min_plan,
    referenceToolKey: row.reference_tool_key, referenceWidth: Number(row.reference_width), referenceHeight: Number(row.reference_height), referenceCredits: Number(row.reference_cost_credits),
    imageToolKey: row.image_tool_key, imageWidth: Number(row.image_width), imageHeight: Number(row.image_height), imageCredits: Number(row.image_cost_credits),
    videoToolKey: row.video_tool_key, videoProvider: row.video_provider, videoModel: row.video_model,
    videoWidth: Number(row.video_width), videoHeight: Number(row.video_height), videoDurationSec: Number(row.video_duration_seconds), videoCredits: Number(row.video_cost_credits),
    withSound: false,
  } as QualityTier]));
  const resolvedQuality = resolveQualityTier(String(body?.settings?.quality ?? ""), planCode, tiers);
  const tier = tiers[resolvedQuality];

  const normalizedKey = normalizeKey(universe);
  const { data: cacheRow } = await admin.from("universe_reference_cache")
    .select("reference_json")
    .eq("normalized_key", normalizedKey)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  const cachedResearch = cacheRow?.reference_json && Number(cacheRow.reference_json.confidence ?? 0) >= 0.6
    ? String(cacheRow.reference_json.researchNotes || JSON.stringify(cacheRow.reference_json))
    : null;

  let researchNotes = cachedResearch ?? "";
  if (!researchNotes && OPENAI_KEY) {
    try {
      const researchPayload = await callOpenAI({
        model: "gpt-5-mini",
        store: false,
        instructions: RESEARCH_INSTRUCTIONS,
        input: researchInput(universe),
        tools: [{ type: "web_search", search_context_size: "medium" }],
      }, OPENAI_RESEARCH_TIMEOUT_MS);
      researchNotes = extractOutputText(researchPayload).trim().slice(0, 14_000);
    } catch (error) {
      console.error("[thirty-days-planner] research fallback:", String(error));
    }
  }

  let plan: any = null;
  if (OPENAI_KEY) {
    try {
      const planningPayload = await callOpenAI({
        model: "gpt-5-mini",
        store: false,
        instructions: PLANNER_INSTRUCTIONS,
        input: plannerInput(universe, premise, researchNotes || `(no research available — use general knowledge of ${universe})`, requestedVisualStyle),
        text: { format: { type: "json_schema", name: "thirty_days_plan", strict: true, schema: PLAN_SCHEMA } },
      }, OPENAI_PLAN_TIMEOUT_MS);
      plan = parseJson(extractOutputText(planningPayload));

      // Cheap deterministic pre-filter, then one structured critic pass. On
      // failure, one automatic repair attempt with the issues appended.
      let issues = deterministicCriticIssues(plan);
      if (!issues.length) {
        try {
          const criticPayload = await callOpenAI({
            model: "gpt-5-mini",
            store: false,
            instructions: CRITIC_INSTRUCTIONS,
            input: JSON.stringify(plan),
            text: { format: { type: "json_schema", name: "thirty_days_critic", strict: true, schema: CRITIC_SCHEMA } },
          }, OPENAI_CRITIC_TIMEOUT_MS);
          const critic = parseJson(extractOutputText(criticPayload));
          if (!critic?.passed && Array.isArray(critic?.issues) && critic.issues.length) issues = critic.issues;
        } catch (error) {
          console.warn("[thirty-days-planner] critic pass skipped:", String(error));
        }
      }

      if (issues.length) {
        try {
          const repairPayload = await callOpenAI({
            model: "gpt-5-mini",
            store: false,
            instructions: PLANNER_INSTRUCTIONS,
            input: plannerInput(universe, premise, researchNotes || `(no research available — use general knowledge of ${universe})`, requestedVisualStyle, issues.join("\n")),
            text: { format: { type: "json_schema", name: "thirty_days_plan", strict: true, schema: PLAN_SCHEMA } },
          }, OPENAI_PLAN_TIMEOUT_MS);
          plan = parseJson(extractOutputText(repairPayload));
        } catch (error) {
          console.warn("[thirty-days-planner] repair pass failed, keeping first draft:", String(error));
        }
      }
      if (deterministicCriticIssues(plan).length) plan = fallbackPlan(universe, premise, requestedVisualStyle);
    } catch (error) {
      console.error("[thirty-days-planner] structured planning fallback:", String(error));
    }
  }

  let normalized = normalizePlan(plan ?? fallbackPlan(universe, premise, requestedVisualStyle), universe, premise, requestedVisualStyle);
  if (normalized.visualReferences.length !== REF_COUNT || normalized.scenes.length !== SCENE_COUNT) {
    normalized = normalizePlan(fallbackPlan(universe, premise, requestedVisualStyle), universe, premise, requestedVisualStyle);
  }

  if (!cachedResearch && researchNotes) {
    const bytes = new TextEncoder().encode(researchNotes);
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))).map((b) => b.toString(16).padStart(2, "0")).join("");
    await admin.from("universe_reference_cache").upsert({
      normalized_key: normalizedKey,
      franchise: normalized.worldBible?.franchise ?? universe,
      era: normalized.worldBible?.era ?? null,
      // Cache canon research only. A chosen rendering style belongs to the
      // generation and must never poison future Auto/franchise-native plans.
      reference_json: {
        franchise: normalized.worldBible?.franchise ?? universe,
        era: normalized.worldBible?.era ?? null,
        researchNotes,
        confidence: normalized.worldBible?.confidence ?? 0.6,
      },
      source_hash: digest,
      updated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 86400_000).toISOString(),
    }, { onConflict: "normalized_key" });
  }

  const totalAssets = normalized.visualReferences.length + SCENE_COUNT * 2; // refs + (image+video) per scene
  const { data: generation, error: reserveError } = await admin.rpc("begin_thirty_days_generation", {
    p_user_id: user.id,
    p_universe: universe,
    p_ai_idea_mode: aiIdeaMode,
    p_premise: premise,
    p_plan: normalized,
    p_quality_tier: resolvedQuality,
  });
  if (reserveError) {
    const rawMessage = String(reserveError.message ?? "");
    const insufficient = rawMessage.includes("INSUFFICIENT_CREDITS");
    const upgrade = rawMessage.includes("PLAN_UPGRADE_REQUIRED");
    const migrationMismatch = reserveError.code === "PGRST202" || /function .*begin_thirty_days_generation.*not found|schema cache/i.test(rawMessage);
    const authIssue = reserveError.code === "42501" || /permission denied|not authorized/i.test(rawMessage);
    const invalidPlan = String(reserveError.code).startsWith("22") || String(reserveError.code).startsWith("23") || /INVALID_|PROFILE_NOT_FOUND/i.test(rawMessage);
    const diagnosticCode = insufficient ? "INSUFFICIENT_CREDITS"
      : upgrade ? "PLAN_UPGRADE_REQUIRED"
      : migrationMismatch ? "MIGRATION_MISMATCH"
      : authIssue ? "RESERVATION_PERMISSION_ERROR"
      : invalidPlan ? "RESERVATION_VALIDATION_ERROR"
      : "RESERVATION_DATABASE_ERROR";
    console.error("[thirty-days-planner] reservation failed", {
      diagnosticCode,
      code: reserveError.code,
      message: rawMessage,
      details: reserveError.details,
      hint: reserveError.hint,
      userId: user.id,
      quality: resolvedQuality,
      referenceCount: normalized.visualReferences.length,
    });
    const message = insufficient
      ? "You do not have enough credits for this generation."
      : upgrade
      ? "This quality tier is not included in your plan."
      : migrationMismatch
      ? "30 Days billing is not deployed on this project yet."
      : authIssue
      ? "Your session could not authorize the generation reservation."
      : invalidPlan
      ? "The generated plan could not be priced safely. Please try again."
      : "The generation reservation could not be saved. Please try again.";
    return json(
      { error: diagnosticCode, diagnosticCode, message },
      insufficient ? 402 : upgrade ? 403 : 500,
    );
  }

  return json({
    ok: true,
    generation,
    tier,
    totalAssets,
  });
});
