// Blocky Worlds ATTACH dev check (2026-11-07, owner: "FLOATING PEOPLE ... feet always on the ground. Check every creature
// world."): FREE, local. For every creature world (turtle, whale, elephant, snail, wolf castle city, eagle, frog: on /
// street / inside / outside) and the plain town's places (square, belfry), it renders frames at 3-4 phases of the
// creature's stride and measures per actor (people, crowd characters, walking giants) the gap between the feet and the
// walkable surface under them (page/ground.js), plus the drift of each actor / house in the frame of the surface it
// stands on across the stride (an actor that does not ride the creature slides; a house that does not ride the shell drifts).
//   node dev/groundProbe.mjs [--only turtle_on,snail_on] [--sheets] [--out out/ground]
// -> <out>/metrics.json, <out>/<world>.jpg (with --sheets: the 3 stride phases side by side)
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { startServer, launchBrowser, openPage, ENGINE } from "../render.mjs";
import { gaitOf } from "../lib/epic.js";

const args = process.argv.slice(2), opt = (k, d = null) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ENGINE, opt("--out", "out/ground")), SHEETS = args.includes("--sheets"), ONLY = opt("--only")?.split(",") ?? null;
fs.mkdirSync(OUT, { recursive: true });

// world id -> spec (timeline.worlds) + what stands where
export const WORLDS = {
  turtle_on: { w: { creature: "turtle", view: "on", size: 120, seed: 11 } },
  turtle_street: { w: { creature: "turtle", view: "street", size: 120, seed: 11 }, place: "street" },
  turtle_deck: { w: { creature: "turtle", view: "street", size: 120, seed: 11 }, place: "deck" },
  turtle_in: { w: { creature: "turtle", view: "inside", size: 120, seed: 11 } },
  turtle_out: { w: { creature: "turtle", view: "outside", size: 120, seed: 11 }, outside: true },
  whale_on: { w: { creature: "whale", view: "on", size: 120, seed: 5, water: true } },
  elephant_on: { w: { creature: "elephant", view: "on", size: 110, seed: 7 } },
  snail_on: { w: { creature: "snail", view: "on", size: 100, seed: 9 } },
  wolf_castle_on: { w: { creature: "wolf", view: "on", size: 120, seed: 13, townStyle: "castle", villain: true } },
  wolf_out: { w: { creature: "wolf", view: "outside", size: 90, seed: 13, villain: true }, outside: true },
  eagle_on: { w: { creature: "eagle", view: "on", size: 90, seed: 3 } },
  frog_on: { w: { creature: "frog", view: "on", size: 90, seed: 4 } },
  town_square: { set: "street", place: "square" },
  town_belfry: { set: "street", place: "belfry" },
};

function timelineFor(id, def) {
  const kind = def.w?.creature ?? "turtle", size = def.w?.size ?? 60;
  const P = def.w ? 1 / gaitOf(kind, kind === "whale" ? "swim" : "walk", size).cadence : 2;
  const dur = Math.max(3, P + 1);
  const set = def.set ?? `creature:${id}`;
  const actors = [
    { id: "a", spot: "center", pose: "stand", expr: "happy", facing: "camera" },
    { id: "b", spot: "left", pose: "walk", expr: "neutral", facing: "camera" },
    { id: "c", spot: "right", pose: "wave", expr: "happy", facing: "camera" },
  ];
  const shot = { start: 0, end: dur, line: 0, part: "probe", seed: 7, set, light: "day", camera: "wide", focus: "a", actors, visuals: [], ...(def.place ? { place: def.place } : {}) };
  if (def.w && !def.outside && def.w.view !== "inside") shot.crowds = [{ kind: "townsfolk", count: 30, formation: "scatter", action: "stand", spot: "back", onWorld: true, seed: 3 }];
  if (def.w?.view === "inside") shot.crowds = [{ kind: "townsfolk", count: 30, formation: "scatter", action: "stand", spot: "back", seed: 3 }];
  if (def.outside) shot.giants = [{ id: "world", action: "walk" }];
  const tl = { version: 1, fps: 24, width: 1080, height: 1920, duration: dur, title: `ground ${id}`, cast: { a: { role: "kid", name: "Pip", seed: 3 }, b: { role: "adult", name: "Mo", seed: 8 }, c: { role: "adult", name: "Ida", seed: 12 } }, monster: null, giants: {}, worlds: def.w ? { [id]: def.w } : {}, shots: [shot], captions: [], audio: { voice: null, music: null } };
  return { tl, P, dur };
}

