// AI Fruit Story v2 final video: trim window, timed captions, ffmpeg args (offline).
import test from "node:test";
import assert from "node:assert/strict";
import { KEEP_SEC, MIN_CLIP_SEC, parseSilences, segmentArgs, trimWindow } from "../src/fruitFinalPlan.mjs";
import { alignWords, buildAss, chunkWords, evenWords, timedWords } from "../src/fruitCaptions.mjs";

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
  assert.deepEqual(w, { start: 0.59, end: 4.15, trimmedSec: 1.44, speech: { start: 0.84, end: 3.9 } });
  assert.equal(KEEP_SEC, 0.25);
  assert.ok(w.start < 2.1 && w.end > 2.4, "the pause inside the line is kept");
});

test("no speech, or no silence, keeps the whole clip; a tiny line keeps at least 1.2 s", () => {
  assert.deepEqual(trimWindow([{ start: 0, end: 5 }], 5), { start: 0, end: 5, trimmedSec: 0, speech: null });
  assert.deepEqual(trimWindow([], 4), { start: 0, end: 4, trimmedSec: 0, speech: { start: 0, end: 4 } });
  const tiny = trimWindow([{ start: 0, end: 2.2 }, { start: 2.5, end: 5 }], 5);
  assert.ok(Math.abs(tiny.end - tiny.start - MIN_CLIP_SEC) < 0.002, JSON.stringify(tiny));
});

test("segment args: trimmed, 720p, 30 fps, captions from an ASS file with the bundled font, silent track if no audio", () => {
  const a = segmentArgs({ input: "in.mp4", output: "out.mp4", start: 0.5, end: 3.25, aspect: "9:16", assFile: "/w/cap-0.ass", fontsDir: "/fonts" });
  const vf = a[a.indexOf("-vf") + 1];
  assert.deepEqual(a.slice(a.indexOf("-ss"), a.indexOf("-ss") + 4), ["-ss", "0.500", "-to", "3.250"]);
  assert.match(vf, /^scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280/);
  assert.ok(vf.endsWith("fps=30,ass='/w/cap-0.ass':fontsdir='/fonts',format=yuv420p"), vf);
  assert.ok(a.includes("0:a:0"));
  const win = segmentArgs({ input: "in.mp4", output: "out.mp4", start: 0, end: 1, aspect: "9:16", assFile: "C:\\t\\cap.ass" });
  assert.ok(win[win.indexOf("-vf") + 1].includes("ass='C\\:/t/cap.ass'"), "Windows paths are escaped for the filter");
  const silent = segmentArgs({ input: "in.mp4", output: "out.mp4", start: 0, end: 4, aspect: "16:9", hasAudio: false });
  assert.ok(silent.includes("anullsrc=r=48000:cl=stereo") && silent.includes("1:a:0"));
  assert.ok(!silent[silent.indexOf("-vf") + 1].includes("ass="));
  assert.match(silent[silent.indexOf("-vf") + 1], /^scale=1280:720/);
});

const LINE = "Nineteen years and you still don't knock, Gloria.";
const TR = [["19", 0.52, 0.9], ["years", 0.9, 1.2], ["and", 1.2, 1.3], ["you", 1.3, 1.42], ["still", 1.42, 1.7], ["don't", 1.7, 1.9], ["knock,", 1.9, 2.3], ["Gloria.", 2.5, 3.1]]
  .map(([word, start, end]) => ({ word, start, end }));

test("captions keep the exact line and take the transcript's word times (numbers and punctuation match)", () => {
  const w = alignWords(LINE, TR);
  assert.deepEqual(w.map((x) => x.text), ["Nineteen", "years", "and", "you", "still", "don't", "knock,", "Gloria."]);
  assert.equal(w[0].start, 0.52);
  assert.equal(w[7].start, 2.5);
  const missing = alignWords(LINE, TR.filter((x) => x.word !== "still"));
  assert.ok(missing[4].start >= missing[3].end - 1e-9 && missing[4].end <= missing[5].start + 1e-9, "an unheard word sits between its neighbours");
  assert.equal(alignWords(LINE, [{ word: "banana", start: 0, end: 1 }]), null, "mostly unmatched: no alignment");
});

test("no usable transcript: the line is spread over the detected speech; nothing starts before speech", () => {
  const t = timedWords(LINE, null, { start: 0.8, end: 3.2 }, 5);
  assert.equal(t.source, "silence");
  assert.equal(t.words[0].start, 0.8);
  assert.ok(Math.abs(t.words.at(-1).end - 3.2) < 1e-9);
  const e = evenWords(["a", "longerword"], 0, 1);
  assert.ok(e[1].end - e[1].start > e[0].end - e[0].start, "longer words get more time");
  assert.equal(timedWords(LINE, TR, null, 5).source, "speech-to-text");
});

test("chunks: 2 to 4 words, short enough for one line, broken after punctuation", () => {
  const chunks = chunkWords(alignWords(LINE, TR));
  assert.deepEqual(chunks.map((c) => c.map((w) => w.text).join(" ")), ["Nineteen years and", "you still don't", "knock, Gloria."]);
  for (const c of chunks) assert.ok(c.length >= 2 && c.length <= 4 && c.map((w) => w.text).join(" ").length <= 18);
});

