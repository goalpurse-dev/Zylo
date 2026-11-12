// Blocky Worlds: the human review page of one rendered video. Per narration line: time, the exact text, 3 stills
// (start / middle / end of the line's span, across its shots), what the line requires (who, nouns, actions, emotion,
// place), what the plan says, what the frames really show, and a verdict (match / partial / miss + the reason).
// The verdicts come from a hand-written review-verdicts.json (so a future run is judged the same way); the tool
// merges it, ranks the miss types and writes review.json + review.html (self-contained, opens from disk).
// Free and read-only: no paid call, no write anywhere but the output folder.
//   node scripts/blockyWorlds/engine/dev/reviewPage.mjs --dir <folder with final.mp4 + timeline.json [+ script.json]>
//   node scripts/blockyWorlds/engine/dev/reviewPage.mjs --run <run id> [--dir <folder>]   downloads the run's files first
//       (service key from C:\Users\Public\Zylo\.env.local, like dev/runTiming.mjs; never printed)
//   options: --out <folder> (default <dir>/review)   --verdicts <file> (default <out>/review-verdicts.json)
//            --offset <s> (timeline time -> final.mp4 time; default 0, checked against the durations)
//            --premise "<the user's topic>"   --frames (re-extract stills even when they exist)
// No verdicts file yet: a skeleton is written (every line "unjudged", requires filled from the planner's reading);
// look at review/strips/line_XX.jpg, fill it in, run again.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { extractKeys, describeShot, ruleById } from "../lib/visuals.js";

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const flag = (n) => args.includes(n);
const readJson = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const exists = (f) => { try { fs.accessSync(f); return true; } catch { return false; } };

// ---------------------------------------------------------------- 1. the files (optionally downloaded)
const runId = opt("--run");
let dir = opt("--dir") ?? (runId ? path.join(os.tmpdir(), "blocky-review", runId) : null);
if (!dir) { console.error("usage: reviewPage.mjs --dir <folder> | --run <run id> [--dir <folder>]"); process.exit(1); }
dir = path.resolve(dir);
fs.mkdirSync(dir, { recursive: true });
let premise = opt("--premise");

if (runId) premise = (await download(runId, dir)) ?? premise;

async function download(id, into) {
  const { paths, BUCKET } = await import("../../../../supabase/functions/_shared/blockyWorlds/render.js");
  const env = Object.fromEntries(fs.readFileSync("C:/Users/Public/Zylo/.env.local", "utf8").split(/\r?\n/).map((l) => l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]));
  const URL_ = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || "").replace(/\/$/, ""), KEY = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !KEY) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing in .env.local");
  const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
  const rest = async (q) => { const r = await fetch(`${URL_}/rest/v1/${q}`, { headers: H }); if (!r.ok) throw new Error(`${q.split("?")[0]}: ${r.status}`); return r.json(); };
  const [run] = await rest(`blocky_worlds_runs?select=*&id=eq.${id}`);
  if (!run) throw new Error(`run ${id} not found`);
  const p = paths(run);
  for (const [name, key] of [["timeline.json", p.timeline], ["visual-check.json", p.visualCheck], ["production.json", p.production], ["final.mp4", p.final]]) {
    const f = path.join(into, name);
    if (exists(f) && !flag("--fresh")) continue;
    const r = await fetch(`${URL_}/storage/v1/object/${BUCKET}/${key}`, { headers: H });
    if (!r.ok) { console.warn(`  ${name}: ${r.status} (skipped)`); continue; }
    fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
    console.log(`  downloaded ${name}`);
  }
  if (!exists(path.join(into, "script.json"))) fs.writeFileSync(path.join(into, "script.json"), JSON.stringify({ title: run.title, lines: run.lines }, null, 1));
  // the user's topic: run -> draft -> idea (best effort)
  try {
    const [d] = run.draft_id ? await rest(`blocky_worlds_drafts?select=idea_id,source&id=eq.${run.draft_id}`) : [];
    const [idea] = d?.idea_id ? await rest(`blocky_worlds_ideas?select=topic,idea&id=eq.${d.idea_id}`) : [];
    return idea?.topic ?? idea?.idea?.premise ?? idea?.idea?.rule ?? null;
  } catch { return null; }
}

