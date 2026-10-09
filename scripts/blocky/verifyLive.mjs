// Is what is deployed the same as the code? Downloads each function from the
// real project into its own temporary folder (read-only for the project) and
// compares every file with a reference:
//   Blocky's two functions  against this folder (the branch as checked out);
//   Fruit's two functions   against origin/main, or against this folder with --fruit=here
//                           (after a Fruit change made on this branch has been deployed).
// Also prints every function's last deploy time, so a function that was not
// meant to change can be seen not to have.
//   node scripts/blocky/verifyLive.mjs [--fruit=here]
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync, spawnSync } from "child_process";
import { ROOT, SUPABASE_URL } from "./lib.mjs";

const ref = new URL(SUPABASE_URL).hostname.split(".")[0];
const fruitHere = process.argv.includes("--fruit=here");
const norm = (s) => String(s).replace(/\r\n/g, "\n");
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const fromMain = (rel) => { try { return execFileSync("git", ["show", `origin/main:${rel}`], { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 26 }); } catch { return null; } };
const here = (rel) => (fs.existsSync(path.join(ROOT, rel)) ? fs.readFileSync(path.join(ROOT, rel), "utf8") : null);

let allSame = true;
for (const [fn, kind] of [["blocky-worker", "blocky"], ["blocky-story-api", "blocky"], ["fruit-worker", "fruit"], ["fruit-story-api", "fruit"]]) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `live-${fn}-`));
  const r = spawnSync("npx", ["supabase", "functions", "download", fn, "--project-ref", ref, "--use-api"], { cwd: dir, shell: true, encoding: "utf8" });
  if (r.status !== 0) { console.log(`${fn}: download failed`); allSame = false; continue; }
  const base = path.join(dir, "supabase", "functions");
  const files = walk(base).map((f) => path.relative(dir, f).replace(/\\/g, "/")).filter((f) => /\.(js|ts)$/.test(f) && (kind === "blocky" ? /blocky/.test(f) : /fruit/i.test(f)));
  const reference = kind === "blocky" || fruitHere ? here : fromMain;
  const differ = files.filter((f) => { const want = reference(f); return want === null || norm(want) !== norm(fs.readFileSync(path.join(dir, f), "utf8")); });
  const other = walk(base).filter((f) => (kind === "blocky" ? /fruit/i.test(f) : /blocky/i.test(f))).length;
  console.log(`${fn}: ${files.length} ${kind === "blocky" ? "Blocky" : "Fruit"} files live, ${differ.length} differ from ${kind === "blocky" || fruitHere ? "this folder" : "main"}; files of the other product in its bundle: ${other}${differ.length ? `\n  ${differ.join("\n  ")}` : ""}`);
  if (differ.length || other) allSame = false;
  fs.rmSync(dir, { recursive: true, force: true });
}
const list = spawnSync("npx", ["supabase", "functions", "list"], { cwd: ROOT, shell: true, encoding: "utf8" });
try {
  const j = JSON.parse(list.stdout);
  console.log("last deployed:");
  for (const f of (j.functions ?? j).filter((x) => /blocky|fruit-story-api|fruit-worker|runware-bakeoff/.test(x.slug))) console.log(`  ${f.slug.padEnd(22)} ${new Date(f.updated_at).toISOString()}`);
} catch { /* the list is extra */ }
execFileSync("git", ["checkout", "--", "supabase/.temp/cli-latest"], { cwd: ROOT, stdio: "ignore" });
console.log(allSame ? "ALL SAME" : "DIFFERENCES FOUND");
process.exitCode = allSame ? 0 : 1;
