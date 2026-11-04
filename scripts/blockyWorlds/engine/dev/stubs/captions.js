// Stand-in for page/captions.js: the word spoken at t in plain white bold text with a dark outline.
export async function loadCaptionFont() { await document.fonts.load('120px "BWCaption"'); }
export function drawCaption(p, captions, t) {
  const w = captions.find((c) => t >= c.start && t < c.end);
  if (!w) return;
  p.font = '120px "BWCaption", sans-serif'; p.textAlign = "center"; p.textBaseline = "middle"; p.lineJoin = "round";
  p.lineWidth = 20; p.strokeStyle = "#0b0a12"; p.strokeText(w.word, p.canvas.width / 2, p.canvas.height * 0.62);
  p.fillStyle = "#fff"; p.fillText(w.word, p.canvas.width / 2, p.canvas.height * 0.62);
}