const browser = await launchBrowser();
const metrics = {};
try {
  for (const [id, def] of Object.entries(WORLDS)) {
    if (ONLY && !ONLY.includes(id)) continue;
    const { tl, P } = timelineFor(id, def);
    const dir = path.join(OUT, "job"); fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(tl));
    const srv = await startServer(dir);
    const t0 = Date.now();
    try {
      // a parallel edit of the props kit must not block the ground check: its stand-in is used when the real one fails to load
      const open = (query) => openPage(browser, { port: srv.port, tlName: `${id}.json`, W: 432, H: 768, label: ` ${id}`, query });
      const page = await open(opt("--query", "")).catch((e) => (/props.js/.test(e.message) ? open("stubs=props") : Promise.reject(e)));
      const phases = [0, 0.25, 0.5, 0.75], frames = [];
      for (const [k, ph] of phases.entries()) {
        const t = 0.4 + ph * P;
        const r = await page.evaluate((t) => { window.renderAt(t); return window.groundProbe(); }, t);
        frames.push({ ph, t, rows: r?.rows ?? [] });
        if (SHEETS && k < 3) { const d = await page.evaluate(() => window.frameData(0.85)); fs.writeFileSync(path.join(OUT, `${id}_${k}.jpg`), Buffer.from(d.split(",")[1], "base64")); }
      }
      await page.close();
      // per actor: worst |gap| over the frames, drift of its foot in the hit surface's frame (same surface)
      const by = new Map();
      for (const f of frames) for (const r of f.rows) { if (!by.has(r.id)) by.set(r.id, []); by.get(r.id).push(r); }
      const actors = [];
      for (const [aid, list] of by) {
        const k = list[0].kind, gaps = list.map((r) => r.gap).filter(Number.isFinite);
        const worst = gaps.length ? gaps.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a), 0) : null;
        let drift = 0; const ref = list.find((r) => r.local);
        // ATTACH-2: a person's drift is sliding ACROSS the surface (x, z of its root): the up-down of a walking stride on
        // a slope (the lowest sole kept on the ground) is not sliding, and floating is the gap above
        for (const r of list) if (r.local && ref && r.on === ref.on) drift = Math.max(drift, Math.hypot(...r.local.map((v, i) => (k === "person" && i === 1 ? 0 : v - ref.local[i]))));
        const sG = list.map((r) => r.sGap).filter((v) => v != null), sWorst = sG.length ? sG.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a), 0) : null;
        actors.push({ id: aid, kind: k, worst: worst == null ? null : +worst.toFixed(3), sWorst, noGround: gaps.length < list.length, drift: +drift.toFixed(3), tol: list[0].tol, on: ref?.on ?? null });
      }
      const of = (k) => actors.filter((a) => a.kind === k);
      const maxAbs = (l) => l.reduce((m, a) => Math.max(m, a.worst == null ? 99 : Math.abs(a.worst)), 0);
      const fails = actors.filter((a) => a.kind !== "house" && (a.noGround || Math.abs(a.worst ?? 99) > a.tol * (a.kind === "giant" ? 1 : 1)) || (a.kind !== "giant" && a.drift > (a.kind === "house" ? 0.02 : 0.05)));
      metrics[id] = { P: +P.toFixed(2), people: +maxAbs(of("person")).toFixed(3), crowd: +maxAbs(of("crowd")).toFixed(3), giant: of("giant").length ? +maxAbs(of("giant")).toFixed(3) : null, drift: +Math.max(0, ...actors.filter((a) => a.kind !== "house").map((a) => a.drift)).toFixed(3), houseDrift: +Math.max(0, ...of("house").map((a) => a.drift)).toFixed(3), fails: fails.length, failList: fails.slice(0, 6).map((a) => `${a.id}:${a.kind} gap ${a.worst} drift ${a.drift}${a.noGround ? " NO GROUND" : ""} on ${a.on}${a.sWorst != null ? ` (set surface gap ${a.sWorst})` : ""}`), secs: Math.round((Date.now() - t0) / 1000) };
      console.log(id, JSON.stringify(metrics[id]));
      if (SHEETS) {
        const ins = [0, 1, 2].map((k) => ["-i", path.join(OUT, `${id}_${k}.jpg`)]).flat();
        spawnSync(process.env.FFMPEG ?? "ffmpeg", ["-v", "error", "-y", ...ins, "-filter_complex", "[0][1][2]hstack=inputs=3", path.join(OUT, `${id}.jpg`)]);
        for (const k of [0, 1, 2]) fs.rmSync(path.join(OUT, `${id}_${k}.jpg`), { force: true });
      }
    } catch (e) { metrics[id] = { error: String(e.message).slice(0, 400) }; console.log(id, "ERROR", e.message.slice(0, 400)); }
    finally { srv.close(); }
  }
} finally { await browser.close(); }
const file = path.join(OUT, "metrics.json");
const prev = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
fs.writeFileSync(file, JSON.stringify({ ...prev, ...metrics }, null, 1));
console.log(`-> ${file}`);
const bad = Object.entries(metrics).filter(([, m]) => m.error || m.fails);
process.exitCode = bad.length ? 1 : 0;
