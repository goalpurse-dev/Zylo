// Blocky Worlds free stand-in voice (AUDIO agent): Windows SAPI via voice/sapi.ps1 -> voice.wav + exact word timings.
// No API call, no transcription: word starts come from SAPI's SpeakProgress (AudioPosition + CharacterPosition).
// Each line is synthesized on its own, its leading/trailing silence trimmed and long inner pauses shortened, then the
// lines are joined with a short gap (the ElevenLabs pipeline later does the same "trim the silences" pacing).
//
//   import { freeVoice } from "./voice/free.mjs";
//   const { wav, words, duration, wpm, rate } = await freeVoice({ lines, out: "out/x/voice.wav", wordsOut: "out/x/words.json" });
//
// CLI: node voice/free.mjs <script.json|--example> <outDir> [--voice "Microsoft Zira Desktop"] [--wpm 250] [--rate N]
//   script.json: { "lines": ["...", ...] } or { "lines": [{ "text": "..." }, ...] } or ["...", ...]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { writeWav, pcm16ToFloat, frameRms } from "../lib/audioWav.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SAPI_PS1 = path.join(HERE, "sapi.ps1");
const SR = 44100;
const FRAME = 0.005;          // analysis frame (s)
const VOICED = 0.012;         // RMS above this = speech (about -38 dBFS)

/** Split a line into the script's own tokens (punctuation kept) with char offsets. */
export function tokenize(text) {
  const out = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(text))) out.push({ word: m[0], start: m.index, end: m.index + m[0].length });
  return out;
}

function runSapi({ lines, voice, rate, dir }) {
  const linesFile = path.join(dir, "lines.txt");
  fs.writeFileSync(linesFile, lines.map((l) => String(l).replace(/\s+/g, " ").trim()).join("\r\n"), "utf8");
  const r = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", SAPI_PS1,
    "-LinesFile", linesFile, "-OutDir", dir, "-Voice", voice, "-Rate", String(rate), "-SampleRate", String(SR)],
  { encoding: "utf8", maxBuffer: 1 << 24 });
  if (r.status !== 0) throw new Error(`SAPI failed (${r.status}): ${r.stderr || r.stdout}`);
  const ev = JSON.parse(fs.readFileSync(path.join(dir, "events.json"), "utf8"));
  return ev.lines.map((l, i) => ({
    samples: pcm16ToFloat(fs.readFileSync(path.join(dir, `line_${String(i).padStart(3, "0")}.pcm`))),
    // SAPI reports AudioPosition as if the stream were 16 kHz 16-bit (measured: it scales exactly with SR/16000)
    events: l.events.map(([ms, pos, len]) => ({ t: (ms / 1000) * (16000 / ev.sampleRate), pos, len })),
  }));
}

/** Keep-ranges (in samples) of one line: trimmed ends, inner silences longer than maxPause shortened to maxPause. */
function keepRanges(samples, maxPause) {
  const rms = frameRms(samples, SR, FRAME);
  const f = Math.round(SR * FRAME);
  const voiced = Array.from(rms, (v) => v > VOICED);
  const first = voiced.indexOf(true);
  const last = voiced.lastIndexOf(true);
  if (first < 0) return [[0, 0]];
  const a0 = Math.max(0, (first - 4) * f);                   // 20 ms of air before the first sound
  const b0 = Math.min(samples.length, (last + 9) * f);       // 45 ms tail after the last sound
  const ranges = [];
  let cur = a0;
  const maxFrames = Math.round(maxPause / FRAME);
  for (let k = first; k <= last; ) {
    if (voiced[k]) { k++; continue; }
    let j = k;
    while (j <= last && !voiced[j]) j++;
    if (j - k > maxFrames) {
      const half = Math.floor(maxFrames / 2);
      ranges.push([cur, (k + half) * f]);
      cur = (j - half) * f;
    }
    k = j;
  }
  ranges.push([cur, b0]);
  return ranges;
}

/** Map an original sample index of a line into the trimmed line (samples). */
function mapIndex(ranges, idx) {
  let acc = 0;
  for (const [a, b] of ranges) {
    if (idx < a) return acc;                 // inside a removed gap (or before the start): snap to the cut
    if (idx < b) return acc + (idx - a);
    acc += b - a;
  }
  return acc;
}

