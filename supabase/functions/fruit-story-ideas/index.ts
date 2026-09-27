// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { requirePaidFruitUser, consumeFruitRateLimit } from "../_shared/fruitStoryAccess.ts";

const OPENAI_KEY   = Deno.env.get("OPENAI_API_KEY")!;
const OPENAI_CHAT  = "https://api.openai.com/v1/chat/completions";
const OPENAI_TIMEOUT_MS = 30_000;
const RATE_LIMIT_PER_10_MIN = 20;

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

// Verbatim ideation prompt — this is the exact prompt real creators paste into
// ChatGPT as step 1 of the manual fruit-drama workflow, before ever touching
// a story/character generator. Keep this identical to what was tested
// manually; do not "improve" it without re-testing output quality.
const IDEATION_PROMPT = `You are a viral AI content ideation expert.

Your task is to generate 15 highly engaging short video ideas for AI animated videos featuring human-like fruit characters.

IMPORTANT:

ONLY generate ideas (NO story, NO explanation, NO descriptions)
Each idea must be ONE single sentence
Keep each idea clear, simple, and emotionally strong
Focus on conflict, drama, or curiosity

STYLE:

Viral YouTube Shorts / TikTok style
Emotional triggers: betrayal, love, jealousy, revenge, sacrifice, injustice
Easy to visualize in animation
Use fruit characters as humans (banana, strawberry, apple, mango, etc.)

FORMAT:

Numbered list (1–15)
One line per idea
No extra text before or after

EXAMPLE STYLE:
A poor strawberry is betrayed by his rich banana brother over family inheritance

Now generate 15 unique ideas.`;

// Parses "1. idea text" / "1) idea text" numbered-list lines into a clean
// array. Falls back to splitting on newlines if numbering is missing/odd.
function parseIdeas(raw: string): string[] {
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^\d+[.)]\s*/, "").trim())
    .filter(Boolean);
  return lines.slice(0, 15);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return fail("Method not allowed", 405);

  const access = await requirePaidFruitUser(req, CORS);
  if (!access.ok) return access.response;

  const limited = await consumeFruitRateLimit(access.admin, access.user.id, "fruit-story-ideas", RATE_LIMIT_PER_10_MIN, CORS);
  if (limited) return limited;

  try {
    const aiRes = await fetch(OPENAI_CHAT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 1,
        messages: [{ role: "user", content: IDEATION_PROMPT }],
      }),
      signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("[fruit-story-ideas] OpenAI error:", aiRes.status, errText.slice(0, 300));
      return fail("Idea generation failed", 502);
    }

    const payload = await aiRes.json();
    const raw = payload?.choices?.[0]?.message?.content ?? "";
    const ideas = parseIdeas(raw);

    if (ideas.length < 5) {
      console.error("[fruit-story-ideas] too few ideas parsed:", raw.slice(0, 300));
      return fail("Idea generation returned an unusable response", 502);
    }

    return ok({ ideas });
  } catch (error) {
    if ((error as any)?.name === "TimeoutError") {
      console.error("[fruit-story-ideas] OpenAI timed out after", OPENAI_TIMEOUT_MS, "ms");
      return fail("Idea generation timed out. Try again.", 504);
    }
    console.error("[fruit-story-ideas] unexpected error:", String(error));
    return fail("Idea generation failed", 500);
  }
});
