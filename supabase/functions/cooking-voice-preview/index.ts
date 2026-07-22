// cooking-voice-preview/index.ts
// Generates a short voice sample using ElevenLabs so users can preview each voice.
// Returns raw audio/mpeg so the browser can play it directly.
// POST { voice: string, dish?: string }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ELEVEN_KEY = Deno.env.get("ELEVENLABS_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
};

// ElevenLabs voice IDs — keep in sync with the VOICES list in WorkflowSteps.jsx.
const VALID_VOICES = new Set([
  "TxGEqnHWrfWFTfGW9XjX", // Josh
  "AZnzlk1XvdvUeBnXmlld", // Domi
  "ErXwobaYiN019PkySvjV", // Antoni
  "21m00Tcm4TlvDq8ikWAM", // Rachel
  "EXAVITQu4vr4xnSDxMaL", // Bella
  "pNInz6obpgDQGcFmaJgB", // Adam
  "JBFqnCBsd6RMkjVDRZzb", // George
  "nPczCjzI2devNBz1zQrb", // Brian
  "onwK4e9ZLuTAKqWW03F9", // Daniel
  "XrExE9yKIg1WjnnlVkGX", // Matilda
  "cgSgspJ2msm6clMCkdW9", // Jessica
  "Xb7hH8MSUJpSbSDYk0k2", // Alice
]);

// Hook-style sample — short, punchy, immediate. No slow opener, no fluff.
const SAMPLE_TEXT = (dish: string) =>
  `Wait — this ${dish}? Life changing. You NEED to make this right now.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...CORS, "content-type": "application/json" } });
  }

  let body: { voice?: string; dish?: string; generationId?: string } = {};
  try { body = await req.json(); } catch {}

  const voice = String(body.voice ?? "TxGEqnHWrfWFTfGW9XjX");
  const dish  = String(body.dish  ?? "crispy chicken").slice(0, 50);
  const generationId = String(body.generationId ?? "").trim();

  if (!VALID_VOICES.has(voice)) {
    return new Response(JSON.stringify({ error: "Invalid voice" }), { status: 400, headers: { ...CORS, "content-type": "application/json" } });
  }
  if (!generationId) {
    return new Response(JSON.stringify({ error: "Missing generationId" }), { status: 400, headers: { ...CORS, "content-type": "application/json" } });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: req.headers.get("authorization") ?? "" } },
    auth: { persistSession: false },
  });
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { error: reserveError } = await supabase.rpc("reserve_cooking_service_request", {
    p_generation_id: generationId,
    p_kind: "preview",
  });
  if (reserveError) {
    const limited = String(reserveError.message ?? "").includes("SERVICE_LIMIT_REACHED");
    return new Response(JSON.stringify({ error: limited ? "Voice preview limit reached for this creation" : "Creation access denied" }), { status: limited ? 429 : 403, headers: { ...CORS, "content-type": "application/json" } });
  }

  let res: Response;
  try {
    res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVEN_KEY,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        text: SAMPLE_TEXT(dish),
        model_id: "eleven_flash_v2_5",
      }),
    });
  } catch (error) {
    await admin.rpc("release_cooking_service_request", { p_generation_id: generationId, p_kind: "preview" });
    console.error("[voice-preview] ElevenLabs request failed:", error);
    return new Response(JSON.stringify({ error: "TTS generation failed" }), { status: 502, headers: { ...CORS, "content-type": "application/json" } });
  }

  if (!res.ok) {
    await admin.rpc("release_cooking_service_request", { p_generation_id: generationId, p_kind: "preview" });
    const text = await res.text().catch(() => "");
    console.error("[voice-preview] ElevenLabs error:", res.status, text.slice(0, 200));
    return new Response(JSON.stringify({ error: "TTS generation failed", providerStatus: res.status }), { status: 502, headers: { ...CORS, "content-type": "application/json" } });
  }

  // Stream the audio bytes straight back to the browser
  const audio = await res.arrayBuffer();
  return new Response(audio, {
    status: 200,
    headers: {
      ...CORS,
      "content-type": "audio/mpeg",
      "content-length": String(audio.byteLength),
      // Cache in browser for 10 min so repeated clicks on the same voice don't re-generate
      "cache-control": "private, max-age=600",
    },
  });
});
