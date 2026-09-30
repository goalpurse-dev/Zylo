// AI Fruit Story v2 final video: trim window, caption wrap, ffmpeg args (offline).
import test from "node:test";
import assert from "node:assert/strict";
import { KEEP_SEC, MIN_CLIP_SEC, parseSilences, segmentArgs, trimWindow, wrapCaption } from "../src/fruitFinalPlan.mjs";

const STDERR = `
[silencedetect @ 0x1] silence_start: 0
[silencedetect @ 0x1] silence_end: 0.84 | silence_duration: 0.84
[silencedetect @ 0x1] silence_start: 2.1
[silencedetect @ 0x1] silence_end: 2.4 | silence_duration: 0.3
[silencedetect @ 0x1] silence_start: 3.9
`;

test("silences parse, and one still open at the end closes at the clip length", () => {
  assert.deepEqual(parseSilences(STDERR, 5), [{ start: 0, end: 0.84 }, { start: 2.1, end: 2.4 }, { start: 3.9, end: 5 }]);
});

test("only leading and trailing silence is cut, keeping 0.25 s each side; pauses inside stay", () => {
  const w = trimWindow(parseSilences(STDERR, 5), 5);
  assert.deepEqual(w, { start: 0.59, end: 4.15, trimmedSec: 1.44 });
  assert.equal(KEEP_SEC, 0.25);
  assert.ok(w.start < 2.1 && w.end > 2.4, "the pause inside the line is kept");
});

test("no speech, or no silence, keeps the whole clip; a tiny line keeps at least 1.2 s", () => {
  assert.deepEqual(trimWindow([{ start: 0, end: 5 }], 5), { start: 0, end: 5, trimmedSec: 0 });
  assert.deepEqual(trimWindow([], 4), { start: 0, end: 4, trimmedSec: 0 });
  const tiny = trimWindow([{ start: 0, end: 2.2 }, { start: 2.5, end: 5 }], 5);
  assert.ok(Math.abs(tiny.end - tiny.start - MIN_CLIP_SEC) < 0.002, JSON.stringify(tiny));
});

test("captions wrap into at most 3 lines and keep every word in order", () => {
  const line = "This is not what it— Gloria, put the phone down.";
  const lines = wrapCaption(line, 20);
  assert.ok(lines.length <= 3 && lines.every((l) => l.length <= 20), lines.join(" | "));
  assert.equal(lines.join(" "), line);
  const long = wrapCaption("word ".repeat(40).trim(), 20);
  assert.ok(long.length <= 3);
});

test("segment args: trimmed, 720p, 30 fps, one centered drawtext per caption line, silent track if no audio", () => {
  const a = segmentArgs({ input: "in.mp4", output: "out.mp4", start: 0.5, end: 3.25, aspect: "9:16", captionFiles: ["/w/c0.txt", "/w/c1.txt"], fontFile: "/f/Lilita.ttf" });
  const vf = a[a.indexOf("-vf") + 1];
  assert.deepEqual(a.slice(a.indexOf("-ss"), a.indexOf("-ss") + 4), ["-ss", "0.500", "-to", "3.250"]);
  assert.match(vf, /^scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280/);
  assert.match(vf, /fps=30/);
  assert.equal((vf.match(/drawtext=/g) ?? []).length, 2);
  assert.match(vf, /textfile='\/w\/c0\.txt'.*x=\(w-text_w\)\/2/);
  assert.ok(a.includes("0:a:0"));
  const silent = segmentArgs({ input: "in.mp4", output: "out.mp4", start: 0, end: 4, aspect: "16:9", hasAudio: false, fontFile: "/f" });
  assert.ok(silent.includes("anullsrc=r=48000:cl=stereo") && silent.includes("1:a:0"));
  assert.doesNotMatch(silent[silent.indexOf("-vf") + 1], /drawtext/);
  assert.match(silent[silent.indexOf("-vf") + 1], /^scale=1280:720/);
});
