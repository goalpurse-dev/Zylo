// generate-long-form-ideas/index.ts
//
// Real backend for Long Form's "Discover Ideas" — replaces the frontend
// mock (mockIdeaEngine.js). Given a category/direction preference and the
// ideas already shown this session, generates a larger internal candidate
// pool, ranks/filters it for long-form viability + diversity + dedup, and
// returns the strongest `count` (default 10) as clean structured JSON.
//
// POST { category?, direction?, count?, existingIdeas?, seriesContext? }
// Returns { ideas: Idea[] } — see IDEA_SCHEMA below for the exact shape.
//
// All generation instructions/quality rules live here, server-side, on
// purpose (see section "why server-side" below) — the frontend only ever
// sends structured preferences and gets back structured results.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";
import { logEvent } from "../_shared/systemLog.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY")!;
const OPENAI_CHAT = "https://api.openai.com/v1/chat/completions";
const SOURCE = "generate-long-form-ideas";

// gpt-4o-mini: same model every other Zyvo idea/planning function already
// uses (thirty-days-idea, fruit-story-ideas, etc.) via OpenAI's native
// strict json_schema structured output — cheap, reliable, no new provider.
const MODEL = "gpt-4o-mini";

/* ============================= Request shape ============================= */

const CATEGORY_GUIDE: Record<string, string> = {
  history: "Historical events, eras, figures, civilizations, or historical systems/mechanisms.",
  science: "Physical, chemical, biological, or general scientific phenomena and mechanisms.",
  technology: "How technology, software, hardware, or engineered digital systems work or came to be.",
  business_economics: "Business history, economic mechanisms, markets, companies, financial systems.",
  engineering: "How engineered structures, machines, or systems work, are built, or fail.",
  geography_culture: "Geography, places, cultural phenomena, human geography, regional systems.",
  nature_biology: "Living organisms, ecosystems, biological mechanisms, animal or plant behavior.",
  space: "Astronomy, astrophysics, space exploration, cosmic phenomena and scale.",
  society_psychology: "Human behavior, psychology, social systems, societal phenomena.",
  survival_extreme: "Survival mechanisms, extreme environments or conditions, endurance under constraint.",
};
const CATEGORY_VALUES = Object.keys(CATEGORY_GUIDE);

// Interpreted meanings, not just words appended to the prompt (per product spec).
const DIRECTION_GUIDE: Record<string, string> = {
  high_curiosity: "Built around a question, mystery, or mechanism that creates an immediate need to know the answer.",
  evergreen: "Likely to stay relevant for years — not dependent on current news or trends.",
  unexpected: "Counterintuitive, overlooked, strange, or surprising angles on the subject.",
  story_driven: "Has a natural sequence, conflict, transformation, rise/fall, or investigation — a narrative arc.",
  educational: "Strong explanatory value; the viewer walks away genuinely understanding something useful.",
  deep_dive: "Specialized enough to support a detailed, in-depth 8-15 minute treatment rather than a surface pass.",
  broad_appeal: "Understandable and interesting to a wide general audience with no specialist background.",
};
const DIRECTION_VALUES = Object.keys(DIRECTION_GUIDE);

