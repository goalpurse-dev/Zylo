// Blender kit engine (phase 1): assembles the Docker build context in a folder OUTSIDE the repo (the kit's files are
// never committed; reference/ is git-excluded). Then, from that folder:
//   fly deploy --app zyvo-cutaway-render-staging --dockerfile Dockerfile --build-only --push --image-label blender-kit-<n>
// (Fly builds remotely and pushes to the registry RunPod already pulls from; setup.mjs pins the digest.)
//   node scripts/blockyWorlds/blenderKit/buildContext.mjs <ctxDir> [--kit <kit root>] [--video sneeze_teleport]
// Copies: the kit's rbx/, assets/, sfx/, the tools the render + finish need (render, shotkit, kit, finish, mix), the
// video folder (shots.py + its already processed voice: no ElevenLabs), a kit config.json (caption font; no music URL),
// OUR music bed (scripts/blockyWorlds/engine/audio/music.mjs, synthesized, no samples: never the kit's TEMPOREX track),
// and our glue (Dockerfile, handler.py, boot.py, gpucheck.py, fly.toml). The kit's network tools (eleven.py, voice.py,
// analyze_inspo.py, setup.py with yt-dlp) are left out.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../../..");
const argv = process.argv.slice(2), arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const out = argv[0] && !argv[0].startsWith("--") ? path.resolve(argv[0]) : null;
const kitRoot = path.resolve(arg("kit", path.join(repo, "reference/blocky-worlds/roblox-story-kit/unzipped/roblox-story-kit")));
const video = arg("video", "sneeze_teleport");
if (!out) { console.error("usage: node buildContext.mjs <ctxDir outside the repo> [--kit <dir>] [--video <slug>]"); process.exit(2); }
if (!path.relative(repo, out).startsWith("..")) throw new Error(`${out} is inside the repo: the kit's files must stay out of it`);
const eng = path.join(kitRoot, "engine");
for (const p of ["rbx", "assets", "sfx", "tools/render.py", `videos/${video}/shots.py`, `videos/${video}/audio/voice.wav`, `videos/${video}/audio/words.json`]) {
  if (!fs.existsSync(path.join(eng, p))) throw new Error(`the kit has no engine/${p} (${kitRoot})`);
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, "kit", "tools"), { recursive: true });
const skip = (src) => !/__pycache__|\.pyc$/.test(src);
for (const d of ["rbx", "assets", "sfx"]) fs.cpSync(path.join(eng, d), path.join(out, "kit", d), { recursive: true, filter: skip });
for (const t of ["render.py", "shotkit.py", "kit.py", "finish.py", "mix.py", "contact.py"]) fs.copyFileSync(path.join(eng, "tools", t), path.join(out, "kit", "tools", t));
fs.cpSync(path.join(eng, "videos", video), path.join(out, "kit", "videos", video), {
  recursive: true,
  // only the inputs: never rendered frames / outputs a local run may have left behind
  filter: (src) => skip(src) && !/[\\/](frames|preview|blend|out)([\\/]|$)|render_log|music\./.test(path.relative(path.join(eng, "videos", video), src)),
});
fs.writeFileSync(path.join(out, "kit", "config.json"), JSON.stringify({ caption_font: "Archivo Black", music_url: "", music_speed: 1.5, music_mode: "tempo" }, null, 2));

// our music bed: the Blocky Worlds synth ("funny" mood, 110 s: ~73 s after the kit's 1.5x tempo-up)
fs.mkdirSync(path.join(out, "music"), { recursive: true });
const m = spawnSync(process.execPath, [path.join(repo, "scripts/blockyWorlds/engine/audio/music.mjs"), path.join(out, "music"), "110", "funny", "7"], { encoding: "utf8" });
if (m.status !== 0) throw new Error(`music.mjs failed: ${m.stderr.slice(-400)}`);
fs.renameSync(path.join(out, "music", "music_funny.wav"), path.join(out, "music", "zyvo_music.wav"));

// THE ASSET LIBRARY (assets/catalog.json): exactly the catalogued model files + the textures / buffers they reference
// (glTF images + buffers, OBJ mtllib + map_* files), from the unpacked CC0 packs (git-excluded); the Dockerfile's
// build-only stage turns them into /app/zyvo_assets/zyvo_assets.blend
const assetsSrc = path.resolve(arg("assets", path.join(repo, "reference/blocky-worlds/assets-incoming/_unpacked")));
const catalog = JSON.parse(fs.readFileSync(path.join(here, "assets", "catalog.json"), "utf8"));
const copied = new Set();
const take = (rel) => {
  const norm = path.posix.normalize(rel.replace(/\\/g, "/"));
  if (norm.startsWith("..") || copied.has(norm)) return;
  const from = path.join(assetsSrc, norm);
  if (!fs.existsSync(from) || !fs.statSync(from).isFile()) return;
  copied.add(norm);
  fs.mkdirSync(path.dirname(path.join(out, "assets_src", norm)), { recursive: true });
  fs.copyFileSync(from, path.join(out, "assets_src", norm));
};
const near = (rel, uri) => path.posix.join(path.posix.dirname(rel), decodeURIComponent(String(uri).replace(/\\/g, "/")));
for (const a of catalog.assets) {
  take(a.file);
  const full = path.join(assetsSrc, a.file);
  if (!fs.existsSync(full)) throw new Error(`catalog file missing: ${a.file} (unpack the packs: README "Asset library")`);
  if (/\.(glb|gltf)$/i.test(a.file)) {
    const b = fs.readFileSync(full);
    const j = /\.glb$/i.test(a.file) ? JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString("utf8")) : JSON.parse(b.toString("utf8"));
    for (const x of [...(j.images ?? []), ...(j.buffers ?? [])]) if (x.uri && !x.uri.startsWith("data:")) take(near(a.file, x.uri));
  } else if (/\.obj$/i.test(a.file)) {
    for (const m of fs.readFileSync(full, "utf8").matchAll(/^mtllib\s+(.+?)\s*$/gm)) {
      const mtl = near(a.file, m[1]);
      take(mtl);
      const mf = path.join(assetsSrc, mtl);
      if (fs.existsSync(mf)) for (const t of fs.readFileSync(mf, "utf8").matchAll(/^\s*map_\w+\s+(?:-\S+\s+\S+\s+)*(.+?)\s*$/gm)) take(near(mtl, t[1]));
    }
  }
}
fs.mkdirSync(path.join(out, "assets"), { recursive: true });
for (const f of ["catalog.json", "build_assets.py"]) fs.copyFileSync(path.join(here, "assets", f), path.join(out, "assets", f));
console.log(`assets: ${catalog.assets.length} models, ${copied.size} files copied`);

for (const f of ["Dockerfile", "handler.py", "boot.py", "gpucheck.py", "netblock.py", "shotcheck.py", "finishx.py"]) fs.copyFileSync(path.join(here, f), path.join(out, f));
fs.writeFileSync(path.join(out, "fly.toml"), 'app = "zyvo-cutaway-render-staging"\nprimary_region = "fra"\n\n[build]\n  dockerfile = "Dockerfile"\n');
fs.writeFileSync(path.join(out, ".dockerignore"), "fly.toml\n");

const size = (p) => { const s = fs.statSync(p); return s.isDirectory() ? fs.readdirSync(p).reduce((a, n) => a + size(path.join(p, n)), 0) : s.size; };
console.log(`context: ${out} (${(size(out) / 1e6).toFixed(1)} MB; kit from ${kitRoot}, video ${video}, music zyvo_music.wav)`);
