// deno-lint-ignore-file no-explicit-any
// stickman/edl.ts — the Edit Decision List (Phase 5a): the single source for
// rendering a long-form video. One clip per beat: the upscaled 1920x1080 base
// image, its time span, a camera motion and the editable text layer. The
// future Editor edits the EDL and re-renders; nothing else feeds the render.
//
// Timing: hard cuts (the genre standard, no crossfades by default). Every cut
// frame is computed ONCE from the absolute ms (round(ms * fps / 1000)), so
// rounding never accumulates; a clip runs to the next clip's first frame and
// the last clip to the end of the audio.
import type { OverlayLayer } from "./textOverlay.ts";

export const EDL_VERSION = "STICKMAN_EDL_V1";
export const EDL_FPS = 30;

export type MotionKind = "push_in" | "pull_out" | "pan" | "hold";
// Normalized camera state: scale >= 1 (1 = the full frame), cx/cy = the view
// centre in [0,1] image coordinates. The renderer interpolates linearly.
export type CameraState = { scale: number; cx: number; cy: number };
export type ClipMotion = { kind: MotionKind; from: CameraState; to: CameraState; source: string };
export type EdlClip = {
  index: number;
  beatSequence: number;
  image: string; // base image without text, 1920x1080
  imageVersionId?: string;
  imageSha256?: string;
  overlayImage?: string | null; // the text layer pre-drawn on a transparent 1920x1080 PNG (the worker needs no font code)
  // Phase 5c: the FULL-RES upscaled source (e.g. 2752x1536) the 1440p master
  // crops from, and its text layer re-drawn at 2560x1440.
  masterImage?: string | null;
  masterSize?: { width: number; height: number } | null;
  overlayImageMaster?: string | null;
  startMs: number;
  endMs: number;
  startFrame: number;
  endFrame: number; // exclusive
  frames: number;
  motion: ClipMotion;
  overlay: OverlayLayer | null;
  narration: string;
  transitionIn: "cut";
};
export type Edl = {
  version: string;
  fps: number;
  width: number;
  height: number;
  audio: { path: string; durationMs: number };
  totalFrames: number;
  clips: EdlClip[];
};

export const msToFrame = (ms: number, fps = EDL_FPS) => Math.round((ms * fps) / 1000);

// Constant speed (Phase 5b): every move runs at ~1% of the frame per second,
// capped at 6%, so a 2 s clip moves 2% and a 6 s clip the full 6% (5a moved
// 6% on every clip — short clips raced). "subtle" runs at half speed.
// Beats with a text overlay hold or push in at most 2%, never pan: the text
// stays fixed while the picture under it would slide (5a beat 75).
export const MOTION_RATE_PER_S = 0.01, MOTION_MAX = 0.06, OVERLAY_MOTION_MAX = 0.02;
const centre = (scale: number): CameraState => ({ scale, cx: 0.5, cy: 0.5 });
export function motionFor(camera: string | null | undefined, index: number, opts: { durationMs?: number; hasOverlay?: boolean } = {}): ClipMotion {
  const c = String(camera ?? "").toLowerCase();
  const source = c || "default";
  const seconds = (opts.durationMs ?? 6000) / 1000;
  const cap = opts.hasOverlay ? OVERLAY_MOTION_MAX : MOTION_MAX;
  const amount = (rate: number) => Number(Math.min(cap, rate * seconds).toFixed(4));
  const push = 1 + amount(MOTION_RATE_PER_S), subtle = 1 + amount(MOTION_RATE_PER_S / 2);
  if (/pull[- ]?back|pull[- ]?out|zoom out/.test(c)) return { kind: "pull_out", from: centre(push), to: centre(1), source };
  if (/subtle push|slight push/.test(c)) return { kind: "push_in", from: centre(1), to: centre(subtle), source };
  if (/push|zoom in/.test(c)) return { kind: "push_in", from: centre(1), to: centre(push), source };
  if (/pan/.test(c)) {
    if (opts.hasOverlay) return { kind: "push_in", from: centre(1), to: centre(subtle), source: `${source} (overlay: no pan)` };
    // The frame is enlarged by the move amount and the centre travels across
    // the margin that creates, so the image slides ~1%/s of its width.
    // Pans alternate direction so consecutive pans don't all drift the same way.
    const edge = 1 / (2 * push);
    const [a, b] = index % 2 === 0 ? [edge, 1 - edge] : [1 - edge, edge];
    return { kind: "pan", from: { scale: push, cx: a, cy: 0.5 }, to: { scale: push, cx: b, cy: 0.5 }, source };
  }
  return { kind: "hold", from: centre(1), to: centre(1), source };
}

// Image integrity (Phase 5b, blocking): each clip names the exact image
// version it uses (id + sha256); a render refuses any clip that is not the
// NEWEST approved version of its beat.
export type ImageVersion = { beatSequence: number; versionId: string; path: string; sha256: string; approved: boolean; createdAt: string };
export function newestApproved(versions: ImageVersion[], beatSequence: number): ImageVersion | null {
  return versions.filter((v) => v.beatSequence === beatSequence && v.approved).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).at(-1) ?? null;
}
export function checkImageIntegrity(edl: Edl, versions: ImageVersion[]): string[] {
  const errors: string[] = [];
  for (const c of edl.clips) {
    const newest = newestApproved(versions, c.beatSequence);
    if (!newest) { errors.push(`beat ${c.beatSequence}: no approved image`); continue; }
    if (!c.imageVersionId || !c.imageSha256) { errors.push(`beat ${c.beatSequence}: clip has no image id/hash`); continue; }
    if (c.imageVersionId !== newest.versionId) errors.push(`beat ${c.beatSequence}: uses superseded image ${c.imageVersionId} (newest ${newest.versionId})`);
    else if (c.imageSha256 !== newest.sha256) errors.push(`beat ${c.beatSequence}: image hash mismatch`);
  }
  return errors;
}

