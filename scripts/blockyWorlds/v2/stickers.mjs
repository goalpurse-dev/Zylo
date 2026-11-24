// IN THIS TOWN v2: COMIC STICKERS (owner 2026-11-24): tested 2D overlays on a word: "!", "?!", "???", "ZZZ", a sweat drop,
// speed lines, "1 HOUR LATER". One at a time, never over a face: drawn in the top band, on the side away from the
// subject's head (from the free projection). Pure ffmpeg drawtext: the same look on the stills and in the video.
export const STICKERS = ["!", "?!", "???", "ZZZ", "sweat", "speed", "1 HOUR LATER", "LATER THAT NIGHT"];
const FONT = "C\\:/Windows/Fonts/ariblk.ttf";
const esc = (s) => String(s).replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\u2019").replace(/%/g, " pct");

/** an ffmpeg filter chain for one sticker on a W x H frame; side = "left" | "right" (away from the face);
 * enable = optional "between(t,a,b)" for the video */
export function stickerFilter(name, { W = 1080, H = 1920, side = "right", enable = null } = {}) {
  const en = enable ? `:enable='${enable}'` : "";
  const big = Math.round(W * 0.16), mid = Math.round(W * 0.07);
  const x = side === "left" ? Math.round(W * 0.08) : `w-tw-${Math.round(W * 0.08)}`;
  const y = Math.round(H * 0.14);
  if (name === "sweat") return `drawtext=fontfile='${FONT}':text='\u2022':fontsize=${big}:fontcolor=0x8FD8FF:borderw=${Math.round(W * 0.008)}:bordercolor=0x1A3A5A:x=${x}:y=${y}${en}`;
  if (name === "speed") return [0, 1, 2, 3].map((k) => `drawbox=x=${side === "left" ? Math.round(W * 0.04) : Math.round(W * 0.66)}:y=${Math.round(H * (0.12 + k * 0.035))}:w=${Math.round(W * (0.3 - k * 0.04))}:h=${Math.max(3, Math.round(H * 0.006))}:color=white@0.85:t=fill${en}`).join(",");
  const long = name.length > 4;
  const size = long ? mid : big;
  const col = name === "ZZZ" ? "0xB8D8FF" : long ? "0xFFF2A8" : "0xFFE14D";
  return `drawtext=fontfile='${FONT}':text='${esc(name)}':fontsize=${size}:fontcolor=${col}:borderw=${Math.round(size * 0.09)}:bordercolor=0x14141A:x=${long ? "(w-tw)/2" : x}:y=${y}${en}`;
}
