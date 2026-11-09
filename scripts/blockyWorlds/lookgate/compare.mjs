#!/usr/bin/env node
// Blocky Worlds LOOK GATE - comparison page: 12 reference frames vs 12 of ours per run, matched by shot type
// (face close-up / insert / establishing / action), the metrics table vs the reference, and a rating column
// (1-10 "looks like the reference" + notes per shot type) read from a ratings JSON the gate agent fills.
//
//   node scripts/blockyWorlds/lookgate/compare.mjs --ref <out>/ref.json --ours <out>/run3.json,<out>/run4.json
//        [--table <out>/run1.json,...,<out>/run5.json] [--ratings <out>/ratings.json] --out <out>/page
//
// ratings.json: { "run3": { "face": { "score": 4, "notes": "..." }, "insert": {...}, ... }, ... }
// Writes <out>/index.html (+ img/ thumbnails, self-contained). Inputs come from measure.mjs.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

function args(argv) {
  const a = {};
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k.startsWith("--")) a[k.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
  }
  return a;
}

export const GROUPS = [
  { key: "face", label: "Face close-up", types: ["face"] },
  { key: "insert", label: "Insert (hero object / text)", types: ["insert"] },
  { key: "establishing", label: "Establishing / crowd", types: ["establishing", "crowd"] },
  { key: "action", label: "Action / characters", types: ["group", "medium", "creature"] },
];

// metric rows for the page: key, label, kind (pct = percentage points, n = count, v = 0..1 value)
const TABLE = [
  ["bigReadableFacePct", "big readable face % (close-up)", "pct"],
  ["readableFacePct", "readable face % (planner estimate)", "pct"],
  ["over10PeoplePct", ">10-people shot %", "pct"],
  ["oneToThreePeoplePct", "1-3 people shot %", "pct"],
  ["insertPct", "insert %", "pct"],
  ["distinctPlaces", "distinct places", "n"],
  ["placesPerMinute", "places per minute", "n"],
  ["distinctLights", "distinct light moods", "n"],
  ["blankPct", "blank frames (sky/wall >45%) %", "pct"],
  ["flatPct", "flat frames (one colour >60%) %", "pct"],
  ["satMean", "saturation mean", "v"],
  ["satMedian", "saturation median", "v"],
  ["valMean", "brightness mean", "v"],
  ["valMedian", "brightness median", "v"],
  ["contrastMedian", "contrast (p90-p10) median", "v"],
  ["beigeMedian", "beige share median", "v"],
  ["beigeHeavyPct", "beige-heavy frames (>40% beige) %", "pct"],
  ["sameTopHuePct", "frames sharing the top hue %", "pct"],
  ["hueEntropyMedian", "hue entropy median (bits)", "v"],
];

function close(kind, ours, ref) {
  if (ours == null || ref == null) return null;
  if (kind === "pct") return Math.abs(ours - ref) <= 8;
  if (kind === "n") return ref === 0 ? ours === 0 : Math.abs(ours - ref) / Math.abs(ref) <= 0.3;
  return Math.abs(ours - ref) <= Math.max(0.06, Math.abs(ref) * 0.15);
}

// three frames of a group, spread over the video, non-blank first
export function pick(frames, types, n = 3) {
  const all = frames.filter((f) => types.includes(f.type));
  const good = all.filter((f) => !f.px?.blank);
  const pool = good.length >= n ? good : all;
  if (pool.length <= n) return pool;
  const out = [];
  for (let k = 0; k < n; k++) out.push(pool[Math.min(pool.length - 1, Math.round(((k + 0.5) / n) * pool.length - 0.5))]);
  return out;
}

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function tile(f, img, isRef) {
  const t = f.t != null ? `${Math.round(f.t * 10) / 10}s` : "";
  const who = f.humans ? `${f.humans} ${f.humans === 1 ? "person" : "people"}` : "no people";
  const face = f.bigFace ? "big face" : f.readable ? "face readable" : f.humans ? "face small/hidden" : "";
  const extra = isRef ? [f.head ? `head ${f.head}%` : "", f.insert, f.outfit].filter(Boolean).join(" · ")
    : [f.camera, f.focus, f.hiddenFace ? "listed hidden" : ""].filter(Boolean).join(" · ");
  const line = !isRef && f.text ? `<div class="line">"${esc(f.text.slice(0, 70))}${f.text.length > 70 ? "…" : ""}"</div>` : "";
  return `<figure><img src="img/${img}" alt="${esc(f.type)} frame" loading="lazy"><figcaption><b>${esc(f.type)}</b> ${t}<br>${esc(who)}${face ? " · " + face : ""}<br>${esc(f.placeDetail || f.place)} · ${esc(f.light)}<br><span class="dim">${esc(extra)}</span>${line}</figcaption></figure>`;
}

