// M2: the page runtime. Builds a layout's parts in order (the order fixes the shared random numbers, so a saved
// layout always looks the same) and moves them from the compiled timeline. The camera follows the timeline's keys.
import { cameraPath } from "../kit/camera.js";
import { channelValue } from "./curves.js";
import { KINDS } from "./parts.js";
import { materialRegistry } from "./materials.js";
import { restyleGroundwater } from "../kit/water.js";
import { dressWorld } from "../kit/backdrops.js";
import { worldLife } from "../kit/life.js";
import { focusOf } from "./focus.js";

/** ctx: the world's objects (THREE, scene, rnd, helpers, sun, soil uniforms...); opts: { endCard, look: [px,py,pz,tx,ty,tz] } */
export function runLayout(ctx, layout, timeline, { endCard = true, look = null } = {}) {
  // (premade: a saved approved layout re-renders exactly as approved; the new looks of the competitor look round, the
  // owner's rules of 2026-11-11, apply only when this is false: kit parts read ctx.premade)
  ctx.premade ??= layout.approved === true;
  // (the world's life owns the tree crowns on a custom video, kit/life.js: a still moment's breeze strengthens its wind)
  if (!ctx.premade) ctx.windOwned = true;
  const mats = materialRegistry(ctx);
  const T = timeline.tracks;
  const built = new Map(), list = [];
  for (const part of layout.parts) {
    const key = (ch) => `${part.id}.${ch}`;
    const api = {
      // (the part's own id: params never hold it, so a car that registered under params.id was always "car" and a car
      // wash naming any other car id found nothing; found by the typed field lists, 2026-11-08)
      id: part.id,
      ch: (name, t, shift = 0) => channelValue(T[key(name)], t, shift),
      cue: (name) => T[key(name)]?.ramps[0],
      cues: (name) => T[key(name)]?.ramps ?? [],
      other: (id, name, t) => channelValue(T[`${id}.${name}`], t),
      part: (id) => built.get(id),
      // (every part built so far, with its kind and what it added to the scene: the ambient breeze sways bushes)
      all: () => [...built.entries()].map(([id, e]) => ({ id, kind: layout.parts.find((q) => q.id === id)?.kind, added: e.added })),
      mat: (name) => mats.get(name),
      wetter: (name) => mats.wetter(name),
      endCard,
    };
    // (the owner's rule of 2026-11-05: an optional part that cannot be built is skipped and logged as our bug; only the
    // main subject is the scene itself, and its crash still stops the render)
    const make = KINDS[part.kind];
    let obj;
    // (what the part added to the scene: the "This is a…" glow traces it, whatever kind of part it is)
    const before = new Set(ctx.scene.children);
    try {
      if (!make) throw new Error(`unknown part kind ${part.kind}`);
      obj = make(ctx, part.params ?? {}, api);
    } catch (e) {
      if (part.main) throw e;
      console.error(`[cutaway-bug] part ${part.id} (${part.kind}) not built, skipped: ${e?.message ?? e}`);
      continue;
    }
    const added = ctx.scene.children.filter((o) => !before.has(o));
    built.set(part.id, { obj, params: part.params ?? {}, added });
    list.push({ id: part.id, main: !!part.main, obj, dead: false });
  }
  // (the world's groundwater film in the one water look for a custom layout, rule 17 of 2026-11-11; a premade keeps it)
  try { const gw = restyleGroundwater(ctx, layout); if (gw) list.push({ id: "groundwater", main: false, obj: gw, dead: false }); } catch (e) { console.error(`[cutaway-bug] groundwater look skipped: ${e?.message ?? e}`); }
  // the suburb and the world's life on a custom video (the owner's rules 5, 6, 19 and 21 of 2026-11-11: neighbours,
  // street trees and passing cars from the first frame, trees that sway, machines that idle): built after the parts, on
  // the ground none of them takes (their boxes, m2/focus.js); a premade keeps its approved world
  if (!ctx.premade) {
    try {
      const SKIP = new Set(["fx", "ambient", "rain", "light", "arrows", "outline", "lawnWet", "wetBand", "soak", "sheet", "sign", "counter", "terrain", "token"]);
      const blockers = layout.parts.filter((p) => !SKIP.has(p.kind)).map((p) => focusOf(p, ctx.cut)).filter((b) => b && b.max[0] - b.min[0] < 60 && b.max[2] - b.min[2] < 60).map((b) => ({ x0: b.min[0] - 1, x1: b.max[0] + 1, z0: b.min[2] - 1, z1: b.max[2] + 1 }));
      const sub = dressWorld(ctx, layout, { blockers });
      list.push({ id: "worldLife", main: false, obj: worldLife(ctx, layout, { suburb: sub, built, tracks: T }), dead: false });
    } catch (e) { console.error(`[cutaway-bug] the suburb and the world's life skipped: ${e?.message ?? e}`); }
  }
  // a part whose update crashes is hidden from then on and logged once (the main subject's crash stops the render)
  const step = (o, t) => {
    if (o.dead) return;
    try { o.obj.update(t); } catch (e) {
      if (o.main) throw e;
      o.dead = true; if (o.obj?.group) o.obj.group.visible = false;
      console.error(`[cutaway-bug] part ${o.id} stopped (its update crashed): ${e?.message ?? e}`);
    }
  };
  const keys = endCard ? timeline.camera.end : timeline.camera.noend;
  const cam = cameraPath(keys);
  // (the custom look's hooks, m2/look2.js, 2026-11-11: the shot's focus point and the camera at another time, for the
  // depth of field on close-ups and the motion blur from the previous frame's camera; read only, built on first use)
  let tgtPath = null;
  return {
    parts: built,
    focusAt(camT) {
      if (look) return [look[3], look[4], look[5]];
      tgtPath ??= cameraPath(keys.map((k) => [k[0], k[2], k[1]]));
      let out = null; tgtPath.apply({ position: { set: (x, y, z) => { out = [x, y, z]; } }, lookAt() {} }, camT); return out;
    },
    poseAt(camT, camera) { if (look) { camera.position.set(look[0], look[1], look[2]); camera.lookAt(look[3], look[4], look[5]); } else cam.apply(camera, camT); },
    // camT: the camera's own time (the flicker check holds the scene at t and moves only the camera)
    update(t, camera, camT = t) {
      for (const o of list) step(o, t);
      // parts that read another's state (the car's foam from the wash arch) see this moment's, not the last frame's: a
      // still rendered out of order showed stale foam
      if (ctx.shared && Object.keys(ctx.shared).length) for (const o of list) step(o, t);
      if (look) { camera.position.set(look[0], look[1], look[2]); camera.lookAt(look[3], look[4], look[5]); } else cam.apply(camera, camT);
    },
  };
}
