// ONE 6-second test clip on each of the three clip models the owner chose on 2026-10-08, with REAL Blocky
// material: scene 2's picture from the first real story (Vex speaking, Noob listening), that scene's own
// clip prompt, and one spoken line long enough for 6 seconds. 9:16.
//   grok    Grok Imagine Video 1.5 Lite at 480p (480x848), then the ByteDance video upscaler (the raw clip is kept)
//   pvideo  P-Video-2 at 720p
//   veo     Veo 3.1 Lite at 720p
// Nobody is charged credits (the worker's no-charge test action; every call is logged with its real cost).
// No live model changes: models.js is not touched. ONE attempt per clip: a clip that was sent is never
// sent again (a request refused before it reached the model is not an attempt).
// After the owner's go on the lineup (2026-10-08), two more clips, each asked for by name, from the same scene
// and line but with TODAY's clip builder (the per-model wording in clips.js):
//   grok720  Grok at its native 720p: is it clearly sharper than the 480p clip resized?
//   veo2     Veo 3.1 Lite after the prompt pass: the first frame's framing kept, faces unchanged, a flat mouth
//   BLOCKY_ALLOW_PAID=1 node scripts/blocky/testClipModels.mjs <ffmpegPath> grok720,veo2
//   node scripts/blocky/testClipModels.mjs <ffmpegPath>                       prints the plan, sends nothing
//   BLOCKY_ALLOW_PAID=1 node scripts/blocky/testClipModels.mjs <ffmpegPath>   runs it (about $0.75; stage cap $1.50)
import fs from "fs";
import path from "path";
import { execFileSync, spawnSync } from "child_process";
import { ROOT, admin, rawTest, writeJson } from "./lib.mjs";
import { openBlockyBudget, paidCallsAllowed } from "./paidGuard.mjs";
import { spokenProblem } from "../../supabase/functions/_shared/blocky/spoken.js";
import { buildClipRequest } from "../../supabase/functions/_shared/blocky/clips.js";

const [ffmpeg, extraKeys = ""] = process.argv.slice(2);
if (!ffmpeg || !fs.existsSync(ffmpeg)) { console.error("usage: node scripts/blocky/testClipModels.mjs <ffmpegPath>"); process.exit(2); }
const OUT = "data/blocky-tests/models";
const DIR = path.join(ROOT, OUT);
const FILE = path.join(DIR, "results.json");
const out = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { items: {} };
const save = () => writeJson(`${OUT}/results.json`, out);
const db = admin();

// The material: the first real story, scene 2.
const STORY = "e12c6d68-5aac-4fe0-ac15-20ad9696c222";
const { data: scene } = await db.from("blocky_story_scenes").select("line, image_url, clip_job_id").eq("story_id", STORY).eq("idx", 1).single();
const { data: job } = await db.from("blocky_jobs").select("request").eq("id", scene.clip_job_id).single();
const LINE = "That command doesn't even exist, Noob. Try it again and you're banned.";   // the scene's own line and a second sentence: 12 words, about 6 seconds
if (!job.request.positivePrompt.includes(`"${scene.line}"`)) throw new Error("the stored clip prompt no longer quotes the scene's line");
const prompt = job.request.positivePrompt.replace(`"${scene.line}"`, `"${LINE}"`);
const frame = { frameImages: [{ image: scene.image_url, frame: "first" }] };
const base = { taskType: "videoInference", positivePrompt: prompt, duration: 6, inputs: frame, outputType: "URL", outputFormat: "MP4", numberResults: 1 };
const ITEMS = [
  { key: "grok", label: "Grok Imagine Video 1.5 Lite, 480p", listUsd: 6 * 0.02 + 0.01, expectUsd: 0.16, task: { ...base, model: "xai:grok-imagine@video-1.5-lite", resolution: "480p" } },   // with a frame image the size comes from the image; width/height are refused
  { key: "pvideo", label: "P-Video-2, 720p", listUsd: 0.15, expectUsd: 0.35, task: { ...base, model: "prunaai:p-video@2", resolution: "720p", settings: { audio: true } } },
  { key: "veo", label: "Veo 3.1 Lite, 720p", listUsd: 6 * 0.05, expectUsd: 0.35, task: { ...base, model: "google:veo@3.1-lite", width: 720, height: 1280, providerSettings: { google: { generateAudio: true } } } },
];
const UPSCALE = { key: "grokUp", label: "Grok clip through the ByteDance video upscaler", expectUsd: 0.2 };
out.line = LINE; out.picture = scene.image_url; out.prompt = prompt; out.story = STORY;

