// thirty-days-reference-qa/index.ts
// Lightweight vision QA gate for a just-generated PERSISTENT reference image,
// run before it's locked in and reused across every scene/episode. Mirrors
// thirty-days-scene-qa's pattern (cheap, fail-open, not a deep art critique)
// but checks a different failure mode: for a recognized franchise, does this
// reference actually look like the real franchise, or does it read as a
// generic "inspired by" substitute (e.g. LEGO Ninjago -> generic anime ninja
// squad in a generic city)?
// POST { generationId, imageUrl, reference: {label, role, prompt, visualLock}, worldBible: {franchise, confidence, medium, styleMode, styleDirective} }
// Returns { usable: boolean, reason: string }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "content-type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: CORS });

  let body: {
    generationId?: string;
    imageUrl?: string;
    reference?: { label?: string; role?: string; prompt?: string; visualLock?: string };
    worldBible?: { franchise?: string; confidence?: number; medium?: string; styleMode?: string; styleDirective?: string; visualStyle?: string };
  } = {};
  try { body = await req.json(); } catch { /* empty body handled below */ }

  const generationId = String(body.generationId ?? "").trim();
  const imageUrl = String(body.imageUrl ?? "").trim();
  if (!generationId || !imageUrl.startsWith("https://")) {
    return new Response(JSON.stringify({ error: "Missing generationId or imageUrl" }), { status: 400, headers: CORS });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: req.headers.get("authorization") ?? "" } },
    auth: { persistSession: false },
  });
  const { data: owned, error: ownershipError } = await supabase
    .from("thirty_days_generations")
    .select("id")
    .eq("id", generationId)
    .maybeSingle();
  if (ownershipError || !owned) {
    return new Response(JSON.stringify({ error: "Creation access denied" }), { status: 403, headers: CORS });
  }

  const reference = body.reference ?? {};
  const worldBible = body.worldBible ?? {};
  const confidence = Number(worldBible.confidence ?? 0);
  // Below this confidence the world bible itself never claimed to be a real
  // recognized franchise, so there is no known canon to drift away from —
  // skip the franchise-identity check entirely rather than false-flagging.
  if (confidence < 0.6) {
    return new Response(JSON.stringify({ usable: true, reason: "not_a_recognized_franchise" }), { status: 200, headers: CORS });
  }

  const prompt = [
    `You are a fast franchise-identity quality gate for an AI-generated PERSISTENT REFERENCE IMAGE, about to be locked in and reused across an entire video series. Do NOT deeply critique the art. Just answer one question: does this image actually look like the real, specific franchise named below, or does it look like a generic "inspired by" substitute?`,
    `Franchise: ${worldBible.franchise || "(unspecified)"} (resolved confidence: ${confidence}).`,
    `Real construction/rendering system this franchise actually uses: ${worldBible.medium || "(unspecified)"}.`,
    `This reference's subject: "${reference.label || ""}" (role: ${reference.role || ""}).`,
    `What it was asked to depict: ${reference.prompt || "(unspecified)"}`,
    `Non-negotiable visual lock it must satisfy: ${reference.visualLock || "(unspecified)"}`,
    `Selected style interpretation: ${worldBible.styleMode || "auto"} — ${worldBible.styleDirective || worldBible.visualStyle || "preserve the franchise's native visual language"}.`,
    `Check: does this image read as unmistakably the real ${worldBible.franchise || "named franchise"} — real character identities/colors, real locations, and the franchise's real construction/rendering system (e.g. genuine LEGO minifigure proportions for a LEGO property, not a generic anime redesign or a generic city) — or does it look like an off-brand, generic, unrelated substitute wearing the franchise's theme? Style reinterpretation (e.g. a deliberately cinematic or dark take) is fine as long as the underlying identity is still clearly that franchise, not a random invented one.`,
    `Return JSON only: {"usable": true} if it's recognizably the real franchise (allowing for legitimate style reinterpretation), or {"usable": false, "reason": "short specific reason naming what looks generic/off-brand"} if it reads as a generic substitute. Be lenient on minor imperfections — only fail on a clear identity mismatch.`,
  ].filter(Boolean).join("\n");

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageUrl, detail: "low" } },
          ],
        }],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "thirty_days_reference_qa",
            strict: true,
            schema: {
              type: "object",
              properties: { usable: { type: "boolean" }, reason: { type: "string" } },
              required: ["usable", "reason"],
              additionalProperties: false,
            },
          },
        },
        max_tokens: 120,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      // A QA outage must never block generation.
      return new Response(JSON.stringify({ usable: true, reason: "qa_unavailable" }), { status: 200, headers: CORS });
    }

    const json = await res.json();
    const content = String(json.choices?.[0]?.message?.content ?? "{}");
    const parsed = JSON.parse(content);
    return new Response(JSON.stringify({
      usable: parsed?.usable !== false,
      reason: String(parsed?.reason ?? "").slice(0, 200),
    }), { status: 200, headers: CORS });
  } catch (error) {
    console.error("[thirty-days-reference-qa] error:", String(error));
    return new Response(JSON.stringify({ usable: true, reason: "qa_unavailable" }), { status: 200, headers: CORS });
  }
});
