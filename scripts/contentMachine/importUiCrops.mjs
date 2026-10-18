// Tight Zyvo UI crops for the asset library (owner, 2026-10-18): one feature per crop, large, so a slide
// about the app shows something readable on a phone (the whole-page screenshot was flagged as unreadable).
// Cut from the real app screenshots in the repo (public/home/v2), uploaded to the PRIVATE content-machine
// bucket (library/ui-*.png) with a cm_assets row each: kind ui, status active, described here (no tagging
// call, $0). Idempotent (same sha256 → skipped). Needs ffmpeg.
//   FFMPEG=<ffmpeg> node scripts/contentMachine/importUiCrops.mjs <repo root with public/home/v2> [--env <.env.local>] [--list]
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(path.join(ROOT, "package.json"));
const arg = (name, def = null) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : def; };

// [name, source, x, y, w, h, subject, tags]: coordinates in the 1644×924 originals.
export const CROPS = [
  ["ui-idea-picker", "step-idea.jpg", 0, 285, 1075, 590, "Long Form idea step: pick a niche and a visual style (Ancient Humans, Classic Flat Stickman)", ["long form", "niche", "visual style", "idea step", "picker"]],
  ["ui-scenes", "step-scenes.jpg", 0, 25, 1080, 490, "Scenes step: 136 of 136 scenes drawn, each scene card with Regenerate, edit and text buttons", ["scene editor", "scenes", "regenerate", "long form", "storyboard"]],
  ["ui-thumbnails", "step-publish.jpg", 870, 100, 760, 485, "Publish step: six YouTube thumbnail options with Regenerate and Download thumbnail", ["thumbnails", "publish", "youtube", "long form"]],
  ["ui-download", "step-publish.jpg", 10, 100, 830, 720, "Publish step: the finished video player with Download video (1080p) and Make 1440p version", ["download", "finished video", "publish", "long form"]],
  ["ui-youtube-meta", "step-publish.jpg", 870, 615, 760, 300, "Publish step: YouTube title, description and tags with Copy all and Rewrite", ["youtube title", "description", "tags", "publish"]],
];

async function main() {
const repo = process.argv[2];
if (!repo || repo.startsWith("--")) { console.error("usage: importUiCrops.mjs <repo root> [--env <.env.local>] [--list]"); process.exit(2); }
const ffmpeg = process.env.FFMPEG ?? "ffmpeg";
const tmp = mkdtempSync(path.join(os.tmpdir(), "cm-ui-"));
const items = CROPS.map(([name, src, x, y, w, h, subject, tags]) => {
  const out = path.join(tmp, `${name}.png`);
  execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-i", path.join(repo, "public/home/v2", src), "-vf", `crop=${w}:${h}:${x}:${y}`, out]);
  const bytes = readFileSync(out);
  return { name, src, w, h, subject, tags, bytes, sha: createHash("sha256").update(bytes).digest("hex"), file: out };
});
if (process.argv.includes("--list")) { for (const it of items) console.log(it.name, `${it.w}x${it.h}`, it.file, it.subject); process.exit(0); }

require("dotenv").config({ path: arg("--env", path.join(ROOT, ".env.local")), quiet: true });
const url = process.env.VITE_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed."); process.exit(2); }
const db = require("@supabase/supabase-js").createClient(url, key, { auth: { persistSession: false } });
const { data: have, error: e1 } = await db.from("cm_assets").select("sha256").in("sha256", items.map((i) => i.sha));
if (e1) throw new Error(e1.message);
const known = new Set(have.map((r) => r.sha256));
for (const it of items) {
  if (known.has(it.sha)) { console.log(`skip ${it.name} (already there)`); continue; }
  const ref = it.sha.slice(0, 8);
  const dest = `library/${it.name}-${ref}.png`;
  const up = await db.storage.from("content-machine").upload(dest, it.bytes, { contentType: "image/png", upsert: true });
  if (up.error) throw new Error(`upload ${it.name}: ${up.error.message}`);
  const { error } = await db.from("cm_assets").insert({
    ref, path: dest, source_path: `public/home/v2/${it.src} (crop ${it.name})`, sha256: it.sha, content_type: "image/png", bytes: it.bytes.length,
    width: it.w, height: it.h, kind: "ui", tool: "ui", style: "Zyvo app UI", subject: it.subject, tags: it.tags, status: "active", subtitles: "none", tagged_at: new Date().toISOString(),
  });
  if (error) throw new Error(`row ${it.name}: ${error.message}`);
  console.log(`added ${it.name} (${ref}) ${it.w}x${it.h}`);
}
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(e.message); process.exit(1); });
