// Zyvo Studio reuse (owner, 2026-10-30; templates 2026-11-01): everything one short video needs from a REUSED finished
// creation of any template, made on the laptop at $0 and read-only on the database:
//   - its final video (downloaded; a long one: one segment), its own words (local whisper), its cuts (or, in one
//     continuous shot, its sentences), its frames (upscaled 2x when the source is small)
//   - its moments; a shot whose words name a third-party brand is never used
//   - its input re-entered on the internal account (free, nothing submitted) + a few of its real pictures
//   node studioKit.mjs <creation id> <kits dir> [template, default ai_fruit_story]   writes <kits dir>/<id>/kit.json + media/
// env: PICS_DIR (the real-output pool), SRC_WORK (the recorded nav cards + wall), ESRGAN_DIR
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { admin } from "file:///C:/Users/Public/Zylo/scripts/blocky/lib.mjs";
import { BRANDS, pickMoments } from "./moments.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LONG_SEGMENT = { from: 45, secs: 40 };   // a long video: one lively stretch after its opening

async function creation(db, template, id) {
  const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data; };
  const signed = async (bucket, p) => must(await db.storage.from(bucket).createSignedUrl(p, 3600), "signed url").signedUrl;
  if (template === "ai_fruit_story" || template === "blocky_stories") {
    const t = template === "ai_fruit_story" ? "fruit" : "blocky";
    const s = must(await db.from(`${t}_stories`).select("id, title, input, length_sec, final_url, final_status").eq("id", id).single(), "story");
    if (s.final_status !== "ready" || !s.final_url) throw new Error("that story has no finished video");
    const scenes = must(await db.from(`${t}_story_scenes`).select("idx, line, image_url, clip_url, clip_status").eq("story_id", id).order("idx"), "scenes");
    const idea = s.input?.ideaId ? (await db.from(`${t}_ideas`).select("title, summary").eq("id", s.input.ideaId).maybeSingle()).data : null;
    return { title: s.title, length_sec: s.length_sec, url: s.final_url, scenes, idea_title: idea?.title ?? null, idea_text: idea?.summary ?? s.input?.prompt ?? s.title };
  }
  if (template === "cutaway") {
    const r = must(await db.from("cutaway_runs").select("id, env, user_id, topic, title, status, length_sec").eq("id", id).single(), "run");
    if (r.status !== "done") throw new Error("that video isn't finished");
    return { title: r.title ?? r.topic, length_sec: r.length_sec, url: await signed("cutaway-renders", `${r.env}/${r.user_id}/${r.id}/web.mp4`), scenes: [], idea_title: r.topic, idea_text: r.topic };
  }
  if (template === "long_form") {
    const p = must(await db.from("long_form_projects").select("id, topic, selected_title, status, final_video_path, final_video_proxy_path, resolved_length_minutes").eq("id", id).single(), "project");
    const file = p.final_video_proxy_path ?? p.final_video_path; if (p.status !== "complete" || !file) throw new Error("that project has no finished video");
    return { title: p.selected_title ?? p.topic, length_sec: LONG_SEGMENT.secs, url: await signed("long-form-renders", file), scenes: [], idea_title: null, idea_text: p.selected_title ?? p.topic, long: true };
  }
  throw new Error(`no kit for template ${template}`);
}

