// The avatar library's reference pictures (owner, 2026-10-08):
//   - every avatar of the roster, TWO pictures on Nano Banana 2 Lite with today's reference prompt
//     (roster.mjs#avatarPrompt, the four fixes in it);
//   - the reference check (avatarCheck.js) scores both and the better one is picked;
//   - an avatar whose two pictures BOTH fail the check is drawn once more, on Nano Banana Pro;
//   - Noob, Vex and Lux first: their pictures in the library were made before the fixes.
// Nothing goes live from here: the pictures and their scores land in data/blocky-tests/library/ and the
// sheet (pageLibrary.mjs) is for the owner's review. The library table is not touched.
// Nobody is charged credits (the worker's no-charge test actions; every call is logged with its real cost).
// ONE attempt per picture: a picture that was sent is never sent again; a request the worker refused before
// it reached the model (the switch, the daily cap) is not an attempt, and ends the run.
//   node scripts/blocky/makeLibrary.mjs                                    prints the plan and what is done, sends nothing
//   BLOCKY_ALLOW_PAID=1 node scripts/blocky/makeLibrary.mjs --max-usd 1.6  makes avatars until about that much is spent in this run
//   … --only noob,vex,lux                                                  only these avatars
import fs from "fs";
import path from "path";
import { ROOT, admin, rawTest, worker, writeJson } from "./lib.mjs";
import { openBlockyBudget, paidCallsAllowed } from "./paidGuard.mjs";
import { ROSTER, avatarPrompt } from "./roster.mjs";
import { pickBest } from "../../supabase/functions/_shared/blocky/avatarCheck.js";

const OUT = "data/blocky-tests/library";
const DIR = path.join(ROOT, OUT);
const FILE = path.join(DIR, "results.json");
const out = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { items: {}, checks: {}, avatars: {} };
const save = () => writeJson(`${OUT}/results.json`, out);
const arg = (name) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : null; };
const maxUsd = Number(arg("--max-usd") ?? Infinity);
const only = arg("--only")?.split(",") ?? null;
// A round is one wording of the reference prompt: "a" was the first run (2026-10-08); "t" is a small test of
// wording b; "b" is the run with it. A picture's key carries its round, so no picture is ever sent twice.
const ROUND = arg("--round") ?? "a";
const WORDING = ROUND === "a" ? "a" : "b";
const redo = arg("--redo")?.split(",") ?? [];
const noPro = process.argv.includes("--no-pro");

export const LITE = { key: "lite", label: "Nano Banana 2 Lite", model: "google:nano-banana@2-lite", expectUsd: 0.04 };
export const PRO = { key: "pro", label: "Nano Banana Pro", model: "google:4@2", expectUsd: 0.15 };
const CHECK_USD = 0.003;
const VERSIONS = Number(arg("--versions") ?? 2);
// The three whose library pictures were made before the fixes go first.
const FIRST = ["noob", "vex", "lux"];
const order = [...FIRST.map((id) => ROSTER.find((a) => a.id === id)), ...ROSTER.filter((a) => !FIRST.includes(a.id))].filter((a) => !only || only.includes(a.id));
const avatarFor = (a) => ({ name: a.name, head: a.head, torso: a.torso, legs: a.legs, accessory: a.accessory, face: a.face });
// Done: made in this round, or made earlier and passing the check (unless it is named in --redo).
const done = (a) => { const v = out.avatars[a.id]; return Boolean(v?.done) && !redo.includes(a.id) && (v.round === ROUND || (v.ok && ROUND !== "t")); };
const tag = ROUND === "a" ? "" : `${ROUND}-`;
const worstCase = VERSIONS * (LITE.expectUsd + CHECK_USD) + PRO.expectUsd + CHECK_USD;

if (!paidCallsAllowed()) {
  const left = order.filter((a) => !done(a));
  console.log(`Roster: ${ROSTER.length} avatars. Done: ${order.length - left.length}. To make: ${left.length} (${left.slice(0, 8).map((a) => a.name).join(", ")}${left.length > 8 ? ", …" : ""}).`);
  console.log(`Each avatar: ${VERSIONS} pictures on ${LITE.label} (about $${(VERSIONS * 0.035).toFixed(2)}) and ${VERSIONS} checks (about $${(VERSIONS * 0.0018).toFixed(4)}); a ${PRO.label} redo (about $0.134) only if both fail.`);
  console.log(`All ${left.length}: about $${(left.length * VERSIONS * 0.0368).toFixed(2)} if no redo is needed, about $${(left.length * VERSIONS * 0.0368 + left.length * 0.25 * 0.136).toFixed(2)} if one in four needs one.`);
  console.log("Nothing was sent.");
  process.exit(0);
}

fs.mkdirSync(DIR, { recursive: true });
const budget = openBlockyBudget("library");
const db = admin();
const { data: before } = await db.from("blocky_settings").select("paid_calls").eq("id", true).single();
const set = async (on) => { const { error } = await db.from("blocky_settings").update({ paid_calls: on }).eq("id", true); if (error) throw new Error(error.message); };
let spent = 0;
let stopped = null;