// The two later clips: the same scene and line through today's builder.
const { data: full } = await db.from("blocky_story_scenes").select("*").eq("story_id", STORY).eq("idx", 1).single();
const { data: chars } = await db.from("blocky_characters").select("*");
const today = (quality) => buildClipRequest({
  story: { aspect: "9:16", quality }, library: new Map(chars.map((c) => [c.id, c])), durationSec: 6,
  scene: { speakerId: full.speaker_id, presentIds: full.present_ids, action: full.action, emotion: full.emotion, shot: full.shot, placement: full.placement, line: LINE, imageUrl: full.image_url },
}).request;
const EXTRA = [
  { key: "grok720", label: "Grok Imagine Video 1.5 Lite, native 720p, today's prompt", expectUsd: 0.25, task: { ...today("v2"), resolution: "720p" } },
  { key: "veo2", label: "Veo 3.1 Lite, 720p, after the prompt pass", expectUsd: 0.35, task: today("v3") },
].filter((x) => extraKeys.split(",").includes(x.key));
if (!paidCallsAllowed()) {
  for (const x of EXTRA) console.log(`${x.key}: ${x.label}
${JSON.stringify({ ...x.task, positivePrompt: "(below)" })}
${x.task.positivePrompt}
`);
  console.log(`Nothing was sent. Plan: one 6 s clip each on ${ITEMS.map((i) => i.label).join("; ")}; then the Grok clip through the upscaler.`);
  console.log(`Line (${LINE.split(" ").length} words): ${LINE}\nPicture: ${scene.image_url}\nList prices: ${ITEMS.map((i) => `${i.key} $${i.listUsd.toFixed(2)}`).join(", ")}, upscale a few cents. About $0.75 in all.`);
  process.exit(0);
}
fs.mkdirSync(path.join(DIR, "frames"), { recursive: true });
const budget = openBlockyBudget("models");
const set = async (on) => { const { error } = await db.from("blocky_settings").update({ paid_calls: on }).eq("id", true); if (error) throw new Error(error.message); };
// A request refused for its parameters never reached the model (no clip, no cost): not an attempt.
const refused = (row) => row?.state === "error" && !row.cost && /conflictParameters|invalid|unsupported|missing/i.test(row.error ?? "");
const attempted = (row) => row && ["success", "error", "timeout"].includes(row.state) && !refused(row);
async function run(key, label, task, expectUsd) {
  if (attempted(out.items[key])) { console.log(`${key}: already sent (${out.items[key].state}); not sent again`); return out.items[key]; }
  budget.reserve(expectUsd, key);
  const before = refused(out.items[key]) ? [...(out.items[key].refusals ?? []), out.items[key].error] : [];
  out.items[key] = { key, label, model: task.model, task, state: "sent", at: new Date().toISOString(), ...(before.length ? { refusals: before } : {}) }; save();
  const r = await rawTest(task, `blocky-models-${key}`, { everyMs: 2000 });
  const row = Object.assign(out.items[key], { state: r.state, cost: r.cost, seconds: r.seconds, error: r.error ?? null, url: r.url ?? null });
  budget.record(r.cost, `models: ${label} (${r.state})`, expectUsd);
  if (r.url) { row.file = `${key}.mp4`; fs.writeFileSync(path.join(DIR, row.file), Buffer.from(await (await fetch(r.url)).arrayBuffer())); }
  save();
  console.log(`${key}: ${r.state} $${r.cost.toFixed(4)} in ${r.seconds}s${r.error ? ` (${r.error})` : ""}`);
  return row;
}
await set(true);
try {
  for (const it of [...ITEMS, ...EXTRA]) await run(it.key, it.label, it.task, it.expectUsd);
  const g = out.items.grok;
  if (g?.state === "success") await run(UPSCALE.key, UPSCALE.label, { taskType: "upscale", model: "bytedance:50@1", inputs: { video: g.url }, outputType: "URL", outputFormat: "MP4" }, UPSCALE.expectUsd);
} finally {
  await set(false);
}

