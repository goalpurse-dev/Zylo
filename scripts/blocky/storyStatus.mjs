// What a Blocky story is doing right now, read from the database (free,
// read-only): the story, each scene's picture and clip, every job with its
// attempts and errors, every provider call with its cost, and today's spend
// against the cap. For when something looks stuck.
//   node scripts/blocky/storyStatus.mjs              the newest story
//   node scripts/blocky/storyStatus.mjs "part of the title"
//   node scripts/blocky/storyStatus.mjs <story id>
import { admin } from "./lib.mjs";

const db = admin();
const [arg] = process.argv.slice(2);
const must = ({ data, error }, what) => { if (error) throw new Error(`${what}: ${error.message}`); return data; };
const ago = (iso) => { if (!iso) return "-"; const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000); return s < 90 ? `${s}s ago` : s < 5400 ? `${Math.round(s / 60)} min ago` : `${(s / 3600).toFixed(1)} h ago`; };
const usd = (n) => `$${Number(n ?? 0).toFixed(4)}`;

let q = db.from("blocky_stories").select("*").order("created_at", { ascending: false }).limit(1);
if (arg && /^[0-9a-f-]{36}$/i.test(arg)) q = db.from("blocky_stories").select("*").eq("id", arg);
else if (arg) q = db.from("blocky_stories").select("*").ilike("title", `%${arg}%`).order("created_at", { ascending: false }).limit(1);
const story = must(await q, "story")[0];
const paid = must(await db.rpc("blocky_paid_state", { p_add_usd: 0 }), "paid state");
console.log(`Paid calls ${paid.paid_calls ? "ON" : "OFF"}; today ${usd(paid.spent_usd)} spent + ${usd(paid.in_flight_usd)} running of a $${Number(paid.cap_usd).toFixed(2)} cap${paid.on ? "" : paid.reason === "cap_reached" ? "  ← THE CAP IS REACHED" : ""}`);
const alerts = must(await db.from("blocky_provider_alerts").select("*"), "alerts");
for (const a of alerts) console.log(`Provider alert: ${a.provider} "${a.code}" ${String(a.message).slice(0, 120)} (last seen ${ago(a.last_seen_at)})`);
if (!story) { console.log(arg ? `No story matches "${arg}".` : "No Blocky story yet. If writing one failed, the calls below say why."); }
else {
  console.log(`\nSTORY "${story.title}"  ${story.id}`);
  console.log(`  status ${story.status}; final ${story.final_status}${story.final_error ? ` (${story.final_error})` : ""}; ${story.quality}, ${story.length_sec}s, ${story.aspect}; made ${ago(story.created_at)}, changed ${ago(story.updated_at)}${story.error ? `; error ${story.error_code}: ${story.error}` : ""}`);
  if (story.final_url) console.log(`  final video: ${story.final_url}`);
  const scenes = must(await db.from("blocky_story_scenes").select("*").eq("story_id", story.id).order("idx"), "scenes");
  for (const s of scenes) console.log(`  scene ${s.idx + 1} [${s.speaker_id}] picture ${s.image_status}${s.image_check !== "none" ? ` (check ${s.image_check}${s.image_check_notes ? `: ${String(s.image_check_notes).slice(0, 80)}` : ""})` : ""}; clip ${s.clip_status} ${s.duration_sec}s${s.error ? `; ${s.error_code}: ${String(s.error).slice(0, 100)}` : ""}  "${String(s.line).slice(0, 60)}"`);
  const jobs = must(await db.from("blocky_jobs").select("*").eq("story_id", story.id).order("created_at"), "jobs");
  console.log(`\nJOBS (${jobs.length})`);
  for (const j of jobs) console.log(`  ${j.kind.padEnd(5)} ${j.status.padEnd(13)} attempt ${j.attempt}/${j.max_attempts}  ${j.credits} credits  ${usd(j.cost_usd)}  made ${ago(j.created_at)}${j.submitted_at ? `, sent ${ago(j.submitted_at)}` : ""}${j.finished_at ? `, done ${ago(j.finished_at)}` : ""}${j.refunded_at ? "  REFUNDED" : ""}${j.error ? `  ${j.error_code ?? ""}: ${String(j.error).slice(0, 110)}` : ""}`);
  const ledger = must(await db.from("blocky_credit_ledger").select("operation, credits").eq("story_id", story.id), "ledger");
  const sum = (op) => ledger.filter((l) => l.operation === op).reduce((n, l) => n + l.credits, 0);
  console.log(`\nCREDITS charged ${sum("charge")}, refunded ${sum("refund")}, net ${sum("charge") - sum("refund")}`);
}
const calls = must(await (story
  ? db.from("blocky_ai_calls").select("*").eq("story_id", story.id).order("created_at")
  : db.from("blocky_ai_calls").select("*").order("created_at", { ascending: false }).limit(15)), "calls");
console.log(`\nPROVIDER CALLS (${calls.length})${story ? "" : " newest first"}`);
for (const c of calls) console.log(`  ${ago(c.created_at).padEnd(11)} ${String(c.provider).padEnd(9)} ${String(c.purpose).padEnd(18)} ${String(c.model).slice(0, 28).padEnd(28)} ${c.ok === null ? "RUNNING" : c.ok ? "ok     " : "FAILED "} ${usd(c.cost_usd)}${c.latency_ms ? ` ${(c.latency_ms / 1000).toFixed(1)}s` : ""}${c.error ? `  ${String(c.error).slice(0, 120)}` : ""}`);
console.log(`\nTotal for ${story ? "this story" : "these calls"}: ${usd(calls.reduce((n, c) => n + Number(c.cost_usd ?? 0), 0))}`);
