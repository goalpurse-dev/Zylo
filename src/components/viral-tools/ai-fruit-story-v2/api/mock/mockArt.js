// Paints placeholder "scene pictures" for the mock backend: the location's
// light, a floor shadow and the characters in frame, speaker in front.
// Browser only (canvas). Without a DOM (node tests) paintScene resolves null.

const imageCache = new Map();

function loadImage(src) {
  if (!imageCache.has(src)) {
    imageCache.set(src, new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    }));
  }
  return imageCache.get(src);
}

/**
 * @param {Object} opts
 * @param {"9:16"|"16:9"} opts.aspect
 * @param {{top:string, mid:string, bottom:string, glow:string}} opts.location
 * @param {{refImageUrl:string}[]} opts.figures  1–3 characters, speaker first
 * @param {number} [opts.variant]  Changes framing a little (edits / regenerations)
 * @returns {Promise<string|null>} JPEG data URL
 */
export async function paintScene({ aspect, location, figures, variant = 0 }) {
  if (typeof document === "undefined") return null;
  const wide = aspect === "16:9";
  const W = wide ? 960 : 540;
  const H = wide ? 540 : 960;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, location.top);
  bg.addColorStop(0.5, location.mid);
  bg.addColorStop(1, location.bottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Warm/cool key light behind the characters.
  const glowX = W * (0.5 + ((variant % 3) - 1) * 0.12);
  const glow = ctx.createRadialGradient(glowX, H * 0.3, 10, glowX, H * 0.3, Math.max(W, H) * 0.45);
  glow.addColorStop(0, `${location.glow}88`);
  glow.addColorStop(1, `${location.glow}00`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Floor.
  const floor = ctx.createLinearGradient(0, H * 0.7, 0, H);
  floor.addColorStop(0, "rgba(0,0,0,0)");
  floor.addColorStop(1, "rgba(0,0,0,0.6)");
  ctx.fillStyle = floor;
  ctx.fillRect(0, H * 0.7, W, H * 0.3);

  const imgs = await Promise.all(figures.slice(0, 3).map((f) => loadImage(f.refImageUrl)));
  const n = imgs.length;
  const slots = n === 1 ? [0.5] : n === 2 ? [0.3, 0.7] : [0.2, 0.5, 0.8];
  // Draw listeners first so the speaker (index 0) is in front and larger.
  const order = imgs.map((img, i) => ({ img, i })).reverse();
  for (const { img, i } of order) {
    if (!img) continue;
    const scale = i === 0 ? 1 : 0.86;
    const h = (wide ? H * 0.72 : H * 0.5) * scale;
    const w = h * (img.width / img.height || 0.8);
    const x = W * slots[(i + variant) % n] - w / 2;
    const y = H * (wide ? 0.9 : 0.82) - h;
    const r = Math.min(w, h) * 0.08;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 12;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.clip();
    ctx.drawImage(img, x, y, w, h);
    ctx.restore();
    if (i === 0) {
      ctx.save();
      ctx.strokeStyle = "rgba(190,242,100,0.55)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.stroke();
      ctx.restore();
    }
  }
  return canvas.toDataURL("image/jpeg", 0.82);
}
