// M3: every line's frame (the owner's rules of 2026-11-12): free, no render. For every saved custom plan, at every moment
// the picture checker sees (checks.mjs previewTimes) and on the first frame: does the frame show the part the line is
// about, not hidden behind a wall, not a blurry close-up, and (the first frame) above ground? m2/lineFrame.js has the test.
//   node m3/lineFrames.mjs [--only a,b] [--v]   (--v: every failing frame)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url)), M2 = path.join(here, "../m2");
const argv = process.argv.slice(2), a = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) { const k = argv[i].slice(2); a[k] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true; }
const only = a.only ? String(a.only).split(",") : null;
const imp = (f) => import(pathToFileURL(path.join(M2, f)).href);
const { compile } = await imp("compile.mjs"), { draftWords } = await imp("plan.js"), { previewTimes } = await imp("checks.mjs");
const { cameraAt, finishedBuildParts } = await imp("director.js"), { layoutRules } = await imp("layoutRules.js");
const { expandModels } = await imp("recipes.js"), { lineSubject, outerOf } = await imp("cameraRules.js"), { frameIssues, aboveGroundBox } = await imp("lineFrame.js");
const { focusOf, union } = await imp("focus.js"), { subjectBox } = await imp("framing.js");

export function lineFrameRows(L, tl) {
  const out = [], cut = L.world?.cut ?? null, pt = previewTimes(tl, L);
  const box = (id) => { const p = L.parts.find((q) => q.id === String(id).split(".")[0]); try { return p ? focusOf(p, cut) : null; } catch { return null; } };
  const mains = finishedBuildParts(L).map((p) => box(p.id)).filter(Boolean), build = mains.length ? union(mains) : subjectBox(L);
  const hookId = String(L.beats?.[0]?.shows?.p ?? "");
  for (const s of tl.sentences) {
    const role = s.role, ts = pt.find((p) => p.role === role)?.ts ?? [];
    let sb = role === "congrats" || role === "finish" ? { id: "build", box: build } : lineSubject(L, role);
    if (role === "hook") { const hb = box(hookId); sb = hb ? { id: hookId, box: hb } : sb; }
    if (!sb?.box) { out.push({ role, t: s.t0, issues: ["nosubject"] }); continue; }
    const beat = (L.beats ?? []).find((b) => b.s === role), skip = [sb.id, ...(beat?.do ?? []).map((x) => x.p), ...(beat?.shows?.p ? [beat.shows.p] : [])];
    const times = role === "hook" ? [0, ...ts] : ts;
    for (const t of times) {
      const k = cameraAt(tl.camera.end, t), opening = role === "hook" && t === 0;
      const r = frameIssues(L, k, opening ? aboveGroundBox(sb.box) : sb.box, { skipIds: skip, opening, outer: role === "hook" ? null : outerOf(L, sb, role) });
      out.push({ role, t: +t.toFixed(2), id: sb.id, issues: r.issues, m: r.m });
    }
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const DIR = path.join(here, "sweep", "plans"), tally = {}, plans = [];
  for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".json"))) {
    const key = f.replace(/\.json$/, ""); if (only && !only.includes(key)) continue;
    try {
      const P = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")), S = P.sentences, roles = S.map((s) => s.role);
      let L = { ...expandModels(P.layout).layout, roles, key: `lf_${key}` };
      if (L.approved === true) continue;
      if (!L.codeShots && !L.camera) L = layoutRules(L).layout;
      const w = draftWords(S), tl = compile(L, w, w.at(-1).e + 0.1, { roles });
      const rows = lineFrameRows(L, tl), badLines = new Set(rows.filter((r) => r.issues.length).map((r) => r.role));
      for (const r of rows) for (const i of r.issues) tally[i] = (tally[i] ?? 0) + 1;
      const first = rows.find((r) => r.role === "hook" && r.t === 0);
      plans.push({ key, lines: new Set(rows.map((r) => r.role)).size, bad: badLines.size, frames: rows.length, badFrames: rows.filter((r) => r.issues.length).length, first: first?.issues ?? [] });
      if (a.v) for (const r of rows.filter((x) => x.issues.length)) console.log(`  ${key} ${r.role} ${r.t}s ${r.id}: ${r.issues.join(",")} ${JSON.stringify(r.m ?? {})}`);
    } catch (e) { plans.push({ key, error: String(e.stack).slice(0, 200) }); }
  }
  for (const p of plans) console.log(`${p.key.padEnd(44)} ${p.error ? `ERROR ${p.error}` : `lines bad ${p.bad}/${p.lines}  frames bad ${p.badFrames}/${p.frames}  first frame ${p.first.length ? p.first.join(",") : "ok"}`}`);
  const ok = plans.filter((p) => !p.error);
  console.log(`\n${ok.length} custom plans; all lines clean: ${ok.filter((p) => !p.bad).length}; first frame clean: ${ok.filter((p) => !p.first.length).length}; bad lines ${ok.reduce((s, p) => s + p.bad, 0)}/${ok.reduce((s, p) => s + p.lines, 0)}; bad frames ${ok.reduce((s, p) => s + p.badFrames, 0)}/${ok.reduce((s, p) => s + p.frames, 0)}; errors ${plans.length - ok.length}`);
  console.log(`issues: ${JSON.stringify(tally)}`);
}
