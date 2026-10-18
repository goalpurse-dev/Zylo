// Content Machine: no paid call outside the Budget Guard. Fails if any Content Machine source file names
// a paid provider's API host, except the provider modules (_shared/contentMachine/providers/), whose
// calls take a ticket only budgetGuard.spend hands out (from Phase 2 on).
//   node scripts/contentMachine/checkPaidCalls.mjs     (also run by tests/contentMachine.test.mjs)
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const PAID_HOSTS = [/api\.runware\.ai/i, /api\.anthropic\.com/i, /api\.apify\.com/i, /googleapis\.com\/youtube/i, /api\.machines\.dev/i, /api\.openai\.com/i];
const ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const SCANNED = ["supabase/functions/_shared/contentMachine", "supabase/functions/content-machine-api", "supabase/functions/content-machine-worker"];
const ALLOWED = "supabase/functions/_shared/contentMachine/providers/";

function files(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.(js|ts|mjs)$/.test(n) ? [p] : [];
  });
}

export function findPaidCallsOutsideGuard(root = ROOT) {
  const hits = [];
  for (const d of SCANNED) for (const f of files(join(root, d))) {
    const rel = relative(root, f).replaceAll("\\", "/");
    if (rel.startsWith(ALLOWED)) continue;
    readFileSync(f, "utf8").split("\n").forEach((line, i) => {
      if (PAID_HOSTS.some((re) => re.test(line))) hits.push(`${rel}:${i + 1}: ${line.trim()}`);
    });
  }
  return hits;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const hits = findPaidCallsOutsideGuard();
  if (hits.length) {
    console.error("Paid provider calls outside the Budget Guard's provider modules:\n" + hits.join("\n"));
    process.exit(1);
  }
  console.log("ok: no paid provider call outside the Budget Guard.");
}
