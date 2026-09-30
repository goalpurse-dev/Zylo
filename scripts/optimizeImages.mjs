// Responsive WebP variants for every image Home and the nav menus show.
// Reads image paths from the listed source files (+ whole folders), writes
// public/opt/<path>.w<width>.webp at a few widths (never upscaled) and
// src/data/optImages.json (original path -> available widths). Masters over
// 1 MB are copied to the private "asset-masters" storage bucket; the files in
// public/ stay where they are for pages that still use them directly.
//   FFMPEG=... node --env-file=.env.local scripts/optimizeImages.mjs [--no-upload]
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const FFMPEG = process.env.FFMPEG ?? "ffmpeg";
const FFPROBE = process.env.FFPROBE ?? "ffprobe";
const SOURCES = [
  "src/components/workspace/CreateMenu.jsx", "src/components/workspace/ZyvoSuiteCarousel.jsx", "src/components/workspace/toolshell.jsx",
  "src/components/workspace/Glow.jsx", "src/components/home-v2/HomeV2Sections.jsx", "src/components/public-gallery/gallery.jsx",
  "src/components/launch/LaunchUI.jsx", "src/pages/workspace/long-form/index.jsx", "src/data/homeContent.js",
];
const FOLDERS = ["public/images/niches", "public/community-posters", "public/home/v2"];
const ICON = /\/icons\/|click\.png|Logo/i;

const found = new Set();
for (const f of SOURCES) for (const m of fs.readFileSync(f, "utf8").matchAll(/["'`](\/[^"'`\s]+?\.(?:png|jpe?g|webp))["'`]/gi)) found.add(m[1]);
for (const d of FOLDERS) for (const n of fs.readdirSync(d)) if (/\.(png|jpe?g|webp)$/i.test(n)) found.add("/" + path.posix.join(d.replace(/^public\//, ""), n));
found.add("/icons/credits.png");
const list = [...found].filter((p) => fs.existsSync(path.join("public", p)) && !p.startsWith("/opt/")).sort();

const size = (f) => execFileSync(FFPROBE, ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0:s=x", f]).toString().trim().split("x").map(Number);
const manifest = {};
let inBytes = 0, outBytes = 0;
for (const p of list) {
  const src = path.join("public", p);
  const [w] = size(src);
  const wanted = ICON.test(p) ? [96, 192] : [240, 480, 960];
  const widths = [...new Set(wanted.map((x) => Math.min(x, w)))];
  for (const W of widths) {
    const out = path.join("public/opt", `${p}.w${W}.webp`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    execFileSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", "-i", src, "-vf", `scale=${W}:-2:flags=lanczos`, "-frames:v", "1", "-c:v", "libwebp", "-quality", ICON.test(p) ? "85" : "74", "-compression_level", "6", out]);
    outBytes += fs.statSync(out).size;
  }
  inBytes += fs.statSync(src).size;
  manifest[p] = widths;
}
fs.writeFileSync("src/data/optImages.json", JSON.stringify(manifest, null, 1) + "\n");
console.log(`${list.length} images · originals ${(inBytes / 1e6).toFixed(1)} MB · variants ${(outBytes / 1e6).toFixed(1)} MB`);

if (!process.argv.includes("--no-upload")) {
  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  await admin.storage.createBucket("asset-masters", { public: false }).catch(() => {});
  let n = 0;
  for (const p of list) {
    const src = path.join("public", p);
    if (fs.statSync(src).size < 1_000_000) continue;
    const { error } = await admin.storage.from("asset-masters").upload(p.replace(/^\//, ""), fs.readFileSync(src), { upsert: true, contentType: p.endsWith(".png") ? "image/png" : p.endsWith(".webp") ? "image/webp" : "image/jpeg" });
    if (!error) n++; else console.log("upload failed", p, error.message);
  }
  console.log(`masters uploaded to asset-masters: ${n}`);
}
