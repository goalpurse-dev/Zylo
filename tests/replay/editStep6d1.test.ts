// deno-lint-ignore-file no-explicit-any
// Phase 6d-1 — the Edit step's document (src/lib/stickmanEdit.js), its render
// compile (editRender.ts), and the small fixes (one bible build per script;
// narration priced from ElevenLabs' credits).
import { assert, assertEquals } from "jsr:@std/assert@1";
import { buildInitialEdit, moveCut, splitAt, retimeToWords, captionPhrases, captionAt, validateEdit, newTextItem, updateText, snapMs, musicGainAt, speechSpans, motionOf, cameraAt, progressAt, withEnds, setTransition, transitionWindows, autoMix, deleteClip, TRANSITIONS, MIN_CLIP_MS, mixMotions, PAN_SCALE, MOTION_MAX, clipMotion } from "../../src/lib/stickmanEdit.js";
import { compileEdit, musicVolumeExpr } from "../../supabase/functions/_shared/stickman/editRender.ts";
import { decideScenes } from "../../supabase/functions/_shared/stickman/scenes.ts";
import { narrationCost, ELEVENLABS_USD_PER_CREDIT } from "../../supabase/functions/_shared/costLedger.ts";
import { clipGraphV2 } from "../../render-worker/src/motion.mjs";

// 60 words, 400 ms apart; 6 scenes of 4 s.
const words = Array.from({ length: 60 }, (_, i) => ({ i, text: i % 7 === 6 ? `w${i}.` : `w${i}`, startMs: i * 400, endMs: i * 400 + 330 }));
const scenes = Array.from({ length: 6 }, (_, k) => ({ sceneId: `s${k}`, number: k + 1, startMs: k * 4000, narration: `line ${k}`, imageUrl: `https://x/${k}.jpg`, overlay: k === 2 ? { text: "300,000", style: "BIG_STAT", scale: 200, box: { x: 700, y: 100, width: 520, height: 180 }, label: { text: "YEARS", scale: 80, box: { x: 880, y: 280, width: 160, height: 80 } } } : null, camera: k === 1 ? "slow push in" : null }));
const doc0 = buildInitialEdit({ scenes, words, audio: { url: "https://x/a.mp3", durationMs: 24000 }, narrationId: "n1" });

Deno.test("initial edit: one clip per scene from 0, the scene text becomes a text item, motion from the plan", () => {
  assertEquals(doc0.clips.map((c: any) => c.startMs), [0, 4000, 8000, 12000, 16000, 20000]);
  // New edits start on the camera Mix; the scene with the big stat zooms in slowly.
  assertEquals(doc0.motion, { mode: "mix", intensity: "normal" });
  assertEquals([doc0.clips[2].motion, doc0.clips[2].motionSpeed], ["push_in", 0.5]);
  assertEquals(doc0.texts.length, 1);
  assertEquals([doc0.texts[0].style, doc0.texts[0].text, doc0.texts[0].startMs, doc0.texts[0].endMs], ["BIG_STAT", "300,000 YEARS", 8000, 12000]);
  assertEquals(validateEdit(doc0), []);
});

Deno.test("move a cut: snaps to a word start, both sides keep 1.5 s; split at the playhead: a new half that needs its picture", () => {
  const moved = moveCut(doc0, 2, 9130, words);
  assertEquals(moved.clips[2].startMs, 9200); // nearest word start
  const clamped = moveCut(doc0, 2, 4200, words);
  assert(clamped.clips[2].startMs - clamped.clips[1].startMs >= MIN_CLIP_MS);
  assertEquals(snapMs(1010, [1000, 2000], 50), 1000);
  const r = splitAt(doc0, 14000, words);
  assertEquals(r.doc.clips.length, 7);
  const half = r.doc.clips.find((c: any) => c.id === r.clipId);
  assertEquals([half.startMs, half.needsImage, half.image], [14000, true, doc0.clips[3].image]);
  assert(splitAt(doc0, 1000, [{ i: 0, text: "a", startMs: 0, endMs: 100 }]).error, "too short to split");
  assertEquals(validateEdit(r.doc), []);
});

