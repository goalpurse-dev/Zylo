// M2: the voice for a planned script: one ElevenLabs take with Eric's approved livelier settings (stability 0.3,
// style 0.45, speed 1.1), then the free re-time by real silences (voiceSilence.mjs: pauses shrunk or padded to the
// creator's, speech never sped up). Paid: the character cost x $0.0002, never refused for money (the plan is made by
// then). A take that already exists in the folder is re-used, never paid for twice.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { REPLAY, replayVoice } from "./providers.mjs";
import { allow, add } from "./budget.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const PER_CHAR = 0.0002;

/**
 * Each sentence's [first, last] word index in a take's word list (the take's words are the text split at spaces, see
 * alignmentWords), or null when the counts don't match (then no splice: a whole new take).
 */
export function sentenceSpans(sentences, words) {
  const counts = sentences.map((s) => String(s).trim().split(/\s+/).filter(Boolean).length);
  if (counts.reduce((a, b) => a + b, 0) !== words.length) return null;
  let i = 0;
  return counts.map((c) => { const span = [i, i + c - 1]; i += c; return span; });
}

/**
 * Splice a retaken line into the take (free): the audio from the middle of the gap before sentence idx to the middle of
 * the gap after it is replaced by the line's clip (its own leading and trailing silence trimmed to 0.05 s), and every
 * word time after it moves by the difference. Writes raw (mp3) and rawWords in place.
 */
