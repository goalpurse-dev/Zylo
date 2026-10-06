// Blocky Stories test 1: does lip sync work on flat decal faces?
// 3 first-frame pictures (Nano Banana 2 Lite, 9:16), each with a different
// face type, then one 5 s clip per picture on V2 = Wan2.6 Flash, then
// speech-to-text on each clip.
// Nobody is charged credits: pictures go through runware-bakeoff-proxy, clips
// through the worker's raw_test / raw_poll (every clip call is logged with its
// real cost). ONE attempt per item: anything already in results.json, sent,
// succeeded or failed, is never sent again; a clip still at the provider is
// only polled.
//   node scripts/blocky/test1LipSync.mjs                      prints the prompts and the plan, sends nothing
//   FRUIT_ALLOW_PAID=1 node scripts/blocky/test1LipSync.mjs   runs it (about $0.86; stage cap $1.00)
import fs from "fs";
import path from "path";
import { openBlockyBudget, paidCallsAllowed } from "../fruit-story/paidGuard.mjs";
import { ROOT, SUPABASE_URL, writeJson } from "../fruit-story/lib.mjs";
import { NO_CUT } from "../../supabase/functions/_shared/fruit/clips.js";
import { toneOf } from "../../supabase/functions/_shared/fruit/wording.js";

const OUT = "data/blocky-tests/test1";
const RESULTS = path.join(ROOT, OUT, "results.json");
const PICTURE = { model: "google:nano-banana@2-lite", width: 768, height: 1376, expectUsd: 0.04, max: 2500 };
const CLIP = { model: "alibaba:wan@2.6-flash", width: 720, height: 1280, durationSec: 5, expectUsd: 0.26, max: 1500 };

// The style lock from docs/roblox-scope.md (Part C5), one block for every picture.
const STYLE = "Style: 3D classic blocky Roblox-style toy avatars: cube heads, rectangular torsos, block arms and legs, smooth matte plastic, simple flat 2D face decals. A chunky low-poly world built from studded bricks. Bright, clean, soft-shadow lighting, playful game-world look. Identical proportions throughout, no extra limbs. No neon purple or cyan cyberpunk look.";
const NEGATIVE = "No text, no letters, no numbers, no captions, no speech bubbles, no name tags, no game interface, no readable writing anywhere, no logos or brand marks (plain unbranded props), no watermark, no extra characters, no realistic human faces, no human skin, no noses, no teeth, no lips.";
// Fruit's framing rule (pictures.js): lip sync needs a big, clear face.
const FACE = "Framing: chest up on the speaker, never a full-body shot; the cube head is a quarter to a third of the frame height, the face decal sharp and clearly visible. Keep the place as a soft background.";

const SMILE = "a classic simple smile decal printed flat on the front of the cube head: two small solid black dot eyes and one thin curved black line for a mouth";
const OPEN = "a flat decal printed on the front of the cube head: two solid black oval eyes and a big open-mouth smile drawn as one solid dark half-circle shape";
const CLOSED = "a flat decal printed on the front of the cube head: two solid black oval eyes and a small closed curved-line mouth";

