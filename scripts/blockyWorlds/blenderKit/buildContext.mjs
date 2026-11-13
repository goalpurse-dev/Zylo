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

for (const f of ["Dockerfile", "handler.py", "boot.py", "gpucheck.py", "netblock.py", "shotcheck.py", "finishx.py"]) fs.copyFileSync(path.join(here, f), path.join(out, f));
fs.writeFileSync(path.join(out, "fly.toml"), 'app = "zyvo-cutaway-render-staging"\nprimary_region = "fra"\n\n[build]\n  dockerfile = "Dockerfile"\n');
fs.writeFileSync(path.join(out, ".dockerignore"), "fly.toml\n");

const size = (p) => { const s = fs.statSync(p); return s.isDirectory() ? fs.readdirSync(p).reduce((a, n) => a + size(path.join(p, n)), 0) : s.size; };
console.log(`context: ${out} (${(size(out) / 1e6).toFixed(1)} MB; kit from ${kitRoot}, video ${video}, music zyvo_music.wav)`);
