import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const OPENAI_CHAT = "https://api.openai.com/v1/chat/completions";

function cors(req: Request) {
  return {
    "access-control-allow-origin": req.headers.get("Origin") || "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
    "content-type": "application/json",
  };
}

const ok = (req: Request, body: unknown) =>
  new Response(JSON.stringify(body), { headers: cors(req) });

const err = (req: Request, msg: string, status = 400) =>
  new Response(JSON.stringify({ error: msg }), { status, headers: cors(req) });

function parseNames(raw: string, count: number) {
  const names = raw
    .split(/\r?\n|,/)
    .map((line) => line.replace(/^\s*[-*\d.)]+\s*/, "").trim())
    .map((line) => line.replace(/^["']|["']$/g, "").trim())
    .filter(Boolean)
    .filter((line) => line.split(/\s+/).length <= 4);

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const name of names) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(name);
  }
  return unique.slice(0, count);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);
  if (!OPENAI_KEY) return err(req, "OpenAI key not configured", 500);

  try {
    const body = await req.json().catch(() => ({}));
    const count = Math.max(1, Math.min(9, Number(body?.count) || 1));
    const requestCount = Math.min(20, count + 6);

    const aiRes = await fetch(OPENAI_CHAT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.9,
        max_tokens: 80,
        messages: [
          {
            role: "system",
            content:
              "Return famous people only. Output names only. No numbering, no bullets, no punctuation, no explanations.",
          },
          {
            role: "user",
            content:
              `Give ${requestCount} globally famous living entertainment, music, sports, or business people. ` +
              "No duplicate names. One name per line. Famous people only. Name nothing else only name.",
          },
        ],
      }),
    });

    if (!aiRes.ok) {
      const text = await aiRes.text();
      console.error("OpenAI error:", text);
      return err(req, "OpenAI request failed", 502);
    }

    const data = await aiRes.json();
    const raw = data?.choices?.[0]?.message?.content?.trim() ?? "";
    const names = parseNames(raw, count);

    if (names.length < count) return err(req, "OpenAI did not return enough names", 502);
    return ok(req, { names });
  } catch (e) {
    console.error("face-asmr-characters error:", e);
    return err(req, String(e), 500);
  }
});