export function buildPage({ ref, ours, table, ratings, outDir, thumbW = 270 }) {
  const imgDir = path.join(outDir, "img");
  fs.mkdirSync(imgDir, { recursive: true });
  const jobs = [];
  const name = (setName, f, i) => `${setName}_${i}_${path.basename(f.file).replace(/[^\w.-]/g, "_")}`;
  const sections = GROUPS.map((g) => {
    const rp = pick(ref.frames, g.types);
    rp.forEach((f, i) => jobs.push([f.file, name("ref", f, i)]));
    const rows = ours.map((o) => {
      const op = pick(o.frames, g.types);
      op.forEach((f, i) => jobs.push([f.file, name(o.name, f, i)]));
      const r = ratings?.[o.name]?.[g.key] || {};
      const cells = op.length ? op.map((f, i) => tile(f, name(o.name, f, i), false)).join("")
        : `<div class="none">No ${esc(g.label.toLowerCase())} shot in ${esc(o.name)}.</div>`;
      const count = o.frames.filter((f) => g.types.includes(f.type)).length;
      return `<div class="row"><div class="rowhead"><b>${esc(o.name)}</b><span class="dim">${count} of ${o.frames.length} shots</span>
        <div class="rating"><span class="score">${r.score != null ? esc(r.score) + "/10" : "–/10"}</span><span class="dim">looks like the reference</span></div>
        <div class="notes">${r.notes ? esc(r.notes) : '<span class="dim">notes: to be filled by the gate agent</span>'}</div></div>
        <div class="strip">${cells}</div></div>`;
    }).join("");
    const refCount = ref.frames.filter((f) => g.types.includes(f.type)).length;
    return `<section><h2>${esc(g.label)}</h2>
      <div class="row ref"><div class="rowhead"><b>reference</b><span class="dim">${refCount} of ${ref.frames.length} frames</span></div>
      <div class="strip">${rp.map((f, i) => tile(f, name("ref", f, i), true)).join("")}</div></div>${rows}</section>`;
  }).join("\n");

  const list = path.join(outDir, "thumbs.list.txt");
  fs.writeFileSync(list, jobs.map((j) => j.join("\t")).join("\n"));
  const r = spawnSync("python", [path.join(HERE, "thumbs.py"), imgDir, String(thumbW), "@" + list], { stdio: "inherit" });
  fs.rmSync(list, { force: true });
  if (r.status !== 0) throw new Error("thumbs.py failed");

  const sets = table?.length ? table : ours;
  const head = `<tr><th>metric</th><th>reference</th>${sets.map((s) => `<th>${esc(s.name)}</th>`).join("")}</tr>`;
  const body = TABLE.map(([k, label, kind]) => {
    const rv = ref.summary[k];
    return `<tr><td>${esc(label)}</td><td class="num">${rv ?? ""}</td>${sets.map((s) => {
      const v = s.summary[k];
      const ok = close(kind, v, rv);
      return `<td class="num ${ok == null ? "" : ok ? "ok" : "off"}">${v ?? ""}</td>`;
    }).join("")}</tr>`;
  }).join("");
  const mixHead = `<tr><th>shot type %</th><th>reference</th>${sets.map((s) => `<th>${esc(s.name)}</th>`).join("")}</tr>`;
  const mixBody = Object.keys(ref.summary.typeMix).map((t) => `<tr><td>${t}</td><td class="num">${ref.summary.typeMix[t]}</td>${sets.map((s) => {
    const v = s.summary.typeMix[t];
    const ok = close("pct", v, ref.summary.typeMix[t]);
    return `<td class="num ${ok ? "ok" : "off"}">${v}</td>`;
  }).join("")}</tr>`).join("");
  const ratingHead = `<tr><th>shot type</th>${ours.map((o) => `<th>${esc(o.name)}</th>`).join("")}</tr>`;
  const ratingBody = GROUPS.map((g) => `<tr><td>${esc(g.label)}</td>${ours.map((o) => {
    const r = ratings?.[o.name]?.[g.key];
    return `<td>${r?.score != null ? `<b>${esc(r.score)}/10</b> ` : '<span class="dim">–/10</span> '}${r?.notes ? esc(r.notes) : ""}</td>`;
  }).join("")}</tr>`).join("");

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Blocky Look Gate</title>
<style>
:root{--bg:#f6f5f2;--fg:#1d1d1f;--dim:#6b6b70;--card:#ffffff;--line:#e2e0da;--ok:#1f7a4d;--okbg:#e3f4ea;--off:#a3342b;--offbg:#fbe6e3;--accent:#3550c8}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#151517;--fg:#ececef;--dim:#9a9aa2;--card:#1f1f23;--line:#33333a;--ok:#7fd3a4;--okbg:#18332470;--off:#f0a097;--offbg:#4a1f1b70;--accent:#93a6ff}}
:root[data-theme="dark"]{--bg:#151517;--fg:#ececef;--dim:#9a9aa2;--card:#1f1f23;--line:#33333a;--ok:#7fd3a4;--okbg:#18332470;--off:#f0a097;--offbg:#4a1f1b70;--accent:#93a6ff}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.45 system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:1500px;margin:0 auto;padding:20px 16px 60px}h1{font-size:22px;margin:0 0 4px}h2{font-size:17px;margin:28px 0 10px;border-bottom:1px solid var(--line);padding-bottom:6px}
.dim{color:var(--dim)}.sub{color:var(--dim);margin:0 0 18px;max-width:900px}
table{border-collapse:collapse;background:var(--card);border:1px solid var(--line);margin:8px 0 4px;font-size:13px}
th,td{padding:5px 9px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{font-weight:600}
td.num{text-align:right;font-variant-numeric:tabular-nums}td.ok{color:var(--ok);background:var(--okbg)}td.off{color:var(--off);background:var(--offbg)}
.tablewrap{overflow-x:auto;max-width:100%}
.row{display:flex;gap:12px;align-items:flex-start;margin:10px 0;padding:10px;background:var(--card);border:1px solid var(--line);border-radius:8px}
.row.ref{border-color:var(--accent)}
.rowhead{flex:0 0 170px;display:flex;flex-direction:column;gap:4px}.rating .score{font-size:20px;font-weight:700;margin-right:6px}
.notes{font-size:12px}.strip{display:flex;gap:10px;flex-wrap:wrap;flex:1;min-width:0}
figure{margin:0;width:180px}figure img{width:180px;height:320px;object-fit:cover;border-radius:6px;display:block;background:#000}
figcaption{font-size:11.5px;margin-top:4px}.line{font-style:italic;color:var(--dim);margin-top:2px}
.none{padding:30px 14px;border:1px dashed var(--line);border-radius:6px;color:var(--off);width:100%}
@media (max-width:640px){.row{flex-direction:column}.rowhead{flex-basis:auto}figure{width:calc(50% - 5px)}figure img{width:100%;height:auto;aspect-ratio:9/16}}
</style></head><body><main>
<h1>Blocky Worlds look gate</h1>
<p class="sub">Reference: 2 s grid of one study video (internal patterns only, never its story or characters). Ours: step-3 stills, typed from the planner timeline. Green = within tolerance of the reference (±8 points, ±30% counts, ±15% values), red = off. Ratings come from ratings.json (filled by the gate agent).</p>
<h2>Ratings: looks like the reference (1-10)</h2><div class="tablewrap"><table>${ratingHead}${ratingBody}</table></div>
<h2>Metrics vs reference</h2><div class="tablewrap"><table>${head}${body}</table></div>
<div class="tablewrap"><table>${mixHead}${mixBody}</table></div>
<p class="dim">Face numbers for ours are planner estimates (lead actor facing the camera, not an establishing camera, minus shots the reviewers listed as hidden faces). People counts for ours are planned (actors + crowd count), not what the still shows. "insert" for ours is the planner's object focus, which is not always a full-frame insert.</p>
${sections}
</main></body></html>`;
  fs.writeFileSync(path.join(outDir, "index.html"), html);
  return path.join(outDir, "index.html");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = args(process.argv);
  if (!a.ref || !a.ours || !a.out) {
    console.error("usage: see the header of compare.mjs");
    process.exit(2);
  }
  const load = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
  const ref = load(a.ref);
  const ours = String(a.ours).split(",").map(load);
  const table = a.table ? String(a.table).split(",").map(load) : null;
  const ratings = a.ratings && fs.existsSync(a.ratings) ? load(a.ratings) : null;
  console.log(buildPage({ ref, ours, table, ratings, outDir: a.out }));
}
