// Puts a finished Zyvo Studio video into the Content Machine Queue as a "video" (a cm_generations row of kind
// "making_of"), so the owner can download, post, mark as posted and track it like a slideshow (owner, 2026-10-30).
// Uploads the MP4 and a cover still to the private bucket under studio/<idea id>/, writes the idea (account, template,
// CTA variant in the recipe: Analytics groups by them), the video, the platform packages (honest copy: fact-sheet and
// measured claims only) and the real spend in the ledger. Refuses to publish the same video twice (by its sha256).
//   node publishToQueue.mjs <episode publish.json>      (prints the plan; --apply writes)
//   ... --update <idea id> --apply   replaces the video of an existing Queue item (new file names; spec.spendNew is added)
import fs from "node:fs";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { admin } from "file:///C:/Users/Public/Zylo/scripts/blocky/lib.mjs";

const [specPath] = process.argv.slice(2);
const apply = process.argv.includes("--apply");
const updateId = process.argv.includes("--update") ? process.argv[process.argv.indexOf("--update") + 1] : null;
const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
const db = admin();
const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data; };
const BUCKET = "content-machine";

const mp4 = fs.readFileSync(spec.mp4);
const sha = crypto.createHash("sha256").update(mp4).digest("hex");
const dup = must(await db.from("cm_generations").select("id, idea_id").eq("kind", "making_of").contains("files", { sha256: sha }), "duplicate check");
if (dup.length) { console.log(`already in the Queue (idea ${dup[0].idea_id}): nothing to do`); process.exit(0); }
const dur = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", spec.mp4]).toString().trim());
const cover = spec.mp4.replace(/\.mp4$/, "_cover.png");
execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(spec.coverAt ?? 1), "-i", spec.mp4, "-frames:v", "1", cover]);

const ideaId = updateId ?? crypto.randomUUID();
const base = `studio/${ideaId}`;
const link = (platform) => `https://www.tryzyvo.com${spec.route}?utm_source=${platform}&utm_medium=social&utm_campaign=studio_${spec.template}&utm_content=${ideaId}`;
const packages = Object.entries(spec.packages).map(([platform, p]) => ({ platform, title: p.title ?? null, caption: p.caption, hashtags: p.hashtags ?? [], ai_label_required: true,
  suggested_post_time: p.post_time ?? null, compliance: { link: link(platform), claims: spec.claims } }));
console.log(JSON.stringify({ idea: ideaId, title: spec.title, account: spec.account, template: spec.template, cta: spec.cta, seconds: dur, mb: (mp4.length / 1e6).toFixed(1), packages: packages.map((p) => p.platform), spend: spec.spend }, null, 1));
if (!apply) process.exit(0);

