// Regenerates rejected characters (up to 3 retries each), then rebuilds the sheet.
//   node scripts/fruit-characters/retry.mjs [decisions.json] [--dry]
// Rejections come from the review sheet's "Save decisions" file (default: the
// newest fruit-decisions*.json in ~/Downloads) and from qa.json (automatic
// check). Only the image that was rejected counts: a newer attempt is left alone.
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const OUT = path.join(ROOT, "data/fruit-characters/refs");
const MAX_ATTEMPTS = 4;
const CAP = 8;

const argFile = process.argv.slice(2).find((a) => !a.startsWith("--"));
const downloads = path.join(os.homedir(), "Downloads");
const newest = () => fs.existsSync(downloads)
  ? fs.readdirSync(downloads).filter((f) => /^fruit-decisions.*\.json$/.test(f)).map((f) => path.join(downloads, f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0]
  : null;
const decisionsFile = argFile ?? newest();

const ledger = JSON.parse(fs.readFileSync(path.join(OUT, "ledger.json"), "utf8"));
const latest = (id) => ledger.filter((r) => r.ok && r.id === id).at(-1)?.attempt ?? 0;
const tries = (id) => ledger.filter((r) => r.ok && r.id === id).length;

const rejected = new Set();
if (decisionsFile) {
  const d = JSON.parse(fs.readFileSync(decisionsFile, "utf8"));
  for (const x of d.decisions) if (x.decision === "rejected" && x.attempt === latest(x.id)) rejected.add(x.id);
  console.log(`decisions: ${path.relative(ROOT, decisionsFile)} (${d.savedAt})`);
}
const qaPath = path.join(OUT, "qa.json");
if (fs.existsSync(qaPath)) {
  for (const [key, v] of Object.entries(JSON.parse(fs.readFileSync(qaPath, "utf8")))) {
    const [id, attempt] = key.split("@");
    if (v.verdict === "reject" && Number(attempt) === latest(id)) rejected.add(id);
  }
}

const ids = [...rejected].filter((id) => tries(id) < MAX_ATTEMPTS);
const flagged = [...rejected].filter((id) => tries(id) >= MAX_ATTEMPTS);
console.log(`rejected ${rejected.size}: retrying ${ids.length}${flagged.length ? `, flagged (out of tries): ${flagged.join(", ")}` : ""}`);
if (ids.length && !process.argv.includes("--dry")) {
  spawnSync(process.execPath, [path.join(HERE, "generate.mjs"), "--out", OUT, "--cap", String(CAP), "--again", "--concurrency", "4", "--ids", ids.join(",")], { stdio: "inherit" });
}
spawnSync(process.execPath, [path.join(HERE, "sheet.mjs")], { stdio: "inherit" });
