// PETS probe (2026-11-07): plan a pet story with the free mock director and print what the planner did with the animal.
//   node dev/petsProbe.mjs [pet_dog_bell|cat_roof] [--json]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { planVideo, checkTimeline, checkVisuals, checkSubjects, checkProduction, estimateWords } from "../plan.mjs";
import { directStory } from "../lib/director/index.js";

const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const exists = (rel) => fs.existsSync(path.join(ENGINE, rel));
export async function planPet(name) {
  const script = JSON.parse(fs.readFileSync(path.join(ENGINE, "dev", "scripts", `${name}.json`), "utf8"));
  const direction = await directStory({ script, idea: script.idea, provider: "mock", exists });
  const tl = planVideo({ script, words: estimateWords(script), idea: script.idea, lengthSec: 60, direction, exists });
  return { script, direction, tl };
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  const name = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "pet_dog_bell";
  const { script, direction, tl } = await planPet(name);
  const p = direction.production;
  console.log("PRODUCTION cast:", JSON.stringify(p.cast));
  console.log("PRODUCTION creatures:", JSON.stringify(p.creatures));
  console.log("BIBLE cast:", JSON.stringify(tl.world?.cast));
  console.log("TL cast:", JSON.stringify(tl.cast));
  for (const s of tl.shots) {
    const ls = s.lines ?? [s.line];
    console.log(`L${ls.join(",")} ${s.camera} set=${s.set} subj=${s.subject} actors=${JSON.stringify((s.actors ?? []).map((a) => [a.id, a.pose, a.spot]))} obj=${JSON.stringify((s.objects ?? []).map((o) => [o.name, o.state, o.pet ?? ""]))}${s.insert ? " INSERT " + JSON.stringify(s.insert) : ""} | ${script.lines[ls[0]]?.text}`);
  }
  for (const [k, v] of Object.entries({ timeline: checkTimeline(tl), visuals: checkVisuals(tl, script), subjects: checkSubjects(tl), production: checkProduction(tl) })) console.log(k, v.length ? v : "clean");
  if (process.argv.includes("--json")) fs.writeFileSync(path.join(ENGINE, "out", `${name}.timeline.json`), JSON.stringify(tl, null, 1));
}
