// voicePace.ts — measured narration pace per voice (Phase 2c).
//
// Script word targets, the UI's "≈ X words · ~Y visuals" copy, scene/quote
// estimates and the Beat Director's synthetic timings all used one fixed
// WORDS_PER_MINUTE (145). The real Myth vs Reality narration (Josh, eleven_
// flash_v2_5, speed 0.92) measured 119 wpm — a 10-minute target would have
// run ~12 minutes. Pace is a property of the SELECTED voice + model + speed,
// so it is measured with a short sample and looked up here; unmeasured
// voices fall back to WORDS_PER_MINUTE and are reported as uncalibrated.
// Imported by both the frontend and edge functions (like
// longFormPipelineConstants.ts).
import { WORDS_PER_MINUTE } from "./longFormPipelineConstants.ts";

export type VoiceCalibration = {
  label: string;
  voiceId: string;
  voiceModel: string;
  speed: number;
  measuredWpm: number;
  source: string;
};

// Every row is a real measurement (words / spoken span of an ElevenLabs
// with-timestamps alignment). Add rows only from real samples.
export const VOICE_CALIBRATIONS: VoiceCalibration[] = [
  { label: "Josh", voiceId: "TxGEqnHWrfWFTfGW9XjX", voiceModel: "eleven_flash_v2_5", speed: 0.92, measuredWpm: 119, source: "Myth vs Reality full narration, 1,038 words, 2026-09-27 (tests/fixtures/stickman/audio/myth-vs-reality); its first 92 words alone ran 125.2" },
  { label: "Josh", voiceId: "TxGEqnHWrfWFTfGW9XjX", voiceModel: "eleven_flash_v2_5", speed: 1.0, measuredWpm: 146.6, source: "92-word cold-open sample, 2026-09-27 (tests/fixtures/stickman/audio/pace-samples/josh-flash_v2_5-speed-1.00); same passage at 0.92 ran 125.2, so a full script likely lands ~139" },
];

// Voices offered for Stickman narration that have no measurement yet —
// they use WORDS_PER_MINUTE until calibrated with a short sample.
export const UNCALIBRATED_VOICES = [
  { label: "Rachel", voiceId: "21m00Tcm4TlvDq8ikWAM" },
  { label: "Bella", voiceId: "EXAVITQu4vr4xnSDxMaL" },
  { label: "Antoni", voiceId: "ErXwobaYiN019PkySvjV" },
];

// ElevenLabs speed used for Stickman narration when a profile doesn't set one.
// Phase 2c: 1.0 (146.6 wpm measured, in the genre's 140-155 band; 0.92 gave 119).
export const DEFAULT_NARRATION_SPEED = 1.0;

export type VoicePace = { wordsPerMinute: number; calibrated: boolean; source: string };

// The selected voice's pace: an exact (voice, model, speed) measurement, or
// the WORDS_PER_MINUTE fallback marked uncalibrated. Speeds match to 2 dp.
export function wordsPerMinuteFor(voice?: { voiceId?: string | null; voiceModel?: string | null; speed?: number | null } | null): VoicePace {
  const speed = Math.round(Number(voice?.speed ?? DEFAULT_NARRATION_SPEED) * 100) / 100;
  const hit = VOICE_CALIBRATIONS.find((c) => c.voiceId === voice?.voiceId && c.voiceModel === voice?.voiceModel && Math.round(c.speed * 100) / 100 === speed);
  return hit ? { wordsPerMinute: hit.measuredWpm, calibrated: true, source: hit.source } : { wordsPerMinute: WORDS_PER_MINUTE, calibrated: false, source: "fallback WORDS_PER_MINUTE" };
}

// The pace of a generation profile row (voice_id, voice_model, voice_settings.speed).
export function wordsPerMinuteForProfile(profile?: { voice_id?: string | null; voice_model?: string | null; voice_settings?: { speed?: number | null } | null } | null): VoicePace {
  return wordsPerMinuteFor({ voiceId: profile?.voice_id, voiceModel: profile?.voice_model, speed: profile?.voice_settings?.speed ?? DEFAULT_NARRATION_SPEED });
}

// Measured pace from aligned words ({start, end} in seconds): words over the
// spoken span, pauses included — the same way the full narration was measured.
export function measuredWpm(words: { start: number; end: number }[]): number {
  if (!words.length) return 0;
  const span = words[words.length - 1].end - words[0].start;
  return span > 0 ? Math.round((words.length / (span / 60)) * 10) / 10 : 0;
}
