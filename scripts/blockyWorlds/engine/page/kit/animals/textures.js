// Blocky Worlds ANIMALS: the procedural canvas textures of the animal kit (seeded, so every frame is the same), in the
// locked look: flat-ish colour with a subtle texture that reads as fur tufts, feathers, scales, shell plates...
//   animalMat(color, kind, o)  -> a cached MeshStandardMaterial (kind: fur | short | shag | fluff | wool | velvet |
//                                 feather | scale | skin | warts | smooth | shiny | slime | wrinkle | plate | scute |
//                                 spiral | plain); in Node (tests) a plain material without the canvas map.
import * as THREE from "three";
import { rng, hashSeed } from "../../../lib/rng.js";
import { PLASTIC_LOOK, plasticRough, toyColour } from "../plastic.js"; // PLASTIC-WORLD 2026-11-10
// PLASTIC-WORLD: smooth toy plastic: the noise kinds (fur, wool, skin, specks...) become a flat colour; the PATTERN kinds
// (feathers, scales, plates, scutes, spirals) keep their clean colour patches, without the speck noise
export const PATTERN_KINDS = Object.freeze(["feather", "scale", "plate", "scute", "spiral"]);

const MAT = new Map();
const hasCanvas = () => typeof document !== "undefined" && typeof document.createElement === "function";
const shade = (base, k) => `#${new THREE.Color(base).multiplyScalar(k).getHexString()}`;
const ROUGH = { smooth: 0.38, shiny: 0.28, slime: 0.3, skin: 0.55, warts: 0.7, scale: 0.5, plate: 0.6, scute: 0.6, spiral: 0.5, feather: 0.85, fluff: 0.95, fur: 0.92, shag: 0.95, wool: 0.98, velvet: 0.9, short: 0.85, wrinkle: 0.8, plain: 0.6 };

