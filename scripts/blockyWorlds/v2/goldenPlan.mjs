// IN THIS TOWN v2, FIX ROUND 2: golden topics N..M one at a time through placeStory.mjs (the planner gets only the
// story text and the catalogue; the location plan is told what earlier stories used so they differ).
//   node --env-file=.env.local scripts/blockyWorlds/v2/goldenPlan.mjs --from 4 --to 12 [--plan-only] [--night_cap 7.3]
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..", "..", "..", "reference", "blocky-worlds", "v2", "night-build");
const argv = process.argv.slice(2), has = (k) => argv.includes(`--${k}`), arg = (k, d = null) => (has(k) ? argv[argv.indexOf(`--${k}`) + 1] : d);
export const GOLDEN = [
  "Every house must keep its porch light on at night, or the shadow comes to the door",
  "Every mailbox eats one letter a night, and nobody knows where they go",
  "Every time you say sorry, a flower grows on your head",
  "Every family paints a yellow footprint path from its door; the fog only takes people who step off it",
  "Every time you lie, your nose lights up",
  "At midnight every house must ring its own doorbell three times, or something else rings it",
  "Every time someone yawns, a pillow falls from the sky",
  "Your shadow does what you really want to do",
  "Grandma's knitting decides tomorrow's weather",
  "Once a year the giant crab from the drain comes to collect lost socks",
  "The town clock eats one minute from whoever is late",
  "my brother keeps stealing my snacks",
];
const used = () => {
  const out = [];
  for (const n of ["keys", "golden2", "golden3", ...Array.from({ length: 12 }, (_, i) => `golden${i + 1}`)]) {
    const f = path.join(ROOT, `story_${n}`, "plan.json");
    if (fs.existsSync(f)) { const p = JSON.parse(fs.readFileSync(f, "utf8")); out.push({ n, town: p.town, sides: p.side_sets, ents: p.cast.filter((c) => c.kind === "entity").map((c) => c.library) }); }
  }
  return out;
};
for (let n = Number(arg("from", 4)); n <= Number(arg("to", 12)); n++) {
  const U = used().filter((u) => u.n !== `golden${n}`);
  const last = U[U.length - 1];
  // differ from the story before (its town) and from every side set / entity used so far
  const avoid = last ? [`town:${last.town}`, ...last.sides.map((s) => `side:${s}`), ...last.ents.map((e) => `entity:${e}`)].join(",") : "";     // differ from the story before
  const of = path.join(ROOT, `story_golden${n}`);
  fs.mkdirSync(of, { recursive: true });
  fs.writeFileSync(path.join(of, "outline.txt"), GOLDEN[n - 1]);
  console.log(`[golden ${n}] ${GOLDEN[n - 1]} | avoid ${avoid}`);
  const r = spawnSync("node", [path.join(HERE, "placeStory.mjs"), "--name", `golden${n}`, "--outline-file", path.join(of, "outline.txt"), "--yes", "--avoid", avoid, "--cap", "1", "--night_cap", arg("night_cap", "7.3"), ...(has("plan-only") ? ["--plan-only"] : [])], { encoding: "utf8", env: process.env, maxBuffer: 1 << 27 });
  console.log(String(r.stdout).split("\n").filter((l) => /writer try|story objects try|prop builder|location plan|plan only|storyboard|STORY FAILS|STILLS FAILED|rewrite/.test(l)).map((l) => l.slice(0, 300)).join("\n"));
  if (r.status) console.log(`[golden ${n}] stopped (exit ${r.status}): ${String(r.stderr).trim().split("\n").slice(-2).join(" | ").slice(0, 300)}`);
}
