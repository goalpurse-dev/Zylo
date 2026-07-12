// supabase/functions/generate-caption/index.ts
// Generates a social media caption for a video using OpenAI gpt-4o-mini.
// Input:  { prompt: string, platform: "instagram" | "tiktok" | "youtube" }
// Output: { caption: string }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { cors, ok, err } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";

const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY")!;
const MAX_PROMPT = 600;

const PLATFORM_LIMITS: Record<string, number> = {
  instagram: 2200,
  tiktok:    2200,
  youtube:   5000,
};

const PLATFORM_HINTS: Record<string, string> = {
  instagram: `Instagram Reels.
- Line 1: scroll-stopping hook — question, cliffhanger, bold claim, or "POV:" opener. Max 10 words.
- Lines 2-3: 1-2 short punchy sentences that build tension or curiosity.
- Blank line, then hashtags on one line.
- Hashtags: EXACTLY 5 hashtags — 2 broad reach tags (e.g. #reels #viral) + 2 mid-tier niche tags (100K-1M posts) + 1 ultra-specific content tag. No more, no less.`,
  tiktok: `TikTok.
- One-sentence hook that triggers curiosity or emotion. Max 12 words.
- Optional: one follow-up sentence.
- Blank line, then EXACTLY 5 hashtags: 2 discovery tags (e.g. #fyp #foryou) + 3 niche content tags. No more, no less.`,
  youtube: `YouTube Shorts.
- 2-3 sentences: open with curiosity gap or bold statement, build intrigue, end with call to action.
- Blank line, then 3-5 hashtags: 1-2 broad discovery tags + 2-3 content-specific tags.`,
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
    `You are a top-tier viral content strategist who has grown Instagram accounts to millions of followers. ` +
    `You know exactly which hooks stop the scroll, which hashtag mixes maximize reach, and how to make any video concept feel unmissable. ` +
    `Write one caption following these exact rules for ${hint}\n` +
    `Key rules:\n` +
    `- Never start with "I" or the brand name\n` +
    `- No corporate language, no cringe motivational filler\n` +
    `- Emojis are allowed but use 1-2 max, only if they add impact\n` +
    `- Output ONLY the caption + hashtags. No explanation, no quotes, no markdown.`;

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
        max_tokens:  500,
        temperature: 0.9,
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
