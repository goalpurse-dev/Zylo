// THE CHUNKED VOICE (owner 2026-11-21, after two live In This Town runs failed VOICE_CUT: eleven_v3 stopped early on a
// 1,227-character take twice in a row, the last words squeezed silent into the end). The narration is made in chunks
// of whole lines (~400 characters, a new chunk preferably where the story part changes); each chunk's end is checked
// (its last words have a real length, sit inside the audio and the last word sounds); a cut chunk is made again ALONE,
// first on the same model, then on eleven_multilingual_v2. The chunks are joined with a short natural gap into ONE
// take (voice.mp3 + take.json, the same files a one-piece take writes), so the normal timing (pace.mjs, tighten.mjs)
// runs unchanged. NEVER FATAL over a cut: when every try of a chunk is cut, the least-cut try is used and logged.
// Only a voice that cannot be made at all (every call of a chunk errors: the provider is down) throws VOICE_FAILED.
//   chunkLines(lines) -> [[line index, ...], ...]
//   chunkEndProblem({ file, words, duration }) -> null | "why"
//   chunkedVoice({ lines, outDir, apiKey, narrator, check, book, log }) -> { chunks, costUsd, retakes, fallbacks, cut }
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { synthesize } from "../../../supabase/functions/_shared/blockyWorlds/voice.js";
import { wordsEndProblem, levelDb, END } from "./voiceEnd.mjs";

export const CHUNK = Object.freeze({
  maxChars: 400,          // ~400 characters a chunk (whole lines; one longer line stays alone)
  partBreakMin: 200,      // a story-part change starts a new chunk once the current one has this many characters
  gapSec: 0.25,           // the pause between chunks (the pace step then trims it like any sentence end)
  headSec: 0.03,          // kept before a chunk's first word
  tailSec: 0.15,          // kept after a chunk's last word
  fallbackModel: "eleven_multilingual_v2",
  primaryTries: 2,        // the narrator's model (eleven_v3): the first take + one retake of that chunk alone
  fallbackTries: 2,       // then the fallback model
});
const FF = process.env.FFMPEG ?? "ffmpeg";
const probe = (f) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString()) || 0;
const textOf = (l) => String(l?.text ?? l ?? "").trim();

/** the lines -> chunks of line indexes (whole lines, in order, ~maxChars each; empty lines skipped) */
export function chunkLines(lines = [], C = CHUNK) {
  const out = [];
  let cur = [], chars = 0, part = null;
  lines.forEach((l, i) => {
    const t = textOf(l); if (!t) return;
    const p = l?.part ?? null;
    const partBreak = cur.length && p !== part && chars >= C.partBreakMin;
    if (cur.length && (chars + 1 + t.length > C.maxChars || partBreak)) { out.push(cur); cur = []; chars = 0; }
    cur.push(i); chars += (chars ? 1 : 0) + t.length; part = p;
  });
  if (cur.length) out.push(cur);
  return out;
}

/** how many words of a raw take are cut (no length, or past / at the end of the audio): 0 = a clean take */
export function cutCount(words, duration, E = END) {
  return words.filter((w) => Number(w.e) - Number(w.s) < E.minWordSec || Number(w.s) >= duration - E.endMarginSec || Number(w.e) > duration + 0.05).length;
}

/** a raw chunk take (alignment words { w, s, e } + its mp3) -> null (fine) | why it is cut */
export function chunkEndProblem({ file, words, duration, E = END, level = levelDb }) {
  const w = (words ?? []).map((x) => ({ word: x.w, start: Number(x.s), end: Number(x.e) }));
  const byWords = wordsEndProblem(w, duration, E);
  if (byWords) return byWords;
  const last = w.at(-1);
  if (duration && last.end > duration + 0.05) return `the last word ends after the audio (${last.end.toFixed(2)} of ${duration.toFixed(2)} s)`;
  if (file) {
    const db = level(file, last.start, last.end);
    if (!(db >= E.minDb)) return `the last word ("${last.word}") is silent (${Number.isFinite(db) ? db.toFixed(0) : "-inf"} dB)`;
  }
  return null;
}

/**
 * Make the narration in chunks and join it into outDir/voice.mp3 + outDir/take.json (the one-take format: text, spoken
 * [{ w, s, e }], costUsd ...). check(usd) runs before every paid call (the caps), book(usd) after it (the ledger).
 * synth / endProblem / join are injectable for the free tests.
 */
