// Cutaway Explainer: the sound effect library and how cues become files.
//
// Clips are silent; every sound is added in the stitch. No music, no whooshes.
// - "chime": the fixed two-tone chime (render-worker/assets/sfx/chime.wav, made
//   with ffmpeg by scripts/cutaway/makeChime.mjs: ours, no licence question).
//   Plays on every "This is a ...", every number card and "Congratulations".
// - library keys: common sounds with a FIXED prompt, generated once with
//   ElevenLabs sound effects and cached under the key (so every video uses
//   the same file). ElevenLabs output is cleared for commercial use on paid plans.
// - "custom": anything topic-specific; generated from the cue text and cached
//   by a hash of the text + length, so a repeat costs nothing.

export const LIBRARY = Object.freeze({
  splash: { prompt: "a single water splash, close, clean, no background", seconds: 1.5 },
  water_rush: { prompt: "water rushing through a pipe, steady flow", seconds: 3 },
  drip: { prompt: "a few slow water drips into a puddle", seconds: 2.5 },
  crack: { prompt: "concrete cracking with a short crunch", seconds: 1.5 },
  engine: { prompt: "a heavy diesel truck engine idling then driving past", seconds: 3 },
  flame: { prompt: "a gas flame igniting and burning steadily", seconds: 2.5 },
  motor_hum: { prompt: "a small electric motor humming steadily", seconds: 3 },
  rain: { prompt: "steady rain falling on a lawn and roof, no thunder", seconds: 3 },
  dirt: { prompt: "a shovel of dirt and gravel being dumped and settling", seconds: 2 },
  machine: { prompt: "a large construction machine working: hydraulics and metal clanks", seconds: 3 },
});

export const SOUND_KEYS = Object.freeze([...Object.keys(LIBRARY), "custom"]);

/** Levels relative to the voice (the stitch applies them). */
export const LEVELS = Object.freeze({ voiceDb: 0, sfxDb: -12, chimeDb: -14, ambientDb: -28 });

/** Cache key for a cue: library key, or a short hash of the custom text + length. */
export async function cueCacheKey(cue) {
  if (cue.key !== "custom") return `lib-${cue.key}`;
  const data = new TextEncoder().encode(`${cue.text.trim().toLowerCase()}|${cue.seconds}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return `cue-${[...new Uint8Array(digest)].slice(0, 10).map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/** What to generate for a cue (prompt text + length in seconds). */
export function cueRequest(cue) {
  if (cue.key !== "custom") return { text: LIBRARY[cue.key].prompt, seconds: LIBRARY[cue.key].seconds };
  return { text: cue.text, seconds: cue.seconds };
}

/** ElevenLabs text-to-sound. Returns {bytes, costUsd}. */
export async function generateSfx({ apiKey, text, seconds }) {
  const res = await fetch("https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128", {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ text, duration_seconds: Math.min(22, Math.max(0.5, seconds)), prompt_influence: 0.5 }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`SFX_FAILED: ${res.status} ${(await res.text().catch(() => "")).slice(0, 200)}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const charCost = Number(res.headers.get("character-cost"));
  const costUsd = Number((Number.isFinite(charCost) && charCost > 0 ? charCost * 0.0002 : seconds * 0.008).toFixed(5));
  return { bytes, costUsd };
}
