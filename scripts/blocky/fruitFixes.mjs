// Standing rule (owner, 2026-10-07): whenever AI Fruit Story's engine gets a
// fix, in any session, check whether Blocky's copy has the same fault and port
// the fix with its tests. Every ported fix is listed in
// supabase/functions/_shared/blocky/README.md with its date and Fruit commit.
//
// This file is how that rule is kept:
//   - fingerprint(): one hash of Fruit's twin files as they are in this folder.
//     The README records the fingerprint from the last time the two engines
//     were compared. tests/blockySeparation.test.mjs fails when they differ,
//     in whatever session changed Fruit, until the change is ported (or
//     recorded as not needed) and the mark is moved.
//   - node scripts/blocky/fruitFixes.mjs          what changed in Fruit's twins since the last comparison
//   - node scripts/blocky/fruitFixes.mjs --mark   after porting and adding the README row: record today's state
// It only reads Fruit's files. It never changes them.
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const README = "supabase/functions/_shared/blocky/README.md";
/** Fruit's files that Blocky has a copy of (the README's "duplicated on purpose" list), and where a Fruit SQL change would arrive. */
export const TWIN_DIRS = ["supabase/functions/_shared/fruit", "supabase/functions/fruit-story-api", "supabase/functions/fruit-worker"];
export const TWIN_FILES = ["render-worker/src/fruitFinal.mjs", "render-worker/src/fruitFinalPlan.mjs", "render-worker/src/fruitCaptions.mjs"];
const FRUIT_SQL = /fruit/i;                       // migrations named for Fruit
const NOT_CODE = /(^|\/)README\.md$/;             // the note Blocky added to Fruit's folder

function twinFiles() {
  const walk = (rel) => fs.readdirSync(path.join(ROOT, rel), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${rel}/${e.name}`) : [`${rel}/${e.name}`]));
  const sql = fs.readdirSync(path.join(ROOT, "supabase/migrations")).filter((f) => FRUIT_SQL.test(f)).map((f) => `supabase/migrations/${f}`);
  return [...TWIN_DIRS.flatMap(walk), ...TWIN_FILES, ...sql].filter((f) => !NOT_CODE.test(f) && fs.existsSync(path.join(ROOT, f))).sort();
}

/** One short hash of every twin file's path and content (line endings ignored). */
export function fingerprint() {
  const h = crypto.createHash("sha256");
  for (const f of twinFiles()) h.update(`${f}\n`).update(fs.readFileSync(path.join(ROOT, f), "utf8").replace(/\r\n/g, "\n")).update("\n\u0000");
  return h.digest("hex").slice(0, 16);
}

/** {commit, fingerprint, date} from the README's "last compared" line. */
export function readMark() {
  const m = fs.readFileSync(path.join(ROOT, README), "utf8").match(/Last compared with Fruit: (\d{4}-\d{2}-\d{2}), Fruit at commit `([0-9a-f]{7,40})`, fingerprint `([0-9a-f]{16})`/);
  return m ? { date: m[1], commit: m[2], fingerprint: m[3] } : null;
}

/** The Fruit commits listed in the README's table of ported fixes. */
export function listedCommits() {
  const text = fs.readFileSync(path.join(ROOT, README), "utf8");
  const a = text.indexOf("## Fixes ported from Fruit");
  return a < 0 ? [] : [...text.slice(a).matchAll(/^\|\s*\d{4}-\d{2}-\d{2}\s*\|\s*`([0-9a-f]{7,40})`/gm)].map((m) => m[1]);
}

const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mark = readMark();
  const now = fingerprint();
  if (!mark) { console.error(`${README} has no "Last compared with Fruit" line.`); process.exit(1); }
  const paths = [...TWIN_DIRS, ...TWIN_FILES, "supabase/migrations"];
  const listed = listedCommits();
  // Fruit commits since the last comparison that touched a twin (Blocky's own README note is not one).
  const since = git("log", "--format=%h|%cs|%s", `${mark.commit}..HEAD`, "--", ...paths, ":(exclude)supabase/functions/_shared/fruit/README.md").split("\n").filter(Boolean)
    .map((l) => { const [sha, date, ...s] = l.split("|"); return { sha, date, subject: s.join("|") }; })
    .filter((c) => git("show", "--format=", "--name-only", c.sha).split("\n").some((f) => (TWIN_DIRS.some((d) => f.startsWith(`${d}/`)) || TWIN_FILES.includes(f) || (f.startsWith("supabase/migrations/") && FRUIT_SQL.test(f))) && !NOT_CODE.test(f)));
  console.log(`Last compared: ${mark.date}, Fruit at ${mark.commit}, fingerprint ${mark.fingerprint}`);
  console.log(`Fruit's twin files now: fingerprint ${now}${now === mark.fingerprint ? "  (unchanged: Blocky is missing nothing that is known)" : "  (CHANGED since the last comparison)"}`);
  if (since.length) {
    console.log(`\nFruit commits since then that touched a twin file:`);
    for (const c of since) console.log(`  ${c.sha} ${c.date} ${c.subject}${listed.some((s) => c.sha.startsWith(s) || s.startsWith(c.sha)) ? "   [listed in the README]" : "   [NOT LISTED: port it, or record why Blocky doesn't need it]"}`);
  }
  if (process.argv.includes("--mark")) {
    const head = git("rev-parse", "--short", "HEAD");
    const today = new Date().toISOString().slice(0, 10);
    const file = path.join(ROOT, README);
    const text = fs.readFileSync(file, "utf8");
    fs.writeFileSync(file, text.replace(/Last compared with Fruit: \d{4}-\d{2}-\d{2}, Fruit at commit `[0-9a-f]{7,40}`, fingerprint `[0-9a-f]{16}`/, `Last compared with Fruit: ${today}, Fruit at commit \`${head}\`, fingerprint \`${now}\``));
    console.log(`\nMarked: ${today}, ${head}, ${now}. Commit the README with the port.`);
  } else if (now !== mark.fingerprint) {
    console.log(`\nNext: read the change (git diff ${mark.commit}..HEAD -- ${TWIN_DIRS[0]}), port it to Blocky's twin with its tests, add a row to "${README}" → "Fixes ported from Fruit", then run this again with --mark.`);
    process.exitCode = 1;
  }
}
