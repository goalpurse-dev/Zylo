// Zyvo Studio reuse (owner, 2026-10-30): everything one short video needs from a REUSED finished creation, made on the
// laptop at $0 and read-only on the database:
//   - its final video (downloaded), its own words (local whisper), its cuts, its frames upscaled 2x (Real-ESRGAN)
//   - its moments: the ending (the last clean shot) and frame 0 (the strongest earlier shot); a shot whose words name
//     a third-party brand is never used
//   - its step cards (kitCards.py): the real menu path, its input re-entered on the internal account (free, nothing
//     submitted), its real scene pictures, clips and final video
//   node studioKit.mjs <fruit story id> <kits dir>          writes <kits dir>/<id>/kit.json (+ work/ with cards, wall)
// env: PICS_DIR (the real-output pool), SRC_WORK (the recorded nav cards + wall), ESRGAN_DIR
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { admin } from "file:///C:/Users/Public/Zylo/scripts/blocky/lib.mjs";
import { BRANDS, pickMoments } from "./moments.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
async function main() {
  const [id, KITS] = process.argv.slice(2);
  const PICS = process.env.PICS_DIR, SRC_WORK = process.env.SRC_WORK, ESRGAN = process.env.ESRGAN_DIR;
  if (!id || !KITS || !PICS || !SRC_WORK) { console.error("usage: PICS_DIR=… SRC_WORK=… [ESRGAN_DIR=…] node studioKit.mjs <story id> <kits dir>"); process.exit(2); }
  const db = admin();
  const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data; };
  const story = must(await db.from("fruit_stories").select("id, title, input, length_sec, final_url, final_status, cast_ids").eq("id", id).single(), "story");
  if (story.final_status !== "ready" || !story.final_url) throw new Error("that story has no finished video");
  const scenes = must(await db.from("fruit_story_scenes").select("idx, line, image_url, clip_url, clip_status").eq("story_id", id).order("idx"), "scenes");
  const idea = story.input?.ideaId ? must(await db.from("fruit_ideas").select("title, summary").eq("id", story.input.ideaId).maybeSingle(), "idea") : null;
  const rel = `video/studio/${id}`, vdir = path.join(PICS, rel), kdir = path.join(KITS, id);
  fs.mkdirSync(path.join(vdir, "src_png"), { recursive: true }); fs.mkdirSync(path.join(vdir, "hq"), { recursive: true }); fs.mkdirSync(path.join(kdir, "media"), { recursive: true });
  const get = async (url, file) => { if (fs.existsSync(file)) return file; const r = await fetch(url); if (!r.ok) throw new Error(`download ${r.status}: ${url.slice(0, 80)}`); fs.writeFileSync(file, Buffer.from(await r.arrayBuffer())); return file; };
  const step = (what) => console.log(`[kit] ${what}`);

  step("the final video, its words, its cuts");
  const final = await get(story.final_url, path.join(vdir, "final.mp4"));
  const duration = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", final]).toString().trim());
  const wordsFile = path.join(vdir, "words.json");
  if (!fs.existsSync(wordsFile)) execFileSync("python", [path.join(HERE, "transcribe.py"), final, wordsFile], { stdio: "inherit" });
  const words = JSON.parse(fs.readFileSync(wordsFile, "utf8")).segments.flatMap((s) => s.words);
  const raw = spawnSync("ffmpeg", ["-v", "info", "-i", final, "-vf", "select='gt(scene,0.2)',showinfo", "-an", "-f", "null", "-"], { encoding: "utf8", maxBuffer: 1 << 26 }).stderr ?? "";   // showinfo writes to stderr
  const cuts = [...raw.matchAll(/pts_time:([\d.]+)/g)].map((m) => Number(m[1]));
  // the sound, in 50 ms steps
  const pcm = execFileSync("ffmpeg", ["-v", "error", "-i", final, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], { maxBuffer: 1 << 28 });
  const A = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.length / 4), hop = 800;
  const db50 = []; for (let i = 0; i + hop <= A.length; i += hop) { let e = 0; for (let k = i; k < i + hop; k++) e += A[k] * A[k]; db50.push(10 * Math.log10(e / hop + 1e-12)); }
  const level = (a, b) => Math.max(-90, ...db50.slice(Math.floor(a * 20), Math.ceil(b * 20)));
  const lastSound = (a, b) => { for (let k = Math.ceil(b * 20) - 1; k >= Math.floor(a * 20); k--) if (db50[k] > -35) return (k + 1) / 20; return b; };
  const moments = pickMoments({ cuts, words, duration, level, lastSound });
  console.log(`[kit] open ${moments.open.in}–${moments.open.out} "${moments.open.text}" | ending ${moments.ending.in}–${moments.ending.out} "${moments.ending.text}"`);

  step("its frames, upscaled 2x (local)");
  if (!fs.readdirSync(path.join(vdir, "src_png")).length) execFileSync("ffmpeg", ["-v", "error", "-y", "-i", final, "-vf", "fps=30", path.join(vdir, "src_png", "f%05d.png")]);
  const nsrc = fs.readdirSync(path.join(vdir, "src_png")).length;
  if (fs.readdirSync(path.join(vdir, "hq")).length < nsrc) {
    if (ESRGAN) execFileSync(path.join(ESRGAN, "realesrgan-ncnn-vulkan.exe"), ["-i", path.join(vdir, "src_png"), "-o", path.join(vdir, "hq"), "-n", "realesr-animevideov3", "-s", "2", "-f", "png"], { cwd: ESRGAN, stdio: "ignore" });
    else for (const f of fs.readdirSync(path.join(vdir, "src_png"))) execFileSync("ffmpeg", ["-v", "error", "-y", "-i", path.join(vdir, "src_png", f), "-vf", "scale=iw*2:ih*2:flags=lanczos", path.join(vdir, "hq", f)]);
  }

  step("its input re-entered on the internal account (free, nothing submitted)");
  const inputDir = path.join(kdir, "input");
  const ideaText = idea ? `${idea.summary}` : story.input?.prompt ?? story.title;
  const lengthLabel = story.length_sec <= 22 ? "20 sec" : story.length_sec <= 37 ? "30 sec" : story.length_sec <= 52 ? "45 sec" : "1 min";
  if (!fs.existsSync(path.join(inputDir, "input.json"))) execFileSync("node", [path.join(HERE, "capture", "inputCapture.mjs"), inputDir, ideaText, lengthLabel, idea?.title ?? ""], { stdio: "inherit" });

  step("its scene pictures, clips and final frame");
  const clean = scenes.filter((s) => !BRANDS.test(s.line ?? ""));
  const imgs = [], stills = [];
  for (const s of clean) {
    if (s.image_url) imgs.push(await get(s.image_url, path.join(kdir, "media", `scene${s.idx}.${(s.image_url.split("?")[0].split(".").pop() || "png").slice(0, 4)}`)));
    if (s.clip_url && s.clip_status === "ready") {
      const clip = await get(s.clip_url, path.join(kdir, "media", `clip${s.idx}.mp4`)), still = path.join(kdir, "media", `clip${s.idx}.jpg`);
      if (!fs.existsSync(still)) { const d = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", clip]).toString().trim()) || 2; execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(d / 2), "-i", clip, "-frames:v", "1", "-q:v", "2", still]); }
      stills.push(still);
    }
  }
  const finalStill = path.join(kdir, "media", "final.jpg");
  execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(moments.ending.in + 0.5), "-i", final, "-frames:v", "1", "-q:v", "2", finalStill]);
  const work = path.join(kdir, "work"); fs.mkdirSync(work, { recursive: true });
  const kit = {
    template: "ai_fruit_story", story: { id, title: story.title, length_sec: story.length_sec, idea: idea?.title ?? null, idea_text: ideaText, source: story.input?.source },
    file: `${rel}/final.mp4`, hq_dir: `${rel}/hq`, words: wordsFile, duration: +duration.toFixed(2), frames: nsrc, moments, measured: null,
    input: JSON.parse(fs.readFileSync(path.join(inputDir, "input.json"), "utf8")).how,
    nav_cards: path.join(SRC_WORK, "cards"), input_dir: inputDir, scene_images: imgs.slice(0, 6), clip_stills: stills.slice(0, 10), final_still: finalStill,
  };
  fs.writeFileSync(path.join(kdir, "kit.json"), JSON.stringify(kit, null, 1));
  execFileSync("python", [path.join(HERE, "kitCards.py"), path.join(kdir, "kit.json"), path.join(work, "cards")], { stdio: "inherit" });
  fs.copyFileSync(path.join(SRC_WORK, "wall.json"), path.join(work, "wall.json"));
  console.log(`[kit] ready: ${path.join(kdir, "kit.json")}`);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await main().then(() => new Promise((r) => setTimeout(r, 300)));
