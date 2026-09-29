// Camera motion -> FFmpeg `perspective` corners (sense=source): the view
// rectangle in FLOAT source coordinates, resampled with cubic interpolation
// every frame — sub-pixel smooth, no zoompan stair-step jitter.
// Mirrors supabase/functions/_shared/stickman/edl.ts perspectiveExpr (a test
// keeps the two identical).
export function perspectiveExpr(m, frames) {
  const t = frames > 1 ? `(on/${frames - 1})` : "0";
  const lin = (a, b) => (a === b ? `${a}` : `(${a}+(${b - a})*${t})`);
  const s = lin(m.from.scale, m.to.scale), cx = lin(m.from.cx, m.to.cx), cy = lin(m.from.cy, m.to.cy);
  const L = `(W*${cx}-W/(2*${s}))`, R = `(W*${cx}+W/(2*${s}))`, T = `(H*${cy}-H/(2*${s}))`, B = `(H*${cy}+H/(2*${s}))`;
  return `x0='${L}':y0='${T}':x1='${R}':y1='${T}':x2='${L}':y2='${B}':x3='${R}':y3='${B}':interpolation=cubic:eval=frame`;
}

// The largest centred 16:9 crop of a source (even sizes for the encoder).
export function crop169(w, h) {
  const cw = Math.min(w, Math.floor((h * 16) / 9 / 2) * 2), ch = Math.min(h, Math.floor((w * 9) / 16 / 2) * 2);
  return { cw, ch, x: Math.floor((w - cw) / 2), y: Math.floor((h - ch) / 2) };
}

// The filter graph for one clip: [0] the image (looped), [1] the text layer
// PNG when present (static on top — the text never moves).
//   profile "base":   the 1920x1080 scene image, output 1920x1080 (5a/5b).
//   profile "master": the FULL-RES upscaled source (e.g. 2752x1536): crop to
//                     16:9 at native resolution, move there, then ONE Lanczos
//                     scale to the output (2560x1440) — a zoom never
//                     upsamples past real pixels while view >= output
//                     (2730/1.06 = 2575 >= 2560) (Phase 5c).
export function clipGraph(clip, edl, profile = { name: "base", width: edl.width, height: edl.height }) {
  const W = profile.width, H = profile.height;
  const moving = clip.motion.kind !== "hold";
  let base;
  if (profile.name === "master") {
    const { cw, ch, x, y } = crop169(clip.masterSize.width, clip.masterSize.height);
    base = `[0:v]crop=${cw}:${ch}:${x}:${y}` + (moving ? `,format=gbrp,perspective=${perspectiveExpr(clip.motion, clip.frames)}` : "") + `,scale=${W}:${H}:flags=lanczos,setsar=1`;
  } else {
    base = moving
      ? `[0:v]scale=${W}:${H}:flags=lanczos,format=gbrp,perspective=${perspectiveExpr(clip.motion, clip.frames)},setsar=1`
      : `[0:v]scale=${W}:${H}:flags=lanczos,setsar=1`;
  }
  return clip.overlayImage ? `${base}[bg];[bg][1:v]overlay=0:0:format=auto,format=yuv420p[v]` : `${base},format=yuv420p[v]`;
}

// Phase 6d-1 — STICKMAN_EDL_V2 (the Edit step's document, compiled by
// supabase/functions/_shared/stickman/editRender.ts): [0] the picture with its
// camera move, then each overlay PNG ([1..n], text and caption layers drawn in
// 1920x1080) on exactly its frames of this clip, then the quick fade.
export function clipGraphV2(clip, width = 1920, height = 1080) {
  const m = clip.motion;
  const moving = m.from.scale !== m.to.scale || m.from.cx !== m.to.cx || m.from.cy !== m.to.cy;
  let g = moving
    ? `[0:v]scale=${width}:${height}:flags=lanczos,format=gbrp,perspective=${perspectiveExpr(m, clip.frames)},setsar=1[b0]`
    : `[0:v]scale=${width}:${height}:flags=lanczos,setsar=1[b0]`;
  let last = "b0";
  clip.overlays.forEach((o, k) => {
    g += `;[${last}][${k + 1}:v]overlay=0:0:format=auto:enable='between(n,${o.fromFrame},${o.toFrame - 1})'[b${k + 1}]`;
    last = `b${k + 1}`;
  });
  return g + `;[${last}]` + (clip.fadeInFrames ? `fade=t=in:s=0:n=${clip.fadeInFrames},` : "") + "format=yuv420p[v]";
}

