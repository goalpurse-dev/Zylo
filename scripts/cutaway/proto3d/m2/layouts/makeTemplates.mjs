// M2: the saved-layout templates of the two golden topics: the same world and parts as the golden layouts, but
// what happens is written as beats (kit verbs on words, keyed to sentence roles) and the camera as shots for the
// director. A new script with the same roles re-uses them with no scene planning. These are what the planner writes
// for a new topic too. Writes landfill.template.json and french_drain.template.json.
//   node m2/layouts/makeTemplates.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const gold = (k) => JSON.parse(fs.readFileSync(path.join(here, `${k}.json`), "utf8"));
const v = (p, verb, w, extra = {}) => ({ p, v: verb, ...(w ? { w } : {}), ...extra });
const W = (s, w, o) => (o ? { s, w, o } : { s, w });

function frenchDrain() {
  const g = gold("french_drain");
  const OFF = [15.5, 10.5, 50], HOME_T = [-3.5, 1.0, -4.0];
  const roles = ["hook", "problem", "flood", "stakes", "fix1", "fix2", "name", "how", "fix3", "myth", "mythFact", "finish", "congrats"];
  const beats = [
    { s: "hook", do: [v("dig", "dig", "dig")] },
    { s: "problem", do: [v("light", "storm", "But"), v("rain", "start", "But"), v("lawn", "wet", "But"), v("eave", "start", "roof"), v("puddles", "rise", "dumps"), v("trenchWater", "trickle", "dumps", { d: 2.9 }), v("wetBand", "wet", "walls")], shot: { focus: "home", scale: 0.9 } },
    { s: "flood", do: [v("trenchWater", "flood", "ditch")], shot: { focus: ["trenchWater"], view: "high", width: 1.0 } },
    { s: "stakes", do: [v("pressure", "show", "pushes"), v("crack", "grow", "cracks")], shot: { at: W("stakes", "cracks"), focus: ["crack"], view: "close", width: 0.3 } },
    { s: "fix1", do: [v("pressure", "hide", "So"), v("gravel", "fill", "fill", { d: 1.27 })], shot: { at: W("fix1", "gravel"), focus: ["gravel"], width: 1.0 } },
    { s: "fix2", do: [v("gravel", "lift", "So"), v("drainPipe", "grow", "pipe"), v("gravel", "lower", "gravel")], shot: { at: W("fix2", "pipe"), box: { min: [-4.6, -3.3, -0.4], max: [-0.6, -2.2, 0.2] }, view: "low", width: 0.95 } },
    { s: "name", do: [v("trenchOutline", "show", "French")], shot: { focus: ["gravel"], width: 1.0, hero: true } },
    { s: "how", do: [v("trenchOutline", "hide", "seeps"), v("flowIn", "show", "seeps"), v("seep", "show", "seeps"), v("trenchWater", "hide", "seeps"), v("gravel", "drain", "seeps", { d: 3.1 }), v("outlet", "grow", "slopes", { d: 0.85 }), v("soakPit", "grow", "slopes", { d: 0.62 }), v("flowOut", "show", "downhill"), v("soakPit", "wet", "away"), v("soak", "show", "away"), v("soakArrows", "show", "away"), v("wetBand", "dry", "away")], shot: { at: W("how", "slopes"), focus: ["outlet", "soakPit"], width: 0.75 } },
    { s: "fix3", do: [v("light", "clear", "Wrap"), v("rain", "stop", "Wrap"), v("eave", "stop", "Wrap"), v("puddles", "dry", "Wrap", { d: 2.9 }), v("seep", "hide", "Wrap"), v("fabric", "show", "Wrap"), v("mud", "fall", "mud"), v("lawn", "dry", "mud"), v("flowIn", "hide", "mud"), v("flowOut", "hide", "mud"), v("soakPit", "dry", "mud")], shot: { focus: ["fabric"], width: 1.0 } },
    { s: "myth", do: [v("mud", "hide", "And"), v("soakArrows", "hide", "And"), v("flag", "show", "French"), v("flag", "cross", "not")], shot: { focus: ["flag"], width: 0.4 } },
    { s: "mythFact", do: [v("flag", "hide", "It"), v("book", "show", "Henry"), v("soak", "hide", "Henry")], shot: { at: W("mythFact", "Henry"), focus: ["book"], width: 0.4 } },
    { s: "finish", do: [v("dig", "refill", "Add"), v("book", "hide", "Add"), v("capSoil", "grow", "Add"), v("capGrass", "grow", "grass", { o: -0.1, d: 0.9 }), v("bushes", "show", "top")], shot: { focus: "home", scale: 0.95 } },
    { s: "congrats", shot: { focus: "home" } },
  ];
  const audio = {
    cards: [{ text: "600 GALLONS", at: W("problem", "600"), d: 1.8 }, { text: "300 LB", at: W("stakes", "300"), d: 1.8 }, { text: "1859", at: W("mythFact", "1859"), d: 1.3 }],
    sfx: [{ lib: "dirt", at: W("hook", "dig", 0.05), d: 1.2 }, { lib: "water_rush", at: W("flood", "ditch", -0.05), d: 1.4 }, { lib: "dirt", at: W("fix1", "fill", 0.15), d: 1.2 }, { lib: "drip", at: W("how", "seeps"), d: 1.3 }, { lib: "water_rush", at: W("how", "downhill"), d: 1.4 }],
    chimes: [W("problem", "600"), W("stakes", "300"), { s: "name" }, W("mythFact", "1859"), { s: "congrats" }],
    rain: { from: W("problem", "But"), to: W("fix3", "mud", 0.6), underDb: 24 },
  };
  return { key: "french_drain", title: g.title, template: true, roles, world: g.world, parts: g.parts, cues: [], beats, camera: { home: { pos: HOME_T.map((x, i) => x + OFF[i]), tgt: HOME_T } }, audio };
}