const tl = readJson(path.join(dir, "timeline.json"));
const script = exists(path.join(dir, "script.json")) ? (readJson(path.join(dir, "script.json")).script ?? readJson(path.join(dir, "script.json"))) : { title: tl.title, lines: tl.lines };
const video = path.join(dir, "final.mp4");
if (!exists(video)) { console.error(`no final.mp4 in ${dir}`); process.exit(1); }
const out = path.resolve(opt("--out") ?? path.join(dir, "review"));
fs.mkdirSync(path.join(out, "stills"), { recursive: true });
fs.mkdirSync(path.join(out, "strips"), { recursive: true });
const verdictsFile = path.resolve(opt("--verdicts") ?? path.join(out, "review-verdicts.json"));

// ---------------------------------------------------------------- 2. timeline time -> final.mp4 time
const probe = (f) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString().trim());
const videoDur = probe(video);
let offset = opt("--offset") != null ? Number(opt("--offset")) : 0;
const drift = videoDur - tl.duration;
const offsetNote = opt("--offset") != null ? `offset ${offset} s (given)` :
  Math.abs(drift) < 0.35 ? `offset 0 s: final.mp4 ${videoDur.toFixed(2)} s = timeline ${tl.duration.toFixed(2)} s` :
  `offset 0 s assumed; final.mp4 is ${drift.toFixed(2)} s ${drift > 0 ? "longer (an end card / intro? check the captions in the stills; pass --offset if an intro)" : "shorter"} than the timeline`;
console.log(offsetNote);

// ---------------------------------------------------------------- 3. per line: span, shots, still times
const v = tl.visualWorld ?? {};
const vw = { people: new Map(Object.entries(v.people ?? {}).map(([id, name]) => [id, { name }])), alias: v.alias ?? {}, narrator: v.narrator ?? "Me",
  monster: v.monster ?? null, looseNames: new Set(v.looseNames ?? []), prop: v.prop ?? null, ...(v.beings?.length ? { beings: v.beings } : {}) };
const EMO = /\b(scared|afraid|fear\w*|terrif\w*|panic\w*|nervous|worried|happy|glad|smil\w*|laugh\w*|sad|cry|cried|tears|lonely|left out|angry|mad|furious|proud|brave|lucky|surprised|shock\w*|excited|calm|quiet|silent|bored|sleepy|yawn\w*|shiver\w*|trembl\w*|gasp\w*|grin\w*|frown\w*)\b/gi;
const VERB = /\b(\w+(?:ed|ing|s))\b/g;
const fmt = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;
const r2 = (x) => Math.round(x * 100) / 100;

