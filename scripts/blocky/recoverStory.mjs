// A sample story whose answer never reached this machine (the connection dropped while the
// function was still working): the function finished and logged every writer and editor call,
// so the story is rebuilt from those logged answers with the same code, at no new cost.
// Nothing is asked of a model here. The cost recorded is the sum of the logged calls.
//   node scripts/blocky/recoverStory.mjs r2-countdown-30 2026-10-07T21:53:20Z 2026-10-07T21:55:10Z
import fs from "fs";
import path from "path";
import { ROOT, admin, writeJson } from "./lib.mjs";
import { openBlockyBudget } from "./paidGuard.mjs";
import { runPlanner } from "../../supabase/functions/_shared/blocky/planner.js";

const [key, from, to] = process.argv.slice(2);
const FILE = path.join(ROOT, "data/blocky-tests/stories/results.json");
const out = JSON.parse(fs.readFileSync(FILE, "utf8"));
const row = out.stories[key];
if (!row || row.state !== "sent") throw new Error(`${key} is not a story waiting for its answer (state: ${row?.state})`);
const db = admin();
const { data: calls, error } = await db.from("blocky_ai_calls").select("created_at, purpose, cost_usd, response").gte("created_at", from).lte("created_at", to).order("created_at");
if (error) throw new Error(error.message);
const { data: chars } = await db.from("blocky_characters").select("*").in("id", row.castIds);
const cast = row.castIds.map((id) => chars.find((c) => c.id === id));
const names = Object.fromEntries(chars.map((c) => [c.id, c.name]));
const answer = (c) => (c.response?.content ?? []).find((b) => b.type === "tool_use")?.input;
const writer = calls.filter((c) => !/script_review/.test(c.purpose));
const editor = calls.filter((c) => /script_review/.test(c.purpose));
const asked = [];
const next = (list, kind) => async (o) => { const c = list.shift(); if (!c) throw new Error(`the log has no more ${kind} answers (asked for ${o.purpose})`); asked.push(`${o.purpose} <- ${c.purpose}`); return { data: answer(c), costUsd: Number(c.cost_usd) }; };
const r = await runPlanner({ source: "prompt", cast, prompt: row.prompt, quality: "v2", lengthSec: row.lengthSec, aspect: "9:16", llm: next(writer, "writer"), reviewLlm: next(editor, "editor") });
if (writer.length || editor.length) throw new Error(`the replay used fewer answers than were logged (${writer.length} writer, ${editor.length} editor left): not the same run`);
console.log(asked.join("\n"));
const p = r.plan;
const cost = calls.reduce((s, c) => s + Number(c.cost_usd), 0);
Object.assign(row, {
  state: "written", recovered: "rebuilt from the function's logged calls after the connection dropped; no new call", cost, calls: r.attempts, title: p.title, premise: p.premise, emotion: p.emotion, assumed: p.assumed ?? null, twists: p.twists ?? null, twist: p.twist, forcedBy: p.forcedBy ?? null, consequence: p.consequence ?? null, winner: names[p.winnerId] ?? null, revealScene: p.revealScene, lengthSec_made: p.lengthSec,
  roles: Object.fromEntries(Object.entries(p.roles ?? {}).map(([id, role]) => [names[id] ?? id, role])),
  lines: p.scenes.map((s) => ({ speaker: names[s.speakerId] ?? s.speakerId, line: s.line, words: s.line.split(/\s+/).length, seconds: s.durationSec, raises: s.raises, action: s.action, shot: s.shot, with: s.presentIds.map((id) => names[id] ?? id) })),
  review: r.review ? { ok: r.review.ok, rounds: r.review.rounds ?? 0, rewritten: r.review.rewritten, left: r.review.left ?? r.review.problems ?? [], note: r.review.note ?? null, skipped: r.review.skipped ?? null, history: r.review.history ?? null } : null,
});
openBlockyBudget("twists2").record(cost, `story ${key} (recovered from the log)`, 0);
writeJson("data/blocky-tests/stories/results.json", out);
console.log(`${key}: "${p.title}" $${cost.toFixed(4)} checks: ${row.review.ok ? "passed" : `left ${row.review.left.length}`} after ${row.review.rounds} rewrite(s)${row.review.note ? ` (${row.review.note})` : ""}`);
