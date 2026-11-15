// Blender kit engine: the owner's decisions on the asset library (library.mjs). Free, local; commit the changed entry.
//   node scripts/blockyWorlds/blenderKit/approve.mjs --list
//   node scripts/blockyWorlds/blenderKit/approve.mjs <id>             approve (later runs may reuse it)
//   node scripts/blockyWorlds/blenderKit/approve.mjs <id> --reject    reject (never offered)
//   node scripts/blockyWorlds/blenderKit/approve.mjs <id> --pending   back to pending
import { listAssets, setStatus } from "./library.mjs";

const argv = process.argv.slice(2);
if (!argv.length || argv.includes("--list")) {
  for (const a of listAssets()) console.log(`${a.status.padEnd(8)} ${a.id.padEnd(48)} ${a.kind.padEnd(8)} ${a.about}`);
  if (!argv.length) console.log("\nusage: node approve.mjs <id> [--reject | --pending] | --list");
} else {
  const id = argv.find((a) => !a.startsWith("--"));
  const e = setStatus(id, argv.includes("--reject") ? "rejected" : argv.includes("--pending") ? "pending" : "approved");
  console.log(`${e.id}: ${e.status} (${e.name}, ${e.kind}); commit scripts/blockyWorlds/blenderKit/library/items/${e.id}.json`);
}