const lines = (tl.lines ?? script.lines).map((L, i) => {
  const text = script.lines?.[i]?.text ?? L.text;
  const start = L.start, end = L.end;
  const shots = tl.shots.map((s, k) => ({ s, k })).filter(({ s }) => s.end > start + 0.01 && s.start < end - 0.01);
  // 3 still times: one shot -> 12% / 50% / 88% of the span; 2 shots -> middle of each + the cut-free middle; 3+ -> first / middle / last shot
  const mid = (s) => (Math.max(s.start, start) + Math.min(s.end, end)) / 2;
  let picks;
  if (shots.length >= 3) picks = [mid(shots[0].s), mid(shots[shots.length >> 1].s), mid(shots.at(-1).s)];
  else if (shots.length === 2) {
    // both shots; the longer one gets two stills (its start and end, to see movement)
    const at = (s, f) => Math.max(s.start, start) + (Math.min(s.end, end) - Math.max(s.start, start)) * f;
    const a = shots[0].s, b = shots[1].s, la = Math.min(a.end, end) - Math.max(a.start, start), lb = Math.min(b.end, end) - Math.max(b.start, start);
    picks = la >= lb ? [at(a, 0.15), at(a, 0.85), at(b, 0.5)] : [at(a, 0.5), at(b, 0.15), at(b, 0.85)];
  }
  else { const len = end - start; picks = [start + len * 0.12, start + len * 0.5, start + len * 0.88]; }
  const keys = extractKeys(text, vw);
  const kindOf = (k) => (k.kind === "rule" ? ruleById(k.rule)?.kind ?? "rule" : k.kind);
  const auto = {
    who: tl.visualReport?.[i]?.subject ?? L.subject ?? "-",
    nouns: keys.filter((k) => ["noun", "person"].includes(kindOf(k)) || ["object", "hold", "people", "body"].includes(kindOf(k))).map((k) => k.text && k.kind === "rule" ? `${k.label} (${k.text})` : k.label),
    actions: [...keys.filter((k) => kindOf(k) === "action").map((k) => `${k.label} (${k.text})`), ...[...text.matchAll(VERB)].map((m) => m[1]).filter((w) => /ed$|ing$/.test(w) && w.length > 4)].filter((x, j, a) => a.indexOf(x) === j),
    emotion: [...new Set((text.match(EMO) ?? []).map((w) => w.toLowerCase()))].join(", ") || "-",
    location: keys.filter((k) => ["place", "light"].includes(kindOf(k))).map((k) => `${k.label} (${k.text})`).join(", ") || "-",
  };
  return {
    line: i, part: L.part, text, start: r2(start), end: r2(end), videoStart: r2(start + offset), videoEnd: r2(end + offset),
    shots: shots.map(({ s, k }) => ({ shot: k, start: r2(s.start), end: r2(s.end), set: s.set, light: s.light, camera: s.camera, plan: describeShot(s, tl.cast ?? {}) })),
    planner: { subject: auto.who, nouns: tl.visualReport?.[i]?.nouns ?? [], ok: tl.visualReport?.[i]?.ok ?? null },
    auto, stillTimes: picks.map((t) => r2(Math.min(Math.max(0, t + offset), videoDur - 0.05))),
  };
});

// ---------------------------------------------------------------- 4. the stills + one strip per line
for (const L of lines) {
  const n = String(L.line).padStart(2, "0");
  L.stills = L.stillTimes.map((t, j) => `stills/line_${n}_${"sme"[j]}.jpg`);
  L.strip = `strips/line_${n}.jpg`;
  if (!flag("--frames") && L.stills.every((f) => exists(path.join(out, f))) && exists(path.join(out, L.strip))) continue;
  L.stillTimes.forEach((t, j) => execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(t), "-i", video, "-frames:v", "1", "-vf", "scale=360:-2", "-q:v", "4", path.join(out, L.stills[j])]));
  execFileSync("ffmpeg", ["-v", "error", "-y", ...L.stills.flatMap((f) => ["-i", path.join(out, f)]), "-filter_complex", "[0][1][2]hstack=inputs=3", "-q:v", "4", path.join(out, L.strip)]);
  process.stdout.write(`\r  stills ${L.line + 1}/${lines.length}`);
}
console.log("");

