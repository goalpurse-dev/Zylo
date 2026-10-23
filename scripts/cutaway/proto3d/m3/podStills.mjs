// M3, on the GPU machine: the same stills with each diagnostic flag set (m3/flags.mjs DIAG_SETS), with the page's
// context-loss messages counted, packed into /work/stills.tgz for the controller. Writes stills.json.
//   CHROME_PATH=... node m3/podStills.mjs <page key> <times, comma-separated> <out.json>
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { DIAG_SETS } from "./flags.mjs";

const [key, times, out] = process.argv.slice(2);
fs.mkdirSync("/work/stills", { recursive: true });
const rows = [];
for (const [name, args] of Object.entries(DIAG_SETS)) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, ["render.mjs", "ffmpeg", `/work/stills/${name}`, "1", "30", times], { env: { ...process.env, PAGE: `m2_${key}.html`, CHROME_ARGS: JSON.stringify(args) }, encoding: "utf8", timeout: 180000 });
  const log = (r.stdout ?? "") + (r.stderr ?? "");
  rows.push({ name, seconds: (Date.now() - t0) / 1000, status: r.status, contextLost: (log.match(/Context Lost/g) ?? []).length, contextRestored: (log.match(/Context Restored/g) ?? []).length, errors: log.split("\n").filter((l) => /error|404/i.test(l)).slice(0, 5) });
  console.log(JSON.stringify(rows.at(-1)));
}
spawnSync("tar", ["-czf", "/work/stills.tgz", "-C", "/work/stills", "."]);
fs.writeFileSync(out, JSON.stringify(rows, null, 1));
