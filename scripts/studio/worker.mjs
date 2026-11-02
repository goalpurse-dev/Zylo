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
import { writeStory, recentScripts } from "./storyWriter.mjs";
import { createBudgetGuard } from "file:///C:/Users/Public/Zylo-contentmachine/supabase/functions/_shared/contentMachine/budgetGuard.js";
import { createStore } from "file:///C:/Users/Public/Zylo-contentmachine/supabase/functions/_shared/contentMachine/store.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
for (const line of fs.readFileSync("C:/Users/Public/Zylo/.env.local", "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
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
const retry = async (fn, what, tries = 6) => {
  for (let i = 1; ; i++) { try { return await fn(); } catch (e) { if (i >= tries) throw e; console.log(`${what} failed (${String(e.message).slice(0, 90)}): trying again in 30 s`); await new Promise((r) => setTimeout(r, 30000)); } }
};
/** A job's final state must land: a failed write is thrown and retried instead of being lost. */
const setJob = (id, patch) => retry(async () => { const r = await db.from("cm_studio_jobs").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).select("id"); if (r.error) throw new Error(r.error.message); }, "the job update");
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

// Studio v2 (Master Prompt v2): a job with an angle: the script is written fresh, its new voice lines made, both through
// the Budget Guard; rendered by story.js in its own world; into the Queue with captions, a search title and its recipe.
const guard = createBudgetGuard({ store: createStore(db) });
// the input panel in each template's page, CSS px of 1280x860
const TYPED_CROP = { ai_fruit_story: [236, 440, 692, 800], blocky_stories: [236, 240, 692, 560], cutaway: [236, 130, 668, 480], long_form: [120, 130, 1200, 560] };
const screensSpots = (t) => { const f = path.join(env.SRC_WORK, `screens_${t}`, "spots.json"); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : {}; };
const VOICE_USD_PER_CHAR = 0.0002, VOICE_CAP_PER_VIDEO = 0.25;
const buildKit = (job, light) => run("node", [path.join(HERE, "studioKit.mjs"), job.source.id, KITS, job.template], { env: { ESRGAN_DIR: env.ESRGAN_DIR ?? "", ...(light ? { KIT_LIGHT: "1" } : {}) } });

/** Step 1: write the script and stop. It waits for the owner's approval in the Studio tab. */
async function writeScriptJob(job) {
  const sid = job.source.id, kitFile = path.join(KITS, sid, "kit.json");
  await progress(job, "reading the creation (its words and moments)");
  if (!fs.existsSync(kitFile)) await buildKit(job, true);
  const kit = JSON.parse(fs.readFileSync(kitFile, "utf8"));
  await progress(job, "writing the script");
  const facts = must(await db.from("cm_facts").select("claim").eq("status", "active"), "facts");
  const angle = must(await db.from("cm_studio_angles").select("*").eq("key", job.recipe.angle).single(), "angle");
  // a remake replaces its video: the same creation under the same angle may show the same clips again
  const recent = recentScripts(KITS).filter((s) => !(job.source.remake_of && s.source_story === sid && s.recipe?.angle === job.recipe.angle));
  const w = await writeStory({ guard, apiKey: env.ANTHROPIC_API_KEY, facts, recipe: job.recipe, angle, kit, kitKey: "this", recent, spots: screensSpots(job.template) });
  const script = w.script;
  script.variant = job.id.slice(0, 8); script.lines.forEach((l, i) => { l.take = `story/${job.id}/line${String(i + 1).padStart(2, "0")}.mp3`; });
  const work = path.join(KITS, sid, "jobs", job.id); fs.mkdirSync(work, { recursive: true });
  fs.writeFileSync(path.join(work, "paid.json"), JSON.stringify({ usd: w.usd }));
  await setJob(job.id, { status: "script_review", script, spend_usd: w.usd, progress: "script ready: waiting for your approval", worker: null });
}

/** Step 2, only after the approval: the voices, the frames, the render, the Queue. */
async function makeStoryJob(job) {
  if (!job.script_approved_at || !job.script) throw new Error("this script was never approved: nothing renders without your approval");
  const sid = job.source.id;
  await progress(job, "building the kit (the real video, its moments, its input screens re-entered)");
  const kitFile = path.join(KITS, sid, "kit.json");
  if (!fs.existsSync(kitFile) || JSON.parse(fs.readFileSync(kitFile, "utf8")).light) await buildKit(job, false);
  const work = path.join(KITS, sid, "jobs", job.id); fs.mkdirSync(work, { recursive: true });
  const scriptFile = path.join(work, "script.json"), script = job.script;
  let usd = 0;
  const paidFile = path.join(work, "paid.json"), paid = (x) => { usd += x; fs.writeFileSync(paidFile, JSON.stringify({ usd })); };
  if (fs.existsSync(paidFile)) usd = JSON.parse(fs.readFileSync(paidFile, "utf8")).usd;
  fs.writeFileSync(scriptFile, JSON.stringify(script, null, 1));   // the approved script, with the owner's edits
  const takes = path.join(env.STUDIO_SCRATCH, "story", job.id); fs.mkdirSync(takes, { recursive: true });
  const chars = script.lines.filter((l, i) => !fs.existsSync(path.join(takes, `line${String(i + 1).padStart(2, "0")}.mp3`))).reduce((a, l) => a + (l.say ?? l.text).length, 0);
  if (chars) {
    await progress(job, `making its voices (${chars} characters)`);
    const est = chars * VOICE_USD_PER_CHAR; if (est > VOICE_CAP_PER_VIDEO) throw new Error(`the voices would cost up to $${est.toFixed(2)}, over the $${VOICE_CAP_PER_VIDEO} cap for a video`);
    const r = await guard.spend("other", "studio.voice_lines", est, async () => {
      const out = await run("node", [path.join(HERE, "elevenTakes.mjs"), winPath(scriptFile), winPath(takes)], { env: { CAP_USD: String(VOICE_CAP_PER_VIDEO) } });
      return { result: out, actualUsd: Number(out.match(/total \$([\d.]+)/)?.[1] ?? est) };
    }, { lane: "studio", live: true });
    paid(r.actualUsd ?? est);
  }
  const mp4 = winPath(path.join(OUT, `studio_${job.id.slice(0, 8)}_${job.recipe.angle}.mp4`));
  await progress(job, `rendering in the ${job.recipe.world} world (laptop GPU)`);
  // the kit's own typed-idea screen, cropped like the others
  const typed = path.join(work, "typed.jpg"), shots = path.join(KITS, sid, "input", "shots");
  const C = TYPED_CROP[job.template] ?? TYPED_CROP.ai_fruit_story;
  if (!fs.existsSync(typed) && fs.existsSync(shots)) { const f = fs.readdirSync(shots).filter((x) => /typed|picked/.test(x)).at(-1); if (f) await run("python", ["-c", `from PIL import Image; Image.open(r"${path.join(shots, f)}").convert("RGB").crop((${C.map((x) => x * 3).join(",")})).save(r"${typed}", quality=94)`]); }
  const screens = path.join(work, "_screens"); fs.mkdirSync(screens, { recursive: true });
  const shared = path.join(env.SRC_WORK, job.template === "ai_fruit_story" ? "screens" : `screens_${job.template}`);
  for (const f of fs.readdirSync(shared)) if (f.endsWith(".jpg")) fs.copyFileSync(path.join(shared, f), path.join(screens, f));
  if (fs.existsSync(typed)) fs.copyFileSync(typed, path.join(screens, "typed.jpg"));
  // a restart keeps a finished render (it is whole when ffprobe can read it)
  const whole = fs.existsSync(mp4) && (await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp4]).then((o) => Number(o) > 1).catch(() => false));
  if (!whole) await run("bash", [path.join(HERE, "buildStory.sh"), winPath(scriptFile), winPath(work), mp4], { env: { SCREENS: winPath(screens), MEDIA: winPath(path.join(KITS, sid, "media")) } });
  if (!fs.existsSync(mp4)) throw new Error("the render made no video");
  await progress(job, "putting it in the Queue");
  const spec = path.join(work, "publish.json");
  await run("node", [path.join(HERE, "storyPublish.mjs"), winPath(scriptFile), mp4, winPath(spec), String(usd)], { env: { IN_LEDGER: "1" } });
  // the network can be down for a while after the laptop wakes: the upload is tried again, not lost
  const pub = await retry(() => run("node", [path.join(HERE, "publishToQueue.mjs"), winPath(spec), "--apply"]), "the upload");
  const ideaId = pub.match(/idea ([0-9a-f-]{36})/)?.[1];
  if (!ideaId) throw new Error(`publish: ${pub.trim().slice(-200)}`);
  return { ideaId, spend: usd, passed: script.recipe.angle };
}

async function make(job) {
  if (!job.recipe?.angle || !job.source?.kind || job.source.kind === "generate") throw new Error("this job has no script to write: a NEW creation runs separately after your go, and older jobs aren't rendered here");
  if (!job.script_approved_at) { await writeScriptJob(job); return null; }
  return makeStoryJob(job);
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
    if (!r) { if (ONCE) break; continue; }   // the script waits for the owner
    await setJob(job.id, { status: "done", idea_id: r.ideaId, spend_usd: r.spend, progress: "in the Queue", finished_at: new Date().toISOString() });
    console.log(`[${job.id.slice(0, 8)}] done: idea ${r.ideaId}`);
  } catch (e) {
    await setJob(job.id, { status: "failed", error: String(e.message).slice(0, 500), finished_at: new Date().toISOString() });
    console.log(`[${job.id.slice(0, 8)}] failed: ${e.message}`);
  }
  if (ONCE) break;
}
clearInterval(beat);
await new Promise((r) => setTimeout(r, 300));