if (updateId) {
  const [g] = must(await db.from("cm_generations").select("id, cost_usd, files").eq("idea_id", updateId).eq("kind", "making_of"), "the item");
  if (!g) throw new Error(`no Studio video for idea ${updateId}`);
  const v = `v${Date.now().toString(36)}`;
  for (const [path, file, type] of [[`${base}/${v}_video.mp4`, spec.mp4, "video/mp4"], [`${base}/${v}_cover.png`, cover, "image/png"]]) {
    const { error } = await db.storage.from(BUCKET).upload(path, fs.readFileSync(file), { contentType: type, upsert: false });
    if (error) throw new Error(`upload ${path}: ${error.message}`);
  }
  const add = (spec.spendNew ?? []).reduce((a, x) => a + x.usd, 0);
  must(await db.from("cm_generations").update({ video_path: `${base}/${v}_video.mp4`, thumbnail_path: `${base}/${v}_cover.png`, duration_s: dur,
    files: { mp4: `${base}/${v}_video.mp4`, pngs: [`${base}/${v}_cover.png`], sha256: sha, previous: g.files }, cost_usd: Number(g.cost_usd) + add, updated_at: new Date().toISOString() }).eq("id", g.id).select("id"), "update the video");
  if (spec.spendNew?.length) must(await db.from("cm_spend_ledger").insert(spec.spendNew.map((x) => ({ idea_id: updateId, provider: "other", lane: "studio", operation: x.operation, estimated_usd: x.usd, actual_usd: x.usd, status: "settled", local_day: x.day, request_ref: x.ref ?? null, settled_at: new Date().toISOString() }))).select("id"), "ledger");
  if (spec.packages) for (const [platform, pk] of Object.entries(spec.packages)) must(await db.from("cm_packages").update({ caption: pk.caption, title: pk.title ?? null, hashtags: pk.hashtags ?? [] }).eq("generation_id", g.id).eq("platform", platform).select("id"), `package ${platform}`);
  // a re-render keeps the item in step: its measured length feeds the Studio score, its scorecard stays with it
  if (spec.recipe) {
    const [idea] = must(await db.from("cm_ideas").select("recipe, compliance").eq("id", updateId), "the idea");
    must(await db.from("cm_ideas").update({ recipe: { ...idea.recipe, ...spec.recipe }, hook: spec.hook, ...(spec.retention ? { compliance: { ...idea.compliance, retention: spec.retention } } : {}) }).eq("id", updateId).select("id"), "update the idea");
  }
  console.log(`updated: idea ${updateId} now plays ${v}_video.mp4 (${dur.toFixed(1)} s); +$${add.toFixed(4)} recorded`);
  process.exit(0);
}

for (const [path, file, type] of [[`${base}/video.mp4`, spec.mp4, "video/mp4"], [`${base}/cover.png`, cover, "image/png"]]) {
  const { error } = await db.storage.from(BUCKET).upload(path, fs.readFileSync(file), { contentType: type, upsert: false });
  if (error) throw new Error(`upload ${path}: ${error.message}`);
}
must(await db.from("cm_ideas").insert({
  id: ideaId, status: "done", source: "machine", format: `studio_${spec.template}`, zyvo_tool: spec.template, title: spec.title, hook: spec.hook, concept: spec.concept,
  script: spec.script, making_of_angle: "how I made this with Zyvo", target_platforms: Object.keys(spec.packages), account: spec.account,
  // short videos carry their recipe (hook type, length, end trigger, loop: Analytics compares them) and the Retention scorecard
  recipe: { kind: "video", template: spec.template, cta: spec.cta, format: `studio_${spec.template}`, style: "studio", hook_type: "question", account: spec.account, platform: "tiktok", ...(spec.recipe ?? {}) },
  compliance: { ok: true, flagged: false, problems: [], claims: spec.claims, measured: spec.measured, ...(spec.retention ? { retention: spec.retention } : {}) }, dry_run: false,
}).select("id"), "idea");
const gen = must(await db.from("cm_generations").insert({
  idea_id: ideaId, kind: "making_of", status: "done", video_path: `${base}/video.mp4`, thumbnail_path: `${base}/cover.png`, duration_s: dur, aspect: "9:16",
  files: { mp4: `${base}/video.mp4`, pngs: [`${base}/cover.png`], sha256: sha }, cost_usd: spec.spend.reduce((a, s) => a + s.usd, 0),
}).select("id").single(), "generation");
must(await db.from("cm_packages").insert(packages.map((p) => ({ ...p, generation_id: gen.id }))).select("id"), "packages");
if (spec.spend.length) must(await db.from("cm_spend_ledger").insert(spec.spend.map((s) => ({ idea_id: ideaId, provider: "other", lane: "studio", operation: s.operation, estimated_usd: s.usd, actual_usd: s.usd, status: "settled", local_day: s.day, request_ref: s.ref ?? null, settled_at: new Date().toISOString() }))).select("id"), "ledger");
console.log(`in the Queue: idea ${ideaId} (Zyvo account), ${packages.length} packages, $${spec.spend.reduce((a, s) => a + s.usd, 0).toFixed(4)} recorded`);
