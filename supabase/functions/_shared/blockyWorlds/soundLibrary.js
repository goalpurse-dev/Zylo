// Blocky Worlds: the sound words the writer may use = the words we HAVE a sound for (owner, 2026-11-12). Pure.
// MIRROR of the engine's SOUND_SFX keys (scripts/blockyWorlds/engine/lib/audioPlan.js, which the engine agent keeps): the
// server cannot import the engine, so tests/blockyWorldsFormula.test.mjs keeps the two equal. TO ADD A SOUND: add its word
// to SOUND_ALLOWED (one line, below) and to the engine's SOUND_SFX. The animal and eating sounds (meow, woof, moo, quack,
// oink, ribbit, gulp, munch, slurp) are NOT here until the owner OKs their cost.
export const SOUND_ALLOWED = Object.freeze([
  "boom", "bang", "thud", "thump", "whack", "kaboom", "pow", "crash", "smash", "crack", "whoosh", "swoosh", "zoom", "splash",
  "pop", "knock", "slam", "creak", "rumble", "achoo", "choo", "clang", "bonk", "clunk", "tap", "splat", "snap", "click", "ding",
  "zap", "twang", "scratch", "plop", "drip",
  // being added to the engine now (2026-11-12)
  "beep", "buzz", "hiss", "fizz", "boing", "squeak", "poof",
]);

/** Close cousins of a sound we have -> that sound (used automatically; the target must be in SOUND_ALLOWED). */
export const SOUND_NEAR = Object.freeze({
  bam: "bang", thunk: "thud", whomp: "thud", thwack: "whack", clatter: "crash", kerplunk: "plop", kersplat: "splat",
  bing: "ding", ting: "ding", clack: "click", boop: "beep", ahchoo: "achoo", atchoo: "achoo",
  swish: "swoosh", whizz: "whoosh", whiz: "whoosh", fwoosh: "whoosh", screech: "squeak", sizzle: "fizz", bzz: "buzz", psst: "hiss",
});
export const isAllowedSound = (w) => SOUND_ALLOWED.includes(String(w).toLowerCase());
