// GAPS agent (2026-11-05): the real stress run's scripts (out/stress/real-script-haiku/scripts.json), planned with the
// free mock director, all four checks; then stills of the lines that use the new actions / giant behaviours / animal
// motions, rendered by the engine (free), on a contact sheet.  node dev/gapsReal.mjs [--n 5] [--per 3]
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { planVideo, checkTimeline, checkVisuals, checkSubjects, checkProduction, estimateWords } from "../plan.mjs";
import { directStory } from "../lib/director/index.js";
import { sheet } from "./integrationSheet.mjs";

const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ENGINE, "out", "gaps", "real");
const a = process.argv.slice(2), opt = (k, d) => (a.includes(`--${k}`) ? a[a.indexOf(`--${k}`) + 1] : d);
const N = Number(opt("n", 5)), PER = Number(opt("per", 3));
const exists = (rel) => fs.existsSync(path.join(ENGINE, rel));
const NEW_POSES = new Set(["hug", "climb", "push", "eat", "fall", "jump", "ride", "hide", "throw", "fly", "swim", "build", "dig", "dance", "kick", "fight", "drive"]);
const NEW_GIANT = new Set(["reach", "sleep", "lurk", "reveal", "carry", "eat", "fly", "climb", "flee", "howl", "dig"]);
const RS = path.join(ENGINE, "out/stress/real-script-haiku");
const scripts = JSON.parse(fs.readFileSync(path.join(RS, "scripts.json"), "utf8")), cards = JSON.parse(fs.readFileSync(path.join(RS, "cards.json"), "utf8"));
fs.mkdirSync(OUT, { recursive: true });
const rows = [], picks = [];
let clean = 0;
for (const [id, sc] of Object.entries(scripts)) {
  const script = { title: sc.title, lines: sc.lines }, idea = cards[id] ?? {};
  const direction = await directStory({ script, idea, provider: "mock", exists });
  const tl = planVideo({ script, words: estimateWords(script), idea, lengthSec: 90, direction, exists });
  const checks = { timeline: checkTimeline(tl), visuals: checkVisuals(tl, script), subjects: checkSubjects(tl), production: checkProduction(tl) };
  const bad = Object.entries(checks).filter(([, v]) => v.length).map(([k, v]) => `${k}:${v.length}`);
  if (!bad.length) clean++;
  const hits = tl.shots.map((s, i) => ({ s, i, what: [...(s.actors ?? []).filter((x) => NEW_POSES.has(x.pose)).map((x) => `${x.id} ${x.pose}`), ...(s.giants ?? []).filter((g) => NEW_GIANT.has(g.action)).map((g) => `${g.id} ${g.action}`), ...(s.objects ?? []).filter((o) => o.state && o.name !== "item" && !["on", "parked", "open", "lit", "dark"].includes(o.state) && (o.needId == null)).map((o) => `${o.name} ${o.state}`)] })).filter((h) => h.what.length && h.s.camera !== "insert");
  rows.push(`${id} ${sc.title.slice(0, 40).padEnd(40)} shots ${tl.shots.length}  new-action shots ${hits.length}  checks ${bad.join(" ") || "clean"}`);
  if (hits.length) picks.push({ id, tl, hits });
}
console.log(rows.join("\n"));
console.log(`\n${clean}/${Object.keys(scripts).length} scripts plan clean (timeline + visuals + subjects + production)`);
picks.sort((x, y) => new Set(y.hits.flatMap((h) => h.what.map((w) => w.split(" ")[1]))).size - new Set(x.hits.flatMap((h) => h.what.map((w) => w.split(" ")[1]))).size);
const items = [];
for (const p of picks.slice(0, N)) {
  const dir = path.join(OUT, p.id); fs.mkdirSync(dir, { recursive: true });
  for (const s of p.tl.shots) { if (typeof s.world === "string") delete s.world; if (s.need) delete s.need; for (const o of s.objects ?? []) delete o.needId; }
  // built things are not built here (no builder): a need-only object would not render, so those shots keep the kit only
  for (const s of p.tl.shots) if (s.objects) { s.objects = s.objects.filter((o) => o.asset || !o.needId); }
  const tlPath = path.join(dir, "timeline.json"); fs.writeFileSync(tlPath, JSON.stringify(p.tl));
  const seen = new Set(), chosen = [];
  for (const h of p.hits) { const k = h.what.map((w) => w.split(" ")[1]).join(","); if (seen.has(k)) continue; seen.add(k); chosen.push(h); if (chosen.length >= PER) break; }
  const times = chosen.map((h) => +(h.s.start + (h.s.end - h.s.start) * 0.6).toFixed(2));
  const r = spawnSync(process.execPath, ["render.mjs", tlPath, path.join(dir, "k.mp4"), "--stills", times.join(",")], { cwd: ENGINE, encoding: "utf8", maxBuffer: 1 << 26 });
  if (r.status !== 0) { console.log(`render failed ${p.id}: ${(r.stderr || r.stdout).slice(-600)}`); continue; }
  chosen.forEach((h, k) => items.push({ label: `${p.id} L${h.s.line} ${h.what.join(" ").slice(0, 30)}`, file: path.join(dir, `k-${times[k]}.jpg`), text: h.s.text }));
}
for (const it of items) console.log(`${it.label}: "${it.text}"`);
for (let k = 0; k * 15 < items.length; k++) console.log(sheet(path.join(ENGINE, "out", "gaps", `real_sheet${k + 1}.jpg`), 5, items.slice(k * 15, (k + 1) * 15)));