// Idea-generation OPERATORS, not rigid title templates — a way of asking
// "what kind of question is this idea built around?" so the model has a
// deliberately wide toolkit instead of defaulting to one shape (e.g. only
// "how X works"). Deliberately topic-agnostic: none of these mention any
// specific domain, so this never turns the engine into a history/survival
// generator on its own — CATEGORY_GUIDE and the topic-agnostic instruction
// in buildCandidatePrompt do that work.
const ARCHETYPE_GUIDE: Record<string, string> = {
  mechanism: "How does X actually work? — the hidden mechanics behind something familiar.",
  hidden_system: "What really happens behind X? — an invisible system most people never see.",
  lived_experience: "What was it actually like to live through X? — grounded first-person texture, not just facts.",
  survival_era: "Could you survive X? / How would a person survive X? — a constraint-driven thought experiment.",
  day_in_the_life: "What was a normal day like for X? — ordinary routine made vivid.",
  before_modern_tech: "How did people do X before Y existed? — solving a problem without a tool we now take for granted.",
  extreme_condition: "How does X function under extreme Y? — a system pushed to its limits.",
  mystery: "What really happened to X? — an unresolved or debated question.",
  rise_collapse: "Why did X become dominant and then fail? — an arc of ascent and decline.",
  hypothetical: "What would happen if X suddenly changed or disappeared? — a grounded counterfactual.",
  engineering: "How was X possible with the technology of the time? — ingenuity under real constraints.",
  biology: "What happens inside X when Y occurs? — an internal biological process made visible.",
  scale: "What happens at an almost unimaginable scale? — scale itself as the hook.",
  misconception: "What most people get wrong about X — correcting a widely-believed error.",
  cause_consequence: "How did X quietly change Y? — an underappreciated causal chain.",
  reconstruction: "What would you see/experience if you were there? — vivid scene reconstruction of a real place/moment.",
};
const ARCHETYPE_VALUES = Object.keys(ARCHETYPE_GUIDE);

const DEFAULT_CATEGORY = "all";
const DEFAULT_DIRECTION = "high_curiosity";
const MIN_COUNT = 1;
const MAX_COUNT = 10;
const POOL_SIZE = 24;
const MAX_EXISTING_CONTEXT = 40;

interface ExistingIdeaRef {
  title: string;
  topic: string;
  angle: string;
}

// Single place a request becomes an internal generation context. Extra
// context sources (previous published topics, series/channel history, topic
// embeddings) can be added as new optional fields here later without
// touching the prompt-building functions' call sites — see "future context"
// note on DiscoveryContext below.
interface DiscoveryContext {
  categoryValue: string; // "all" or one of CATEGORY_VALUES
  directionValue: string; // one of DIRECTION_VALUES
  requestedCount: number;
  existingIdeas: ExistingIdeaRef[];
  // Accepted and threaded through today; not yet backed by any real Series.
  // Series will eventually supply a style/identity summary here.
  seriesContext: { summary?: string } | null;
  // FUTURE CONTEXT (not implemented): previousPublishedTopics,
  // rejectedIdeaHistory, channelTopicEmbeddings. Add as new optional
  // DiscoveryContext fields + a corresponding paragraph in
  // buildContextBlock() — no other function needs to change shape.
}

function buildDiscoveryContext(body: any): DiscoveryContext {
  const rawCategory = String(body?.category ?? DEFAULT_CATEGORY).trim();
  const categoryValue = rawCategory === "all" || CATEGORY_VALUES.includes(rawCategory) ? rawCategory : DEFAULT_CATEGORY;

  const rawDirection = String(body?.direction ?? DEFAULT_DIRECTION).trim();
  const directionValue = DIRECTION_VALUES.includes(rawDirection) ? rawDirection : DEFAULT_DIRECTION;

  const requestedCount = Math.min(MAX_COUNT, Math.max(MIN_COUNT, Math.round(Number(body?.count) || 10)));

  const existingRaw = Array.isArray(body?.existingIdeas) ? body.existingIdeas : [];
  const existingIdeas: ExistingIdeaRef[] = existingRaw
    .slice(-MAX_EXISTING_CONTEXT)
    .map((item: any) => ({
      title: String(item?.title ?? "").slice(0, 160),
      topic: String(item?.topic ?? "").slice(0, 300),
      angle: String(item?.angle ?? "").slice(0, 300),
    }))
    .filter((item: ExistingIdeaRef) => item.title.length > 0);

  const seriesContext =
    body?.seriesContext && typeof body.seriesContext === "object"
      ? { summary: typeof body.seriesContext.summary === "string" ? body.seriesContext.summary.slice(0, 500) : undefined }
      : null;

  return { categoryValue, directionValue, requestedCount, existingIdeas, seriesContext };
}

/* ============================= Prompt building ============================= */

// Why server-side: the generation instructions, quality rules, and ranking
// criteria are the actual product IP of this feature. Keeping them here
// means the engine can be improved without shipping client code or exposing
// every internal prompt/rule to anyone reading the frontend bundle.

