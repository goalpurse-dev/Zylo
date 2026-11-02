// Zyvo Studio props (Master Prompt v2): a visual metaphor for every line. Each prop is a THREE.Group floating above the
// cast, with big text a phone can read, a pop-in and a small idle motion; update(age) animates it (age = seconds since
// it appeared). makeProp(spec, ctx). PROP_KINDS is the list the script writer may use.
import * as THREE from "three";
import { rbox, add } from "./world.js";

const FONT = '"Segoe UI Black", "Segoe UI", "Segoe UI Emoji", Arial';
const C = (h) => new THREE.Color(h);
export const PROP_KINDS = ["sign", "roll", "tag", "clock", "timeline", "bubble", "conveyor", "trophy", "tiles", "idea", "typed_result"];

function wrap(x, text, maxW) {
  const words = String(text).split(/\s+/), rows = []; let r = "";
  for (const w of words) { const t = r ? `${r} ${w}` : w; if (x.measureText(t).width > maxW && r) { rows.push(r); r = w; } else r = t; }
  if (r) rows.push(r); return rows;
}
/** A canvas texture with centred lines: [{text, size, color}], wrapped to the width and shrunk until it fits. */
function labelCanvas(lines, w, h, bg) {
  const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d");
  const draw = (k) => {
    x.clearRect(0, 0, w, h);
    if (bg) { x.fillStyle = bg; x.beginPath(); x.roundRect(0, 0, w, h, 48); x.fill(); }
    x.textAlign = "center"; x.textBaseline = "middle";
    const laid = lines.map((l) => { x.font = `${l.size * k}px ${FONT}`; return { ...l, rows: wrap(x, l.text, w - 70), lh: l.size * k * 1.14 }; });
    const total = laid.reduce((a, l) => a + l.rows.length * l.lh, 0);
    if (total > h - 40 || laid.some((l) => { x.font = `${l.size * k}px ${FONT}`; return l.rows.some((r) => x.measureText(r).width > w - 16); })) return false;   // one long word must fit too
    let y = (h - total) / 2;
    for (const l of laid) { x.font = `${l.size * k}px ${FONT}`; x.fillStyle = l.color ?? "#ffffff"; for (const r of l.rows) { x.fillText(r, w / 2, y + l.lh / 2 + 3); y += l.lh; } }
    return true;
  };
  for (let k = 1; k > 0.3; k -= 0.06) if (draw(k)) break;
  return c;
}
function labelPlane(lines, wm, hm, { px = 512, bg = null, emissive = 1 } = {}) {
  const c = labelCanvas(lines, Math.round(px * wm / hm * (hm >= 1 ? 1 : 1)), px, bg);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(wm, hm), new THREE.MeshBasicMaterial({ map: t, color: C("#ffffff").multiplyScalar(emissive), transparent: true, toneMapped: false }));
  m.userData.redraw = (ls) => { const n = labelCanvas(ls, c.width, c.height, bg); c.getContext("2d").clearRect(0, 0, c.width, c.height); c.getContext("2d").drawImage(n, 0, 0); t.needsUpdate = true; };
  return m;
}
const board = (g, w, h, color = "#14121f", rim = "#BEF264") => {
  add(g, rbox(w + 0.12, h + 0.12, 0.1, 0.16), new THREE.MeshStandardMaterial({ color: C(rim), roughness: 0.45 }), 0, 0, -0.03);
  add(g, rbox(w, h, 0.12, 0.14), new THREE.MeshStandardMaterial({ color: C(color), roughness: 0.55 }), 0, 0, 0);
};
const fmtRoll = (v, spec) => (spec.format === "M" ? `${Math.round(v)}M` : spec.format === "clock" ? `${Math.floor(v / 60)}:${String(Math.round(v) % 60).padStart(2, "0")}` : String(Math.round(v)));
const easeOut = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

