// M2: the voice for a planned script: one ElevenLabs take with Eric's approved livelier settings (stability 0.3,
// style 0.45, speed 1.1), then the free re-time by real silences (voiceSilence.mjs: pauses shrunk or padded to the
// creator's, speech never sped up). Paid: the character cost x $0.0002, refused above `capUsd`. A take that already
// exists in the folder is re-used, never paid for twice.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const PER_CHAR = 0.0002;

// model: the ElevenLabs model. eleven_multilingual_v2 (the approved landfill and French drain voice) again since
// 2026-10-24: Flash v2.5 garbled and repeated words in the car wash ("and in mind", "a car, car"); the owner chose the
// approved model at about $0.025 more a video.
// Every take is transcribed locally and compared word by word with the script (voiceCheck.mjs, free). A failing take is
// paid for again once; a second failure stops the video (the user is refunded).
export async function makeVoice({ text, out, ff, wt, capUsd = 0.4, log, sectionWords = [], model = "eleven_multilingual_v2", check = true, python = "python" }) {
  fs.mkdirSync(out, { recursive: true });
  const raw = path.join(out, "raw.mp3"), rawWords = path.join(out, "raw.words.json"), final = path.join(out, "voice.mp3");
  let usd = 0;
  const take = async () => {
    if (text.length * PER_CHAR * 2 > capUsd) throw new Error(`voice: worst case $${(text.length * PER_CHAR * 2).toFixed(3)} (two takes) is over the $${capUsd} cap`);
    let key = process.env.ELEVENLABS_KEY;
    if (!key) for (const line of fs.readFileSync("C:/Users/Public/Zylo/.env.local", "utf8").split(/\r?\n/)) { const m = line.match(/^\s*ELEVENLABS_KEY\s*=\s*(.*)\s*$/); if (m) key = m[1].replace(/^["']|["']$/g, ""); }
    const res = await fetch("https://api.elevenlabs.io/v1/text-to-speech/cjVigY5qzO86Huf0OWal/with-timestamps?output_format=mp3_44100_128", {
      method: "POST", headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ text, model_id: model, voice_settings: { stability: 0.3, similarity_boost: 0.75, style: 0.45, use_speaker_boost: true, speed: 1.1 } }),
    });
    if (!res.ok) throw new Error(`voice failed (not billed): ${res.status} ${(await res.text()).slice(0, 300)}`);
    const chars = Number(res.headers.get("character-cost")) || text.length;
    const u = +(chars * PER_CHAR).toFixed(4); usd += u;
    const body = await res.json();
    fs.writeFileSync(raw, Buffer.from(body.audio_base64, "base64"));
    const { alignmentWords } = await import(pathToFileURL(path.join(wt, "supabase/functions/_shared/cutaway/voice.js")).href);
    fs.writeFileSync(rawWords, JSON.stringify(alignmentWords(body.alignment ?? body.normalized_alignment)));
    fs.writeFileSync(path.join(out, "voice.json"), JSON.stringify({ text, model, chars: text.length, characterCost: chars, usd }, null, 1));
    if (log) fs.appendFileSync(log, `${JSON.stringify({ at: new Date().toISOString(), label: `voice (ElevenLabs ${model})`, chars: text.length, characterCost: chars, costUsd: u })}\n`);
  };
  // a take already in the folder is re-used (never paid for twice), and checked like a new one
  if (!fs.existsSync(raw)) await take();
  if (check) {
    const { checkVoice } = await import(pathToFileURL(path.join(here, "voiceCheck.mjs")).href);
    const tries = [];
    for (let n = 0; ; n++) {
      const c = checkVoice({ voice: raw, text, ff, python });
      tries.push({ ok: c.ok, problems: c.problems, notes: c.notes, heard: c.heard });
      fs.writeFileSync(path.join(out, "voice_check.json"), JSON.stringify(tries, null, 1));
      if (c.ok) break;
      if (n >= 1) throw new Error(`voice check failed twice (stop and refund): ${c.problems.join("; ")}`);
      // the failed take kept beside it, for listening
      fs.renameSync(raw, path.join(out, `raw_rejected${n + 1}.mp3`)); fs.renameSync(rawWords, path.join(out, `raw_rejected${n + 1}.words.json`));
      await take();
    }
  }
  execFileSync(process.execPath, [path.join(here, "..", "voiceSilence.mjs"), ff, raw, rawWords, final], { env: { ...process.env, ...(sectionWords.length ? { SECTION_WORDS: sectionWords.join("|") } : {}) }, stdio: ["ignore", "pipe", "inherit"] });
  return { voice: final, words: JSON.parse(fs.readFileSync(final.replace(/\.mp3$/, ".words.json"), "utf8")), usd };
}
