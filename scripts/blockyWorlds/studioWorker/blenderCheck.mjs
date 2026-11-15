// Blocky Worlds STUDIO WORKER: the BLENDER ENGINE CHECKS (the image can run blenderKit/workerSteps.mjs -> pipeline.mjs).
//   localChecks({ kitDir, tmp })  FREE: python3 + PIL, the kit (SKILL.md, PLAYBOOK.md, rbx/, the worked examples),
//                                 shotcheck.py on a kit example, kitmap.py, contact.py on a test clip, ffmpeg / ffprobe.
//                                 worker.mjs --smoke runs these during the image build: a missing piece FAILS the build.
//   gpuStill({ env, maxUsd })     PAID (a few cents): ONE preview still (one shot, a library world place) on the Blender
//                                 endpoint; refused when its worst case is over maxUsd; the image must not be black.
// worker.mjs --check-blender runs both, prints PASS / FAIL per item and exits non-zero on any failure. It never touches
// the run queue (no claim, no hello).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BK = path.resolve(HERE, "../blenderKit");
export const KIT_FILES = Object.freeze(["SKILL.md", "engine/PLAYBOOK.md", "engine/rbx/__init__.py", "engine/rbx/story.py", "engine/rbx/chars.py",
  "engine/tools/shotkit.py", "engine/videos/sneeze_teleport/shots.py", "engine/videos/sneeze_teleport/script.txt", "engine/videos/laugh_float/shots.py"]);
export const STILL = Object.freeze({ place: "downtown_street", spot: "wide", maxRunSec: 150, maxUsd: 0.05 });
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: "utf8", timeout: 120_000, ...opts });

/** the free checks -> [{ name, ok, detail }] */
export function localChecks({ kitDir = process.env.BLOCKY_WORLDS_KIT_DIR, tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bk-check-")) } = {}) {
  const out = [];
  const add = (name, ok, detail = "") => out.push({ name, ok: Boolean(ok), detail: String(detail).slice(0, 300) });
  // (a) python3 (as `python`: the pipeline calls python) + PIL
  const py = run("python", ["-c", "import sys, PIL; from PIL import Image, ImageStat, ImageDraw, ImageFont; print(sys.version.split()[0], PIL.__version__)"]);
  add("python + PIL", py.status === 0, py.status === 0 ? py.stdout.trim() : (py.stderr || py.error?.message || "python not found"));
  for (const t of ["ffmpeg", "ffprobe"]) { const r = run(t, ["-version"]); add(t, r.status === 0, r.status === 0 ? r.stdout.split("\n")[0] : (r.error?.message ?? r.stderr)); }
  // (b) the kit: where the director reads it
  const kitOk = Boolean(kitDir) && fs.existsSync(kitDir);
  const missing = kitOk ? KIT_FILES.filter((f) => !fs.existsSync(path.join(kitDir, f))) : KIT_FILES;
  add("kit (BLOCKY_WORLDS_KIT_DIR)", kitOk && !missing.length, kitOk ? (missing.length ? `missing: ${missing.join(", ")}` : kitDir) : `not found: ${kitDir ?? "(unset)"}`);
  // the director's own files (the world library, the actions, the asset catalog the director reads)
  const own = ["shotcheck.py", "kitmap.py", "contact.py", "worlds/worlds.py", "actions/actions.py", "assets/catalog.json", "endpoint.json"].filter((f) => !fs.existsSync(path.join(BK, f)));
  add("director tools", !own.length, own.length ? `missing: ${own.join(", ")}` : "shotcheck, kitmap, contact, worlds, actions, catalog, endpoint");
  // (c) the static check passes a kit example
  if (kitOk && !missing.length) {
    const sc = run("python", ["-I", path.join(BK, "shotcheck.py"), path.join(kitDir, "engine/videos/sneeze_teleport/shots.py"), "--json"]);
    let res = null; try { res = JSON.parse(sc.stdout.trim().split("\n").pop()); } catch { res = null; }
    add("shotcheck on a kit example", res?.ok === true, res ? (res.ok ? "ok" : JSON.stringify(res.problems?.slice(0, 2))) : (sc.stderr || "no answer"));
    // (d) the toolkit map
    const map = path.join(tmp, "kitmap.md");
    const km = run("python", ["-I", path.join(BK, "kitmap.py"), path.join(kitDir, "engine"), map]);
    const size = fs.existsSync(map) ? fs.statSync(map).size : 0;
    add("kitmap.py", km.status === 0 && size > 2000, km.status === 0 ? `${size} bytes` : km.stderr);
  } else { add("shotcheck on a kit example", false, "no kit"); add("kitmap.py", false, "no kit"); }
  // (d) the contact sheet on a 3 s test clip
  const clip = path.join(tmp, "test.mp4"), sheet = path.join(tmp, "contact.jpg");
  const mk = run("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc=s=360x640:d=3:r=30", "-pix_fmt", "yuv420p", clip]);
  const cs = mk.status === 0 ? run("python", [path.join(BK, "contact.py"), clip, sheet]) : mk;
  add("contact.py", cs.status === 0 && fs.existsSync(sheet) && fs.statSync(sheet).size > 1000, cs.status === 0 ? `${fs.existsSync(sheet) ? fs.statSync(sheet).size : 0} bytes` : (cs.stderr || cs.error?.message));
  return out;
}

