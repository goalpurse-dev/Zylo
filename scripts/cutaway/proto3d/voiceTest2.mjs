// Voice tests for the full landfill script (pre-approved: up to $0.30 of ElevenLabs in total).
// (a) Eric, lower stability + higher style; (b) Alex (upbeat narrator), one take; (c) Alex, one sentence per call.
// Then the creator's measured rhythm, by silence only (never sped up): 0.25 s between sentences, 0.35 s at a new
// section, commas and in-sentence gaps capped. Cost = character-cost header x $0.0002 (as logged before).
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
const [wt, ff, OUT] = process.argv.slice(2);
for (const line of fs.readFileSync("C:/Users/Public/Zylo/.env.local", "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const { alignmentWords } = await import(pathToFileURL(path.join(wt, "supabase/functions/_shared/cutaway/voice.js")).href);
fs.mkdirSync(OUT, { recursive: true });
const SCRIPT = "If you dig a pit and throw your trash in, you have a landfill. But dirty trash juice leaks straight down into the groundwater you drink. So you lay a thick clay base, but it is still not enough. You add a thick black plastic sheet. This is a landfill liner. A pipe drains the collected juice into a tank beside the pit. Sealed this tight, trash barely rots at all once it is buried. A 1952 newspaper dug up decades later was still readable word for word. But trapped trash still makes gas, so a pipe carries it out. That flame is not waste burning, it is gas making electricity nearby. Add a grass cap, a fence, and a few young trees. Congratulations, you have built a landfill.";
const SENTENCES = SCRIPT.match(/[^.!?]+[.!?]/g).map((s) => s.trim());
const SECTION = /^(But|So|This|Add|Congratulations|That)\b/;
const CAP = 0.30, PER = 0.0002;
let spent = 0;
const ledger = [];
async function tts(voiceId, text, settings, tag) {
  if (spent + text.length * PER * 1.05 > CAP) throw new Error(`budget: would pass $${CAP} (spent $${spent.toFixed(3)})`);
  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`, {
      method: "POST", headers: { "xi-api-key": process.env.ELEVENLABS_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ text, model_id: "eleven_multilingual_v2", voice_settings: settings }),
    });
    const chars = Number(res.headers.get("character-cost")) || text.length;
    if (!res.ok) { const msg = (await res.text()).slice(0, 200); ledger.push({ tag, attempt, ok: false, msg }); if (attempt === 2) throw new Error(msg); continue; }
    spent += chars * PER; ledger.push({ tag, attempt, ok: true, chars, usd: +(chars * PER).toFixed(4) });
    const body = await res.json();
    return { audio: Buffer.from(body.audio_base64, "base64"), words: alignmentWords(body.alignment ?? body.normalized_alignment) };
  }
}
// rebuild an audio file from speech pieces with the target gaps (pure silence edits)
function assemble(pieces, out) {
  // pieces: [{ file, s, e, gapAfter }] ; s/e in that file's time
  const inputs = [...new Set(pieces.map((p) => p.file))];
  const filt = pieces.map((p, i) => `[${inputs.indexOf(p.file)}:a]atrim=start=${p.s.toFixed(3)}:end=${p.e.toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:d=0.006,afade=t=out:st=${Math.max(0, p.e - p.s - 0.008).toFixed(3)}:d=0.008,apad=pad_dur=${p.gapAfter.toFixed(3)}[p${i}]`);
  const fc = `${filt.join(";")};${pieces.map((_, i) => `[p${i}]`).join("")}concat=n=${pieces.length}:v=0:a=1[o]`;
  execFileSync(ff, ["-v", "error", "-y", ...inputs.flatMap((f) => ["-i", f]), "-filter_complex", fc, "-map", "[o]", "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "192k", out]);
}
const gapFor = (w, next) => { if (!next) return 0.6; if (/[.!?]$/.test(w.w)) return SECTION.test(next.w) ? 0.35 : 0.25; if (/,$/.test(w.w)) return 0.08; return null; };
// one take: cut it into speech chunks at sentence ends, commas and any gap over 120 ms; each chunk keeps 30 ms
// of air on both sides, and the silence between chunks is set so the gap between the two words equals the target
function retimeOneTake(file, words, out) {
  const pieces = [], newWords = [];
  let a = Math.max(0, words[0].s - 0.03), T = 0; // a: chunk start in the source; T: chunk start in the output
  for (let i = 0; i < words.length; i++) {
    const w = words[i], nx = words[i + 1], target = gapFor(w, nx), real = nx ? nx.s - w.e : 0;
    newWords.push({ w: w.w, s: +(T + w.s - a).toFixed(3), e: +(T + w.e - a).toFixed(3) });
    if (!nx || target !== null || real > 0.12) {
      const b = w.e + 0.03, g = !nx ? 0.6 : target ?? 0.1, gapAfter = nx ? Math.max(0, g - 0.06) : 0.6;
      pieces.push({ file, s: a, e: b, gapAfter });
      T += b - a + gapAfter;
      if (nx) a = Math.max(w.e, nx.s - 0.03);
    }
  }
  assemble(pieces, out); return newWords;
}
const results = {};
const save = (tag, words, file) => { const n = words.length, dur = words.at(-1).e; results[tag] = { file: path.basename(file), words: n, seconds: +dur.toFixed(2), wpm: Math.round((n / dur) * 60) }; fs.writeFileSync(file.replace(/\.mp3$/, ".words.json"), JSON.stringify(words)); console.log(tag, JSON.stringify(results[tag]), `spent so far $${spent.toFixed(3)}`); };

// (a) Eric, livelier settings, one take
{ const r = await tts("cjVigY5qzO86Huf0OWal", SCRIPT, { stability: 0.3, similarity_boost: 0.75, style: 0.45, use_speaker_boost: true, speed: 1.1 }, "a");
  fs.writeFileSync(`${OUT}/raw_a.mp3`, r.audio); save("a", retimeOneTake(`${OUT}/raw_a.mp3`, r.words, `${OUT}/voice_a.mp3`), `${OUT}/voice_a.mp3`); }
// (b) Alex, upbeat narrator, one take
const ALEX = "yl2ZDV1MzN4HbQJbMihG", ALEX_SET = { stability: 0.35, similarity_boost: 0.75, style: 0.35, use_speaker_boost: true, speed: 1.1 };
{ const r = await tts(ALEX, SCRIPT, ALEX_SET, "b");
  fs.writeFileSync(`${OUT}/raw_b.mp3`, r.audio); save("b", retimeOneTake(`${OUT}/raw_b.mp3`, r.words, `${OUT}/voice_b.mp3`), `${OUT}/voice_b.mp3`); }
// (c) Alex, each sentence on its own, joined with the measured gaps
{ const pieces = [], newWords = []; let t = 0;
  for (let i = 0; i < SENTENCES.length; i++) {
    const r = await tts(ALEX, SENTENCES[i], ALEX_SET, `c${i + 1}`);
    const f = `${OUT}/raw_c${i + 1}.mp3`; fs.writeFileSync(f, r.audio);
    const ws = r.words, s0 = Math.max(0, ws[0].s - 0.03), e0 = ws.at(-1).e + 0.03;
    const next = SENTENCES[i + 1]; const g = !next ? 0.6 : SECTION.test(next) ? 0.35 : 0.25;
    for (const w of ws) newWords.push({ w: w.w, s: +(t + w.s - s0).toFixed(3), e: +(t + w.e - s0).toFixed(3) });
    pieces.push({ file: f, s: s0, e: e0, gapAfter: Math.max(0, g - 0.06) }); t += e0 - s0 + Math.max(0, g - 0.06);
  }
  assemble(pieces, `${OUT}/voice_c.mp3`); save("c", newWords, `${OUT}/voice_c.mp3`); }
fs.writeFileSync(`${OUT}/voice_tests.json`, JSON.stringify({ script: SCRIPT, results, ledger, spentUsd: +spent.toFixed(4) }, null, 2));
console.log("total spent $" + spent.toFixed(4));
