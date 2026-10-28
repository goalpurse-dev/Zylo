// M2: the paid providers' stand-in for the free end-to-end harness (m3/harness.mjs). Off unless the environment says
// CUTAWAY_PROVIDERS=replay, so production never takes this path. In replay mode:
//   - every network call to a paid provider (Anthropic, ElevenLabs, Runware) is refused outright (the fetch guard), so a
//     harness run can never spend money, whatever the code does;
//   - each Claude call is answered from CUTAWAY_REPLAY_DIR/answers/<label>__<n>.json (a recorded reply from a real
//     run, or one written for the harness); the request is saved beside it (requests/), and a call with no answer
//     stops the run with REPLAY_PENDING (the answer is written, then the run is repeated);
//   - each voice take is a recorded take (answers/voice__<n>.json: { file, words }) or a free local one (Windows
//     speech), timed word by word, so the voice check, the re-timing and the render run on real audio.
// Every replayed call logs what it would have cost (simulatedUsd), for the price estimate.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

export const REPLAY = process.env.CUTAWAY_PROVIDERS === "replay";
const DIR = process.env.CUTAWAY_REPLAY_DIR ?? "";
const PAID = /(^|\.)(api\.anthropic\.com|api\.elevenlabs\.io|api\.runware\.ai)$/i;

if (REPLAY) {
  if (!DIR) throw new Error("CUTAWAY_PROVIDERS=replay needs CUTAWAY_REPLAY_DIR");
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const host = (() => { try { return new URL(typeof url === "string" ? url : url.url).hostname; } catch { return ""; } })();
    if (PAID.test(host)) throw Object.assign(new Error(`replay mode: the paid provider ${host} is blocked`), { code: "PAID_BLOCKED" });
    return real(url, init);
  };
}

const seen = new Map();
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
const nextKey = (label) => { const k = slug(label), n = (seen.get(k) ?? 0) + 1; seen.set(k, n); return `${k}__${n}`; };
// the job's spend log, and the replay folder's own copy (the harness sums what the video would have cost)
const note = (log, row) => { const line = `${JSON.stringify({ at: new Date().toISOString(), ...row })}\n`; if (log) fs.appendFileSync(log, line); fs.appendFileSync(path.join(DIR, "spend.jsonl"), line); };
const pending = (key, what) => Object.assign(new Error(`REPLAY_PENDING ${key}: ${what}`), { code: "REPLAY_PENDING", retryable: false });

// USD per 1M tokens (llm.mjs PRICE), about 3.6 characters a token: what the call would have cost
const PRICE = { "claude-haiku-5-5": [0.1, 0.5], "claude-sonnet-5-5": [2, 10], "claude-opus-5-5": [4, 20] };
const estimate = (model, inChars, outChars, images, searches) => {
  const [pi, po] = PRICE[model] ?? PRICE["claude-sonnet-5-5"];
  return +(((inChars / 3.6 + images * 1500) * pi + (outChars / 3.6) * po) / 1e6 + searches * 0.01).toFixed(5);
};

/**
 * What the API's structured outputs would refuse in a schema (a 400 on every call: the kit check of 2026-10-25 had
 * maxItems): size limits, and objects that are not closed with every property required.
 */
export function schemaProblems(s, at = "schema") {
  const P = [];
  if (!s || typeof s !== "object") return P;
  for (const k of ["maxItems", "maxLength", "minLength", "maxProperties", "minProperties"]) if (k in s) P.push(`${at}: ${k} is not supported`);
  if ("minItems" in s && s.minItems > 1) P.push(`${at}: minItems above 1 is not supported`);
  if (s.type === "object" && s.properties) {
    if (s.additionalProperties !== false) P.push(`${at}: additionalProperties must be false`);
    const req = new Set(s.required ?? []);
    for (const k of Object.keys(s.properties)) if (!req.has(k)) P.push(`${at}.${k}: every property must be required`);
    for (const [k, v] of Object.entries(s.properties)) P.push(...schemaProblems(v, `${at}.${k}`));
  }
  if (s.items) P.push(...schemaProblems(s.items, `${at}[]`));
  return P;
}

