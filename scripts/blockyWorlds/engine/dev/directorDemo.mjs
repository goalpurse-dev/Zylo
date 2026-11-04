// The story director on the turtle-vs-wolf example (free: the mock director + the matcher, no network).
//   node dev/directorDemo.mjs            -> the production list summary, the capability calls, the gaps, per line
//   node dev/directorDemo.mjs --json     -> the whole result as JSON
// It shows a "town on a giant turtle attacked by a wolf army" story mapping onto world.creature + giant + crowd +
// camera.shake / camera.action with no special code: the same rules as every other story.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { directStory } from "../lib/director/index.js";
import { makeGapLog, memoryStore } from "../lib/gaps.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

export const TURTLE_IDEA = Object.freeze({
  title: "The Turtle Town", mood: "epic", formula: "F4", twistType: "T3", setting: "a town on the back of a giant sea turtle",
  opener: "In this world, our whole town lives on the back of a giant turtle.",
  premise: "A town on a giant sea turtle's shell must survive when a wolf army waits on the shore.",
  narrator: "Pip, the only kid who can hear the turtle hum.", prop: "a tin whistle",
  twist: "The turtle was never sleeping; it was waiting for someone to ask it to swim away.",
  teaser: "The wolves were never after the town.", closer: "Now our town goes wherever the turtle wants.",
});
export const TURTLE_SCRIPT = Object.freeze({
  title: "The Turtle Town",
  lines: [
    { part: "rule", text: "In this world, our whole town lives on the back of a giant turtle." },
    { part: "tour", text: "When the turtle yawns, every house tilts to the left." },
    { part: "tour", text: "Mr. Oak waters the moss on the shell every morning." },
    { part: "me", text: "I'm Pip, and I always keep a tin whistle in my pocket." },
    { part: "until", text: "Until one night, a pack of wolves gathered on the shore." },
    { part: "until", text: "Then hundreds of wolves lined up and marched toward the water." },
    { part: "until", text: "The whole town screamed as the wolf army charged across the beach." },
    { part: "discovery", text: "The turtle opened one giant eye and stomped its huge foot." },
    { part: "discovery", text: "The ground shook so hard the wolves fled into the trees." },
    { part: "climax", text: "I blew my tin whistle, and the turtle swam out to sea." },
    { part: "closer", text: "Now our town goes wherever the turtle wants." },
  ],
});

export async function runDemo({ gapLog = makeGapLog({ store: memoryStore() }) } = {}) {
  return directStory({ script: TURTLE_SCRIPT, idea: TURTLE_IDEA, provider: "mock", gapLog, storyId: "demo-turtle-wolves", exists });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = await runDemo();
  if (process.argv.includes("--json")) { console.log(JSON.stringify(r, null, 2)); process.exit(0); }
  const p = r.production;
  console.log(`PRODUCTION (${r.provider}): ${p.summary}`);
  console.log(` worlds:    ${p.worlds.map((w) => `${w.id} [${w.kind}${w.creature.relation !== "none" ? ` ${w.creature.relation} ${w.creature.species}` : ""}]`).join(", ")}`);
  console.log(` cast:      ${p.cast.map((c) => `${c.id} (${c.role})`).join(", ")}`);
  console.log(` creatures: ${p.creatures.map((c) => `${c.id} [${c.scale}${c.heightM ? ` ${c.heightM} m` : ""}; ${c.behaviours.join("/") || "-"}]`).join(", ")}`);
  console.log(` crowds:    ${p.crowds.map((c) => `${c.id} [${c.member} of ${c.of || "-"} x${c.count}; ${c.actions.join("/") || "-"}]`).join(", ")}`);
  console.log(` props:     ${p.props.map((x) => x.id).join(", ")}   effects: ${p.effects.map((x) => x.id).join(", ") || "-"}   events: ${p.events.map((x) => x.id).join(", ") || "-"}`);
  console.log("\nCAPABILITY CALLS");
  for (const c of r.match.calls) console.log(`  ${c.item.padEnd(16)} -> ${c.capability.padEnd(18)} ${c.status.padEnd(8)} via ${c.route}${c.kitName ? ` (${c.kitName})` : ""}${c.needId ? ` [builder ${c.needId}]` : ""}${c.unsupported?.length ? `  missing: ${c.unsupported.join(", ")}` : ""}`);
  console.log("\nBUILDER NEEDS");
  for (const n of r.match.builderNeeds) console.log(`  ${n.id} ${n.kind} "${n.name}"${n.giant ? ` giant ${n.heightM} m` : ""}${n.hint ? ` hint ${JSON.stringify(n.hint)}` : ""}`);
  console.log("\nGAPS");
  for (const g of r.match.gaps) console.log(`  ${g.capability.padEnd(18)} ${g.detail.padEnd(20)} ${g.name}  (line ${g.line})`);
  console.log("\nPER LINE");
  for (const l of r.match.perLine) console.log(`  ${String(l.line).padStart(2)} [${l.camera}] ${l.text}\n      ${l.required.map((x) => `${x.id}:${x.route}`).join("  ")}${l.extras.length ? `  | ${l.extras.map((e) => `${e.capability} ${e.status}`).join(", ")}` : ""}`);
  console.log(`\n${JSON.stringify(r.match.summary)}`);
}
