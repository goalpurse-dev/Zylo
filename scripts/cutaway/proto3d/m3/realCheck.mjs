// M3: the REAL picture checker on saved plans, once, to calibrate the free checks (the owner's go of 2026-11-06, max
// $1.50 in all). Each plan's frames are made exactly as a custom run's first check makes them (m2/run.mjs "before
// voice": draft word times, previewTimes, the start-middle-end strip of each line with its red state label), then the
// real checker (checks.mjs visionCheck, multi) judges them. A hard cap stops before the next call would pass maxUsd.
//   node m3/realCheck.mjs --proto PROTO --out DIR [--only a,b] [--known] [--max 1.5] [--dry]
// --dry renders the strips and stops (free). Results: DIR/<plan>.json (verdict per line) and DIR/ledger.json.
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url)), M2 = path.join(here, "../m2"), WT = path.resolve(here, "../../../..");
const argv = process.argv.slice(2), a = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) { const k = argv[i].slice(2); a[k] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true; }
const PROTO = path.resolve(a.proto), OUT = path.resolve(a.out), MAX = Number(a.max ?? 1.5), DRY = !!a.dry;
fs.mkdirSync(OUT, { recursive: true });
const imp = (f) => import(pathToFileURL(path.join(M2, f)).href);
const { compile } = await imp("compile.mjs"), { draftWords } = await imp("plan.js"), { preparePage } = await imp("make.mjs");
const { previewTimes, visionCheck } = await imp("checks.mjs"), { stateText } = await imp("run.mjs"), { loadKey } = await imp("llm.mjs");
const FF = process.env.FFMPEG ?? "ffmpeg";

const dirs = [path.join(here, "sweep", "plans"), ...(a.known ? [path.join(here, "sweep", "known")] : [])];
const only = a.only ? String(a.only).split(",") : null;
const files = dirs.flatMap((d) => fs.readdirSync(d).filter((f) => f.endsWith(".json")).map((f) => ({ d, name: f.replace(/\.json$/, "") }))).filter((x) => !only || only.includes(x.name) || x.d.endsWith("known"));
const ledgerFile = path.join(OUT, "ledger.json");
const ledger = fs.existsSync(ledgerFile) ? JSON.parse(fs.readFileSync(ledgerFile, "utf8")) : { spent: 0, calls: [] };
const apiKey = DRY ? null : loadKey();
// every real verdict kept by line: the strip image and the sentence (and its must-show) hashed; a line whose picture and
// words have not changed is never paid for twice (the owner's rule of 2026-11-06). CACHE: m3/sweep/real_verdicts/
const CACHE = path.resolve(a.cache ?? path.join(here, "sweep", "real_verdicts"));
fs.mkdirSync(CACHE, { recursive: true });
const lineKey = (fr) => crypto.createHash("sha1").update(fs.readFileSync(fr.file)).update(String(fr.text ?? "")).update(JSON.stringify(fr.must ?? null)).digest("hex").slice(0, 20);

