// M3: the opening and closing frames' fill (the owner's rule of 2026-11-11: "opening and closing frames: the main build
// fills at least 40% of the frame, never a far shot"). Free, no render: for every saved custom plan, the width share of
// the hook's object at the hook's preview moments, and of the finished build (the main part, else the hook's object) at
// the congrats moments and the last frame.   node m3/endFill.mjs [--min 0.4] [--only a,b]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url)), M2 = path.join(here, "../m2");
const argv = process.argv.slice(2), a = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) { const k = argv[i].slice(2); a[k] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true; }
const MIN = Number(a.min ?? 0.4), only = a.only ? String(a.only).split(",") : null;
const imp = (f) => import(pathToFileURL(path.join(M2, f)).href);
const { compile } = await imp("compile.mjs"), { draftWords } = await imp("plan.js"), { previewTimes } = await imp("checks.mjs");
const { cameraAt, projectBox, finishedBuildParts } = await imp("director.js"), { focusOf, union } = await imp("focus.js"), { layoutRules } = await imp("layoutRules.js");
const { expandModels } = await imp("recipes.js"), { subjectBox } = await imp("framing.js"), { aboveGroundBox } = await imp("lineFrame.js");

const share = (k, b) => { if (!b) return null; const r = projectBox(k.pos, k.tgt, b); if (r.behind) return 0; return Math.max(0, Math.min(1, r.x1) - Math.max(0, r.x0)); };
const DIR = path.join(here, "sweep", "plans"), rows = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".json"))) {
  const key = f.replace(/\.json$/, ""); if (only && !only.includes(key)) continue;
  try {
    const P = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")), S = P.sentences, roles = S.map((s) => s.role);
    let L = { ...expandModels(P.layout).layout, roles, key: `ef_${key}` };
    if (L.approved === true) continue;
    if (!L.codeShots && !L.camera) L = layoutRules(L).layout;
    const w = draftWords(S), tl = compile(L, w, w.at(-1).e + 0.1, { roles }), cut = L.world?.cut;
    const box = (id) => { const p = L.parts.find((q) => q.id === id); try { return p ? focusOf(p, cut) : null; } catch { return null; } };
    const hookP = String(L.beats?.[0]?.shows?.p ?? "").split(".")[0];
    const mains = finishedBuildParts(L).map((p) => box(p.id)).filter(Boolean);
    const build = mains.length ? union(mains) : subjectBox(L);
    const pt = previewTimes(tl, L), hookTs = pt.find((p) => p.role === "hook")?.ts ?? [], endTs = [...(pt.find((p) => p.role === "congrats")?.ts ?? []), tl.marks.lengthEnd - 0.05];
    const at = (t) => cameraAt(tl.camera.end, t);
    // (the opening as the owner's rule of 2026-11-12 frames it: the hook's object with the ground above it, from above ground)
    const open = Math.min(...hookTs.map((t) => share(at(t), aboveGroundBox(box(hookP)) ?? build) ?? 1));
    const conTs = endTs.slice(0, -1), close = Math.min(...conTs.map((t) => share(at(t), build) ?? 1)), card = share(at(tl.marks.lengthEnd - 0.05), build) ?? 1;
    rows.push({ key, open: +open.toFixed(2), close: +close.toFixed(2), card: +card.toFixed(2) });
  } catch (e) { rows.push({ key, error: String(e.message).slice(0, 80) }); }
}
const bad = rows.filter((r) => r.open < MIN || r.close < MIN || r.card < MIN);
for (const r of rows) console.log(`${r.key.padEnd(44)} open ${r.open ?? "-"} close ${r.close ?? "-"} card ${r.card ?? "-"}${r.error ? ` ERROR ${r.error}` : ""}${r.open < MIN || r.close < MIN || r.card < MIN ? "  <-- under" : ""}`);
console.log(`\n${rows.length} custom plans; opening under ${MIN}: ${rows.filter((r) => r.open < MIN).length}; closing line under ${MIN}: ${rows.filter((r) => r.close < MIN).length}; end card under: ${rows.filter((r) => r.card < MIN).length}; either: ${bad.length}`);
