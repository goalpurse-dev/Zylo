// IP art replacement (Home/template assets). Generates ORIGINAL art with Nano
// Banana 2 Lite (google:nano-banana@2-lite via runware-bakeoff-proxy, the key
// never leaves the server), upscales where needed (runware:504@1, 2x) and
// fits each image to the original's exact size and format. Nothing in
// public/ is touched: originals are copied to art-backup/ip-originals/, new
// art goes to art-review/ip-replacements/ until the contact sheet is approved.
// One attempt per image, never retried; hard stop at the spend cap.
//   node --env-file=.env.local scripts/ipArtReplace.mjs --dry-run
//   node --env-file=.env.local scripts/ipArtReplace.mjs
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const DRY = process.argv.includes("--dry-run");
const CAP_USD = 1.5;
const GEN_USD = 0.0337, UP_USD = 0.0006; // measured (docs/cost-model.md)
const FFMPEG = process.env.FFMPEG ?? "ffmpeg";
const PROXY = `${process.env.SUPABASE_URL}/functions/v1/runware-bakeoff-proxy`;
const NO_IP = "Entirely original design. No text, no letters, no numbers, no logos, no brands, no watermark, no real people, no existing characters.";
const NIGHT = `Cinematic stylized digital illustration, 2 AM at night, moody moonlight and warm window lights, rich colors, highly detailed, vertical composition. ${NO_IP}`;
const FACE = (who) => `Photoreal studio product photo: a glossy, wet-look sculpted human face of ${who}, completely fictional person, mounted flat on a clean white marble surface, viewed head-on from above, soft even studio light, sharp focus. ${NO_IP}`;
const STYLE = (look) => `${look} ${NO_IP}`;