/** a Claude call answered from the replay folder (see the top); the same reply shape as llm.mjs callJSON */
export function replayLLM({ label, model, system, user, schema, search = 0, log }) {
  // the API's own refusal of a schema it cannot use, as a 400 (never answered)
  const sp = schema ? schemaProblems(schema) : [];
  if (sp.length) throw Object.assign(new Error(`anthropic 400 (replay): the schema is refused: ${sp.slice(0, 3).join("; ")}`), { costUsd: 0 });
  const key = nextKey(label), req = path.join(DIR, "requests"), ans = path.join(DIR, "answers", `${key}.json`);
  fs.mkdirSync(req, { recursive: true });
  // the request as text (images saved beside it), and its fingerprint: the user part, so a changed rule in a system
  // prompt keeps the answers, while a changed input (another script, other frames) needs a new one
  const h = crypto.createHash("sha1"); let images = 0;
  const parts = typeof user === "string" ? [{ type: "text", text: user }] : user;
  const text = parts.map((p) => {
    if (p.type === "image") { images++; const b = Buffer.from(p.source.data, "base64"); h.update(b); const f = `${key}_img${images}.jpg`; fs.writeFileSync(path.join(req, f), b); return `[image ${f}]`; }
    h.update(p.text); return p.text;
  }).join("\n");
  const hash = h.digest("hex").slice(0, 16);
  fs.writeFileSync(path.join(req, `${key}.json`), JSON.stringify({ key, label, model, hash, search, schema, system, user: text }, null, 1));
  if (!fs.existsSync(ans)) throw pending(key, label);
  const a = JSON.parse(fs.readFileSync(ans, "utf8"));
  if (a.hash && a.hash !== "*" && a.hash !== hash) throw pending(key, `${label}: the recorded answer is for another request (${a.hash}, now ${hash})`);
  // (a written answer may hold the scene as an object; the planner reads it as JSON text, as the API sends it)
  if (a.data && typeof a.data.sceneJson === "object") a.data.sceneJson = JSON.stringify(a.data.sceneJson);
  const out = JSON.stringify(a.data ?? {}), searches = a.searches ?? (search ? Math.min(search, 4) : 0);
  const simulatedUsd = estimate(model, system.length + text.length, out.length, images, searches);
  note(log, { label, model, replay: key, costUsd: 0, simulatedUsd });
  return { data: schema ? a.data : { text: a.data?.text ?? "", sources: a.data?.sources ?? [] }, costUsd: 0, simulatedUsd, usage: null, searches, sources: a.data?.sources ?? [] };
}

/**
 * A voice take: a recorded one (answers/voice__<n>.json: { file, words? }), else a free local take (Windows speech,
 * word times from its own progress events). Writes the mp3 to `mp3`; returns { words, chars, simulatedUsd }.
 */
export function replayVoice({ text, mp3, ff, log }) {
  const key = nextKey("voice"), ans = path.join(DIR, "answers", `${key}.json`);
  let words;
  // a real take recorded for exactly this narration (CUTAWAY_TAKES: { text: { mp3, words } }, from earlier paid runs)
  const takes = (() => { try { return process.env.CUTAWAY_TAKES ? JSON.parse(fs.readFileSync(process.env.CUTAWAY_TAKES, "utf8")) : {}; } catch { return {}; } })();
  const real = takes[text.trim()];
  if (real && !fs.existsSync(ans)) { fs.copyFileSync(real.mp3, mp3); words = JSON.parse(fs.readFileSync(real.words, "utf8")); }
  else if (fs.existsSync(ans)) {
    const a = JSON.parse(fs.readFileSync(ans, "utf8"));
    fs.copyFileSync(path.resolve(DIR, a.file), mp3);
    words = a.words ? JSON.parse(fs.readFileSync(path.resolve(DIR, a.words), "utf8")) : localWords(text, mp3, ff);
  } else { words = speak(text, mp3, ff); fs.writeFileSync(`${mp3}.standin`, "the local stand-in voice"); }
  if (real || fs.existsSync(ans)) fs.rmSync(`${mp3}.standin`, { force: true });
  // (ElevenLabs bills about a fifth of the characters: 617 characters cost 123 on the car wash take of 2026-10-24)
  const simulatedUsd = +(Math.round(text.length / 5) * 0.0002).toFixed(4);
  note(log, { label: "voice (replay)", replay: key, chars: text.length, costUsd: 0, simulatedUsd });
  return { words, chars: text.length, simulatedUsd };
}

