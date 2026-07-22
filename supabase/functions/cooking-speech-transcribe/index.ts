// cooking-speech-transcribe/index.ts
// POST multipart/form-data { audio: File, durationSec?: number }
// Returns { script, words: [{word,start,end}], segments: [{text,start,end}] }

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
  "content-type": "application/json",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

function buildSegments(words: { word: string; start: number; end: number }[], size = 3) {
  const out: { text: string; start: number; end: number }[] = [];
  for (let i = 0; i < words.length; i += size) {
    const chunk = words.slice(i, i + size);
    if (chunk.length) {
      out.push({
        text: chunk.map(w => w.word).join(" "),
        start: chunk[0].start,
        end: chunk[chunk.length - 1].end,
      });
    }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: "Invalid form data" }, 400);
  }

  const audio = form.get("audio");
  if (!(audio instanceof File)) {
    return json({ error: "audio file required" }, 400);
  }
  if (audio.size <= 0 || audio.size > 25 * 1024 * 1024) {
    return json({ error: "Audio must be between 1 byte and 25 MB" }, 413);
  }
  if (audio.type && !audio.type.startsWith("audio/")) {
    return json({ error: "Unsupported audio file" }, 415);
  }

  const generationId = String(form.get("generationId") ?? "").trim();
  if (!generationId) return json({ error: "Missing generationId" }, 400);
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: req.headers.get("authorization") ?? "" } },
    auth: { persistSession: false },
  });
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { error: reserveError } = await supabase.rpc("reserve_cooking_service_request", {
    p_generation_id: generationId,
    p_kind: "transcription",
  });
  if (reserveError) {
    const limited = String(reserveError.message ?? "").includes("SERVICE_LIMIT_REACHED");
    return json({ error: limited ? "Automatic transcription limit reached for this creation" : "Creation access denied" }, limited ? 429 : 403);
  }

  const knownTranscript = String(form.get("transcript") ?? "").trim().slice(0, 4000);
  const providerBody = new FormData();
  providerBody.append("file", audio, audio.name || "speech.mp3");
  if (knownTranscript) {
    // Forced Alignment keeps the creator's exact script and returns the
    // precise time at which ElevenLabs hears each word in the audio.
    providerBody.append("text", knownTranscript);
  } else {
    // Imported audio has no trusted script, so Scribe v2 produces both the
    // transcript and its native word timestamps.
    providerBody.append("model_id", "scribe_v2");
    providerBody.append("timestamps_granularity", "word");
    providerBody.append("tag_audio_events", "false");
    providerBody.append("diarize", "false");
  }

  try {
    const res = await fetch(
      knownTranscript
        ? "https://api.elevenlabs.io/v1/forced-alignment"
        : "https://api.elevenlabs.io/v1/speech-to-text",
      {
      method: "POST",
      headers: { "xi-api-key": ELEVEN_KEY },
      body: providerBody,
      },
    );

    if (!res.ok) {
      await admin.rpc("release_cooking_service_request", { p_generation_id: generationId, p_kind: "transcription" });
      const text = await res.text().catch(() => "");
      console.error("[cooking-speech-transcribe] ElevenLabs error:", res.status, text.slice(0, 200));
      return json({ error: "Speech transcription failed" }, 502);
    }

    const data = await res.json();
    const script = knownTranscript || String(data.text ?? "").trim();
    const providerWords = Array.isArray(data.words)
      ? data.words
        .filter((item: { type?: unknown }) => !item.type || item.type === "word")
        .map((item: { word?: unknown; text?: unknown; start?: unknown; end?: unknown }) => ({
          word: String(item.word ?? item.text ?? "").trim(),
          start: Number(Number(item.start ?? 0).toFixed(3)),
          end: Number(Number(item.end ?? item.start ?? 0).toFixed(3)),
        }))
        .filter((item: { word: string; start: number; end: number }) => item.word && Number.isFinite(item.start) && Number.isFinite(item.end))
      : [];
    if (!script || !providerWords.length) {
      await admin.rpc("release_cooking_service_request", { p_generation_id: generationId, p_kind: "transcription" });
      console.error("[cooking-speech-transcribe] ElevenLabs returned no word timestamps");
      return json({ error: "Speech timing generation failed" }, 502);
    }
    return json({
      script,
      words: providerWords,
      segments: buildSegments(providerWords),
      timingVersion: 3,
      timingSource: knownTranscript
        ? "elevenlabs-forced-alignment"
        : "elevenlabs-scribe-v2-word-timestamps",
    });
  } catch (error) {
    await admin.rpc("release_cooking_service_request", { p_generation_id: generationId, p_kind: "transcription" });
    console.error("[cooking-speech-transcribe] Exception:", (error as Error).message);
    return json({ error: "Speech transcription failed" }, 500);
  }
});
