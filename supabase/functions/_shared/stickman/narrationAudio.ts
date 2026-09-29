// deno-lint-ignore-file no-explicit-any
// stickman/narrationAudio.ts — 2026-10-02 "real narration audio master
// timeline" pass, Section 7/8/9.
//
// The real ElevenLabs call is ported from the SAME proven pattern already
// live in thirty-days-voice-generate/index.ts (and cooking-voice-generate's
// identical copy) — same endpoint shape, same `with-timestamps` response,
// same alignment field. This module owns: the hash-based idempotency keys,
// the actual provider call, and wiring the result through
// ttsAlignment.ts's attachWordTimingsToSegments (already built, already
// tested) to produce the per-segment master timeline. It does NOT own
// persistence (the edge function does that, since only it holds the admin
// client) or durability (also the edge function, via EdgeRuntime.waitUntil).

import { alignmentToWords, attachWordTimingsToSegments, type ElevenLabsAlignment, type AttachTimingsResult } from "../ttsAlignment.ts";
import { DEFAULT_NARRATION_SPEED } from "../../../../src/lib/voicePace.ts";

export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// A separator character that can never appear in real narration text —
// prevents "segment A ends in 'cat'" + "segment B starts with 'alog'"
// hashing identically to a differently-split "catalog" script (a real,
// if unlikely, hash-collision class of bug worth closing deterministically).
const SEGMENT_HASH_SEPARATOR = "␟";

export function computeScriptInputHash(segments: { text: string }[]): Promise<string> {
  return sha256Hex(segments.map((s) => s.text).join(SEGMENT_HASH_SEPARATOR));
}

export type VoiceSpec = { provider: string; voiceId: string; voiceModel: string; voiceSettings: Record<string, unknown>; language: string | null };

export function computeRequestHash(scriptInputHash: string, voice: VoiceSpec): Promise<string> {
  return sha256Hex(JSON.stringify({ scriptInputHash, ...voice }));
}

// Phase 2c: speed 1.0 measured 146.6 wpm for Josh (0.92 gave 119 on the full
// Myth vs Reality narration) — see src/lib/voicePace.ts.
export const DEFAULT_ELEVENLABS_VOICE_SETTINGS = { stability: 0.48, similarity_boost: 0.75, style: 0.12, use_speaker_boost: true, speed: DEFAULT_NARRATION_SPEED };

export type SynthesizeResult = {
  audioBase64: string;
  mimeType: string;
  durationSeconds: number;
  rawAlignment: ElevenLabsAlignment;
  // ElevenLabs' own per-request charge (response header `character-cost`), or
  // null when absent — the body has no cost field and a scoped key may not
  // be allowed to read the subscription quota.
  characterCost: number | null;
  requestId: string | null;
};

// The real, live ElevenLabs call — identical endpoint/shape to
// thirty-days-voice-generate's own proven implementation. Never called
// speculatively: the caller must already know this exact (script, voice)
// combination has no existing ready row (see the request_hash idempotency
// check in the edge function) before spending a real provider call here.
export async function synthesizeNarrationAudio(args: { elevenLabsKey: string; text: string; voiceId: string; voiceModel: string; voiceSettings?: Record<string, unknown> }): Promise<SynthesizeResult> {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${args.voiceId}/with-timestamps?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": args.elevenLabsKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      text: args.text,
      model_id: args.voiceModel,
      voice_settings: args.voiceSettings ?? DEFAULT_ELEVENLABS_VOICE_SETTINGS,
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`NARRATION_TTS_PROVIDER_FAILED: ${res.status} ${body.slice(0, 300)}`);
  }
  const payload = await res.json();
  const audioBase64 = String(payload.audio_base64 ?? "");
  // Same rule as thirty-days-voice-generate: captions/timing must track the
  // ORIGINAL script text, so use `alignment` (not `normalized_alignment`,
  // which can insert/spell out tokens and drift word boundaries away from
  // the text actually shown to the user).
  const rawAlignment: ElevenLabsAlignment = payload.alignment ?? payload.normalized_alignment ?? {};
  if (!audioBase64) throw new Error("NARRATION_TTS_MISSING_AUDIO");
  const words = alignmentToWords(rawAlignment);
  if (!words.length) throw new Error("NARRATION_TTS_MISSING_ALIGNMENT");
  const durationSeconds = words.reduce((max, w) => Math.max(max, w.end), 0);
  const cost = res.headers.get("character-cost");
  return { audioBase64, mimeType: "audio/mpeg", durationSeconds, rawAlignment, characterCost: cost != null && cost !== "" && Number.isFinite(Number(cost)) ? Number(cost) : null, requestId: res.headers.get("request-id") };
}

// Phase 6a narration fix — decode the (~12 MB) base64 MP3 NATIVELY. The old
// `Uint8Array.from(atob(b64), c => c.charCodeAt(0))` ran a JS callback per
// character: ~12.5M calls for a 1,434-word script, enough to cross the edge
// runtime's CPU limit — the isolate was killed mid-run, no catch ran, and the
// row sat at "generating" forever (the 2026-09-28 "stuck narration").
export async function decodeBase64Native(b64: string, mime = "audio/mpeg"): Promise<Uint8Array> {
  return new Uint8Array(await (await fetch(`data:${mime};base64,${b64}`)).arrayBuffer());
}

// Measured: 6,310 characters -> ready in 13 s (Phase 2b). Honest range for a
// script of `chars` characters: [typical, slow] seconds.
export function narrationEtaSeconds(chars: number): [number, number] {
  return [Math.max(10, Math.round(chars / 700)), Math.max(30, Math.round(chars / 200) + 10)];
}
// The watchdog: no progress for (slow estimate + 90 s) -> the lease expires.
export const narrationLeaseMs = (chars: number) => (narrationEtaSeconds(chars)[1] + 90) * 1000;
export const NARRATION_MAX_ATTEMPTS = 2;

// Pure — re-derivable from a stored raw_provider_alignment with NO new
// provider call, which is exactly what Section 10's "reconcile alignment
// separately" path needs.
export function mapAlignmentToNarration(rawAlignment: ElevenLabsAlignment, segments: { id: string; text: string }[]): AttachTimingsResult {
  const words = alignmentToWords(rawAlignment);
  return attachWordTimingsToSegments(segments, words);
}
