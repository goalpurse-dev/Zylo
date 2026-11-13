// STUDIO ASSET LIBRARY: the owner's decisions (studio/library/library.mjs). Free, local; then commit the changed entry.
//   node scripts/blockyWorlds/studio/library/approve.mjs <id>             approve (customers' runs may reuse it)
//   node scripts/blockyWorlds/studio/library/approve.mjs <id> --reject    reject (never offered again)
//   node scripts/blockyWorlds/studio/library/approve.mjs <id> --pending   back to pending
//   node scripts/blockyWorlds/studio/library/approve.mjs --list           every entry and its status
//   node scripts/blockyWorlds/studio/library/approve.mjs --review         rewrite review.html
import { listAssets, setStatus, writeReview } from "./library.mjs";

const argv = process.argv.slice(2);
if (argv.includes("--list") || !argv.length) {
  for (const a of listAssets()) console.log(`${a.status.padEnd(8)} ${a.id.padEnd(36)} ${a.kind.padEnd(8)} ${a.name}${a.size ? ` (${a.size.w} x ${a.size.h} x ${a.size.d} m)` : ""}`);
  if (!argv.length) console.log("\nusage: node approve.mjs <id> [--reject | --pending] | --list | --review");
} else if (argv.includes("--review")) console.log(`review page: ${writeReview()}`);
else {
  const id = argv.find((a) => !a.startsWith("--"));
  const e = setStatus(id, argv.includes("--reject") ? "rejected" : argv.includes("--pending") ? "pending" : "approved");
  console.log(`${e.id}: ${e.status} (${e.name}, ${e.kind}). Review page updated; commit studio/library/items/${e.id}.json + review.html.`);
}
