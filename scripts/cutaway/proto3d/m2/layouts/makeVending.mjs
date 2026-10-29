// M2: the vending machine layout (hand-planned in the M2 format: beats on sentence roles, director shots, sound on
// words), and its fact-checked script. Writes vending_machine.template.json and vending_machine.script.json.
//   node m2/layouts/makeVending.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { vendingBoxes } from "../vending.js";
import { frameBox } from "../director.js";
import { union } from "../focus.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const POS = [0, 0.12, -1.3]; // on the sidewalk (its top is y 0.12)
const VB = vendingBoxes(POS);
const v = (p, verb, w, extra = {}) => ({ p, v: verb, ...(w ? { w } : {}), ...extra });
const W = (s, w, o) => (o ? { s, w, o } : { s, w });

const sentences = [
  ["hook", "If you put snacks in a box with a coin slot, you have a vending machine."],
  ["problem", "But people just reach in and take them for free."],
  ["fix1", "So you lock them behind glass, each snack sitting in a spiral coil."],
  ["how", "Drop in a coin, and a little motor turns the coil one full turn."],
  ["name", "This is a vending spiral."],
  ["problem2", "But sometimes the snack gets stuck on the edge."],
  ["fix2", "So an invisible light beam watches the bin, and if nothing falls through it, the spiral turns again."],
  ["fact", "Japan has over 2 million drink machines, about one for every 55 people."],
  ["myth", "And the vending machine is not a modern idea."],
  ["mythFact", "Hero of Alexandria built one 2,000 years ago that poured holy water for a coin."],
  ["finish", "Add a cooler underneath and a light on top."],
  ["congrats", "Congratulations, you have built a vending machine."],
].map(([role, text]) => ({ role, text }));

const facts = [
  { verdict: "keep", claim: "Many machines use an infrared drop sensor: if no product falls through the beam, the coil turns again, and the money is refunded if it still fails", sources: [{ url: "https://www.ttelectronics.com/TTElectronics/media/ProductFiles/Application-Note/App-Note-OPB720-for-Vending-Machines.pdf", title: "TT Electronics: optic sensors for vending machines" }, { url: "https://www.vending.com/blog/guarantee-product-delivery/", title: "Vending.com: guarantee product delivery" }] },
  { verdict: "reword", claim: "Japan had about 2.25 million beverage vending machines at the end of 2021 (JVMA), about one for every 55 people", sources: [{ url: "https://www.sg.emb-japan.go.jp/JCC/E-Magazine-Jul-2023-Vending-Machine.html", title: "Embassy of Japan in Singapore: vending machines" }, { url: "https://unseen-japan.com/number-of-vending-machines-in-japan-dwindling/", title: "Unseen Japan: the number of vending machines" }] },
  { verdict: "keep", claim: "Hero of Alexandria described a coin-operated holy-water dispenser in his Pneumatica, in the 1st century AD", sources: [{ url: "https://www.mentalfloss.com/history/worlds-first-vending-machine-dispensed-holy-water", title: "Mental Floss: the first vending machine dispensed holy water" }, { url: "https://historyofinformation.com/detail.php?id=10", title: "History of Information: Hero's Pneumatica" }] },
];

const outline = [[VB.outlineA[0][0], VB.outlineA[0][1], -0.48], [VB.outlineA[0][0], VB.outlineA[1][1], -0.48], [VB.outlineA[1][0], VB.outlineA[1][1], -0.48], [VB.outlineA[1][0], VB.outlineA[0][1], -0.48]];
const parts = [
  { id: "light", kind: "light", params: {} },
  { id: "pad", kind: "box", params: { mat: "concrete", size: [2.6, 0.47, 2.6], pos: [0, -0.115, -1.3], r: 0.03, receiveShadow: true } },
  { id: "machine", kind: "vendingMachine", params: { pos: POS, header: "SNACKS & DRINKS" }, focus: VB.whole },
  { id: "spiralOutline", kind: "outline", params: { points: outline, opts: { r: 0.03, closed: true } } },
  { id: "crowd", kind: "miniMachines", params: { area: [-24, 24, -7.4, -0.6], avoid: [-2.2, 3.4], y: 0.12, count: 70 } },
  { id: "book", kind: "book", params: { w: 1.4, h: 1.9, bg: "#2f4a6b", book: true, spine: "#1d3047", lines: [
    { text: "PNEUMATICA", font: "bold 60px Georgia, serif", color: "#f2d58e", y: 170 }, { rule: true, y: 215, color: "#f2d58e" },
    { text: "HERO OF", font: "bold 50px Georgia, serif", color: "#f2d58e", y: 330 }, { text: "ALEXANDRIA", font: "bold 50px Georgia, serif", color: "#f2d58e", y: 400 },
    { text: "1ST CENTURY AD", font: "bold 34px Georgia, serif", color: "#f2d58e", y: 600 }], from: [2.4, -0.7, -1.6], to: [2.4, 2.0, -1.6], rot: [-0.1, -0.35, 0.02] } },
  { id: "coldArrows", kind: "arrows", params: { list: [-0.45, 0.05].map((x, i) => ({ at: [x, 0.5, -1.6], dir: [0, 1], travel: 0.9, phase: i * 0.5 })), opts: { scale: 0.55, color: "#7fc4ff" } } },
  { id: "sign", kind: "sign", params: { at: [3.6, 0.12, -4.2], rotY: -0.3, scale: 1.1 } },
];

