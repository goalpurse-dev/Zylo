// supabase/functions/image-to-prompt/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";

function cors(req: Request) {
  return {
    "access-control-allow-origin": req.headers.get("Origin") || "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
    "content-type": "application/json",
  };
}

const ok  = (req: Request, body: unknown) => new Response(JSON.stringify(body), { headers: cors(req) });
const err = (req: Request, msg: string, status = 400) =>
  new Response(JSON.stringify({ error: msg }), { status, headers: cors(req) });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);
  if (!OPENAI_KEY) return err(req, "OpenAI key not configured", 500);

  try {
    const { imageUrl, imageBase64, mimeType = "image/jpeg", kind = "image" } = await req.json();

    if (!imageUrl && !imageBase64) return err(req, "Provide imageUrl or imageBase64");

    const imageContent = imageUrl
      ? { type: "image_url", image_url: { url: imageUrl, detail: "high" } }
      : { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: "high" } };

    const isScript = kind === "script";

    const systemPrompt = isScript
      ? `You are a viral content strategist. When given an image, generate a single punchy, specific idea for a viral short-form video script based on what you see.

Rules:
- Look at the subject, setting, mood, and story potential of the image
- Write ONE specific, compelling video idea (not a prompt, a concept)
- Max 2 sentences. Be direct and exciting.
- Examples: "A cinematic timelapse of a lone boxer training at dawn in an empty gym, no dialogue, just raw energy." or "POV: you find an abandoned mansion and explore every room — the final room changes everything."
- Return ONLY the idea, no preamble, no quotes`
      : `You are an expert AI image generation prompt engineer. When given an image, write a single detailed prompt that would recreate it using an AI image generator.

Rules:
- Describe subject, action, composition, lighting, color palette, mood, and atmosphere
- Include style descriptors (cinematic, photorealistic, etc.)
- Add technical quality tags at the end (sharp focus, high detail, 8k, etc.)
- Return ONLY the prompt — no explanation, no quotes, no preamble
- Keep it under 200 words, dense and specific`;

    const userText = isScript
      ? "Generate a viral video script idea based on this image:"
      : "Write an AI image generation prompt for this image:";

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 300,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userText },
              imageContent,
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error("OpenAI error:", body);
      return err(req, "Vision API failed", 502);
    }

    const data = await response.json();
    const prompt = data.choices?.[0]?.message?.content?.trim();

    if (!prompt) return err(req, "No prompt returned");

    return ok(req, { prompt });
  } catch (e) {
    console.error("image-to-prompt error:", e);
    return err(req, String(e), 500);
  }
});