// target: [width, height] of the original; gen: generation size (1K); up: 2x upscale first.
const P = "9:16", S = "1:1", L = "16:9";
const GEN = { [P]: [768, 1376], [S]: [1024, 1024], [L]: [1376, 768] };
const JOBS = [
  // 2AM Worlds: preview + the two demo sets (renamed from franchise names).
  { src: "public/template/2am-world/preview.png", out: "public/template/2am-world/preview.png", target: [2048, 2048], gen: S, up: true,
    prompt: `A small fluffy mint-green creature with rounded ears and a tiny leaf sprout on its head, sitting alone on a wooden bench on a quiet seaside street, palm trees, a crescent moon, warm streetlamps, cozy and a little lonely. Cinematic stylized digital illustration, 2 AM at night. ${NO_IP}` },
  ...[
    "view through an old wooden temple gate onto a misty mountain town of curved tiled rooftops, paper lanterns, a crescent moon",
    "a narrow rain-soaked alley in a mountain ninja city, glowing paper lanterns and hanging cloth banners with abstract patterns, a lone hooded figure walking away",
    "a rooftop training yard with wooden practice posts and bamboo, moonlight, distant pagodas on the mountainside",
    "a tiny noodle stall under a pagoda, steam rising from the pots, warm light, empty stools, the town asleep",
    "a stone bridge over a koi river, lanterns reflected in the water, drifting blossom petals",
    "inside a quiet dojo, moonlight through paper screens, a folded dark uniform and a wooden practice sword on a stand",
    "a cliffside monastery beside a waterfall, fireflies, a small figure sitting on the ledge looking at the stars",
  ].map((scene, i) => ({ src: `public/template/2am-world/ninjago (${i + 1}).png`, out: `public/template/2am-world/mountain-ninja-city (${i + 1}).png`, target: [1536, 2752], gen: P, up: true, prompt: `An original mountain ninja city: ${scene}. ${NIGHT}` })),
  ...[
    "a child's bedroom window overlooking a sleeping seaside town, a small round blue creature with leaf-shaped ears asleep on the windowsill",
    "an empty clinic corridor in soft blue light, a small fluffy orange creature curled up on a waiting bench",
    "a seaside boardwalk with closed snack stands, a tiny glowing jellyfish-like creature floating above the dark water",
    "a small train station platform, a round green moss creature with big eyes waiting under a flickering lamp",
    "a corner shop with warm light, a chubby cloud-like creature pressing its face against the glass door",
    "a lighthouse on the rocks with waves below, a small fox-like creature with a star-shaped tail sitting on the rocks",
  ].map((scene, i) => ({ src: `public/template/2am-world/pokemon (${i + 2}).png`, out: `public/template/2am-world/seaside-creature-town (${i + 2}).png`, target: [1536, 2752], gen: P, up: true, prompt: `An original seaside town of friendly creatures: ${scene}. ${NIGHT}` })),
  // 30 Days: its own preview (today it borrows the 2AM image).
  { src: null, out: "public/template/thirty-days/preview.png", target: [2048, 2048], gen: S, up: true,
    prompt: `A young traveler with a backpack stepping through a glowing doorway into a vivid original fantasy world of floating islands, waterfalls and small castles, sunrise light, cinematic stylized 3D illustration. ${NO_IP}` },
  // Face ASMR: fictional faces (same marble set-up).
  ...[
    ["ronaldo", "face-01", "a man in his thirties with short dark hair and a confident smile"],
    ["messi", "face-02", "a bearded man in his thirties with light brown hair"],
    ["neymar", "face-03", "a young man with curly dark hair"],
    ["mbappe", "face-04", "a young man with a shaved head and a wide grin"],
    ["haaland", "face-05", "a young man with long blond hair tied back"],
    ["billie", "face-06", "a young woman with short dark hair and freckles"],
    ["ariana", "face-07", "a young woman with a high ponytail"],
    ["taylor", "face-08", "a young woman with a blonde bob and bangs"],
    ["the rock", "face-09", "a bald man with a strong jaw and thick eyebrows"],
  ].map(([old, name, who]) => ({ src: `public/face/${old}.png`, out: `public/face/${name}.png`, target: [768, 1376], gen: P, up: false, prompt: FACE(who) })),
  { src: "public/face/neypreview.png", out: "public/face/face-preview.png", target: [1376, 768], gen: L, up: false, prompt: FACE("a young man with curly dark hair, the face placed in the center of a wide landscape frame") },
  // Nationality Swap -> Kit Swap.
  { src: "public/template/nationality-swap/preview.png", out: "public/template/kit-swap/preview.png", target: [1254, 1254], gen: S, up: true,
    prompt: `Photoreal portrait of a fictional smiling football player in a plain white and green football kit with no badge, no crest and no sponsor, holding a blank white card in front of his chest, stadium floodlights at night behind him. ${NO_IP}` },
  // Popular Styles + image-generator style thumbnails (renamed).
  { src: "public/styles/lego2.webp", out: "public/styles/brick-toy.webp", target: [1024, 1024], gen: S, up: false, prompt: STYLE("A plastic toy figure made of interlocking toy bricks, an original character in a red jacket, standing beside a brick-built toy car on a rain-soaked neon city street at night, glossy plastic toy look, cinematic.") },
  { src: "public/styles/minecraft2.webp", out: "public/styles/voxel-world.webp", target: [1024, 1024], gen: S, up: false, prompt: STYLE("A bright blocky voxel landscape made of cubes: cube trees, a cube river and a small cube-shaped explorer character with a green backpack, sunny day, clean 3D voxel art.") },
  { src: "public/styles/disney2.webp", out: "public/styles/classic-3d-animation.webp", target: [1024, 1024], gen: S, up: false, prompt: STYLE("An elderly man and his loyal dog sitting on a cozy sofa in warm lamplight, classic 3D animated feature film look, soft shading, friendly rounded proportions.") },
  { src: "public/styles/ghibli2.webp", out: "public/styles/hand-painted-anime.webp", target: [1024, 1024], gen: S, up: false, prompt: STYLE("A girl in a straw hat reading a book on a grassy hill above a green valley with a river and a small village, fluffy summer clouds, hand-painted anime background art, soft watercolor light.") },
  { src: "public/images/thumbs/lego.webp", out: "public/images/thumbs/brick-toy.webp", target: [1536, 1024], gen: L, up: true, prompt: STYLE("A plastic toy figure made of interlocking toy bricks, an original character in a blue jacket, next to a brick-built toy car in a glossy toy city at golden hour, plastic toy look.") },
  { src: "public/images/thumbs/minecraft.webp", out: "public/images/thumbs/voxel-world.webp", target: [1024, 1024], gen: S, up: false, prompt: STYLE("A blocky voxel forest made of cubes with a small cube-shaped explorer holding a lantern, clean 3D voxel art, soft daylight.") },
  { src: "public/images/thumbs/disney.webp", out: "public/images/thumbs/classic-3d-animation.webp", target: [1536, 1024], gen: L, up: true, prompt: STYLE("A cheerful young inventor and a small round robot in a sunny workshop, classic 3D animated feature film look, soft shading, friendly rounded proportions.") },
  { src: "public/images/thumbs/ghibli.webp", out: "public/images/thumbs/hand-painted-anime.webp", target: [1536, 1024], gen: L, up: true, prompt: STYLE("A girl in a red dress sketching under a big tree on a hillside above a valley with a winding river and a small village, hand-painted anime background art, watercolor light.") },
];