const KINDS = {
  /** Nothing: ends the line before's prop or screen. */
  none() {},
  /** A board: a big title, an optional small line. */
  sign(g, s) {
    board(g, 3.0, 1.55, s.color, s.rim);
    const m = labelPlane([{ text: s.text, size: 118, color: s.textColor ?? "#ffffff" }, ...(s.sub ? [{ text: s.sub, size: 62, color: "#BEF264" }] : [])], 2.86, 1.42); m.position.z = 0.075; g.add(m);
  },
  /** A number rolling up to a real value, with a label (a dopamine moment). */
  roll(g, s) {
    board(g, 3.0, 1.75, "#14121f", "#FFD43B");
    const lines = (v) => [{ text: fmtRoll(v, s), size: 210, color: "#FFD43B" }, { text: s.label, size: 58, color: "#ffffff" }];
    const m = labelPlane(lines(0), 2.86, 1.62); m.position.z = 0.075; g.add(m);
    let last = -1;
    return (age) => { const v = Math.round(s.value * easeOut(age / (s.secs ?? 1.3))); if (v !== last) { last = v; m.userData.redraw(lines(v)); } };
  },
  /** A price tag, swinging. */
  tag(g, s) {
    const body = new THREE.Group(); g.add(body);
    add(body, rbox(2.5, 1.35, 0.1, 0.22), new THREE.MeshStandardMaterial({ color: C(s.color ?? "#FFD43B"), roughness: 0.5 }));
    add(body, new THREE.TorusGeometry(0.1, 0.03, 10, 24), new THREE.MeshStandardMaterial({ color: C("#555") }), -1.0, 0.45, 0.07);
    const m = labelPlane([{ text: s.text, size: 112, color: "#141414" }, ...(s.sub ? [{ text: s.sub, size: 58, color: "#333333" }] : [])], 2.36, 1.24); m.position.z = 0.06; body.add(m);
    return (age) => { body.rotation.z = Math.sin(age * 2.2) * 0.05 * Math.exp(-age * 0.25); };
  },
  /** A clock whose hand spins: hours going by. */
  clock(g, s) {
    add(g, new THREE.CylinderGeometry(0.95, 0.95, 0.16, 48).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: C("#ffffff"), roughness: 0.4 }));
    add(g, new THREE.TorusGeometry(0.95, 0.08, 14, 64), new THREE.MeshStandardMaterial({ color: C("#FF6B6B"), roughness: 0.4 }));
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; add(g, rbox(0.05, 0.16, 0.02, 0.01), new THREE.MeshStandardMaterial({ color: C("#333") }), Math.sin(a) * 0.76, Math.cos(a) * 0.76, 0.09).rotation.z = -a; }
    const long = new THREE.Group(), short = new THREE.Group(); long.position.z = 0.1; short.position.z = 0.11; g.add(long, short);
    add(long, rbox(0.06, 0.72, 0.02, 0.01), new THREE.MeshStandardMaterial({ color: C("#222") }), 0, 0.34, 0); add(short, rbox(0.08, 0.46, 0.02, 0.01), new THREE.MeshStandardMaterial({ color: C("#222") }), 0, 0.21, 0);
    if (s.text) { const m = labelPlane([{ text: s.text, size: 90, color: "#ffffff" }], 3.2, 0.62, { px: 200, bg: "#14121f" }); m.position.set(0, -1.28, 0.1); g.add(m); }
    return (age) => { long.rotation.z = -age * 5; short.rotation.z = -age * 0.45; };
  },
  /** A messy editing timeline collapsing into one button (a satisfying transformation). */
  timeline(g, s) {
    const bars = [], cols = ["#FF6B6B", "#4ECDC4", "#FFE66D", "#A06CD5", "#FF9F1C", "#06D6A0"];
    for (let i = 0; i < 16; i++) { const b = add(g, rbox(0.34 + ((i * 37) % 10) * 0.08, 0.2, 0.08, 0.04), new THREE.MeshStandardMaterial({ color: C(cols[i % 6]), roughness: 0.5 }), 0, 0, 0); b.userData.home = [((i * 53) % 25) / 25 * 2.7 - 1.35, (i % 5) * 0.27 - 0.54]; bars.push(b); }
    const btn = new THREE.Group(); g.add(btn);
    add(btn, rbox(2.5, 0.9, 0.16, 0.3), new THREE.MeshStandardMaterial({ color: C("#BEF264"), roughness: 0.4 }));
    const m = labelPlane([{ text: s.text ?? "ONE IDEA", size: 150, color: "#0b1006" }], 2.3, 0.76, { px: 240 }); m.position.z = 0.09; btn.add(m);
    btn.scale.setScalar(0.0001);
    const at = s.at ?? 1.1;
    return (age) => {
      const k = easeOut((age - at) / 0.55);
      bars.forEach((b, i) => { const [x, y] = b.userData.home; const w = Math.sin(age * 2 + i) * 0.03; b.position.set(x * (1 - k) + w, y * (1 - k), 0.02); b.scale.setScalar(Math.max(0.0001, 1 - k)); });
      const p = (age - at - 0.2) / 0.35; btn.scale.setScalar(p <= 0 ? 0.0001 : p >= 1 ? 1 : 1 + 2.7 * (p - 1) ** 3 + 1.7 * (p - 1) ** 2);
    };
  },
  /** A speech bubble with real words in it. */
  bubble(g, s) {
    add(g, rbox(3.1, 1.6, 0.12, 0.34), new THREE.MeshStandardMaterial({ color: C(s.color ?? "#ffffff"), roughness: 0.5 }));
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.42, 3), new THREE.MeshStandardMaterial({ color: C(s.color ?? "#ffffff"), roughness: 0.5 })); tail.position.set(s.tail === "right" ? 0.9 : -0.9, -0.95, 0); tail.rotation.z = Math.PI; g.add(tail);
    const m = labelPlane([...(s.from ? [{ text: s.from, size: 56, color: "#7C4DFF" }] : []), { text: s.text, size: 84, color: "#141414" }], 2.92, 1.46); m.position.z = 0.075; g.add(m);
  },
  /** A belt carrying a box into a machine; a real picture comes out (a sentence becomes a video). */
  conveyor(g, s, ctx) {
    board(g, 3.4, 1.9, "#fff7e0", "#7C4DFF"); g.children.forEach((m) => { m.position.z -= 0.4; });
    add(g, rbox(3.2, 0.16, 0.5, 0.04), new THREE.MeshStandardMaterial({ color: C("#444a5c"), roughness: 0.6 }), 0, -0.72, 0);
    add(g, rbox(1.1, 1.3, 0.8, 0.14), new THREE.MeshStandardMaterial({ color: C("#7C4DFF"), roughness: 0.45 }), 0, -0.05, 0);
    const box = new THREE.Group(); g.add(box);
    add(box, rbox(0.86, 0.5, 0.3, 0.06), new THREE.MeshStandardMaterial({ color: C("#ffffff"), roughness: 0.5 }));
    const l = labelPlane([{ text: s.text ?? "IDEA", size: 150, color: "#141414" }], 0.8, 0.44, { px: 200 }); l.position.z = 0.16; box.add(l);
    const tile = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 1.28), new THREE.MeshBasicMaterial({ color: C("#ffffff"), toneMapped: false })); g.add(tile);
    if (s.image) { const t = ctx.tl.load(s.image); t.colorSpace = THREE.SRGBColorSpace; tile.material.map = t; }
    return (age) => {
      const a = (age % 2.4) / 2.4;
      box.position.set(-1.45 + Math.min(1, a / 0.45) * 1.45, -0.38, 0.2); box.scale.setScalar(a < 0.45 ? 1 : 0.0001);
      const b = Math.max(0, (a - 0.5) / 0.3); tile.position.set(Math.min(1, b) * 1.15, -0.05, 0.22); tile.scale.setScalar(b <= 0 ? 0.0001 : Math.min(1, b));
    };
  },
  /** A trophy with a label. */
  trophy(g, s) {
    const gold = new THREE.MeshStandardMaterial({ color: C("#FFC93C"), roughness: 0.25, metalness: 0.7 });
    add(g, new THREE.CylinderGeometry(0.62, 0.3, 0.86, 32), gold, 0, 0.35, 0);
    add(g, new THREE.TorusGeometry(0.28, 0.06, 12, 24), gold, -0.66, 0.42, 0); add(g, new THREE.TorusGeometry(0.28, 0.06, 12, 24), gold, 0.66, 0.42, 0);
    add(g, new THREE.CylinderGeometry(0.09, 0.09, 0.36, 16), gold, 0, -0.26, 0); add(g, rbox(0.9, 0.16, 0.5, 0.04), gold, 0, -0.5, 0);
    if (s.text) { const m = labelPlane([{ text: s.text, size: 90, color: "#ffffff" }], 3.2, 0.62, { px: 200, bg: "#14121f" }); m.position.set(0, -1.0, 0.3); g.add(m); }
  },
  /** "What I typed" next to "what came out": the creation's real idea and its real picture. */
  typed_result(g, s, ctx) {
    board(g, 3.5, 2.05, "#14121f", "#BEF264");
    const typedHead = labelPlane([{ text: "WHAT I TYPED", size: 62, color: "#BEF264" }], 1.66, 0.28, { px: 120 }); typedHead.position.set(-0.84, 0.66, 0.075); g.add(typedHead);
    const typed = labelPlane([{ text: `"${s.text}"`, size: 92, color: "#ffffff" }], 1.56, 1.3); typed.position.set(-0.84, -0.14, 0.075); g.add(typed);
    const head = labelPlane([{ text: "WHAT CAME OUT", size: 62, color: "#BEF264" }], 1.66, 0.28, { px: 120 }); head.position.set(0.84, 0.66, 0.075); g.add(head);
    const t = ctx.tl.load(s.image); t.colorSpace = THREE.SRGBColorSpace;
    const pw = s.wide ? 1.6 : 0.72, ph = s.wide ? 0.9 : 1.28;
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshBasicMaterial({ map: t, toneMapped: false })); pic.position.set(0.84, -0.16, 0.08); g.add(pic);
  },
  /** Real pictures from the creation, side by side (never AI art passed off as output: these ARE its outputs). */
  tiles(g, s, ctx) {
    const n = s.images.length, w = s.w ?? (s.wide ? 3.0 : Math.min(1.05, 3.3 / n - 0.1)), h = s.wide || s.crop ? w * 9 / 16 : w * 16 / 9;
    s.images.forEach((src, i) => {
      const t = ctx.tl.load(src); t.colorSpace = THREE.SRGBColorSpace;
      if (s.crop) { t.repeat.set(1, 0.316); t.offset.set(0, 0.342); }   // a wide card from a vertical picture shows its middle
      const x = (i - (n - 1) / 2) * (w + 0.1);
      add(g, rbox(w + 0.08, h + 0.08, 0.06, 0.06), new THREE.MeshStandardMaterial({ color: C("#ffffff"), roughness: 0.5 }), x, 0, -0.02);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, toneMapped: false })); m.position.set(x, 0, 0.03); g.add(m);
    });
  },
  /** An idea card: a number, its title, its line. */
  idea(g, s) {
    board(g, 3.1, 1.7, "#ffffff", s.rim ?? "#7C4DFF");
    const m = labelPlane([{ text: `${s.n}. ${s.title}`, size: 100, color: "#2a1a66" }, { text: s.text, size: 58, color: "#333333" }], 2.96, 1.58); m.position.z = 0.075; g.add(m);
  },
};

export function makeProp(spec, ctx) {
  const g = new THREE.Group();
  const kind = KINDS[spec.kind]; if (!kind) throw new Error(`no prop "${spec.kind}"`);
  const update = kind(g, spec, ctx);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; } });
  return { group: g, update: update ?? (() => {}) };
}
