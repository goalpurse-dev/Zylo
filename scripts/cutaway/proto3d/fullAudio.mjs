// Full M1 landfill audio ($0, local): Eric's final take, word times for every animation cue, one-word captions with
// the two number cards, and two -20 dB mixes (effects + chimes under the measured voice): with the end card
// (1.8 s more, silent but for the chime when the sign pops) and without it.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const [wt, ff, OUT] = process.argv.slice(2);
process.env.FFMPEG = ff;
const V = "C:/Users/Public/Zylo/research/seamless-niche/m1/voice_tests";
const words = JSON.parse(fs.readFileSync(`${V}/voice_final_eric.words.json`, "utf8"));
fs.mkdirSync(OUT, { recursive: true });
fs.copyFileSync(`${V}/voice_final_eric.mp3`, `${OUT}/voice.mp3`);
// the n-th word matching re (1-based), start time
const at = (re, n = 1) => { let k = 0; for (const w of words) if (re.test(w.w) && ++k === n) return w.s; throw new Error(`no word ${re} #${n}`); };
const T = {
  dig: at(/^dig$/), throw: at(/^throw$/), landfill: at(/^landfill\.$/), but1: at(/^But$/), leaks: at(/^leaks$/), groundwater: at(/^groundwater$/), drink: at(/^drink\.$/),
  so: at(/^So$/), lay: at(/^lay$/), clay: at(/^clay$/), base: at(/^base,$/), not: at(/^not$/), enough: at(/^enough\.$/),
  add: at(/^add$/), plastic: at(/^plastic$/), sheet: at(/^sheet\.$/), this: at(/^This$/), liner: at(/^liner\.$/),
  pipe: at(/^pipe$/), drains: at(/^drains$/), tank: at(/^tank$/), sealed: at(/^Sealed$/), rots: at(/^rots$/), buried: at(/^buried\.$/),
  newspaper: at(/^newspaper$/), decades: at(/^decades$/), readable: at(/^readable$/), but2: at(/^But$/, 2), gas: at(/^gas,$/), pipe2: at(/^pipe$/, 2), carries: at(/^carries$/),
  flame: at(/^flame$/), electricity: at(/^electricity$/), add2: at(/^Add$/), cap: at(/^cap,$/), fence: at(/^fence,$/), trees: at(/^trees\.$/),
  congrats: at(/^Congratulations,$/), built: at(/^built$/), lastWord: words.at(-1).s, voiceEnd: words.at(-1).e,
};
const HOLD = 1.5, ENDCARD = 1.8;
T.signPop = +(T.voiceEnd + HOLD - 0.1).toFixed(3);
T.lengthNoEnd = +(T.voiceEnd + HOLD).toFixed(3);
T.lengthEnd = +(T.voiceEnd + HOLD + ENDCARD).toFixed(3);
fs.writeFileSync(`${OUT}/times.json`, JSON.stringify({ lengthSec: T.lengthEnd, ...T }, null, 1));
const cards = [{ text: "37 YEARS", s: T.readable, e: T.readable + 1.8 }, { text: "480 LANDFILLS", s: T.electricity, e: T.electricity + 1.8 }];
const { buildAss } = await import(pathToFileURL(path.join(wt, "render-worker/src/cutawayFinalPlan.mjs")).href);
fs.writeFileSync(`${OUT}/captions.ass`, buildAss({ words, cards }));
const { renderMix } = await import(pathToFileURL(path.join(wt, "render-worker/src/cutawayFinal.mjs")).href);
const lib = (k) => path.join(wt, "render-worker/assets/sfx", `lib-${k}.mp3`);
const sfx = [
  { url: lib("dirt"), start: T.throw + 0.25, duration: 1.2 },
  { url: lib("drip"), start: T.leaks, duration: 1.3 },
  { url: lib("water_rush"), start: T.drains, duration: 1.4 },
  { url: lib("flame"), start: T.flame, duration: 1.3 },
];
const chimes = [T.this, T.readable, T.electricity, T.congrats];
for (const [name, len, extra] of [["mix_end.mp3", T.lengthEnd, [T.signPop]], ["mix_noend.mp3", T.lengthNoEnd, []]]) {
  const r = await renderMix({ voice: { url: `${OUT}/voice.mp3`, tempo: 1 }, chimes: [...chimes, ...extra], sfx, lengthSec: len, levels: { sfxDb: -20, chimeDb: -20 } }, `${OUT}/mix-${name}`, name);
  fs.copyFileSync(r.file, `${OUT}/${name}`);
  console.log(name, len, "s", JSON.stringify(r.measured));
}
console.log(JSON.stringify(T));