// Windows speech (System.Speech): the text spoken to a wav, each word's start from its progress event
function speak(text, mp3, ff) {
  const wav = mp3.replace(/\.mp3$/, ".wav"), tsv = mp3.replace(/\.mp3$/, ".sapi.tsv"), txt = mp3.replace(/\.mp3$/, ".txt");
  fs.writeFileSync(txt, text, "utf8");
  const ps = `$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Rate = 3; $global:rows = New-Object System.Collections.Generic.List[string]; $s.add_SpeakProgress({ param($o, $e) $global:rows.Add(('{0}' -f $e.AudioPosition.TotalSeconds) + [char]9 + $e.CharacterPosition + [char]9 + $e.CharacterCount) }); $s.SetOutputToWaveFile('${wav}', (New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono))); $s.Speak([IO.File]::ReadAllText('${txt}')); $s.Dispose(); [IO.File]::WriteAllLines('${tsv}', $global:rows)`;
  execFileSync("powershell.exe", ["-NoProfile", "-Command", ps], { stdio: ["ignore", "pipe", "pipe"] });
  execFileSync(ff, ["-v", "error", "-y", "-i", wav, "-ar", "44100", "-b:a", "128k", mp3]);
  const dur = Number(execFileSync(ff.replace(/ffmpeg(\.exe)?$/i, (m) => m.replace("ffmpeg", "ffprobe")), ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp3], { encoding: "utf8" }).trim());
  const rows = fs.readFileSync(tsv, "utf8").trim().split(/\r?\n/).filter(Boolean).map((l) => { const [t, p, n] = l.split("\t").map(Number); return { t, p, n }; });
  // each word of the text: its start from the progress event at its character position, its end just before the next
  const out = []; const re = /\S+/g; let m;
  while ((m = re.exec(text))) {
    const r = rows.find((x) => x.p <= m.index && m.index < x.p + Math.max(1, x.n)) ?? rows.filter((x) => x.p <= m.index).at(-1);
    out.push({ w: m[0], s: r ? r.t : 0 });
  }
  // in order and never overlapping (as a real take's alignment): each word starts after the one before; it ends where
  // the audio falls silent before the next word (the speech engine gives starts only), so pauses are where they are
  for (let i = 1; i < out.length; i++) out[i].s = Math.max(out[i].s, out[i - 1].s + 0.06);
  const quiet = silences(wav, ff);
  for (let i = 0; i < out.length; i++) {
    const nx = Math.min(out[i + 1]?.s ?? dur, dur), gap = quiet.find(([a, b]) => a > out[i].s + 0.05 && a < nx && b > a);
    out[i].e = +(gap ? gap[0] : Math.min(nx - 0.01, out[i].s + 0.6 + 0.06 * out[i].w.length)).toFixed(3); out[i].s = +out[i].s.toFixed(3);
    if (out[i].e <= out[i].s) out[i].e = +(out[i].s + 0.04).toFixed(3);
  }
  return out;
}
// the silent stretches of a take (at least 60 ms, 26 dB under its speech level, as voiceSilence.mjs measures them)
function silences(file, ff) {
  const SR = 16000, HOP = SR / 100, b = execFileSync(ff, ["-v", "error", "-i", file, "-ac", "1", "-ar", String(SR), "-f", "s16le", "-"], { maxBuffer: 1 << 28 });
  const N = Math.floor(b.length / 2 / HOP), db = new Float32Array(N);
  for (let i = 0; i < N; i++) { let s = 0; for (let k = 0; k < HOP; k++) { const v = b.readInt16LE((i * HOP + k) * 2) / 32768; s += v * v; } db[i] = 10 * Math.log10(s / HOP + 1e-10); }
  const speech = [...db].sort((p, q) => p - q)[Math.floor(N * 0.8)], runs = []; let a = -1;
  for (let i = 0; i <= N; i++) { const sil = i < N && db[i] < speech - 26; if (sil) { if (a < 0) a = i; } else if (a >= 0) { if (i - a >= 6) runs.push([a / 100, i / 100]); a = -1; } }
  return runs;
}
// a recorded take without its word times: spread over the take (only for takes kept without them)
function localWords(text, mp3, ff) {
  const dur = Number(execFileSync(ff.replace(/ffmpeg(\.exe)?$/i, (m) => m.replace("ffmpeg", "ffprobe")), ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp3], { encoding: "utf8" }).trim());
  const ws = text.split(/\s+/).filter(Boolean), step = dur / ws.length;
  return ws.map((w, i) => ({ w, s: +(i * step).toFixed(3), e: +((i + 0.85) * step).toFixed(3) }));
}
