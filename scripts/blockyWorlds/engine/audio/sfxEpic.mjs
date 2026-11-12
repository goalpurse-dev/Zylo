// Blocky Worlds EPIC SFX catalog (EPIC agent): the sounds giants, armies and action beats need, on top of audio/sfx.mjs.
// Built free by `node audio/sfxEpicBuild.mjs` into audio/sfx/<name>.wav (synthesized + Kenney CC0 layers), same file
// format and level rules as the base set (mono 44.1 kHz, active RMS -18 dB, peak <= -1 dBFS).
// `paid`: a better ElevenLabs Sound Effects take would cost about 200 credits = ~$0.04 each on the owner's plan
// (NOT generated: needs the owner's go; audio/elevenSfx.mjs can make it, and the builder then prefers the take).
// lib/epic.js EPIC_SFX_TIMING mirrors dur / anchor / gainDb (dev/epic.test.mjs keeps them equal).
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "sfx");
const OURS = { source: "synthesized in audio/sfxEpicBuild.mjs (our own code)", license: "ours (no third-party material)" };
const MIX = (what) => ({ source: `synth + Kenney Impact Sounds (${what})`, license: "ours + CC0 (Kenney)" });

export const SFX_EPIC = {
  giant_stomp: { dur: 1.9, anchor: 0.0, gainDb: -2, quality: "good", ...MIX("impactMining"), what: "one giant footfall: sub boom, ground crunch, debris" },
  giant_steps: { dur: 2.4, anchor: 0, gainDb: -5, quality: "good", loop: true, ...OURS, what: "two slow heavy footfalls, loops (a walking giant)" },
  giant_thud: { dur: 2.2, anchor: 0.0, gainDb: -2, quality: "good", ...MIX("impactPlank heavy"), what: "a giant falling over: long low thud + rumble tail" },
  impact_big: { dur: 2.0, anchor: 0.0, gainDb: -2, quality: "good", ...MIX("impactPunch heavy + impactMetal"), what: "a big hit (attack lands): boom + crack + rumble" },
  roar_big: { dur: 2.6, anchor: 0.2, gainDb: -4, quality: "synthetic", paid: 0.04, ...OURS, what: "a giant beast's roar (formant growl, pitched low); an ElevenLabs take would be clearly better" },
  army_march: { dur: 2.0, anchor: 0, gainDb: -8, quality: "ok", loop: true, ...MIX("footstep_concrete, 40 layered marchers in step + armour clinks"), what: "an army marching in step, loops" },
  army_charge: { dur: 2.8, anchor: 0.15, gainDb: -6, quality: "synthetic", paid: 0.04, ...OURS, what: "a battle cry 'HAAA!' of many voices + running; an ElevenLabs take would be clearly better" },
  crowd_panic: { dur: 2.4, anchor: 0.1, gainDb: -9, quality: "synthetic", paid: 0.04, ...OURS, what: "townsfolk shouting and running (kid-safe, no screams of pain)" },
  shield_clash: { dur: 0.9, anchor: 0.0, gainDb: -6, quality: "good", ...MIX("impactMetal heavy + plate"), what: "shields and spears clashing" },
  rumble: { dur: 3.0, anchor: 0, gainDb: -9, quality: "good", loop: true, ...OURS, what: "a low ground rumble, loops (the world shaking)" },
  splash_big: { dur: 2.2, anchor: 0.05, gainDb: -4, quality: "ok", ...OURS, what: "a huge splash (a giant into the sea)" },
  whale_call: { dur: 2.8, anchor: 0.3, gainDb: -7, quality: "ok", paid: 0.04, ...OURS, what: "a whale song moan" },
};
export const SFX_EPIC_NAMES = Object.keys(SFX_EPIC);
export const sfxEpicPath = (name) => { if (!SFX_EPIC[name]) throw new Error(`sfxEpic: unknown sound "${name}"`); return path.join(DIR, `${name}.wav`); };
/** the ElevenLabs takes that would improve the set, with their cost (nothing is generated) */
export const PAID_TAKES = Object.entries(SFX_EPIC).filter(([, s]) => s.paid).map(([name, s]) => ({ name, usd: s.paid, what: s.what }));
