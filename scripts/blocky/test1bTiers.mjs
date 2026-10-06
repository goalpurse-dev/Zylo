// Blocky Stories test 1b: the same clip C on V3 and V4, to compare against V2.
// Picture C, the line and the clip prompt are taken unchanged from test 1's
// results, and each request has the shape production sends for that tier
// (clips.js#clipTask), so the only difference is the model:
//   V3 = Seedance 2.0 Mini, 5 s · V4 = Veo 3.1 Fast, 6 s
// Nobody is charged credits (worker raw_test / raw_poll). ONE attempt per
// tier: a tier already in results.json is never sent again, only polled.
//   node scripts/blocky/test1bTiers.mjs [v3|v4]                      prints the plan, sends nothing
//   BLOCKY_ALLOW_PAID=1 node scripts/blocky/test1bTiers.mjs [v3|v4]   runs it (about $1.31; stage cap $1.40)
import fs from "fs";
import path from "path";
import { openBlockyBudget, paidCallsAllowed } from "./paidGuard.mjs";
import { ROOT, worker, writeJson } from "./lib.mjs";
import { clipTask } from "../../supabase/functions/_shared/blocky/clips.js";
import { videoModel } from "../../supabase/functions/_shared/blocky/models.js";

const OUT = "data/blocky-tests/test1b";
const RESULTS = path.join(ROOT, OUT, "results.json");
const c = JSON.parse(fs.readFileSync(path.join(ROOT, "data/blocky-tests/test1/results.json"), "utf8")).items.C;
const TIERS = [
  { key: "v3", label: "V3 · Seedance 2.0 Mini", durationSec: 5, perSec: 0.0817 },
  { key: "v4", label: "V4 · Veo 3.1 Fast", durationSec: 6, perSec: 0.15 },
].filter((t) => !process.argv[2] || process.argv[2] === t.key);
for (const t of TIERS) {
  t.model = videoModel(t.key).air;
  t.expectUsd = Math.ceil(t.durationSec * t.perSec * 100 + 1) / 100;
  t.task = clipTask({ quality: t.key, prompt: c.clip.prompt, imageUrl: c.picture.url, aspect: "9:16", durationSec: t.durationSec });
  if (c.clip.prompt.length > videoModel(t.key).providerPromptMax) throw new Error(`${t.key}: prompt over the model's limit`);
}

if (!paidCallsAllowed()) {
  console.log(`LINE: ${c.line}\nPICTURE: test 1 picture C (${c.picture.file})\nPROMPT (${c.clip.prompt.length} chars, same as the V2 clip):\n${c.clip.prompt}\n`);
  for (const t of TIERS) console.log(`${t.label}: ${t.model}, ${t.durationSec} s, about $${(t.durationSec * t.perSec).toFixed(2)}`);
  console.log("\nNothing was sent. Run with BLOCKY_ALLOW_PAID=1 to send.");
  process.exit(0);
}

const budget = openBlockyBudget("tiers");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = fs.existsSync(RESULTS) ? JSON.parse(fs.readFileSync(RESULTS, "utf8")) : { line: c.line, words: c.words, picture: c.picture.file, prompt: c.clip.prompt, items: {}, notes: [] };
const save = () => writeJson(`${OUT}/results.json`, out);
const log = (m) => { console.log(m); out.notes.push(m); };

for (const t of TIERS) {
  let row = out.items[t.key];
  if (!row) {
    const release = budget.reserve(t.expectUsd, t.label);
    row = out.items[t.key] = { key: t.key, label: t.label, model: t.model, durationSec: t.durationSec, state: "sent", at: new Date().toISOString() };
    save();
    const sub = await worker({ action: "raw_test", task: t.task, label: `blocky-tiers-${t.key}` });
    if (!sub.ok || !sub.taskUUID) {
      const error = String(sub.error ?? sub.message ?? sub.code ?? "refused").slice(0, 500);
      // "model not allowed" means the worker never sent it anywhere: not an attempt, so the tier stays unsent.
      if (/model not allowed/.test(error)) { delete out.items[t.key]; release(); save(); log(`${t.label}: the worker's test allow-list doesn't include ${t.model} yet; nothing was sent`); continue; }
      Object.assign(row, { state: "refused", error, cost: 0, callId: sub.callId ?? null });
      budget.record(0, `tiers ${t.key} refused`, t.expectUsd);
      save();
      log(`${t.label}: refused · ${error}`);
      continue;
    }
    Object.assign(row, { state: "pending", taskUUID: sub.taskUUID, callId: sub.callId });
    save();
  }
  if (row.state !== "pending") continue;
  const t0 = Date.now();
  let r = { state: "pending" };
  while (r.state === "pending" && Date.now() - t0 < 20 * 60_000) {
    await sleep(10_000);
    r = await worker({ action: "raw_poll", taskUUID: row.taskUUID, callId: row.callId });
    r.state ??= "pending";
  }
  if (r.state === "pending") { log(`${t.label}: still at the provider after 20 min; run again to keep polling (nothing is re-sent)`); continue; }
  Object.assign(row, { state: r.state, url: r.url ?? null, cost: Number(r.cost ?? 0), error: r.error ?? null, seconds: Math.round((Date.now() - new Date(row.at).getTime()) / 1000) });
  if (r.url) {
    row.file = `clips/C-${t.key}.mp4`;
    fs.mkdirSync(path.join(ROOT, OUT, "clips"), { recursive: true });
    fs.writeFileSync(path.join(ROOT, OUT, row.file), Buffer.from(await (await fetch(r.url)).arrayBuffer()));
  }
  budget.record(row.cost, `tiers ${t.key}${r.state === "error" ? " (failed)" : ""}`, t.expectUsd);
  save();
  log(`${t.label}: ${r.state} $${row.cost.toFixed(4)} = $${(row.cost / t.durationSec).toFixed(4)}/s${r.error ? ` · ${r.error}` : ""}`);
}

// Speech-to-text with word times (whisper-1, about $0.0005 per clip), once per clip.
const toHear = Object.values(out.items).filter((r) => r.file && !r.heard);
if (toHear.length) {
  budget.reserve(0.01, "transcripts");
  for (const row of toHear) {
    const form = new FormData();
    form.append("file", new Blob([fs.readFileSync(path.join(ROOT, OUT, row.file))], { type: "video/mp4" }), "clip.mp4");
    form.append("model", "whisper-1");
    form.append("language", "en");
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "word");
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: form });
    const j = await res.json().catch(() => ({}));
    row.heard = { text: j.text ?? `(HTTP ${res.status} ${j.error?.message ?? ""})`, words: (j.words ?? []).map((w) => ({ w: w.word, s: w.start, e: w.end })), audioSec: j.duration ?? null };
    save();
    log(`${row.label} heard: ${row.heard.text}`);
  }
  budget.record(toHear.length * 0.0005, "tiers transcripts (whisper-1)", 0.01);
}
console.log(budget.summary());
