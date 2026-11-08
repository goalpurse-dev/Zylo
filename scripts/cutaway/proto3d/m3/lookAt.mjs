// Free debug: render a saved plan's stills at the preview moments of the named sentences (or all), to see what a
// check is looking at.   node m3/lookAt.mjs --proto PROTO --plan m3/sweep/known/swimming_pool.json --out DIR [--roles a,b]
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url)), M2 = path.join(here, "../m2");
const argv = process.argv.slice(2), a = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) { const k = argv[i].slice(2); a[k] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true; }
const imp = (f) => import(pathToFileURL(path.join(M2, f)).href);
const { layoutRules } = await imp("layoutRules.js"), { compile } = await imp("compile.mjs"), { draftWords } = await imp("plan.js");
const { preparePage } = await imp("make.mjs"), { previewTimes, timelineChecks } = await imp("checks.mjs");
const PROTO = path.resolve(a.proto), P = JSON.parse(fs.readFileSync(path.resolve(a.plan), "utf8")), S = P.sentences, roles = S.map((s) => s.role);
const { expandModels } = await imp("recipes.js");
let layout = { ...expandModels(P.layout).layout, roles, key: `look_${path.basename(a.plan, ".json")}` };
if (!layout.codeShots && !layout.camera) layout = layoutRules(layout).layout;
const words = draftWords(S), tl = compile(layout, words, words.at(-1).e + 0.1, { roles });
const want = a.roles ? String(a.roles).split(",") : null;
const pts = previewTimes(tl, layout).filter((p) => !want || want.includes(p.role));
preparePage({ layout, tl, proto: PROTO });
const out = path.resolve(a.out); fs.mkdirSync(out, { recursive: true });
spawnSync(process.execPath, [path.join(PROTO, "m2", "stills.mjs"), `m2_${layout.key}.html`, out, pts.map((p) => p.t.toFixed(2)).join(",")], { cwd: PROTO, stdio: "inherit", timeout: 300000 });
console.log(JSON.stringify(pts.map((p) => ({ role: p.role, t: +p.t.toFixed(2) }))));
console.log(JSON.stringify(timelineChecks(layout, tl).problems));
