// Stand-in for page/kit/props.js: a canvas-texture board (insert), a billboarded label (marker), a small box (held).
import * as THREE from "three";
function textTex(text, w, h, bg, fg) {
  const c = document.createElement("canvas"); c.width = w; c.height = h; const p = c.getContext("2d");
  p.fillStyle = bg; p.fillRect(0, 0, w, h); p.fillStyle = fg; p.font = `bold ${Math.round(h / 5)}px sans-serif`; p.textAlign = "center"; p.textBaseline = "middle";
  p.fillText(String(text).slice(0, 28), w / 2, h / 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function makeInsert({ kind, text }) {
  const g = new THREE.Group();
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.05), new THREE.MeshStandardMaterial({ map: textTex(text, 512, 340, kind === "note" ? "#f7f0d0" : "#f4f4f4", "#222") }));
  board.position.y = 1.3; board.castShadow = true; g.add(board);
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.08), new THREE.MeshStandardMaterial({ color: "#665544" }));
  post.position.y = 0.45; g.add(post);
  return g;
}
export function makeMarker({ kind, text }) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3), new THREE.MeshBasicMaterial({ map: textTex(text || kind, 256, 150, "#ffd23f", "#111"), transparent: true }));
  m.userData.billboard = true; return m;
}
export function makeHeld() { return new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), new THREE.MeshStandardMaterial({ color: "#c33" })); }
