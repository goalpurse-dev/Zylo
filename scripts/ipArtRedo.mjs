// IP art redos (after review): face-01 as a clearly different, non-famous
// person, and "Toy Diorama" (replaces Brick Toy; no minifigure shape). One
// Toy Diorama image serves both style sizes (1024 card + 1536x1024 thumb).
// Output goes to art-review/ip-replacements/ like the main batch. One attempt
// each, never retried; estimate 2 x $0.0336 + 1 x $0.0006.
//   FFMPEG=... node --env-file=.env.local scripts/ipArtRedo.mjs
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const FFMPEG = process.env.FFMPEG ?? "ffmpeg";
const PROXY = `${process.env.SUPABASE_URL}/functions/v1/runware-bakeoff-proxy`;
const REVIEW = "art-review/ip-replacements";
const NO_IP = "Entirely original design. No text, no letters, no numbers, no logos, no brands, no watermark, no real people, no existing characters.";
const call = async (task) => {
  const r = await fetch(PROXY, { method: "POST", headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ task }) });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) throw new Error(JSON.stringify(j.error ?? j).slice(0, 300));
  return j.result;
};
const download = async (url, file) => { const r = await fetch(url); fs.writeFileSync(file, Buffer.from(await r.arrayBuffer())); };
const fit = (src, out, w, h) => {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const fmt = out.endsWith(".webp") ? ["-c:v", "libwebp", "-quality", "86"] : [];
  execFileSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", "-i", src, "-vf", `scale=${w}:${h}:force_original_aspect_ratio=increase:flags=lanczos,crop=${w}:${h}`, "-frames:v", "1", ...fmt, out]);
};
const TMP = path.join(process.env.TEMP ?? "/tmp", "ip-art-redo"); fs.mkdirSync(TMP, { recursive: true });
let spent = 0;

// 1. face-01: a clearly different, non-famous person (older, different hair and features).
const face = await call({ taskType: "imageInference", model: "google:nano-banana@2-lite", width: 768, height: 1376, numberResults: 1, outputType: "URL", outputFormat: "PNG",
  positivePrompt: `Photoreal studio product photo: a glossy, wet-look sculpted human face of a completely fictional, ordinary man in his late fifties with a round face, a grey beard, receding silver hair and small reading-glasses marks on the nose, mounted flat on a clean white marble surface, viewed head-on from above, soft even studio light, sharp focus. ${NO_IP}` });
spent += Number(face.cost ?? 0.0336);
await download(face.imageURL, path.join(TMP, "face.png"));
fit(path.join(TMP, "face.png"), `${REVIEW}/face/face-01.png`, 768, 1376);
console.log(`face-01 ok $${Number(face.cost ?? 0).toFixed(4)}`);

// 2. Toy Diorama: generic vinyl/clay figures in a diorama (no brick-toy figure shape).
const toy = await call({ taskType: "imageInference", model: "google:nano-banana@2-lite", width: 1376, height: 768, numberResults: 1, outputType: "URL", outputFormat: "PNG",
  positivePrompt: `A miniature toy diorama: small soft vinyl and clay toy figures with rounded bean-shaped bodies and simple dot eyes, having a picnic in a tiny handmade park with felt trees, a paper river and a little wooden bridge, tilt-shift macro photo, warm soft light. ${NO_IP}` });
spent += Number(toy.cost ?? 0.0336);
const up = await call({ taskType: "upscale", model: "runware:504@1", upscaleFactor: 2, inputs: { image: toy.imageURL }, outputType: "URL", outputFormat: "PNG" });
spent += Number(up.cost ?? 0.0006);
await download(up.imageURL, path.join(TMP, "toy.png"));
fit(path.join(TMP, "toy.png"), `${REVIEW}/styles/toy-diorama.webp`, 1024, 1024);
fit(path.join(TMP, "toy.png"), `${REVIEW}/images/thumbs/toy-diorama.webp`, 1536, 1024);
for (const old of [`${REVIEW}/styles/brick-toy.webp`, `${REVIEW}/images/thumbs/brick-toy.webp`]) if (fs.existsSync(old)) fs.renameSync(old, old.replace(".webp", ".rejected.webp"));
console.log(`toy-diorama ok $${(Number(toy.cost ?? 0) + Number(up.cost ?? 0)).toFixed(4)}`);
console.log(`spent $${spent.toFixed(4)}`);
