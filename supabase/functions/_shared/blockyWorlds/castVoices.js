// IN THIS TOWN CHARACTER VOICES (owner 2026-11-22, round 3). The narrator stays the owner's "roblox-story" voice; every
// QUOTED line spoken by a named character gets that character's own voice, picked ONCE per character from the types
// below (the plan's cast.voice_type) and saved with the cast, so the character keeps it in later videos. The voice IDs
// are ElevenLabs voices this account can call: its own and premade ones, and public library voices used by ID (the
// API key may not add voices to the account; calling a library voice by ID works). Pure (no I/O): the store is passed in.
import { ROBLOX_STORY } from "./config.js";

/** every voice is made at the API's top speed (1.2) and sped up to PACE afterwards (pitch kept, atempo PACE / 1.2);
 * round 5 (owner 2026-11-22): 1.3x by default */
export const PACE = 1.2;   // round 9d (owner 2026-11-23): 1.2x is the In This Town default (it was 1.3)
const S = (stability, style) => Object.freeze({ stability, similarity_boost: 0.8, style, use_speaker_boost: true, speed: 1.2 });
const V = (voiceId, voiceName, settings, about) => Object.freeze({ provider: "elevenlabs", voiceId, voiceName, model: "eleven_multilingual_v2", settings, outputFormat: "mp3_44100_128", pace: PACE, about });

export const VOICE_TYPES = Object.freeze({
  narrator: ROBLOX_STORY,
  kid_boy: V("fBD19tfE58bkETeiwUoC", "Little Dude II", S(0.4, 0.35), "a young cartoon boy"),
  kid_girl: V("Nggzl2QAXh3OijoXD116", "Candy - Young and Sweet", S(0.4, 0.35), "a young sweet girl (public library)"),
  mom: V("EXAVITQu4vr4xnSDxMaL", "Sarah", S(0.45, 0.3), "a warm, firm mom"),
  dad: V("iP95p4xoKVk53GoZ742B", "Chris", S(0.45, 0.3), "a down-to-earth dad"),
  grandma: V("vFLqXa8bgbofGarf6fZh", "Grandma Oxley", S(0.45, 0.3), "an old cartoon grandma (public library)"),
  whisper: V("kIGjGXPDMVeeNzyvQ4hG", "Tony Smyles - The Art of the Whisper", S(0.35, 0.2), "a creepy whisper (public library)"),
  monster: V("TsHrPyMlNFuIYnbODF01", "Alien Master - Ominous, Dark and Scary", S(0.35, 0.4), "a deep, scary monster"),
});
/** one short line per voice for the owner's approval (cheap: ~30 characters each) */
export const SAMPLE_LINES = Object.freeze({
  kid_boy: "Wait for me! I'm coming too!", kid_girl: "Mom, can I play outside?", mom: "Get inside. Right now.",
  dad: "Lock the door, kids.", grandma: "Never go out after dark, sweetie.", whisper: "Your mom lied.", monster: "I can see you.",
});

const lc = (t) => String(t ?? "").trim().toLowerCase();
const isNarrator = (name) => !lc(name) || ["narrator", "me", "i"].includes(lc(name));
/** a cast member's type when the plan gave none: from the name / kid flag */
export function guessType(c) {
  const n = lc(c?.name);
  if (isNarrator(n)) return "narrator";
  if (/^(mom|mum|mother|mama)$/.test(n)) return "mom";
  if (/^(dad|father|papa)$/.test(n)) return "dad";
  if (/^(grandma|granny|nana)$/.test(n)) return "grandma";
  if (/monster|creature|beast/.test(n)) return "monster";
  const girls = ["lily", "mia", "zoe", "emma", "ava", "ella", "ruby", "lucy", "nora", "sofia", "anna", "mila"];
  if (c?.kid === false) return c?.face === "girl" ? "mom" : "dad";
  return girls.includes(n) || c?.face === "girl" ? "kid_girl" : "kid_boy";
}

/**
 * the cast's voices: a saved choice (the store: { [name]: { type, voiceId } }) wins, else the plan's voice_type, else a
 * guess. Same character = same voice. -> { voices: { [name]: { type, voiceId, voiceName } }, store: the updated store }
 */
export function pickVoices(cast = [], store = {}) {
  const voices = {}, next = { ...store };
  for (const c of cast) {
    const name = String(c?.name ?? "").trim();
    if (!name || isNarrator(name)) continue;
    const saved = store[name] ?? store[Object.keys(store).find((k) => lc(k) === lc(name))];
    const type = saved?.type && VOICE_TYPES[saved.type] ? saved.type : (VOICE_TYPES[c.voice_type] && c.voice_type !== "narrator" ? c.voice_type : guessType(c));
    const v = VOICE_TYPES[type];
    voices[name] = { type, voiceId: saved?.voiceId ?? v.voiceId, voiceName: v.voiceName };
    next[name] = { type, voiceId: voices[name].voiceId, savedAt: saved?.savedAt ?? new Date().toISOString().slice(0, 10) };
  }
  return { voices, store: next };
}

const OPEN = /^["“]/, CLOSE = /["”][.,!?;:…]*$/;
/**
 * the script in voice parts, in order: the narrator's words and every quoted part by its speaker (line.speaker, or
 * line.quotes for an exchange inside one line; a speaker line with no quotes is all theirs). Consecutive parts of the same
 * voice join. -> [{ who: "narrator" | name, text, w0, n }] (w0 = the first word's index in the whole script)
 */
export function voiceParts(script) {
  const parts = [];
  let w = 0;
  const push = (who, toks, at) => {
    if (!toks.length) return;
    const last = parts.at(-1);
    if (last && last.who === who && last.w0 + last.n === at) { last.text += ` ${toks.join(" ")}`; last.n += toks.length; return; }
    parts.push({ who, text: toks.join(" "), w0: at, n: toks.length });
  };
  for (const l of script?.lines ?? []) {
    const toks = String(l.text).trim().split(/\s+/).filter(Boolean);
    const sp = isNarrator(l.speaker) ? null : String(l.speaker).trim();
    const quoted = toks.some((t) => /["“”]/.test(t));
    if (!sp) { push("narrator", toks, w); w += toks.length; continue; }
    if (!quoted) { push(sp, toks, w); w += toks.length; continue; }
    const qs = Array.isArray(l.quotes) ? l.quotes : [];
    let inQ = false, q = -1, run = [], runWho = "narrator", runAt = w;
    toks.forEach((t, k) => {
      const opens = OPEN.test(t) && !inQ, closes = CLOSE.test(t) && (inQ || opens);
      if (opens) q++;
      const who = inQ || opens ? (qs[q] && !isNarrator(qs[q]) ? qs[q] : sp) : "narrator";
      if (who !== runWho && run.length) { push(runWho, run, runAt); run = []; }
      if (!run.length) { runWho = who; runAt = w + k; }
      run.push(t);
      if (opens) inQ = true;
      if (closes) inQ = false;
    });
    push(runWho, run, runAt);
    w += toks.length;
  }
  return parts;
}
/** the spoken text without the quote marks (what the voice reads) */
export const spokenText = (t) => String(t).replace(/["“”]/g, "").replace(/\s+/g, " ").trim();
