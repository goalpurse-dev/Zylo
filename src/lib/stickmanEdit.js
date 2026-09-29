// stickmanEdit.js — Phase 6d-1. The Stickman EDIT document: the single source
// of truth for the Edit step AND the render. Plain JS (no deps) so the editor
// (browser), the edge functions and the render compiler (Deno) and the tests
// all use the same maths.
//
// A doc:
//   clips      — the scene track: contiguous, [startMs, next.startMs); the last
//                clip runs to the end of the voice. Each clip: image (16:9,
//                never cropped), motion (push_in / pan_left / pan_right / hold
//                / pull_out), the word index of its first word (so a new
//                voiceover re-times the cuts), and `needsImage` for a split half.
//   texts      — the text track: {text, style, startMs, endMs, x, y, scale,
//                label?, arrow?} in 1920x1080 coordinates (centre of the words).
//   captions   — {enabled, style: highlight|simple|boxed, edits: {wordIndex: text}}
//   music      — {trackId, url, name, volume, duck}
//   transition — {kind: cut|fade, ms}
export const EDIT_VERSION = "STICKMAN_EDIT_V1";
export const EDIT_FPS = 30;
export const MIN_CLIP_MS = 1500;
export const SNAP_MS = 220; // pull to a word / cut / the playhead within this
export const MOTIONS = ["push_in", "pull_out", "pan_left", "pan_right", "hold"];
export const MOTION_LABELS = { push_in: "Zoom in", pull_out: "Zoom out", pan_left: "Pan left", pan_right: "Pan right", hold: "Static" };
export const TEXT_STYLES = ["HEADLINE", "BIG_STAT", "QUESTION", "CALLOUT"];
export const TEXT_STYLE_LABELS = { HEADLINE: "Headline", BIG_STAT: "Big stat", QUESTION: "Question", CALLOUT: "Callout" };
export const TEXT_FILL = { HEADLINE: "#FFD21F", BIG_STAT: "#FFD21F", QUESTION: "#FFFFFF", CALLOUT: "#FFD21F" };
export const CAPTION_STYLES = ["highlight", "simple", "boxed"];
export const CAPTION_STYLE_LABELS = { highlight: "Bold word highlight", simple: "Simple white", boxed: "Boxed" };
export const CAPTION_Y = 945, CAPTION_SCALE = 62;
export const MUSIC_DUCK = 0.28; // music gain while the voice speaks (x volume)
export const FADE_MS = 200;

