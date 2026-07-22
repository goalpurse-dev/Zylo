// Generates the full AI Cooking Matic voiceover as MP3 via ElevenLabs.
// POST { voice: string, script: string }

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

type Alignment = {
  characters?: string[];
  character_start_times_seconds?: number[];
  character_end_times_seconds?: number[];
};

function alignmentToWords(alignment: Alignment | null | undefined) {
  const characters = Array.isArray(alignment?.characters) ? alignment.characters : [];
  const starts = Array.isArray(alignment?.character_start_times_seconds) ? alignment.character_start_times_seconds : [];
  const ends = Array.isArray(alignment?.character_end_times_seconds) ? alignment.character_end_times_seconds : [];
  if (!characters.length || characters.length !== starts.length || characters.length !== ends.length) return [];

  const words: { word: string; start: number; end: number }[] = [];
  let current: { word: string; start: number; end: number } | null = null;
  const flush = () => {
    if (current?.word.trim()) words.push({
      word: current.word.trim(),
      start: Number(current.start.toFixed(3)),
      end: Number(Math.max(current.end, current.start + 0.02).toFixed(3)),
    });
    current = null;
  };

  characters.forEach((character, index) => {
    if (/\s/.test(character)) {
      flush();
      return;
    }
    if (!current) current = { word: "", start: Number(starts[index]) || 0, end: Number(ends[index]) || 0 };
    current.word += character;
    current.end = Number(ends[index]) || current.end;
  });
  flush();
  return words;
}

function buildSegments(words: { word: string; start: number; end: number }[], size = 4) {
  const segments = [];
  for (let index = 0; index < words.length; index += size) {
    const group = words.slice(index, index + size);
    if (group.length) segments.push({
      text: group.map(item => item.word).join(" "),
      start: group[0].start,
      end: group[group.length - 1].end,
    });
  }
  return segments;
}

function isMissingRpc(error: { code?: string; message?: string } | null | undefined) {
  const code = String(error?.code ?? "");
  const message = String(error?.message ?? "");
  return code === "42883" || code === "PGRST202" || /could not find the function|does not exist/i.test(message);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS, "content-type": "application/json" },
    });
  }

  let body: { voice?: string; script?: string; generationId?: string } = {};
  try { body = await req.json(); } catch {}

  const voice = String(body.voice ?? "TxGEqnHWrfWFTfGW9XjX");
  const script = String(body.script ?? "").trim().slice(0, 700);
  const generationId = String(body.generationId ?? "").trim();

  if (!VALID_VOICES.has(voice)) {
    return new Response(JSON.stringify({ error: "Invalid voice" }), {
      status: 400,
      headers: { ...CORS, "content-type": "application/json" },
    });
  }
  if (!script) {
    return new Response(JSON.stringify({ error: "Missing script" }), {
      status: 400,
      headers: { ...CORS, "content-type": "application/json" },
    });
  }
  if (!generationId) {
    return new Response(JSON.stringify({ error: "Missing generationId" }), {
      status: 400,
      headers: { ...CORS, "content-type": "application/json" },
    });
  }

  const authorization = req.headers.get("authorization") ?? "";
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { error: reserveError } = await supabase.rpc("reserve_cooking_voice_generation", {
    p_generation_id: generationId,
  });
  let reservationMade = !reserveError;
  if (reserveError && isMissingRpc(reserveError)) {
    const { data: ownedGeneration, error: ownershipError } = await supabase
      .from("cooking_matic_generations")
      .select("id, voice_takes")
      .eq("id", generationId)
      .maybeSingle();
    if (ownershipError || !ownedGeneration) {
      return new Response(JSON.stringify({ error: "Could not reserve voice generation" }), {
        status: 403,
        headers: { ...CORS, "content-type": "application/json" },
      });
    }
    const generatedTakes = Array.isArray(ownedGeneration.voice_takes)
      ? ownedGeneration.voice_takes.filter((take: { imported?: unknown }) => !take?.imported).length
      : 0;
    if (generatedTakes >= 2) {
      return new Response(JSON.stringify({ error: "VOICE_LIMIT_REACHED" }), {
        status: 409,
        headers: { ...CORS, "content-type": "application/json" },
      });
    }
    reservationMade = false;
    console.warn("[cooking-voice-generate] reservation RPC missing; continuing after RLS ownership/limit check");
  } else if (reserveError) {
    const limitReached = String(reserveError.message ?? "").includes("VOICE_LIMIT_REACHED");
    return new Response(JSON.stringify({
      error: limitReached ? "VOICE_LIMIT_REACHED" : "Could not reserve voice generation",
    }), {
      status: limitReached ? 409 : 400,
      headers: { ...CORS, "content-type": "application/json" },
    });
  }

  const releaseReservation = async () => {
    if (!reservationMade) return;
    await admin.rpc("release_cooking_voice_generation", { p_generation_id: generationId });
  };

  let res: Response;
  try {
    res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_128`, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVEN_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: script,
        model_id: "eleven_flash_v2_5",
        // The returned character alignment is the single source of truth for
        // captions. Playback normalization happens later on the same clock.
        voice_settings: {
          stability: 0.48,
          similarity_boost: 0.75,
          style: 0.12,
          use_speaker_boost: true,
          speed: 0.92,
        },
      }),
    });
  } catch (error) {
    await releaseReservation();
    console.error("[cooking-voice-generate] provider request failed:", error);
    return new Response(JSON.stringify({ error: "TTS generation failed" }), {
      status: 502,
      headers: { ...CORS, "content-type": "application/json" },
    });
  }

  if (!res.ok) {
    await releaseReservation();
    const text = await res.text().catch(() => "");
    console.error("[cooking-voice-generate] ElevenLabs error:", res.status, text.slice(0, 300));
    return new Response(JSON.stringify({ error: "TTS generation failed", providerStatus: res.status }), {
      status: 502,
      headers: { ...CORS, "content-type": "application/json" },
    });
  }

  const payload = await res.json();
  const audioBase64 = String(payload.audio_base64 ?? "");
  // Captions display the original script, so use the timestamps for the
  // original characters. normalized_alignment can insert/spell out tokens
  // and slowly move word boundaries away from the text shown on screen.
  const alignment = payload.alignment ?? payload.normalized_alignment;
  const words = alignmentToWords(alignment);
  if (!audioBase64 || !words.length) {
    await releaseReservation();
    console.error("[cooking-voice-generate] missing audio or timestamp alignment");
    return new Response(JSON.stringify({ error: "TTS timing generation failed" }), {
      status: 502,
      headers: { ...CORS, "content-type": "application/json" },
    });
  }

  const durationSec = words.reduce((maximum, word) => Math.max(maximum, word.end), 0);
  return new Response(JSON.stringify({
    audioBase64,
    mimeType: "audio/mpeg",
    durationSec,
    captionScript: {
      script,
      words,
      segments: buildSegments(words),
      timingVersion: 3,
      timingSource: "elevenlabs-character-alignment",
    },
  }), {
    status: 200,
    headers: {
      ...CORS,
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
});
