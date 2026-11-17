// THE MILO GOLDEN TEST (owner 2026-11-18: "keep it as our standard"). Milo ("Every Laugh, I Grow", the owner's script,
// the owner's quality bar, rendered 2026-11-15) run through the LIVE pipeline exactly as a customer's "Make my video":
// the same run row (blocky_worlds_start_run), the same card (the auto scene plan, the Studio builds), the live worker,
// the live director / camera fix / checker / render gate. The INTERNAL TEST account pays (its fake credits); the run is
// env "test" and carries its own lower cap (card.cap_usd). Milo's stored voice is seeded through the Try-again restore
// (resume.mjs): no new ElevenLabs take, and the words are the same as the original's.
//   node --env-file=.env.local scripts/blockyWorlds/golden/miloGolden.mjs --queue --milo <run dir> [--cap 3]
//   node --env-file=.env.local scripts/blockyWorlds/golden/miloGolden.mjs --compare <runId> --milo <run dir> --out <png>
// Item 7 (stills only, after a big director / checker / worlds change): --queue with --cap 0.6 stops after the previews
// and the checker (the cap cannot fund the final), and --compare then uses the run's preview sheets instead of a video.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { NARRATOR } from "../../../supabase/functions/_shared/blockyWorlds/config.js";
import { narrationOf } from "../../../supabase/functions/_shared/blockyWorlds/script.js";
import { autoScenePlan, cleanScenePlan } from "../../../supabase/functions/_shared/blockyWorlds/scenePlan.js";
import { studioBuilds } from "../../../supabase/functions/_shared/blockyWorlds/studioBuilds.js";
import { resumePath } from "../studioWorker/resume.mjs";

const argv = process.argv.slice(2), has = (k) => argv.includes(`--${k}`), arg = (k, d = null) => (has(k) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const MILO = path.resolve(arg("milo"));
const TEST_USER = "d66a0ea9-3574-4fad-94ed-c82aea15061f"; // the internal test account (fake credits)
const BUCKET = "blocky-worlds-renders";
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const script = JSON.parse(fs.readFileSync(path.join(MILO, "results.json"), "utf8")).results[0].script;
const py = (code, ...a) => { const r = spawnSync("python", ["-c", code, ...a], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }); if (r.status !== 0) throw new Error(r.stderr); return r.stdout; };

