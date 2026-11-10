// Zyvo YouTube tutorials: the assembly. A 1080p 16:9 video from the script, the voice, our own cards and the owner's
// recordings. Writes out/<slug>.mp4, out/timeline.json (the chapters) and out/slots.txt (every footage slot).
//   node assemble.mjs <episode dir> [--voice own|sapi|eleven] [--spend-ok <usd>]
//
// NO DEAD AIR (owner, 2026-11-07): every beat lasts exactly its voice line (its own silences trimmed) + 0.04 s, so lines
// follow each other with at most ~0.3 s between them; every card is cut to the line it belongs to; a whoosh on each
// change of picture, a pop on each keyword, a stamp when a step is done; captions on every voice line.
//
// Beats (show: one of):
//   slot  { id, show, sound?, secs? }  the split view: 75 % footage slot on the left, the live step panel on the right.
//         Beats in a row with the same slot id share ONE slot (the footage runs on across them). The owner drops
//         assets/slot_NN.mp4 (NN = the slot number in slots.txt) and the next run lays it in; until then a placeholder
//         says exactly what to record and how long. sound: the footage plays with its own sound (under the voice).
//   note  { icon, light, bold }        the split view with a keyword in the left area (while a step is explained)
//   card / step / proof / end           full-screen cards (cards.js);   rec / result   older inset / full-screen footage
// Voice: recordings/voice/<line id>.(wav|m4a|mp3) always wins (the owner's own voice). The rest: sapi (Windows' voice,
// free, a preview) or eleven (ElevenLabs through the Budget Guard: refused unless --spend-ok covers the printed estimate).
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { load, beats as allBeats, check } from "./ytScript.mjs";
import { filmCards, cardKey } from "./cards.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const W = 1920, H = 1080, FPS = 30, IW = 1664, IH = 936, IX = (W - IW) / 2, IY = (H - IH) / 2;
const LEFT = { x: 36, y: 36, w: 1404, h: 1008 };   // cards.js: the split view's footage area
const GAP = 0.04;
export const NARRATOR = { id: "bIHbv24MWmeRgasZH58o", name: "Will - Relaxed Optimist", stability: 0.45, style: 0.3, speed: 1.0 };
export const PER_CHAR = 0.0002;   // ElevenLabs, as the Studio's voice lines are costed
const run = (cmd, a, o = {}) => execFileSync(cmd, a, { encoding: "utf8", maxBuffer: 1e9, stdio: ["ignore", "pipe", "pipe"], ...o });
const dur = (f) => Number(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).trim());
const win = (p) => p.replace(/\\/g, "/");
const tc = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;

const args = process.argv.slice(2), dir = path.resolve(args[0]);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const engine = opt("--voice", "sapi"), spendOk = Number(opt("--spend-ok", "0"));
const S = load(dir), B = allBeats(S), REC = path.join(dir, "recordings"), ASSETS = path.join(dir, "assets"), WORK = path.join(dir, "work"), OUT = path.join(dir, "out");
for (const d of ["voice", "seg", "cards"]) fs.mkdirSync(path.join(WORK, d), { recursive: true });
fs.mkdirSync(OUT, { recursive: true });
const problems = check(S);
if (problems.length && !args.includes("--draft")) { console.error(problems.join("\n")); process.exit(1); }

