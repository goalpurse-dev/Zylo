// cooking-speech-transcribe/index.ts
// POST multipart/form-data { audio: File, durationSec?: number }
// Returns { script, words: [{word,start,end}], segments: [{text,start,end}] }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY")!;

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "content-type": "application/json",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

function estimateWordTimings(text: string, durationSec: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const safeDuration = Math.max(1, Number(durationSec) || 30);
  const secondsPerWord = words.length > 0
    ? Math.max(0.18, Math.min(0.52, safeDuration / words.length))
    : 0.32;
  return words.map((word, i) => ({
    word,
    start: Number((i * secondsPerWord).toFixed(2)),
    end: Number(((i + 1) * secondsPerWord).toFixed(2)),
  }));
}

function buildSegments(words: { word: string; start: number; end: number }[], size = 5) {
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

  const durationSec = Number(form.get("durationSec") ?? 30);
  const body = new FormData();
  body.append("file", audio, audio.name || "speech.mp3");
  body.append("model", "whisper-1");
  body.append("response_format", "json");

  try {
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}` },
      body,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[cooking-speech-transcribe] OpenAI error:", res.status, text.slice(0, 200));
      return json({ error: "Speech transcription failed" }, 502);
    }

    const data = await res.json();
    const script = String(data.text ?? "").trim();
    const words = estimateWordTimings(script, durationSec);
    return json({ script, words, segments: buildSegments(words) });
  } catch (error) {
    console.error("[cooking-speech-transcribe] Exception:", (error as Error).message);
    return json({ error: "Speech transcription failed" }, 500);
  }
});