const upCount = JOBS.filter((j) => j.up).length;
const estimate = JOBS.length * GEN_USD + upCount * UP_USD;
console.log(`${JOBS.length} images (${upCount} upscaled) · estimate $${estimate.toFixed(3)} · cap $${CAP_USD}`);
if (DRY) { for (const j of JOBS) console.log(`${j.gen} ${j.target.join("x")}${j.up ? " (2x up)" : ""}  ${j.src ?? "(new)"} -> ${j.out}`); process.exit(0); }

const call = async (task) => {
  const r = await fetch(PROXY, { method: "POST", headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ task }) });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) throw new Error(JSON.stringify(j.error ?? j).slice(0, 300));
  return j.result;
};
const download = async (url, file) => { const r = await fetch(url); if (!r.ok) throw new Error(`download ${r.status}`); fs.writeFileSync(file, Buffer.from(await r.arrayBuffer())); };

const BACKUP = "art-backup/ip-originals", REVIEW = "art-review/ip-replacements", TMP = path.join(process.env.TEMP ?? "/tmp", "ip-art");
fs.mkdirSync(TMP, { recursive: true });
let spent = 0;
const report = [];
for (const [n, job] of JOBS.entries()) {
  if (job.src) { const b = path.join(BACKUP, job.src.replace(/^public\//, "")); fs.mkdirSync(path.dirname(b), { recursive: true }); if (!fs.existsSync(b)) fs.copyFileSync(job.src, b); }
  const next = GEN_USD + (job.up ? UP_USD : 0);
  if (spent + next > CAP_USD) { report.push({ ...job, status: "skipped (cap)" }); continue; }
  try {
    const [gw, gh] = GEN[job.gen];
    const gen = await call({ taskType: "imageInference", model: "google:nano-banana@2-lite", width: gw, height: gh, numberResults: 1, outputType: "URL", outputFormat: "PNG", positivePrompt: job.prompt });
    spent += Number(gen.cost ?? GEN_USD);
    let url = gen.imageURL, cost = Number(gen.cost ?? GEN_USD);
    if (job.up) {
      const up = await call({ taskType: "upscale", model: "runware:504@1", upscaleFactor: 2, inputs: { image: url }, outputType: "URL", outputFormat: "PNG" });
      spent += Number(up.cost ?? UP_USD); cost += Number(up.cost ?? UP_USD); url = up.imageURL;
    }
    const raw = path.join(TMP, `${n}.png`);
    await download(url, raw);
    // Exact original size: scale to cover, center-crop, then the original's format.
    const [W, H] = job.target;
    const out = path.join(REVIEW, job.out.replace(/^public\//, ""));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const fmt = out.endsWith(".webp") ? ["-c:v", "libwebp", "-quality", "86"] : [];
    execFileSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", "-i", raw, "-vf", `scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W}:${H}`, "-frames:v", "1", ...fmt, out]);
    report.push({ ...job, status: "ok", cost: Number(cost.toFixed(4)) });
    console.log(`${n + 1}/${JOBS.length} ok $${cost.toFixed(4)}  ${job.out}`);
  } catch (e) {
    report.push({ ...job, status: `failed: ${e.message}` });
    console.log(`${n + 1}/${JOBS.length} FAILED  ${job.out}: ${e.message}`);
  }
}
fs.mkdirSync(REVIEW, { recursive: true });
fs.writeFileSync(path.join(REVIEW, "report.json"), JSON.stringify({ spentUsd: Number(spent.toFixed(4)), jobs: report.map(({ prompt, ...r }) => r) }, null, 1));
console.log(`spent $${spent.toFixed(4)} · ok ${report.filter((r) => r.status === "ok").length}/${JOBS.length}`);
