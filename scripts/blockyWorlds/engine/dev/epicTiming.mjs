// EPIC agent: render-time table (ms per frame at 1080x1920, full post chain + JPEG capture + x264, one Chrome page),
// the same path as a real chunk (render.mjs renderRange). Free and local.   node dev/epicTiming.mjs [frames=48]
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { renderRange } from "../render.mjs";
import { buildTimeline } from "./epicTimeline.mjs";

const DEV = path.dirname(fileURLToPath(import.meta.url));
const N = Number(process.argv[2] ?? 48), dur = N / 24 + 0.05;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bw-epic-timing-"));
const story = buildTimeline();
const base = (shot, extra = {}) => ({ version: 1, fps: 24, width: 1080, height: 1920, duration: dur, cast: { me: { role: "kid", name: "Pip", seed: 3 } }, monster: null,
  giants: { wolf: { kind: "wolf", size: 75, armour: true }, elephant: { kind: "elephant", size: 90 } },
  worlds: { field: { creature: "none", view: "outside", size: 120 }, ...story.worlds }, captions: [{ word: "test", start: 0.1, end: 0.5 }],
  shots: [{ start: 0, end: dur, line: 0, part: "tour", light: "day", seed: 5, actors: [], ...shot }], ...extra });
const kid = [{ id: "me", spot: "center", pose: "stand", expr: "happy", facing: "camera" }];
const army = (n) => ({ set: "creature:field", camera: "track", focus: "crowd", crowds: [{ kind: "wolf_soldier", count: n, formation: "block", action: "march", pos: [-20, 0, -30], facing: "right", faction: "wolf" }] });
const CASES = {
  "empty set (field, kid)": base({ set: "creature:field", camera: "wide", focus: "me", actors: kid }),
  "1 giant (wolf walks)": base({ set: "creature:field", camera: "hero_low", focus: "me", actors: kid, giants: [{ id: "wolf", pos: [-10, 0, -50], action: "walk", facing: "camera" }] }),
  "2 giants (wolf vs elephant)": base({ set: "creature:field", camera: "duel", focus: "giant:wolf", giants: [{ id: "wolf", pos: [-50, 0, -120], action: "attack", facing: "elephant" }, { id: "elephant", pos: [50, 0, -120], action: "roar", facing: "wolf" }] }),
  "crowd 50": base(army(50)), "crowd 150": base(army(150)), "crowd 300": base(army(300)), "crowd 500": base(army(500)),
  "inside the turtle (+40 townsfolk)": base({ ...story.shots[1], start: 0, end: dur }),
  "busiest: attack (turtle city + wolf + 500 charging)": base({ ...story.shots[5], start: 0, end: dur }),
};
const rows = [];
for (const [name, tl] of Object.entries(CASES)) {
  const f = path.join(tmp, "tl.json"); fs.writeFileSync(f, JSON.stringify(tl));
  const r = await renderRange({ timelinePath: f, from: 0, to: N, out: path.join(tmp, "o.mp4") });
  rows.push([name, r.msPerFrame, r.loadS]); console.log(`${name}: ${r.msPerFrame} ms/frame (load ${r.loadS} s)`);
}
const ref = path.join(DEV, "render_street5s.json");
if (fs.existsSync(ref)) { const r = await renderRange({ timelinePath: ref, from: 0, to: N, out: path.join(tmp, "o.mp4") }); rows.push(["reference: street (Listener-style)", r.msPerFrame, r.loadS]); console.log(`reference street: ${r.msPerFrame} ms/frame`); }
fs.mkdirSync(path.join(DEV, "..", "out", "epic"), { recursive: true });
fs.writeFileSync(path.join(DEV, "..", "out", "epic", "timing.md"), `| case | ms/frame | load s |\n|---|---|---|\n${rows.map((r) => `| ${r[0]} | ${r[1]} | ${r[2]} |`).join("\n")}\n`);
fs.rmSync(tmp, { recursive: true, force: true });
