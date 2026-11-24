// IN THIS TOWN v2: the voices (owner 2026-11-24). The narrator: the owner's roblox-story voice, STABLE (one even voice,
// no accent drift): stability 0.75, similarity max, style 0, speaker boost on, 1.2x. Three samples to pick from.
// The copy: a soft, too-sweet woman's voice, slightly slow (never a monster voice).
import { ROBLOX_STORY } from "../../../supabase/functions/_shared/blockyWorlds/config.js";

export const STABLE = Object.freeze({ stability: 0.75, similarity_boost: 1.0, style: 0, use_speaker_boost: true, speed: 1.2 });
export const NARRATOR_SAMPLES = Object.freeze({
  a: { ...ROBLOX_STORY, model: "eleven_turbo_v2_5", language: "en", settings: STABLE, pace: 1.2, about: "roblox-story, stability 0.75, similarity max, style 0, boost on, English-only (turbo v2.5, language en)" },
  b: { ...ROBLOX_STORY, model: "eleven_multilingual_v2", settings: STABLE, pace: 1.2, about: "roblox-story, the same settings, multilingual v2" },
  c: { ...ROBLOX_STORY, voiceId: "TX3LPaxmHKxFdv7VOQHJ", voiceName: "Liam", model: "eleven_turbo_v2_5", language: "en", settings: STABLE, pace: 1.2, about: "Liam (ElevenLabs stock voice: neutral American, young narrator), the same settings, English-only" },
});
// the copy: Sarah (ElevenLabs stock, a soft American woman), very even (stability 0.85), made slightly slow (0.9) and
// kept at that pace (never sped up with the narrator)
export const COPY_SWEET = Object.freeze({
  provider: "elevenlabs", voiceId: "EXAVITQu4vr4xnSDxMaL", voiceName: "Sarah (the copy: soft, too sweet)", model: "eleven_multilingual_v2",
  settings: Object.freeze({ stability: 0.85, similarity_boost: 0.9, style: 0, use_speaker_boost: true, speed: 0.9 }),
  outputFormat: "mp3_44100_128", pace: 0.9, ownPace: true,
});