function buildContextBlock(context: DiscoveryContext): string {
  const parts: string[] = [];

  parts.push(
    context.categoryValue === "all"
      ? "CATEGORY: All topics — produce genuine breadth across many domains (history, science, technology, business & economics, engineering, geography & culture, nature & biology, space, society & psychology, survival & extreme, and beyond). Do NOT use a fixed quota per domain, and do NOT let two or three domains dominate the batch either — as a concrete floor, this batch should span AT LEAST 6 of the 10 categories at least once each. Breadth across domains matters here as much as breadth across archetypes."
      : `CATEGORY: ${context.categoryValue} — ${CATEGORY_GUIDE[context.categoryValue]} Nearly every idea should meaningfully belong to this domain.`
  );

  parts.push(`DIRECTION: ${context.directionValue} — ${DIRECTION_GUIDE[context.directionValue]}`);

  if (context.existingIdeas.length) {
    parts.push(
      `IDEAS ALREADY SHOWN THIS SESSION (never repeat these, and never propose a near-identical rewrite — same entity + same central question/angle counts as a duplicate even if phrased differently):\n` +
        context.existingIdeas.map((idea, i) => `${i + 1}. "${idea.title}" — topic: ${idea.topic} — angle: ${idea.angle}`).join("\n")
    );
  }

  if (context.seriesContext?.summary) {
    parts.push(`SERIES CONTEXT (this project belongs to an existing creative identity): ${context.seriesContext.summary}`);
  }

  return parts.join("\n\n");
}

function buildArchetypeGuidance(context: DiscoveryContext): string {
  const lines = ARCHETYPE_VALUES.map((key) => `- ${key}: ${ARCHETYPE_GUIDE[key]}`).join("\n");
  let emphasis = "";
  if (context.directionValue === "high_curiosity") {
    emphasis =
      "\n\nSince direction is high_curiosity, lean more heavily (not exclusively) on lived_experience, survival_era, mystery, extreme_condition, hypothetical, and hidden_system — these tend to produce the strongest immediate hooks — while still keeping every idea intellectually legitimate, not just sensational.";
  } else if (context.directionValue === "story_driven") {
    emphasis =
      "\n\nSince direction is story_driven, favor archetypes with real progression: rise_collapse, lived_experience, survival_era, mystery, and reconstruction — ideas with conflict, transformation, or investigation that a future Narrative Director can map onto a clear arc.";
  }
  return `These are idea-generation OPERATORS — ways of framing a question — not rigid title templates. Use them as tools, not a checklist to cycle through in order:\n${lines}${emphasis}`;
}

