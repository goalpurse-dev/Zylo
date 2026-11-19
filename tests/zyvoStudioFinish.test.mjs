// node --test tests/zyvoStudioFinish.test.mjs   (free: finish_my_video's planning, and ONE real local finish with
// ffmpeg on a made-up recording: a landscape "Studio" clip with the kit's magenta sync flash and a sideways picture,
// a tone as the voice. No key, no paid call: the vision check is skipped without a key.)
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { captionsAss, captionWord, fitPlan, lineStarts, sidewaysBox, soundCues, speakersOf, visionProblem } from "../scripts/blockyWorlds/studioWorker/studioFinishPlan.mjs";

const LINES = [
  { text: "And the Mayor just thanked me for knocking out the whole town." },
  { text: "Pop, pop, pop." },
  { text: "Grandpa Otto just laughed. \"Bedtime stories are for emergencies, kid.\"", speaker: "Otto" },
];
const words = (() => { const out = []; let t = 0; for (const l of LINES) for (const w of l.text.split(/\s+/)) { out.push({ word: w, start: +t.toFixed(3), end: +(t + 0.25).toFixed(3) }); t += 0.3; } return out; })();

test("speakers: quoted words are the line's speaker, the rest the narrator", () => {
  const sp = speakersOf(LINES, words.length);
  const starts = lineStarts(LINES);
  assert.equal(sp.who[0], "narrator");
  assert.equal(sp.who[starts[2]], "narrator", "Grandpa (outside the quote)");
  assert.equal(sp.who[starts[2] + 4], "Otto", "\"Bedtime");
  assert.equal(sp.who.at(-1), "Otto", "kid.\"");
  assert.deepEqual(sp.speakers, ["Otto"]);
  assert.equal(sp.colour("narrator"), "FFFFFF");
});

test("captions: one word at a time in capitals, the pop, the speaker's colour, the kit's caption height", () => {
  assert.equal(captionWord("\"Bedtime"), "BEDTIME");
  assert.equal(captionWord("kid.\""), "KID");
  assert.equal(captionWord("really?!"), "REALLY?!");
  const { ass, captions, speakers } = captionsAss({ words, lines: LINES, shots: [{ t0: 0, t1: 2, captionY: 0.6 }], duration: 20 });
  assert.equal(captions, words.length);
  assert.deepEqual(speakers, ["Otto"]);
  assert.match(ass, /Style: Cap,Lilita One,140/);
  assert.match(ass, /\\pos\(540,1152\).*AND\n/, "the first shot's captionY 0.6");
  assert.match(ass, /\\pos\(540,1421\)/, "the default 0.74 after it");
  assert.match(ass, /\\1c&H8AF07C&.*BEDTIME/, "Otto's green (BGR in ASS)");
  assert.match(ass, /\\t\(0,54,\\fscx108\\fscy108\)/);
});

test("sound: the script's sound words on their spoken word, a whoosh before each location change", () => {
  const { cues } = soundCues({ words, lines: LINES, shots: [{ t0: 0, t1: 3, location: "street" }, { t0: 3, t1: 6, location: "street" }, { t0: 6, t1: 9, location: "school" }] });
  const pops = cues.filter((c) => c.name === "pop");
  assert.equal(pops.length, 3, "Pop, pop, pop.");
  assert.ok(Math.abs(pops[0].t - (words[lineStarts(LINES)[1]].start - 0.01)) < 1e-6);
  assert.deepEqual(cues.filter((c) => c.name === "whoosh_1").map((c) => c.t), [5.65]);
});

test("fit to the voice: <= 8 % speed, else trim or hold, and say so", () => {
  assert.equal(fitPlan(60, 60).kind, "same");
  const sp = fitPlan(63, 60);
  assert.equal(sp.kind, "speed");
  assert.match(sp.filter, /setpts=PTS\*0\.952381/);
  assert.match(sp.note, /sped up by 5\.0%/);
  assert.equal(fitPlan(70, 60).kind, "trim");
  const hold = fitPlan(50, 60);
  assert.equal(hold.kind, "hold");
  assert.match(hold.note, /last frame is held/);
});