const beats = [
  { s: "hook", do: [v("machine", "show", "box"), v("machine", "fill", "snacks", { o: -0.3 }), v("machine", "slot", "slot")] },
  { s: "problem", do: [v("machine", "steal", "take")], shot: { box: union([VB.whole, { min: [0, 1, -1.5], max: [3.2, 2.5, 0.5] }]), width: 0.85 } },
  { s: "fix1", do: [v("machine", "glass", "glass"), v("machine", "coils", "spiral")], shot: { box: VB.glass, width: 0.95, view: [16, 8, 44] } },
  { s: "how", do: [v("machine", "coin", "coin"), v("machine", "turnA", "turns"), v("machine", "dropA", "turns", { o: 1.0 })], shot: { box: VB.coinRun, width: 0.9, view: [28, 9, 32] } },
  { s: "name", do: [v("spiralOutline", "show", "spiral")], shot: { box: VB.coilA, width: 0.55, hero: true, view: [28, 9, 32] } },
  { s: "problem2", do: [v("spiralOutline", "hide", "But"), v("machine", "turnB", "sometimes")], shot: { box: VB.coilB, width: 0.6, view: [28, 9, 32] } },
  { s: "fix2", do: [v("machine", "beam", "beam"), v("machine", "retryB", "turns"), v("machine", "dropB", "again")], shot: { box: union([VB.bin, VB.coilB]), width: 0.85, view: [28, 9, 32] } },
  { s: "fact", do: [v("crowd", "show", "Japan")], shot: { box: { min: [-14, 0, -8], max: [14, 3, -0.5] }, width: 1.0, view: [12, 10, 44] } },
  { s: "myth", do: [v("crowd", "hide", "modern")], shot: { focus: "home" } },
  { s: "mythFact", do: [v("book", "show", "Hero"), v("book", "hide", "coin")], shot: { at: W("mythFact", "Hero"), focus: ["book"], width: 0.4 } },
  { s: "finish", do: [v("machine", "cooler", "cooler"), v("coldArrows", "show", "cooler", { o: 0.3 }), v("machine", "light", "light")], shot: { box: VB.cooler, width: 0.75, view: [28, 9, 32] }, shots: [{ at: W("finish", "light", -0.2), box: VB.whole, width: 0.5, view: [20, 10, 42] }] },
  { s: "congrats", do: [v("coldArrows", "hide", "Congratulations")], shot: { focus: "home" } },
];
const audio = {
  cards: [{ text: "2 MILLION", at: W("fact", "2"), d: 1.8 }, { text: "2,000 YEARS", at: W("mythFact", "2,000"), d: 1.8 }],
  sfx: [{ lib: "motor_hum", at: W("how", "turns"), d: 1.2 }, { lib: "motor_hum", at: W("problem2", "sometimes"), d: 1.0 }, { lib: "motor_hum", at: W("fix2", "turns"), d: 0.9 }],
  chimes: [{ s: "name" }, W("fact", "2"), W("mythFact", "2,000"), { s: "congrats" }],
};
// the home view: the machine and the lawn around it, the house behind
const home = frameBox(union([VB.whole, { min: [-5, 0, -8.5], max: [5, 5.2, 0] }]), { width: 0.8, zone: "center" });
const layout = {
  key: "vending_machine", title: "How a vending machine works", template: true, approved: false, roles: sentences.map((s) => s.role),
  world: { cut: { x0: -1.3, x1: 1.3, z0: -2.6, depth: 0.35 }, house: false, worker: false, moreTrees: false, road: false, trees: [], backdrop: { type: "street", sign: "CORNER STORE", lampX: 6.5, benchX: -6.5 } },
  parts, cues: [], beats, audio, camera: { home: { pos: home.pos, tgt: home.tgt } },
};
fs.writeFileSync(path.join(here, "vending_machine.template.json"), JSON.stringify(layout, null, 1));
fs.writeFileSync(path.join(here, "vending_machine.script.json"), JSON.stringify({ title: layout.title, hero: "a vending spiral", sentences, surprises: [], cards: [{ text: "2 MILLION", sentence: 7, word: "2" }, { text: "2,000 YEARS", sentence: 9, word: "2,000" }], parts: ["vending machine", "snacks", "glass", "spiral coils", "coin", "motor", "drop sensor", "drink machines", "book", "cooler", "light"], facts }, null, 1));
console.log("vending_machine:", parts.length, "parts,", beats.length, "beats;", sentences.map((s) => s.text).join(" ").split(/\s+/).length, "words;", sentences.map((s) => s.text).join(" ").length, "chars");
