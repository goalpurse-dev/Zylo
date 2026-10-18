// The Content Machine's asset library: imports real Zyvo outputs and UI from the laptop-transfer branch
// (read with git, so it works from any checkout) into the PRIVATE content-machine bucket (library/...), adds
// a cm_assets row per image (status pending) and queues the tagging jobs (pipeline.js tag_assets: the fast
// model tags each image and excludes real people, lookalikes and third-party characters or brands).
// Idempotent: an image already imported (same sha256) is skipped.
//   node scripts/contentMachine/importAssets.mjs [--list] [--ui] [--branch laptop-transfer] [--env <.env.local>]
//   --list   only print what would be imported (no upload, no rows, no jobs)
//   --ui     also capture public tryzyvo.com pages as UI screenshots (Playwright, $0)
// The tagging is paid (CM_MODEL_FAST, a few cents for a few hundred images) and goes through the Budget Guard.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(path.join(ROOT, "package.json"));
const arg = (name, def = null) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : def; };
const LIST = process.argv.includes("--list"), UI = process.argv.includes("--ui");
const BRANCH = arg("--branch", "laptop-transfer");
const ENV = arg("--env", path.join(ROOT, ".env.local"));
const TAG_BATCH = 8;

// The owner's list (2026-10-18): template thumbnails, community posters, viral-builder presets, behind-the-
// scenes posters, Long Form scenes, UI. Folders of face photos and model shots are left out entirely.
export const SOURCES = [
  ["public/opt/community-posters", "output"], ["public/community-posters", "output"],
  ["public/lp/stickman", "scene"], ["src/assets/longform", "scene"],
  ["public/thumbs", "thumbnail"], ["public/images/thumbs", "thumbnail"],
  ["src/assets/inspiration", "output"], ["src/assets/gallery", "output"], ["src/assets/home", "output"], ["src/assets/library", "output"],
  ["src/assets/proof", "output"], ["src/assets/review", "output"], ["src/assets/tools", "thumbnail"], ["src/assets/toolshell", "thumbnail"],
  ["public/opt/viral-builder", "output"], ["public/viral-builder", "output"],
  ["public/opt/lp/fruit", "output"], ["public/lp/fruit", "output"], ["public/lp/blocky-stories", "output"],
  ["public/template/2am-world", "output"], ["public/clayrescue", "output"], ["public/templates/AICOOKING", "output"],
  ["public/assets/showcase", "output"], ["public/opt/home/v2", "output"], ["public/inspiration", "output"],
  ["public/lp/image-generator", "output"], ["public/styles", "output"], ["public/images/styles", "output"],
];
const SKIP = /\/(face|models?|avatars?|logos?|icons?|flags?|og|favicon)[/.-]|\/bg\//i;
const TYPES = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };
const MAX_BYTES = 8_000_000;

export function candidates(files) {
  const picked = [];
  for (const f of files) {
    const ext = path.extname(f).toLowerCase();
    if (!TYPES[ext] || SKIP.test(`/${f}`)) continue;
    const src = SOURCES.find(([dir]) => f.startsWith(`${dir}/`));
    if (src) picked.push({ path: f, kind: /character/i.test(f) ? "character" : src[1], ext });
  }
  // The optimised copy (/opt/...) wins over its original: one image, imported once.
  const key = (p) => p.replace(/^public\/opt\//, "public/").replace(/\.[a-z]+$/i, "").toLowerCase();
  const byKey = new Map();
  for (const c of picked) {
    const k = key(c.path);
    const prev = byKey.get(k);
    if (!prev || (c.path.includes("/opt/") && !prev.path.includes("/opt/"))) byKey.set(k, c);
  }
  return [...byKey.values()];
}

const git = (args, opts = {}) => execFileSync("git", args, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024, ...opts });

async function captureUi() {
  const { chromium } = require("playwright");
  const pages = [["home", "/"], ["long-form", "/long-form"], ["fruit-story", "/ai-fruit-story-maker"], ["blocky-stories", "/blocky-story-video-maker"], ["image-generator", "/image-generator"]];
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1180 } });
  await ctx.addInitScript(() => { try { localStorage.setItem("zyvo_cookie_consent", "declined"); } catch { /* */ } });
  const out = [];
  for (const [name, p] of pages) {
    const page = await ctx.newPage();
    await page.goto(`https://www.tryzyvo.com${p}`, { waitUntil: "networkidle", timeout: 60_000 }).catch(() => {});
    await page.getByRole("button", { name: /close/i }).first().click({ timeout: 2000 }).catch(() => {});
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(1200);
    out.push({ path: `https://www.tryzyvo.com${p}`, kind: "ui", ext: ".png", bytes: await page.screenshot({ type: "png" }), name });
    await page.close();
  }
  await browser.close();
  return out;
}

async function main() {
  const files = git(["ls-tree", "-r", "--name-only", BRANCH]).toString("utf8").split("\n").filter(Boolean);
  const list = candidates(files);
  console.log(`${list.length} candidate images on ${BRANCH} (after skipping duplicates and face/model folders)`);
  if (LIST) { for (const c of list) console.log(`${c.kind.padEnd(9)} ${c.path}`); return; }

  require("dotenv").config({ path: ENV, quiet: true });
  const { createClient } = require("@supabase/supabase-js");
  const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const have = new Set(((await db.from("cm_assets").select("sha256")).data ?? []).map((r) => r.sha256));

  const items = list.map((c) => ({ ...c, bytes: null }));
  if (UI) items.push(...await captureUi());
  const ids = [];
  let skipped = 0;
  for (const it of items) {
    const bytes = it.bytes ?? git(["show", `${BRANCH}:${it.path}`]);
    if (!bytes.length || bytes.length > MAX_BYTES) { skipped += 1; continue; }
    const sha = createHash("sha256").update(bytes).digest("hex");
    if (have.has(sha)) { skipped += 1; continue; }
    have.add(sha);
    const ref = sha.slice(0, 8);
    const dest = `library/${ref}${it.ext}`;
    const up = await db.storage.from("content-machine").upload(dest, bytes, { contentType: TYPES[it.ext], upsert: true });
    if (up.error) { console.error(`upload failed ${it.path}: ${up.error.message}`); continue; }
    const { data, error } = await db.from("cm_assets").insert({ ref, path: dest, source_path: it.path, sha256: sha, content_type: TYPES[it.ext], bytes: bytes.length, kind: it.kind, tool: it.kind === "ui" ? "ui" : null }).select("id").single();
    if (error) { console.error(`row failed ${it.path}: ${error.message}`); continue; }
    ids.push(data.id);
  }
  // The tagging jobs: run for real (the owner ordered it), through the Budget Guard, lane "assets".
  const jobs = [];
  for (let i = 0; i < ids.length; i += TAG_BATCH) jobs.push({ stage: "tag_assets", payload: { ids: ids.slice(i, i + TAG_BATCH), live: true }, max_attempts: 2 });
  if (jobs.length) {
    const { error } = await db.from("cm_jobs").insert(jobs);
    if (error) throw new Error(`queue: ${error.message}`);
  }
  console.log(`imported ${ids.length} images, skipped ${skipped} (already there or too big); queued ${jobs.length} tagging jobs (the worker picks them up within a minute)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(e.message); process.exit(1); });
