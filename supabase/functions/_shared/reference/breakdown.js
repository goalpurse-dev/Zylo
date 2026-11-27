// REFERENCE VIDEOS AND IMAGES (owner 2026-11-26): what a scanned reference video becomes, and how it is used. Plain JS,
// read by the scan worker (render-worker/src/scan), the reference-api function, the Director, Maestro and the pages.
//
// The scan (worker, once per file hash) produces a Reference breakdown:
//   { v, source: { kind, hash, seconds, width, height }, shots: [{ i, start, end, seconds, keyframes, what, camera }],
//     stats: { seconds, shots, avgShot, medianShot, wordsPerSec, pauses, longestPause },
//     audio: { voice, music, sfx, loudness }, transcript: { words, text },
//     look: { palette, lighting, style }, captions: { present, size, position, wordsAtATime },
//     hook: { text, firstSeconds, kind }, structure: [{ part, start, end, what }], cost: { usd, parts } }
// The user chooses what to copy (COPY_PARTS); the story is always new unless "Topic" is on.

export const REFERENCE = Object.freeze({
  maxVideoSec: 180,
  maxVideoBytes: 100 * 1024 * 1024,
  videoTypes: Object.freeze(["video/mp4", "video/quicktime", "video/webm"]),
  maxImages: 6,
  imageRoles: Object.freeze(["style", "character", "place", "product"]),
  keepFilesHours: 72, // uploaded / imported files are deleted after this; the breakdown JSON stays
  scansPerDay: Object.freeze({ free: 2, paid: 20 }),
  linkHosts: Object.freeze(["tiktok.com", "www.tiktok.com", "vm.tiktok.com", "youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "instagram.com", "www.instagram.com"]),
  sceneThreshold: 0.3, // ffmpeg scene score for a cut
  minShotSec: 0.25,
  pauseSec: 0.6,       // a gap between words this long is a pause
  silenceDb: -40,
});

// what the user can copy; all on but Topic: copy the style, not the story
export const COPY_PARTS = Object.freeze([
  { id: "pacing", label: "Pacing", on: true },
  { id: "camera", label: "Camera", on: true },
  { id: "look", label: "Look", on: true },
  { id: "captions", label: "Captions", on: true },
  { id: "structure", label: "Structure", on: true },
  { id: "topic", label: "Topic", on: false },
]);
export const defaultCopy = () => Object.fromEntries(COPY_PARTS.map((p) => [p.id, p.on]));

/** a pasted link we can import (public TikTok, YouTube Shorts, Instagram), normalized; null if not */
export function referenceLink(raw) {
  let u;
  try { u = new URL(String(raw ?? "").trim()); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.toLowerCase();
  if (!REFERENCE.linkHosts.includes(host)) return null;
  const site = host.includes("tiktok") ? "tiktok" : host.includes("instagram") ? "instagram" : "youtube";
  u.hash = "";
  for (const k of [...u.searchParams.keys()]) if (!(site === "youtube" && k === "v")) u.searchParams.delete(k);
  return { site, url: u.toString() };
}

/** can this account scan another video today? { ok, left, limit } */
export function scanAllowance({ paid, scansToday }) {
  const limit = paid ? REFERENCE.scansPerDay.paid : REFERENCE.scansPerDay.free;
  const left = Math.max(0, limit - Number(scansToday || 0));
  return { ok: left > 0, left, limit };
}

// ------------------------------------------------------------------ shots and stats from the raw scan
/** cut times (s) + the video length -> shots with their lengths (very short flickers merge into the next shot) */
export function shotsFromCuts(cuts, seconds) {
  const times = [...new Set(cuts.map(Number).filter((t) => t > 0 && t < seconds))].sort((a, b) => a - b);
  const shots = [];
  let start = 0;
  for (const t of [...times, seconds]) {
    if (t - start < REFERENCE.minShotSec && t !== seconds) continue;
    shots.push({ i: shots.length + 1, start: round2(start), end: round2(t), seconds: round2(t - start) });
    start = t;
  }
  if (shots.length > 1 && shots.at(-1).seconds < REFERENCE.minShotSec) { const last = shots.pop(); shots.at(-1).end = last.end; shots.at(-1).seconds = round2(last.end - shots.at(-1).start); }
  return shots;
}
const round2 = (n) => Math.round(Number(n) * 100) / 100;

/** words [{ word, start, end }] -> { wordsPerSec, pauses, longestPause } over the time someone is talking */
export function speechStats(words) {
  const w = (words ?? []).filter((x) => Number.isFinite(x.start) && Number.isFinite(x.end));
  if (w.length < 2) return { wordsPerSec: 0, pauses: 0, longestPause: 0 };
  const span = w.at(-1).end - w[0].start;
  let pauses = 0, longest = 0;
  for (let i = 1; i < w.length; i++) { const gap = w[i].start - w[i - 1].end; if (gap >= REFERENCE.pauseSec) { pauses++; longest = Math.max(longest, gap); } }
  return { wordsPerSec: span > 0 ? round2(w.length / span) : 0, pauses, longestPause: round2(longest) };
}

export function shotStats(shots, seconds) {
  const lens = shots.map((s) => s.seconds).sort((a, b) => a - b);
  const median = lens.length ? (lens.length % 2 ? lens[(lens.length - 1) / 2] : (lens[lens.length / 2 - 1] + lens[lens.length / 2]) / 2) : 0;
  return { seconds: round2(seconds), shots: shots.length, avgShot: shots.length ? round2(seconds / shots.length) : 0, medianShot: round2(median) };
}

/** plain words for the card: "fast" / "steady" / "slow" cutting and talking */
export function paceWords(stats) {
  const cut = stats.avgShot <= 1.2 ? "very fast cuts" : stats.avgShot <= 2.5 ? "fast cuts" : stats.avgShot <= 5 ? "steady cuts" : "long takes";
  const talk = !stats.wordsPerSec ? "no talking" : stats.wordsPerSec >= 3.2 ? "fast talking" : stats.wordsPerSec >= 2.3 ? "normal talking" : "slow talking";
  return `${cut}, ${talk}`;
}

// ------------------------------------------------------------------ never copy the creator's own marks
const HANDLE = /(^|\s)@[\w.]{2,30}/g;
const WATERMARK_WORDS = /\b(tiktok|youtube|instagram|reels|shorts|capcut|follow( me)?|subscribe|link in bio)\b/gi;
/** on-screen text / transcript lines with handles, platform marks and creator names removed */
export function scrubCreatorMarks(text, extraNames = []) {
  let t = String(text ?? "").replace(HANDLE, " ").replace(WATERMARK_WORDS, " ");
  for (const n of extraNames.filter(Boolean)) t = t.replace(new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), " ");
  return t.replace(/\s{2,}/g, " ").trim();
}

// ------------------------------------------------------------------ how the Director uses it
/**
 * The planner's notes from a breakdown and the user's copy choices. Rhythm and style only: the reference's own words,
 * names, characters and watermarks never reach the plan (unless Topic is on, then only its subject in a few words).
 */
export function directorNotes(b, copy = defaultCopy()) {
  if (!b?.stats) return "";
  const L = ["REFERENCE VIDEO (the user wants it to FEEL like this; tell a NEW story from their idea; never reuse its words, names, characters, logos or watermark):"];
  if (copy.pacing) L.push(`- Pacing: about ${b.stats.shots} shots in ${Math.round(b.stats.seconds)} s (average ${b.stats.avgShot} s a shot). ${b.stats.wordsPerSec ? `Narration about ${b.stats.wordsPerSec} words a second${b.stats.pauses ? `, ${b.stats.pauses} short pauses` : ", no pauses"}.` : "No narration."} Scale the number of scenes to the target length with the same rhythm.`);
  if (copy.structure && b.structure?.length) L.push(`- Structure: ${b.structure.map((p) => `${p.part} (${p.what})`).join(" → ")}. Hook in the first 2 s: ${b.hook?.kind ?? "a strong opening line"}.`);
  if (copy.camera) { const moves = [...new Set((b.shots ?? []).map((s) => s.camera?.move).filter(Boolean))]; if (moves.length) L.push(`- Camera: ${moves.slice(0, 5).join(", ")}; mostly ${mostCommon((b.shots ?? []).map((s) => s.camera?.angle)) ?? "eye level"} shots.`); }
  if (copy.look && b.look) L.push(`- Look: ${[b.look.style, b.look.lighting, b.look.palette].filter(Boolean).join("; ")}.`);
  if (copy.captions && b.captions?.present) L.push(`- Captions: ${b.captions.size ?? "large"} text, ${b.captions.position ?? "lower middle"}, ${b.captions.wordsAtATime ?? 2} word(s) at a time.`);
  if (copy.topic && b.hook?.topic) L.push(`- Topic: the same subject (${scrubCreatorMarks(b.hook.topic).slice(0, 80)}), told in a new way.`);
  return L.join("\n");
}
const mostCommon = (xs) => { const m = new Map(); for (const x of xs.filter(Boolean)) m.set(x, (m.get(x) ?? 0) + 1); return [...m].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null; };

/** the scene count the plan should aim for with Pacing on (the reference's rhythm at the target length), else null */
export function scenesFromReference(b, lengthSec, copy = defaultCopy()) {
  if (!copy.pacing || !b?.stats?.avgShot) return null;
  return Math.max(2, Math.min(40, Math.round(lengthSec / Math.max(0.8, b.stats.avgShot))));
}

// ------------------------------------------------------------------ the tuned engines: only inside their own ranges
// In This Town and Cutaway are tuned; a reference may only move them within these ranges (owner: quality stays safe).
export const ENGINE_RANGES = Object.freeze({
  town: Object.freeze({ shotSec: [2.5, 6], wordsPerSec: [2.3, 3.2], captionSize: ["medium", "large"], captionPosition: ["lower", "middle"], lighting: ["day", "golden", "dusk", "night"] }),
  cutaway: Object.freeze({ shotSec: [2, 5], wordsPerSec: [2.2, 3.0], captionSize: ["medium", "large"], captionPosition: ["lower", "middle"], lighting: ["day", "golden"] }),
});
const clamp = (x, [lo, hi]) => Math.min(hi, Math.max(lo, x));
const pick = (want, allowed) => (allowed.includes(want) ? want : allowed[0]);
/** the engine's settings from a breakdown, every one clamped to the template's range ({} for other templates) */
export function engineSettings(engine, b, copy = defaultCopy()) {
  const r = ENGINE_RANGES[engine];
  if (!r || !b?.stats) return {};
  const out = {};
  if (copy.pacing) {
    out.shotSec = round2(clamp(b.stats.avgShot || r.shotSec[0], r.shotSec));
    if (b.stats.wordsPerSec) out.wordsPerSec = round2(clamp(b.stats.wordsPerSec, r.wordsPerSec));
  }
  if (copy.captions && b.captions?.present) { out.captionSize = pick(b.captions.size, r.captionSize); out.captionPosition = pick(b.captions.position, r.captionPosition); }
  if (copy.look && b.look?.lightingMood) out.lighting = pick(b.look.lightingMood, r.lighting);
  return out;
}

/** In This Town's script note (its writer takes a note): the rhythm and structure in words, inside its 60-80 s range */
export function townNote(b, copy = defaultCopy()) {
  const s = engineSettings("town", b, copy);
  const parts = [];
  if (s.shotSec) parts.push(`short scenes of about ${s.shotSec} seconds each`);
  if (s.wordsPerSec) parts.push(`narration at about ${s.wordsPerSec} words a second`);
  if (copy.structure && b?.structure?.length) parts.push(`the arc ${b.structure.map((p) => p.part).join(" → ")}`);
  if (copy.structure && b?.hook?.kind) parts.push(`a hook like: ${b.hook.kind}`);
  return parts.length ? `Match the feel of the user's reference video: ${parts.join("; ")}. New story, new words.` : "";
}

// ------------------------------------------------------------------ what the card shows
export function cardSummary(b) {
  if (!b?.stats) return null;
  return {
    seconds: Math.round(b.stats.seconds), shots: b.stats.shots, avgShot: b.stats.avgShot, pace: paceWords(b.stats),
    hook: b.hook?.text ? scrubCreatorMarks(b.hook.text).slice(0, 120) : b.hook?.kind ?? null,
    structure: (b.structure ?? []).map((p) => p.part).join(" → ") || null,
    look: [b.look?.style, b.look?.lighting].filter(Boolean).join(", ") || null,
    captions: b.captions?.present ? `${b.captions.size ?? ""} ${b.captions.position ?? ""}, ${b.captions.wordsAtATime ?? "?"} word(s) at a time`.trim() : "none",
    music: b.audio ? [b.audio.voice ? "voice" : null, b.audio.music ? "music" : null, b.audio.sfx ? "sound effects" : null].filter(Boolean).join(" + ") || "quiet" : null,
    thumbs: (b.shots ?? []).slice(0, 24).map((s) => s.keyframes?.[1] ?? s.keyframes?.[0]).filter(Boolean),
  };
}

/** a reference image's role, guessed from what the file is (the user can change it with one tap) */
export function guessImageRole({ width, height, hasAlpha, name = "" }) {
  const n = String(name).toLowerCase();
  if (hasAlpha || /logo|brand|product|packshot/.test(n)) return "product";
  if (/char|person|face|avatar|me\b|selfie/.test(n)) return "character";
  if (/place|room|street|scene|background|bg/.test(n)) return "place";
  if (width && height && width / height > 1.4) return "place";
  return "style";
}
