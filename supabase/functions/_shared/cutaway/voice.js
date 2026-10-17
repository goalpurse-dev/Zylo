// Cutaway Explainer: the voiceover (ElevenLabs with-timestamps, the same call
// the other templates make) and its word timings. fetch only.

import { MODELS } from "./pricing.js";

// eleven_flash_v2_5 bills 0.5 characters per character; one credit = $0.0002 (costLedger.ts).
const USD_PER_CHARACTER = 0.5 * 0.0002;

/** ElevenLabs character alignment -> [{w, s, e}] words (seconds). */
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

export async function synthesize({ apiKey, text }) {
  const v = MODELS.voice;
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${v.voiceId}/with-timestamps?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      model_id: v.model,
      voice_settings: { stability: 0.45, similarity_boost: 0.75, style: 0.15, use_speaker_boost: true, speed: v.speed },
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`VOICE_FAILED: ${res.status} ${(await res.text().catch(() => "")).slice(0, 300)}`);
  const payload = await res.json();
  const audioBase64 = String(payload.audio_base64 ?? "");
  const spoken = alignmentWords(payload.alignment ?? payload.normalized_alignment);
  if (!audioBase64 || !spoken.length) throw new Error("VOICE_FAILED: no audio or no timings");
  const charCost = Number(res.headers.get("character-cost"));
  const costUsd = Number(((Number.isFinite(charCost) && charCost > 0 ? charCost * 0.0002 : text.length * USD_PER_CHARACTER)).toFixed(5));
  return { audioBase64, spoken, costUsd };
}
