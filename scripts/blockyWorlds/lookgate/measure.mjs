#!/usr/bin/env node
// Blocky Worlds LOOK GATE - metrics for one set of frames (our stills, or reference frames).
// CPU-light: python (numpy/PIL) pixel stats at 270 px + the planner's timeline. No renders, no paid calls.
//
// Our stills (one step-3 run):
//   node scripts/blockyWorlds/lookgate/measure.mjs --stills <run>/stills --timeline <run>/timeline.json
//        [--problems <step3>/problems.json --run 3] --name run3 --out <dir>/run3
// Reference (hand labels from ref-*.json; frames = the 2 s grid):
//   node scripts/blockyWorlds/lookgate/measure.mjs --video <ref.mp4> --frames <dir>/grid
//        --labels scripts/blockyWorlds/lookgate/ref-7706161704.json --name ref --out <dir>/ref
//   (--video extracts the 2 s grid into --frames first, if that folder is empty)
// Writes <out>.json (per-frame + summary) and <out>.md (table).
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

export const TYPES = ["face", "medium", "group", "insert", "establishing", "crowd", "creature"];
const CLOSE = new Set(["closeup", "giant_close"]);
const WIDE = new Set(["establish", "aerial"]);

const median = (xs) => {
  const a = xs.filter((x) => Number.isFinite(x)).sort((p, q) => p - q);
  if (!a.length) return null;
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};
const mean = (xs) => (xs.length ? xs.reduce((p, q) => p + q, 0) / xs.length : null);
const pct = (n, d) => (d ? Math.round((1000 * n) / d) / 10 : 0);
const r3 = (x) => (x == null ? null : Math.round(x * 1000) / 1000);

// "Faces hidden ...: s4, s20, s44-s47" lines of a problems.json run entry -> Set of shot numbers
export function hiddenFaceShots(problems, run) {
  const out = new Set();
  const entry = problems?.[String(run)];
  for (const line of entry?.problems || []) {
    if (!/face/i.test(line) || !/hidden|turned away|cut off|covers|over the face|from behind/i.test(line)) continue;
    for (const m of line.matchAll(/s(\d+)(?:\s*[-/]\s*s?(\d+))?/g)) {
      const a = +m[1], b = m[2] ? +m[2] : a;
      if (m[2] && line[m.index + m[0].indexOf(m[2]) - 1] === "/") { out.add(a); out.add(b); continue; }
      for (let k = a; k <= Math.min(b, a + 20); k++) out.add(k);
    }
  }
  return out;
}

// One planner shot -> look-gate shot type + people + face estimate
export function classifyShot(s, cast, hidden, idx) {
  const cam = s.camera || "";
  const f = s.focus || "";
  const person = !!cast[f];
  const actors = s.actors || [];
  const crowd = (s.crowds || []).reduce((p, c) => p + (c.count || 0), 0);
  const humans = actors.length + crowd;
  let type;
  if (s.insert) type = "insert";
  else if (f === "object" && !WIDE.has(cam) && cam !== "wide") type = "insert";
  else if (person && CLOSE.has(cam)) type = "face";
  else if (f === "giant" && CLOSE.has(cam)) type = "creature";
  else if (f === "crowd") type = "crowd";
  else if (WIDE.has(cam) || f === "world" || f === "giant") type = "establishing";
  else if (f === "group" || actors.length >= 2) type = "group";
  else if (person) type = "medium";
  else type = "establishing";
  const lead = actors.find((a) => a.id === f) || (f === "group" ? actors[0] : null);
  const readable = !!lead && lead.facing === "camera" && !WIDE.has(cam) && !hidden.has(idx);
  return {
    type, humans, crowd, readable, bigFace: type === "face" && readable,
    place: `${s.set}|${s.worldSpot || ""}`, light: s.light || "", camera: cam, focus: f, rig: s.rig || "", mood: s.mood || "",
  };
}

function listJpgs(dir) {
  return fs.readdirSync(dir).filter((n) => /\.(jpe?g|png)$/i.test(n)).sort().map((n) => path.join(dir, n));
}

