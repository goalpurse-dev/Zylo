// supabase/functions/generate-footballer-identity/index.ts
// Generates a localized alternate-universe player identity for the
// Footballer Nationality Swap tool using OpenAI gpt-4o-mini.
// Input:  { footballer: string, nationality: string }
// Output: { localizedName: string, jerseyNumber: string, spokenLine: string, language: string }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { cors, ok, err } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";

const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY")!;
const MAX_INPUT = 60;

function fallbackIdentity(footballer: string, nationality: string) {
  const firstName = footballer.trim().split(/\s+/)[0] || "Player";
  return {
    localizedName: `${firstName} of ${nationality}`,
    jerseyNumber: String(Math.floor(Math.random() * 98) + 1),
    spokenLine: `Hi, I'm ${firstName}, proud to represent ${nationality}.`,
    language: "English",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors(req) });
  }
  if (req.method !== "POST") {
    return err(req, "Method not allowed", 405);
  }

  const { user, authError } = await requireUser(req);
  if (authError || !user) {
    return err(req, "Unauthorized", 401);
  }

  // deno-lint-ignore no-explicit-any
  let body: any = {};
  try { body = await req.json(); } catch {
    return err(req, "Invalid JSON", 400);
  }

  const footballer  = String(body?.footballer ?? "").slice(0, MAX_INPUT).trim();
  const nationality = String(body?.nationality ?? "").slice(0, MAX_INPUT).trim();
  if (!footballer || !nationality) {
    return err(req, "footballer and nationality are required", 400);
  }

  const systemMessage =
    "You invent fictional alternate-universe footballer identities for a fun fan-made \"what if\" generator. " +
    "Given a real footballer's name as creative inspiration and a target nationality, invent a NEW fictional player identity — " +
    "never claim to be the real athlete. " +
    "Respond with ONLY strict JSON, no markdown, no explanation, in exactly this shape: " +
    `{"localizedName": string, "jerseyNumber": string, "spokenLine": string, "language": string}\n` +
    "Rules:\n" +
    "- localizedName: a fictional full name that sounds natural for the target nationality, playfully inspired by the original player's name (e.g. keep a similar sound or initial).\n" +
    "- jerseyNumber: a plausible football shirt number, as a string of digits between 1 and 99.\n" +
    "- spokenLine: a short, warm, one-sentence media-day introduction (max 20 words), written in the PRIMARY LANGUAGE spoken in that nationality, using that language's native script, where the player states their fictional name and that they're the new number for that nation.\n" +
    "- language: the English name of the language used in spokenLine.";

  const userMessage = `Real footballer for inspiration: ${footballer}\nTarget nationality: ${nationality}`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_KEY}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        model:           "gpt-4o-mini",
        messages: [
          { role: "system", content: systemMessage },
          { role: "user",   content: userMessage   },
        ],
        max_tokens:      220,
        temperature:     0.95,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[generate-footballer-identity] OpenAI error:", res.status, text.slice(0, 200));
      return ok(req, fallbackIdentity(footballer, nationality));
    }

    const data = await res.json();
    const raw  = String(data.choices?.[0]?.message?.content ?? "").trim();

    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(raw); } catch { /* fall through to fallback below */ }

    const localizedName = String(parsed.localizedName ?? "").trim();
    const jerseyNumber   = String(parsed.jerseyNumber ?? "").trim().replace(/[^\d]/g, "");
    const spokenLine     = String(parsed.spokenLine ?? "").trim();
    const language       = String(parsed.language ?? "").trim();

    if (!localizedName || !jerseyNumber || !spokenLine) {
      return ok(req, fallbackIdentity(footballer, nationality));
    }

    return ok(req, {
      localizedName,
      jerseyNumber: String(Math.min(99, Math.max(1, parseInt(jerseyNumber, 10) || 9))),
      spokenLine,
      language: language || "English",
    });
  } catch (e) {
    console.error("[generate-footballer-identity] Exception:", (e as Error).message);
    return ok(req, fallbackIdentity(footballer, nationality));
  }
});