// ---------------------------------------------------------------- 5. the verdicts (hand-written), merged
const FIXES = {
  wrong_location: "The set must be the story's world: when the premise names a world (inside a giant turtle), every shot uses that world's set (turtle_inside / turtle_outside) unless the line names another place; never fall back to street / school / bedroom. Add a set check to checkTimeline.",
  wrong_character: "Resolve who the line is about from the story, not from loose words (\"his\" is not a person called \"Grandpa His\"); the narrator \"I/me/my\" must be Nell on screen; a line's subject must be the one in focus.",
  missing_object: "Every key noun of the line must be on screen as a real object (kit / builder), not just named by the plan; checkVisuals must count only things that render visibly, and a missing one becomes a builder need, never silently OK.",
  wrong_action: "The pose must perform the line's verb (carried, pounded, cranked, swept, swiveled, marched) on the right actor or object; map more verbs to poses/animations, or to a held-object action.",
  static_pose: "Moving lines (march, run, swing, slide, shiver) need real motion over the shot: walk cycles, crowd marching, camera move, object animation; a standing pose with neutral face is not an action.",
  wrong_emotion: "Set the face from the line's feeling (left out -> sad, lucky -> smile, scared at the door -> scared); 'neutral' should be the exception, not the default.",
  picture_card: "Picture cards (word + emoji) count as partial at best: build the thing (builder need) or show it in the world; cap cards to one per 30 s.",
  missing_crowd: "The army / soldiers / wolf must be visible as a crowd with wolf-ear helmets when the line is about them; 'They' lines about the army need the army on screen.",
  wrong_time: "Light must follow the story clock (night from 'one night' until 'at dawn'); a day-lit set breaks 'in the dark' / torch lines.",
  caption_mismatch: "Caption words must match the narration span shown (check the burn-in timing).",
  off_topic: "The script drifted off the user's premise; the writer must keep the user's nouns (giant turtle, big bad wolf, army hunting it) central in most lines.",
};
let verdicts = exists(verdictsFile) ? readJson(verdictsFile) : null;
if (!verdicts) {
  verdicts = { video: tl.title, premise: premise ?? "", global: [], fixes: {}, lines: Object.fromEntries(lines.map((L) => [L.line, { requires: { who: L.auto.who, nouns: L.auto.nouns, actions: L.auto.actions, emotion: L.auto.emotion, location: L.auto.location }, shows: "", verdict: "unjudged", types: [], reason: "" }])) };
  fs.writeFileSync(verdictsFile, JSON.stringify(verdicts, null, 1));
  console.log(`no verdicts yet: wrote a skeleton ${verdictsFile} (fill it in from strips/, then run again)`);
}
premise = verdicts.premise || premise || "";
const fixes = { ...FIXES, ...(verdicts.fixes ?? {}) };
for (const L of lines) {
  const V = verdicts.lines?.[L.line] ?? verdicts.lines?.[String(L.line)] ?? {};
  L.requires = { ...L.auto, ...(V.requires ?? {}) };
  L.shows = V.shows ?? "";
  L.verdict = V.verdict ?? "unjudged";
  L.types = V.types ?? [];
  L.reason = V.reason ?? "";
}
const judged = lines.filter((L) => ["match", "partial", "miss"].includes(L.verdict));
const count = (v) => lines.filter((L) => L.verdict === v).length;
const score = judged.length ? (count("match") + 0.5 * count("partial")) / judged.length : null;
const typeStats = {};
for (const L of lines) for (const t of L.types) { typeStats[t] ??= { type: t, lines: [], miss: 0, partial: 0 }; typeStats[t].lines.push(L.line); if (L.verdict === "miss") typeStats[t].miss++; else if (L.verdict === "partial") typeStats[t].partial++; }
const ranked = Object.values(typeStats).sort((a, b) => b.lines.length - a.lines.length || b.miss - a.miss).map((t) => ({ ...t, fix: fixes[t.type] ?? "(no fix written for this type: add one under \"fixes\" in the verdicts file)" }));
const worst = lines.filter((L) => L.verdict === "miss").sort((a, b) => (V(b).severity ?? b.types.length) - (V(a).severity ?? a.types.length)).slice(0, 5);
function V(L) { return verdicts.lines?.[L.line] ?? {}; }

const review = { video: tl.title, dir, premise, offsetNote, videoDuration: r2(videoDur), timelineDuration: r2(tl.duration), automaticTable: `${lines.filter((L) => L.planner.ok).length}/${lines.length} OK`,
  scorePct: score == null ? null : Math.round(score * 1000) / 10, counts: { match: count("match"), partial: count("partial"), miss: count("miss"), unjudged: lines.length - judged.length },
  global: verdicts.global ?? [], missTypes: ranked, worst: worst.map((L) => ({ line: L.line, text: L.text, reason: L.reason })), lines };
fs.writeFileSync(path.join(out, "review.json"), JSON.stringify(review, null, 1));