export async function chunkedVoice({ lines, outDir, apiKey, narrator, C = CHUNK, check = () => {}, book = () => {}, log = () => {},
  synth = synthesize, endProblem = chunkEndProblem, join = joinChunks, duration = probe }) {
  if (!apiKey) throw new Error("ELEVENLABS_KEY missing");
  const cdir = path.join(outDir, "chunks");
  fs.mkdirSync(cdir, { recursive: true });
  const groups = chunkLines(lines, C);
  if (!groups.length) throw Object.assign(new Error("VOICE_FAILED: the script has no lines to read"), { code: "VOICE_FAILED" });
  const fallback = { ...narrator, model: C.fallbackModel };
  const plan = [...Array(C.primaryTries).fill(narrator), ...(narrator.model === C.fallbackModel ? [] : Array(C.fallbackTries).fill(fallback))];
  const chunks = [];
  let costUsd = 0;
  for (let k = 0; k < groups.length; k++) {
    const text = groups[k].map((i) => textOf(lines[i])).join("\n");
    const tries = [];
    let best = null;
    for (let a = 0; a < plan.length; a++) {
      const n = plan[a];
      const file = path.join(cdir, `c${String(k).padStart(2, "0")}_t${a}.mp3`);
      check(+(text.length * 0.5 * 0.0002).toFixed(4)); // worst case: 0.5 ElevenLabs credits a character
      let r;
      try { r = await synth({ apiKey, text, narrator: n }); }
      catch (e) { tries.push({ model: n.model, error: String(e?.message ?? e).slice(0, 200) }); log(`voice chunk ${k + 1}/${groups.length}: ${n.model} call failed (${String(e?.message ?? e).slice(0, 120)})`); continue; }
      const usd = r.costUsd ?? +(text.length * 0.44 * 0.0002).toFixed(5);
      costUsd += usd; book(usd);
      fs.writeFileSync(file, Buffer.from(r.audioBase64, "base64"));
      const dur = duration(file);
      const problem = endProblem({ file, words: r.spoken, duration: dur });
      const cut = problem ? Math.max(1, cutCount(r.spoken, dur)) : 0;
      tries.push({ model: n.model, problem, cut });
      if (!best || cut < best.cut) best = { file, spoken: r.spoken, duration: dur, model: n.model, cut, problem };
      if (!problem) break;
      log(`voice chunk ${k + 1}/${groups.length} came out cut on ${n.model} (${problem}): ${a + 1 < plan.length ? `making it again alone on ${plan[a + 1].model}` : "using the least-cut take"}`);
    }
    if (!best) throw Object.assign(new Error(`VOICE_FAILED: chunk ${k + 1} of ${groups.length} could not be made (${tries.map((t) => t.error).filter(Boolean).at(-1) ?? "no take"})`), { code: "VOICE_FAILED" });
    chunks.push({ lines: groups[k], chars: text.length, ...best, tries });
  }
  const joined = join({ chunks, outDir, C });
  const text = lines.map(textOf).filter(Boolean).join("\n");
  const take = { text, spoken: joined.spoken, costUsd: +costUsd.toFixed(5), billedChars: Math.round(costUsd / 0.0002), chars: text.length, voice: narrator.voiceName, voiceId: narrator.voiceId,
    model: narrator.model, chunked: chunks.map((c) => ({ lines: c.lines, chars: c.chars, model: c.model, cut: c.cut, tries: c.tries.length })), at: new Date().toISOString() };
  fs.writeFileSync(path.join(outDir, "take.json"), JSON.stringify(take, null, 1));
  return {
    chunks: chunks.map((c) => ({ lines: c.lines, chars: c.chars, model: c.model, cut: c.cut, problem: c.problem ?? null, tries: c.tries })),
    costUsd: take.costUsd,
    retakes: chunks.reduce((n, c) => n + c.tries.length - 1, 0),
    fallbacks: chunks.filter((c) => c.model !== narrator.model).length,
    cut: chunks.filter((c) => c.cut > 0).length,
  };
}

/** the chunks -> outDir/voice.mp3 (each chunk trimmed to its words + a natural gap between) + the shifted word timings */
export function joinChunks({ chunks, outDir, C = CHUNK }) {
  const spoken = [];
  const parts = [];
  let at = 0;
  chunks.forEach((c, i) => {
    const w = c.spoken;
    const a = Math.max(0, Number(w[0].s) - C.headSec);
    const b = Math.max(a + 0.05, Math.min(c.duration, Number(w.at(-1).e) + C.tailSec));
    for (const x of w) spoken.push({ w: x.w, s: +(Number(x.s) - a + at).toFixed(3), e: +(Math.min(Number(x.e), b) - a + at).toFixed(3) });
    const gap = i + 1 < chunks.length ? C.gapSec : 0;
    parts.push(`[${i}:a]atrim=${a.toFixed(3)}:${b.toFixed(3)},asetpts=PTS-STARTPTS,aresample=44100,aformat=channel_layouts=mono,afade=t=in:d=0.006,afade=t=out:st=${Math.max(0, b - a - 0.006).toFixed(3)}:d=0.006${gap ? `,apad=pad_dur=${gap}` : ""}[p${i}]`);
    at += b - a + gap;
  });
  const graph = `${parts.join(";")};${chunks.map((_, i) => `[p${i}]`).join("")}concat=n=${chunks.length}:v=0:a=1[out]`;
  const gf = path.join(outDir, "join.graph");
  fs.writeFileSync(gf, graph);
  const mp3 = path.join(outDir, "voice.mp3");
  execFileSync(FF, ["-v", "error", "-y", ...chunks.flatMap((c) => ["-i", c.file]), "-/filter_complex", gf, "-map", "[out]", "-ac", "1", "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "192k", mp3]);
  return { mp3, spoken, duration: +at.toFixed(3) };
}
