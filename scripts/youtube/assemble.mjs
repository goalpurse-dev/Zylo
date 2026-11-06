// Zyvo YouTube tutorials: the assembly. Drop the screen recordings in <episode>/recordings/, run this, get a 1080p 16:9
// video: each line's voice, the recordings inset on our background and zoomed where the script says, the keyword / STEP /
// proof cards, the finished video full screen with its own sound, captions, the end screen. Writes out/<slug>.mp4 and
// out/timeline.json (the chapters for the description).
//   node assemble.mjs <episode dir> [--voice own|sapi|eleven] [--spend-ok <usd>]
// Voice: a file recordings/voice/<line id>.(wav|m4a|mp3) is always used first (your own voice). The rest:
//   sapi    Windows' built-in voice: free, a preview only (the file is named _PREVIEW)
//   eleven  ElevenLabs through the Budget Guard: paid, refused unless --spend-ok covers the estimate (ask the owner first)
// A missing recording becomes a labeled placeholder card, so the whole cut can be checked before anything is recorded.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { load, beats as allBeats, check } from "./ytScript.mjs";
import { filmCards, cardKey } from "./cards.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const W = 1920, H = 1080, FPS = 30, IW = 1664, IH = 936, IX = (W - IW) / 2, IY = (H - IH) / 2;
const NARRATOR = { id: "bIHbv24MWmeRgasZH58o", name: "Will - Relaxed Optimist", stability: 0.45, style: 0.3, speed: 1.0 };
const PER_CHAR = 0.0002;   // ElevenLabs, as the Studio's voice lines are costed
const run = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8", maxBuffer: 1e9, stdio: ["ignore", "pipe", "pipe"] });
const dur = (f) => Number(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).trim());
const win = (p) => p.replace(/\\/g, "/");

const args = process.argv.slice(2), dir = path.resolve(args[0]);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const engine = opt("--voice", "sapi"), spendOk = Number(opt("--spend-ok", "0"));
const S = load(dir), B = allBeats(S), REC = path.join(dir, "recordings"), WORK = path.join(dir, "work"), OUT = path.join(dir, "out");
for (const d of ["voice", "seg", "cards"]) fs.mkdirSync(path.join(WORK, d), { recursive: true });
fs.mkdirSync(OUT, { recursive: true });
const problems = check(S);
if (problems.length) { console.error(problems.join("\n")); process.exit(1); }