function paint(p, S, color, kind, R) {
  p.fillStyle = color; p.fillRect(0, 0, S, S);
  const base = new THREE.Color(color), tmp = new THREE.Color();
  const speck = (n, w, h, lo, hi) => { if (PLASTIC_LOOK) return; for (let i = 0; i < n; i++) { p.fillStyle = `#${tmp.copy(base).multiplyScalar(lo + R() * (hi - lo)).getHexString()}`; p.fillRect(R() * S, R() * S, w, h); } };
  const strokes = (n, len, width, alpha, dark = true) => {
    p.lineWidth = width; p.lineCap = "round";
    for (let i = 0; i < n; i++) {
      const x = R() * S, y = R() * S, k = dark ? 0.7 + R() * 0.15 : 1.12 + R() * 0.15;
      p.strokeStyle = `#${tmp.copy(base).multiplyScalar(k).getHexString()}`; p.globalAlpha = alpha;
      p.beginPath(); p.moveTo(x, y); p.quadraticCurveTo(x + (R() - 0.5) * len * 0.6, y + len * 0.5, x + (R() - 0.5) * len * 0.5, y + len); p.stroke();
    }
    p.globalAlpha = 1;
  };
  switch (kind) {
    case "fur": speck(900, 2, 2, 0.9, 1.08); strokes(150, 12, 2.2, 0.55); strokes(70, 9, 1.6, 0.5, false); break;
    case "short": speck(1400, 2, 2, 0.93, 1.06); strokes(90, 6, 1.4, 0.35); break;
    case "shag": speck(600, 3, 3, 0.9, 1.06); strokes(220, 22, 3, 0.55); strokes(120, 18, 2.4, 0.6, false); break;
    case "fluff": speck(800, 3, 3, 0.95, 1.06); for (let i = 0; i < 70; i++) { p.fillStyle = `#${tmp.copy(base).multiplyScalar(1.05 + R() * 0.06).getHexString()}`; p.beginPath(); p.arc(R() * S, R() * S, 3 + R() * 5, 0, Math.PI * 2); p.fill(); } break;
    case "wool": for (let i = 0; i < 160; i++) { const x = R() * S, y = R() * S, r = 5 + R() * 6; p.fillStyle = `#${tmp.copy(base).multiplyScalar(0.86 + R() * 0.08).getHexString()}`; p.beginPath(); p.arc(x, y + 1.5, r, 0, Math.PI * 2); p.fill(); p.fillStyle = `#${tmp.copy(base).multiplyScalar(1.0 + R() * 0.05).getHexString()}`; p.beginPath(); p.arc(x, y, r * 0.85, 0, Math.PI * 2); p.fill(); } break;
    case "velvet": speck(2400, 1, 1, 0.9, 1.1); break;
    case "feather": {
      speck(500, 2, 2, 0.94, 1.05);
      const rows = 7, cols = 6, w = S / cols, h = S / rows;
      for (let r = 0; r < rows + 1; r++) for (let c = -1; c < cols + 1; c++) {
        const x = c * w + (r % 2 ? w / 2 : 0), y = r * h;
        p.strokeStyle = shade(color, 0.72); p.lineWidth = 2; p.beginPath(); p.arc(x + w / 2, y, w * 0.5, 0.15 * Math.PI, 0.85 * Math.PI); p.stroke();
        p.strokeStyle = shade(color, 1.12); p.lineWidth = 1.2; p.beginPath(); p.moveTo(x + w / 2, y - h * 0.1); p.lineTo(x + w / 2, y + h * 0.35); p.stroke();
      }
      break;
    }
    case "scale": {
      const n = 9, w = S / n;
      for (let r = 0; r < n + 1; r++) for (let c = -1; c < n + 1; c++) {
        const x = c * w + (r % 2 ? w / 2 : 0), y = r * w * 0.8;
        p.fillStyle = shade(color, 0.92 + R() * 0.12); p.beginPath(); p.arc(x + w / 2, y, w * 0.55, 0, Math.PI); p.fill();
        p.strokeStyle = shade(color, 0.7); p.lineWidth = 1.5; p.beginPath(); p.arc(x + w / 2, y, w * 0.55, 0.1, Math.PI - 0.1); p.stroke();
      }
      break;
    }
    case "skin": speck(500, 3, 3, 0.94, 1.05); for (let i = 0; i < 26; i++) { p.fillStyle = shade(color, 0.9 + R() * 0.06); p.beginPath(); p.arc(R() * S, R() * S, 4 + R() * 8, 0, Math.PI * 2); p.fill(); } break;
    case "warts": speck(500, 3, 3, 0.92, 1.05); for (let i = 0; i < 60; i++) { const x = R() * S, y = R() * S, r = 2 + R() * 4; p.fillStyle = shade(color, 0.78); p.beginPath(); p.arc(x + 1, y + 1, r, 0, Math.PI * 2); p.fill(); p.fillStyle = shade(color, 1.12); p.beginPath(); p.arc(x, y, r * 0.8, 0, Math.PI * 2); p.fill(); } break;
    case "smooth": speck(300, 4, 4, 0.96, 1.04); break;
    case "shiny": speck(300, 3, 3, 0.95, 1.05); p.fillStyle = "rgba(255,255,255,0.12)"; p.fillRect(0, S * 0.12, S, S * 0.14); break;
    case "slime": speck(500, 3, 3, 0.92, 1.06); for (let i = 0; i < 40; i++) { p.fillStyle = "rgba(255,255,255,0.12)"; p.beginPath(); p.arc(R() * S, R() * S, 2 + R() * 4, 0, Math.PI * 2); p.fill(); } break;
    case "wrinkle": speck(600, 3, 3, 0.93, 1.05); p.strokeStyle = shade(color, 0.78); p.lineWidth = 1.6; for (let y = 6; y < S; y += 9 + R() * 6) { p.beginPath(); p.moveTo(0, y); for (let x = 0; x <= S; x += 16) p.lineTo(x, y + (R() - 0.5) * 5); p.stroke(); } break;
    case "plate": { speck(400, 3, 3, 0.94, 1.05); p.strokeStyle = shade(color, 0.72); p.lineWidth = 2.5; for (let y = 0; y < S; y += 32) { p.beginPath(); p.moveTo(0, y); p.lineTo(S, y); p.stroke(); for (let x = (y / 32) % 2 ? 16 : 0; x < S; x += 32) { p.beginPath(); p.moveTo(x, y); p.lineTo(x, y + 32); p.stroke(); } } break; }
    case "scute": {
      // turtle shell plates: big rounded hexes with dark seams and lighter growth rings
      const n = 3, w = S / n;
      p.fillStyle = shade(color, 0.55); p.fillRect(0, 0, S, S);
      for (let r = -1; r < n + 1; r++) for (let c = -1; c < n + 1; c++) {
        const cx = c * w + (r % 2 ? w / 2 : 0) + w / 2, cy = r * w * 0.88 + w / 2;
        for (const [k, sc] of [[1, 0.46], [1.12, 0.34], [1.24, 0.2]]) {
          p.fillStyle = shade(color, k); p.beginPath();
          for (let a = 0; a < 6; a++) { const an = Math.PI / 6 + a * Math.PI / 3; p.lineTo(cx + Math.cos(an) * w * sc, cy + Math.sin(an) * w * sc); }
          p.closePath(); p.fill();
        }
      }
      break;
    }
    default: speck(600, 2, 2, 0.95, 1.05);
  }
}

