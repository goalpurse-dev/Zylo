// M2: a free look at the city parts (cityParts.js), each in its setting, driven through its verbs on draft words:
// stills at the end of every sentence, one contact sheet per part.
//   node m2/layouts/cityLook.mjs <outDir> --proto PROTO --ff FFMPEG [carWash,trafficLight,hydrant,atm]
import path from "node:path";
import { compile } from "../compile.mjs";
import { draftWords } from "../plan.js";
import { preparePage, runProcess } from "../make.mjs";
import { sheet } from "../sheet.mjs";

const out = process.argv[2], arg = (k) => process.argv[process.argv.indexOf(`--${k}`) + 1];
const proto = arg("proto"), ff = arg("ff");
const only = process.argv[3] && !process.argv[3].startsWith("--") ? process.argv[3].split(",") : ["carWash", "trafficLight", "hydrant", "atm"];
const S = (role, text) => ({ role, text });
const base = { house: false, worker: false, moreTrees: false, road: false, trees: [] };
const LOOKS = {
  carWash: {
    world: { ...base, cut: { x0: -3, x1: 3, z0: -4, depth: 3 }, backdrop: { type: "carwash" } },
    parts: [{ id: "dig", kind: "dig", params: { clumps: 60, mound: { x: -6, z: -2.5, rx: 1.2, rz: 0.9, h: 0.8 } } }, { id: "car", kind: "car", params: { pos: [0, 0.1, -2], color: "#d93a32" } }, { id: "wash", kind: "carWash", params: { pos: [0, 0.1, -3.2], car: "car" } }],
    sentences: [S("hook", "You drive your dirty car in here."), S("problem", "The arch sprays it with soap and foam."), S("how", "Then the big brushes close in and spin."), S("congrats", "Rinse it off and drive away clean.")],
    beats: [{ s: "hook", do: [{ p: "dig", v: "dig", w: "You" }, { p: "car", v: "arrive", w: "drive" }], shots: [{ focus: ["car"], type: "close" }] }, { s: "problem", do: [{ p: "wash", v: "show", w: "arch" }, { p: "wash", v: "spray", w: "sprays" }, { p: "wash", v: "foam", w: "foam" }], shots: [{ focus: ["wash", "car"], type: "mid" }] }, { s: "how", do: [{ p: "wash", v: "brushes", w: "brushes" }, { p: "wash", v: "close", w: "close" }, { p: "wash", v: "spin", w: "spin" }] }, { s: "congrats", do: [{ p: "wash", v: "rinse", w: "Rinse" }, { p: "wash", v: "open", w: "off" }, { p: "car", v: "leave", w: "away" }], shots: [{ focus: "home" }] }],
  },
  trafficLight: {
    world: { ...base, cut: { x0: -5, x1: 1, z0: -3, depth: 3 }, backdrop: { type: "street" } },
    parts: [{ id: "dig", kind: "dig", params: { clumps: 60, mound: { x: -6, z: -2.5, rx: 1.2, rz: 0.9, h: 0.8 } } }, { id: "light", kind: "trafficLight", params: { pos: [3.5, 0.12, -1.5], loop: [-2, -1.5, 2.6, 2] } }, { id: "car", kind: "car", params: { pos: [-2, 0.12, -1.5], color: "#2f7de0" } }],
    sentences: [S("hook", "You stop at a red light and wait."), S("problem", "Under the road there is a loop of wire."), S("how", "Your car's metal changes its field."), S("congrats", "So the light turns green for you.")],
    beats: [{ s: "hook", do: [{ p: "dig", v: "dig", w: "You" }, { p: "light", v: "show", w: "red" }, { p: "light", v: "red", w: "red" }, { p: "car", v: "arrive", w: "stop" }], shots: [{ focus: ["light"], type: "close" }] }, { s: "problem", do: [{ p: "light", v: "loop", w: "loop" }], shots: [{ focus: ["light", "car"], type: "mid" }] }, { s: "how", do: [{ p: "light", v: "pulse", w: "metal" }] }, { s: "congrats", do: [{ p: "light", v: "green", w: "green" }, { p: "light", v: "stopPulse", w: "green" }, { p: "car", v: "leave", w: "you." }], shots: [{ focus: "home" }] }],
  },
  hydrant: {
    world: { ...base, cut: { x0: -2.5, x1: 2.5, z0: -2, depth: 5 }, backdrop: { type: "street" } },
    parts: [{ id: "dig", kind: "dig", params: { clumps: 60, mound: { x: -6, z: -2.5, rx: 1.2, rz: 0.9, h: 0.8 } } }, { id: "h", kind: "hydrant", params: { pos: [0, 0.12, -0.6], depth: 3.6 } }],
    sentences: [S("hook", "A fire hydrant looks like a short red post."), S("problem", "But its pipe goes deep under the street."), S("how", "The valve is way down there, so it can open and fill."), S("congrats", "Close it and the barrel drains so it never freezes.")],
    beats: [{ s: "hook", do: [{ p: "h", v: "show", w: "hydrant" }], shots: [{ focus: ["h"], type: "close" }] }, { s: "problem", do: [{ p: "dig", v: "dig", w: "pipe" }, { p: "h", v: "barrel", w: "deep" }], shots: [{ focus: ["h"], type: "mid" }] }, { s: "how", do: [{ p: "h", v: "open", w: "open" }, { p: "h", v: "fill", w: "fill." }, { p: "h", v: "spray", w: "fill." }] }, { s: "congrats", do: [{ p: "h", v: "close", w: "Close" }, { p: "h", v: "drain", w: "drains" }], shots: [{ focus: "home" }] }],
  },
  atm: {
    world: { ...base, cut: { x0: -2, x1: 2, z0: -3, depth: 3 }, backdrop: { type: "street", sign: "BANK" } },
    parts: [{ id: "dig", kind: "dig", params: { clumps: 60, mound: { x: -6, z: -2.5, rx: 1.2, rz: 0.9, h: 0.8 } } }, { id: "atm", kind: "atm", params: { pos: [3.2, 0.12, -1.8] } }],
    sentences: [S("hook", "You put your card in the cash machine."), S("problem", "The money sits inside a heavy safe."), S("how", "A belt picks one note at a time up to the slot."), S("congrats", "And out comes your cash.")],
    beats: [{ s: "hook", do: [{ p: "dig", v: "dig", w: "You" }, { p: "atm", v: "show", w: "card" }, { p: "atm", v: "screen", w: "card" }, { p: "atm", v: "card", w: "cash" }], shots: [{ focus: ["atm"], type: "close" }] }, { s: "problem", do: [{ p: "atm", v: "safe", w: "safe." }, { p: "atm", v: "cassettes", w: "money" }], shots: [{ focus: ["atm"], type: "close" }] }, { s: "how", do: [{ p: "atm", v: "pick", w: "picks" }] }, { s: "congrats", do: [{ p: "atm", v: "cash", w: "cash." }], shots: [{ focus: ["atm"], type: "mid" }] }],
  },
};
for (const key of only) {
  const L = LOOKS[key], words = draftWords(L.sentences);
  const layout = { key: `city_${key.toLowerCase()}`, title: key, roles: L.sentences.map((s) => s.role), world: L.world, parts: [...L.parts, { id: "sign", kind: "sign", params: { at: [5, 0.12, -3], scale: 1 } }], cues: [], audio: { cards: [], sfx: [], chimes: [] }, beats: L.beats };
  const tl = compile(layout, words, words.at(-1).e, { roles: layout.roles });
  preparePage({ layout, tl, proto });
  const times = tl.sentences.map((s) => +(s.t1 - 0.1).toFixed(2));
  const dir = path.join(out, key);
  await runProcess(process.execPath, [path.join(proto, "m2", "stills.mjs"), `m2_${layout.key}.html`, dir, [0.3, ...times].join(",")], { cwd: proto });
  sheet(ff, dir, null, path.join(out, `${key}.jpg`), [0.3, ...times], { perRow: 5 });
  console.log(key, tl.director.notes.join(" | ") || "no notes");
}