function buildCandidatePrompt(context: DiscoveryContext): string {
  return `You are Zyvo's Long Form Idea Discovery Engine, generating concepts for an AI-produced 2D illustrated explainer/documentary YouTube channel. Videos run 8-15 minutes.

${buildContextBlock(context)}

Privately generate exactly ${POOL_SIZE} genuinely different candidate video ideas. This is a topic-agnostic engine — it must work across essentially any viable informational/explainer/documentary domain (history, science, technology, engineering, business, economics, geography, culture, biology, nature, space, psychology, society, infrastructure, architecture, transportation, food, energy, historical crime, medicine history, inventions, survival, oceans, systems, hypotheticals, and more). These are examples, not a checklist to cycle through.

${buildArchetypeGuidance(context)}

Across these ${POOL_SIZE} ideas, actively vary the ARCHETYPE too, not just the subject — a good "All topics" batch might naturally mix mechanism, lived_experience, science, hypothetical, survival_era, engineering, a business story, nature, mystery, and a social system, with meaningful variety rather than a fixed quota. Do NOT let the batch read like one archetype repeated with different nouns (e.g. many "Could you survive X" ideas back to back) — that is exactly the failure mode to avoid, however good each individual idea is.

Each idea needs enough conceptual depth for a future research -> story -> script -> visual-plan pipeline. Reject anything too narrow to develop, so broad it needs an encyclopedia, dependent on one weak fact, a 30-second idea stretched to 10 minutes, impossible to explain visually, meaningless clickbait, or pure opinion with no informational substance. This applies just as much to experience/survival-framed ideas: "Could You Survive Medieval London?" must still promise real educational substance (housing, food, water, disease, work, sanitation, social rules — whatever the topic's real facts are) — the "could you survive" framing is a hook for genuine information, never an excuse for fictional roleplay with no factual payload.

Strong ideas usually have several (not necessarily all) of: a clear central question, a strong mechanism, a hidden system, human consequence, tension, transformation, a surprising fact, contrast, a chronological arc, cause/effect, a misconception being corrected, an extreme constraint, a useful explanation, scale, mystery, or a strong visual world.

AVOID generic AI-sounding titles: "The Fascinating World of X", "Exploring the Secrets of X", "The Incredible History of X", "Everything You Need to Know About X", "The Ultimate Guide to X". Prefer specific curiosity instead — e.g. not "The Fascinating World of Submarines" but "How Nuclear Submarines Make Oxygen for Months Underwater"; not "The History of Refrigeration" but "How People Kept Food Cold Before Refrigerators Existed".

Across these ${POOL_SIZE} ideas, also vary: entities, question forms, mechanisms, time periods, narrative structures, locations, scales, and subject types.

For each idea, write:
- title: a specific, clickable YouTube-style working title (not a generic label).
- topic: one precise sentence stating the canonical concept for a downstream research engine — more formal/complete than the title.
- angle: 1-2 sentences explaining why THIS version of the topic is interesting — the viewer promise.
- category: the single best-fit category from this exact list: ${CATEGORY_VALUES.join(", ")}.
- direction: the single best-fit direction from this exact list: ${DIRECTION_VALUES.join(", ")}.
- narrativeArchetype: the single best-fit archetype from this exact list: ${ARCHETYPE_VALUES.join(", ")}. Internal only — never shown to the viewer, but it will help a future step pick the right narrative structure.
- visualDirection: a concrete description of ONE compelling scene for a 16:9 illustrated image — describe WHAT should be shown (subject, setting, composition, a sense of scale or contrast if relevant), never the rendering/art style, and never any text, letters, words, captions, titles, logos, watermarks, UI, numbers, or labels appearing in the image.

Return JSON only.`;
}

const SCORE_KEYS = [
  "curiosity",
  "clarity",
  "diversity",
  "longFormViability",
  "visualPotential",
  "narrativePotential",
  "specificity",
  "novelty",
  "categoryFit",
  "directionFit",
] as const;

function buildRankingPrompt(context: DiscoveryContext, candidates: any[]): string {
  return `You are Zyvo's strict Long Form idea evaluator. Score these ${candidates.length} candidate video ideas for an 8-15 minute AI-produced 2D illustrated explainer/documentary video.

${buildContextBlock(context)}

Score every dimension from 1-10:
- curiosity: does it create an immediate need to know the answer?
- clarity: is the concept immediately understandable?
- diversity: how distinct is this idea (entity, mechanism, angle, structure, AND narrative archetype) compared to the OTHER candidates in this list — score low if several candidates share the same archetype and cover similar ground (e.g. multiple "could you survive" ideas back to back), even if each is individually decent.
- longFormViability: enough depth for a real 8-15 minute treatment (not too narrow, not encyclopedic, not a stretched short).
- visualPotential: can this be shown as a compelling illustrated scene?
- narrativePotential: does it have a natural arc, tension, or transformation?
- specificity: is it a specific concept, not a generic label like "The Fascinating World of X"?
- novelty: does it avoid feeling like a cliche or overused idea format?
- categoryFit: how well it matches the requested category (score high regardless of category if category is "all").
- directionFit: how well it matches the requested direction's actual meaning (not just using the direction's keyword).

Reject any candidate that: duplicates or near-duplicates one of the "IDEAS ALREADY SHOWN THIS SESSION" (same entity + same central question/angle, even if reworded) or duplicates another candidate in this same list; is too narrow, too broad, or clickbait with no substance; cannot be explained visually; or is primarily opinion with no informational substance.

CANDIDATES:
${candidates.map((c, i) => `${i}: title="${c.title}" | topic="${c.topic}" | angle="${c.angle}" | archetype=${c.narrativeArchetype}`).join("\n")}

Return JSON only, one evaluation for every candidate, in the same order.`;
}