export function buildEdl(opts: {
  beats: { sequence: number; startMs: number; endMs: number; narrationText: string; contract: any }[];
  audio: { path: string; durationMs: number };
  imageFor: (sequence: number) => { image: string; overlay: OverlayLayer | null; imageVersionId?: string; imageSha256?: string };
  fps?: number;
  width?: number;
  height?: number;
}): Edl {
  const fps = opts.fps ?? EDL_FPS;
  const beats = [...opts.beats].sort((a, b) => a.startMs - b.startMs);
  const totalFrames = msToFrame(opts.audio.durationMs, fps);
  const clips: EdlClip[] = beats.map((b, i) => {
    // The first clip starts at 0 so the video never opens on black.
    const startMs = i === 0 ? 0 : b.startMs;
    const endMs = i + 1 < beats.length ? beats[i + 1].startMs : opts.audio.durationMs;
    const startFrame = msToFrame(startMs, fps);
    const endFrame = i + 1 < beats.length ? msToFrame(beats[i + 1].startMs, fps) : totalFrames;
    const src = opts.imageFor(b.sequence);
    return {
      index: i, beatSequence: b.sequence, image: src.image, imageVersionId: src.imageVersionId, imageSha256: src.imageSha256, startMs, endMs, startFrame, endFrame, frames: endFrame - startFrame,
      motion: motionFor(b.contract?.motionIntent?.camera, i, { durationMs: ((endFrame - startFrame) * 1000) / fps, hasOverlay: !!src.overlay }), overlay: src.overlay, narration: b.narrationText, transitionIn: "cut" as const,
    };
  });
  return { version: EDL_VERSION, fps, width: opts.width ?? 1920, height: opts.height ?? 1080, audio: opts.audio, totalFrames, clips };
}

// Structural checks: contiguous frames from 0 to the end of the audio, every
// clip at least one frame, every cut exactly on round(beatStartMs).
export function validateEdl(edl: Edl): string[] {
  const errors: string[] = [];
  let expected = 0;
  for (const c of edl.clips) {
    if (c.startFrame !== expected) errors.push(`clip ${c.index}: starts at frame ${c.startFrame}, expected ${expected}`);
    if (c.frames < 1) errors.push(`clip ${c.index}: ${c.frames} frames`);
    if (c.index > 0 && c.startFrame !== msToFrame(c.startMs, edl.fps)) errors.push(`clip ${c.index}: cut drifted`);
    expected = c.endFrame;
  }
  if (expected !== edl.totalFrames) errors.push(`last frame ${expected} != audio ${edl.totalFrames}`);
  return errors;
}

// Camera state at output frame k of n (linear, no easing — constant speed).
export function cameraAt(m: ClipMotion, k: number, n: number): CameraState {
  const t = n > 1 ? k / (n - 1) : 0;
  const lerp = (a: number, b: number) => a + (b - a) * t;
  return { scale: lerp(m.from.scale, m.to.scale), cx: lerp(m.from.cx, m.to.cx), cy: lerp(m.from.cy, m.to.cy) };
}

// FFmpeg `perspective` corner expressions (sense=source): the view rectangle
// in FLOAT source coordinates, resampled with cubic interpolation every frame
// — truly sub-pixel, so a slow pan/push has no stair-step jitter (Phase 5a:
// zoompan crops on whole pixels; even 4x supersampled it stepped unevenly).
// `on` is the output frame counter; W/H the frame size.
export function perspectiveExpr(m: ClipMotion, frames: number): string {
  const t = frames > 1 ? `(on/${frames - 1})` : "0";
  const lin = (a: number, b: number) => (a === b ? `${a}` : `(${a}+(${b - a})*${t})`);
  const s = lin(m.from.scale, m.to.scale), cx = lin(m.from.cx, m.to.cx), cy = lin(m.from.cy, m.to.cy);
  const L = `(W*${cx}-W/(2*${s}))`, R = `(W*${cx}+W/(2*${s}))`, T = `(H*${cy}-H/(2*${s}))`, B = `(H*${cy}+H/(2*${s}))`;
  return `x0='${L}':y0='${T}':x1='${R}':y1='${T}':x2='${L}':y2='${B}':x3='${R}':y3='${B}':interpolation=cubic:eval=frame`;
}

// FFmpeg zoompan expressions for a motion on a source supersampled `ss` times
// (zoompan crops on whole source pixels, so supersampling keeps the per-frame
// step under 1/ss of an output pixel — no visible jitter). `on` is zoompan's
// output frame counter.
export function zoompanExpr(m: ClipMotion, frames: number): { z: string; x: string; y: string } {
  const t = frames > 1 ? `(on/${frames - 1})` : "0";
  const lin = (a: number, b: number) => (a === b ? `${a}` : `(${a}+(${b - a})*${t})`);
  const z = lin(m.from.scale, m.to.scale);
  const cx = lin(m.from.cx, m.to.cx), cy = lin(m.from.cy, m.to.cy);
  return { z, x: `iw*${cx}-iw/zoom/2`, y: `ih*${cy}-ih/zoom/2` };
}