function landfill() {
  const g = gold("landfill");
  const roles = ["hook", "problem", "fix1", "fix2", "name", "how", "fact", "factProof", "problem2", "myth", "finish", "congrats"];
  const beats = [
    { s: "hook", do: [v("truck", "arrive"), v("dig", "dig", "dig"), v("bags1", "drop", "throw"), v("truck", "tip", "throw"), v("truck", "untip", "landfill"), v("truck", "leave", "landfill")] },
    { s: "problem", do: [v("seepArrows", "show", "leaks"), v("seepFlow", "show", "leaks"), v("leak", "seep1", "leaks"), v("leak", "murk", "groundwater")], shot: { focus: ["seepFlow"], width: 0.7 } },
    { s: "fix1", do: [v("seepArrows", "hide", "So"), v("seepFlow", "hide", "So"), v("leak", "clear1", "So"), v("bags1", "lift", "So"), v("pit", "grow", "lay", { ch: "clayFloor" }), v("pit", "grow", "lay", { ch: "clayWalls", o: 0.23, d: 0.55 }), v("bags1", "lower", "lay", { amp: 2.1 / 2.6 }), v("seepArrows", "show", "not", { amp: 0.8 }), v("leak", "seep2", "not")], shot: { focus: "home", scale: 0.93 }, shots: [{ at: W("fix1", "not"), focus: ["seepFlow"], width: 0.65 }] },
    { s: "fix2", do: [v("seepArrows", "hide", "add", { amp: 0.8 }), v("bags1", "lift", "add"), v("pit", "grow", "plastic", { ch: "linerBack", o: -0.37 }), v("pit", "grow", "plastic", { ch: "linerSides", o: -0.22 }), v("pit", "grow", "plastic", { ch: "linerFloor", o: 0.03 }), v("pit", "pop", "plastic", { ch: "linerLips", o: 0.4 }), v("bags1", "lower", "plastic", { o: 0.25, amp: 2.44 / 2.6 }), v("leak", "clear2", "plastic")] },
    { s: "name", do: [v("linerOutline", "show", "liner")], shot: { focus: ["pit"], width: 0.8, hero: true } },
    { s: "how", do: [v("linerOutline", "hide", "pipe"), v("drainPipe", "grow", "pipe"), v("juice", "show", "drains", { o: 0.5 }), v("tank", "show", "tank")], shot: { at: W("how", "drains"), focus: ["drainPipe", "tank"], width: 1.15 } },
    { s: "fact", do: [v("juice", "hide"), v("pit", "grow", "Sealed", { ch: "cover1", o: -0.02, d: 0.6 }), v("bags2", "drop", "rots", { o: -0.45 }), v("pit", "grow", "buried", { ch: "cover2", o: -0.32, d: 0.6 })], shot: { focus: ["pit"], width: 0.95 } },
    { s: "factProof", do: [v("newspaper", "show", "newspaper"), v("light", "dip", "decades")], shot: { at: W("factProof", "newspaper"), focus: ["newspaper"], width: 0.45 } },
    { s: "problem2", do: [v("newspaper", "hide", "But"), v("bubbles", "show", "But", { o: 0.4 }), v("gasPipe", "grow", "pipe", { d: 0.92 }), v("wellhead", "show", "carries", { o: 0.65 })], shot: { focus: "home", scale: 0.95 } },
    { s: "myth", do: [v("flare", "show", "flame", { o: 0.05 }), v("gasLine", "grow", "electricity", { o: -0.45, d: 0.8 }), v("generator", "show", "electricity", { o: 0.25 })], shot: { at: W("myth", "flame"), focus: ["flare", "wellhead"], width: 0.35 } },
    { s: "finish", do: [v("pit", "grow", "cap", { ch: "capSoil", o: -0.37, d: 0.65 }), v("pit", "grow", "cap", { ch: "capGrass", o: -0.17, d: 0.65 }), v("bubbles", "hide", "cap"), v("fence", "show", "fence"), v("youngTrees", "show", "trees")], shot: { focus: "home" } },
    { s: "congrats", shot: { focus: "home", scale: 1.03 } },
  ];
  // the electricity shot: on its word, the generator and its gas line
  beats[9].shots = [{ at: W("myth", "electricity"), focus: ["generator", "gasLine"], width: 0.6 }];
  const audio = {
    cards: [{ text: "37 YEARS", at: W("factProof", "readable"), d: 1.8 }, { text: "480 LANDFILLS", at: W("myth", "electricity"), d: 1.8 }],
    sfx: [{ lib: "dirt", at: W("hook", "throw", 0.25), d: 1.2 }, { lib: "drip", at: W("problem", "leaks"), d: 1.3 }, { lib: "water_rush", at: W("how", "drains"), d: 1.4 }, { lib: "flame", at: W("myth", "flame"), d: 1.3 }],
    chimes: [{ s: "name" }, W("factProof", "readable"), W("myth", "electricity"), { s: "congrats" }],
  };
  return { key: "landfill", title: g.title, template: true, roles, world: g.world, parts: g.parts.filter((p) => p.id !== "x"), cues: [], beats, camera: { home: { pos: [13.0, 10.8, 33.5], tgt: [0.2, 2.3, -9.0] } }, audio };
}

for (const L of [frenchDrain(), landfill()]) {
  const f = path.join(here, `${L.key}.template.json`);
  fs.writeFileSync(f, JSON.stringify(L, null, 1));
  console.log(f, `${L.beats.length} beats, ${L.beats.reduce((n, b) => n + (b.do?.length ?? 0), 0)} actions`);
}