let seq = 0;
export const newId = (p = "id") => `${p}_${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------------- words ----------------
// The narration row's segments -> one flat, time-ordered word list (ms).
export function flattenWords(narration) {
  const out = [];
  for (const seg of narration ?? []) for (const w of seg?.words ?? []) {
    const startMs = Math.round(Number(w.start) * 1000), endMs = Math.round(Number(w.end) * 1000);
    if (Number.isFinite(startMs) && Number.isFinite(endMs)) out.push({ text: String(w.word ?? ""), startMs, endMs });
  }
  out.sort((a, b) => a.startMs - b.startMs);
  return out.map((w, i) => ({ ...w, i }));
}
export function wordAt(words, ms) {
  let lo = 0, hi = words.length - 1, f = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (words[m].startMs <= ms) { f = m; lo = m + 1; } else hi = m - 1; }
  return f;
}

// ---------------- motion (the renderer's maths: constant speed, capped) ----------------
// Shared constants: the render worker only interpolates the from/to states
// computed here (linear, frame-exact), so preview and render are one maths.
// Zooms move ~1 %/s of the frame (Subtle ~0.6 %/s), at most 6 % in total.
// Pans sit on a small base zoom (5 %) so the frame never shows an edge, and
// travel at the same constant speed, at most the margin that zoom creates.
export const MOTION_RATE = { normal: 0.01, subtle: 0.006 };
export const MOTION_MAX = 0.06, PAN_SCALE = 1.05;
export const MOTION_MODES = ["push_in", "pull_out", "pan_left", "pan_right", "hold", "mix"];
export const MOTION_MODE_LABELS = { push_in: "Zoom in", pull_out: "Zoom out", pan_left: "Pan left", pan_right: "Pan right", hold: "Static", mix: "Mix" };
const centre = (scale) => ({ scale, cx: 0.5, cy: 0.5 });
const r4 = (v) => Number(v.toFixed(4));
export function motionOf(kind, durationMs, intensity = "normal", speed = 1) {
  const rate = (MOTION_RATE[intensity] ?? MOTION_RATE.normal) * (speed || 1);
  const travel = rate * (durationMs / 1000);
  const push = 1 + r4(Math.min(MOTION_MAX, travel));
  if (kind === "push_in") return { kind, from: centre(1), to: centre(push) };
  if (kind === "pull_out") return { kind, from: centre(push), to: centre(1) };
  if (kind === "pan_left" || kind === "pan_right") {
    const margin = 0.5 - 1 / (2 * PAN_SCALE); // how far the centre can move before an edge shows
    const half = r4(Math.min(margin, travel / 2));
    const [a, b] = kind === "pan_right" ? [0.5 - half, 0.5 + half] : [0.5 + half, 0.5 - half];
    return { kind, from: { scale: PAN_SCALE, cx: a, cy: 0.5 }, to: { scale: PAN_SCALE, cx: b, cy: 0.5 } };
  }
  return { kind: "hold", from: centre(1), to: centre(1) };
}
// A clip's move as the preview AND the render use it.
export const clipMotion = (doc, clip) => motionOf(clip.motion, clip.endMs - clip.startMs, doc.motion?.intensity ?? "normal", clip.motionSpeed ?? 1);
// The crop rectangle (fractions of the source) the camera shows: the one
// number both the preview and the FFmpeg perspective corners come from.
export const cropRect = (cam) => ({ x0: cam.cx - 1 / (2 * cam.scale), x1: cam.cx + 1 / (2 * cam.scale), y0: cam.cy - 1 / (2 * cam.scale), y1: cam.cy + 1 / (2 * cam.scale) });

// Mix: a varied, deterministic camera per scene (seeded by the project id, so
// the preview and the render always agree). Never the same move 3 times in a
// row; a scene with on-screen text holds or zooms in slowly (text stays
// readable); a reveal or a stat zooms in; a subject on one side is panned
// toward; otherwise ~50 % zooms, ~40 % pans, ~10 % static. The user's own
// per-scene choices (motionManual) are kept.
export function seededRandom(seed) {
  let h = 2166136261;
  for (const ch of String(seed ?? "zyvo")) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  let s = h >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function mixMotions(doc, { seed, reveals = [], sides = {} } = {}) {
  const rnd = seededRandom(seed);
  const clips = withEnds(doc);
  const revealSet = new Set(reveals);
  const out = [];
  const pick = (weights) => { let r = rnd() * weights.reduce((a, [, w]) => a + w, 0); for (const [k, w] of weights) { r -= w; if (r <= 0) return k; } return weights[0][0]; };
  clips.forEach((c, i) => {
    if (c.motionManual) { out.push({ motion: c.motion, speed: c.motionSpeed ?? 1 }); return; }
    const texts = (doc.texts ?? []).filter((t) => t.startMs < c.endMs && t.endMs > c.startMs);
    const stat = texts.some((t) => t.style === "BIG_STAT");
    let motion, speed = 1;
    if (texts.length) { motion = stat || rnd() < 0.6 ? "push_in" : "hold"; speed = 0.5; }
    else if (revealSet.has(c.beatSequence)) motion = "push_in";
    else if (sides[c.beatSequence] === "left" || sides[c.beatSequence] === "right") motion = sides[c.beatSequence] === "left" ? "pan_left" : "pan_right";
    else motion = pick([["push_in", 30], ["pull_out", 20], ["pan_left", 20], ["pan_right", 20], ["hold", 10]]);
    // Never the same move three scenes in a row.
    const p1 = out[i - 1]?.motion, p2 = out[i - 2]?.motion;
    if (motion === p1 && motion === p2) motion = ["push_in", "pan_right", "pull_out", "pan_left"].find((m) => m !== motion && !(texts.length && m.startsWith("pan")) && !(texts.length && m === "pull_out")) ?? "hold";
    out.push({ motion, speed });
  });
  return { ...doc, motion: { ...(doc.motion ?? {}), mode: "mix", intensity: doc.motion?.intensity ?? "normal" }, clips: doc.clips.map((c) => { const k = clips.findIndex((x) => x.id === c.id); return c.motionManual ? c : { ...c, motion: out[k].motion, motionSpeed: out[k].speed }; }) };
}
// "Apply to all": one move on every scene (per-scene choices cleared).
export const setAllMotions = (doc, kind) => ({ ...doc, motion: { ...(doc.motion ?? {}), mode: kind }, clips: doc.clips.map((c) => ({ ...c, motion: kind, motionSpeed: 1, motionManual: false })) });
export const setClipMotion = (doc, id, kind) => ({ ...doc, clips: doc.clips.map((c) => (c.id === id ? { ...c, motion: kind, motionSpeed: 1, motionManual: true } : c)) });
export const setIntensity = (doc, intensity) => ({ ...doc, motion: { ...(doc.motion ?? { mode: "custom" }), intensity } });
// The planner's camera words -> an editor motion kind.
export function motionKindFromCamera(camera, index) {
  const c = String(camera ?? "").toLowerCase();
  if (/pull[- ]?back|pull[- ]?out|zoom out/.test(c)) return "pull_out";
  if (/push|zoom in/.test(c)) return "push_in";
  if (/pan/.test(c)) return index % 2 === 0 ? "pan_right" : "pan_left";
  return "hold";
}
// Camera at progress k (0..1) — linear, exactly like the FFmpeg perspective expression.
export function cameraAt(m, k) {
  const t = clamp(k, 0, 1);
  const f = m?.from ?? centre(1), to = m?.to ?? f;
  const lerp = (a, b) => a + (b - a) * t;
  return { scale: lerp(f.scale, to.scale), cx: lerp(f.cx, to.cx), cy: lerp(f.cy, to.cy) };
}
// The frame-exact progress the renderer uses at time ms inside a clip.
export function progressAt(clip, ms, fps = EDIT_FPS) {
  const s = Math.round((clip.startMs * fps) / 1000), e = Math.round((clip.endMs * fps) / 1000);
  const n = Math.max(1, e - s), k = Math.floor((ms * fps) / 1000) - s;
  return n > 1 ? clamp(k / (n - 1), 0, 1) : 0;
}

// ---------------- the doc ----------------
export function withEnds(doc) {
  const clips = [...doc.clips].sort((a, b) => a.startMs - b.startMs);
  return clips.map((c, i) => ({ ...c, endMs: i + 1 < clips.length ? clips[i + 1].startMs : doc.audio.durationMs }));
}
export function clipIndexAt(doc, ms) {
  const cs = doc.clips;
  let f = 0;
  for (let i = 0; i < cs.length; i++) if (cs[i].startMs <= ms) f = i; else break;
  return f;
}

// A text layer from the Scenes step (OverlayLayer, 1920 space) -> a text item.
export function textItemFromLayer(layer, startMs, endMs) {
  if (!layer?.text) return null;
  const b = layer.box;
  return {
    id: newId("txt"), text: layer.label ? `${layer.text} ${layer.label.text}` : layer.text, style: layer.style ?? "HEADLINE", startMs, endMs,
    x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2), scale: layer.scale,
    ...(layer.label ? { label: { text: layer.label.text, y: Math.round(layer.label.box.y + layer.label.box.height / 2), scale: layer.label.scale } } : {}),
    ...(layer.arrow ? { arrow: { ...layer.arrow } } : {}),
    ...(layer.darkBand ? { darkBand: true } : {}),
  };
}

// The first edit of a project: the Scenes step's result, as a doc.
export function buildInitialEdit({ scenes, words, audio, narrationId, seed = null, reveals = [], sides = {} }) {
  const sorted = [...scenes].filter((s) => s.imageUrl).sort((a, b) => a.startMs - b.startMs);
  const clips = sorted.map((s, i) => {
    const startMs = i === 0 ? 0 : s.startMs;
    return { id: newId("clip"), sceneId: s.sceneId ?? null, imageVersion: s.imageVersion ?? null, beatSequence: s.number, startMs, startWord: Math.max(0, wordAt(words, s.startMs + 1)), image: s.imageUrl, narration: s.narration ?? "", motion: motionKindFromCamera(s.camera, i) };
  });
  const ends = withEnds({ clips, audio });
  const texts = sorted.map((s, i) => textItemFromLayer(s.overlay, ends[i].startMs, ends[i].endMs)).filter(Boolean);
  const doc = {
    version: EDIT_VERSION, fps: EDIT_FPS, width: 1920, height: 1080,
    audio: { url: audio.url, durationMs: Math.round(audio.durationMs), narrationId: narrationId ?? null, volume: 1 },
    clips, texts,
    captions: { enabled: false, style: "highlight", edits: {} },
    music: { trackId: null, url: null, name: null, volume: 0.35, duck: true },
    transition: { kind: "cut", ms: FADE_MS },
    motion: { mode: "mix", intensity: "normal" },
  };
  // New edits start on Mix (deterministic per project).
  return mixMotions(doc, { seed, reveals, sides });
}

// ---------------- snapping ----------------
export function snapMs(ms, targets, within = SNAP_MS) {
  let best = ms, d = within + 1;
  for (const t of targets) { const dd = Math.abs(t - ms); if (dd < d) { d = dd; best = t; } }
  return d <= within ? best : ms;
}
export function snapTargets(doc, words, playheadMs, excludeClipId) {
  return [...words.map((w) => w.startMs), ...doc.clips.filter((c) => c.id !== excludeClipId).map((c) => c.startMs), ...(playheadMs != null ? [playheadMs] : [])];
}
// A cut always lands on a word start (the nearest), so a clip never begins mid-word.
const toWordStart = (words, ms) => { if (!words.length) return Math.round(ms); const i = Math.max(0, wordAt(words, ms)); const a = words[i], b = words[i + 1]; return b && Math.abs(b.startMs - ms) < Math.abs(a.startMs - ms) ? b.startMs : a.startMs; };

// ---------------- scene edits ----------------
// Move the cut at the start of clip `index` (>= 1) to ms: snapped to a word,
// both neighbours keep at least MIN_CLIP_MS. Returns the same doc if refused.
export function moveCut(doc, index, ms, words) {
  const cs = [...doc.clips].sort((a, b) => a.startMs - b.startMs);
  if (index < 1 || index >= cs.length) return doc;
  const lo = cs[index - 1].startMs + MIN_CLIP_MS;
  const hi = (index + 1 < cs.length ? cs[index + 1].startMs : doc.audio.durationMs) - MIN_CLIP_MS;
  if (hi < lo) return doc;
  let at = toWordStart(words, clamp(ms, lo, hi));
  if (at < lo || at > hi) { const ok = words.filter((w) => w.startMs >= lo && w.startMs <= hi); if (!ok.length) return doc; at = ok.reduce((b, w) => (Math.abs(w.startMs - ms) < Math.abs(b.startMs - ms) ? w : b)).startMs; }
  cs[index] = { ...cs[index], startMs: at, startWord: Math.max(0, wordAt(words, at + 1)) };
  return { ...doc, clips: cs };
}
// Split the clip under ms at the nearest word start; the new (second) half
// keeps the picture until its own is generated (needsImage).
export function splitAt(doc, ms, words) {
  const cs = [...doc.clips].sort((a, b) => a.startMs - b.startMs);
  const i = clipIndexAt({ clips: cs }, ms);
  const c = cs[i], end = i + 1 < cs.length ? cs[i + 1].startMs : doc.audio.durationMs;
  const cands = words.filter((w) => w.startMs >= c.startMs + MIN_CLIP_MS && w.startMs <= end - MIN_CLIP_MS);
  if (!cands.length) return { doc, error: "This scene is too short to split (each half needs 1.5 s)." };
  const at = cands.reduce((b, w) => (Math.abs(w.startMs - ms) < Math.abs(b.startMs - ms) ? w : b)).startMs;
  const half = { ...c, id: newId("clip"), startMs: at, startWord: Math.max(0, wordAt(words, at + 1)), needsImage: true, splitFrom: c.id, sceneId: null, narration: words.filter((w) => w.startMs >= at && w.startMs < end).map((w) => w.text).join(" ") };
  const first = { ...c, narration: words.filter((w) => w.startMs >= c.startMs && w.startMs < at).map((w) => w.text).join(" ") || c.narration };
  cs.splice(i, 1, first, half);
  return { doc: { ...doc, clips: cs }, clipId: half.id };
}
export const setClip = (doc, id, patch) => ({ ...doc, clips: doc.clips.map((c) => (c.id === id ? { ...c, ...patch } : c)) });

// ---------------- text ----------------
const LABEL_K = 0.4;
// Default geometry per style (1920 space): headline/question up top, a big stat bigger.
export function newTextItem(style, startMs, durationMs = 3000, text) {
  const t = text ?? { HEADLINE: "YOUR HEADLINE", BIG_STAT: "300,000 YEARS", QUESTION: "BUT WHY?", CALLOUT: "LOOK HERE" }[style];
  const base = { id: newId("txt"), text: t, style, startMs: Math.round(startMs), endMs: Math.round(startMs + durationMs) };
  if (style === "BIG_STAT") return withStatLabel({ ...base, x: 960, y: 190, scale: 230 });
  if (style === "CALLOUT") return { ...base, x: 600, y: 300, scale: 84, arrow: { x1: 740, y1: 340, x2: 960, y2: 540, width: 10 } };
  return { ...base, x: 960, y: 180, scale: 150 };
}
// BIG_STAT: the number big, the rest as a small label under it.
export function splitStat(text) {
  const m = String(text ?? "").trim().match(/^([~≈]?\d[\d.,]*%?)\s*(.*)$/);
  return m ? [m[1], m[2].trim()] : [String(text ?? ""), ""];
}
export function withStatLabel(item) {
  if (item.style !== "BIG_STAT") { const { label: _l, ...rest } = item; return rest; }
  const [, label] = splitStat(item.text);
  if (!label) { const { label: _l, ...rest } = item; return rest; }
  const ls = Math.round(item.scale * LABEL_K);
  return { ...item, label: { text: label.toUpperCase(), scale: ls, y: Math.round(item.y + item.scale * 0.62 + ls * 0.6) } };
}
// The words drawn as the main line (a big stat shows only its number there).
export const mainText = (item) => (item.style === "BIG_STAT" && item.label ? splitStat(item.text)[0] : String(item.text ?? "")).toUpperCase();
export function updateText(doc, id, patch) {
  return { ...doc, texts: doc.texts.map((t) => {
    if (t.id !== id) return t;
    let n = { ...t, ...patch };
    if (patch.style === "CALLOUT" && !n.arrow) n.arrow = { x1: n.x + 140, y1: n.y + 40, x2: n.x + 360, y2: n.y + 240, width: 10 };
    if (patch.style && patch.style !== "CALLOUT") { const { arrow: _a, ...rest } = n; n = rest; }
    if (n.startMs > n.endMs - 300) n.endMs = n.startMs + 300;
    return withStatLabel(n);
  }) };
}
export const textsAt = (doc, ms) => doc.texts.filter((t) => ms >= t.startMs && ms < t.endMs);

// ---------------- captions ----------------
// Phrases from the word timings: at most 4 words / 2.4 s, broken at sentence
// ends and pauses; the user's word edits applied.
export function captionPhrases(words, edits = {}) {
  const out = [];
  let cur = [];
  const flush = () => { if (cur.length) out.push({ startMs: cur[0].startMs, endMs: cur[cur.length - 1].endMs, words: cur }); cur = []; };
  for (const w of words) {
    const text = edits[w.i] ?? w.text;
    const prev = cur[cur.length - 1];
    if (prev && (cur.length >= 4 || w.endMs - cur[0].startMs > 2400 || /[.!?]$/.test(prev.text) || w.startMs - prev.endMs > 450)) flush();
    if (String(text).trim()) cur.push({ i: w.i, text, startMs: w.startMs, endMs: w.endMs });
  }
  flush();
  // Each phrase stays up until the next begins (no flicker in short gaps).
  for (let i = 0; i < out.length - 1; i++) if (out[i + 1].startMs - out[i].endMs < 600) out[i].endMs = out[i + 1].startMs;
  return out;
}
export function captionAt(phrases, ms) {
  const p = phrases.find((x) => ms >= x.startMs && ms < x.endMs);
  if (!p) return null;
  let active = -1;
  p.words.forEach((w, j) => { if (ms >= w.startMs) active = j; });
  return { phrase: p, active };
}

// ---------------- music ducking ----------------
// Speech spans (words merged across gaps under 700 ms): the music plays at
// volume x MUSIC_DUCK inside them, full volume in the pauses.
export function speechSpans(words) {
  const spans = [];
  for (const w of words) {
    const last = spans[spans.length - 1];
    if (last && w.startMs - last[1] < 700) last[1] = Math.max(last[1], w.endMs);
    else spans.push([w.startMs, w.endMs]);
  }
  return spans;
}
export function musicGainAt(music, spans, ms) {
  if (!music?.url) return 0;
  const v = clamp(Number(music.volume ?? 0.35), 0, 1);
  return music.duck !== false && spans.some(([a, b]) => ms >= a && ms < b) ? v * MUSIC_DUCK : v;
}

// ---------------- a new voiceover: re-time everything, keep the pictures ----------------
export function retimeToWords(doc, words, audio, narrationId) {
  if (!words.length) return doc;
  const cs = [...doc.clips].sort((a, b) => a.startMs - b.startMs);
  const oldStart = new Map(cs.map((c) => [c.id, c.startMs]));
  let clips = cs.map((c, i) => ({ ...c, startMs: i === 0 ? 0 : (words[Math.min(words.length - 1, c.startWord ?? 0)]?.startMs ?? c.startMs) }));
  // Keep order and the minimum length after re-timing.
  for (let i = 1; i < clips.length; i++) if (clips[i].startMs < clips[i - 1].startMs + MIN_CLIP_MS) clips[i] = { ...clips[i], startMs: clips[i - 1].startMs + MIN_CLIP_MS };
  const map = (ms) => { const i = clipIndexAt({ clips: cs }, ms); const c = cs[i]; return clips[i].startMs + (ms - oldStart.get(c.id)); };
  const texts = doc.texts.map((t) => { const s = map(t.startMs); return { ...t, startMs: s, endMs: s + (t.endMs - t.startMs) }; });
  return { ...doc, clips, texts, audio: { url: audio.url, durationMs: Math.round(audio.durationMs), narrationId: narrationId ?? null } };
}

// ---------------- transitions ----------------
// Per cut (into clip X): doc.transitions[X.id] = kind; doc.transition.kind is
// the default for cuts without their own. Each maps to one FFmpeg xfade
// (whip = slideleft + a horizontal blur). A transition overlaps the two
// PICTURES only, centred on the cut: frames [cut - floor(n/2), +n); the voice
// and every cut time stay exactly where they are.
export const TRANSITIONS = {
  cut: { label: "Hard cut", ms: 0, xfade: null },
  fade: { label: "Quick fade", ms: 200, xfade: "fade" },
  whip: { label: "Whip pan", ms: 250, xfade: "slideleft", blur: true },
  zoom: { label: "Zoom punch", ms: 300, xfade: "zoomin" },
  // Photosensitivity (WCAG 2.3.1): a soft off-white veil at <= 70 %, never two within 3 s.
  flash: { label: "Flash", ms: 200, xfade: "fade", veil: { color: "#F5F2EA", opacity: 0.7 } },
  slide_left: { label: "Slide left", ms: 350, xfade: "slideleft" },
  slide_right: { label: "Slide right", ms: 350, xfade: "slideright" },
  dip: { label: "Dip to black", ms: 400, xfade: "fadeblack" },
  circle: { label: "Circle reveal", ms: 400, xfade: "circleopen" },
};
export const TRANSITION_KINDS = Object.keys(TRANSITIONS);
export const transitionFrames = (kind, fps = EDIT_FPS) => Math.round(((TRANSITIONS[kind]?.ms ?? 0) * fps) / 1000);
export const transitionInto = (doc, clip, index) => (index === 0 ? "cut" : doc.transitions?.[clip.id] ?? (doc.transition?.kind === "fade" ? "fade" : "cut"));
// The transition windows in frames (clips from withEnds). Never longer than a
// third of either clip, so windows never touch.
export const FLASH_GAP_S = 3, AUTO_MIX_MAX_FLASH = 2, ZOOM_FLAT_MAX = 0.8;
// A picture's whiteness where xfade zoomin lands (the central fifth) and over
// the whole frame, from a tiny RGBA sample (64x36): set on each clip by
// long-form-edit. centerFlat = the central fifth's share that is near-white or
// one flat colour.
export function pictureStats(rgba, w, h) {
  const lum = (x, y) => { const i = (y * w + x) * 4; return 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]; };
  const region = (x0, x1, y0, y1) => { const v = []; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) v.push(lum(x, y)); return v; };
  const c = region(Math.floor(w * 0.4), Math.ceil(w * 0.6), Math.floor(h * 0.4), Math.ceil(h * 0.6));
  const med = [...c].sort((a, b) => a - b)[Math.floor(c.length / 2)];
  const all = region(0, w, 0, h);
  const r3 = (v) => Number(v.toFixed(3));
  return { centerFlat: r3(c.filter((l) => l > 215 || Math.abs(l - med) < 10).length / c.length), centerWhite: r3(c.filter((l) => l > 215).length / c.length), frameWhite: r3(all.filter((l) => l > 215).length / all.length) };
}
// A zoom punch into a flat target, or a white target into a white scene,
// fills the frame with blank white (f6ee3eb2 at 120.3 s: 0.71 / 0.67) — whip instead.
export const zoomWouldWhiteOut = (a, b) => Number(a?.centerFlat ?? 0) > ZOOM_FLAT_MAX || (Number(a?.centerWhite ?? 0) > 0.6 && Number(b?.frameWhite ?? 0) > 0.5);
export function transitionWindows(doc, clips, fps = EDIT_FPS) {
  const out = [];
  let lastFlash = -Infinity;
  for (let i = 1; i < clips.length; i++) {
    let kind = transitionInto(doc, clips[i], i);
    // Never two flashes within 3 s: a later one plays as a quick fade.
    const cutAt = Math.round((clips[i].startMs * fps) / 1000);
    if (kind === "flash") { if (cutAt - lastFlash < FLASH_GAP_S * fps) kind = "fade"; else lastFlash = cutAt; }
    // A zoom punch dives into the outgoing picture's centre: a white / flat centre
    // would fill the frame with blank white (f6ee3eb2 at 120.3 s) — whip instead.
    if (kind === "zoom" && zoomWouldWhiteOut(clips[i - 1], clips[i])) kind = "whip";
    let n = transitionFrames(kind, fps);
    if (!n) continue;
    const cut = Math.round((clips[i].startMs * fps) / 1000);
    const aLen = cut - Math.round((clips[i - 1].startMs * fps) / 1000), bLen = Math.round((clips[i].endMs * fps) / 1000) - cut;
    n = Math.min(n, Math.floor(aLen / 3), Math.floor(bLen / 3));
    if (n < 2) continue;
    const start = cut - Math.floor(n / 2);
    out.push({ index: i, kind, cutFrame: cut, startFrame: start, endFrame: start + n, frames: n });
  }
  return out;
}
export const setTransition = (doc, clipId, kind) => ({ ...doc, transitions: { ...(doc.transitions ?? {}), [clipId]: kind } });
export const setAllTransitions = (doc, kind) => ({ ...doc, transition: { kind: "cut", ms: FADE_MS }, transitions: Object.fromEntries(doc.clips.slice(1).map((c) => [c.id, kind])) });
// Auto mix: hard cuts inside a section; a punchy transition (whip / zoom /
// flash, in turn) on a section change or a big reveal, at most one per ~20 s;
// a dip to black into the last section (the outro).
export const AUTO_MIX_GAP_MS = 20000;
export function autoMix(doc, sectionOfBeat = {}, revealBeats = []) {
  const clips = withEnds(doc);
  const sec = (c) => sectionOfBeat[c.beatSequence] ?? null;
  const lastSec = [...clips].reverse().map(sec).find(Boolean) ?? null;
  const outroIndex = lastSec ? clips.findIndex((c) => sec(c) === lastSec) : -1;
  const reveals = new Set(revealBeats);
  const punchy = ["whip", "zoom", "flash"];
  let flashes = 0;
  const transitions = {};
  let last = -Infinity, k = 0;
  clips.forEach((c, i) => {
    if (i === 0) return;
    if (i === outroIndex && outroIndex > 0) { transitions[c.id] = "dip"; last = c.startMs; return; }
    const change = sec(c) && sec(c) !== sec(clips[i - 1]);
    if ((change || reveals.has(c.beatSequence)) && c.startMs - last >= AUTO_MIX_GAP_MS) {
      let pickKind = punchy[k++ % punchy.length];
      if (pickKind === "flash" && flashes >= AUTO_MIX_MAX_FLASH) pickKind = punchy[k++ % punchy.length];
      if (pickKind === "flash") flashes++;
      transitions[c.id] = pickKind; last = c.startMs;
    }
    else transitions[c.id] = "cut";
  });
  return { ...doc, transition: { kind: "cut", ms: FADE_MS }, transitions };
}

// Delete a scene: its time goes to the scene before (or the next one, for the first).
export function deleteClip(doc, id) {
  const cs = [...doc.clips].sort((a, b) => a.startMs - b.startMs);
  const i = cs.findIndex((c) => c.id === id);
  if (i < 0 || cs.length < 2) return doc;
  if (i === 0) cs[1] = { ...cs[1], startMs: 0, startWord: 0 };
  cs.splice(i, 1);
  const { [id]: _gone, ...transitions } = doc.transitions ?? {};
  return { ...doc, clips: cs, transitions };
}

// ---------------- validation (server and client) ----------------
export function validateEdit(doc) {
  const errors = [];
  if (doc?.version !== EDIT_VERSION) errors.push("unknown version");
  const cs = doc?.clips ?? [];
  if (!cs.length) errors.push("no clips");
  if (cs[0] && cs[0].startMs !== 0) errors.push("the first clip must start at 0");
  for (let i = 1; i < cs.length; i++) if (cs[i].startMs < cs[i - 1].startMs + MIN_CLIP_MS - 1) errors.push(`clip ${i + 1} is shorter than 1.5 s or out of order`);
  if (cs.length && doc.audio.durationMs - cs[cs.length - 1].startMs < MIN_CLIP_MS - 1) errors.push("the last clip is shorter than 1.5 s");
  for (const c of cs) { if (!MOTIONS.includes(c.motion)) errors.push(`clip ${c.id}: bad motion`); if (!c.image) errors.push(`clip ${c.id}: no image`); }
  for (const t of doc?.texts ?? []) {
    if (!TEXT_STYLES.includes(t.style)) errors.push(`text ${t.id}: bad style`);
    if (!(t.endMs > t.startMs)) errors.push(`text ${t.id}: bad times`);
    if (String(t.text ?? "").trim().split(/\s+/).length > 8) errors.push(`text ${t.id}: over 8 words`);
  }
  if (doc?.captions && !CAPTION_STYLES.includes(doc.captions.style)) errors.push("bad caption style");
  if (doc?.transition && !["cut", "fade"].includes(doc.transition.kind)) errors.push("bad transition");
  for (const [id, k] of Object.entries(doc?.transitions ?? {})) if (!TRANSITIONS[k]) errors.push(`transition ${id}: unknown kind`);
  return errors;
}