export function spliceLine({ ff, raw, rawWords, sentences, idx, clip, clipWords }) {
  const words = JSON.parse(fs.readFileSync(rawWords, "utf8")), spans = sentenceSpans(sentences, words);
  if (!spans) throw new Error("splice: the take's words don't match the sentences");
  if (!clipWords.length) throw new Error("splice: the line take has no words");
  const [f, l] = spans[idx], dur = Number(execFileSync(ff.replace(/ffmpeg(\.exe)?$/i, (m) => m.replace("ffmpeg", "ffprobe")), ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", raw]).toString());
  const cutA = f === 0 ? 0 : (words[f - 1].e + words[f].s) / 2, cutB = l === words.length - 1 ? dur : (words[l].e + words[l + 1].s) / 2;
  const clipA = Math.max(0, clipWords[0].s - 0.05), clipB = clipWords.at(-1).e + 0.05;
  const lead = f === 0 ? 0 : words[f].s - cutA, tail = l === words.length - 1 ? 0 : cutB - words[l].e;
  const tmp = `${raw}.splice.mp3`;
  // before | silence lead | the line | silence tail | after: the gaps around the line keep the take's own pauses
  execFileSync(ff, ["-v", "error", "-y", "-i", raw, "-i", clip, "-filter_complex",
    `[0:a]atrim=0:${cutA.toFixed(3)},asetpts=N/SR/TB[a];[1:a]atrim=${clipA.toFixed(3)}:${clipB.toFixed(3)},asetpts=N/SR/TB,adelay=${Math.round(Math.max(0, lead - 0.05) * 1000)}:all=1,apad=pad_dur=${Math.max(0, tail - 0.05).toFixed(3)}[b];[0:a]atrim=${cutB.toFixed(3)},asetpts=N/SR/TB[c];[a][b][c]concat=n=3:v=0:a=1[o]`,
    "-map", "[o]", "-ar", "44100", "-b:a", "128k", tmp]);
  const lineStart = cutA + Math.max(0, lead - 0.05), shift = lineStart - clipA;
  const newLine = clipWords.map((w) => ({ ...w, s: +(w.s + shift).toFixed(3), e: +(w.e + shift).toFixed(3) }));
  const newEnd = lineStart + (clipB - clipA) + Math.max(0, tail - 0.05), move = newEnd - cutB;
  const out = [...words.slice(0, f), ...newLine, ...words.slice(l + 1).map((w) => ({ ...w, s: +(w.s + move).toFixed(3), e: +(w.e + move).toFixed(3) }))];
  fs.renameSync(tmp, raw);
  fs.writeFileSync(rawWords, JSON.stringify(out));
  // a line said by the free stand-in voice makes the take a stand-in (its check is relaxed in the harness only)
  if (fs.existsSync(`${clip}.standin`)) fs.writeFileSync(`${raw}.standin`, "the local stand-in voice");
  return out;
}

// model: the ElevenLabs model. eleven_multilingual_v2 (the approved landfill and French drain voice) again since
// 2026-10-24: Flash v2.5 garbled and repeated words in the car wash ("and in mind", "a car, car"); the owner chose the
// approved model at about $0.025 more a video.
// Every take is transcribed locally and compared word by word with the script (voiceCheck.mjs, free). When the problems
// sit in one or two sentences (and the caller gave the sentences), only those lines are said again, with the lines
// around them as context, and spliced in at the take's own word times: a few cents instead of a whole take (the owner's
// rule of 2026-11-04, after the fish and bridge videos stopped on one word each). Up to 3 line retakes and 2 whole takes;
// then the video stops (the user is refunded).
// a narration this long is a runaway plan, not a video (a 60 s one is about 1,400 characters). There is no money cap on
// the voice: once the plan is made it always runs (the owner's rule of 2026-10-29). A $0.40 cap here refused every
// 60 s voice before the call, and its plain error was retried as ours: the swimming pool 60 s run of 2026-10-29 then
// paid for its whole plan a second time.
export const VOICE_MAX_CHARS = 4000;
export async function makeVoice({ text, sentences = null, out, ff, wt, log, sectionWords = [], model = "eleven_multilingual_v2", check = true, python = process.env.PYTHON ?? "python" }) {
  fs.mkdirSync(out, { recursive: true });
  const raw = path.join(out, "raw.mp3"), rawWords = path.join(out, "raw.words.json"), final = path.join(out, "voice.mp3");
  let usd = 0;
  // one take of `say` into mp3/wordsFile; prev/next: the lines around it, so a retaken line keeps the take's tone
  const take = async ({ say = text, mp3 = raw, wordsFile = rawWords, prev = "", next = "", line = false } = {}) => {
    if (say.length > VOICE_MAX_CHARS) throw Object.assign(new Error(`voice: the narration is ${say.length} characters (a runaway plan; at most ${VOICE_MAX_CHARS})`), { code: "PLAN_FAILED", retryable: false });
    // the free harness: a recorded take or a free local one, never ElevenLabs (providers.mjs)
    if (!REPLAY) allow("voice");
    if (REPLAY) { const r = replayVoice({ text: say, mp3, ff, log }); fs.writeFileSync(wordsFile, JSON.stringify(r.words)); if (!line) fs.writeFileSync(path.join(out, "voice.json"), JSON.stringify({ text, model, chars: text.length, replay: true, simulatedUsd: r.simulatedUsd }, null, 1)); return; }
    let key = process.env.ELEVENLABS_KEY;
    if (!key) for (const line of fs.readFileSync("C:/Users/Public/Zylo/.env.local", "utf8").split(/\r?\n/)) { const m = line.match(/^\s*ELEVENLABS_KEY\s*=\s*(.*)\s*$/); if (m) key = m[1].replace(/^["']|["']$/g, ""); }
    const res = await fetch("https://api.elevenlabs.io/v1/text-to-speech/cjVigY5qzO86Huf0OWal/with-timestamps?output_format=mp3_44100_128", {
      method: "POST", headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ text: say, model_id: model, voice_settings: { stability: 0.3, similarity_boost: 0.75, style: 0.45, use_speaker_boost: true, speed: 1.1 }, ...(prev ? { previous_text: prev } : {}), ...(next ? { next_text: next } : {}) }),
    });
    if (!res.ok) throw new Error(`voice failed (not billed): ${res.status} ${(await res.text()).slice(0, 300)}`);
    const chars = Number(res.headers.get("character-cost")) || say.length;
    const u = +(chars * PER_CHAR).toFixed(4); usd += u; add(u);
    const body = await res.json();
    fs.writeFileSync(mp3, Buffer.from(body.audio_base64, "base64"));
    const { alignmentWords } = await import(pathToFileURL(path.join(wt, "supabase/functions/_shared/cutaway/voice.js")).href);
    fs.writeFileSync(wordsFile, JSON.stringify(alignmentWords(body.alignment ?? body.normalized_alignment)));
    fs.writeFileSync(path.join(out, "voice.json"), JSON.stringify({ text, model, chars: text.length, characterCost: chars, usd }, null, 1));
    if (log) fs.appendFileSync(log, `${JSON.stringify({ at: new Date().toISOString(), label: `voice (ElevenLabs ${model}${line ? ", one line" : ""})`, chars: say.length, characterCost: chars, costUsd: u })}\n`);
  };
  // a take already in the folder is re-used (never paid for twice), and checked like a new one
  if (!fs.existsSync(raw)) await take();
  if (check) {
    const { checkVoice, badSentences } = await import(pathToFileURL(path.join(here, "voiceCheck.mjs")).href);
    const tries = [];
    let wholeTakes = 1, lineTakes = 0;
    for (let n = 0; ; n++) {
      const c = checkVoice({ voice: raw, text, ff, python });
      // the free harness only: the local stand-in voice (Windows speech) slurs words a real take says clearly ("pay kiosk"
      // as "pakeosk"), so its misses are kept as notes and the run goes on (the checker itself is tested on 35 real
      // takes); a recorded real take, or a bad take put in on purpose, is checked as in production
      if (REPLAY && !c.ok && fs.existsSync(`${raw}.standin`)) { c.notes.push(...c.problems.map((p) => `stand-in voice: ${p}`)); c.problems = []; c.ok = true; c.standIn = true; }
      tries.push({ ok: c.ok, problems: c.problems, notes: c.notes, heard: c.heard });
      fs.writeFileSync(path.join(out, "voice_check.json"), JSON.stringify(tries, null, 1));
      if (c.ok) break;
      const bad = Array.isArray(sentences) ? badSentences(sentences, text, c.spots ?? []) : null;
      const words = (() => { try { return JSON.parse(fs.readFileSync(rawWords, "utf8")); } catch { return null; } })();
      const canSplice = bad && bad.length <= 2 && lineTakes + bad.length <= 3 && words && sentenceSpans(sentences, words);
      if (!canSplice && wholeTakes >= 2) {
        // every take's problems, with what was heard (the owner's Details; the Pond run of 2026-10-25 only kept the second)
        throw new Error(`voice check failed twice (stop and refund): ${tries.map((t, i) => `take ${i + 1}: ${t.problems.join("; ")} | heard: "${String(t.heard ?? "").slice(0, 400)}"`).join(" || ")}`);
      }
      // the failed take kept beside it, for listening
      fs.copyFileSync(raw, path.join(out, `raw_rejected${n + 1}.mp3`)); fs.copyFileSync(rawWords, path.join(out, `raw_rejected${n + 1}.words.json`));
      if (!canSplice) { fs.rmSync(raw); fs.rmSync(rawWords); await take(); wholeTakes++; continue; }
      // the bad lines again, last first (an earlier splice would move the later lines' times)
      for (const k of [...bad].reverse()) {
        const clip = path.join(out, `line${n + 1}_${k}.mp3`), clipWords = path.join(out, `line${n + 1}_${k}.words.json`);
        await take({ say: sentences[k], mp3: clip, wordsFile: clipWords, prev: sentences.slice(Math.max(0, k - 2), k).join(" "), next: sentences.slice(k + 1, k + 3).join(" "), line: true });
        spliceLine({ ff, raw, rawWords, sentences, idx: k, clip, clipWords: JSON.parse(fs.readFileSync(clipWords, "utf8")) });
        lineTakes++;
      }
      if (log) fs.appendFileSync(log, `${JSON.stringify({ at: new Date().toISOString(), label: "voice: lines retaken", sentences: bad })}\n`);
    }
  }
  // (its outputs are written last: a crash after them is Node's own exit on Windows, "UV_HANDLE_CLOSING", and the re-time
  // is done; it failed a free 60 s traffic light run as RENDER_FAILED)
  const t0 = Date.now(), wordsOut = final.replace(/\.mp3$/, ".words.json");
  try { execFileSync(process.execPath, [path.join(here, "..", "voiceSilence.mjs"), ff, raw, rawWords, final], { env: { ...process.env, ...(sectionWords.length ? { SECTION_WORDS: sectionWords.join("|") } : {}) }, stdio: ["ignore", "pipe", "inherit"] }); }
  catch (e) { if (![final, wordsOut].every((f) => fs.existsSync(f) && fs.statSync(f).mtimeMs >= t0 - 1000 && fs.statSync(f).size > 0)) throw e; console.error(`[cutaway] the re-time exited badly after writing its files (kept): ${String(e.message).slice(0, 120)}`); }
  return { voice: final, words: JSON.parse(fs.readFileSync(final.replace(/\.mp3$/, ".words.json"), "utf8")), usd };
}