Deno.test("a new voiceover re-times the cuts by word, pictures and texts follow", () => {
  const slower = words.map((w) => ({ ...w, startMs: w.startMs * 1.5, endMs: w.endMs * 1.5 }));
  const re = retimeToWords(doc0, slower, { url: "https://x/b.mp3", durationMs: 36000 }, "n2");
  assertEquals(re.clips.map((c: any) => c.startMs), [0, 6000, 12000, 18000, 24000, 30000]);
  assertEquals(re.clips.map((c: any) => c.image), doc0.clips.map((c: any) => c.image));
  assertEquals([re.texts[0].startMs, re.audio.narrationId], [12000, "n2"]);
});

Deno.test("text styles, captions, music ducking, motion maths", () => {
  const t = newTextItem("BIG_STAT", 1000);
  assertEquals([t.label.text, t.label.scale], ["YEARS", Math.round(230 * 0.4)]);
  const d = { ...doc0, texts: [t] };
  const q = updateText(d, t.id, { style: "QUESTION" }).texts[0];
  assert(!q.label, "only a big stat has a label");
  assert(updateText(d, t.id, { style: "CALLOUT" }).texts[0].arrow, "a callout gets an arrow");
  const ph = captionPhrases(words, { 3: "EDITED" });
  assert(ph.every((p: any) => p.words.length <= 4));
  assertEquals(ph[0].words[3].text, "EDITED");
  assertEquals(captionAt(ph, 850)?.active, 2);
  const spans = speechSpans(words);
  assertEquals(spans.length, 1); // no pause over 700 ms
  assertEquals(musicGainAt({ url: "u", volume: 0.5, duck: true }, spans, 1000), 0.5 * 0.28);
  assertEquals(musicGainAt({ url: "u", volume: 0.5, duck: true }, spans, 30000), 0.5);
  const m = motionOf("pan_left", 4000);
  assert(m.from.cx > m.to.cx && m.from.scale === PAN_SCALE); // pans sit on the 5 % base zoom
  const clip = { startMs: 0, endMs: 4000 };
  assertEquals(cameraAt(m, progressAt(clip, 3999)).cx, m.to.cx); // the last frame ends on the move's end (as FFmpeg's on/(n-1))
});

Deno.test("render compile: frames, overlays on exact frames, captions per word, the fade, the music expression", () => {
  const d = { ...doc0, captions: { enabled: true, style: "highlight", edits: {} }, transition: { kind: "fade", ms: 200 }, music: { url: "https://x/m.mp3", volume: 0.4, duck: true } };
  const edl = compileEdit(d, words);
  assertEquals(edl.totalFrames, 720);
  assertEquals(edl.clips.map((c) => c.frames).reduce((a, b) => a + b, 0), 720);
  const c2 = edl.clips[2];
  const txt = c2.overlays.find((o) => o.key.startsWith("text-"))!;
  assertEquals([txt.fromFrame, txt.toFrame], [0, 120]);
  assert(Object.keys(edl.overlays).filter((k) => k.startsWith("cap-")).length === 60, "one caption state per word (highlight)");
  // The old "Quick fade" default is now a 6-frame xfade centred on every cut; the pieces cover the voice exactly.
  const xf = edl.pieces.filter((p) => p.kind === "xfade");
  assertEquals(xf.length, 5);
  assertEquals(edl.pieces.reduce((a, p) => a + p.frames, 0), 720);
  assertEquals(xf.map((p) => [p.fromFrame, p.toFrame, p.xfade]), [[117, 123, "fade"], [237, 243, "fade"], [357, 363, "fade"], [477, 483, "fade"], [597, 603, "fade"]]);
  const g = clipGraphV2(c2);
  assert(g.includes("overlay=0:0:format=auto:enable='between(n,0,119)'"), g.slice(0, 300));
  assertEquals(musicVolumeExpr(edl.music!), "if(gt(between(t,0.000,23.930),0),0.1120,0.4)");
});

