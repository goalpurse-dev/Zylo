// Blocky Stories menu thumbnail: two options on Nano Banana 2 Lite (9:16),
// as test pictures on blocky-worker (no user charge). One attempt each, never re-sent.
// The chosen one is cropped to the size of the other template thumbnails
// (880×1168 PNG, like AI Cooking Matic's) by --pick.
//   node scripts/blocky/thumbnails.mjs                         prints the prompts, sends nothing
//   BLOCKY_ALLOW_PAID=1 node scripts/blocky/thumbnails.mjs      makes the two options (about $0.07; stage cap $0.15)
//   node scripts/blocky/thumbnails.mjs --pick 1 <ffmpegPath>   writes public/templates/BLOCKY/thumbnail.png from option 1
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { openBlockyBudget, paidCallsAllowed } from "./paidGuard.mjs";
import { ROOT, rawTest, writeJson } from "./lib.mjs";
import { PICTURE } from "../../supabase/functions/_shared/blocky/look.js";

const OUT = "data/blocky-tests/thumb";
const RESULTS = path.join(ROOT, OUT, "results.json");
const FACE_B = "a flat decal printed on the front of the cube head: two solid black oval eyes and a big open-mouth shape drawn as one solid dark half-circle";
const FRAME = "Vertical 9:16 frame. Both characters fill the middle of the frame, chest up, cube heads large and sharp, faces toward the camera; nothing important in the top or bottom fifth of the frame.";
const OPTIONS = [
  {
    key: "1", name: "Shock and smug",
    scene: "Two blocky game avatars side by side, reacting to each other. The left one throws both block arms up in shock, flat eyebrow lines raised high. The right one leans in with a smug look, one block arm pointing at the left one, flat eyebrow lines tilted. The left avatar has a lime green cube head and arms, a white torso with one plain black lightning-bolt shape and black legs. The right avatar has a bright orange cube head and arms, a navy blue torso with one plain white star shape and grey legs, and wears a small gold crown.",
    setting: "a bright trading plaza built from smooth matte plastic blocks and simple geometric parts, plain market stalls and stacked plain crates soft in the background, clear daytime sky",
  },
  {
    key: "2", name: "The reveal",
    scene: "Two blocky game avatars close together, reacting to each other. The one in front holds up a plain glowing golden cube in one block hand and grins. The one just behind looks over its shoulder, both block arms raised, flat eyebrow lines slanted in panic. The front avatar has a sky blue cube head and arms, a hot pink torso with one plain white diamond shape and white legs. The back avatar has a bright yellow cube head and arms, a royal blue torso with one plain white circle shape and green legs.",
    setting: "a bright obby course built from smooth matte plastic blocks and simple geometric parts, floating coloured platforms and a soft glowing lava floor far below, clear daytime sky",
  },
];
for (const o of OPTIONS) {
  o.prompt = [FRAME, o.scene, `Each avatar's face is ${FACE_B}.`, `Setting: ${o.setting}.`, "Only these 2 characters in the frame.", PICTURE.style, PICTURE.negative].join(" ");
}

const args = process.argv.slice(2);
if (args[0] === "--pick") {
  const [, key, ffmpeg] = args;
  const src = path.join(ROOT, OUT, `option-${key}.jpg`);
  const dest = path.join(ROOT, "public/templates/BLOCKY/thumbnail.png");
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  // 768×1376 → the middle 768×1019 (3:4) → 880×1168, the size of the other template thumbnails.
  execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-i", src, "-vf", "crop=768:1019:0:(ih-1019)/2,scale=880:1168:flags=lanczos", "-frames:v", "1", dest]);
  console.log("written", path.relative(ROOT, dest), `${Math.round(fs.statSync(dest).size / 1024)} KB`);
  process.exit(0);
}

if (!paidCallsAllowed()) {
  for (const o of OPTIONS) console.log(`\n=== option ${o.key}: ${o.name} (${o.prompt.length} chars) ===\n${o.prompt}`);
  console.log("\nNothing was sent. 2 pictures, about $0.07. Run with BLOCKY_ALLOW_PAID=1 to send.");
  process.exit(0);
}

const budget = openBlockyBudget("thumb");
const out = fs.existsSync(RESULTS) ? JSON.parse(fs.readFileSync(RESULTS, "utf8")) : { items: {} };
const save = () => writeJson(`${OUT}/results.json`, out);
for (const o of OPTIONS) {
  if (out.items[o.key]) continue;   // one attempt per option
  budget.reserve(0.04, `thumbnail ${o.key}`);
  const row = (out.items[o.key] = { key: o.key, name: o.name, prompt: o.prompt, state: "sent", at: new Date().toISOString() });
  save();
  const r = await rawTest({ taskType: "imageInference", model: "google:nano-banana@2-lite", positivePrompt: o.prompt, width: 768, height: 1376, numberResults: 1, outputType: "URL", outputFormat: "JPG", outputQuality: 95 }, `blocky-thumb-${o.key}`);
  if (r.state !== "success") Object.assign(row, { state: "failed", error: String(r.error).slice(0, 400), cost: r.cost });
  else {
    Object.assign(row, { state: "success", url: r.url, cost: r.cost, file: `option-${o.key}.jpg` });
    fs.writeFileSync(path.join(ROOT, OUT, row.file), Buffer.from(await (await fetch(r.url)).arrayBuffer()));
  }
  budget.record(row.cost, `thumbnail ${o.key}${row.state === "failed" ? " (failed)" : ""}`, 0.04);
  save();
  console.log(`option ${o.key}: ${row.state} $${row.cost.toFixed(4)}${row.error ? ` · ${row.error}` : ""}`);
}
console.log(budget.summary());
