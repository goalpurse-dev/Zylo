// Zyvo Studio: the local studio worker (owner, 2026-10-30). Runs on the laptop, picks up the Studio tab's jobs and
// makes each video at $0: the reused creation's kit (studioKit.mjs: its final video, moments, upscaled frames, real
// input screens re-entered on the internal account, real outputs), the script (shortScripts.mjs makeScript: the
// job's recipe), audio + render + Retention scorecard (buildShort.sh), then the Queue item (publishToQueue.mjs).
// While it is off, jobs wait (the tab says so). A heartbeat every 30 s; one job at a time.
//   node worker.mjs [--once]
// env: PROTO_DIR (the render folder), PICS_DIR (the real-output pool), STUDIO_SCRATCH (the voice takes' root),
//      SRC_WORK (the recorded nav cards + wall), ESRGAN_DIR, KITS_DIR (default <STUDIO_SCRATCH>/kits)
// Paid steps: only the frame-0 rating, when "Rate frame 0" is on in Settings (~$0.0006, CAP_USD-guarded). A job that
// needs a NEW creation is never run here: its generation (~$1.70) is a separate, owner-approved run.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { admin } from "file:///C:/Users/Public/Zylo/scripts/blocky/lib.mjs";
import { makeScript } from "./shortScripts.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ONCE = process.argv.includes("--once");
const env = process.env;
for (const k of ["PROTO_DIR", "PICS_DIR", "STUDIO_SCRATCH", "SRC_WORK"]) if (!env[k]) { console.error(`set ${k}`); process.exit(2); }
const KITS = env.KITS_DIR ?? path.join(env.STUDIO_SCRATCH, "kits");
const OUT = path.join(HERE, "..", "..", "content", "studio-previews", "worker");
fs.mkdirSync(OUT, { recursive: true });
const ID = `${os.hostname().toLowerCase().replace(/[^a-z0-9-]/g, "")}-studio`.slice(0, 60);
const db = admin();
const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data; };
const winPath = (p) => p.replace(/\\/g, "/");

async function heartbeat() {
  await db.from("cm_studio_workers").upsert({ id: ID, last_seen: new Date().toISOString(), info: { host: os.hostname(), gpu: "laptop (local)", version: "studio-worker 1" } });
}
async function claim() {
  const [next] = must(await db.from("cm_studio_jobs").select("id").eq("status", "queued").order("created_at").limit(1), "queued jobs");
  if (!next) return null;
  const rows = must(await db.from("cm_studio_jobs").update({ status: "claimed", worker: ID, started_at: new Date().toISOString(), heartbeat_at: new Date().toISOString(), progress: "starting", updated_at: new Date().toISOString() })
    .eq("id", next.id).eq("status", "queued").select("*"), "claim");
  return rows[0] ?? null;   // another worker took it
}
const progress = async (job, text) => { console.log(`[${job.id.slice(0, 8)}] ${text}`); await db.from("cm_studio_jobs").update({ progress: text, heartbeat_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", job.id); };
// Never blocks: the heartbeat keeps beating through a long step (a blocking call made the tab say "off" mid-job), and
// the step's own lines show in the window.
const run = (cmd, args, opts = {}) => new Promise((resolve, reject) => {
  const c = spawn(cmd, args, { ...opts, stdio: ["ignore", "pipe", "pipe"], env: { ...env, MSYS_NO_PATHCONV: "1", ...(opts.env ?? {}) } });
  let out = "", err = "";
  c.stdout.on("data", (d) => { out += d; process.stdout.write(d); });
  c.stderr.on("data", (d) => { err += d; });
  c.on("error", reject);
  c.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`${path.basename(args[0] ?? cmd)} failed: ${(err || out).trim().split("\n").slice(-3).join(" | ").slice(0, 300)}`))));
});

