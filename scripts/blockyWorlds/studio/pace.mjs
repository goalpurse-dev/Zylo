// STUDIO MODE: the voice pace. The take (voice/eleven.mjs: silences over 0.15 s cut, then sped up at the same pitch)
// is re-processed with a speed factor fitted to THIS take so the timed words land at TARGET wpm (engine paceStats),
// within the band BAND, the factor capped at MAX_SPEED. The paid take is reused (take.json + voice.mp3): re-processing
// is local ffmpeg, free. eleven.mjs reads its speed once at import (BLOCKY_WORLDS_VOICE_SPEED), so each factor gets a
// fresh module instance (an import URL with the factor in its query).
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ELEVEN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../engine/voice/eleven.mjs");
export const TARGET = 267, BAND = [255, 280], MAX_SPEED = 1.47; // ~1.45x as the owner set; 1.47 is the hard ceiling

async function at(speed, args) {
  process.env.BLOCKY_WORLDS_VOICE_SPEED = String(speed);
  const m = await import(`${pathToFileURL(ELEVEN).href}?speed=${speed}`);
  const v = await m.elevenVoice(args);
  return { v, pace: m.paceStats(v.words) };
}

/** the take at its fitted speed: { v (elevenVoice result), pace, speed, inBand, note } (the take must already exist
 *  in outDir, or `allowPaid` must be true for the one paid take at the default speed) */
export async function fitPace({ lines, outDir, narrator, allowPaid = false, log = () => {} }) {
  const first = await at(1.25, { lines, outDir, narrator, force: false, ...(allowPaid ? {} : { apiKey: "no-paid-call" }) });
  let speed = 1.25, best = first;
  for (let i = 0; i < 3 && (best.pace.wpm < BAND[0] || best.pace.wpm > BAND[1]); i++) {
    const want = +(Math.min(MAX_SPEED, Math.max(1.0, speed * (TARGET / best.pace.wpm)))).toFixed(3);
    if (Math.abs(want - speed) < 0.005) break;
    speed = want; best = await at(speed, { lines, outDir, narrator });
    log(`pace: ${speed}x -> ${best.pace.wpm} wpm`);
  }
  const inBand = best.pace.wpm >= BAND[0] && best.pace.wpm <= BAND[1];
  const note = inBand ? null : best.pace.wpm < BAND[0] ? `the voice reaches ${best.pace.wpm} wpm at the ${MAX_SPEED}x ceiling (the narrator's own pace after the silence cut is too slow for ${BAND[0]})` : `${best.pace.wpm} wpm even at 1.0x`;
  return { v: best.v, pace: best.pace, speed, inBand, note, firstWpm: first.pace.wpm };
}
