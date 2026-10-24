// M2: the page runtime. Builds a layout's parts in order (the order fixes the shared random numbers, so a saved
// layout always looks the same) and moves them from the compiled timeline. The camera follows the timeline's keys.
import { cameraPath } from "../kit/camera.js";
import { channelValue } from "./curves.js";
import { KINDS } from "./parts.js";
import { materialRegistry } from "./materials.js";

/** ctx: the world's objects (THREE, scene, rnd, helpers, sun, soil uniforms...); opts: { endCard, look: [px,py,pz,tx,ty,tz] } */
export function runLayout(ctx, layout, timeline, { endCard = true, look = null } = {}) {
  const mats = materialRegistry(ctx);
  const T = timeline.tracks;
  const built = new Map(), list = [];
  for (const part of layout.parts) {
    const key = (ch) => `${part.id}.${ch}`;
    const api = {
      ch: (name, t, shift = 0) => channelValue(T[key(name)], t, shift),
      cue: (name) => T[key(name)]?.ramps[0],
      cues: (name) => T[key(name)]?.ramps ?? [],
      other: (id, name, t) => channelValue(T[`${id}.${name}`], t),
      part: (id) => built.get(id),
      mat: (name) => mats.get(name),
      wetter: (name) => mats.wetter(name),
      endCard,
    };
    const make = KINDS[part.kind];
    if (!make) throw new Error(`unknown part kind ${part.kind}`);
    const obj = make(ctx, part.params ?? {}, api);
    built.set(part.id, { obj, params: part.params ?? {} });
    list.push(obj);
  }
  const keys = endCard ? timeline.camera.end : timeline.camera.noend;
  const cam = cameraPath(keys);
  return {
    parts: built,
    // camT: the camera's own time (the flicker check holds the scene at t and moves only the camera)
    update(t, camera, camT = t) {
      for (const o of list) o.update(t);
      // parts that read another's state (the car's foam from the wash arch) see this moment's, not the last frame's: a
      // still rendered out of order showed stale foam
      if (ctx.shared && Object.keys(ctx.shared).length) for (const o of list) o.update(t);
      if (look) { camera.position.set(look[0], look[1], look[2]); camera.lookAt(look[3], look[4], look[5]); } else cam.apply(camera, camT);
    },
  };
}
