// Kit: sign lettering that is never stretched. The canvas has the board's own proportions (a 13 m x 0.9 m car wash
// sign drawn on a 1024 x 192 canvas came out 2.7 times too wide), the text is set in a clean bold sans, as tall as the
// board allows with margins, and only ever made smaller evenly to fit (never squeezed with a maxWidth).

export const SIGN_MARGIN = 0.06; // of the board's width, each side; the height margin is 18% top and bottom
export const SIGN_FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

/**
 * The lettering's layout on a w x h board: the canvas size (its aspect = the board's), the font size, the text width.
 * measure(px) -> the text's width at that font size (the canvas's measureText in the page; an estimate in node).
 */
export function signFit(w, h, measure, base = 1024) {
  const cw = base, ch = Math.max(32, Math.round((base * h) / w));
  let px = Math.round(ch * 0.64);
  const maxW = cw * (1 - 2 * SIGN_MARGIN);
  const tw = measure(px);
  if (tw > maxW) px = Math.floor((px * maxW) / tw);
  return { cw, ch, px, tw: measure(px), aspectBoard: w / h, aspectCanvas: cw / ch };
}

/** the sign's texture: bg board, fg letters, for a w x h board (THREE: the page's three.js) */
export function signTexture(THREE, text, bg, fg, w, h) {
  const c = document.createElement("canvas"), g = c.getContext("2d");
  const font = (px) => `800 ${px}px ${SIGN_FONT}`;
  const fit = signFit(w, h, (px) => { g.font = font(px); return g.measureText(text).width; });
  c.width = fit.cw; c.height = fit.ch;
  g.fillStyle = bg; g.fillRect(0, 0, fit.cw, fit.ch);
  g.fillStyle = fg; g.font = font(fit.px); g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(text, fit.cw / 2, fit.ch / 2 + fit.px * 0.04);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.userData = { sign: { text, ...fit } };
  return t;
}
