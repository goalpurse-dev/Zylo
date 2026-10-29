// M2: the golden set's inputs: the approved scripts (from the approved voices' words) with their sentence roles and
// their verified facts, in the planner's script shape. The golden remake gives these to the planner (no script or
// fact-check call), which plans the scene from scratch; the result is compared with the hand-built video.
//   node m2/layouts/goldenScripts.mjs <outDir>
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sentencesOf } from "../curves.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const R = "C:/Users/Public/Zylo/research/seamless-niche";
const out = process.argv[2] ?? path.join(R, "work", "m2golden");
const GOLD = {
  french_drain: { words: `${R}/m2drain/voice/voice_final.words.json`, hero: "a French drain", title: "How a French drain works", parts: ["trench along the house", "rain", "foundation wall", "crack", "gravel", "perforated pipe", "outlet pipe", "soak pit", "filter fabric", "mud", "a French flag", "an 1859 book", "grass cap", "bushes"],
    facts: [{ verdict: "keep", claim: "One inch of rain on a 1,000 sq ft roof is about 623 gallons", sources: [{ url: "https://agrilifetoday.tamu.edu/?p=313689", title: "Texas A&M AgriLife" }] }, { verdict: "keep", claim: "Five feet down, still water pushes about 312 lb on each square foot", sources: [{ url: "https://pubs.usgs.gov/circ/2004/circ1268/htdocs/text-conversion.html", title: "USGS" }] }, { verdict: "keep", claim: "Named after Judge Henry Flagg French and his 1859 book Farm Drainage", sources: [{ url: "https://en.wikipedia.org/wiki/Henry_Flagg_French", title: "Wikipedia" }] }],
    cards: [["600 GALLONS", "problem", "600"], ["300 LB", "stakes", "300"], ["1859", "mythFact", "1859."]] },
  landfill: { words: `${R}/m1/voice_tests/voice_final_eric.words.json`, hero: "a landfill liner", title: "How a landfill works", parts: ["pit", "dump truck", "trash bags", "trash juice seeping to the groundwater", "clay base", "plastic liner", "drain pipe", "tank", "soil covers", "a 1952 newspaper", "gas bubbles", "gas pipe", "flare", "generator", "grass cap", "fence", "young trees"],
    facts: [{ verdict: "keep", claim: "A 1952 newspaper dug up from a landfill decades later was still readable", sources: [{ url: "https://www.csmonitor.com/1992/1208/08131.html", title: "Christian Science Monitor" }] }, { verdict: "keep", claim: "About 490 US landfills feed their gas to energy projects", sources: [{ url: "https://www.epa.gov/lmop", title: "EPA LMOP" }] }],
    cards: [["37 YEARS", "factProof", "readable"], ["480 LANDFILLS", "myth", "electricity"]] },
};
fs.mkdirSync(out, { recursive: true });
for (const [key, g] of Object.entries(GOLD)) {
  const T = JSON.parse(fs.readFileSync(path.join(here, `${key}.template.json`), "utf8"));
  const ss = sentencesOf(JSON.parse(fs.readFileSync(g.words, "utf8")), T.roles);
  const sentences = ss.map((s) => ({ role: s.role, text: s.text }));
  const cards = g.cards.map(([text, role, word]) => ({ text, sentence: sentences.findIndex((s) => s.role === role), word: word.replace(/[^\w']/g, "") }));
  fs.writeFileSync(path.join(out, `${key}.script.json`), JSON.stringify({ title: g.title, hero: g.hero, sentences, surprises: [], cards, parts: g.parts, facts: g.facts }, null, 1));
  // the saved layout keeps its verified facts, so a new video of the topic skips the fact-check
  fs.writeFileSync(path.join(here, `${key}.template.json`), JSON.stringify({ ...T, facts: g.facts }, null, 1));
  console.log(key, sentences.length, "sentences");
}