// The camera of a clip at output frame `on` of a PIECE that starts `offset`
// frames into the clip (negative before it starts), clamped to the move's
// ends — the same k = clamp(frame / (frames-1)) as the editor's preview.
export function perspectiveExprAt(m, frames, offset) {
  const t = frames > 1 ? `clip((on+${offset})/${frames - 1},0,1)` : "0";
  const lin = (a, b) => (a === b ? `${a}` : `(${a}+(${b - a})*${t})`);
  const s = lin(m.from.scale, m.to.scale), cx = lin(m.from.cx, m.to.cx), cy = lin(m.from.cy, m.to.cy);
  const L = `(W*${cx}-W/(2*${s}))`, R = `(W*${cx}+W/(2*${s}))`, T = `(H*${cy}-H/(2*${s}))`, B = `(H*${cy}+H/(2*${s}))`;
  return `x0='${L}':y0='${T}':x1='${R}':y1='${T}':x2='${L}':y2='${B}':x3='${R}':y3='${B}':interpolation=cubic:eval=frame`;
}
const still = (m) => m.from.scale === m.to.scale && m.from.cx === m.to.cx && m.from.cy === m.to.cy;
// A clip's picture for a piece. With the full-res master (e.g. 2752x1536):
// crop 16:9 at native size, move there, then ONE Lanczos scale to the output —
// never upsampled (a 6 % zoom still reads >= 2560 source px for 1920 out).
const picture = (input, clip, offset, width, height, label) => {
  const move = still(clip.motion) ? "" : `format=gbrp,perspective=${perspectiveExprAt(clip.motion, clip.frames, offset)},`;
  if (clip.masterSize) { const { cw, ch, x, y } = crop169(clip.masterSize.width, clip.masterSize.height); return `[${input}:v]crop=${cw}:${ch}:${x}:${y},${move}scale=${width}:${height}:flags=lanczos,setsar=1,format=yuv420p[${label}]`; }
  return `[${input}:v]scale=${width}:${height}:flags=lanczos,${move}setsar=1,format=yuv420p[${label}]`;
};

// Flash (photosensitivity-safe): the pictures cross-fade and a soft off-white
// veil rises to at most 70 % at the middle frame and falls again — the
// preview's veil exactly: opacity = max * (1 - |2k/n - 1|) at frame k of n.
export function veilFilter(veil, frames) {
  const hex = String(veil.color ?? "#F5F2EA").replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const a = `(${Number(veil.opacity ?? 0.7)}*(1-abs(2*N/${frames}-1)))`;
  return `format=rgb24,geq=r='r(X,Y)+(${r}-r(X,Y))*${a}':g='g(X,Y)+(${g}-g(X,Y))*${a}':b='b(X,Y)+(${b}-b(X,Y))*${a}'`;
}

// Editor transition -> FFmpeg xfade (whip = slideleft + a horizontal blur).
export const XFADE = { fade: "fade", whip: "slideleft", zoom: "zoomin", flash: "fade", slide_left: "slideleft", slide_right: "slideright", dip: "fadeblack", circle: "circleopen" };

// One PIECE of an EDL v2 (compiled by editRender.ts): a clip's own frames, or
// a transition window where clip a's picture turns into clip b's. Inputs:
// [0] a's image, [1] b's image (xfade only), then each overlay PNG. The
// xfade runs over the whole piece (offset 0, duration = frames/fps), so frame
// k shows k/frames of the way to b — exactly the preview's progress.
// pos[key] = { x, y }: where an overlay's (cropped) PNG sits in the frame (default 0,0 = full frame).
export function pieceGraph(piece, clips, fps = 30, width = 1920, height = 1080, pos = {}) {
  const A = clips[piece.a];
  let g, last, first = 1;
  if (piece.kind === "xfade") {
    const B = clips[piece.b];
    const kind = piece.xfade ?? XFADE[piece.transition];
    if (!kind) throw new Error(`unknown transition ${piece.transition}`);
    g = picture(0, A, piece.fromFrame - A.startFrame, width, height, "pa") + ";" + picture(1, B, piece.fromFrame - B.startFrame, width, height, "pb")
      + `;[pa][pb]xfade=transition=${kind}:duration=${(piece.frames / fps).toFixed(6)}:offset=0` + (piece.blur ? ",gblur=sigma=14:sigmaV=0.6" : "") + (piece.veil ? `,${veilFilter(piece.veil, piece.frames)}` : "") + "[x0]";
    first = 2;
  } else {
    g = picture(0, A, piece.fromFrame - A.startFrame, width, height, "x0");
  }
  last = "x0";
  piece.overlays.forEach((o, k) => {
    const at = pos[o.key] ?? { x: 0, y: 0 };
    g += `;[${last}][${k + first}:v]overlay=${at.x}:${at.y}:format=auto:enable='between(n,${o.fromFrame},${o.toFrame - 1})'[x${k + 1}]`;
    last = `x${k + 1}`;
  });
  return g + `;[${last}]format=yuv420p[v]`;
}

// Voice + music: the music loops under the voice at its volume, lowered while
// the voice speaks (the same spans as the editor's preview).
export function audioMixArgs(musicVolumeExpr, voiceVolume = 1) {
  return ["-filter_complex", `[1:a]volume=${voiceVolume}[vo];[2:a]volume='${musicVolumeExpr}':eval=frame[m];[vo][m]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[a]`, "-map", "0:v", "-map", "[a]"];
}

// Output profiles. The YouTube master is 1440p (YouTube serves 1440p uploads
// with its better codec, so even 1080p viewers get a sharper stream).
export const PROFILES = {
  master: { name: "master", width: 2560, height: 1440, x264: ["-c:v", "libx264", "-preset", "slow", "-tune", "animation", "-crf", "18", "-pix_fmt", "yuv420p"] },
  base: { name: "base", width: 1920, height: 1080, x264: ["-c:v", "libx264", "-preset", "slow", "-tune", "animation", "-crf", "23", "-pix_fmt", "yuv420p"] },
};