async function main() {
  const [id, KITS, template = "ai_fruit_story"] = process.argv.slice(2);
  const PICS = process.env.PICS_DIR, SRC_WORK = process.env.SRC_WORK, ESRGAN = process.env.ESRGAN_DIR;
  if (!id || !KITS || !PICS || !SRC_WORK) { console.error("usage: PICS_DIR=… SRC_WORK=… [ESRGAN_DIR=…] node studioKit.mjs <id> <kits dir> [template]"); process.exit(2); }
  const c = await creation(admin(), template, id);
  const rel = `video/studio/${id}`, vdir = path.join(PICS, rel), kdir = path.join(KITS, id), hq = path.join(vdir, "hq"), src = path.join(vdir, "src_png");
  for (const d of [src, hq, path.join(kdir, "media")]) fs.mkdirSync(d, { recursive: true });
  const get = async (url, file) => { if (fs.existsSync(file)) return file; const r = await fetch(url); if (!r.ok) throw new Error(`download ${r.status}: ${url.slice(0, 80)}`); fs.writeFileSync(file, Buffer.from(await r.arrayBuffer())); return file; };
  const step = (what) => console.log(`[kit] ${what}`);

  step("the final video, its words, its cuts");
  const final = path.join(vdir, "final.mp4");
  if (!fs.existsSync(final)) {
    if (c.long) execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(LONG_SEGMENT.from), "-t", String(LONG_SEGMENT.secs), "-i", c.url, "-vf", "scale=1280:-2", "-c:v", "libx264", "-crf", "16", "-preset", "fast", "-c:a", "aac", final]);
    else await get(c.url, final);
  }
  const probe = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "json", final]).toString();
  const P = JSON.parse(probe), width = P.streams[0].width, height = P.streams[0].height, duration = Number(P.format.duration), wide = width > height;
  const wordsFile = path.join(vdir, "words.json");
  if (!fs.existsSync(wordsFile)) execFileSync("python", [path.join(HERE, "transcribe.py"), final, wordsFile], { stdio: "inherit" });
  const segs = JSON.parse(fs.readFileSync(wordsFile, "utf8")).segments, words = segs.flatMap((s) => s.words);
  const raw = spawnSync("ffmpeg", ["-v", "info", "-i", final, "-vf", "select='gt(scene,0.2)',showinfo", "-an", "-f", "null", "-"], { encoding: "utf8", maxBuffer: 1 << 26 }).stderr ?? "";   // showinfo writes to stderr
  let cuts = [...raw.matchAll(/pts_time:([\d.]+)/g)].map((m) => Number(m[1]));
  // one continuous shot (Cutaway): its sentences are the moments
  if (cuts.length < 3) { cuts = []; let last = 0; for (const w of words) if (/[.?!]$/.test(w.w) && w.e - last >= 3) { cuts.push(+(w.e + 0.05).toFixed(2)); last = w.e; } }
  const pcm = execFileSync("ffmpeg", ["-v", "error", "-i", final, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], { maxBuffer: 1 << 28 });
  const A = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.length / 4), hop = 800, db50 = [];
  for (let i = 0; i + hop <= A.length; i += hop) { let e = 0; for (let k = i; k < i + hop; k++) e += A[k] * A[k]; db50.push(10 * Math.log10(e / hop + 1e-12)); }
  const level = (a, b) => Math.max(-90, ...db50.slice(Math.floor(a * 20), Math.ceil(b * 20)));
  const lastSound = (a, b) => { for (let k = Math.ceil(b * 20) - 1; k >= Math.floor(a * 20); k--) if (db50[k] > -35) return (k + 1) / 20; return b; };
  const moments = pickMoments({ cuts, words, duration, level, lastSound });
  console.log(`[kit] open ${moments.open.in}–${moments.open.out} "${moments.open.text}" | ending ${moments.ending.in}–${moments.ending.out} "${moments.ending.text}"`);

  // full-screen frames: a small vertical source is upscaled 2x (once); a sharp or wide one is used as it is
  const upscale = !wide && width < 1000, ext = upscale ? "png" : "jpg";
  // KIT_LIGHT: enough to write the script in about a minute; the frames and the input screens come after the approval
  const light = process.env.KIT_LIGHT === "1";
  if (!light) {
  step(upscale ? "its frames, upscaled 2x (local)" : "its frames");
  if (!upscale) { if (!fs.readdirSync(hq).length) execFileSync("ffmpeg", ["-v", "error", "-y", "-i", final, "-vf", "fps=30", "-q:v", "2", path.join(hq, "f%05d.jpg")]); }
  else {
    if (!fs.readdirSync(src).length) execFileSync("ffmpeg", ["-v", "error", "-y", "-i", final, "-vf", "fps=30", path.join(src, "f%05d.png")]);
    const nsrc = fs.readdirSync(src).length;
    if (fs.readdirSync(hq).length < nsrc) {
      // resumes after a stop: only the frames still missing (the newest ones may be half written, so they are done again)
      const have = fs.readdirSync(hq).map((f) => ({ f, t: fs.statSync(path.join(hq, f)).mtimeMs })).sort((a, b) => b.t - a.t);
      for (const x of have.splice(0, 8)) fs.rmSync(path.join(hq, x.f));   // several are written at once: all of the last few are redone
      const done = new Set(have.map((x) => x.f)), todo = path.join(vdir, "src_todo");
      fs.rmSync(todo, { recursive: true, force: true }); fs.mkdirSync(todo);
      for (const f of fs.readdirSync(src)) if (!done.has(f)) fs.copyFileSync(path.join(src, f), path.join(todo, f));
      console.log(`[kit] ${fs.readdirSync(todo).length} of ${nsrc} frames to upscale (one time only)`);
      if (ESRGAN) { execFileSync(path.join(ESRGAN, "realesrgan-ncnn-vulkan.exe"), ["-i", todo, "-o", hq, "-n", "realesr-animevideov3", "-s", "2", "-f", "png"], { cwd: ESRGAN, stdio: "ignore" }); fs.rmSync(todo, { recursive: true, force: true }); }
      else for (const f of fs.readdirSync(src)) if (!fs.existsSync(path.join(hq, f))) execFileSync("ffmpeg", ["-v", "error", "-y", "-i", path.join(src, f), "-vf", "scale=iw*2:ih*2:flags=lanczos", path.join(hq, f)]);
    }
  }

  }

  step(light ? "the script needs no input screens yet" : "its input re-entered on the internal account (free, nothing submitted)");
  const inputDir = path.join(kdir, "input");
  const lengthLabel = c.length_sec <= 22 ? "20 sec" : c.length_sec <= 37 ? "30 sec" : c.length_sec <= 52 ? "45 sec" : "1 min";
  if (!light && !fs.existsSync(path.join(inputDir, "input.json"))) {
    if (template === "ai_fruit_story") execFileSync("node", [path.join(HERE, "capture", "inputCapture.mjs"), inputDir, c.idea_text, lengthLabel, c.idea_title ?? ""], { stdio: "inherit" });
    else execFileSync("node", [path.join(HERE, "capture", "templateCapture.mjs"), template, inputDir, c.idea_text], { stdio: "inherit" });
  }

  step("its real pictures");
  const clean = c.scenes.filter((s) => !BRANDS.test(s.line ?? "")), imgs = [];
  for (const s of clean) if (s.image_url) imgs.push(await get(s.image_url, path.join(kdir, "media", `scene${s.idx}.${(s.image_url.split("?")[0].split(".").pop() || "png").slice(0, 4)}`)));
  if (imgs.length < 3) for (let i = 0; i < 4; i++) {   // no scene pictures on record: real frames of the video
    const f = path.join(kdir, "media", `scene_f${i}.jpg`);
    if (!fs.existsSync(f)) execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(duration * (0.15 + i * 0.22)), "-i", final, "-frames:v", "1", "-q:v", "2", f]);
    imgs.push(f);
  }
  const kit = {
    template, story: { id, title: c.title, length_sec: c.length_sec, idea: c.idea_title, idea_text: c.idea_text },
    file: `${rel}/final.mp4`, hq_dir: `${rel}/hq`, hq_ext: ext, wide, words: wordsFile, duration: +duration.toFixed(2), moments, measured: null,
    input: light ? null : JSON.parse(fs.readFileSync(path.join(inputDir, "input.json"), "utf8")).how, input_dir: inputDir, scene_images: imgs.slice(0, 6), ...(light ? { light: true } : {}),
  };
  fs.writeFileSync(path.join(kdir, "kit.json"), JSON.stringify(kit, null, 1));
  console.log(`[kit] ready: ${path.join(kdir, "kit.json")}`);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await main().then(() => new Promise((r) => setTimeout(r, 300)));