/** a cached material for an animal part */
export function animalMat(color, kind = "plain", o = {}) {
  const key = `${color}|${kind}|${JSON.stringify(o)}`;
  let m = MAT.get(key);
  if (m) return m;
  if (PLASTIC_LOOK && typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color) && !o.emissive) color = toyColour(color, { minSat: 0.3, minVal: 0.3 }); // PLASTIC-WORLD: clean toy colours (no muddy brown / beige)
  const rough = PLASTIC_LOOK ? plasticRough(o.roughness ?? ROUGH[kind] ?? 0.45) : o.roughness ?? ROUGH[kind] ?? 0.7;
  const params = { color: "#ffffff", roughness: rough, metalness: 0, ...(o.emissive ? { emissive: o.emissive, emissiveIntensity: o.emissiveIntensity ?? 1.5 } : {}) };
  if (hasCanvas() && kind !== "plain" && (!PLASTIC_LOOK || PATTERN_KINDS.includes(kind))) {
    const S = 128, c = document.createElement("canvas"); c.width = c.height = S;
    paint(c.getContext("2d"), S, color, kind, rng(hashSeed(`animal/${color}/${kind}`)));
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
    if (o.repeat) t.repeat.set(o.repeat, o.repeat);
    m = new THREE.MeshStandardMaterial({ ...params, map: t });
  } else m = new THREE.MeshStandardMaterial({ ...params, color });
  MAT.set(key, m);
  return m;
}
/** a flat colour (eyes, noses, inner ears), cached */
export const flatMat = (color, o = {}) => animalMat(color, "plain", o);
/** a spiral shell face (a snail's shell side), cached */
export function spiralMat(c1, c2, seam) {
  const key = `spiral|${c1}|${c2}|${seam}`;
  let m = MAT.get(key);
  if (m) return m;
  if (hasCanvas()) {
    const S = 256, c = document.createElement("canvas"); c.width = c.height = S; const p = c.getContext("2d");
    p.fillStyle = c1; p.fillRect(0, 0, S, S);
    // an Archimedean spiral band, alternating colours, with a dark seam
    const turns = 3.2, cx = S / 2, cy = S / 2, R = S * 0.5;
    for (let i = 0; i < 900; i++) {
      const u = i / 900, a = u * turns * Math.PI * 2, r = R * (1 - u) * 0.98;
      p.fillStyle = Math.floor(u * turns * 2) % 2 ? c2 : c1;
      p.beginPath(); p.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, Math.max(2, R / turns * 0.5 * (1 - u * 0.7)), 0, Math.PI * 2); p.fill();
    }
    p.strokeStyle = seam; p.lineWidth = 5; p.beginPath();
    for (let i = 0; i <= 600; i++) { const u = i / 600, a = u * turns * Math.PI * 2, r = R * (1 - u) * 0.98; p.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
    p.stroke();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.5 });
  } else m = new THREE.MeshStandardMaterial({ color: c1, roughness: 0.5 });
  MAT.set(key, m);
  return m;
}