/* ============================= JSON schemas ============================= */

const IDEA_ITEM_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "topic", "angle", "category", "direction", "narrativeArchetype", "visualDirection"],
  properties: {
    title: { type: "string" },
    topic: { type: "string" },
    angle: { type: "string" },
    category: { type: "string", enum: CATEGORY_VALUES },
    direction: { type: "string", enum: DIRECTION_VALUES },
    narrativeArchetype: { type: "string", enum: ARCHETYPE_VALUES },
    visualDirection: { type: "string" },
  },
};

const CANDIDATE_SCHEMA = {
  name: "long_form_idea_candidates",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["candidates"],
    properties: {
      candidates: { type: "array", minItems: POOL_SIZE, maxItems: POOL_SIZE, items: IDEA_ITEM_SCHEMA },
    },
  },
};

const SCORE_PROPERTIES = Object.fromEntries(SCORE_KEYS.map((key) => [key, { type: "integer", minimum: 1, maximum: 10 }]));

function buildRankingSchema(count: number) {
  return {
    name: "long_form_idea_ranking",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["evaluations"],
      properties: {
        evaluations: {
          type: "array",
          minItems: count,
          maxItems: count,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["candidateIndex", "scores", "total", "rejected", "reason"],
            properties: {
              candidateIndex: { type: "integer", minimum: 0, maximum: count - 1 },
              scores: { type: "object", additionalProperties: false, required: [...SCORE_KEYS], properties: SCORE_PROPERTIES },
              total: { type: "integer", minimum: SCORE_KEYS.length, maximum: SCORE_KEYS.length * 10 },
              rejected: { type: "boolean" },
              reason: { type: "string" },
            },
          },
        },
      },
    },
  };
}

/* ============================= OpenAI call ============================= */

