// Blender kit engine: LIVE PROGRESS for the run row (owner 2026-11-15: the page sat at 12% "Directing every shot" for 20+
// minutes while the pipeline was previewing, fixing and rendering). The worker feeds every line the pipeline prints
// (pipeline.mjs say(), the director's model calls, rp.mjs's jobs) into a tracker and writes its snapshot to the run row
// every few seconds: the stage (studioStages.js ids), a percent that only goes up, the ceiling the page may creep to,
// and what is happening inside the step ("Directing shot 24 of 76", "Rendering frame 1,200 of 2,800").
//   const t = makeProgress({ now }); t.feed(line); t.snapshot() -> { stage, pct, ceil, detail }
// The weights (of the whole run): voice + timing before the pipeline (0-10), the director 10-42, the test shots 42-52,
// the frame check 52-55, the fixes 55-62, the final render 62-92, the finish (sound, captions, upload) 92-99.
export const BANDS = Object.freeze({
  directing: [10, 42], previews: [42, 52], checking: [52, 55], fixing: [55, 62], rendering: [62, 92], finishing: [92, 99],
});
export const MEASURED = Object.freeze({ planS: 95, batchS: 30, previewShotS: 10, checkS: 55, sPerFrame: 0.95, finishS: (dur) => 90 + 6.5 * dur });
const fmt = (n) => Math.round(n).toLocaleString("en-US");
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export function makeProgress({ now = () => Date.now() } = {}) {
  const s = {
    stage: "directing", since: now(), shots: 0, written: 0, dur: 0, round: 0, failing: 0,
    jobs: {}, // label -> { kind: "preview" | "chunk" | "finish", round, shots, frames, sentAt, startAt, doneAt }
    frames: 0, chunks: 0, music: false, checking: false, uploaded: false, last: { pct: BANDS.directing[0], stage: "directing" },
  };
  const to = (stage) => { if (stage !== s.stage) { s.stage = stage; s.since = now(); } };
  const roundJobs = (r) => Object.values(s.jobs).filter((j) => j.kind === "preview" && j.round === r);

  function feed(raw) {
    const line = String(raw ?? "").replace(/^\s*\[[^\]]*\]\s*/, "").trim();
    if (line) s.lineAt = now(); // the last real line: what the time limit calls progress (studio.js studioProgressAt)
    let m;
    if ((m = line.match(/^script ".*": \d+ lines, \d+ words, voice ([\d.]+) s/))) s.dur = Number(m[1]);
    else if ((m = line.match(/^plan: (\d+) shots in/))) { s.shots = Number(m[1]); to("directing"); }
    else if ((m = line.match(/^batch (\d+)-(\d+): (\d+) of (\d+) bodies/))) { s.written = Math.max(s.written, Number(m[2])); to("directing"); }
    else if (/^(static check|shot check):/.test(line)) { s.written = Math.max(s.written, s.shots); }
    else if ((m = line.match(/^preview r(\d+)\.(\d+) \((\d+) shots\): (job \S+ sent|running|done)/))) {
      const label = `preview r${m[1]}.${m[2]}`, r = Number(m[1]);
      const j = (s.jobs[label] ??= { kind: "preview", round: r, shots: Number(m[3]) });
      if (m[4].startsWith("job")) j.sentAt ??= now(); else if (m[4] === "running") j.startAt ??= now(); else j.doneAt ??= now();
      s.round = Math.max(s.round, r); s.checking = false;
      to(r === 0 ? "previews" : "fixing");
      if (roundJobs(r).every((x) => x.doneAt)) { s.checking = true; to(r === 0 ? "checking" : "fixing"); }
    }
    else if ((m = line.match(/^round (\d+): \d+ shots (?:previewed|re-previewed).*-> (\d+) failing/))) { s.failing = Number(m[2]); s.checking = false; to("fixing"); }
    else if (/^fix_round_\d+/.test(line) || /^fix rounds:/.test(line)) { s.checking = false; to("fixing"); }
    else if (/^music:/.test(line)) { s.music = true; to("rendering"); }
    else if ((m = line.match(/^final: (\d+) shots, (\d+) frames in (\d+) chunks/))) { s.frames = Number(m[2]); s.chunks = Number(m[3]); to("rendering"); }
    else if ((m = line.match(/^chunk (\d+) \(shots [^,]*, (\d+) frames\): (job \S+ sent|running|done)/))) {
      const j = (s.jobs[`chunk ${m[1]}`] ??= { kind: "chunk", frames: Number(m[2]) });
      if (m[3].startsWith("job")) j.sentAt ??= now(); else if (m[3] === "running") j.startAt ??= now(); else j.doneAt ??= now();
      to("rendering");
    }
    else if ((m = line.match(/^chunk (\d+): (\d+) frames in/))) { const j = (s.jobs[`chunk ${m[1]}`] ??= { kind: "chunk", frames: Number(m[2]) }); j.doneAt ??= now(); }
    else if ((m = line.match(/^finish: (job \S+ sent|running|done)/))) {
      const j = (s.jobs.finish ??= { kind: "finish" });
      if (m[1].startsWith("job")) j.sentAt ??= now(); else if (m[1] === "running") j.startAt ??= now(); else j.doneAt ??= now();
      to("finishing");
    }
    else if (/^final: .*final\.mp4/.test(line)) { s.uploaded = true; to("finishing"); }
  }

  /** the frames rendered so far: done chunks + the running ones at the measured speed (never more than a chunk has) */
  const framesDone = () => Object.values(s.jobs).filter((j) => j.kind === "chunk").reduce((a, j) => a + (j.doneAt ? j.frames : j.startAt ? Math.min(j.frames * 0.97, (now() - j.startAt) / 1000 / MEASURED.sPerFrame) : 0), 0);

  function raw() {
    const el = (now() - s.since) / 1000;
    if (s.stage === "directing") {
      if (!s.shots) return { f: clamp(el / MEASURED.planS, 0, 1) * 0.18, detail: "Planning every shot" };
      if (s.written >= s.shots) return { f: 0.97, detail: `Checking the code of ${fmt(s.shots)} shots` };
      return { f: 0.2 + 0.77 * (s.written / s.shots), detail: `Directing shot ${fmt(Math.min(s.shots, s.written + 1))} of ${fmt(s.shots)}` };
    }
    if (s.stage === "previews" || s.stage === "checking" || s.stage === "fixing") {
      const jobs = roundJobs(s.round), done = jobs.filter((j) => j.doneAt).length, shots = jobs.reduce((a, j) => a + j.shots, 0);
      // inside a round of test shots: the jobs' share, crept by the measured seconds a shot while they run
      const running = jobs.filter((j) => !j.doneAt && j.startAt).reduce((a, j) => a + clamp((now() - j.startAt) / 1000 / (j.shots * MEASURED.previewShotS), 0, 0.95), 0);
      const jf = jobs.length ? (done + running) / jobs.length : 0;
      if (s.stage === "previews") return { f: jf * 0.95, detail: `Test-shooting ${fmt(shots || s.shots)} shots${jobs.length > 1 ? ` (${done} of ${jobs.length} batches done)` : ""}` };
      if (s.stage === "checking") return { f: clamp(el / MEASURED.checkS, 0, 0.95), detail: `Checking every frame of ${fmt(shots || s.shots)} shots` };
      if (s.checking) return { f: 0.7 + 0.25 * clamp(el / MEASURED.checkS, 0, 1), detail: "Checking the fixed shots" };
      if (s.round >= 1 && jobs.length) return { f: 0.35 + 0.35 * jf, detail: `Re-shooting ${fmt(shots)} fixed shots` };
      return { f: clamp(el / 120, 0, 0.35), detail: s.failing ? `Fixing ${fmt(s.failing)} weak shots` : "Fixing the weak shots" };
    }
    if (s.stage === "rendering") {
      if (!s.frames) return { f: 0.02, detail: s.music ? "Mixing the music and captions" : "Getting the render ready" };
      const fd = framesDone();
      return { f: 0.03 + 0.95 * clamp(fd / s.frames, 0, 1), detail: `Rendering frame ${fmt(Math.min(s.frames, Math.max(1, fd)))} of ${fmt(s.frames)}` };
    }
    // finishing
    if (s.uploaded) return { f: 0.97, detail: "Uploading your video" };
    const j = s.jobs.finish, dur = s.dur || s.frames / 30 || 90;
    const ft = j?.startAt ? clamp((now() - j.startAt) / 1000 / MEASURED.finishS(dur), 0, 0.9) : 0;
    return { f: ft, detail: "Adding sound and captions" };
  }

  function snapshot() {
    const [lo, hi] = BANDS[s.stage];
    const r = raw();
    // forward only: the percent never goes back, not even when a stage moves back (a fix round after the check)
    const pct = +Math.max(s.last.pct, lo + (hi - lo) * clamp(r.f, 0, 1)).toFixed(1);
    const order = Object.keys(BANDS);
    const stage = order.indexOf(s.stage) >= order.indexOf(s.last.stage) ? s.stage : s.last.stage;
    s.last = { pct, stage };
    return { stage, pct, ceil: Math.max(pct, BANDS[stage][1]), detail: r.detail, lineAt: s.lineAt ?? null };
  }
  return { feed, snapshot, state: s };
}