test("the sideways 9:16 box in a measured viewport, and the vision answers", () => {
  const b = sidewaysBox({ x1: 0, y1: 100, x2: 1919, y2: 1179 }); // a 1920x1080 viewport
  assert.deepEqual([b.w, b.h, b.x, b.y], [1920, 1080, 0, 100]);
  const n = sidewaysBox({ x1: 10, y1: 0, x2: 1009, y2: 999 }); // 1000x1000: the 16:9 box is 1000x562
  assert.deepEqual([n.w, n.h], [1000, 562]);
  assert.equal(visionProblem(null), null, "our failure never blocks");
  assert.equal(visionProblem({ blocky_3d: true, real_person: false, unsafe: false, platform_ui: false }), null);
  assert.match(visionProblem({ blocky_3d: true, real_person: true }), /real person/);
  assert.match(visionProblem({ blocky_3d: false }), /blocky 3D/);
});

const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;
test("ONE real finish, locally: marker found, upright 1080x1920, fitted, captions burned, both masters at -14 LUFS", { skip: !hasFfmpeg && "no ffmpeg", timeout: 600_000 }, async () => {
  const { finishStudio } = await import("../scripts/blockyWorlds/studioWorker/studioFinish.mjs");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zyvo-finish-"));
  const ff = (args) => { const r = spawnSync("ffmpeg", ["-hide_banner", "-v", "error", "-y", ...args], { encoding: "utf8", cwd: dir }); if (r.status) throw new Error(r.stderr); };
  // the "recording": 1 s of grey, 0.5 s of magenta (the sync flash) in a 1600x900 viewport inside a 1920x1080 window,
  // 1 s black, then 7 s of a moving test pattern; the voice: a 6.2 s tone
  ff(["-f", "lavfi", "-i", "color=c=gray:s=1920x1080:d=1:r=30", "-f", "lavfi", "-i", "color=c=gray:s=1920x1080:d=0.5:r=30", "-f", "lavfi", "-i", "color=c=0xff00ff:s=1600x900:d=0.5:r=30", "-f", "lavfi", "-i", "color=c=black:s=1920x1080:d=1:r=30", "-f", "lavfi", "-i", "testsrc2=s=1920x1080:d=7:r=30",
    "-filter_complex", "[1][2]overlay=160:90[mk];[0][mk][3][4]concat=n=4:v=1:a=0,format=yuv420p[v]", "-map", "[v]", "-c:v", "libx264", "-preset", "ultrafast", "recording.mp4"]);
  ff(["-f", "lavfi", "-i", "sine=frequency=220:duration=6.2", "-c:a", "libmp3lame", "voice.mp3"]);
  const short = words.slice(0, 20).map((w) => ({ ...w }));
  const out = await finishStudio({ recording: path.join(dir, "recording.mp4"), voiceMp3: path.join(dir, "voice.mp3"), words: short, lines: LINES, shots: [{ t0: 0, t1: 3, location: "street" }, { t0: 3, t1: 7, location: "school" }], dir: path.join(dir, "work"), anthropicKey: null });
  const probe = (f) => JSON.parse(spawnSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,width,height:format=duration", "-of", "json", f], { encoding: "utf8" }).stdout);
  for (const f of [out.files.final, out.files.noMusic]) {
    const p = probe(f);
    const v = p.streams.find((s) => s.codec_type === "video");
    assert.deepEqual([v.width, v.height], [1080, 1920]);
    assert.ok(p.streams.some((s) => s.codec_type === "audio"));
    assert.ok(Math.abs(Number(p.format.duration) - out.seconds) < 0.2, `${f}: ${p.format.duration} vs ${out.seconds}`);
  }
  assert.ok(Math.abs(out.stats.lufs + 14) < 1.0, `final LUFS ${out.stats.lufs}`);
  assert.ok(Math.abs(out.stats.noMusicLufs + 14) < 1.0, `no-music LUFS ${out.stats.noMusicLufs}`);
  assert.ok(out.stats.truePeak <= -1.0, `true peak ${out.stats.truePeak}`);
  assert.equal(out.stats.landscape, true);
  assert.equal(out.stats.captions, 20);
  assert.ok(out.stats.sfxCues >= 4, "3 pops + a whoosh");
  assert.equal(probe(out.files.web).streams.find((s) => s.codec_type === "video").width, 720);
  assert.ok(fs.statSync(out.files.poster).size > 1000);
  assert.equal(out.costUsd, 0, "no key: the vision check is skipped, nothing paid");
  fs.rmSync(dir, { recursive: true, force: true });
});
