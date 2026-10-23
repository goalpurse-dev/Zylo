// M2: a free look at each setting (kit/backdrops.js): a minimal layout (the cut dug, the sign), stills of the opening,
// the home view and the end, one contact sheet per setting.
//   node m2/layouts/settingsLook.mjs <outDir> --proto PROTO --ff FFMPEG [garage,room,carwash,street]
import fs from "node:fs";
import path from "node:path";
import { compile } from "../compile.mjs";
import { draftWords } from "../plan.js";
import { preparePage, runProcess } from "../make.mjs";
import { sheet } from "../sheet.mjs";

const out = process.argv[2], arg = (k) => process.argv[process.argv.indexOf(`--${k}`) + 1];
const proto = arg("proto"), ff = arg("ff"), only = process.argv[3] && !process.argv[3].startsWith("--") ? process.argv[3].split(",") : ["garage", "room", "carwash"];
const sentences = [
  { role: "hook", text: "You dig a hole in the floor here." },
  { role: "problem", text: "But water keeps coming back up from below." },
  { role: "how", text: "This is how the whole thing works underneath." },
  { role: "congrats", text: "Congratulations, you built it." },
];
const CUTS = { garage: { x0: -2.5, x1: 2.5, z0: -3, depth: 4 }, room: { x0: 1, x1: 5, z0: -3, depth: 4 }, carwash: { x0: -3, x1: 3, z0: -4, depth: 3 }, street: { x0: -2.5, x1: 2.5, z0: -3, depth: 4 } };
for (const type of only) {
  const cut = CUTS[type];
  const layout = {
    key: `setting_${type}`, title: type, roles: sentences.map((s) => s.role),
    world: { cut, house: false, worker: false, moreTrees: false, road: false, trees: [], backdrop: { type } },
    parts: [{ id: "dig", kind: "dig", params: { clumps: 80, mound: { x: cut.x1 + 2.5, z: cut.z0 + 1, rx: 1.4, rz: 1, h: 1 } } }, { id: "sign", kind: "sign", params: { at: [cut.x1 + 1.5, 0.12, -2], scale: 1.1 } }],
    cues: [], audio: { cards: [], sfx: [], chimes: [] },
    beats: [{ s: "hook", do: [{ p: "dig", v: "dig", w: "dig" }], shots: [{ focus: ["dig"], type: "close" }] }, { s: "problem", shots: [{ focus: "home" }] }, { s: "how", shots: [{ focus: ["dig"], type: "mid" }] }, { s: "congrats", shots: [{ focus: "home" }] }],
  };
  const words = draftWords(sentences), end = words.at(-1).e;
  const tl = compile(layout, words, end, { roles: layout.roles });
  preparePage({ layout, tl, proto });
  const dir = path.join(out, type), times = [0.2, 1.6, 4, 7, tl.marks.lengthEnd - 0.2];
  await runProcess(process.execPath, [path.join(proto, "m2", "stills.mjs"), `m2_${layout.key}.html`, dir, times.join(",")], { cwd: proto });
  sheet(ff, dir, null, path.join(out, `${type}.jpg`), times, { perRow: 5 });
  console.log(type, tl.director.notes.join(" | ") || "no notes", path.join(out, `${type}.jpg`));
}
