// supabase/functions/generate-caption/index.ts
// Generates a social media caption for a video using OpenAI gpt-4o-mini.
// Input:  { prompt: string, platform: "instagram" | "tiktok" | "youtube" }
// Output: { caption: string }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { cors, ok, err } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";

const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY")!;
const MAX_PROMPT = 600;

const PLATFORM_HINTS: Record<string, string> = {
  instagram: "Instagram Reels. Use 3-5 relevant hashtags at the end. Max 220 characters before hashtags.",
  tiktok:    "TikTok. Keep it punchy and trend-aware. Max 150 characters, 3-5 hashtags at the end.",
  youtube:   "YouTube Shorts. Keep it clean and curiosity-driven. No hashtags needed.",
};

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

  const { prompt, platform = "instagram" } = body ?? {};
  if (!prompt || typeof prompt !== "string") {
    return err(req, "prompt required", 400);
  }

  const hint = PLATFORM_HINTS[platform] ?? PLATFORM_HINTS.instagram;
  const safePrompt = String(prompt).slice(0, MAX_PROMPT).trim();

  const systemMessage =
    `You are a social media content expert. ` +
    `Write a single compelling, engaging caption for ${hint} ` +
    `Output ONLY the caption text — no explanation, no quotes, no extra formatting.`;

  const userMessage = `Video concept: ${safePrompt}`;

  let caption = "";
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_KEY}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        model:       "gpt-4o-mini",
        messages:    [
          { role: "system", content: systemMessage },
          { role: "user",   content: userMessage   },
        ],
        max_tokens:  250,
        temperature: 0.85,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[generate-caption] OpenAI error:", res.status, text.slice(0, 200));
      return err(req, "Caption generation failed. Please try again.", 502);
    }

    const data = await res.json();
    caption = String(data.choices?.[0]?.message?.content ?? "").trim();

    if (!caption) {
      return err(req, "Caption generation returned empty result.", 500);
    }
  } catch (e) {
    console.error("[generate-caption] Exception:", (e as Error).message);
    return err(req, "Caption generation failed. Please try again.", 500);
  }

  return ok(req, { caption });
});