function extractGrid(video, dir, every = 2) {
  fs.mkdirSync(dir, { recursive: true });
  if (listJpgs(dir).length) return;
  const r = spawnSync("ffmpeg", ["-v", "error", "-i", video, "-vf", `fps=1/${every},scale=576:-2`, "-threads", "2", "-q:v", "3", path.join(dir, "g_%03d.jpg")], { stdio: "inherit" });
  if (r.status !== 0) throw new Error("ffmpeg failed");
}

function pixelStats(files, outJson) {
  const list = outJson.replace(/\.json$/, ".list.txt");
  fs.writeFileSync(list, files.join("\n"));
  const r = spawnSync("python", [path.join(HERE, "measure.py"), outJson, "@" + list], { stdio: "inherit" });
  if (r.status !== 0) throw new Error("measure.py failed");
  fs.rmSync(list, { force: true });
  return JSON.parse(fs.readFileSync(outJson, "utf8"));
}

export function summarise(frames, { durationSec } = {}) {
  const n = frames.length;
  const mix = {};
  for (const t of TYPES) mix[t] = pct(frames.filter((x) => x.type === t).length, n);
  const people = frames.filter((x) => x.humans > 0);
  const places = new Set(frames.map((x) => x.place).filter(Boolean));
  const lights = new Set(frames.map((x) => x.light).filter(Boolean));
  const hueTops = {};
  frames.forEach((x) => { if (x.px.hueTop >= 0) hueTops[x.px.hueTop] = (hueTops[x.px.hueTop] || 0) + 1; });
  const topHueShare = n ? Math.max(0, ...Object.values(hueTops)) / n : 0;
  return {
    frames: n,
    typeMix: mix,
    faceCloseupPct: mix.face,
    readableFacePct: pct(frames.filter((x) => x.readable).length, n),
    bigReadableFacePct: pct(frames.filter((x) => x.bigFace).length, n),
    over10PeoplePct: pct(frames.filter((x) => x.humans > 10).length, n),
    oneToThreePeoplePct: pct(frames.filter((x) => x.humans >= 1 && x.humans <= 3).length, n),
    medianPeopleWhenAny: median(people.map((x) => x.humans)),
    insertPct: mix.insert,
    distinctPlaces: places.size,
    placesPerMinute: durationSec ? Math.round((places.size / (durationSec / 60)) * 10) / 10 : null,
    distinctLights: lights.size,
    flatPct: pct(frames.filter((x) => x.px.flat).length, n),
    blankPct: pct(frames.filter((x) => x.px.blank).length, n),
    satMedian: r3(median(frames.map((x) => x.px.sat))),
    satMean: r3(mean(frames.map((x) => x.px.satMean))),
    valMedian: r3(median(frames.map((x) => x.px.val))),
    valMean: r3(mean(frames.map((x) => x.px.valMean))),
    contrastMedian: r3(median(frames.map((x) => x.px.contrast))),
    beigeMedian: r3(median(frames.map((x) => x.px.beige))),
    beigeHeavyPct: pct(frames.filter((x) => x.px.beige > 0.4).length, n),
    hueEntropyMedian: r3(median(frames.map((x) => x.px.hueEntropy))),
    distinctTopHues: Object.keys(hueTops).length,
    sameTopHuePct: Math.round(topHueShare * 1000) / 10,
    overexposedPct: pct(frames.filter((x) => x.px.over > 0.2).length, n),
    darkPct: pct(frames.filter((x) => x.px.valMean < 0.3).length, n),
    detailMedian: r3(median(frames.map((x) => x.px.detail))),
  };
}

