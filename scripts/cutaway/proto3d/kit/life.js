// Kit: the world's life on a custom video (the owner's rule 21 of 2026-11-11: never a frozen frame). Always on, under
// the story, all from the timeline's t (deterministic; frames render out of order):
//  - trees sway: the suburb's crowns (kit/backdrops.js dressWorld) turn a little about the trunk top, the yard's own
//    crowns (ctx.leaves) drift; a still moment's "breeze" (storyFx.js fillGaps adds an ambient part) makes the wind
//    stronger instead of moving the crowns a second time (parts.js ambient leaves the crowns to this when ctx.windOwned);
//  - cars drive past on the cross street of a street setting (the suburb's cars), wheels turning;
//  - machines idle: a designed part (rig) whose spin, shake, pump or crank move is on trembles slightly.
// A premade video (approved) gets none of this: m2/runtime.js only calls it when !ctx.premade.
import { channelValue } from "../m2/curves.js";

const RUNNING = new Set(["spin", "shake", "pump", "crank"]);

/** the life of the world: { update(t) }; suburb from dressWorld (or null), built: runtime's part map, tracks: timeline */
export function worldLife(ctx, layout, { suburb = null, built = new Map(), tracks = {} } = {}) {
  const breezes = (layout.parts ?? []).filter((p) => p.kind === "ambient" && p.params?.mode === "breeze").map((p) => tracks[`${p.id}.on`]).filter(Boolean);
  const wind = (t) => Math.max(0, Math.min(1, breezes.reduce((m, tr) => Math.max(m, channelValue(tr, t)), 0)));
  const trees = suburb?.trees ?? [], cars = suburb?.cars ?? [];
  const leaves = (ctx.leaves ?? []).map((o, i) => ({ o, rest: o.position.clone(), ph: i * 1.7 }));
  // machines: each running move's track, and the part's group with its resting place
  // (a part a still moment's ambient hum already moves is left to it when its own move is off)
  const hummed = new Set((layout.parts ?? []).filter((p) => p.kind === "ambient" && p.params?.mode === "hum").map((p) => p.params?.target));
  const machines = [];
  for (const p of layout.parts ?? []) {
    if (p.kind !== "rig") continue;
    const names = (p.params?.nodes ?? []).flatMap((n) => (n.moves ?? []).filter((m) => RUNNING.has(m.type)).map((m) => m.name));
    const g = built.get(p.id)?.obj?.group;
    if (names.length && g) machines.push({ g, rest: g.position.clone(), tracks: names.map((n) => tracks[`${p.id}.${n}`]).filter(Boolean), hummed: hummed.has(p.id) });
  }
  return {
    update(t) {
      const w = wind(t), a = 0.02 + 0.045 * w;
      for (const tr of trees) { tr.crown.rotation.z = a * Math.sin(t * 1.3 + tr.ph); tr.crown.rotation.x = 0.6 * a * Math.sin(t * 1.05 + tr.ph * 0.7); }
      const d = 0.035 + 0.09 * w;
      for (const l of leaves) l.o.position.set(l.rest.x + d * Math.sin(t * 1.4 + l.ph), l.rest.y, l.rest.z + 0.55 * d * Math.sin(t * 1.1 + l.ph * 0.7));
      // (a car laps 240 m in 27 s; it shows only in the middle of its lap, out of sight at both ends)
      for (const c of cars) {
        if (!c.g) continue;
        const u = (t / 27 + c.off) % 1, x = c.dir * (-120 + u * 240);
        c.g.position.x = x; c.g.visible = Math.abs(x) < 110;
        for (const wh of c.wheels) wh.rotation.x = (u * 240) / 0.34;
      }
      for (const m of machines) {
        const on = m.tracks.some((tr) => channelValue(tr, t) > 0.05);
        if (on) { m.g.position.set(m.rest.x + 0.008 * Math.sin(t * 61), m.rest.y + 0.006 * Math.abs(Math.sin(t * 47)), m.rest.z + 0.004 * Math.sin(t * 53)); }
        else if (!m.hummed) m.g.position.copy(m.rest); // (every frame: a still rendered out of order never keeps a stale tremble)
      }
    },
  };
}
