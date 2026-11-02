// M3: every kept real failure (m3/failures, from m3/failureCase.mjs), replayed as a whole video through the free harness
// (the owner's rule of 2026-10-30: the same bug never costs money twice). Each case runs on its real run's recorded
// replies (and voice, when it had one); a preview check the real run never got to is passed here (its verdict is not
// what is tested; --judge stops for a written one instead). A case passes when its video is made.
//   node m3/replayFailures.mjs --ctx BUILD_CONTEXT --proto RENDER_FOLDER --root WORK_DIR [--case NAME] [--judge]
//        [--pull --env-file .env.local]   (--pull keeps the newest failures first)
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url)), FAILURES = path.join(here, "failures");
const argv = process.argv.slice(2), a = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) { const k = argv[i].slice(2); a[k] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true; }
if (!a.ctx || !a.proto || !a.root) { console.error("needs --ctx, --proto and --root"); process.exit(3); }
if (a.pull) spawnSync(process.execPath, [path.join(here, "failureCase.mjs"), "--all", ...(a["env-file"] ? ["--env-file", a["env-file"]] : [])], { stdio: "inherit" });

const names = (a.case ? [a.case] : fs.existsSync(FAILURES) ? fs.readdirSync(FAILURES).sort() : []);
const summary = [];
for (const name of names) {
  const c = JSON.parse(fs.readFileSync(path.join(FAILURES, name, "case.json"), "utf8")), dir = path.join(a.root, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.cpSync(path.join(FAILURES, name, "answers"), path.join(dir, "answers"), { recursive: true });
  let out = null, waiting = null, autoPassed = 0;
  for (let i = 0; i < 8; i++) {
    const p = spawnSync(process.execPath, [path.join(here, "harness.mjs"), "--case", name, "--topic", c.topic, "--length", String(c.lengthSec), "--ctx", a.ctx, "--proto", a.proto, "--root", a.root], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 3600000 });
    out = (() => { try { return JSON.parse(fs.readFileSync(path.join(dir, "result.json"), "utf8")); } catch { return null; } })();
    if (p.status !== 2) break;
    waiting = out?.waiting ?? null;
    if (!waiting?.startsWith("vision_check__") || a.judge) break;
    // the preview check the real run never got to: every frame passed (labelled, so a frame sheet never claims a verdict)
    const req = JSON.parse(fs.readFileSync(path.join(dir, "requests", `${waiting}.json`), "utf8"));
    const roles = [...req.user.matchAll(/Frame (\w+) at/g)].map((m) => m[1]);
    fs.writeFileSync(path.join(dir, "answers", `${waiting}.json`), JSON.stringify({ hash: "*", by: "auto (failure replay: the verdict is not what is tested)", data: { frames: roles.map((role) => ({ role, ok: true, seen: "(not judged)", problem: "" })) } }, null, 1));
    autoPassed++; waiting = null;
  }
  const row = { case: name, topic: c.topic, lengthSec: c.lengthSec, was: `${c.failed.code} after $${c.costUsd}`, ok: out?.ok === true, code: out?.code ?? null, message: out?.message ? String(out.message).split("\n")[0].slice(0, 200) : null, waiting, autoPassed, bugs: out?.bugs ?? [], seconds: out?.seconds ?? null };
  summary.push(row);
  console.log(`${row.ok ? "PASS" : waiting ? "WAITING" : "FAIL"} ${name}: was ${row.was}; now ${row.ok ? "made" : waiting ? `needs ${waiting}` : `${row.code} ${row.message}`}${row.bugs.length ? ` (${row.bugs.length} bookkeeping bugs logged)` : ""}`);
}
fs.mkdirSync(a.root, { recursive: true });
fs.writeFileSync(path.join(a.root, "summary.json"), JSON.stringify(summary, null, 1));
process.exit(summary.every((r) => r.ok) ? 0 : 1);