// ---------------------------------------------------------------- 6. the page
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const list = (x) => (Array.isArray(x) ? x.join(", ") : x) || "-";
const label = (t) => t.replace(/_/g, " ");
const card = (L) => `
<section class="line v-${L.verdict}" id="l${L.line}">
  <header><span class="num">#${L.line}</span><span class="time">${fmt(L.videoStart)} – ${fmt(L.videoEnd)}</span><span class="part">${esc(L.part ?? "")}</span><span class="badge b-${L.verdict}">${L.verdict}</span></header>
  <p class="text">“${esc(L.text)}”</p>
  <div class="stills">${L.stills.map((f, j) => `<figure><img loading="lazy" src="${f}" alt="line ${L.line} ${["start", "middle", "end"][j]}"><figcaption>${["start", "middle", "end"][j]} · ${fmt(L.stillTimes[j])}</figcaption></figure>`).join("")}</div>
  <div class="grid">
    <div class="box"><h4>Requires</h4><dl>
      <dt>Who</dt><dd>${esc(L.requires.who)}</dd><dt>Nouns</dt><dd>${esc(list(L.requires.nouns))}</dd><dt>Actions</dt><dd>${esc(list(L.requires.actions))}</dd>
      <dt>Emotion</dt><dd>${esc(L.requires.emotion)}</dd><dt>Location</dt><dd>${esc(L.requires.location)}</dd></dl>
      <p class="muted">Planner read: subject <b>${esc(L.planner.subject)}</b>; keys ${esc(list(L.planner.nouns))}; automatic table said ${L.planner.ok ? "OK" : "MISSING"}</p></div>
    <div class="box"><h4>Plan says</h4><ul>${L.shots.map((s) => `<li><span class="muted">shot ${s.shot} · ${fmt(s.start + offset)}–${fmt(s.end + offset)}</span><br>${esc(s.plan)}</li>`).join("")}</ul></div>
    <div class="box"><h4>Frames actually show</h4><p>${esc(L.shows || "-")}</p></div>
  </div>
  <div class="verdict"><span class="badge b-${L.verdict}">${L.verdict}</span>${L.types.map((t) => `<span class="tag">${label(t)}</span>`).join("")}<p>${esc(L.reason || "-")}</p></div>
</section>`;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Review: ${esc(tl.title)}</title>
<style>
:root{--bg:#0f1115;--panel:#171a21;--line:#262b36;--fg:#e7e9ee;--muted:#8b93a5;--ok:#2fbf71;--part:#e3b341;--miss:#f0525b;--un:#6b7280}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:1180px;margin:0 auto;padding:24px 16px 80px}h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:28px 0 10px}h4{margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.muted{color:var(--muted);font-size:12px}.top{display:grid;grid-template-columns:220px 1fr;gap:16px;margin-top:16px}
.score{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:18px;text-align:center}.score b{display:block;font-size:44px;line-height:1.1}
.counts span{display:inline-block;margin:6px 6px 0 0;font-size:13px}.panel{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
table{width:100%;border-collapse:collapse}td,th{padding:7px 8px;border-top:1px solid var(--line);vertical-align:top;text-align:left}th{color:var(--muted);font-weight:500;font-size:12px;border-top:0}
.bar{display:flex;height:10px;border-radius:5px;overflow:hidden;margin-top:12px}.bar i{display:block}
.line{background:var(--panel);border:1px solid var(--line);border-left:4px solid var(--un);border-radius:10px;padding:14px 16px;margin:14px 0}
.v-match{border-left-color:var(--ok)}.v-partial{border-left-color:var(--part)}.v-miss{border-left-color:var(--miss)}
.line header{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.num{font-weight:700}.time{font-variant-numeric:tabular-nums;color:var(--muted)}.part{font-size:11px;color:var(--muted);text-transform:uppercase}
.badge{margin-left:auto;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:700;text-transform:uppercase;color:#0f1115;background:var(--un)}.verdict .badge{margin-left:0;margin-right:8px}
.b-match{background:var(--ok)}.b-partial{background:var(--part)}.b-miss{background:var(--miss)}
.text{font-size:17px;margin:8px 0 12px}.stills{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;max-width:560px}
figure{margin:0}img{width:100%;border-radius:6px;display:block;background:#000}figcaption{font-size:11px;color:var(--muted);text-align:center}
.grid{display:grid;grid-template-columns:1fr 1.2fr 1fr;gap:10px;margin-top:12px}.box{background:#12151b;border:1px solid var(--line);border-radius:8px;padding:10px}
dl{display:grid;grid-template-columns:70px 1fr;gap:2px 8px;margin:0}dt{color:var(--muted)}dd{margin:0}ul{margin:0;padding-left:16px}li{margin-bottom:6px}
.verdict{margin-top:10px}.verdict p{margin:6px 0 0}.tag{display:inline-block;font-size:11px;border:1px solid var(--line);border-radius:4px;padding:1px 6px;margin-right:6px;color:var(--muted)}
.global li{margin-bottom:4px}a{color:#8ab4ff}
@media (max-width:800px){.top,.grid{grid-template-columns:1fr}}
</style></head><body><main>
<h1>${esc(tl.title)}</h1>
<div class="muted">${esc(dir)} · video ${videoDur.toFixed(1)} s · ${lines.length} lines · ${tl.shots.length} shots · ${esc(offsetNote)}</div>
${premise ? `<p><b>User's premise:</b> ${esc(premise)}</p>` : ""}
<div class="top">
  <div class="score"><span class="muted">overall match</span><b>${review.scorePct == null ? "–" : review.scorePct + "%"}</b><span class="muted">match = 1, partial = ½</span>
    <div class="counts"><span style="color:var(--ok)">● ${review.counts.match} match</span><span style="color:var(--part)">● ${review.counts.partial} partial</span><span style="color:var(--miss)">● ${review.counts.miss} miss</span>${review.counts.unjudged ? `<span>● ${review.counts.unjudged} unjudged</span>` : ""}</div>
    <div class="bar"><i style="flex:${review.counts.match};background:var(--ok)"></i><i style="flex:${review.counts.partial};background:var(--part)"></i><i style="flex:${review.counts.miss};background:var(--miss)"></i><i style="flex:${review.counts.unjudged};background:var(--un)"></i></div>
    <p class="muted">The automatic word-to-scene table said ${esc(review.automaticTable)}.</p></div>
  <div class="panel"><h4>Most common miss types (lines affected) and the fix</h4><table><tr><th>#</th><th>Type</th><th>Lines</th><th>Fix</th></tr>
  ${ranked.map((t, j) => `<tr><td>${j + 1}</td><td><b>${label(t.type)}</b><br><span class="muted">${t.miss} miss · ${t.partial} partial</span></td><td>${t.lines.length}<br><span class="muted">${t.lines.map((n) => `<a href="#l${n}">${n}</a>`).join(" ")}</span></td><td>${esc(t.fix)}</td></tr>`).join("")}</table></div>
</div>
${review.global.length ? `<h2>Whole-video problems</h2><div class="panel"><ul class="global">${review.global.map((g) => `<li>${esc(g)}</li>`).join("")}</ul></div>` : ""}
${worst.length ? `<h2>Worst lines</h2><div class="panel"><ul>${worst.map((L) => `<li><a href="#l${L.line}">#${L.line}</a> “${esc(L.text)}” — ${esc(L.reason)}</li>`).join("")}</ul></div>` : ""}
<h2>Line by line</h2>
${lines.map(card).join("")}
</main></body></html>`;
fs.writeFileSync(path.join(out, "review.html"), html);
console.log(`${review.scorePct == null ? "unjudged" : review.scorePct + "% matched"} (${review.counts.match} match, ${review.counts.partial} partial, ${review.counts.miss} miss${review.counts.unjudged ? `, ${review.counts.unjudged} unjudged` : ""})`);
console.log(`review: ${path.join(out, "review.html")}`);
