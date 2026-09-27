// thirty-days-idea/index.ts
// "AI creates a viral idea" for the 30 Days template — given a universe/world,
// privately generates eight candidate premises, rejects weak/generic ideas,
// scores the survivors across fourteen viral dimensions, and returns only the
// strongest editable premise sentence.
// POST { universe }
// Returns { premise }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_KEY   = Deno.env.get("OPENAI_API_KEY")!;
const OPENAI_CHAT  = "https://api.openai.com/v1/chat/completions";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function ok(data: any) {
  return new Response(JSON.stringify({ ok: true, ...data }), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
function fail(msg: string, status = 400) {
  return new Response(JSON.stringify({ ok: false, error: msg }), {
    status, headers: { ...CORS, "Content-Type": "application/json" },
  });
}

const CANDIDATE_COUNT = 8;
const SCORE_KEYS = [
  "hookClarity", "curiosityGap", "immediateStakes", "visualSpectacle",
  "viewerInsert", "franchiseRecognition", "milestoneEscalation", "sceneDiversity",
  "emotionalAnchor", "day20Reveal", "day30Payoff", "commentPotential",
  "seriesPotential", "thumbnailClarity",
] as const;

function buildCandidatePrompt(universe: string, seriesMode = false) {
  return `You are a ruthless viral short-form concept generator. A creator is building a "YOU in this world for 30 days" TikTok/Reels/Shorts video about: "${universe}".

V1 CORE RULE: the viewer-insert protagonist is mandatory. The premise must be about YOU entering/living in this universe, or a world-level crisis happening WHILE YOU are there. Never make a canon character the sole protagonist.

Privately generate exactly ${CANDIDATE_COUNT} genuinely different candidate premises. Do not settle for the first valid idea. Every candidate must support an immediate Day 1 hook, a Day 10 escalation, a Day 20 reveal/setback, a Day 30 climax/payoff, and eight visually distinct scenes. Build in high stakes, spectacle, a relationship/emotional anchor, recognizable franchise characters/locations/powers/creatures, comment/debate potential, sequel potential, and a title/thumbnail that is understandable in 1–2 seconds.

GOOD examples (for other worlds, showing the style):
- "You are in Ninjago when the sun disappears for 30 days and shadow creatures emerge."
- "You get teleported into the Pokémon world for 30 days and Pikachu chooses to follow you."
- "You spend 30 days at Hogwarts after magic starts breaking around you."

Reject canon-character-only or generic ideas such as:
- "Lloyd hears everyone's thoughts for 30 days."
- "Kai loses his powers for 30 days."
- "Ash cannot catch Pokémon for 30 days."
- "Harry is trapped in the library for 30 days."
- "You have adventures."
- "You train for 30 days."
- "You explore the world."
- "Lloyd hears everyone's thoughts for 30 days."

${seriesMode ? `SERIES MODE: this concept must sustain up to 30 separate episodes, not merely one 40-second montage. It needs evolving relationships, layered mysteries, varied locations and conflicts, gradual escalation, natural story-linked cliffhangers, a painful middle reversal, and a concrete Day 30 destination. Reject premises that would become repetitive daily training, exploration, or disconnected missions.` : ""}

Return JSON only. Each candidate is one concise sentence and explicitly uses YOU/YOUR.`;
}

function buildRankingPrompt(universe: string, candidates: string[], seriesMode = false) {
  return `You are Zyvo's strict viral concept selector. Rank these ${candidates.length} candidate premises for a 30 Days short in ${universe}.

Score every dimension from 1–10: 1–2 second hook clarity, curiosity gap, immediate stakes, visual spectacle, viewer-insert importance, franchise recognizability, Day 1→10→20→30 escalation, eight-scene diversity, relationship/emotional anchor, Day 20 reveal potential, Day 30 climax/payoff, comment/debate potential, series/sequel potential, and thumbnail/title clarity.

Reject any premise that is generic, canon-character-only, makes YOU removable, lacks concrete stakes, cannot sustain eight different images, lacks a real Day 20 reveal, or lacks a concrete Day 30 resolution. Favor the idea where viewers instantly understand the video and urgently want to know how Day 30 ends. Do not reward vague morals.

${seriesMode ? `SERIES-SUSTAINABILITY OVERRIDE: seriesPotential must measure whether this premise can create 30 meaningful daily developments with evolving relationships, mysteries, locations, escalating consequences, non-repetitive problems, natural cliffhangers, and a meaningful Day 30 destination. A great one-video idea that cannot sustain multiple episodes must rank lower.` : ""}

CANDIDATES:
${candidates.map((candidate, index) => `${index}: ${candidate}`).join("\n")}

Return JSON only, one evaluation for every candidate.`;
}

const CANDIDATE_SCHEMA = {
  name: "thirty_days_viral_candidates",
  strict: true,
  schema: {
    type: "object", additionalProperties: false, required: ["candidates"],
    properties: { candidates: { type: "array", minItems: CANDIDATE_COUNT, maxItems: CANDIDATE_COUNT, items: { type: "string" } } },
  },
};

const SCORE_PROPERTIES = Object.fromEntries(SCORE_KEYS.map((key) => [key, { type: "integer", minimum: 1, maximum: 10 }]));
const RANKING_SCHEMA = {
  name: "thirty_days_viral_ranking",
  strict: true,
  schema: {
    type: "object", additionalProperties: false, required: ["evaluations"],
    properties: {
      evaluations: {
        type: "array", minItems: CANDIDATE_COUNT, maxItems: CANDIDATE_COUNT,
        items: {
          type: "object", additionalProperties: false,
          required: ["candidateIndex", "scores", "total", "rejected", "reason"],
          properties: {
            candidateIndex: { type: "integer", minimum: 0, maximum: CANDIDATE_COUNT - 1 },
            scores: { type: "object", additionalProperties: false, required: SCORE_KEYS, properties: SCORE_PROPERTIES },
            total: { type: "integer", minimum: 14, maximum: 140 },
            rejected: { type: "boolean" }, reason: { type: "string" },
          },
        },
      },
    },
  },
};

const EXAMPLE_BANK: Record<string, string[]> = {
  ninjago: [
    "You arrive in Ninjago the day the sun disappears, and Lloyd trusts you with the only map to bring it back.",
    "You get trapped in Ninjago when every elemental power vanishes, but a forbidden power awakens inside you.",
    "You enter Ninjago as an ancient villain takes control of the city, and Kai is captured saving you.",
    "You spend 30 days in Ninjago while the ninja slowly become corrupted, and only you can still recognize them.",
    "You arrive in Ninjago when the dragons turn against their riders, and one impossible dragon chooses you.",
  ],
  pokemon: [
    "You get teleported into the Pokémon world when every Poké Ball stops working, and Pikachu chooses to protect you.",
    "You arrive in the Pokémon world as every Pokémon begins growing gigantic, and Eevee is the only one still normal.",
    "You have 30 days to build a team strong enough to beat Ash, but your partner refuses to evolve.",
    "You enter the Pokémon world when trainers start forgetting their partners, and Pikachu remembers only you.",
    "You wake up in Pokémon with a legendary egg everyone wants, and Team Rocket captures the friend who helped you hide it.",
  ],
  hogwarts: [
    "You arrive at Hogwarts when magic begins disappearing, and Hermione discovers your touch is the only thing that restores it.",
    "You spend 30 days at Hogwarts while the castle slowly freezes in time, but you can still move between the frozen rooms.",
    "You arrive when something from the Forbidden Forest begins taking over Hogwarts, and it leaves a mark only you can see.",
    "You enter Hogwarts the night every portrait vanishes, and one hidden portrait whispers your name.",
    "You have 30 days to stop Hogwarts from erasing itself, but each spell you cast makes everyone forget you.",
  ],
};

function fallbackCandidates(universe: string) {
  const key = Object.keys(EXAMPLE_BANK).find((name) => universe.toLowerCase().includes(name));
  const specific = key ? EXAMPLE_BANK[key] : [];
  const generic = [
    `You arrive in ${universe} when its greatest power disappears, and the one hero who trusts you is captured.`,
    `You enter ${universe} as its safest place begins transforming, and only you can see what is causing it.`,
    `You spend 30 days in ${universe} while its heroes slowly turn against each other, and one of them chooses you over the team.`,
  ];
  return [...specific, ...generic].slice(0, CANDIDATE_COUNT);
}

function deterministicRejection(premise: string) {
  if (!/\b(you|your)\b/i.test(premise)) return "viewer_insert_missing";
  if (/\b(explore|train|learn|make friends|have adventures|hear(?:s)? everyone'?s thoughts)\b/i.test(premise)) return "generic_activity";
  if (!/\b(when|but|only|before|until|while|and)\b/i.test(premise)) return "no_stakes_or_turn";
  return null;
}

async function callJson(messages: any[], schema: any, maxTokens: number, temperature: number) {
  const response = await fetch(OPENAI_CHAT, {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini", temperature, max_tokens: maxTokens, messages,
      response_format: { type: "json_schema", json_schema: schema },
    }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${(await response.text()).slice(0, 300)}`);
  const payload = await response.json();
  return JSON.parse(String(payload?.choices?.[0]?.message?.content ?? "{}"));
}

function ensureViewerPremise(value: string, universe: string) {
  const premise = value.trim().replace(/[.!?]+$/, "");
  if (/\b(you|your)\b/i.test(premise)) return `${premise}.`;
  return `You are in ${universe} when ${premise.charAt(0).toLowerCase()}${premise.slice(1)}.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return fail("Method not allowed", 405);

  const authorization = req.headers.get("Authorization") ?? "";
  const token = authorization.replace("Bearer ", "");
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return fail("Unauthorized", 401);

  const body = await req.json().catch(() => ({}));
  const universe = String(body.universe ?? "").trim().slice(0, 120);
  const seriesMode = body.mode === "series";
  if (universe.length < 2) return fail("Tell us what world we're entering.");

  try {
    const generated = await callJson([{ role: "user", content: buildCandidatePrompt(universe, seriesMode) }], CANDIDATE_SCHEMA, 900, 1.05);
    const rawCandidates = Array.isArray(generated?.candidates) ? generated.candidates : [];
    const candidates = [...new Set([...rawCandidates, ...fallbackCandidates(universe)]
      .map((value) => ensureViewerPremise(String(value || ""), universe))
      .filter((value) => value.length >= 20))].slice(0, CANDIDATE_COUNT);
    if (candidates.length !== CANDIDATE_COUNT) return fail("Idea generation returned too few usable candidates", 502);

    const deterministicRejected = new Map(candidates.map((candidate, index) => [index, deterministicRejection(candidate)]));
    let evaluations: any[] = [];
    try {
      const ranked = await callJson([{ role: "user", content: buildRankingPrompt(universe, candidates, seriesMode) }], RANKING_SCHEMA, 1800, 0.2);
      evaluations = Array.isArray(ranked?.evaluations) ? ranked.evaluations : [];
    } catch (rankingError) {
      console.warn("[thirty-days-idea] ranking fallback:", String(rankingError));
    }
    const winner = evaluations
      .filter((evaluation: any) => Number.isInteger(evaluation?.candidateIndex))
      .map((evaluation: any) => ({
        ...evaluation,
        rejected: Boolean(evaluation.rejected) || Boolean(deterministicRejected.get(evaluation.candidateIndex)),
      }))
      .filter((evaluation: any) => !evaluation.rejected)
      .sort((a: any, b: any) => Number(b.total || 0) - Number(a.total || 0))[0];
    const fallbackIndex = candidates.findIndex((candidate, index) => !deterministicRejected.get(index) && candidate.length >= 20);
    const premise = candidates[winner?.candidateIndex ?? fallbackIndex];
    if (!premise) return fail("No viral concept passed validation", 502);
    return ok({ premise });
  } catch (error) {
    console.error("[thirty-days-idea] unexpected error:", String(error));
    return fail("Idea generation failed", 500);
  }
});