async function picture(a, key, engine) {
  if (out.items[key]) return out.items[key];   // one attempt per picture
  budget.reserve(engine.expectUsd, key);
  const row = (out.items[key] = { key, id: a.id, model: engine.model, engine: engine.key, state: "sent", at: new Date().toISOString() });
  save();
  const task = { taskType: "imageInference", model: engine.model, positivePrompt: avatarPrompt(a, { wording: WORDING }), width: 768, height: 1376, numberResults: 1, outputType: "URL", outputFormat: "JPG", outputQuality: 95 };
  const r = await rawTest(task, `blocky-library-${key}`, { everyMs: 2500, timeoutMs: 4 * 60_000 });
  if (r.state === "refused") {   // nothing was sent: not an attempt
    delete out.items[key];
    budget.record(0, `library: ${key} refused`, engine.expectUsd);
    save();
    stopped = r.error;
    return null;
  }
  Object.assign(row, { state: r.state, cost: r.cost, seconds: r.seconds, error: r.error ?? null, url: r.url ?? null });
  if (r.url) { row.file = `${key}.jpg`; fs.writeFileSync(path.join(DIR, row.file), Buffer.from(await (await fetch(r.url)).arrayBuffer())); }
  budget.record(r.cost, `library: ${key} (${r.state})`, engine.expectUsd);
  spent += r.cost;
  save();
  return row;
}
async function check(a, key) {
  const row = out.items[key];
  if (!row?.url) return null;
  if (out.checks[key]) return out.checks[key];
  budget.reserve(CHECK_USD, `check ${key}`);
  const r = await worker({ action: "avatar_check_test", imageUrl: row.url, avatar: avatarFor(a) });
  if (!r.ok && /PAID_CALLS|DAILY|CAP/i.test(`${r.code}`)) { budget.record(0, `library: check ${key} refused`, CHECK_USD); stopped = `${r.code}: ${r.message}`; return null; }
  out.checks[key] = r.ok ? { answer: r.answer, verdict: r.verdict, cost: r.costUsd } : { error: `${r.code}: ${r.message}`, cost: 0 };
  budget.record(r.ok ? r.costUsd : 0, `library: check ${key}`, CHECK_USD);
  spent += r.ok ? r.costUsd : 0;
  save();
  return out.checks[key];
}
async function avatar(a) {
  // A test picture on the same wording counts as one of the avatar's versions: it is not drawn again.
  const kept = WORDING === "b" && ROUND !== "t" && out.items[`${a.id}-t-lite-1`]?.url ? [`${a.id}-t-lite-1`] : [];
  const keys = [...kept, ...Array.from({ length: Math.max(0, VERSIONS - kept.length) }, (_, k) => `${a.id}-${tag}lite-${k + 1}`)];
  await Promise.all(keys.filter((k) => !kept.includes(k)).map((k) => picture(a, k, LITE)));
  if (stopped) return;
  await Promise.all(keys.map((k) => check(a, k)));
  if (stopped) return;
  const verdicts = keys.map((k) => out.checks[k]?.verdict ?? null);
  let picked = pickBest(verdicts) >= 0 ? keys[pickBest(verdicts)] : null;
  let model = LITE;
  // Both failed (or neither came out): once more, on Pro.
  if (!noPro && !verdicts.some((v) => v?.ok)) {
    const key = `${a.id}-${tag}pro-1`;
    await picture(a, key, PRO);
    if (stopped) return;
    await check(a, key);
    if (stopped) return;
    const pro = out.checks[key]?.verdict ?? null;
    const best = pickBest([...verdicts, pro]);
    if (best === keys.length) { picked = key; model = PRO; }
    else if (best >= 0) picked = keys[best];
  }
  const v = picked ? out.checks[picked]?.verdict : null;
  if (ROUND === "t") { (out.tests ??= {})[a.id] = { picked, score: v?.score ?? null, ok: Boolean(v?.ok), problems: v?.problems ?? [] }; save(); console.log(`${a.name} (test): ${picked}, ${v?.score}${v?.ok ? "" : " FAILS"}: ${(v?.problems ?? []).join("; ")}`); return; }
  out.avatars[a.id] = { done: true, round: ROUND, picked, model: picked ? model.label : null, score: v?.score ?? null, ok: Boolean(v?.ok), problems: v?.problems ?? [], at: new Date().toISOString() };
  save();
  console.log(`${a.name}: ${picked ? `${picked} (${model.label}), ${v.score}${v.ok ? "" : " FAILS"}${v.problems.length ? `: ${v.problems.join("; ")}` : ""}` : "no usable picture"}`);
}

if (!before.paid_calls) await set(true);
try {
  const todo = order.filter((a) => !done(a));
  for (let i = 0; i < todo.length && !stopped; i += 3) {
    const batch = todo.slice(i, i + 3);
    if (spent + batch.length * worstCase > maxUsd) { stopped = `this run's limit of $${maxUsd} would be passed`; break; }
    try { await Promise.all(batch.map(avatar)); }
    catch (e) { stopped = String(e?.message ?? e); }   // the ledger's own cap (paidGuard) lands here
  }
} finally {
  if (!before.paid_calls) await set(false);   // put back as it was; left alone if the owner had it on
}
const made = ROSTER.filter(done);
console.log(`\nDone: ${made.length} of ${ROSTER.length} avatars (${made.filter((a) => out.avatars[a.id].ok).length} pass the check; ${made.filter((a) => /Pro/.test(out.avatars[a.id].model ?? "")).length} on Pro). Spent in this run: $${spent.toFixed(4)}.${stopped ? ` Stopped: ${stopped}.` : ""}`);
console.log(budget.summary());