function assemble(lineAudio, lines, { gapSec, leadSec, tailSec, maxPause }) {
  const pieces = [];
  const words = [];
  let cursor = Math.round(leadSec * SR);
  const lineSpans = [];
  for (let i = 0; i < lineAudio.length; i++) {
    const { samples, events } = lineAudio[i];
    const ranges = keepRanges(samples, maxPause);
    const len = ranges.reduce((s, [a, b]) => s + (b - a), 0);
    pieces.push({ at: cursor, samples, ranges });
    const toks = tokenize(lines[i]);
    // first SAPI event inside each token = that token's start
    const starts = toks.map((tk) => {
      const ev = events.find((e) => e.pos >= tk.start && e.pos < tk.end) ?? events.find((e) => e.pos + e.len > tk.start && e.pos < tk.end);
      return ev ? (cursor + mapIndex(ranges, Math.round(ev.t * SR))) / SR : null;
    });
    const lineStart = cursor / SR + 0.02, lineEnd = (cursor + len) / SR - 0.045;
    // tokens SAPI did not report (rare): spread by character count between known neighbours
    for (let k = 0; k < toks.length; k++) {
      if (starts[k] != null) continue;
      let p = k - 1; while (p >= 0 && starts[p] == null) p--;
      let n = k + 1; while (n < toks.length && starts[n] == null) n++;
      const t0 = p >= 0 ? starts[p] : lineStart, t1 = n < toks.length ? starts[n] : lineEnd;
      const c0 = p >= 0 ? toks[p].start : 0, c1 = n < toks.length ? toks[n].start : lines[i].length;
      starts[k] = t0 + ((toks[k].start - c0) / Math.max(1, c1 - c0)) * (t1 - t0);
    }
    for (let k = 1; k < starts.length; k++) starts[k] = Math.max(starts[k], starts[k - 1] + 0.02);
    toks.forEach((tk, k) => words.push({ word: tk.word, start: starts[k], end: k + 1 < toks.length ? starts[k + 1] : lineEnd, line: i, lastInLine: k === toks.length - 1 }));
    lineSpans.push([cursor / SR, (cursor + len) / SR]);
    cursor += len + Math.round(gapSec * SR);
  }
  const total = cursor - Math.round(gapSec * SR) + Math.round(tailSec * SR);
  const out = new Float32Array(total);
  for (const { at, samples, ranges } of pieces) {
    let o = at;
    for (const [a, b] of ranges) { out.set(samples.subarray(a, b), o); o += b - a; }
  }
  // word ends: back off from the next word's start over silence, so `end` is where the sound stops
  const rms = frameRms(out, SR, FRAME);
  for (const w of words) {
    let k = Math.floor(w.end / FRAME) - 1;
    const kMin = Math.ceil((w.start + 0.06) / FRAME);
    while (k > kMin && rms[k] <= VOICED) k--;
    w.end = Math.min(w.end, (k + 1) * FRAME + 0.01);
  }
  return { samples: out, words, lineSpans };
}

const r3 = (x) => Math.round(x * 1000) / 1000;

/**
 * Synthesize lines with SAPI. Picks the SAPI rate (-10..10) closest to targetWpm unless `rate` is given.
 * Returns { wav, words: [{ word, start, end }], duration, wpm, rate, voice }.
 */
export async function freeVoice({ lines, out = "voice.wav", wordsOut = "words.json", voice = "Microsoft David Desktop",
  targetWpm = 250, rate = null, gapSec = 0.12, leadSec = 0.1, tailSec = 0.25, maxPause = 0.16, log = () => {} } = {}) {
  const texts = lines.map((l) => (typeof l === "string" ? l : l.text)).filter((l) => l && l.trim());
  const nWords = texts.reduce((s, l) => s + tokenize(l).length, 0);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bw-sapi-"));
  const tried = new Map();
  const attempt = (r) => {
    if (!tried.has(r)) {
      const audio = runSapi({ lines: texts, voice, rate: r, dir: tmp });
      const res = assemble(audio, texts, { gapSec, leadSec, tailSec, maxPause });
      const duration = res.samples.length / SR;
      tried.set(r, { ...res, duration, wpm: (nWords / duration) * 60, rate: r });
      log(`rate ${r}: ${duration.toFixed(1)} s, ${((nWords / duration) * 60).toFixed(0)} wpm`);
    }
    return tried.get(r);
  };
  let best;
  try {
    if (rate != null) best = attempt(rate);
    else {
      let r = 3;
      for (let i = 0; i < 5; i++) {
        const res = attempt(r);
        if (!best || Math.abs(res.wpm - targetWpm) < Math.abs(best.wpm - targetWpm)) best = res;
        const next = res.wpm < targetWpm ? r + 1 : r - 1;
        if (Math.abs(res.wpm - targetWpm) < 6 || next < -10 || next > 10 || tried.has(next)) break;
        r = next;
      }
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  writeWav(out, [best.samples], SR);
  const words = best.words.map((w) => ({ word: w.word, start: r3(w.start), end: r3(w.end) }));
  if (wordsOut) {
    fs.mkdirSync(path.dirname(path.resolve(wordsOut)), { recursive: true });
    fs.writeFileSync(wordsOut, JSON.stringify(words, null, 0).replace(/},{/g, "},\n{"));
  }
  return { wav: out, words, duration: r3(best.duration), wpm: Math.round(best.wpm * 10) / 10, rate: best.rate, voice,
    lineSpans: best.lineSpans.map(([a, b]) => [r3(a), r3(b)]) };
}

export async function loadExampleLines() {
  const url = pathToFileURL(path.resolve(HERE, "../../../../supabase/functions/_shared/blockyWorlds/examples.js")).href;
  const { EXAMPLE_SCRIPT } = await import(url);
  return EXAMPLE_SCRIPT.lines.map((l) => l.text);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (name) => { const i = args.indexOf(name); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
  const voice = opt("--voice") ?? "Microsoft David Desktop";
  const wpm = Number(opt("--wpm") ?? 250);
  const rateArg = opt("--rate");
  const [src, outDir = "out/dev/audio"] = args;
  if (!src) { console.error("usage: node voice/free.mjs <script.json|--example> <outDir> [--voice V] [--wpm N] [--rate N]"); process.exit(1); }
  let lines;
  if (src === "--example") lines = await loadExampleLines();
  else {
    const j = JSON.parse(fs.readFileSync(src, "utf8"));
    lines = (Array.isArray(j) ? j : j.lines).map((l) => (typeof l === "string" ? l : Array.isArray(l) ? l[1] : l.text));
  }
  const t0 = Date.now();
  const res = await freeVoice({ lines, voice, targetWpm: wpm, rate: rateArg == null ? null : Number(rateArg),
    out: path.join(outDir, "voice.wav"), wordsOut: path.join(outDir, "words.json"), log: (m) => console.log(m) });
  console.log(JSON.stringify({ wav: path.resolve(res.wav), words: res.words.length, duration: res.duration, wpm: res.wpm,
    rate: res.rate, voice: res.voice, seconds: (Date.now() - t0) / 1000 }));
}
