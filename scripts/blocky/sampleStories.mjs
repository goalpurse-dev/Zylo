// Sample stories for the quality review (decision 40): the real writer and
// editor on the real project, TEXT ONLY. No pictures, no clips, nothing saved
// but the logged calls. Five ideas from five different story types at 20
// seconds, and two of them again at 30 seconds. ONE attempt per story: a
// story already in the results is never asked for again, and none is picked
// or dropped afterwards.
// Round 2 (decision 46, the twist round): the same five ideas at 30 seconds, after the twist rules.
// Paid calls are switched on for the run and off again whatever happens.
//   BLOCKY_ALLOW_PAID=1 node scripts/blocky/sampleStories.mjs            (round 1)
//   BLOCKY_ALLOW_PAID=1 node scripts/blocky/sampleStories.mjs --round=2
// --again=admin,rule: ideas whose first try in that round ended WITHOUT a story (a format check
// refused the draft; fixed since) get one try with the fixed code, under their own keys ("r2b-...").
// The failed tries stay on record.
import fs from "fs";
import path from "path";
import { ROOT, admin, worker, writeJson } from "./lib.mjs";
import { openBlockyBudget } from "./paidGuard.mjs";
import { BLOCKY_MODELS } from "../../supabase/functions/_shared/blocky/models.js";

const OUT = "data/blocky-tests/stories";
const FILE = path.join(ROOT, OUT, "results.json");
const ROUND = Number((process.argv.find((a) => a.startsWith("--round=")) ?? "--round=1").slice(8));
const ROUND_1 = [
  { key: "admin-20", type: "abusive admin", lengthSec: 20, castIds: ["vex", "noob"], prompt: "Vex bans players for breaking rules nobody has heard of, until Noob asks to see the rule list." },
  { key: "trade-20", type: "bad trade", lengthSec: 20, castIds: ["lux", "noob"], prompt: "Lux tricks Noob into trading away a starter pet, and it turns out to be the rarest pet on the server." },
  { key: "glitch-20", type: "glitch", lengthSec: 20, castIds: ["noob", "lux"], prompt: "Noob falls through the map and finds a room that should not exist." },
  { key: "rule-20", type: "sinister server rule", lengthSec: 20, castIds: ["vex", "lux", "noob"], prompt: "A new server rule says nobody may look at the leaderboard after midnight." },
  { key: "countdown-20", type: "countdown", lengthSec: 20, castIds: ["noob", "vex"], prompt: "A countdown appears over Noob's head and nobody will say what happens at zero." },
  { key: "admin-30", type: "abusive admin", lengthSec: 30, castIds: ["vex", "noob"], prompt: "Vex bans players for breaking rules nobody has heard of, until Noob asks to see the rule list." },
  { key: "rule-30", type: "sinister server rule", lengthSec: 30, castIds: ["vex", "lux", "noob"], prompt: "A new server rule says nobody may look at the leaderboard after midnight." },
];
// Round 2 and later: the first five ideas again, all at 30 seconds, under their own keys.
const AGAIN = (process.argv.find((a) => a.startsWith("--again=")) ?? "").slice(8).split(",").filter(Boolean);
const IDEAS = ROUND === 1 ? ROUND_1 : ROUND_1.slice(0, 5).filter((i) => !AGAIN.length || AGAIN.includes(i.key.split("-")[0])).map((i) => ({ ...i, key: `r${ROUND}${AGAIN.length ? "b" : ""}-${i.key.replace(/-\d+$/, "")}-30`, lengthSec: 30 }));
const STAGE = ROUND === 1 ? "stories" : `twists${ROUND}`;
// worst case: a draft, two rewrites, a repair or two and three checks (the twist round's prompts are longer)
const EXPECT_USD = ROUND === 1 ? 0.09 : 0.2;
const out = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { stories: {} };
for (const i of AGAIN.length ? IDEAS : []) if (out.stories[i.key.replace("b-", "-")]?.state !== "failed") throw new Error(`${i.key}: its first try did not fail, so it is not written again`);
const todo = IDEAS.filter((i) => !out.stories[i.key]);
if (!todo.length) { console.log("All stories are already on record."); process.exit(0); }
const db = admin();
const names = Object.fromEntries((await db.from("blocky_characters").select("id, name")).data.map((c) => [c.id, c.name]));
const budget = openBlockyBudget(STAGE);
const set = async (on) => { const { error } = await db.from("blocky_settings").update({ paid_calls: on }).eq("id", true); if (error) throw new Error(error.message); };
await set(true);
try {
  for (const idea of todo) {
    budget.reserve(EXPECT_USD, idea.key);
    out.stories[idea.key] = { ...idea, state: "sent", at: new Date().toISOString() };
    writeJson(`${OUT}/results.json`, out);
    const t0 = Date.now();
    const r = await worker({ action: "planner_test", model: BLOCKY_MODELS.planner, input: { source: "prompt", castIds: idea.castIds, prompt: idea.prompt, quality: "v2", lengthSec: idea.lengthSec, aspect: "9:16" } });
    const row = out.stories[idea.key];
    row.seconds = Math.round((Date.now() - t0) / 1000);
    if (!r.ok) Object.assign(row, { state: "failed", error: `${r.code}: ${r.message}`, details: r.details ?? null, cost: Number(r.costUsd ?? 0) });
    else {
      const p = r.plan;
      Object.assign(row, {
        state: "written", cost: Number(r.costUsd ?? 0), calls: r.attempts, title: p.title, premise: p.premise, emotion: p.emotion, assumed: p.assumed ?? null, twists: p.twists ?? null, twist: p.twist, forcedBy: p.forcedBy ?? null, consequence: p.consequence ?? null, winner: names[p.winnerId] ?? p.winnerId ?? null, revealScene: p.revealScene, lengthSec_made: p.lengthSec,
        roles: Object.fromEntries(Object.entries(p.roles ?? {}).map(([id, role]) => [names[id] ?? id, role])),
        lines: p.scenes.map((s) => ({ speaker: names[s.speakerId] ?? s.speakerId, line: s.line, words: s.line.split(/\s+/).length, seconds: s.durationSec, raises: s.raises, action: s.action, shot: s.shot, with: s.presentIds.map((id) => names[id] ?? id) })),
        review: r.review ? { ok: r.review.ok, rounds: r.review.rounds ?? 0, rewritten: r.review.rewritten, left: r.review.left ?? r.review.problems ?? [], note: r.review.note ?? null, skipped: r.review.skipped ?? null, history: r.review.history ?? null } : null,
      });
    }
    budget.record(row.cost, `story ${idea.key} (${row.state})`, EXPECT_USD);
    writeJson(`${OUT}/results.json`, out);
    console.log(`${idea.key}: ${row.state} $${row.cost.toFixed(4)} ${row.seconds}s ${row.state === "written" ? `"${row.title}" checks: ${row.review?.ok ? "passed" : `left ${row.review?.left?.length}`} after ${row.review?.rounds} rewrite(s)` : row.error}`);
  }
} finally {
  await set(false);
}
console.log(budget.summary());
const { data: paid } = await db.rpc("blocky_paid_state", { p_add_usd: 0 });
console.log(`Paid calls are ${paid.paid_calls ? "ON (!)" : "OFF"} again.`);
