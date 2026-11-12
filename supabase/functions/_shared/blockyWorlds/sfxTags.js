// Blocky Worlds: SOUND-WORD TAGS (owner, 2026-11-12, the story formula). Pure, no imports (script.js reads it).
//
// THE FORMAT THE ENGINE READS: every script line may carry `sfx`, an array of lowercase sound words in the order they are
// spoken in that line's text, e.g. { text: "Boom! The door flew open.", sfx: ["boom"] }. Each tag is one word that stands
// in the text as its own short fragment; the engine finds the word in the voice's word timing and puts the effect on the
// word's start (a lookup by that name). A line without sound words has no `sfx` key. normalizeScript() fills the tags from
// the text for EVERY script (generated, edited or pasted), so the tags can never drift from the words: the writer never has
// to tag by hand, and the editor's text is the single source.
//
// What counts: a sound word inside a short fragment (a sentence of at most 3 words: "Boom!", "Knock. Knock.", "Poof! Gone.",
// "Crash, bang, thud!"). The same word inside a longer sentence is an ordinary word ("a knock at the door") and is not tagged.

/** The sound words the writer is told to use (and the checks count). Lowercase, singular, one word each. */
export const SOUND_WORDS = Object.freeze([
  "boom", "bang", "crash", "smash", "whoosh", "swoosh", "zoom", "splat", "splash", "thud", "thump", "bonk", "poof", "pop", "snap", "crack",
  "creak", "knock", "tap", "slam", "squeak", "scratch", "rumble", "hiss", "buzz", "beep", "ding", "click", "clunk", "clang", "twang", "plop",
  "drip", "gulp", "munch", "slurp", "ribbit", "meow", "woof", "moo", "quack", "oink", "achoo", "choo", "boing", "whack", "zap", "fizz", "pow", "kaboom",
]);
const SET = new Set(SOUND_WORDS);

/** A token as a sound word: lowercase letters, stretched letters squeezed ("creeeak" -> "creak"), a trailing "s" kept off. */
function soundOf(tok) {
  const w = String(tok).toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return null;
  // as spoken, then stretched letters squeezed ("booom" -> "boom", "creeeak" -> "creak")
  for (const c of [w, w.replace(/(.)\1{2,}/g, "$1$1"), w.replace(/(.)\1+/g, "$1")]) if (SET.has(c)) return c;
  return null;
}

/** The sound-word tags of one line of text (see the header): [] when none. */
export function sfxTags(text) {
  const out = [];
  for (const sentence of String(text ?? "").split(/(?<=[.!?])\s+/)) {
    const toks = sentence.split(/[\s,]+/).filter(Boolean);
    if (!toks.length || toks.length > 3) continue;
    for (const t of toks) { const s = soundOf(t); if (s) out.push(s); }
  }
  return out;
}
