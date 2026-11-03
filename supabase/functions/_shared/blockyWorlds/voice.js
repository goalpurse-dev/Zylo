// Blocky Worlds: the narrator's voice (ElevenLabs text-to-speech with timestamps). fetch only.
// The voice, model and settings come from config.js NARRATOR; this file checks them against the API's ranges and
// builds the request. Nothing here runs until a video is generated (no paid call happens on import or in tests).
import { NARRATOR } from "./config.js";

/** The ElevenLabs API's ranges for voice_settings (API reference, text-to-speech; checked 2026-11-03). */
export const VOICE_RANGES = Object.freeze({
  stability: Object.freeze([0, 1]),
  similarity_boost: Object.freeze([0, 1]),
  style: Object.freeze([0, 1]),
  speed: Object.freeze([0.7, 1.2]),
});

/** Problems with a narrator config, as sentences (empty = fine). */
export function narratorProblems(n = NARRATOR) {
  const out = [];
  if (!/^[A-Za-z0-9]{20}$/.test(String(n?.voiceId ?? ""))) out.push("voiceId is not a 20-character ElevenLabs voice ID");
  if (!String(n?.model ?? "").startsWith("eleven_")) out.push("model is not an ElevenLabs model ID");
  for (const [key, [lo, hi]] of Object.entries(VOICE_RANGES)) {
    const v = n?.settings?.[key];
    if (typeof v !== "number" || !Number.isFinite(v)) out.push(`${key} is missing`);
    else if (v < lo || v > hi) out.push(`${key} ${v} is outside ${lo}-${hi}`);
  }
  if (typeof n?.settings?.use_speaker_boost !== "boolean") out.push("use_speaker_boost is not true/false");
  return out;
}

/** The request body for /v1/text-to-speech/{voiceId}/with-timestamps. */
export function ttsBody(text, n = NARRATOR) {
  const s = n.settings;
  return {
    text,
    model_id: n.model,
    voice_settings: { stability: s.stability, similarity_boost: s.similarity_boost, style: s.style, use_speaker_boost: s.use_speaker_boost, speed: s.speed },
  };
}

/** ElevenLabs character alignment -> [{w, s, e}] words (seconds). Same as Cutaway's. */
export function alignmentWords(alignment) {
  const chars = alignment?.characters ?? [];
  const starts = alignment?.character_start_times_seconds ?? [];
  const ends = alignment?.character_end_times_seconds ?? [];
  const out = [];
  let cur = null;
  chars.forEach((c, i) => {
    if (/\s/.test(c)) {
      if (cur) out.push(cur);
      cur = null;
      return;
    }
    if (!cur) cur = { w: "", s: Number(starts[i]) || 0, e: Number(ends[i]) || 0 };
    cur.w += c;
    cur.e = Number(ends[i]) || cur.e;
  });
  if (cur) out.push(cur);
  return out;
}

/** What one take costs us (USD): ElevenLabs reports the characters it billed; one ElevenLabs credit = $0.0002. */
export const USD_PER_ELEVEN_CREDIT = 0.0002;

/** One take of the narration. Called by the video pipeline only (a paid call). */
export async function synthesize({ apiKey, text, narrator = NARRATOR }) {
  const problems = narratorProblems(narrator);
  if (problems.length) throw new Error(`VOICE_CONFIG: ${problems.join("; ")}`);
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${narrator.voiceId}/with-timestamps?output_format=${narrator.outputFormat}`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(ttsBody(text, narrator)),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`VOICE_FAILED: ${res.status} ${(await res.text().catch(() => "")).slice(0, 300)}`);
  const payload = await res.json();
  const audioBase64 = String(payload.audio_base64 ?? "");
  const spoken = alignmentWords(payload.alignment ?? payload.normalized_alignment);
  if (!audioBase64 || !spoken.length) throw new Error("VOICE_FAILED: no audio or no timings");
  const billed = Number(res.headers.get("character-cost"));
  const costUsd = Number.isFinite(billed) && billed > 0 ? Number((billed * USD_PER_ELEVEN_CREDIT).toFixed(5)) : null;
  return { audioBase64, spoken, costUsd };
}
