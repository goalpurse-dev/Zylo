// SOUND agent: print the SFX cues lib/sfx.js places for a timeline.  node dev/sfxCues.mjs <timeline.json>
import fs from "node:fs";
import { sfxCues } from "../lib/sfx.js";

const tl = JSON.parse(fs.readFileSync(process.argv[2] ?? "out/paid1/timeline.json", "utf8"));
const cues = sfxCues(tl);
for (const c of cues) console.log(`${c.t.toFixed(2).padStart(7)} ${c.at.toFixed(2).padStart(7)}  ${c.name.padEnd(14)} ${String(c.gainDb).padStart(4)} dB ${c.dur ? `${c.dur}s ` : ""}${c.why}`);
console.log(`${cues.length} cues over ${tl.duration} s`);
