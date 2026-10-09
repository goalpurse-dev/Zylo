// Blocky Stories and AI Fruit Story are two products that share no code.
//
//   1. Nothing of Blocky's imports from Fruit's folders, or names a Fruit
//      table, RPC, function or storage folder.
//   2. Nothing of Fruit's imports from Blocky's folders.
//   3. Fruit's files are main's, except the changes the owner asked for by name
//      (the README note, and the one-caption-track fix ported from Blocky).
//   4. An env file with keys can't be committed.
//   5. A fix to Fruit's engine never goes unnoticed: Fruit's twin files carry the fingerprint the README
//      recorded when the two engines were last compared.
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
import { README as BLOCKY_README, fingerprint, listedCommits, readMark } from "../scripts/blocky/fruitFixes.mjs";

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
/**
 * The only ways this branch may differ from main inside Fruit's folders, each one asked for by the owner:
 *   - the README note (2026-10-06): imported by nothing, so in no deployed function;
 *   - the one-caption-track fix ported from Blocky (2026-10-08; fruit/README.md "Fixes ported from Blocky
 *     to Fruit"), with its next-model step (a clip with drawn subtitles goes straight to the next clip
 *     model; asked for on 2026-10-08). Deployed to Fruit's functions only on the owner's go.
 * Any other difference fails. Once this branch is merged into main the list is simply not needed.
 */
const ALLOWED_IN_FRUIT = [
  "supabase/functions/_shared/fruit/README.md",
  "supabase/functions/_shared/fruit/clips.js",
  "supabase/functions/_shared/fruit/clipCheck.js",
  "supabase/functions/_shared/fruit/pictureCheck.js",
  "supabase/functions/_shared/fruit/engine.js",
  "supabase/functions/_shared/fruit/final.js",
  "supabase/functions/_shared/fruit/supabaseStore.js",
  "supabase/functions/fruit-worker/index.ts",
  "supabase/functions/fruit-story-api/index.ts",
  "tests/helpers/fruitMemoryStore.mjs",
];

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

test("Fruit's files are main's, except the changes the owner asked for by name", (t) => {
  let base;
  try { [base] = git("merge-base", "HEAD", "origin/main"); } catch { /* no origin/main here */ }
  if (!base) return t.skip("origin/main is not fetched here");
  const allowed = new Set(ALLOWED_IN_FRUIT);
  const changed = git("diff", "--name-only", base, "--", ...FRUIT).filter((f) => !allowed.has(f));
  const added = git("ls-files", "--others", "--exclude-standard", "--", ...FRUIT).filter((f) => !allowed.has(f));
  assert.deepEqual(changed, [], "changed against main");
  assert.deepEqual(added, [], "new files in Fruit's folders");
  // The approved code change is the caption fix and nothing else: each changed Fruit file mentions it.
  for (const f of git("diff", "--name-only", base, "--", ...FRUIT).filter((x) => allowed.has(x) && !/\.md$/.test(x))) {
    assert.match(read(f), /drawn|speech|negativePrompt/i, `${f} differs from main for the caption fix`);
  }
});

test("an env file with keys can't be committed", () => {
  for (const f of [".env", ".env.local", ".env.production", ".env.anything.local", "supabase/.env", "supabase/functions/.env"]) assert.ok(isSecretEnvFile(f), f);
  for (const f of [".env.example", "src/env.js", "docs/roblox-scope.md"]) assert.ok(!isSecretEnvFile(f), f);
  // git ignores the one that holds the keys …
  assert.equal(git("check-ignore", ".env.local")[0], ".env.local");
  // … and no env file is tracked or staged right now (the pre-commit hook runs the same check).
  assert.deepEqual(envFilesInGit(), { tracked: [], staged: [] });
  assert.match(read(".githooks/pre-commit"), /checkEnvNotStaged\.mjs/);
});

test("a change to Fruit's engine is ported to Blocky's copy, or recorded, before anything else", () => {
  // Standing rule (owner, 2026-10-07). This fails in whatever session changed one of Fruit's twin files:
  //   node scripts/blocky/fruitFixes.mjs          lists the Fruit commits since the last comparison
  //   port the fix to Blocky's twin with its tests (or note why Blocky doesn't need it), add a row to
  //   the README's "Fixes ported from Fruit" table, then: node scripts/blocky/fruitFixes.mjs --mark
  const mark = readMark();
  assert.ok(mark, `${BLOCKY_README} has its "Last compared with Fruit" line`);
  assert.equal(fingerprint(), mark.fingerprint, `Fruit's engine files changed since they were last compared with Blocky's (${mark.date}, ${mark.commit}). Run: node scripts/blocky/fruitFixes.mjs`);
  // The table lists at least the first ported fix, each row with a real commit.
  const listed = listedCommits();
  assert.ok(listed.includes("e1e1583"));
  for (const sha of listed) assert.doesNotThrow(() => git("cat-file", "-e", `${sha}^{commit}`), `${sha} is a commit`);
});
