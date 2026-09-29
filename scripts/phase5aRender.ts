// deno-lint-ignore-file no-explicit-any
// Phase 5a — first MP4, rendered locally from the EDL ($0).
// Usage: FFMPEG=... FFPROBE=... npx -y deno@2.9.6 run -A --no-check scripts/phase5aRender.ts
// EDL (single source) -> per-clip segments (supersampled zoompan + burned-in
// text layer, CRF 20) -> concat (stream copy) + AAC 192k + faststart -> a
// 640x360 proxy -> checks (duration, cuts, black/blank frames, audio sync).
import { buildEdl, validateEdl, zoompanExpr, perspectiveExpr, type Edl } from "../supabase/functions/_shared/stickman/edl.ts";
import { renderLayerPng } from "../supabase/functions/_shared/stickman/textOverlay.ts";

const FFMPEG = Deno.env.get("FFMPEG") ?? "ffmpeg";
const FFPROBE = Deno.env.get("FFPROBE") ?? "ffprobe";
const root = new URL("../", import.meta.url);
const P = (p: string) => decodeURIComponent(new URL(p, root).pathname).replace(/^\/([A-Za-z]:)/, "$1");
const read = async (p: string) => JSON.parse(await Deno.readTextFile(new URL(p, root)));
const OUT = "docs/phase5", WORK = `${OUT}/work`;
await Deno.mkdir(new URL(`${WORK}/`, root), { recursive: true });
const SS = Number(Deno.env.get("SS") ?? 4); // zoompan supersampling: 4 = a 7680x4320 source for a 1920x1080 output

