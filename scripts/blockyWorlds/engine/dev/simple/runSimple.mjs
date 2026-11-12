// Simple-style test stills on RunPod (role "simpleStills", runpod/simpleRole.mjs). The page code (page/simple/simple.js)
// goes INLINE with the job, so a look change needs no image rebuild. Without --yes: the plan + estimate only.
// With --yes it spends money on RunPod (ask the owner first; this test's cap is $0.30).
//   node dev/simple/runSimple.mjs --out <dir> [--only label1,label2] [--yes]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rpClient, storage, loadEnv, billed, logSpend, endpointInfo, RATE } from "../../runpod/client.mjs";
import { simpleFileNames } from "../../runpod/simpleRole.mjs";
import { SHOTS } from "./shots.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2), arg = (k, d = null) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const out = arg("out");
if (!out) { console.error("usage: node dev/simple/runSimple.mjs --out <dir> [--only a,b] [--yes]"); process.exit(2); }
const only = arg("only") ? arg("only").split(",") : null;
const shots = only ? SHOTS.filter((s) => only.includes(s.label)) : SHOTS;
const code = fs.readFileSync(path.resolve(here, "../../page/simple/simple.js"), "utf8");
const est = 15 + 3 + 8 + shots.length * 1.5;
console.log(`plan: ${shots.length} simple-style stills in 1 job; estimate ~${est.toFixed(0)} GPU-s = ~$${(est * RATE).toFixed(4)} (worst case 300 s = $${(300 * RATE).toFixed(3)})`);
if (!argv.includes("--yes")) { console.log("dry run: nothing sent (add --yes)"); process.exit(0); }

fs.mkdirSync(out, { recursive: true });
let minBuild = null; try { minBuild = endpointInfo().build ?? null; } catch { /* none */ }
const st = storage(loadEnv(), `blocky-worlds-test/simple/${new Date().toISOString().replace(/[:.]/g, "-")}`);
const rp = rpClient();
try {
  const names = simpleFileNames(shots), uploads = {};
  for (const n of names) uploads[n] = await st.signPut(n);
  const job = { role: "simpleStills", mode: "gpu", ...(minBuild ? { minBuild } : {}), simple: { code, shots, out: { uploads } } };
  const id = await rp.submit({ job });
  console.log(`job ${id}`);
  const stt = await rp.wait(id, { maxSec: 300, pollMs: 2000 });
  const b = billed(stt);
  logSpend(out, `Blocky Worlds simple-style stills ${id} (${stt.status}, ${shots.length} stills)`, b);
  console.log(`status ${stt.status}; billed ${b.seconds} s = $${b.usd}`);
  if (!(stt.status === "COMPLETED" && stt.output?.ok)) { console.log(JSON.stringify(stt.output ?? stt).slice(0, 2000)); process.exit(1); }
  const o = stt.output;
  console.log(`renderer ${String(o.renderer).slice(0, 80)}; load ${o.loadMs} ms; timing ${JSON.stringify(o.timing)}; info ${JSON.stringify(o.info)}${o.errors?.length ? `; page errors ${o.errors.join(" | ")}` : ""}`);
  for (const s of o.stills) {
    if (!s.file) { console.log(`  ${s.label}: ERROR ${s.error}`); continue; }
    const buf = await st.get(s.file);
    if (buf) fs.writeFileSync(path.join(out, s.file), buf);
    console.log(`  ${s.file} mean ${s.mean} ${s.ms} ms${s.lut ? " LUT" : ""}`);
  }
  fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify({ job: id, billed: b, ...o }, null, 1));
} finally {
  const n = await st.cleanup().catch(() => 0);
  console.log(`deleted ${n} test files`);
}
