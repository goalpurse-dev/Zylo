// Blocky Worlds SFX catalog (SOUND agent). Pure data + a path helper: which short sound files exist in audio/sfx/,
// where each came from and under which license. The files are built by `node audio/sfxBuild.mjs`.
// `gainDb`: a default trim on top of the files' common level (active RMS -18 dB), so a cue at gainDb 0 sits right.
// `quality`: "good" = fine for the final video; "ok" = usable, simple; "synthetic" = a code-made stand-in, an
// ElevenLabs Sound Effects take would be clearly better (about 200 credits = $0.04 each on the owner's plan).
// `anchor`: where the sound's "moment" is, in seconds from the file start (a riser's anchor is its END: it is placed
// so the anchor lands on the cue time).
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "sfx");
const KENNEY = (pack) => ({ source: `Kenney "${pack}" (kenney.nl), downloaded to assets/sfx-src/`, license: "CC0 1.0 (License.txt in the pack)" });
const OURS = { source: "synthesized in audio/sfxBuild.mjs (our own code)", license: "ours (no third-party material)" };

export const SFX = {
  whoosh_1: { dur: 0.65, anchor: 0.4, gainDb: -2, quality: "good", ...OURS, what: "airy whoosh, medium" },
  whoosh_2: { dur: 0.94, anchor: 0.47, gainDb: -2, quality: "good", ...OURS, what: "slow dark whoosh" },
  whoosh_3: { dur: 0.41, anchor: 0.29, gainDb: -3, quality: "good", ...OURS, what: "quick bright swish" },
  riser_short: { dur: 1.2, anchor: 1.2, gainDb: -12, quality: "good", ...OURS, what: "1.1 s noise + tone riser that stops dead (lands on the reveal)" },
  riser_long: { dur: 2.0, anchor: 2.0, gainDb: -12, quality: "good", ...OURS, what: "2 s riser" },
  impact: { dur: 1.6, anchor: 0, gainDb: -2, quality: "good", ...OURS, ...{ source: "synth sub boom + Kenney Impact Sounds impactPunch_heavy_000", license: "ours + CC0 (Kenney)" }, what: "low boom hit" },
  stinger: { dur: 2.85, anchor: 0, gainDb: -3, quality: "good", ...OURS, what: "boom + dissonant metal bells (horror reveal sting)" },
  thunder: { dur: 4.58, anchor: 0, gainDb: -4, quality: "ok", ...OURS, what: "crack + rolling rumble" },
  scream: { dur: 1.48, anchor: 0.05, gainDb: -8, quality: "good", source: "ElevenLabs Sound Effects (audio/elevenSfx.mjs; take in assets/sfx-src/eleven/)", license: "commercial use on the owner's paid ElevenLabs plan", what: "a kid's short cartoon scream" },
  sneeze: { dur: 1.47, anchor: 0.07, gainDb: -6, quality: "good", source: "ElevenLabs Sound Effects (audio/elevenSfx.mjs; take in assets/sfx-src/eleven/)", license: "commercial use on the owner's paid ElevenLabs plan", what: "one big comedic sneeze; anchor = the CHOO" },
  growl: { dur: 2.24, anchor: 0.15, gainDb: -6, quality: "good", source: "ElevenLabs Sound Effects (audio/elevenSfx.mjs; take in assets/sfx-src/eleven/)", license: "commercial use on the owner's paid ElevenLabs plan", what: "deep eerie creature growl" },
  crowd_murmur: { dur: 3.6, anchor: 0, gainDb: -10, quality: "good", loop: true, source: "ElevenLabs Sound Effects (audio/elevenSfx.mjs; take in assets/sfx-src/eleven/)", license: "commercial use on the owner's paid ElevenLabs plan", what: "quiet crowd murmur, loops" },
  crowd_cheer: { dur: 2.44, anchor: 0.2, gainDb: -7, quality: "good", source: "ElevenLabs Sound Effects (audio/elevenSfx.mjs; take in assets/sfx-src/eleven/)", license: "commercial use on the owner's paid ElevenLabs plan", what: "a small-town crowd cheering" },
  pop: { dur: 0.12, anchor: 0, gainDb: -8, quality: "good", ...OURS, what: "bubble pop" },
  whistle: { dur: 1.4, anchor: 0, gainDb: -6, quality: "ok", ...OURS, what: "pea/referee whistle, 'tweet-tweeeet'" },
  knock: { dur: 0.53, anchor: 0, gainDb: -4, quality: "good", ...KENNEY("Impact Sounds"), what: "three knocks on wood" },
  crash: { dur: 0.6, anchor: 0, gainDb: -5, quality: "good", ...KENNEY("Impact Sounds"), source: "Kenney Impact Sounds glass + plate + synth boom", what: "glass/metal crash" },
  door_creak: { dur: 1.51, anchor: 0, gainDb: -5, quality: "good", ...KENNEY("RPG Audio"), what: "creaky door opening (doorOpen_2)" },
  door_slam: { dur: 0.6, anchor: 0, gainDb: -4, quality: "good", ...KENNEY("RPG Audio"), source: "Kenney RPG Audio doorClose_4 + synth thump", what: "door slam" },
  footsteps_walk: { dur: 2.0, anchor: 0, gainDb: -7, quality: "good", loop: true, ...KENNEY("Impact Sounds"), what: "walking on concrete, 2 steps/s, loops" },
  footsteps_run: { dur: 1.2, anchor: 0, gainDb: -6, quality: "good", loop: true, ...KENNEY("RPG Audio"), what: "running, 3.3 steps/s, loops" },
  // the writer's SOUND WORDS (2026-11-12): Kenney CC0 files (lib/audioPlan.js SOUND_SFX)
  bonk: { dur: 0.33, anchor: 0, gainDb: -6, quality: "ok", ...KENNEY("Impact Sounds"), source: "Kenney Impact Sounds impactWood_light_003 pitched down (CC0, picked by name for the sound word)", what: "a hollow bonk" },
  clunk: { dur: 0.31, anchor: 0, gainDb: -6, quality: "ok", ...KENNEY("Impact Sounds"), source: "Kenney Impact Sounds impactWood_heavy_001 (CC0, picked by name for the sound word)", what: "a heavy wooden clunk" },
  tap: { dur: 0.14, anchor: 0, gainDb: -6, quality: "ok", ...KENNEY("Impact Sounds"), source: "Kenney Impact Sounds impactGeneric_light_000 (CC0, picked by name for the sound word)", what: "a light tap" },
  splat: { dur: 0.51, anchor: 0, gainDb: -6, quality: "ok", ...KENNEY("Sci-fi Sounds + Impact Sounds"), source: "Kenney Sci-fi Sounds + Impact Sounds slime_000 + impactSoft_heavy_000 (CC0, picked by name for the sound word)", what: "a wet splat" },
  snap: { dur: 0.19, anchor: 0, gainDb: -6, quality: "ok", ...KENNEY("Impact Sounds"), source: "Kenney Impact Sounds impactWood_light_004 pitched up (CC0, picked by name for the sound word)", what: "a quick snap" },
  click: { dur: 0.04, anchor: 0, gainDb: -6, quality: "ok", ...KENNEY("Interface Sounds"), source: "Kenney Interface Sounds click_001 (CC0, picked by name for the sound word)", what: "a click" },
  ding: { dur: 0.12, anchor: 0, gainDb: -6, quality: "ok", ...KENNEY("Interface Sounds"), source: "Kenney Interface Sounds glass_002 (CC0, picked by name for the sound word)", what: "a glassy ding" },
  zap: { dur: 0.23, anchor: 0, gainDb: -6, quality: "ok", ...KENNEY("Sci-fi Sounds"), source: "Kenney Sci-fi Sounds laserRetro_000 (CC0, picked by name for the sound word)", what: "a retro zap" },
  twang: { dur: 0.09, anchor: 0, gainDb: -6, quality: "ok", ...KENNEY("Interface Sounds"), source: "Kenney Interface Sounds pluck_001 (CC0, picked by name for the sound word)", what: "a plucked twang" },
  scratch: { dur: 0.12, anchor: 0, gainDb: -6, quality: "ok", ...KENNEY("Interface Sounds"), source: "Kenney Interface Sounds scratch_001 (CC0, picked by name for the sound word)", what: "a scratch" },
  plop: { dur: 0.11, anchor: 0, gainDb: -6, quality: "ok", ...KENNEY("Interface Sounds"), source: "Kenney Interface Sounds drop_001 (CC0, picked by name for the sound word)", what: "a plop" },
  drip: { dur: 0.13, anchor: 0, gainDb: -6, quality: "ok", ...KENNEY("Interface Sounds"), source: "Kenney Interface Sounds drop_002 pitched up (CC0, picked by name for the sound word)", what: "a drip" },
  // the home-made sound words (owner, 2026-11-12: our own code, audio/sfxBuild.mjs)
  beep: { dur: 0.18, anchor: 0, gainDb: -6, quality: "ok", ...OURS, what: "a 1 kHz beep" },
  buzz: { dur: 0.7, anchor: 0, gainDb: -6, quality: "ok", ...OURS, what: "a buzz (bee / buzzer), 125 Hz saw with flutter" },
  hiss: { dur: 0.6, anchor: 0, gainDb: -6, quality: "ok", ...OURS, what: "a high hiss (snake / tyre)" },
  fizz: { dur: 0.9, anchor: 0, gainDb: -6, quality: "ok", ...OURS, what: "a soda fizz with tiny bubble pops" },
  boing: { dur: 0.7, anchor: 0, gainDb: -6, quality: "ok", ...OURS, what: "a spring boing, wobbling pitch" },
  squeak: { dur: 0.21, anchor: 0, gainDb: -6, quality: "ok", ...OURS, what: "a rising-falling squeak (mouse / rubber toy)" },
  poof: { dur: 0.55, anchor: 0, gainDb: -6, quality: "ok", ...OURS, what: "a soft low puff of smoke" },
};
export const SFX_NAMES = Object.keys(SFX);
export const sfxPath = (name) => {
  if (!SFX[name]) throw new Error(`sfx: unknown sound "${name}"`);
  return path.join(DIR, `${name}.wav`);
};