async function run(cmd: string, args: string[]): Promise<{ code: number; out: string; err: string }> {
  const r = await new Deno.Command(cmd, { args, stdout: "piped", stderr: "piped" }).output();
  return { code: r.code, out: new TextDecoder().decode(r.stdout), err: new TextDecoder().decode(r.stderr) };
}
async function ff(args: string[]) {
  const r = await run(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", ...args]);
  if (r.code !== 0) throw new Error(`ffmpeg failed: ${r.err.slice(-600)}`);
  return r;
}
const probe = async (file: string, args: string[]) => (await run(FFPROBE, ["-v", "error", ...args, file])).out.trim();

// ---------- sources: the latest frame per beat (5a fix > 4d fix > 4c set) ----------
const plan = await read("tests/fixtures/stickman/beats/myth-vs-reality.phase5a.json");
const full = await read("docs/phase4/fullset/state.json");
const fix = await read("docs/phase4/fix4d/state.json");
const src = (seq: number) => fix.round2?.beats?.[seq] ?? fix.beats?.[seq] ?? full.beats[seq];
const AUDIO = "tests/fixtures/stickman/audio/myth-vs-reality/audio.mp3";
const audioMs = Math.round(Number(await probe(P(AUDIO), ["-show_entries", "format=duration", "-of", "csv=p=0"])) * 1000);

// ---------- 1. EDL ----------
const edl: Edl = buildEdl({
  beats: plan.beats,
  audio: { path: AUDIO, durationMs: audioMs },
  imageFor: (seq) => { const s = src(seq); if (!s?.files?.base) throw new Error(`beat ${seq}: no base image`); return { image: s.files.base, overlay: s.overlay ?? null }; },
});
const edlErrors = validateEdl(edl);
if (edlErrors.length) throw new Error(`EDL invalid: ${edlErrors.join("; ")}`);
await Deno.writeTextFile(new URL(`${OUT}/myth-vs-reality.edl.json`, root), JSON.stringify(edl, null, 1));
const mix: Record<string, number> = {};
for (const c of edl.clips) mix[c.motion.kind] = (mix[c.motion.kind] ?? 0) + 1;
console.log(`EDL: ${edl.clips.length} clips, ${edl.totalFrames} frames @ ${edl.fps} fps (${(audioMs / 1000).toFixed(3)} s audio), motion ${JSON.stringify(mix)}, overlays ${edl.clips.filter((c) => c.overlay).length}, frames/clip min ${Math.min(...edl.clips.map((c) => c.frames))} max ${Math.max(...edl.clips.map((c) => c.frames))}`);

// ---------- 2. render ----------
const t0 = Date.now();
const seg = (i: number) => `${WORK}/seg-${String(i).padStart(3, "0")}.mp4`;
const X264 = ["-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-r", String(edl.fps), "-video_track_timescale", "30000", "-an"];
async function renderClip(c: Edl["clips"][number]) {
  const MOTION = Deno.env.get("MOTION") ?? "perspective";
  const inputs = c.motion.kind === "hold" || MOTION === "perspective" ? ["-loop", "1", "-framerate", String(edl.fps), "-i", P(c.image)] : ["-i", P(c.image)];
  let overlay = "";
  if (c.overlay) {
    const png = `${WORK}/overlay-${String(c.index).padStart(3, "0")}.png`;
    await Deno.writeFile(new URL(png, root), await renderLayerPng(c.overlay, edl.width, edl.height));
    inputs.push("-i", P(png));
    overlay = ";[bg][1:v]overlay=0:0:format=auto[v]";
  }
  const bgOut = c.overlay ? "[bg]" : "[v]";
  let graph: string;
  if (c.motion.kind === "hold") {
    graph = `[0:v]scale=${edl.width}:${edl.height}:flags=lanczos,setsar=1${bgOut}${overlay}`;
  } else if (MOTION === "perspective") {
    graph = `[0:v]scale=${edl.width}:${edl.height}:flags=lanczos,format=gbrp,perspective=${perspectiveExpr(c.motion, c.frames)},setsar=1${bgOut}${overlay}`;
  } else {
    const e = zoompanExpr(c.motion, c.frames);
    graph = `[0:v]scale=${edl.width * SS}:${edl.height * SS}:flags=lanczos,zoompan=z='${e.z}':x='${e.x}':y='${e.y}':d=${c.frames}:s=${edl.width}x${edl.height}:fps=${edl.fps},setsar=1${bgOut}${overlay}`;
  }
  await ff([...inputs, "-filter_complex", graph, "-map", "[v]", "-frames:v", String(c.frames), ...X264, P(seg(c.index))]);
}
const ONLY = Deno.env.get("ONLY");
if (ONLY) {
  for (const i of ONLY.split(",").map(Number)) { const t = Date.now(); await renderClip(edl.clips[i]); console.log(`test clip ${i} (${edl.clips[i].motion.kind}, ${edl.clips[i].frames} frames, overlay ${!!edl.clips[i].overlay}) ${Date.now() - t} ms`); }
  Deno.exit(0);
}
const queue = [...edl.clips];
const workers = Math.max(2, Math.min(8, (navigator.hardwareConcurrency ?? 8) - 2));
let done = 0;
await Promise.all(Array.from({ length: workers }, async () => {
  while (queue.length) {
    const c = queue.shift()!;
    await renderClip(c);
    if (++done % 20 === 0) console.log(`  rendered ${done}/${edl.clips.length} clips (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
}));
const tSegments = Date.now() - t0;
await Deno.writeTextFile(new URL(`${WORK}/concat.txt`, root), edl.clips.map((c) => `file '${P(seg(c.index)).replace(/'/g, "'\\''")}'`).join("\n"));
const FINAL = `${OUT}/myth-vs-reality-v2.mp4`, PROXY = `${OUT}/myth-vs-reality-v2-proxy-640x360.mp4`;
await ff(["-f", "concat", "-safe", "0", "-i", P(`${WORK}/concat.txt`), "-i", P(AUDIO), "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", P(FINAL)]);
const tFinal = Date.now() - t0;
await ff(["-i", P(FINAL), "-vf", "scale=640:360:flags=lanczos", "-c:v", "libx264", "-preset", "veryfast", "-crf", "26", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", P(PROXY)]);
const tProxy = Date.now() - t0;

// ---------- checks ----------
const fps = edl.fps, frameMs = 1000 / fps;
const size = async (p: string) => (await Deno.stat(new URL(p, root))).size;
const vFrames = Number(await probe(P(FINAL), ["-select_streams", "v:0", "-count_packets", "-show_entries", "stream=nb_read_packets", "-of", "csv=p=0"]));
const vDur = Number(await probe(P(FINAL), ["-select_streams", "v:0", "-show_entries", "stream=duration", "-of", "csv=p=0"])) * 1000;
const aDur = Number(await probe(P(FINAL), ["-select_streams", "a:0", "-show_entries", "stream=duration", "-of", "csv=p=0"])) * 1000;
const starts = await probe(P(FINAL), ["-show_entries", "stream=codec_type,start_time", "-of", "csv=p=0"]);
// Per-segment frame counts -> actual cut frames.
const segFrames = await Promise.all(edl.clips.map(async (c) => Number(await probe(P(seg(c.index)), ["-select_streams", "v:0", "-count_packets", "-show_entries", "stream=nb_read_packets", "-of", "csv=p=0"]))));
let acc = 0;
const cutErr = edl.clips.map((c, i) => { const at = acc; acc += segFrames[i]; return Math.abs(at - Math.round((c.index === 0 ? 0 : plan.beats[i].startMs) * fps / 1000)); });
// Scene-change detection on the proxy: which cuts are visible, and where.
const sc = await run(FFMPEG, ["-hide_banner", "-i", P(PROXY), "-vf", "select='gt(scene,0.12)',showinfo", "-an", "-f", "null", "-"]);
const detected = [...sc.err.matchAll(/pts_time:([\d.]+)/g)].map((m) => Number(m[1]) * 1000);
const cutMs = edl.clips.slice(1).map((c) => (c.startFrame * 1000) / fps);
const matched = cutMs.filter((t) => detected.some((d) => Math.abs(d - t) <= frameMs + 1)).length;
const falseCuts = detected.filter((d) => !cutMs.some((t) => Math.abs(d - t) <= frameMs + 1)).length;
// Black and blank (white/flat) frames.
const black = await run(FFMPEG, ["-hide_banner", "-i", P(PROXY), "-vf", "blackdetect=d=0.03:pix_th=0.10", "-an", "-f", "null", "-"]);
const white = await run(FFMPEG, ["-hide_banner", "-i", P(PROXY), "-vf", "negate,blackdetect=d=0.03:pix_th=0.10", "-an", "-f", "null", "-"]);
const blackHits = (black.err.match(/black_start/g) ?? []).length, whiteHits = (white.err.match(/black_start/g) ?? []).length;
// Audio sync: cross-correlate the MP4's audio against the source narration
// around three cuts (start, middle, end) — the lag must be under one frame.
async function pcm(file: string, fromS: number, durS: number) {
  const r = await new Deno.Command(FFMPEG, { args: ["-hide_banner", "-loglevel", "error", "-ss", String(fromS), "-t", String(durS), "-i", file, "-ac", "1", "-ar", "8000", "-f", "s16le", "-"], stdout: "piped", stderr: "piped" }).output();
  return new Int16Array(r.stdout.buffer.slice(r.stdout.byteOffset, r.stdout.byteOffset + (r.stdout.byteLength & ~1)));
}
function bestLagMs(a: Int16Array, b: Int16Array, maxLag = 400) {
  let best = 0, bestV = -Infinity;
  for (let lag = -maxLag; lag <= maxLag; lag++) {
    let s = 0;
    for (let i = Math.max(0, -lag); i < Math.min(a.length, b.length - lag); i++) s += a[i] * b[i + lag];
    if (s > bestV) { bestV = s; best = lag; }
  }
  return (best / 8000) * 1000;
}
const words = await read("tests/fixtures/stickman/audio/myth-vs-reality/words.json");
const spots = [1, Math.floor(edl.clips.length / 2), edl.clips.length - 2].map((i) => {
  const c = edl.clips[i], b = plan.beats[i];
  return { beat: c.beatSequence, cutMs: (c.startFrame * 1000) / fps, wordMs: words[b.startWord]?.startMs ?? null, word: words[b.startWord]?.word ?? "" };
});
for (const s of spots as any[]) {
  const from = Math.max(0, s.cutMs / 1000 - 1);
  s.audioLagMs = bestLagMs(await pcm(P(AUDIO), from, 2.5), await pcm(P(FINAL), from, 2.5));
  s.cutVsBeatMs = Math.round(s.cutMs - plan.beats.find((x: any) => x.sequence === s.beat).startMs);
  s.visibleCut = detected.some((d) => Math.abs(d - s.cutMs) <= frameMs + 1);
}
const report = {
  edl: { clips: edl.clips.length, totalFrames: edl.totalFrames, motion: mix, overlays: edl.clips.filter((c) => c.overlay).length },
  renderSeconds: { segments: Math.round(tSegments / 1000), final: Math.round(tFinal / 1000), proxy: Math.round(tProxy / 1000), workers },
  files: { final: { path: FINAL, bytes: await size(FINAL) }, proxy: { path: PROXY, bytes: await size(PROXY) } },
  checks: {
    duration: { videoFrames: vFrames, edlFrames: edl.totalFrames, videoMs: Math.round(vDur), audioSourceMs: audioMs, audioMp4Ms: Math.round(aDur), diffFrames: Number(((vDur - audioMs) / frameMs).toFixed(2)), pass: Math.abs(vDur - audioMs) <= frameMs && vFrames === edl.totalFrames },
    cuts: { maxErrFrames: Math.max(...cutErr), over1: cutErr.filter((e) => e > 1).length, visibleBySceneDetect: `${matched}/${cutMs.length}`, extraSceneChanges: falseCuts, pass: Math.max(...cutErr) <= 1 },
    blackOrBlank: { blackRuns: blackHits, whiteRuns: whiteHits, pass: blackHits === 0 && whiteHits === 0 },
    sync: { streamStarts: starts.replace(/\n/g, "; "), spots, pass: (spots as any[]).every((s) => Math.abs(s.audioLagMs) < frameMs) },
  },
};
await Deno.writeTextFile(new URL(`${OUT}/render-report.json`, root), JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