for (const x of files) {
  const tag = `${x.d.endsWith("known") ? "known_" : ""}${x.name}`, resFile = path.join(OUT, `${tag}.json`);
  if (fs.existsSync(resFile)) { console.log(`[real] ${tag}: already checked`); continue; }
  const P = JSON.parse(fs.readFileSync(path.join(x.d, `${x.name}.json`), "utf8")), S = P.sentences, roles = S.map((s) => s.role);
  const layout = { ...P.layout, roles, key: `real_${tag}` };
  const dw = draftWords(S), tl = compile(layout, dw, dw.at(-1).e + 0.1, { roles });
  preparePage({ layout, tl, proto: PROTO });
  const shots = previewTimes(tl, layout), dir = path.join(OUT, "frames", tag);
  fs.mkdirSync(dir, { recursive: true });
  const all = shots.flatMap((s) => s.ts ?? [s.t]);
  spawnSync(process.execPath, [path.join(PROTO, "m2", "stills.mjs"), `m2_${layout.key}.html`, dir, all.join(",")], { cwd: PROTO, encoding: "utf8", timeout: 600000 });
  const font = path.join(WT, "supabase/functions/_shared/fonts/LilitaOne-Regular.ttf");
  if (fs.existsSync(font) && !fs.existsSync(path.join(dir, "font.ttf"))) fs.copyFileSync(font, path.join(dir, "font.ttf"));
  let k = 0;
  const frames = shots.map((s, i) => {
    const n = (s.ts ?? [s.t]).length, mine = Array.from({ length: n }, (_, j) => path.join(dir, `f_${String(k + j).padStart(3, "0")}.png`)); k += n;
    const file = path.join(dir, `strip_${String(i).padStart(2, "0")}.jpg`), lab = (j) => (s.label?.[j] ? `${stateText(s.label[j])},` : "");
    execFileSync(FF, ["-v", "error", "-y", ...mine.flatMap((p) => ["-i", p]), "-filter_complex", n > 1 ? `${mine.map((_, j) => `[${j}]${lab(j)}scale=270:-1[f${j}]`).join(";")};${mine.map((_, j) => `[f${j}]`).join("")}hstack=inputs=${n}` : `[0]${lab(0)}scale=360:-1`, "-q:v", "4", file], { cwd: dir });
    return { ...s, file };
  });
  if (DRY) { const fresh = frames.filter((fr) => !fs.existsSync(path.join(CACHE, `${lineKey(fr)}.json`))).length; console.log(`[real] ${tag}: ${frames.length} strips, ${fresh} not checked yet (dry)`); continue; }
  // the cap: the dearest real check so far was $0.036 for a 30 s plan; a longer plan costs about as many lines more
  const est = 0.004 * frames.length + 0.01;
  if (ledger.spent + est > MAX) { console.log(`[real] ${tag}: SKIPPED, the cap ($${MAX}) would be passed (spent $${ledger.spent.toFixed(3)})`); continue; }
  const keys = frames.map(lineKey), cached = keys.map((k) => (fs.existsSync(path.join(CACHE, `${k}.json`)) ? JSON.parse(fs.readFileSync(path.join(CACHE, `${k}.json`), "utf8")) : null));
  const ask = frames.filter((_, i) => !cached[i]);
  let r = { frames: [], costUsd: 0 };
  if (ask.length) {
    r = await visionCheck({ apiKey, frames: ask, multi: true, label: `calibration ${tag}` });
    ledger.spent = +(ledger.spent + (r.costUsd ?? 0)).toFixed(5); ledger.calls.push({ tag, lines: ask.length, usd: r.costUsd ?? 0, at: new Date().toISOString() });
    fs.writeFileSync(ledgerFile, JSON.stringify(ledger, null, 1));
  }
  let j = 0;
  const verdict = frames.map((fr, i) => {
    if (cached[i]) return { ...cached[i], role: fr.role, cached: true };
    const f = r.frames?.[j++] ?? {}, v = { role: fr.role, ok: !!f.ok, seen: f.seen ?? "", problem: f.problem ?? "" };
    fs.writeFileSync(path.join(CACHE, `${keys[i]}.json`), JSON.stringify({ ...v, text: fr.text, at: new Date().toISOString() }, null, 1));
    return v;
  });
  const bad = verdict.filter((f) => !f.ok), keyBad = bad.filter((f) => ["hook", "name"].includes(f.role));
  fs.writeFileSync(resFile, JSON.stringify({ plan: x.name, known: x.d.endsWith("known"), usd: r.costUsd, pass: !keyBad.length && bad.length <= 2, failing: bad.map((f) => f.role), verdict }, null, 1));
  console.log(`[real] ${tag}: $${(r.costUsd ?? 0).toFixed(4)} ${keyBad.length ? "FAIL (hook/name)" : bad.length > 2 ? `FAIL (${bad.length} lines)` : "pass"} ${bad.map((f) => f.role).join(",")} | spent $${ledger.spent.toFixed(3)}`);
}
console.log(`REAL ${JSON.stringify({ spent: ledger.spent, calls: ledger.calls.length })}`);
