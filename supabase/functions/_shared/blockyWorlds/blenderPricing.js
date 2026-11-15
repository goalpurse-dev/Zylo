// Blocky Worlds: THE BLENDER ENGINE'S MEASURED COST MODEL (2026-11-15). The owner approved it: pricing.js prices with it
// (docs/blocky-worlds-blender-pricing.patch, applied 2026-11-15; the rows: migration 20261216100000).
//
// The rule (pricing.js): 1 credit = $0.01 of OUR full real cost; the user pays $0.02 a credit (2x our cost).
// Measured on the four real Blender runs (report.json / costs.json of each run):
//   hiccup   60.7 s: script $0.246, voice $0.102, director $0.783, checker $0.059, previews $0.032, final $0.227 = $1.449
//   plane    72.9 s: script $0.184, voice $0.126, director $2.094 (3 avoidable cache rewrites, fixed since), checker $0.063, previews $0.053, final $0.270
//   tower    99.2 s: voice $0.152, director $1.335, checker $0.092, previews $0.062, final $0.297
//   milo     96.3 s: voice $0.148, director $1.571, checker $0.113, previews $0.309 (2 fix rounds), final $0.973 (two finals: v1 + a reshoot)
// Each rate below is the WORST measured per video-second (the plane's director excluded: its cache bug is fixed), the
// final at Milo's slowest single final (0.65-0.99 s a frame, the finish included): one price covers the newest pipeline.
export const BLENDER_RATES = Object.freeze({
  writingUsd: 0.25,             // the script (+ the "explain more" adapt): max measured $0.246
  voicePerSecUsd: 0.00173,      // plane 0.1262 / 72.9
  directorPerSecUsd: 0.0163,    // milo 1.571 / 96.3
  checkerPerSecUsd: 0.00117,    // milo 0.113 / 96.3
  previewsPerSecUsd: 0.0032,    // milo 0.309 / 96.3 (round 0 + 2 fix rounds)
  finalPerSecUsd: 0.0051,       // milo: one final of the two ($0.49) / 96.3, the finish included
  passRate: 0.85,               // a failed run is refunded; it usually stops before the final
});
const r4 = (x) => Number(x.toFixed(4));
/** one attempt's parts (USD) for a video of `sec` seconds */
export function blenderAttemptCost(sec, R = BLENDER_RATES) {
  return {
    script: r4(R.writingUsd), voice: r4(sec * R.voicePerSecUsd), director: r4(sec * R.directorPerSecUsd),
    checker: r4(sec * R.checkerPerSecUsd), gpuPreviews: r4(sec * R.previewsPerSecUsd), gpuFinalAndFinish: r4(sec * R.finalPerSecUsd),
  };
}
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
/** the failure allowance: the refunded failures' spend (everything but the final) shared by the delivered videos */
export function blenderFailureAllowance(sec, R = BLENDER_RATES) {
  const a = blenderAttemptCost(sec, R);
  return r4(((a.script + a.voice + a.director + a.checker + a.gpuPreviews) * (1 - R.passRate)) / R.passRate);
}
/** our full real cost of one delivered video (USD) */
export const blenderFullCostUsd = (sec, R = BLENDER_RATES) => r4(sum(blenderAttemptCost(sec, R)) + blenderFailureAllowance(sec, R));
/** the credits (1 credit = $0.01 of our full cost; the user pays $0.02 a credit) */
export const blenderCredits = (sec, R = BLENDER_RATES) => Math.ceil(blenderFullCostUsd(sec, R) / 0.01 - 1e-9);
/** the table for the owner: [{ sec, parts, allowanceUsd, costUsd, credits, userUsd }] */
export function blenderPriceTable(secs = [60, 90, 120], R = BLENDER_RATES) {
  return secs.map((sec) => ({ sec, parts: blenderAttemptCost(sec, R), allowanceUsd: blenderFailureAllowance(sec, R), costUsd: blenderFullCostUsd(sec, R), credits: blenderCredits(sec, R), userUsd: r4(blenderCredits(sec, R) * 0.02) }));
}
/** THE BLENDER PAGE'S ONE PRICE (owner 2026-11-15, like our other templates): a flat price per video = the 90 s row,
 *  charged when the user presses "Write my script" (rewrites, voice and render included). The writer is capped so the
 *  video stays at ~90 s (writeSec 80: realSeconds 80 = ~92 s at the voice's pace; checkScript refuses longer), so the
 *  90 s row covers every video. Refunds: the whole price when the video fails (blocky_worlds_refund, once); all but
 *  keepCredits (the script) when "Make my video" is never pressed within expireDays (blocky_worlds_prepay_expire). */
export const BLENDER_FLAT = Object.freeze({ credits: blenderCredits(90), priceRowSec: 90, writeSec: 80, keepCredits: 25, expireDays: 7 });

/** the ONE price the page shows after the script: the story's real length (its words at the voice's pace) rounded up
 *  to the next 10 s, within 30-180 s */
export function blenderQuote(seconds, R = BLENDER_RATES) {
  const sec = Math.min(180, Math.max(30, Math.ceil(Number(seconds || 0) / 10) * 10));
  return { sec, credits: blenderCredits(sec, R) };
}