// What each file is: size, frame rate, length, sound (from ffmpeg's own report), and frame sheets to judge by eye.
for (const row of Object.values(out.items).filter((r) => r.file)) {
  const mp4 = path.join(DIR, row.file);
  const info = spawnSync(ffmpeg, ["-hide_banner", "-i", mp4], { encoding: "utf8" }).stderr;
  const v = /Video: (\w+)[^\n]*?, (\d{3,4})x(\d{3,4})[^\n]*?, (\d+(?:\.\d+)?) kb\/s[^\n]*?, (\d+(?:\.\d+)?) fps/.exec(info);
  const d = /Duration: (\d+):(\d+):(\d+\.\d+)/.exec(info);
  row.video = { codec: v?.[1] ?? null, width: Number(v?.[2] ?? 0), height: Number(v?.[3] ?? 0), kbps: Number(v?.[4] ?? 0), fps: Number(v?.[5] ?? 0), seconds: d ? Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]) : null, audio: /Audio: (\w+)/.exec(info)?.[1] ?? null, mb: Number((fs.statSync(mp4).size / 1e6).toFixed(2)) };
  const sheet = (vf, name) => execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-i", mp4, "-vf", vf, "-frames:v", "1", "-q:v", "3", path.join(DIR, "frames", name)]);
  sheet("fps=2,scale=200:-1,tile=6x2", `${row.key}-strip.jpg`);
  sheet("fps=5,crop=iw:ih*0.55:0:0,scale=288:-1,tile=6x5", `${row.key}-faces.jpg`);
  sheet("select=eq(n\\,60),scale=720:-1", `${row.key}-still.jpg`);   // one full frame at 720 wide, for sharpness side by side
}
save();

// Did the voice say the line? The same speech-to-text and the same comparison the clip check uses.
const toHear = Object.values(out.items).filter((r) => r.file && r.video?.audio && !r.heard);
if (toHear.length) {
  budget.reserve(0.01, "transcripts");
  for (const row of toHear) {
    const form = new FormData();
    form.append("file", new Blob([fs.readFileSync(path.join(DIR, row.file))], { type: "video/mp4" }), "clip.mp4");
    form.append("model", "whisper-1"); form.append("language", "en"); form.append("response_format", "verbose_json"); form.append("timestamp_granularities[]", "word");
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: form });
    const j = await res.json().catch(() => ({}));
    const text = j.text ?? `(HTTP ${res.status} ${j.error?.message ?? ""})`;
    row.heard = { text, words: (j.words ?? []).map((w) => ({ w: w.word, s: w.start, e: w.end })), problem: j.text ? spokenProblem(LINE, j.text) : "no transcript" };
    save();
    console.log(`${row.key} heard: ${text}${row.heard.problem ? `  [${row.heard.problem}]` : "  [exact]"}`);
  }
  budget.record(toHear.length * 0.0006, "models: transcripts (whisper-1)", 0.01);
}
for (const row of Object.values(out.items)) console.log(`${row.key}: ${row.state} | $${Number(row.cost ?? 0).toFixed(4)} | ${row.seconds}s to make | ${row.video ? `${row.video.width}x${row.video.height} ${row.video.fps} fps ${row.video.seconds}s ${row.video.kbps} kb/s sound: ${row.video.audio}` : row.error}`);
console.log(budget.summary());
const { data: paid } = await db.rpc("blocky_paid_state", { p_add_usd: 0 });
console.log(`Paid calls are ${paid.paid_calls ? "ON (!)" : "OFF"} again.`);