export const ITEMS = [
  {
    key: "A", face: "Classic smile decal (dot eyes, thin line mouth)",
    line: "Admin command: freeze! Wait... why is everyone actually listening to me?",
    speaker: { name: "Pip", look: "a bright yellow cube head and yellow block arms, a royal blue rectangular torso with one plain white star shape on the chest, green block legs, and a red cap with a flat brim", face: SMILE, voice: "bright, quick, slightly squeaky" },
    emotion: "stunned", action: "throws one block arm forward like giving an order, then freezes and slowly lowers it",
    setting: "a town square spawn area built from chunky studded bricks: a round grey spawn pad on the ground, low brick buildings and blocky green trees, clear daytime sky",
  },
  {
    key: "B", face: "Open-mouth smile decal (oval eyes, half-circle mouth)",
    line: "Break this server rule and you're banned. Forever. No second chances.",
    speaker: { name: "Vex", look: "a white cube head and white block arms, a crimson red rectangular torso with one plain yellow lightning-bolt shape on the chest, black block legs, and a tall black top hat", face: OPEN, voice: "low, slow, flat" },
    emotion: "cold", action: "points one block arm straight at the camera and holds it there",
    setting: "a server lobby hallway built from chunky studded bricks: plain blocky pillars and a row of plain block doors, bright indoor light",
  },
  {
    key: "C", face: "Two avatars; the speaker (left) has the open-mouth decal",
    line: "You traded me a hacked pet? It just ate my whole base!",
    speaker: { name: "Taz", look: "an orange cube head and orange block arms, a navy blue rectangular torso with one plain white circle shape on the chest, grey block legs, and green headphones", face: OPEN, voice: "raspy, loud, fast" },
    listener: { name: "Lux", look: "a sky blue cube head and sky blue block arms, a hot pink rectangular torso with one plain white diamond shape on the chest, white block legs, and a small gold crown", face: CLOSED },
    emotion: "furious", action: "throws both block arms up, then jabs one block arm toward Lux",
    setting: "a trading plaza built from chunky studded bricks: plain market stalls and stacked plain block crates, clear daytime sky",
  },
];

const who = (c) => `${c.name} is a blocky toy avatar with ${c.look}. ${c.name}'s face is ${c.face}.`;

/** Same order as Fruit's picture builder: frame and framing, the speaker, staging, the place, who is who, style, what to leave out. */
export function buildPicturePrompt(it) {
  const s = it.speaker, l = it.listener;
  const parts = [
    `Vertical 9:16 frame. Medium shot. ${FACE}`,
    `${s.name}, a blocky toy avatar, ${it.action.split(",")[0]}, body language ${it.emotion}, mid-sentence, speaking toward the camera.`,
    l
      ? `Staging: ${s.name} stands on the LEFT, closest to the camera, body and face turned toward the camera, large in the frame. ${l.name} stands on the RIGHT, a step further back, slightly smaller, turned toward ${s.name}, listening silently.`
      : `${s.name} is alone in the frame, body and face turned toward the camera.`,
    `Setting: ${it.setting}.`,
    who(s),
    l ? who(l) : "",
    `Only ${l ? "these 2 characters" : "this 1 character"} in the frame.`,
    STYLE,
    NEGATIVE,
  ];
  return parts.filter(Boolean).join(" ");
}

/**
 * Fruit's clip builder (clips.js), sentence for sentence, with "the <fruit>
 * woman/man" replaced by "the blocky toy avatar" and one added rule: the face
 * stays a flat decal. Same no-cut rule, same speaker-faces-camera wording.
 */
export function buildClipPrompt(it) {
  const s = it.speaker, l = it.listener;
  const parts = [
    `${s.name}, the blocky toy avatar ${l ? "on the left, " : ""}facing the camera, says in a ${s.voice} voice, delivered in ${toneOf(it.emotion)}: "${it.line}"`,
    `Only ${s.name} speaks, the flat mouth decal on ${s.name}'s face changing shape in sync with every word.${l ? ` ${l.name}, the blocky toy avatar on the right, stays silent with its mouth decal closed and still, reacting only with small head movements.` : ""}`,
    `${s.name} ${it.action}.`,
    "Camera: a gentle, slow dolly-in.",
    NO_CUT,
    "Keep every character, outfit and the setting exactly as in the first frame. The faces stay flat 2D decals on cube heads: no realistic mouth, teeth, lips, tongue or nose. The bodies stay rigid blocky toys: no bending, warping or melting, no extra limbs, no human skin.",
    `Audio: only ${s.name}'s voice saying the line, with quiet room tone. No music. No subtitles, captions or on-screen text. Plain unbranded props, no logos.`,
  ];
  return parts.join(" ");
}

