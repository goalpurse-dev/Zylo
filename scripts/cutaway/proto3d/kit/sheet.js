// M2 kit: thin sheets that wrap or line a cut (filter fabric, a liner, a membrane). Each panel wipes in from one
// edge; panels are staggered so the wrap reads as one motion. In the cut face the sheet shows as thin bands.
import { span, eOut } from "./verbs.js";

/** box: the space the sheet wraps, { x0, x1, y0, y1, z0, z1 }; sides: "left","right","floor","top","back";
 *  along: "z" (wipe back to front) or "x" (wipe left to right, for long trenches) for the floor, top and back panels */
export function wrapSheet(ctx, box, { mat, thick = 0.07, sides = ["back", "floor", "top"], along = "z", stagger = 0.12, dur = 0.4 } = {}) {
  const { THREE, scene, RoundedBoxGeometry } = ctx;
  const { x0, x1, y0, y1, z0, z1 } = box, w = x1 - x0, h = y1 - y0, d = z1 - z0, cz = (z0 + z1) / 2, cx = (x0 + x1) / 2;
  const X = along === "x";
  // [size, anchor offset (the edge it grows from), anchor position, scaled axis]
  const spec = {
    left: [[thick, h, d], [0, -0.5, 0], [x0 + thick / 2, y1, cz], "y"],
    right: [[thick, h, d], [0, -0.5, 0], [x1 - thick / 2, y1, cz], "y"],
    floor: X ? [[w, thick, d], [0.5, 0, 0], [x0, y0 + thick / 2, cz], "x"] : [[w, thick, d], [0, 0, 0.5], [cx, y0 + thick / 2, z0], "z"],
    back: X ? [[w, h, thick], [0.5, 0, 0], [x0, (y0 + y1) / 2, z0 + thick / 2], "x"] : [[w, h, thick], [0, -0.5, 0], [cx, y1, z0 + thick / 2], "y"],
    top: X ? [[w, thick, d], [0.5, 0, 0], [x0, y1 + thick / 2, cz], "x"] : [[w + thick * 2, thick, d], [0, 0, 0.5], [cx, y1 + thick / 2, z0], "z"],
  };
  const panels = sides.map((k, i) => {
    const [[sx, sy, sz], [ax, ay, az], pos, axis] = spec[k];
    const g = new RoundedBoxGeometry(sx, sy, sz, 2, Math.min(0.03, thick * 0.45)); g.translate(ax * sx, ay * sy, az * sz);
    const m = new THREE.Mesh(g, mat); m.position.set(...pos); m.receiveShadow = true; m.visible = false; scene.add(m);
    return { m, axis, i };
  });
  return {
    update(t, a) {
      for (const p of panels) { const k = eOut(span(t, a + p.i * stagger, a + p.i * stagger + dur)); p.m.visible = k > 0.001; p.m.scale[p.axis] = Math.max(0.001, k); }
    },
  };
}
