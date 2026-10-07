// Fails (exit 1) if a local env file with keys is tracked by git or staged
// for a commit. Runs as the pre-commit hook (.githooks/pre-commit) and inside
// the test suite (tests/blockySeparation.test.mjs).
//   node scripts/blocky/checkEnvNotStaged.mjs
import { execFileSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).split("\n").map((l) => l.trim()).filter(Boolean);

/** An env file that may hold keys: .env, .env.local, .env.production, supabase/.env… Never the *.example files. */
export const isSecretEnvFile = (file) => /(^|\/)\.env(\.[^/]*)?$/.test(file) && !/\.example$/.test(file);

/** {tracked, staged}: env files git already holds, and env files added to the next commit. */
export function envFilesInGit() {
  return {
    tracked: git("ls-files").filter(isSecretEnvFile),
    staged: git("diff", "--cached", "--name-only", "--diff-filter=ACMR").filter(isSecretEnvFile),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { tracked, staged } = envFilesInGit();
  const bad = [...new Set([...tracked, ...staged])];
  if (bad.length) {
    console.error(`An env file with keys must never be committed: ${bad.join(", ")}\nUnstage it with: git restore --staged ${bad.join(" ")}`);
    process.exit(1);
  }
}