const pictureTask = (prompt) => ({ taskType: "imageInference", model: PICTURE.model, positivePrompt: prompt, width: PICTURE.width, height: PICTURE.height, numberResults: 1, outputType: "URL", outputFormat: "JPG", outputQuality: 90, deliveryMethod: "sync" });
// The request shape production sends for Wan (clips.js#clipTask).
const clipTask = (prompt, imageUrl) => ({ taskType: "videoInference", model: CLIP.model, positivePrompt: prompt, width: CLIP.width, height: CLIP.height, duration: CLIP.durationSec, numberResults: 1, outputType: "URL", outputFormat: "MP4", providerSettings: { alibaba: { audio: true } }, inputs: { frameImages: [imageUrl] } });

for (const it of ITEMS) {
  it.picturePrompt = buildPicturePrompt(it);
  it.clipPrompt = buildClipPrompt(it);
  if (it.picturePrompt.length > PICTURE.max) throw new Error(`${it.key}: picture prompt ${it.picturePrompt.length} chars, over ${PICTURE.max}`);
  if (it.clipPrompt.length > CLIP.max) throw new Error(`${it.key}: clip prompt ${it.clipPrompt.length} chars, over ${CLIP.max}`);
}

const words = (s) => s.match(/[A-Za-z']+/g).length;
if (!paidCallsAllowed()) {
  for (const it of ITEMS) {
    console.log(`\n=== ${it.key}: ${it.face} ===\nLINE (${words(it.line)} words): ${it.line}\n\nPICTURE (${it.picturePrompt.length} chars):\n${it.picturePrompt}\n\nCLIP (${it.clipPrompt.length} chars):\n${it.clipPrompt}`);
  }
  const est = ITEMS.length * (0.035 + CLIP.durationSec * 0.0504) + 0.002;
  console.log(`\nNothing was sent. Plan: ${ITEMS.length} pictures + ${ITEMS.length} × ${CLIP.durationSec} s clips + transcripts, about $${est.toFixed(2)}. Run with FRUIT_ALLOW_PAID=1 to send.`);
  process.exit(0);
}

const budget = openBlockyBudget("lipsync");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const post = async (fn, body) => (await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
  method: "POST", headers: { Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
})).json().catch(() => ({ ok: false, error: "bad response" }));
const download = async (url, rel) => {
  const file = path.join(ROOT, OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(await (await fetch(url)).arrayBuffer()));
  return rel;
};

const out = fs.existsSync(RESULTS) ? JSON.parse(fs.readFileSync(RESULTS, "utf8")) : { items: {}, notes: [] };
const save = () => writeJson(`${OUT}/results.json`, out);
const log = (m) => { console.log(m); out.notes.push(m); };

for (const it of ITEMS) {
  const row = (out.items[it.key] ??= { key: it.key, face: it.face, line: it.line, words: words(it.line) });

  // 1. The first-frame picture (sync). Marked "sent" before the call so a crash can't send it twice.
  if (!row.picture) {
    budget.reserve(PICTURE.expectUsd, `picture ${it.key}`);
    row.picture = { state: "sent", prompt: it.picturePrompt, model: PICTURE.model, at: new Date().toISOString() };
    save();
    const r = await post("runware-bakeoff-proxy", { task: pictureTask(it.picturePrompt) });
    const res = r.result ?? {};
    if (!r.ok || !res.imageURL) {
      Object.assign(row.picture, { state: "failed", error: JSON.stringify(r.error ?? r).slice(0, 500), cost: Number(res.cost ?? 0) });
    } else {
      Object.assign(row.picture, { state: "success", url: res.imageURL, cost: Number(res.cost ?? 0), seed: res.seed ?? null, latencyMs: r.latencyMs ?? null });
      row.picture.file = await download(res.imageURL, `pic-${it.key}.jpg`);
    }
    budget.record(row.picture.cost, `lipsync picture ${it.key}${row.picture.state === "failed" ? " (failed)" : ""}`, PICTURE.expectUsd);
    save();
    log(`picture ${it.key}: ${row.picture.state} $${row.picture.cost.toFixed(4)}${row.picture.error ? ` · ${row.picture.error}` : ""}`);
  }
  if (row.picture.state !== "success") { log(`clip ${it.key}: skipped, no picture`); continue; }

  // 2. The clip. Submitted once; a clip still at the provider is only polled.
  if (!row.clip) {
    budget.reserve(CLIP.expectUsd, `clip ${it.key}`);
    row.clip = { state: "sent", prompt: it.clipPrompt, model: CLIP.model, durationSec: CLIP.durationSec, at: new Date().toISOString() };
    save();
    const sub = await post("fruit-worker", { action: "raw_test", task: clipTask(it.clipPrompt, row.picture.url), label: `blocky-lipsync-${it.key}` });
    if (!sub.ok || !sub.taskUUID) {
      Object.assign(row.clip, { state: "refused", error: String(sub.error ?? sub.message ?? sub.code ?? "refused").slice(0, 500), cost: 0, callId: sub.callId ?? null });
      budget.record(0, `lipsync clip ${it.key} refused`, CLIP.expectUsd);
      save();
      log(`clip ${it.key}: refused · ${row.clip.error}`);
      continue;
    }
    Object.assign(row.clip, { state: "pending", taskUUID: sub.taskUUID, callId: sub.callId });
    save();
  }
  if (row.clip.state === "pending") {
    const t0 = Date.now();
    let r = { state: "pending" };
    while (r.state === "pending" && Date.now() - t0 < 15 * 60_000) {
      await sleep(10_000);
      r = await post("fruit-worker", { action: "raw_poll", taskUUID: row.clip.taskUUID, callId: row.clip.callId });
      r.state ??= "pending";
    }
    if (r.state === "pending") { log(`clip ${it.key}: still at the provider after 15 min; run again to keep polling (nothing is re-sent)`); continue; }
    Object.assign(row.clip, { state: r.state, url: r.url ?? null, cost: Number(r.cost ?? 0), error: r.error ?? null, seconds: Math.round((Date.now() - new Date(row.clip.at).getTime()) / 1000) });
    if (r.url) row.clip.file = await download(r.url, `clips/${it.key}.mp4`);
    budget.record(row.clip.cost, `lipsync clip ${it.key}${r.state === "error" ? " (failed)" : ""}`, CLIP.expectUsd);
    save();
    log(`clip ${it.key}: ${r.state} $${row.clip.cost.toFixed(4)} = $${(row.clip.cost / CLIP.durationSec).toFixed(4)}/s${r.error ? ` · ${r.error}` : ""}`);
  }
}

// 3. Speech-to-text with word times (whisper-1, about $0.0005 per clip), once per clip.
const toHear = Object.values(out.items).filter((r) => r.clip?.file && !r.heard);
if (toHear.length) {
  budget.reserve(0.01, "transcripts");
  for (const row of toHear) {
    const form = new FormData();
    form.append("file", new Blob([fs.readFileSync(path.join(ROOT, OUT, row.clip.file))], { type: "video/mp4" }), "clip.mp4");
    form.append("model", "whisper-1");
    form.append("language", "en");
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "word");
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: form });
    const j = await res.json().catch(() => ({}));
    row.heard = { text: j.text ?? `(HTTP ${res.status} ${j.error?.message ?? ""})`, words: (j.words ?? []).map((w) => ({ w: w.word, s: w.start, e: w.end })), audioSec: j.duration ?? null };
    save();
    log(`clip ${row.key} heard: ${row.heard.text}`);
  }
  budget.record(toHear.length * 0.0005, "lipsync transcripts (whisper-1)", 0.01);
}

out.spentStage = budget.spentStage();
out.spentTotal = budget.spentTotal();
save();
console.log(budget.summary());
