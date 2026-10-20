// French drain audio ($0, local): Eric's re-timed take, word times for every cue, one-word captions with three
// number cards, and -20 dB mixes (effects + chimes) with and without the end card (same timing rule as the fixed
// landfill: the sign pops 0.4 s after the voice audibly stops, then holds 1.75 s after its pop). The rain bed is made
// here from filtered noise (no paid sound) and laid in at a fixed level under the voice, as the creator's beds are.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { speechEnd } from "./speechEnd.mjs";
const [wt, ff, OUT] = process.argv.slice(2);
process.env.FFMPEG = ff;
const V = "C:/Users/Public/Zylo/research/seamless-niche/m2drain/voice";
const words = JSON.parse(fs.readFileSync(`${V}/voice_final.words.json`, "utf8"));
fs.mkdirSync(OUT, { recursive: true });
fs.copyFileSync(`${V}/voice_final.mp3`, `${OUT}/voice.mp3`);
const at = (re, n = 1) => { let k = 0; for (const w of words) if (re.test(w.w) && ++k === n) return w.s; throw new Error(`no word ${re} #${n}`); };
const T = {
  dig: at(/^dig$/), drain: at(/^drain\.$/), but1: at(/^But$/), roof: at(/^roof$/), dumps: at(/^dumps$/), n600: at(/^600$/), walls: at(/^walls\.$/),
  ditch: at(/^ditch$/, 2), floods: at(/^floods\.$/), five: at(/^Five$/), pushes: at(/^pushes$/), n300: at(/^300$/), cracks: at(/^cracks\.$/),
  so1: at(/^So$/), fill: at(/^fill$/), gravel1: at(/^gravel,$/), bottom: at(/^bottom\.$/), so2: at(/^So$/, 2), pipe: at(/^pipe$/), holes: at(/^holes$/), gravel2: at(/^gravel\.$/),
  this: at(/^This$/), french1: at(/^French$/), seeps: at(/^seeps$/), slopes: at(/^slopes$/), downhill: at(/^downhill$/), away: at(/^away\.$/),
  wrap: at(/^Wrap$/), fabric: at(/^fabric$/), mud: at(/^mud$/), and1: at(/^And$/), french2: at(/^French$/, 2), not: at(/^not$/), it1: at(/^It$/), henry: at(/^Henry$/),
  n1859: at(/^1859\.$/), add: at(/^Add$/), grass: at(/^grass$/), top: at(/^top\.$/), congrats: at(/^Congratulations,$/), voiceEnd: words.at(-1).e,
};
const HOLD = 1.5, SIGN_GAP = 0.4, SIGN_POP = 0.45, SIGN_HOLD = 1.75;
T.speechEnd = speechEnd(ff, `${OUT}/voice.mp3`);
T.signPop = +(T.speechEnd + SIGN_GAP).toFixed(3);
T.lengthNoEnd = +(T.speechEnd + HOLD).toFixed(3);
T.lengthEnd = +(T.signPop + SIGN_POP + SIGN_HOLD).toFixed(3);
fs.writeFileSync(`${OUT}/times.json`, JSON.stringify({ lengthSec: T.lengthEnd, ...T }, null, 1));
// number cards: white (units, a year), on their word
const cards = [{ text: "600 GALLONS", s: T.n600, e: T.n600 + 1.8 }, { text: "300 LB", s: T.n300, e: T.n300 + 1.8 }, { text: "1859", s: T.n1859, e: T.n1859 + 1.3 }];
const { buildAss } = await import(pathToFileURL(path.join(wt, "render-worker/src/cutawayFinalPlan.mjs")).href);
fs.writeFileSync(`${OUT}/captions.ass`, buildAss({ words, cards }));
const { renderMix, loudness } = await import(pathToFileURL(path.join(wt, "render-worker/src/cutawayFinal.mjs")).href);
const lib = (k) => path.join(wt, "render-worker/assets/sfx", `lib-${k}.mp3`);
const sfx = [
  { url: lib("dirt"), start: T.dig + 0.05, duration: 1.2 },          // the dig
  { url: lib("water_rush"), start: T.ditch - 0.05, duration: 1.4 },  // the ditch floods
  { url: lib("dirt"), start: T.fill + 0.15, duration: 1.2 },         // gravel pours in
  { url: lib("drip"), start: T.seeps, duration: 1.3 },               // water seeps into the holes
  { url: lib("water_rush"), start: T.downhill, duration: 1.4 },      // carried away down the outlet
];
const chimes = [T.n600, T.n300, T.this, T.n1859, T.congrats];
// the rain bed: pink noise, band-limited, with a slow swell; fades in on "But", out from "Wrap"
const rainA = T.but1, rainB = T.mud + 0.6, rainLen = rainB - rainA;
execFileSync(ff, ["-v", "error", "-y", "-f", "lavfi", "-i", `anoisesrc=color=pink:r=44100:a=0.5:d=${(rainLen + 0.5).toFixed(2)}:seed=7`, "-f", "lavfi", "-i", `anoisesrc=color=white:r=44100:a=0.25:d=${(rainLen + 0.5).toFixed(2)}:seed=3`,
  "-filter_complex", `[0:a]highpass=f=300,lowpass=f=6500[p];[1:a]highpass=f=2500,lowpass=f=9000,volume=0.35[w];[p][w]amix=inputs=2:normalize=0,tremolo=f=0.35:d=0.15,afade=t=in:d=0.6,afade=t=out:st=${(rainLen - 1.6).toFixed(2)}:d=1.6,aformat=channel_layouts=stereo[o]`,
  "-map", "[o]", "-c:a", "libmp3lame", "-b:a", "160k", `${OUT}/rain.mp3`]);
const voiceLufs = await loudness(`${OUT}/voice.mp3`, OUT), rainLufs = await loudness(`${OUT}/rain.mp3`, OUT);
if (!Number.isFinite(voiceLufs) || !Number.isFinite(rainLufs)) throw new Error(`loudness not measured (voice ${voiceLufs}, rain ${rainLufs})`);
const RAIN_UNDER = 24; // dB under the voice (creator beds: 16-34, median 23)
const rainGain = +(voiceLufs - RAIN_UNDER - rainLufs).toFixed(1);
for (const [name, len, extra] of [["mix_end.mp3", T.lengthEnd, [T.signPop]], ["mix_noend.mp3", T.lengthNoEnd, []]]) {
  const r = await renderMix({ voice: { url: `${OUT}/voice.mp3`, tempo: 1 }, chimes: [...chimes, ...extra], sfx, lengthSec: len, levels: { sfxDb: -20, chimeDb: -20 } }, `${OUT}/mix-${name}`, name);
  execFileSync(ff, ["-v", "error", "-y", "-i", r.file, "-i", `${OUT}/rain.mp3`, "-filter_complex", `[1:a]volume=${rainGain}dB,adelay=${Math.round(rainA * 1000)}:all=1[r];[0:a][r]amix=inputs=2:normalize=0:duration=first[o]`, "-map", "[o]", "-c:a", "libmp3lame", "-b:a", "192k", `${OUT}/${name}`]);
  console.log(name, len, "s", JSON.stringify({ ...r.measured, rainLufs, rainGain }));
}
console.log(JSON.stringify(T));