/** the mean brightness and spread of an image (0-255) by PIL: a black or flat frame is a failure */
export function imageStats(file) {
  const r = run("python", ["-c", "import sys\nfrom PIL import Image, ImageStat\ns=ImageStat.Stat(Image.open(sys.argv[1]).convert('L'))\nprint(s.mean[0], s.stddev[0])", file]);
  const [mean, sd] = r.stdout.trim().split(/\s+/).map(Number);
  return { mean, sd, ok: r.status === 0 && mean > 12 && sd > 6 };
}

/** the one paid check: ONE preview still of a library place on the Blender endpoint -> { ok, detail, usd } */
export async function gpuStill({ maxUsd = STILL.maxUsd, tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bk-still-")), log = console.log } = {}) {
  const { runpod, RATE, BOOT_S, endpointInfo } = await import("../blenderKit/rp.mjs");
  const { staticCheck } = await import("../blenderKit/director.mjs");
  const { ledger } = await import("../studio/ledger.mjs");
  const worst = +((STILL.maxRunSec + BOOT_S) * RATE).toFixed(4);
  if (worst > maxUsd) return { ok: false, detail: `refused: worst case $${worst} is over $${maxUsd}`, usd: 0 };
  const lib = fs.readFileSync(path.join(BK, "worlds/worlds.py"), "utf8");
  const src = ['"""Worker check: one library still."""', "from shotkit import *", "from rbx import story", "from rbx.story import *", "import math, random", "from mathutils import Vector", "", "V = Video(__file__)", "story.bind(V)", "", lib, "",
    `@S(1, 0, None, "check: ${STILL.place} ${STILL.spot}")`, "def s01(t0, t1):", `    ZW_INFO = zw_build("${STILL.place}", t0, t1, {})`, "    cam = Cam()", `    loc, tgt = zw_spot(cam, "${STILL.place}", "${STILL.spot}", t0, t1)`, "    k = chars.kid(3)", "    k.pose(t0, loc=(tgt[0], tgt[1], 0), rot=0)", ""].join("\n");
  const vdir = path.join(tmp, "video"); fs.mkdirSync(path.join(vdir, "audio"), { recursive: true });
  const sc = staticCheck(src, path.join(vdir, "shots.py"));
  if (!sc.ok) return { ok: false, detail: `static check: ${JSON.stringify(sc.problems.slice(0, 2))}`, usd: 0 };
  fs.writeFileSync(path.join(vdir, "audio", "words.json"), JSON.stringify([{ word: "w0", start: 0, end: 0.6 }, { word: "w1", start: 1, end: 1.6 }]));
  fs.writeFileSync(path.join(vdir, "script.txt"), "check\n");
  run("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", "2", path.join(vdir, "audio", "voice.wav")]);
  const tar = run("python", ["-c", "import sys,tarfile,os\nout,root=sys.argv[1],sys.argv[2]\nwith tarfile.open(out,'w:gz') as t:\n for f in sys.argv[3:]:\n  t.add(os.path.join(root,f),arcname=f)", path.join(tmp, "v.tgz"), vdir, "shots.py", "script.txt", "audio/words.json", "audio/voice.wav"]);
  if (tar.status !== 0) return { ok: false, detail: `tar: ${tar.stderr}`, usd: 0 };
  const L = ledger(tmp, { capUsd: maxUsd, agentCapUsd: 0 });
  const R = runpod({ L, endpoint: endpointInfo().endpointId, prefix: `blocky-worlds-test/blender-kit/check-${Date.now().toString(36)}`, log });
  try {
    await R.putFile("v.tgz", path.join(tmp, "v.tgz"), "application/gzip");
    const url = await R.signGet("v.tgz");
    const r = await R.job("worker check: one still", { role: "preview", slug: "check", videoUrl: url, shots: "1", perSheet: 12, cols: 6, upload: await R.signPuts("p.tgz", 2) }, { maxRunSec: STILL.maxRunSec, ledgerKey: "runpod_preview" });
    if (!r.ok) return { ok: false, detail: `job ${r.status}: ${String(r.error).slice(0, 200)}`, usd: L.total() };
    await R.fetchParts("p.tgz", r.output.upload.parts, path.join(tmp, "p.tgz"));
    run("python", ["-c", "import sys,tarfile\nwith tarfile.open(sys.argv[1]) as t:\n t.extractall(sys.argv[2], filter='data')", path.join(tmp, "p.tgz"), tmp]);
    const pdir = path.join(tmp, "preview");
    const img = fs.existsSync(pdir) ? fs.readdirSync(pdir).find((f) => /\.(png|jpe?g)$/i.test(f)) : null;
    if (!img) return { ok: false, detail: `no preview image came back (failed: ${JSON.stringify(r.output.failed ?? {})})`, usd: L.total() };
    const s = imageStats(path.join(pdir, img));
    return { ok: s.ok, detail: `${img}: mean ${s.mean?.toFixed(1)}, spread ${s.sd?.toFixed(1)}${s.ok ? "" : " (black / flat)"}; ${r.execS.toFixed(0)} s on ${r.worker ?? "?"}`, usd: L.total() };
  } finally { await R.cleanup().catch(() => {}); }
}

/** print PASS / FAIL lines; -> true when all passed */
export function report(items, say = console.log) {
  for (const i of items) say(`${i.ok ? "PASS" : "FAIL"}  ${i.name}${i.detail ? `: ${i.detail}` : ""}`);
  return items.every((i) => i.ok);
}