export const ROWS = [
  ["frames", "frames measured"],
  ["faceCloseupPct", "face close-up %"],
  ["readableFacePct", "readable face % (eyes+mouth seen)"],
  ["bigReadableFacePct", "big readable face % (close-up)"],
  ["oneToThreePeoplePct", "1-3 people shots %"],
  ["over10PeoplePct", ">10 people shots %"],
  ["medianPeopleWhenAny", "median people (shots with people)"],
  ["insertPct", "full-frame insert %"],
  ["distinctPlaces", "distinct places"],
  ["placesPerMinute", "places per minute"],
  ["distinctLights", "distinct light moods"],
  ["blankPct", "blank (sky/wall >45%) %"],
  ["flatPct", "flat (one colour >60%) %"],
  ["satMean", "saturation mean"],
  ["satMedian", "saturation median"],
  ["valMean", "brightness mean"],
  ["valMedian", "brightness median"],
  ["contrastMedian", "contrast p90-p10 median"],
  ["beigeMedian", "beige share median"],
  ["beigeHeavyPct", "beige-heavy frames (>40%) %"],
  ["hueEntropyMedian", "hue entropy median (bits)"],
  ["sameTopHuePct", "frames sharing the top hue %"],
  ["overexposedPct", "overexposed (>20% clipped) %"],
  ["darkPct", "dark (mean value <0.3) %"],
  ["detailMedian", "detail median"],
];

export function mdTable(sets) {
  const head = `| metric | ${sets.map((s) => s.name).join(" | ")} |\n|---|${sets.map(() => "---").join("|")}|\n`;
  const body = ROWS.map(([k, label]) => `| ${label} | ${sets.map((s) => s.summary[k] ?? "").join(" | ")} |`).join("\n");
  const mix = `\n\n| shot type % | ${sets.map((s) => s.name).join(" | ")} |\n|---|${sets.map(() => "---").join("|")}|\n` +
    TYPES.map((t) => `| ${t} | ${sets.map((s) => s.summary.typeMix[t]).join(" | ")} |`).join("\n");
  return head + body + mix + "\n";
}

export function measureSet(a) {
  const name = a.name || "set";
  let files, meta, durationSec;
  if (a.labels) {
    const L = JSON.parse(fs.readFileSync(a.labels, "utf8"));
    if (a.video) extractGrid(a.video, a.frames);
    files = listJpgs(a.frames);
    const cols = L.columns;
    meta = files.map((f, i) => {
      const row = Object.fromEntries(cols.map((c, k) => [c, L.frames[i]?.[k]]));
      return {
        t: row.t, type: row.type, humans: row.humans ?? 0, crowd: 0, readable: !!row.readable,
        bigFace: row.type === "face" && !!row.readable, head: row.head,
        place: L.placeFamily?.[row.place] || row.place, light: L.lightFamily?.[row.light] || row.light, placeDetail: row.place,
        insert: row.insert, expr: row.expr, outfit: row.outfit,
      };
    });
    durationSec = L.cuts?.durationSec;
  } else {
    const T = JSON.parse(fs.readFileSync(a.timeline, "utf8"));
    const P = a.problems ? JSON.parse(fs.readFileSync(a.problems, "utf8")) : null;
    const hidden = hiddenFaceShots(P, a.run);
    files = listJpgs(a.stills);
    durationSec = T.duration;
    meta = files.map((f) => {
      const m = /_s(\d+)\.(jpe?g|png)$/i.exec(f);
      const idx = m ? +m[1] : -1;
      const s = T.shots[idx];
      if (!s) return { type: "establishing", humans: 0, readable: false, bigFace: false, place: "", light: "" };
      return { shot: idx, t: s.start, text: s.text, ...classifyShot(s, T.cast || {}, hidden, idx), hiddenFace: hidden.has(idx) };
    });
  }
  const pxFile = a.out + ".px.json";
  const px = a.reusePx && fs.existsSync(pxFile) ? JSON.parse(fs.readFileSync(pxFile, "utf8")) : pixelStats(files, pxFile);
  const frames = files.map((f, i) => ({ file: f, ...meta[i], px: px[i] }));
  const summary = summarise(frames, { durationSec });
  const res = { name, durationSec, summary, frames };
  fs.writeFileSync(a.out + ".json", JSON.stringify(res, null, 1));
  fs.writeFileSync(a.out + ".md", `# Look gate metrics: ${name}\n\n` + mdTable([res]));
  return res;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = args(process.argv);
  if (!a.out || (!a.stills && !a.frames)) {
    console.error("usage: see the header of measure.mjs");
    process.exit(2);
  }
  fs.mkdirSync(path.dirname(a.out), { recursive: true });
  const res = measureSet(a);
  console.log(mdTable([res]));
}