/* ── 1. the voice of every line, its own silences trimmed ───────────── */
const own = (id) => ["wav", "m4a", "mp3"].map((e) => path.join(REC, "voice", `${id}.${e}`)).find((f) => fs.existsSync(f));
const said = B.filter((b) => b.say);
export const voiceCost = (lines) => lines.reduce((a, b) => a + b.say.length, 0) * PER_CHAR;
// the episode may name its own narrator (script.json voice: {id, name}); a line with an unfilled [blank] keeps the free voice
const VOICE = { ...NARRATOR, ...(S.voice ?? {}) }, blank = (b) => /\[[^\]]+\]/.test(b.say);
const engineFor = (b) => (engine === "eleven" && blank(b) ? "sapi" : engine), tagFor = (b) => (engineFor(b) === "eleven" ? `eleven-${VOICE.id.slice(0, 6)}` : engineFor(b));
// a voice file is kept per line AND per wording: a reworded line is voiced again, never played with its old audio
const said5 = (b) => crypto.createHash("sha1").update(b.say).digest("hex").slice(0, 8);
const paid = engine === "eleven" ? said.filter((b) => !own(b.id) && !blank(b) && !fs.existsSync(path.join(WORK, "voice", `${b.id}.${tagFor(b)}.${said5(b)}.wav`))) : [];
if (paid.length && voiceCost(paid) > spendOk) { console.error(`ElevenLabs would cost about $${voiceCost(paid).toFixed(2)} for ${paid.length} lines: run again with --spend-ok ${Math.ceil(voiceCost(paid) * 100) / 100} once the owner has said yes`); process.exit(2); }
let guard = null;
if (paid.length) {
  const { admin } = await import("file:///C:/Users/Public/Zylo/scripts/blocky/lib.mjs");
  const { createBudgetGuard } = await import("../../supabase/functions/_shared/contentMachine/budgetGuard.js");
  const { createStore } = await import("../../supabase/functions/_shared/contentMachine/store.js");
  guard = createBudgetGuard({ store: createStore(admin()) });
  for (const line of fs.readFileSync("C:/Users/Public/Zylo/.env.local", "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
}
// the line's own silences: none before it, none after it, and every pause inside it at most 0.18 s (no dead air)
const TRIM = "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02:stop_periods=-1:stop_duration=0.2:stop_threshold=-45dB:stop_silence=0.18,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse";
async function voiceOf(b) {
  const mine = own(b.id), eng = engineFor(b), out = path.join(WORK, "voice", `${b.id}.${mine ? "own" : `${tagFor(b)}.${said5(b)}`}.wav`);
  if (fs.existsSync(out)) return out;
  let src = mine;
  if (!mine && eng === "sapi") {
    src = out.replace(/\.wav$/, ".raw.wav"); const text = b.say.replace(/'/g, "''").replace(/…/g, "...");
    run("powershell", ["-NoProfile", "-Command", `Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Rate = 1; $s.SetOutputToWaveFile('${src}'); $s.Speak('${text}'); $s.Dispose()`]);
  } else if (!mine && eng === "eleven") {
    src = out.replace(/\.wav$/, ".mp3");
    await guard.spend("other", "youtube.voice_lines", b.say.length * PER_CHAR, async () => {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE.id}?output_format=mp3_44100_128`, { method: "POST", headers: { "xi-api-key": process.env.ELEVENLABS_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ text: b.say, model_id: "eleven_multilingual_v2", voice_settings: { stability: VOICE.stability, similarity_boost: 0.75, style: VOICE.style, use_speaker_boost: true, speed: VOICE.speed } }) });
      if (!res.ok) throw new Error(`${b.id}: ${res.status} ${(await res.text()).slice(0, 200)}`);
      const chars = Number(res.headers.get("character-cost")) || b.say.length;
      fs.writeFileSync(src, Buffer.from(await res.arrayBuffer()));
      return { result: chars, actualUsd: chars * PER_CHAR };
    }, { lane: "studio", live: true });
  } else if (!mine) throw new Error(`voice: own, sapi or eleven (line ${b.id} has no recording)`);
  run("ffmpeg", ["-v", "error", "-y", "-i", src, "-af", `${TRIM},loudnorm=I=-16:TP=-1.5`, "-ar", "48000", "-ac", "2", out]);
  return out;
}
const voice = {};
for (const b of said) { voice[b.id] = await voiceOf(b); process.stdout.write("."); }
console.log(`\n${said.length} voice lines (${engine})`);

/* ── 2. lengths, slots, the step panel ──────────────────────────────── */
const KINDS = ["slot", "note", "rec", "card", "step", "proof", "result", "end"];
const STEPS = S.steps ?? [];
const slotFile = (n) => ["mp4", "mov", "webm", "mkv"].map((e) => path.join(ASSETS, `slot_${String(n).padStart(2, "0")}.${e}`)).find((f) => fs.existsSync(f));
const missing = (b) => (b.kind === "rec" || b.kind === "result") && !fs.existsSync(path.join(REC, b.show.rec ?? b.show.result));
const slots = [];
for (const b of B) {
  b.kind = KINDS.find((k) => b.show?.[k] != null);
  b.voiceSecs = voice[b.id] ? dur(voice[b.id]) : 0;
  b.step = S.chapters.find((c) => c.id === b.chapter)?.step ?? null;
  if (b.kind === "slot") {
    const prev = slots.at(-1);
    if (prev && b.show.slot.id && prev.id === b.show.slot.id && prev.beats.at(-1) === B[B.indexOf(b) - 1]) { prev.beats.push(b); b.slotRef = prev; }
    else { const s = { n: slots.length + 1, id: b.show.slot.id, show: b.show.slot.show, sound: !!b.show.slot.sound, beats: [b] }; slots.push(s); b.slotRef = s; }
  }
}
for (const s of slots) s.file = slotFile(s.n);
for (const b of B) {
  const fixed = b.kind === "result" ? b.show.to - b.show.from : b.kind === "end" ? 12 : b.kind === "slot" && !b.voiceSecs ? b.show.slot.secs ?? 8 : 0;
  b.secs = b.voiceSecs ? b.voiceSecs + GAP : fixed || 1.2;   // a voiced beat is its line, nothing more (the end screen runs under the last lines)
}
let t = 0;
for (const b of B) { b.start = t; b.end = t + b.secs; t = b.end; }
for (const s of slots) { s.start = s.beats[0].start; s.secs = s.beats.at(-1).end - s.start; }
// the step panel: which step, how far along it (fills across its beats), and whether this beat starts it (the stamp)
const stepSpan = {};
for (const b of B) if (b.step) { const sp = (stepSpan[b.step] ??= { start: b.start, end: b.end }); sp.end = b.end; }
const panelFor = (b, i) => {
  const sp = stepSpan[b.step], f = (x) => (sp ? Math.max(0, Math.min(1, (x - sp.start) / (sp.end - sp.start))) : 0);
  return { steps: STEPS, current: b.step ?? 0, enter: !!b.step && B[i - 1]?.step !== b.step, fill0: f(b.start), fill1: f(b.end), title: (b.step ?? 0) > STEPS.length ? "ALL DONE" : S.panel_title ?? "IN THIS VIDEO", icon: (b.step ?? 0) > STEPS.length ? "check" : "play" };
};

/* ── 3. the cards ───────────────────────────────────────────────────── */
const cardSpec = (b, i) => {
  if (b.kind === "slot") { const s = b.slotRef; return { kind: "split", left: { type: "slot", n: s.n, secs: s.secs, show: s.show, sound: s.sound, filled: !!s.file }, panel: panelFor(b, i) }; }
  if (b.kind === "note") return { kind: "split", left: { type: "note", ...b.show.note }, panel: panelFor(b, i) };
  if (b.kind === "card") return { kind: "keyword", ...b.show.card };
  if (b.kind === "step") return { kind: "step", ...b.show.step };
  if (b.kind === "proof") return { kind: "proof", ...b.show.proof, image: b.show.proof.image && path.resolve(dir, b.show.proof.image) };
  if (b.kind === "end") { const first = B.find((x) => x.kind === "end"); return { kind: "end", ...b.show.end, t0: +(b.start - first.start).toFixed(3) }; }
  if (missing(b)) return { kind: "keyword", icon: "film", light: `to record: ${b.show.rec ?? b.show.result}`, bold: "your screen here" };
  return null;
};
const jobs = [{ spec: { kind: "bg" }, secs: 0, out: path.join(WORK, "cards", "bg.png") }];
B.forEach((b, i) => { const spec = cardSpec(b, i); if (spec) { b.card = path.join(WORK, "cards", `${cardKey(spec, +b.secs.toFixed(3))}.mp4`); jobs.push({ spec, secs: +b.secs.toFixed(3), out: b.card }); } });
await filmCards(jobs, () => process.stdout.write("c"));
console.log(`\n${jobs.length - 1} cards`);

/* ── 4. one segment per beat (picture + the footage's own sound; the voice goes on later as one track) ── */
const ENC = ["-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-r", String(FPS), "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2"];
const silent = (D) => ["-f", "lavfi", "-t", D, "-i", "anullsrc=r=48000:cl=stereo"];
const fitInto = (w, h) => `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=${FPS}`;
B.forEach((b, i) => {
  const out = path.join(WORK, "seg", `${String(i).padStart(3, "0")}_${b.id}.mp4`), D = b.secs.toFixed(3);
  b.seg = out;
  if (b.kind === "slot" && b.slotRef.file) {
    // the owner's footage in the slot, running on from where the slot's previous beat left it
    const s = b.slotRef, src = s.file, off = Math.max(0, b.start - s.start), len = dur(src), ss = Math.min(off, Math.max(0, len - 0.05));
    const hasAudio = run("ffprobe", ["-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", src]).trim() !== "";
    const a = s.sound && hasAudio ? `[1:a]aresample=48000,apad,atrim=0:${D},volume=${b.voiceSecs ? 0.35 : 1}[a]` : null;
    run("ffmpeg", ["-v", "error", "-y", "-i", b.card, "-ss", String(ss), "-i", src, ...(a ? [] : silent(D)), "-filter_complex",
      `[1:v]${fitInto(LEFT.w, LEFT.h)},tpad=stop_mode=clone:stop_duration=${D},trim=0:${D},setpts=PTS-STARTPTS[f];[0:v][f]overlay=${LEFT.x}:${LEFT.y}[v]${a ? `;${a}` : ""}`,
      "-map", "[v]", "-map", a ? "[a]" : "2:a", ...ENC, "-t", D, out]);
  } else if (b.card) {
    run("ffmpeg", ["-v", "error", "-y", "-i", b.card, ...silent(D), "-filter_complex", `[0:v]tpad=stop_mode=clone:stop_duration=${D},trim=0:${D},setpts=PTS-STARTPTS[v]`, "-map", "[v]", "-map", "1:a", ...ENC, "-t", D, out]);
  } else if (b.kind === "rec") {
    const src = path.join(REC, b.show.rec), from = b.show.from ?? 0, to = Math.min(b.show.to ?? dur(src), dur(src)), z = b.show.zoom;
    const fit = `scale=${IW}:${IH}:force_original_aspect_ratio=decrease,pad=${IW}:${IH}:(ow-iw)/2:(oh-ih)/2:color=0x0A0B0E,setsar=1,fps=${FPS}`;
    let zoom = "";
    if (z) {
      const Z = Math.min(1 / z[2], 1 / z[3], 3).toFixed(4), cx = (z[0] + z[2] / 2).toFixed(4), cy = (z[1] + z[3] / 2).toFixed(4), P = `clip((on/${FPS}-0.35)/0.7,0,1)`, E = `(${P})*(${P})*(3-2*(${P}))`;
      zoom = `,zoompan=z='1+(${Z}-1)*${E}':x='max(0,min(iw-iw/zoom,iw*${cx}-iw/zoom/2))':y='max(0,min(ih-ih/zoom,ih*${cy}-ih/zoom/2))':d=1:s=${IW}x${IH}:fps=${FPS}`;
    }
    run("ffmpeg", ["-v", "error", "-y", "-loop", "1", "-i", path.join(WORK, "cards", "bg.png"), "-ss", String(from), "-t", String(to - from), "-i", src, ...silent(D), "-filter_complex",
      `[1:v]${fit}${zoom},tpad=stop_mode=clone:stop_duration=${D},trim=0:${D},setpts=PTS-STARTPTS[r];[0:v]scale=${W}:${H},trim=0:${D},setpts=PTS-STARTPTS,drawbox=x=${IX - 4}:y=${IY - 4}:w=${IW + 8}:h=${IH + 8}:color=0xBEF264@0.55:t=4[bg];[bg][r]overlay=${IX}:${IY}[v]`,
      "-map", "[v]", "-map", "2:a", ...ENC, "-t", D, out]);
  } else if (b.kind === "result") {
    const src = path.join(REC, b.show.result);
    run("ffmpeg", ["-v", "error", "-y", "-ss", String(b.show.from), "-t", D, "-i", src, "-filter_complex",
      `[0:v]${fitInto(W, H)},tpad=stop_mode=clone:stop_duration=${D},trim=0:${D},setpts=PTS-STARTPTS[v];[0:a]aresample=48000,apad,atrim=0:${D}[a]`, "-map", "[v]", "-map", "[a]", ...ENC, "-t", D, out]);
  }
  process.stdout.write("s");
});
console.log(`\n${B.length} segments, ${tc(t)}`);

/* ── 5. joined; the voice track + sound effects; captions on the voice ── */
const list = path.join(WORK, "segments.txt");
fs.writeFileSync(list, B.map((b) => `file '${win(b.seg)}'`).join("\n"));
const body = path.join(WORK, "body.mp4");
run("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", body]);
const events = [];
B.forEach((b, i) => {
  const prev = B[i - 1], changed = !prev || prev.kind !== b.kind || (b.kind === "slot" ? prev.slotRef !== b.slotRef : true);
  if (changed && i) events.push({ at: Math.max(0, b.start - 0.08), kind: "whoosh" });
  if (["card", "note", "step", "proof"].includes(b.kind)) events.push({ at: b.start + 0.1, kind: "pop" });
  if (b.step && prev?.step !== b.step && b.step > 1) events.push({ at: b.start + 0.12, kind: "stamp" });
});
const plan = path.join(WORK, "mix.json"), voWav = path.join(WORK, "voice_track.wav"), fxWav = path.join(WORK, "sfx_track.wav");
fs.writeFileSync(plan, JSON.stringify({ total: t, voice: B.filter((b) => voice[b.id]).map((b) => ({ file: voice[b.id], at: b.start })), events }));
run("python", [path.join(HERE, "sfx.py"), plan, voWav, fxWav]);
const wordsFile = path.join(WORK, "words.json");
run("python", [path.join(HERE, "..", "studio", "transcribe.py"), voWav, wordsFile]);
// the captions say the SCRIPT's words (never a mishearing like "trizzyvio"); whisper only gives their timing
const heard = JSON.parse(fs.readFileSync(wordsFile, "utf8")).segments.flatMap((s) => s.words);
const words = B.filter((b) => voice[b.id]).flatMap((b) => {
  const mine = b.say.split(/\s+/).filter(Boolean), got = heard.filter((w) => w.s >= b.start - 0.05 && w.s < b.end);
  if (!got.length) return mine.map((w, i) => ({ w, s: b.start + (i * b.voiceSecs) / mine.length, e: b.start + ((i + 1) * b.voiceSecs) / mine.length }));
  return mine.map((w, i) => { const a = got[Math.min(got.length - 1, Math.floor((i * got.length) / mine.length))], z = got[Math.min(got.length - 1, Math.floor(((i + 1) * got.length - 1) / mine.length))]; return { w, s: a.s, e: z.e }; });
});
const inSplit = (s) => B.some((b) => (b.kind === "slot" || b.kind === "note") && s >= b.start && s < b.end);
const chunks = [];
for (const w of words) {
  const last = chunks.at(-1);
  if (last && last.words.length < 4 && w.s - last.e < 0.35 && !/[.?!,:]$/.test(last.words.at(-1)) && inSplit(w.s) === last.split) { last.words.push(w.w); last.e = w.e; }
  else chunks.push({ s: w.s, e: w.e, words: [w.w], split: inSplit(w.s) });
}
const ts = (s) => `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${(s % 60).toFixed(2).padStart(5, "0")}`;
const style = (name, marginR) => `Style: ${name},Segoe UI Black,58,&H00FFFFFF,&H00FFFFFF,&H000B0A0A,&H80000000,0,0,0,0,100,100,0,0,1,5,0,2,60,${marginR},44,1`;
fs.writeFileSync(path.join(WORK, "captions.ass"), ["[Script Info]", "ScriptType: v4.00+", `PlayResX: ${W}`, `PlayResY: ${H}`, "", "[V4+ Styles]",
  "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
  style("Cap", 60), style("CapLeft", W - LEFT.x - LEFT.w + 20), "", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ...chunks.map((c, i) => `Dialogue: 0,${ts(c.s)},${ts(Math.min(c.e + 0.15, chunks[i + 1]?.s ?? c.e + 0.15))},${c.split ? "CapLeft" : "Cap"},,0,0,0,,${c.words.join(" ").replace(/[{}]/g, "")}`)].join("\n"));
const tag = `${engine === "sapi" && said.some((b) => !own(b.id)) ? "_PREVIEW" : ""}${B.some(missing) || slots.some((s) => !s.file) ? "_PLACEHOLDERS" : ""}`;
const final = path.join(OUT, `${S.slug}${tag}.mp4`);
// the footage's sound + the voice + the effects (a little under the voice); the captions burned in unless the episode
// turns them off (script.json captions: false, owner 2026-11-08: no text following the narration)
run("ffmpeg", ["-v", "error", "-y", "-i", body, "-i", voWav, "-i", fxWav, "-filter_complex", `[0:a][1:a]amix=inputs=2:duration=first:normalize=0[m];[m][2:a]amix=inputs=2:duration=first:weights='1 0.6':normalize=0,alimiter=limit=0.95[a];[0:v]${S.captions === false ? "null" : "ass=captions.ass"}[v]`,
  "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", final], { cwd: WORK });
fs.writeFileSync(path.join(OUT, "timeline.json"), JSON.stringify({ total: t, file: final, beats: B.map(({ id, chapter, kind, start, end, secs, step }) => ({ id, chapter, kind, step, start: +start.toFixed(2), end: +end.toFixed(2), secs: +secs.toFixed(2) })) }, null, 1));
fs.writeFileSync(path.join(OUT, "slots.txt"), [`Slots for "${S.title}" (${tc(t)} in all). Drop each file into ${ASSETS} as slot_NN.mp4 and run the assembly again: it is laid in automatically.`, "",
  ...slots.map((s) => `slot_${String(s.n).padStart(2, "0")}.mp4  at ${tc(s.start)}  length ${s.secs.toFixed(1)} s${s.sound ? "  (plays with its own sound)" : ""}${s.file ? "  [IN]" : ""}\n    SHOW: ${s.show}`)].join("\n"));
console.log(`done: ${final}\nslots: ${path.join(OUT, "slots.txt")} (${slots.filter((s) => s.file).length} of ${slots.length} filled)`);