Deno.test("transitions: per cut, windows centred on the cut and frame-exact, auto mix by section / reveal (<= 1 per 20 s, dip into the outro), delete a scene", () => {
  let d: any = setTransition(doc0, doc0.clips[2].id, "flash");
  d = setTransition(d, doc0.clips[4].id, "circle");
  const ends = withEnds(d);
  const w = transitionWindows(d, ends);
  assertEquals(w.map((x: any) => [x.index, x.kind, x.startFrame, x.endFrame]), [[2, "flash", 237, 243], [4, "circle", 474, 486]]);
  assert(w.every((x: any) => x.cutFrame - x.startFrame === Math.floor(x.frames / 2)));
  const edl = compileEdit(d, words);
  assertEquals(edl.pieces.reduce((a, p) => a + p.frames, 0), 720); // the voice's frames: transitions never move it
  assertEquals(Object.keys(TRANSITIONS).map((k) => TRANSITIONS[k].xfade), [null, "fade", "slideleft", "zoomin", "fade", "slideleft", "slideright", "fadeblack", "circleopen"]);
  // Auto mix on a 60 s, 30-clip plan: 3 sections (0-20, 20-40, 40-60 s), a reveal at 30 s.
  const clips = Array.from({ length: 30 }, (_, k) => ({ id: `c${k}`, beatSequence: k + 1, startMs: k * 2000, startWord: 0, image: "x", motion: "hold" }));
  const long: any = { ...doc0, audio: { ...doc0.audio, durationMs: 60000 }, clips };
  const sections = Object.fromEntries(clips.map((c) => [c.beatSequence, c.startMs < 20000 ? "open" : c.startMs < 40000 ? "middle" : "outro"]));
  const mixed = autoMix(long, sections, [16]);
  const non = Object.entries(mixed.transitions).filter(([, k]) => k !== "cut");
  assertEquals(non, [["c10", "whip"], ["c20", "dip"]]); // the reveal at 30 s is < 20 s after the whip at 20 s
  const del = deleteClip(doc0, doc0.clips[1].id);
  assertEquals(del.clips.map((c: any) => c.startMs), [0, 8000, 12000, 16000, 20000]);
  assertEquals(deleteClip(doc0, doc0.clips[0].id).clips[0].startMs, 0);
});

Deno.test("bible: the lock's build in flight is THE build (never a second paid build); a dead or failed one is resumed", () => {
  const base: any = { now: "2026-09-29T10:10:00Z", scenes: { status: "running", startedAt: "2026-09-29T10:05:00Z", dispatched: {} }, bible: null, plan: null, images: { queued: 0, rendering: 0, renderingExpired: [], ready: 0, failed: 0, total: 0 }, tier: "V3" };
  // Started 5 min ago by the lock (past the old 150 s budget): wait, don't build again.
  assertEquals(decideScenes({ ...base, bibleBuild: { startedAt: "2026-09-29T10:05:00Z", ended: null, endedAt: null } }).action.kind, "wait");
  // Nothing started: build.
  assertEquals(decideScenes(base).action.kind, "build_bible");
  // Started 10 min ago, never ended: dead -> resume.
  assertEquals((decideScenes({ ...base, bibleBuild: { startedAt: "2026-09-29T10:00:00Z", ended: null, endedAt: null } }).action as any).resume, true);
  // Failed: resume.
  assertEquals((decideScenes({ ...base, scenes: { ...base.scenes, dispatched: { bible: "2026-09-29T10:06:00Z" } }, bibleBuild: { startedAt: "2026-09-29T10:06:00Z", ended: "failed", endedAt: "2026-09-29T10:07:00Z" } }).action as any).resume, true);
});

Deno.test("narration cost = ElevenLabs' own credits x $0.0002 (config)", () => {
  assertEquals(ELEVENLABS_USD_PER_CREDIT, 0.0002);
  assertEquals(narrationCost(8332, 1666), { usd: 0.3332, credits: 1666, estimated: false });
  assertEquals(narrationCost(1000, null), { usd: 0.04, credits: 200, estimated: true });
});

