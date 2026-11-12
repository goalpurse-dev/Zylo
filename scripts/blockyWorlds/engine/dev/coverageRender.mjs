// Visual proof for the coverage kit (free, local headless Chrome): plan ideas / scripts, render one still per chosen shot
// (its middle), label each with its line, and tile them into contact sheets in out/coverage/sheets/.
//   node dev/coverageRender.mjs ideas 0,2,17 [--max 12]      library ideas (stand-in scripts), the shots with objects /
//                                                             monster / props first
//   node dev/coverageRender.mjs listener                     The Listener: out/paid1 (58 lines) + EXAMPLE_SCRIPT
//   node dev/coverageRender.mjs gallery                      every catalog object, one shot each
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { planVideo, estimateWords, checkTimeline, checkVisuals, checkSubjects } from "../plan.mjs";
import { renderStills } from "../render.mjs";
import { loadIdeas, standInScript } from "./coverage.mjs";
import { OBJECT_CATALOG } from "../lib/visuals.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "out/coverage");
const SHEETS = path.join(OUT, "sheets");
fs.mkdirSync(SHEETS, { recursive: true });
const args = process.argv.slice(2);
const max = Number(args.includes("--max") ? args[args.indexOf("--max") + 1] : 12);

/** shots worth looking at: objects, creatures, props, monster, people with poses; spread over the video */
function pick(tl, n) {
  const score = (s) => (s.camera === "insert" ? -5 : 0) + (s.objects?.length ?? 0) * 3 + (s.monsterState ? 3 : 0) + (s.actors ?? []).filter((a) => a.hold).length * 2 + (s.marker ? 1 : 0) + (s.insert?.kind === "card" ? 2 : 0);
  const idx = tl.shots.map((s, i) => i).sort((a, b) => score(tl.shots[b]) - score(tl.shots[a]) || a - b);
  const chosen = new Set();
  for (const i of idx) { if (chosen.size >= n) break; if ([...chosen].some((c) => Math.abs(c - i) < 2) && chosen.size < n - 2) continue; chosen.add(i); }
  return [...chosen].sort((a, b) => a - b);
}

/** stills + labels + one sheet (4 columns) */
async function sheet(name, tl, shotIdx) {
  const dir = path.join(OUT, "stills", name);
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir)) if (/^s-.*\.jpg$/.test(f)) fs.unlinkSync(path.join(dir, f));   // no stale stills
  const tlPath = path.join(dir, "timeline.json");
  fs.writeFileSync(tlPath, JSON.stringify(tl));
  const times = shotIdx.map((i) => Math.round(((tl.shots[i].start + tl.shots[i].end) / 2) * 100) / 100);
  await renderStills({ timelinePath: tlPath, times, outPrefix: path.join(dir, "s") });
  const files = fs.readdirSync(dir).filter((f) => /^s-.*\.jpg$/.test(f)).sort((a, b) => parseFloat(a.slice(2)) - parseFloat(b.slice(2)));
  const labels = shotIdx.map((i) => { const s = tl.shots[i]; const what = [...(s.objects ?? []).map((o) => o.name + (o.state ? `(${o.state})` : "")), ...(s.actors ?? []).filter((a) => a.hold).map((a) => `${a.id}+${a.hold}`), s.monsterState ? `monster ${s.monsterState.state}` : "", s.insert ? `${s.insert.kind} ${s.insert.text}` : ""].filter(Boolean).join(", "); return `#${i} L${s.line} ${s.text}`.slice(0, 70) + `\n${s.camera} | ${what}`.slice(0, 90); });
  fs.writeFileSync(path.join(dir, "labels.txt"), shotIdx.map((i, k) => `${files[k]}  ${labels[k].replace(/\n/g, "  ||  ")}`).join("\n") + "\n");
  // tile: each still scaled to 270x480, 4 per row
  const inputs = files.flatMap((f) => ["-i", path.join(dir, f)]);
  const n = files.length, cols = Math.min(4, n), rows = Math.ceil(n / cols);
  const scale = files.map((_, k) => `[${k}:v]scale=270:480[v${k}]`).join(";");
  const layout = files.map((_, k) => `${(k % cols) * 270}_${Math.floor(k / cols) * 480}`).join("|");
  const out = path.join(SHEETS, `${name}.jpg`);
  const r = spawnSync("ffmpeg", ["-v", "error", "-y", ...inputs, "-filter_complex", `${scale};${files.map((_, k) => `[v${k}]`).join("")}xstack=inputs=${n}:layout=${layout}:fill=black[o]`, "-map", "[o]", "-frames:v", "1", "-q:v", "3", out]);
  if (r.status) console.log(String(r.stderr));
  console.log(`${name}: ${out} (${n} stills, ${cols}x${rows})`);
  return { out, labels };
}