/* ── 1. the voice of every line ──────────────────────────────────────── */
const own = (id) => ["wav", "m4a", "mp3"].map((e) => path.join(REC, "voice", `${id}.${e}`)).find((f) => fs.existsSync(f));
const said = B.filter((b) => b.say);
const paid = engine === "eleven" ? said.filter((b) => !own(b.id) && !fs.existsSync(path.join(WORK, "voice", `${b.id}.eleven.wav`))) : [];
if (paid.length) {
  const est = paid.reduce((a, b) => a + b.say.length, 0) * PER_CHAR;
  if (est > spendOk) { console.error(`ElevenLabs would cost about $${est.toFixed(2)} for ${paid.length} lines: run again with --spend-ok ${Math.ceil(est * 100) / 100} once the owner has said yes`); process.exit(2); }
}
let guard = null;
if (paid.length) {
  const { admin } = await import("file:///C:/Users/Public/Zylo/scripts/blocky/lib.mjs");
  const { createBudgetGuard } = await import("../../supabase/functions/_shared/contentMachine/budgetGuard.js");
  const { createStore } = await import("../../supabase/functions/_shared/contentMachine/store.js");
  guard = createBudgetGuard({ store: createStore(admin()) });
  for (const line of fs.readFileSync("C:/Users/Public/Zylo/.env.local", "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
}
async function voiceOf(b) {
  const mine = own(b.id), out = path.join(WORK, "voice", `${b.id}.${mine ? "own" : engine}.wav`);
  if (fs.existsSync(out)) return out;
  if (mine) { run("ffmpeg", ["-v", "error", "-y", "-i", mine, "-af", "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,loudnorm=I=-16:TP=-1.5", "-ar", "48000", "-ac", "2", out]); return out; }
  if (engine === "sapi") {
    const tmp = out.replace(/\.wav$/, ".raw.wav"), text = b.say.replace(/'/g, "''").replace(/…/g, "...");
    run("powershell", ["-NoProfile", "-Command", `Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Rate = 1; $s.SetOutputToWaveFile('${tmp}'); $s.Speak('${text}'); $s.Dispose()`]);
    run("ffmpeg", ["-v", "error", "-y", "-i", tmp, "-ar", "48000", "-ac", "2", out]); fs.rmSync(tmp); return out;
  }
  if (engine === "eleven") {
    const mp3 = out.replace(/\.wav$/, ".mp3");
    await guard.spend("other", "youtube.voice_lines", b.say.length * PER_CHAR, async () => {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${NARRATOR.id}?output_format=mp3_44100_128`, { method: "POST", headers: { "xi-api-key": process.env.ELEVENLABS_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ text: b.say, model_id: "eleven_multilingual_v2", voice_settings: { stability: NARRATOR.stability, similarity_boost: 0.75, style: NARRATOR.style, use_speaker_boost: true, speed: NARRATOR.speed } }) });
      if (!res.ok) throw new Error(`${b.id}: ${res.status} ${(await res.text()).slice(0, 200)}`);
      const chars = Number(res.headers.get("character-cost")) || b.say.length;
      fs.writeFileSync(mp3, Buffer.from(await res.arrayBuffer()));
      return { result: chars, actualUsd: chars * PER_CHAR };
    }, { lane: "studio", live: true });
    run("ffmpeg", ["-v", "error", "-y", "-i", mp3, "-ar", "48000", "-ac", "2", out]); return out;
  }
  throw new Error(`voice: own, sapi or eleven (line ${b.id} has no recording)`);
}
const voice = {};
for (const b of said) { voice[b.id] = await voiceOf(b); process.stdout.write("."); }
console.log(`\n${said.length} voice lines (${engine}${Object.keys(voice).some((k) => voice[k].includes(".own.")) ? " + your own" : ""})`);

/* ── 2. lengths and cards ───────────────────────────────────────────── */
const MIN = { card: 1.6, step: 2.2, proof: 3.2, end: 12, rec: 1.5 };
const kindOf = (b) => ["rec", "card", "step", "proof", "result", "end"].find((k) => b.show?.[k] != null);
const missing = (b) => (kindOf(b) === "rec" || kindOf(b) === "result") && !fs.existsSync(path.join(REC, b.show.rec ?? b.show.result));
for (const b of B) {
  const k = kindOf(b), v = voice[b.id] ? dur(voice[b.id]) : 0;
  b.kind = k; b.voiceSecs = v;
  b.secs = k === "result" ? (missing(b) ? Math.max(4, b.show.to - b.show.from) : b.show.to - b.show.from) : Math.max(MIN[k] ?? 1.5, v + 0.3);
}
const cardSpec = (b) => b.kind === "card" ? { kind: "keyword", ...b.show.card } : b.kind === "step" ? { kind: "step", ...b.show.step } : b.kind === "proof" ? { kind: "proof", ...b.show.proof, image: b.show.proof.image && path.resolve(dir, b.show.proof.image) } : b.kind === "end" ? { kind: "end", ...b.show.end }
  : missing(b) ? { kind: "keyword", icon: "film", light: `to record: ${b.show.rec ?? b.show.result}`, bold: "your screen here" } : null;
const jobs = [{ spec: { kind: "bg" }, secs: 0, out: path.join(WORK, "cards", "bg.png") }];
for (const b of B) { const spec = cardSpec(b); if (spec) { b.card = path.join(WORK, "cards", `${cardKey(spec, b.secs)}.mp4`); jobs.push({ spec, secs: b.secs, out: b.card }); } }
await filmCards(jobs, () => process.stdout.write("c"));
console.log(`\n${jobs.length - 1} cards`);

/* ── 3. one segment per line ────────────────────────────────────────── */
const ENC = ["-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-r", String(FPS), "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2"];
const audioIn = (b) => (voice[b.id] ? ["-i", voice[b.id]] : ["-f", "lavfi", "-t", String(b.secs), "-i", "anullsrc=r=48000:cl=stereo"]);
const vo = (n) => `[${n}:a]apad,atrim=0:{D},asetpts=PTS-STARTPTS[a]`;
let t = 0;
B.forEach((b, i) => {
  const out = path.join(WORK, "seg", `${String(i).padStart(3, "0")}_${b.id}.mp4`), D = b.secs.toFixed(3);
  b.start = t; b.end = t + b.secs; t = b.end; b.seg = out;
  if (b.card) {
    run("ffmpeg", ["-v", "error", "-y", "-i", b.card, ...audioIn(b), "-filter_complex", `[0:v]tpad=stop_mode=clone:stop_duration=${D},trim=0:${D},setpts=PTS-STARTPTS[v];${vo(1).replace("{D}", D)}`, "-map", "[v]", "-map", "[a]", ...ENC, "-t", D, out]);
  } else if (b.kind === "rec") {
    const src = path.join(REC, b.show.rec), from = b.show.from ?? 0, to = Math.min(b.show.to ?? dur(src), dur(src)), z = b.show.zoom;
    // the recording, fitted into the inset; a zoom eases in to the named part of the screen and holds
    const fit = `scale=${IW}:${IH}:force_original_aspect_ratio=decrease,pad=${IW}:${IH}:(ow-iw)/2:(oh-ih)/2:color=0x0A0B0E,setsar=1,fps=${FPS}`;
    let zoom = "";
    if (z) {
      const Z = Math.min(1 / z[2], 1 / z[3], 3).toFixed(4), cx = (z[0] + z[2] / 2).toFixed(4), cy = (z[1] + z[3] / 2).toFixed(4), P = `clip((on/${FPS}-0.35)/0.7,0,1)`, E = `(${P})*(${P})*(3-2*(${P}))`;
      zoom = `,zoompan=z='1+(${Z}-1)*${E}':x='max(0,min(iw-iw/zoom,iw*${cx}-iw/zoom/2))':y='max(0,min(ih-ih/zoom,ih*${cy}-ih/zoom/2))':d=1:s=${IW}x${IH}:fps=${FPS}`;
    }
    run("ffmpeg", ["-v", "error", "-y", "-loop", "1", "-i", path.join(WORK, "cards", "bg.png"), "-ss", String(from), "-t", String(to - from), "-i", src, ...audioIn(b), "-filter_complex",
      `[1:v]${fit}${zoom},tpad=stop_mode=clone:stop_duration=${D},trim=0:${D},setpts=PTS-STARTPTS[r];[0:v]scale=${W}:${H},trim=0:${D},setpts=PTS-STARTPTS,drawbox=x=${IX - 4}:y=${IY - 4}:w=${IW + 8}:h=${IH + 8}:color=0xBEF264@0.55:t=4[bg];[bg][r]overlay=${IX}:${IY}[v];${vo(2).replace("{D}", D)}`,
      "-map", "[v]", "-map", "[a]", ...ENC, "-t", D, out]);
  } else if (b.kind === "result") {
    const src = path.join(REC, b.show.result);
    run("ffmpeg", ["-v", "error", "-y", "-ss", String(b.show.from), "-t", D, "-i", src, "-filter_complex",
      `[0:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=0x0A0B0E,setsar=1,fps=${FPS},tpad=stop_mode=clone:stop_duration=${D},trim=0:${D},setpts=PTS-STARTPTS[v];[0:a]aresample=48000,apad,atrim=0:${D}[a]`, "-map", "[v]", "-map", "[a]", ...ENC, "-t", D, out]);
  }
  process.stdout.write("s");
});
console.log(`\n${B.length} segments, ${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, "0")}`);

/* ── 4. joined, then captions (whisper on our own voice, never on cards or the finished video) ── */
const list = path.join(WORK, "segments.txt");
fs.writeFileSync(list, B.map((b) => `file '${win(b.seg)}'`).join("\n"));
const body = path.join(WORK, "body.mp4");
run("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", body]);
const wordsFile = path.join(WORK, "words.json");
run("python", [path.join(HERE, "..", "studio", "transcribe.py"), body, wordsFile]);
const words = JSON.parse(fs.readFileSync(wordsFile, "utf8")).segments.flatMap((s) => s.words);
const captioned = (w) => B.some((b) => b.kind === "rec" && w.s >= b.start && w.s < b.end);
const chunks = [];
for (const w of words.filter(captioned)) {
  const last = chunks.at(-1);
  if (last && last.words.length < 4 && w.s - last.e < 0.35 && !/[.?!,:]$/.test(last.words.at(-1))) { last.words.push(w.w); last.e = w.e; }
  else chunks.push({ s: w.s, e: w.e, words: [w.w] });
}
const ts = (s) => `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${(s % 60).toFixed(2).padStart(5, "0")}`;
const ass = ["[Script Info]", "ScriptType: v4.00+", `PlayResX: ${W}`, `PlayResY: ${H}`, "", "[V4+ Styles]",
  "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
  "Style: Cap,Segoe UI Black,60,&H00FFFFFF,&H00FFFFFF,&H000B0A0A,&H80000000,0,0,0,0,100,100,0,0,1,5,0,2,80,80,46,1", "", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ...chunks.map((c, i) => `Dialogue: 0,${ts(c.s)},${ts(Math.min(c.e + 0.15, chunks[i + 1]?.s ?? c.e + 0.15))},Cap,,0,0,0,,${c.words.join(" ").replace(/[{}]/g, "")}`)].join("\n");
fs.writeFileSync(path.join(WORK, "captions.ass"), ass);
const final = path.join(OUT, `${S.slug}${engine === "sapi" && said.some((b) => !own(b.id)) ? "_PREVIEW" : ""}${B.some(missing) ? "_PLACEHOLDERS" : ""}.mp4`);
// the subtitles filter wants a relative path on Windows (no drive colon)
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", body, "-vf", "ass=captions.ass", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "copy", final], { cwd: WORK, stdio: ["ignore", "inherit", "inherit"] });
fs.writeFileSync(path.join(OUT, "timeline.json"), JSON.stringify({ total: t, file: final, beats: B.map(({ id, chapter, kind, start, end, secs }) => ({ id, chapter, kind, start: +start.toFixed(2), end: +end.toFixed(2), secs: +secs.toFixed(2) })), missing: B.filter(missing).map((b) => b.show.rec ?? b.show.result) }, null, 1));
console.log(`done: ${final}`);