Deno.test("camera Mix: deterministic per project, never 3 same moves in a row, text = static/slow zoom in, reveals zoom in, pans toward the subject, ~50/40/10", () => {
  const clips = Array.from({ length: 200 }, (_, k) => ({ id: `c${k}`, beatSequence: k + 1, startMs: k * 3000, startWord: 0, image: "x", motion: "hold" }));
  const base: any = { ...doc0, audio: { ...doc0.audio, durationMs: 600000 }, clips, texts: [{ id: "t", text: "300,000 YEARS", style: "BIG_STAT", startMs: 30000, endMs: 33000, x: 960, y: 200, scale: 200 }, { id: "q", text: "WHY?", style: "QUESTION", startMs: 60000, endMs: 63000, x: 960, y: 200, scale: 150 }] };
  const a = mixMotions(base, { seed: "project-1", reveals: [50], sides: { 70: "left", 71: "right" } });
  const b = mixMotions(base, { seed: "project-1", reveals: [50], sides: { 70: "left", 71: "right" } });
  const other = mixMotions(base, { seed: "project-2", reveals: [50], sides: { 70: "left", 71: "right" } });
  assertEquals(a.clips.map((c: any) => c.motion), b.clips.map((c: any) => c.motion));
  assert(other.clips.some((c: any, i: number) => c.motion !== a.clips[i].motion), "another project gets another mix");
  for (let i = 2; i < a.clips.length; i++) assert(!(a.clips[i].motion === a.clips[i - 1].motion && a.clips[i].motion === a.clips[i - 2].motion), `run at ${i}`);
  assertEquals([a.clips[10].motion, a.clips[10].motionSpeed], ["push_in", 0.5]); // a big stat: slow zoom in
  assert(["push_in", "hold"].includes(a.clips[20].motion) && a.clips[20].motionSpeed === 0.5); // text: readable
  assertEquals(a.clips[49].motion, "push_in"); // the reveal
  assertEquals([a.clips[69].motion, a.clips[70].motion], ["pan_left", "pan_right"]); // toward the subject
  const n = (f: (m: string) => boolean) => a.clips.filter((c: any) => f(c.motion)).length / a.clips.length;
  const zoom = n((m) => m === "push_in" || m === "pull_out"), pan = n((m) => m.startsWith("pan")), still = n((m) => m === "hold");
  assert(zoom > 0.38 && zoom < 0.62 && pan > 0.28 && pan < 0.52 && still < 0.2, JSON.stringify({ zoom, pan, still }));
  // A user's own per-scene move survives a re-mix.
  const manual = { ...a, clips: a.clips.map((c: any, i: number) => (i === 5 ? { ...c, motion: "pull_out", motionManual: true } : c)) };
  assertEquals(mixMotions(manual, { seed: "project-1" }).clips[5].motion, "pull_out");
  // Speeds: <= 6 % total; subtle is slower; a 3 s clip at half speed moves 1.5 %.
  const long = { ...a, clips: a.clips.map((c: any) => ({ ...c, endMs: c.startMs + 60000 })) };
  assert(clipMotion(long, { ...long.clips[0], motion: "push_in", motionSpeed: 1 }).to.scale <= 1 + MOTION_MAX);
  assertEquals(clipMotion(a, { startMs: 0, endMs: 3000, motion: "push_in", motionSpeed: 0.5 }).to.scale, 1.015);
});

Deno.test("flash is photosensitivity-safe: never two within 3 s (the later plays as a fade), Auto mix uses it at most twice", () => {
  const clips = Array.from({ length: 6 }, (_, k) => ({ id: `c${k}`, beatSequence: k + 1, startMs: k * 2000, startWord: 0, image: "x", motion: "hold" }));
  const d: any = { ...doc0, audio: { ...doc0.audio, durationMs: 12000 }, clips, transitions: { c1: "flash", c2: "flash", c4: "flash" } };
  const w = transitionWindows(d, withEnds(d));
  assertEquals(w.map((x: any) => [x.index, x.kind]), [[1, "flash"], [2, "fade"], [4, "flash"]]);
  assertEquals(TRANSITIONS.flash.veil, { color: "#F5F2EA", opacity: 0.7 });
  const many = Array.from({ length: 60 }, (_, k) => ({ id: `m${k}`, beatSequence: k + 1, startMs: k * 25000, startWord: 0, image: "x", motion: "hold" }));
  const long: any = { ...doc0, audio: { ...doc0.audio, durationMs: 60 * 25000 }, clips: many };
  const mixed = autoMix(long, Object.fromEntries(many.map((c) => [c.beatSequence, `s${c.beatSequence}`])), []);
  assertEquals(Object.values(mixed.transitions).filter((k) => k === "flash").length, 2);
});
