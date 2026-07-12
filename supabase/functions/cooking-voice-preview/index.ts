// cooking-voice-preview/index.ts
// Generates a short voice sample using ElevenLabs so users can preview each voice.
// Returns raw audio/mpeg so the browser can play it directly.
// POST { voice: string, dish?: string }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ELEVEN_KEY = Deno.env.get("ELEVENLABS_KEY")!;

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

  let body: { voice?: string; dish?: string } = {};
  try { body = await req.json(); } catch {}

  const voice = String(body.voice ?? "TxGEqnHWrfWFTfGW9XjX");
  const dish  = String(body.dish  ?? "crispy chicken").slice(0, 50);

  if (!VALID_VOICES.has(voice)) {
    return new Response(JSON.stringify({ error: "Invalid voice" }), { status: 400, headers: { ...CORS, "content-type": "application/json" } });
  }

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
    method: "POST",
    headers: {
      "xi-api-key": ELEVEN_KEY,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({
      text: SAMPLE_TEXT(dish),
      output_format: "mp3_44100_128",
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[voice-preview] ElevenLabs error:", res.status, text.slice(0, 200));
    return new Response(JSON.stringify({ error: "TTS generation failed" }), { status: 502, headers: { ...CORS, "content-type": "application/json" } });
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
