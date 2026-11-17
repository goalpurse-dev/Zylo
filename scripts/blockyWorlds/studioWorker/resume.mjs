// In This Town "TRY AGAIN" (owner 2026-11-18): a run that fails without a video saves its PARTS (the voice take, the base
// plan, the Blender pipeline's state: the director's plan, every shot body, the fix rounds, the preview job outputs'
// storage folder) as one small resume.tgz in its own storage folder; the retry run (blocky_worlds_retry_run, card /
// row resume_of) unpacks it into its folder and continues: no new voice, no new plan, no re-preview of shots that passed,
// and the fix rounds go on from where they stopped. Never fatal: a missing or broken bundle just means a fresh start.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { paths } from "../../../supabase/functions/_shared/blockyWorlds/render.js";

/** the bundle's place in the renders bucket: the failed run's own folder */
export const resumePath = (run) => paths(run).final.replace(/final\.mp4$/, "resume.tgz");
/** the parts worth keeping: small text state + the voice; never images, videos, archives or frames */
export const KEEP_EXT = /\.(json|jsonl|txt|py|wav|mp3|m4a)$/i;
// never in the bundle (2026-11-18: the Sock run's bundle went over the cap on ~80 MB of music and raw takes, and was
// skipped without a word): the music beds (made again on every run) and the raw / original takes
export const SKIP_FILE = /(^|[\\/])(music[^\\/]*\.wav|[^\\/]*\.raw\.wav|[^\\/]*\.orig\.wav|[^\\/]*\.processed\.wav|[^\\/]*\.tight\.wav)$/i;
export const SKIP_DIR = /(^|[\\/])(frames|preview|previews|segments|chunks|final|tmp|node_modules)([\\/]|$)/i;
export const MAX_BUNDLE_BYTES = 45 * 1024 * 1024;
// the spend files: a retry is a new budget (its own caps), so the failed run's totals are left behind
export const DROP_ON_RESTORE = ["costs.json", "steps.jsonl", path.join("blender", "costs.json"), path.join("blender", "steps.jsonl")];

const PY = process.env.PYTHON ?? "python";
const run = (code, args) => { const r = spawnSync(PY, ["-c", code, ...args], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }); if (r.status !== 0) throw new Error(`python: ${(r.stderr || r.error?.message || "").slice(0, 300)}`); return r.stdout; };

/** the files of a run folder that go into the bundle (relative paths) */
export function bundleFiles(dir) {
  const out = [];
  const walk = (rel) => {
    for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      const r = rel ? path.join(rel, e.name) : e.name;
      if (e.isDirectory()) { if (!SKIP_DIR.test(r)) walk(r); }
      else if (KEEP_EXT.test(e.name) && !SKIP_FILE.test(r)) out.push(r);
    }
  };
  if (fs.existsSync(dir)) walk("");
  return out;
}

/** a run folder -> the bundle bytes (null when there is nothing worth keeping, or it is too big) */
export function packResume(dir, log = () => {}) {
  const files = bundleFiles(dir);
  if (!files.some((f) => /state\.json$|voice-result\.json$/.test(f))) { log("Try again parts: nothing to save (no state, no voice)"); return null; }
  const out = path.join(dir, "..", `${path.basename(dir)}.resume.tgz`);
  run("import sys,tarfile,os\nout,root=sys.argv[1],sys.argv[2]\nwith tarfile.open(out,'w:gz') as t:\n for f in sys.argv[3:]:\n  t.add(os.path.join(root,f),arcname=f)", [out, dir, ...files]);
  const buf = fs.readFileSync(out);
  fs.rmSync(out, { force: true });
  if (buf.length > MAX_BUNDLE_BYTES) { log(`Try again parts NOT saved: ${Math.round(buf.length / 1e6)} MB is over the ${MAX_BUNDLE_BYTES / 1e6} MB cap`); return null; }
  return buf;
}

/** the bundle bytes -> unpacked into dir (members outside dir are refused), the old spend files dropped */
export function unpackResume(buf, dir) {
  const tmp = path.join(dir, "..", `${path.basename(dir)}.restore.tgz`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(tmp, buf);
  try {
    run("import sys,tarfile,os\nsrc,root=sys.argv[1],os.path.realpath(sys.argv[2])\nwith tarfile.open(src,'r:gz') as t:\n ms=[m for m in t.getmembers() if (m.isfile() or m.isdir()) and os.path.realpath(os.path.join(root,m.name)).startswith(root+os.sep)]\n t.extractall(root,members=ms)", [tmp, dir]);
  } finally { fs.rmSync(tmp, { force: true }); }
  for (const f of DROP_ON_RESTORE) fs.rmSync(path.join(dir, f), { force: true });
  return bundleFiles(dir);
}

/** the voice step's result kept next to the take (paths relative to the run folder, so a retry folder can use it) */
export function saveVoiceResult(dir, v) {
  try { fs.writeFileSync(path.join(dir, "voice-result.json"), JSON.stringify({ ...v, wav: v?.wav ? path.relative(dir, v.wav) : null })); } catch { /* never fatal */ }
}
export function readVoiceResult(dir) {
  try {
    const v = JSON.parse(fs.readFileSync(path.join(dir, "voice-result.json"), "utf8"));
    // a seed made on Windows writes "voice\\voice.wav": read it the same on the Linux worker
    const wav = v.wav ? path.join(dir, ...String(v.wav).split(/[\\/]/)) : null;
    return wav && fs.existsSync(wav) && v.words ? { ...v, wav } : null;
  } catch { return null; }
}