if (has("queue")) {
  const { data: u } = await admin.auth.admin.getUserById(TEST_USER);
  if (!u?.user?.email?.endsWith("@zyvo-internal.test")) throw new Error("not the internal test account");
  const cap = Number(arg("cap", "3"));
  // 1. the seed: Milo's processed take (voice.wav + words.json) as the Try-again parts of a seed id
  const seed = crypto.randomUUID(), tmp = fs.mkdtempSync(path.join(os.tmpdir(), "milo-seed-"));
  const words = JSON.parse(fs.readFileSync(path.join(MILO, "voice", "words.json"), "utf8"));
  fs.mkdirSync(path.join(tmp, "voice"));
  for (const f of ["voice.wav", "words.json", "voice.mp3", "take.json"]) if (fs.existsSync(path.join(MILO, "voice", f))) fs.copyFileSync(path.join(MILO, "voice", f), path.join(tmp, "voice", f));
  fs.writeFileSync(path.join(tmp, "voice-result.json"), JSON.stringify({ wav: "voice/voice.wav", words, duration: words.at(-1).end, chars: script.lines.map((l) => l.text).join("\n").length, reused: "milo golden seed" }));
  const tgz = path.join(os.tmpdir(), `${seed}.tgz`);
  py("import sys,tarfile,os\nout,root=sys.argv[1],sys.argv[2]\nwith tarfile.open(out,'w:gz') as t:\n for f in sys.argv[3:]:\n  t.add(os.path.join(root,f),arcname=f)", tgz, tmp, "voice-result.json", ...fs.readdirSync(path.join(tmp, "voice")).map((f) => `voice/${f}`));
  const seedPath = resumePath({ env: "test", user_id: TEST_USER, id: seed });
  const up = await admin.storage.from(BUCKET).upload(seedPath, fs.readFileSync(tgz), { contentType: "application/gzip", upsert: true });
  if (up.error) throw new Error(`seed upload: ${up.error.message}`);
  // 2. the run, as "Make my video" makes it (the charge from the test account's fake credits)
  const lines = script.lines.map((l) => ({ part: l.part, text: l.text }));
  const { data: run, error } = await admin.rpc("blocky_worlds_start_run", { p_user: TEST_USER, p_draft: null, p_title: `${script.title} (Milo golden test)`, p_length: 80, p_lines: lines, p_narration: narrationOf({ lines }), p_post: { title: script.title }, p_narrator: NARRATOR, p_end_card: true, p_credits: 313, p_env: "test", p_engine: "studio" });
  if (error || !run) throw new Error(`start: ${error?.message}`);
  const plan = cleanScenePlan({ scenes: autoScenePlan(lines).scenes }, lines.length);
  const card = { topic: script.topic ?? script.title, adapted: true, golden: "milo", cap_usd: cap, resume_of: seed, ...(plan.ok ? { scene_plan: plan.plan } : {}) };
  const upd = await admin.from("blocky_worlds_runs").update({ card, studio_builds: studioBuilds({ lines }, card) }).eq("id", run.id);
  if (upd.error) throw new Error(`card: ${upd.error.message}`);
  console.log(JSON.stringify({ queued: run.id, cap, seed, scenes: plan.ok ? plan.plan.scenes.length : 0 }));
}

if (has("compare")) {
  // the live result's frames next to the original's, at the same moments (every 4 s)
  const runId = arg("compare"), out = path.resolve(arg("out", "milo-golden.png"));
  const { data: run } = await admin.from("blocky_worlds_runs").select("*").eq("id", runId).single();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "milo-cmp-"));
  const live = path.join(tmp, "live.mp4");
  if (!run.files?.final) throw new Error(`the run has no video yet (status ${run.status}${run.error_code ? `, ${run.error_code}` : ""})`);
  const { data: v, error } = await admin.storage.from(BUCKET).download(run.files.final);
  if (error) throw new Error(error.message);
  fs.writeFileSync(live, Buffer.from(await v.arrayBuffer()));
  const orig = path.join(MILO, "blender", "final.mp4");
  for (const [tag, f] of [["orig", orig], ["live", live]]) { fs.mkdirSync(path.join(tmp, tag)); spawnSync("ffmpeg", ["-v", "error", "-i", f, "-vf", "fps=1/4,scale=216:384", path.join(tmp, tag, "%03d.jpg")]); }
  py(`import sys,os
from PIL import Image, ImageDraw
tmp, out = sys.argv[1], sys.argv[2]
o = sorted(os.listdir(os.path.join(tmp, "orig"))); l = sorted(os.listdir(os.path.join(tmp, "live"))); n = max(len(o), len(l))
W, H, G = 216, 384, 26
img = Image.new("RGB", (n * W, 2 * (H + G)), (17, 17, 17)); d = ImageDraw.Draw(img)
for r, (name, fs) in enumerate([("ORIGINAL MILO (2026-11-15)", o), ("LIVE PIPELINE (golden test)", l)]):
    d.text((6, r * (H + G) + 6), name, fill=(190, 242, 100))
    for i, f in enumerate(fs):
        img.paste(Image.open(os.path.join(tmp, "orig" if r == 0 else "live", f)).convert("RGB"), (i * W, r * (H + G) + G))
        d.text((i * W + 4, r * (H + G) + G + 4), f"{i * 4}s", fill=(255, 210, 63))
img.save(out, quality=88)`, tmp, out);
  console.log(JSON.stringify({ wrote: out, status: run.status, costUsd: run.cost_usd }));
}
