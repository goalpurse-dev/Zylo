// Blocky Stories and AI Fruit Story are two products that share no code.
//
//   1. Nothing of Blocky's imports from Fruit's folders, or names a Fruit
//      table, RPC, function or storage folder.
//   2. Nothing of Fruit's imports from Blocky's folders.
//   3. Fruit's files are exactly main's: Blocky's branch changes none of them
//      (one allowed file: the README note about the duplicated provider files).
//   4. The local env file with keys can't be committed.
//
// So Blocky can be changed and deployed with no way of breaking Fruit, and
// deploying Blocky never needs a Fruit function to be redeployed.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { envFilesInGit, isSecretEnvFile } from "../scripts/blocky/checkEnvNotStaged.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 26 }).split("\n").map((l) => l.trim()).filter(Boolean);

/** Blocky's product code (what is deployed or built into the app). */
const BLOCKY = [
  "supabase/functions/_shared/blocky",
  "supabase/functions/blocky-story-api",
  "supabase/functions/blocky-worker",
  "src/components/viral-tools/blocky-stories",
  "src/pages/workspace/BlockyStories.jsx",
  "src/data/blockyStories.js",
  "render-worker/src/blockyFinal.mjs",
  "render-worker/src/blockyFinalPlan.mjs",
  "render-worker/src/blockyCaptions.mjs",
];
/** Fruit's files, and the picture proxy Long Form runs on: none of them is Blocky's to change. */
const FRUIT = [
  "supabase/functions/_shared/fruit",
  "supabase/functions/fruit-story-api",
  "supabase/functions/fruit-worker",
  "supabase/functions/fruit-story-ideas",
  "supabase/functions/fruit-story-planner",
  "supabase/functions/fruit-story-video-prompts",
  "supabase/functions/runware-bakeoff-proxy",
  "src/components/viral-tools/ai-fruit-story",
  "src/components/viral-tools/ai-fruit-story-v2",
  "src/pages/workspace/AIFruitStory.jsx",
  "src/pages/landing/AIFruitStoryLanding.jsx",
  "src/data/fruitStoryPages.js",
  "scripts/fruit-story",
  "scripts/fruit-characters",
  "render-worker/src/fruitFinal.mjs",
  "render-worker/src/fruitFinalPlan.mjs",
  "render-worker/src/fruitCaptions.mjs",
  "render-worker/test/fruitFinal.test.mjs",
  "supabase/seeds/fruit_characters.sql",
  "supabase/seeds/fruit_ideas.sql",
  "public/lp/fruit",
  "tests/helpers/fruitMemoryStore.mjs",
];
/** The one file Blocky's branch adds inside a Fruit folder: the owner asked for this note. It is imported by nothing, so it is in no deployed function. */
const ALLOWED_IN_FRUIT = ["supabase/functions/_shared/fruit/README.md"];

const CODE = /\.(js|jsx|mjs|ts|tsx)$/;
function filesUnder(rel) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) return [];
  if (fs.statSync(full).isFile()) return [rel];
  return fs.readdirSync(full, { withFileTypes: true }).flatMap((e) => (e.name === "node_modules" ? [] : filesUnder(`${rel}/${e.name}`)));
}
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
/** Every module a file loads: import … from "x", export … from "x", import("x"), and JSDoc import("x") types. */
const importsOf = (text) => [
  ...text.matchAll(/(?:^|[}\s*])from\s+["']([^"'\n]+)["'];?[ \t]*(?:\/\/.*)?$/gm),
  ...text.matchAll(/^\s*import\s+["']([^"'\n]+)["']/gm),
  ...text.matchAll(/\bimport\(\s*["'`]([^"'`\n]+)["'`]\s*\)/g),
].map((m) => m[1]);

test("Blocky imports nothing from Fruit, and never names a Fruit table, function or folder", () => {
  const files = BLOCKY.flatMap(filesUnder).filter((f) => CODE.test(f));
  assert.ok(files.length > 60, `Blocky's files are there (${files.length})`);
  let seen = 0;
  for (const f of files) {
    const text = read(f);
    for (const spec of importsOf(text)) { seen += 1; assert.doesNotMatch(spec, /fruit/i, `${f} imports ${spec}`); }
    // The words left after the two places that may say them: the banned-names list (a real game called "Blox Fruits")
    // and the header comments that say Blocky is separate from AI Fruit Story.
    const rest = text.replace(/Blox Fruits|bloxfruits|BLOX {2}FRUITS/g, "").replace(/AI Fruit Story's/g, "");
    assert.doesNotMatch(rest, /fruit/i, `${f} mentions Fruit`);
  }
  assert.ok(seen > 200, `the scan really read the imports (${seen})`);
});

test("the engine folder imports only from itself", () => {
  for (const f of filesUnder("supabase/functions/_shared/blocky").filter((x) => CODE.test(x))) {
    for (const spec of importsOf(read(f))) {
      // JSDoc types may point at Blocky's own data contract in the page folder.
      if (/src\/components\/viral-tools\/blocky-stories\//.test(spec)) continue;
      assert.match(spec, /^\.\/[A-Za-z]+\.js$/, `${f} imports ${spec}`);
    }
  }
});

test("Fruit imports nothing from Blocky", () => {
  const files = FRUIT.flatMap(filesUnder).filter((f) => CODE.test(f));
  assert.ok(files.length > 60, `Fruit's files are there (${files.length})`);
  for (const f of files) for (const spec of importsOf(read(f))) assert.doesNotMatch(spec, /blocky/i, `${f} imports ${spec}`);
});

test("Fruit's files are exactly main's: an empty diff, and nothing added", (t) => {
  let base;
  try { [base] = git("merge-base", "HEAD", "origin/main"); } catch { /* no origin/main here */ }
  if (!base) return t.skip("origin/main is not fetched here");
  const allowed = new Set(ALLOWED_IN_FRUIT);
  const changed = git("diff", "--name-only", base, "--", ...FRUIT).filter((f) => !allowed.has(f));
  const added = git("ls-files", "--others", "--exclude-standard", "--", ...FRUIT).filter((f) => !allowed.has(f));
  assert.deepEqual(changed, [], "changed against main");
  assert.deepEqual(added, [], "new files in Fruit's folders");
  // The allowed note is a note: Markdown, loaded by nothing.
  for (const f of ALLOWED_IN_FRUIT) assert.match(f, /\.md$/);
});

test("the local env file with keys can't be committed", () => {
  for (const f of [".env", ".env.local", ".env.blocky.local", "supabase/.env", "supabase/functions/.env"]) assert.ok(isSecretEnvFile(f), f);
  for (const f of [".env.blocky.local.example", "src/env.js", "docs/blocky-local.md"]) assert.ok(!isSecretEnvFile(f), f);
  // git ignores it …
  assert.equal(git("check-ignore", ".env.blocky.local")[0], ".env.blocky.local");
  // … and no env file is tracked or staged right now (the pre-commit hook runs the same check).
  assert.deepEqual(envFilesInGit(), { tracked: [], staged: [] });
  assert.match(read(".githooks/pre-commit"), /checkEnvNotStaged\.mjs/);
});