test("ASS: one line at a time, each chunk from its first word, current word lime, lower third", () => {
  const words = alignWords(LINE, TR);
  const ass = buildAss({ words, width: 720, height: 1280, durationSec: 3.5 });
  const events = ass.split("\n").filter((l) => l.startsWith("Dialogue:"));
  assert.equal(events.length, 8, "one event per word (the highlight moves word by word)");
  assert.ok(events[0].startsWith("Dialogue: 0,0:00:00.52,0:00:00.90,Cap,,0,0,0,,{\\an5\\pos(360,998)\\fs"), events[0]);
  assert.ok(events[0].endsWith("{\\c&H0064F2BE&}Nineteen{\\c&H00FFFFFF&} years and"), events[0]);
  const times = events.map((e) => e.split(",").slice(1, 3));
  for (let i = 1; i < times.length; i++) assert.ok(times[i][0] >= times[i - 1][1], "no two lines on screen at once");
  assert.match(ass, /Style: Cap,Lilita One,79,/);
  const plain = buildAss({ words, width: 720, height: 1280, durationSec: 3.5, highlight: false }).split("\n").filter((l) => l.startsWith("Dialogue:"));
  assert.equal(plain.length, 3);
  assert.ok(!plain.join("").includes("&H0064F2BE&"));
});

// "The Surprise Wedding Switch", clip 2 (Benny): real Whisper words vs the audio.
const BENNY = "Okay, don't freak out, but this might actually be our wedding.";
const BENNY_WORDS = [["Okay", 0, 0.48], ["don't", 0.58, 0.86], ["freak", 0.86, 1.1], ["out", 1.1, 1.44], ["but", 1.68, 1.86], ["this", 1.86, 2.18], ["might", 2.18, 2.42], ["actually", 2.42, 2.96], ["be", 2.96, 3.18], ["our", 3.18, 3.5], ["wedding", 3.5, 3.72]].map(([word, start, end]) => ({ word, start, end }));

test("Whisper's words are stretched onto the measured speech span (Benny talked to 4.57 s, Whisper said 3.72 s)", async () => {
  const { fitToSpan } = await import("../src/fruitCaptions.mjs");
  const { words } = timedWords(BENNY, BENNY_WORDS, { start: 0, end: 4.57 }, 6.04);
  assert.ok(Math.abs(words.at(-1).end - 4.57) < 1e-6, "the last word ends when the audio does");
  assert.equal(words[0].start, 0);
  const late = timedWords(BENNY, BENNY_WORDS, { start: 0.56, end: 4.59 }, 6.04).words;
  assert.ok(Math.abs(late[0].start - 0.56) < 1e-6, "Whisper's 0.00 first word moves to where speech starts");
  assert.deepEqual(fitToSpan(BENNY_WORDS.map((w) => ({ ...w, text: w.word })), { start: 0, end: 0.1 }).length, 11, "a tiny span leaves words as they are");
});

test("no blank while talking: every chunk stays until the next, the last until the clip ends", () => {
  const { words } = timedWords(BENNY, BENNY_WORDS, { start: 0, end: 4.57 }, 6.04);
  const events = buildAss({ words, width: 720, height: 1280, durationSec: 4.82 }).split("\n").filter((l) => l.startsWith("Dialogue:"));
  const span = (e) => e.split(",").slice(1, 3);
  for (let i = 1; i < events.length; i++) assert.equal(span(events[i])[0], span(events[i - 1])[1], `gap before event ${i}`);
  assert.equal(span(events.at(-1))[1], "0:00:04.82", "the last chunk holds to the end of the clip");
});

test("series overlays: 'Part N' at the top for the first seconds, the end card centered in a box at the end", async () => {
  const ass = buildAss({ words: [], width: 720, height: 1280, durationSec: 4, overlays: [
    { kind: "part", text: "Part 2", start: 0, end: 1.5 },
    { kind: "end", text: "Part 3: The Welcome Party\nFollow for more", start: 2, end: 4 },
  ] });
  const events = ass.split("\n").filter((l) => l.startsWith("Dialogue:"));
  assert.equal(events.length, 2);
  assert.ok(events[0].startsWith("Dialogue: 1,0:00:00.00,0:00:01.50,Part,"), events[0]);
  assert.ok(events[0].endsWith(String.raw`{\an8\pos(360,115)}Part 2`));
  assert.ok(events[1].startsWith("Dialogue: 1,0:00:02.00,0:00:04.00,End,"));
  assert.ok(events[1].endsWith(String.raw`Part 3: The Welcome Party\NFollow for more`), events[1]);
  assert.match(ass, /Style: End,Lilita One,61,&H00FFFFFF&,&H00FFFFFF&,&H00000000&,&HB0000000&,0,0,0,0,100,100,1,0,3,/, "BorderStyle 3: a box behind the end card");
});

test("cover: fixed layout, 'EPISODE N' label over the title in capitals, same for every episode", async () => {
  const { coverAss } = await import("../src/fruitCaptions.mjs");
  const a = coverAss({ width: 1080, height: 1920, label: "Episode 2", title: "Knock Next Door" });
  const events = a.split("\n").filter((l) => l.startsWith("Dialogue:"));
  assert.ok(events[0].includes(",Label,") && events[0].endsWith(String.raw`{\an8\pos(540,115)}EPISODE 2`), events[0]);
  assert.ok(events[1].includes(",Title,") && events[1].endsWith("KNOCK NEXT DOOR"));
  const b = coverAss({ width: 1080, height: 1920, label: "Episode 3", title: "The Welcome Party" });
  assert.equal(a.split("[Events]")[0], b.split("[Events]")[0], "same styles for every episode");
  assert.equal(coverAss({ width: 1080, height: 1920, label: "", title: "Ken Reads Everything" }).split("\n").filter((l) => l.startsWith("Dialogue:")).length, 1, "singles: title only");
});