async function make(job) {
  if (job.source?.kind !== "fruit_story") throw new Error("this job needs a NEW creation: that generation (~$1.70) runs separately after your go (fruitRun.mjs on the internal account), not in the worker");
  const sid = job.source.id;
  await progress(job, "building the kit (the real video, its moments, its input screens re-entered)");
  const kitFile = path.join(KITS, sid, "kit.json");
  if (!fs.existsSync(kitFile)) await run("node", [path.join(HERE, "studioKit.mjs"), sid, KITS], { env: { ESRGAN_DIR: env.ESRGAN_DIR ?? "" } });
  const K = JSON.parse(fs.readFileSync(kitFile, "utf8"));
  const brandSpans = K.moments.shots.filter((s) => s.brand).map((s) => [s.a, s.b]);
  const kit = { file: K.file, hq_dir: K.hq_dir, duration: K.duration, measured: null, input: K.input, title: K.story.title, phone_skip: brandSpans, moments: { open: K.moments.open, ending: K.moments.ending } };
  const script = makeScript(job.recipe, kit);
  const work = path.join(KITS, sid, "jobs", job.id), mp4 = winPath(path.join(OUT, `studio_${job.id.slice(0, 8)}_${script.variant}.mp4`));
  fs.mkdirSync(work, { recursive: true });
  const scriptFile = path.join(work, "script.json");
  fs.writeFileSync(scriptFile, JSON.stringify(script, null, 1));

  await progress(job, `rendering ${script.variant} (voices reused, laptop GPU)`);
  await run("bash", [path.join(HERE, "buildShort.sh"), winPath(scriptFile), winPath(work), mp4], { env: { SRC_WORK: winPath(path.join(KITS, sid, "work")), PAYOFF_WORDS: winPath(K.words) } });
  if (!fs.existsSync(mp4)) throw new Error("the render made no video");

  let spend = 0;
  const s = must(await db.from("cm_settings").select("studio_rate_frame0").eq("id", true).single(), "settings");
  if (s.studio_rate_frame0) {
    await progress(job, "rating frame 0 (the fast model, ~$0.0006)");
    const out = await run("node", [path.join(HERE, "rateFrame0.mjs"), mp4, winPath(work)], { env: { CAP_USD: "0.002" } });
    spend += Number(out.match(/total \$([\d.]+)/)?.[1] ?? 0);
    await run("node", [path.join(HERE, "scoreShort.mjs"), winPath(work), mp4, mp4.replace(/\.mp4$/, "_scorecard.md")], { env: { PAYOFF_WORDS: winPath(K.words) } });
  }

  await progress(job, "putting it in the Queue");
  const spec = path.join(work, "publish.json");
  await run("node", [path.join(HERE, "shortPublish.mjs"), winPath(scriptFile), mp4, winPath(spec), ...(spend ? [String(spend), "studio.frame0_rating (fast model)"] : [])], { env: { KIT: winPath(kitFile) } });
  const pub = await run("node", [path.join(HERE, "publishToQueue.mjs"), winPath(spec), "--apply"]);
  const ideaId = pub.match(/idea ([0-9a-f-]{36})/)?.[1];
  if (!ideaId) throw new Error(`publish: ${pub.trim().slice(-200)}`);
  const card = JSON.parse(fs.readFileSync(mp4.replace(/\.mp4$/, "_scorecard.json"), "utf8"));
  return { ideaId, spend, passed: `${card.rows.filter((r) => r.result === "PASS").length}/${card.rows.length}` };
}

console.log(`studio worker ${ID}: ${ONCE ? "one job" : "waiting for jobs"} (Ctrl+C stops it; jobs wait while it's off)`);
await heartbeat();
// jobs this laptop's worker was running when it stopped go back in line, in their order (they'd stay "Rendering" forever)
const orphans = must(await db.from("cm_studio_jobs").update({ status: "queued", worker: null, started_at: null, heartbeat_at: null, progress: null, updated_at: new Date().toISOString() }).eq("status", "claimed").eq("worker", ID).select("id"), "orphans");
if (orphans.length) console.log(`${orphans.length} unfinished job(s) put back in line`);
const beat = setInterval(() => heartbeat().catch(() => {}), 30_000);
for (;;) {
  const job = await claim().catch((e) => { console.log(`claim: ${e.message}`); return null; });
  if (!job) { if (ONCE) break; await new Promise((r) => setTimeout(r, 20_000)); continue; }
  try {
    const r = await make(job);
    await db.from("cm_studio_jobs").update({ status: "done", idea_id: r.ideaId, spend_usd: r.spend, progress: `in the Queue · scorecard ${r.passed} rows pass`, finished_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", job.id);
    console.log(`[${job.id.slice(0, 8)}] done: idea ${r.ideaId} (${r.passed} rows pass)`);
  } catch (e) {
    await db.from("cm_studio_jobs").update({ status: "failed", error: String(e.message).slice(0, 500), finished_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", job.id);
    console.log(`[${job.id.slice(0, 8)}] failed: ${e.message}`);
  }
  if (ONCE) break;
}
clearInterval(beat);
await new Promise((r) => setTimeout(r, 300));
