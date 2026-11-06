import fs from "node:fs";
// M3: the scoreboard as production judges a video (the owner's rule of 2026-11-06), from the real picture checker's cached
// verdicts (m3/realCheck.mjs). customer-ready: the hook and the "This is a…" line pass (after the salvage, only they stop a
// video; the free rewording and picture repair before the voice are not simulated, so this is a lower bound); perfect:
// every line passes. Also how many lines the salvage would cut.   node m3/readyScore.mjs <realcheck out dir>
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const O = process.argv[2], P = path.join(path.dirname(fileURLToPath(import.meta.url)), "..") + "/";
const { salvagePlan } = await import(pathToFileURL(P + "m2/salvage.mjs").href);
const s = fs.readFileSync(P + "m3/scoreboard.mjs", "utf8"), re = /\["([^"]+)", "([^"]+)", \[([^\]]*)\]\]/g;
const VISION_FAILS_OK = 2, MECH = ["name", "how", "fix1", "fix2", "fix3"];
let m; const cats = {}, rows = [];
while ((m = re.exec(s))) {
  const [, name, cat, list] = m; const ps = list.split(",").map((x) => x.trim().replace(/"/g, "")).filter(Boolean);
  let row = { name, cat, status: "no check" };
  if (name === "Heart stent") row.status = "refused";
  else for (const p of ps) {
    const f = `${O}/realcheck/${p}.json`; if (!fs.existsSync(f)) continue;
    const R = JSON.parse(fs.readFileSync(f, "utf8")), roles = R.verdict.map((v) => v.role), bad = R.verdict.filter((v) => !v.ok).map((v) => v.role);
    const perfect = !bad.length, direct = bad.length <= VISION_FAILS_OK && !bad.some((r) => MECH.includes(r));
    const keyBad = bad.filter((r) => ["hook", "name"].includes(r));
    const sp = direct ? { drop: [] } : salvagePlan(roles, bad);
    row = { name, cat, plan: p, lines: roles.length, bad, perfect, ready: !keyBad.length, salvage: !direct, dropped: sp.drop ?? [], keyBad };
    break;
  }
  rows.push(row); (cats[cat] = cats[cat] || []).push(row);
}
let R = 0, Pf = 0;
for (const [c, l] of Object.entries(cats)) {
  const r = l.filter((x) => x.ready).length, p = l.filter((x) => x.perfect).length; R += r; Pf += p;
  console.log(`${c}: ready ${r}/${l.length}, perfect ${p}/${l.length}`);
}
console.log(`TOTAL ready ${R}/40 perfect ${Pf}/40`);
for (const x of rows) console.log(`${x.ready ? "READY" : x.status === "refused" ? "REFUSED" : "NOT  "} ${x.name}${x.plan ? ` | weak: ${x.bad.join(",") || "-"}${x.ready && x.salvage ? ` | salvage cuts ${x.dropped.length}/${x.lines}: ${x.dropped.join(",")}` : ""}${!x.ready && x.keyBad ? ` | blocked by ${x.keyBad.join("+")}` : ""}` : ""}`);
fs.writeFileSync(`${O}/ready.json`, JSON.stringify(rows, null, 1));