async function callJson(messages: any[], schema: any, maxTokens: number, temperature: number) {
  const response = await fetch(OPENAI_CHAT, {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      temperature,
      max_tokens: maxTokens,
      messages,
      response_format: { type: "json_schema", json_schema: schema },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${(await response.text()).slice(0, 300)}`);
  const payload = await response.json();
  return JSON.parse(String(payload?.choices?.[0]?.message?.content ?? "{}"));
}

/* ============================= Validation / dedup ============================= */

const STOPWORDS = new Set([
  "the", "a", "an", "of", "in", "on", "at", "to", "for", "and", "or", "how", "why", "what",
  "does", "did", "do", "is", "are", "was", "were", "it", "its", "this", "that", "with", "from",
  "by", "so", "actually", "really",
]);

function normalizeForDedup(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2 && !STOPWORDS.has(word))
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const word of a) if (b.has(word)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function isValidIdeaShape(idea: any): boolean {
  if (!idea || typeof idea !== "object") return false;
  const strings = [idea.title, idea.topic, idea.angle, idea.visualDirection];
  if (!strings.every((v) => typeof v === "string" && v.trim().length >= 4)) return false;
  if (idea.title.length > 200 || idea.topic.length > 400 || idea.angle.length > 400 || idea.visualDirection.length > 600) return false;
  if (!CATEGORY_VALUES.includes(idea.category)) return false;
  if (!DIRECTION_VALUES.includes(idea.direction)) return false;
  if (!ARCHETYPE_VALUES.includes(idea.narrativeArchetype)) return false;
  return true;
}

/* ============================= Discovery session gate ============================= */

// Per-creation safeguard (product decision, not a generic rate limiter):
// batch 1 free, batch 2 free (starts a 3h cooldown), then one batch allowed
// per 3h after that, each renewing the cooldown. This IS the authoritative
// gate — the frontend may show a countdown, but refreshing, editing
// sessionStorage, or calling this endpoint directly cannot bypass it, since
// the counters live in long_form_discovery_sessions, not in anything the
// client sends.
interface DiscoverySession {
  id: string;
  user_id: string;
  idea_batches_generated: number;
  next_generation_allowed_at: string | null;
}

async function loadOwnedSession(admin: ReturnType<typeof createClient>, sessionId: string, userId: string): Promise<DiscoverySession | null> {
  const { data } = await admin
    .from("long_form_discovery_sessions")
    .select("id, user_id, idea_batches_generated, next_generation_allowed_at")
    .eq("id", sessionId)
    .maybeSingle();
  if (!data || data.user_id !== userId) return null;
  return data as DiscoverySession;
}

function cooldownResponse(req: Request, nextAllowedAt: string) {
  const retryAfterSeconds = Math.max(0, Math.ceil((new Date(nextAllowedAt).getTime() - Date.now()) / 1000));
  return err(req, "More ideas available soon.", 429, { code: "DISCOVERY_COOLDOWN", nextAllowedAt, retryAfterSeconds });
}

/* ============================= Handler ============================= */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);

  const { user, authError } = await requireUser(req);
  if (!user) return err(req, authError || "Unauthorized", 401);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const body = await req.json().catch(() => ({}));
  const discoverySessionId = String(body?.discoverySessionId ?? "").trim();
  if (!discoverySessionId) return err(req, "Missing discoverySessionId", 400);

  const session = await loadOwnedSession(admin, discoverySessionId, user.id);
  if (!session) return err(req, "Discovery session not found", 404);

  if (session.idea_batches_generated >= 2) {
    const stillCoolingDown = !session.next_generation_allowed_at || Date.now() < new Date(session.next_generation_allowed_at).getTime();
    if (stillCoolingDown) return cooldownResponse(req, session.next_generation_allowed_at ?? new Date().toISOString());
  }

  const context = buildDiscoveryContext(body);

  await logEvent(SOURCE, "info", "ideas_requested", {
    userId: user.id,
    discoverySessionId,
    category: context.categoryValue,
    direction: context.directionValue,
    count: context.requestedCount,
    existingCount: context.existingIdeas.length,
  });

  try {
    // STEP A — larger candidate pool, one call.
    let pool: any[] = [];
    for (let attempt = 0; attempt < 2 && pool.length < POOL_SIZE; attempt += 1) {
      try {
        const generated = await callJson(
          [{ role: "user", content: buildCandidatePrompt(context) }],
          CANDIDATE_SCHEMA,
          7500,
          1.0
        );
        const raw = Array.isArray(generated?.candidates) ? generated.candidates : [];
        pool = raw.filter(isValidIdeaShape);
      } catch (e) {
        await logEvent(SOURCE, "warn", "candidate_generation_retry", { userId: user.id, attempt, message: String(e) });
      }
    }
    if (pool.length < Math.max(3, Math.ceil(context.requestedCount / 2))) {
      await logEvent(SOURCE, "error", "candidate_generation_failed", { userId: user.id, poolSize: pool.length });
      return err(req, "Idea generation returned too few usable candidates", 502);
    }

    // Cheap deterministic safety net against exact/near-exact repeats of
    // already-shown ideas, ahead of the ranking call (which does the real
    // semantic dedup judgment via seeing full context in one pass).
    const existingSets = context.existingIdeas.map((idea) => normalizeForDedup(`${idea.title} ${idea.topic}`));
    const preFiltered = pool.filter((idea) => {
      const words = normalizeForDedup(`${idea.title} ${idea.topic}`);
      return !existingSets.some((existing) => jaccardSimilarity(words, existing) > 0.75);
    });
    const candidates = preFiltered.length >= context.requestedCount ? preFiltered : pool;

    // STEP B — rank the survivors; a ranking failure falls back to
    // deterministic order rather than failing the whole request, since
    // every candidate is already a valid, complete idea object.
    let evaluations: any[] = [];
    try {
      const ranked = await callJson(
        [{ role: "user", content: buildRankingPrompt(context, candidates) }],
        buildRankingSchema(candidates.length),
        4000,
        0.2
      );
      evaluations = Array.isArray(ranked?.evaluations) ? ranked.evaluations : [];
    } catch (e) {
      await logEvent(SOURCE, "warn", "ranking_fallback", { userId: user.id, message: String(e) });
    }

    const scoreByIndex = new Map<number, { total: number; rejected: boolean }>();
    for (const evaluation of evaluations) {
      if (Number.isInteger(evaluation?.candidateIndex)) {
        scoreByIndex.set(evaluation.candidateIndex, { total: Number(evaluation.total) || 0, rejected: Boolean(evaluation.rejected) });
      }
    }

    const ordered = candidates
      .map((idea, index) => ({ idea, index, score: scoreByIndex.get(index) }))
      .filter((entry) => !entry.score?.rejected)
      .sort((a, b) => (b.score?.total ?? 0) - (a.score?.total ?? 0));

    // STEP C — greedy final selection with a code-level diversity guard: skip
    // anything too textually similar to one already picked in THIS batch,
    // even if individually well-scored (backstop for section 12's "How X /
    // How Y / How Z" failure mode, on top of the prompt-level instruction).
    const selected: any[] = [];
    const selectedSets: Set<string>[] = [];
    for (const entry of ordered) {
      if (selected.length >= context.requestedCount) break;
      const words = normalizeForDedup(`${entry.idea.title} ${entry.idea.topic}`);
      const tooSimilar = selectedSets.some((existing) => jaccardSimilarity(words, existing) > 0.6);
      if (tooSimilar) continue;
      selected.push(entry.idea);
      selectedSets.push(words);
    }

    const ideas = selected.filter(isValidIdeaShape).map((idea) => ({
      id: crypto.randomUUID(),
      title: idea.title.trim(),
      topic: idea.topic.trim(),
      angle: idea.angle.trim(),
      category: idea.category,
      direction: idea.direction,
      // Internal-only — not rendered anywhere in the current UI. Kept for a
      // future Narrative Director to pick a narrative structure from,
      // rather than re-deriving it from title/angle text later.
      narrativeArchetype: idea.narrativeArchetype,
      visualDirection: idea.visualDirection.trim(),
    }));

    if (ideas.length === 0) {
      await logEvent(SOURCE, "error", "no_ideas_survived_selection", { userId: user.id, poolSize: pool.length });
      return err(req, "No ideas passed validation", 502);
    }

    // Advance the session's free-batch counter and (from batch 2 onward) set
    // the next 3h cooldown — done here, after a genuinely successful batch,
    // so a failed generation never consumes part of the free allowance.
    const nextBatchCount = session.idea_batches_generated + 1;
    const nowIso = new Date().toISOString();
    const nextAllowedAt = nextBatchCount >= 2 ? new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString() : null;
    // Only the fields THIS function unambiguously knows. The full merged
    // (and capped) `ideas` array is persisted by the frontend right after
    // this call, via update-long-form-discovery-session — this function
    // only ever sees the new batch's ideas, not the client's running
    // append/cap state, so it can't safely write the merged list itself.
    await admin
      .from("long_form_discovery_sessions")
      .update({
        idea_batches_generated: nextBatchCount,
        last_batch_at: nowIso,
        next_generation_allowed_at: nextAllowedAt,
        idea_category: context.categoryValue,
        idea_direction: context.directionValue,
        updated_at: nowIso,
      })
      .eq("id", discoverySessionId);

    await logEvent(SOURCE, "info", "ideas_returned", { userId: user.id, returned: ideas.length, requested: context.requestedCount });
    return ok(req, { ideas, discovery: { ideaBatchesGenerated: nextBatchCount, nextGenerationAllowedAt: nextAllowedAt } });
  } catch (error) {
    await logEvent(SOURCE, "error", "unexpected_error", { userId: user.id, message: String((error as Error)?.message ?? error) });
    return err(req, "Idea generation failed", 500);
  }
});