const mode = args[0];
if (mode === "ideas") {
  const ideas = loadIdeas();
  for (const i of args[1].split(",").map(Number)) {
    const idea = ideas[i].idea, script = standInScript(idea);
    const tl = planVideo({ script, words: estimateWords(script), idea, lengthSec: 90 });
    const probs = [...checkTimeline(tl), ...checkVisuals(tl, script).map((m) => `visual L${m.line}`), ...checkSubjects(tl).map((p) => `subject s${p.shot}`)];
    if (probs.length) console.log(`#${i}: ${probs.length} problems`, probs.slice(0, 5));
    await sheet(`idea${String(i).padStart(3, "0")}_${idea.title.replace(/[^A-Za-z0-9]+/g, "_")}`, tl, pick(tl, max));
  }
} else if (mode === "listener") {
  const { EXAMPLE_IDEAS, EXAMPLE_SCRIPT } = await import("../../../../supabase/functions/_shared/blockyWorlds/examples.js");
  const paid = JSON.parse(fs.readFileSync(path.join(ROOT, "out/paid1/script.json"), "utf8"));
  const words = JSON.parse(fs.readFileSync(path.join(ROOT, "out/paid1/words.json"), "utf8"));
  const runs = [["listener_paid1", paid.script ?? paid, words, paid.idea ?? EXAMPLE_IDEAS[0]], ["listener_example", EXAMPLE_SCRIPT, null, EXAMPLE_IDEAS[0]]];
  for (const [name, script, w, idea] of runs) {
    const tl = planVideo({ script, words: w ?? estimateWords(script), idea, lengthSec: 90 });
    const probs = [...checkTimeline(tl), ...checkVisuals(tl, script).map((m) => `visual L${m.line}`), ...checkSubjects(tl).map((p) => `subject s${p.shot}`)];
    const objs = [...new Set(tl.shots.flatMap((s) => (s.objects ?? []).map((o) => `${o.name}${o.state ? `/${o.state}` : ""}`)))];
    console.log(`${name}: ${script.lines.length} lines, ${tl.shots.length} shots, problems ${probs.length}; objects: ${objs.join(", ")}`);
    await sheet(name, tl, pick(tl, max));
  }
} else if (mode === "gallery") {
  const names = Object.keys(OBJECT_CATALOG).filter((n) => !args[1] || args[1].split(",").includes(n));
  for (let b = 0; b < names.length; b += 16) {
    const part = names.slice(b, b + 16);
    const shots = part.map((name, k) => ({ start: k * 1.2, end: (k + 1) * 1.2, line: 0, lines: [0], part: "tour", set: OBJECT_CATALOG[name].sets?.[0] ?? "street", light: "day", camera: "wide", focus: "object", actors: [], monsterState: null, insert: null, marker: null, seed: k, text: name, objects: [{ name, spot: "center", facing: "camera" }] }));
    const tl = { version: 1, fps: 24, width: 1080, height: 1920, duration: part.length * 1.2, title: "gallery", cast: {}, monster: null, shots, captions: [{ word: " ", start: 0, end: 0.1 }], audio: { voice: "voice.wav" } };
    await sheet(`gallery_${String(b / 16 + 1).padStart(2, "0")}`, tl, shots.map((_, k) => k));
  }
}
