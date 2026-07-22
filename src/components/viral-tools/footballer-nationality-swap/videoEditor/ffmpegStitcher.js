// Client-side clip trimming + concatenation using ffmpeg.wasm.
// Loaded lazily (dynamic import) — only pulled in once someone actually
// reaches the "done" step with finished clips, so the ~30MB wasm core
// never touches the main app bundle.
//
// The core engine files are self-hosted under /public/ffmpeg/ (same origin,
// served by Vercel) rather than pulled from a third-party CDN — this is the
// whole engine's uptime dependency, and self-hosting means it's exactly as
// reliable as the rest of the site.

let ffmpegPromise = null;

/** Tags an error with which stage failed so the UI can show an accurate message. */
function stageError(stage, message, cause) {
  const err = new Error(message);
  err.stage = stage; // "engine" | "fetch" | "render"
  if (cause) err.cause = cause;
  return err;
}

async function getFFmpeg() {
  if (ffmpegPromise) return ffmpegPromise;

  ffmpegPromise = (async () => {
    let FFmpeg, toBlobURL;
    try {
      [{ FFmpeg }, { toBlobURL }] = await Promise.all([
        import("@ffmpeg/ffmpeg"),
        import("@ffmpeg/util"),
      ]);
    } catch (e) {
      throw stageError("engine", "Couldn't load the video engine.", e);
    }

    const ffmpeg = new FFmpeg();
    const BASE = "/ffmpeg";

    // ffmpeg's own stderr/stdout — without this, a failed exec() only
    // surfaces a generic wrapper error with none of the actual diagnostic
    // text (codec mismatches, stream mapping failures, etc.).
    ffmpeg.on("log", ({ message }) => console.log("[ffmpeg]", message));

    try {
      await ffmpeg.load({
        coreURL: await toBlobURL(`${BASE}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${BASE}/ffmpeg-core.wasm`, "application/wasm"),
      });
    } catch (e) {
      ffmpegPromise = null; // allow retrying on the next render() call
      throw stageError("engine", "Couldn't load the video engine.", e);
    }

    return ffmpeg;
  })();

  return ffmpegPromise;
}

async function fetchAsUint8Array(url) {
  let res;
  try {
    res = await fetch(url);
  } catch (e) {
    throw stageError("fetch", "Couldn't download one of the clips.", e);
  }
  if (!res.ok) throw stageError("fetch", "Couldn't download one of the clips.");
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

// Canonical output size every segment gets normalized to before concat.
// Scene clips already come in at least two different native resolutions
// depending on which video engine generated them (496x864 vs 720x1280), and
// an appended watermark/outro clip is a third independent source — without
// forcing everything to one resolution first, the stream-copy concat below
// (which requires matching codec params across segments) can silently
// produce a corrupted or visually broken output.
const OUTPUT_W = 720;
const OUTPUT_H = 1280;
const OUTPUT_FPS = 30;

/**
 * Trims and concatenates a sequence of video clips into one file.
 * @param {{ url: string, trimStart: number, trimEnd: number }[]} clips  — in final playback order
 * @param {(pct: number) => void} [onProgress] — 0..100
 * @returns {Promise<{ blob: Blob, url: string }>}
 */
export async function stitchClips(clips, onProgress) {
  if (!clips.length) throw stageError("render", "No clips to stitch.");

  const ffmpeg = await getFFmpeg();
  const trimmedNames = [];

  try {
    for (let i = 0; i < clips.length; i++) {
      const { url, trimStart, trimEnd } = clips[i];
      const inName = `in${i}.mp4`;
      const outName = `trim${i}.mp4`;

      const data = await fetchAsUint8Array(url);
      await ffmpeg.writeFile(inName, data);

      const safeTrimStart = Math.max(0, trimStart);
      const trimDuration = Math.max(0.1, trimEnd - safeTrimStart);

      // Re-encode (rather than stream-copy) so every trimmed segment shares
      // identical codec params, resolution, frame rate, timestamps, and audio
      // format — that's what
      // lets the concat step below use a fast stream-copy instead of a
      // second full re-encode. scale+pad (not just scale) avoids distorting
      // clips whose source aspect ratio doesn't exactly match the target.
      //
      // The explicit fps filter is essential. Generated scenes can be 24fps
      // while the outro is 30fps; stream-copying those together makes the
      // first clip's frame rate govern the outro. Its audio then plays at the
      // right speed while its video falls behind and continues silently.
      // setpts/asetpts and aresample give both tracks a clean zero-based clock
      // before concat, rather than preserving source-specific offsets.
      //
      // -shortest forces each segment's audio and video to end together,
      // preventing one stream from running past the other within a single
      // trimmed segment — that mismatch is what compounds across a
      // stream-copy concat into an audible/visible desync by the last join.
      // (Previously also had -vsync cfr for the same goal, but that's a
      // long-deprecated flag ffmpeg.wasm's stripped build doesn't recognize
      // — it was failing every exec() call silently, since the wasm binding
      // doesn't throw on ffmpeg's own non-zero exit, which then surfaced
      // downstream as a generic "FS error" when later steps tried to read
      // files that were never written.)
      // ffmpeg.wasm's exec() resolves with ffmpeg's own exit code rather
      // than throwing on a non-zero one — checking it explicitly turns a
      // silent per-segment failure into a clear error right here, instead
      // of a confusing generic "FS error" several steps later when the
      // concat step (or readFile) tries to touch a file that was never written.
      const trimCode = await ffmpeg.exec([
        "-i", inName,
        "-ss", String(safeTrimStart),
        "-t", String(trimDuration),
        "-vf", `scale=w=${OUTPUT_W}:h=${OUTPUT_H}:force_original_aspect_ratio=decrease,pad=${OUTPUT_W}:${OUTPUT_H}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=${OUTPUT_FPS},setpts=PTS-STARTPTS,format=yuv420p`,
        "-af", "aresample=async=1:first_pts=0,asetpts=PTS-STARTPTS",
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-ar", "44100",
        "-ac", "2",
        "-shortest",
        "-avoid_negative_ts", "make_zero",
        outName,
      ]);
      if (trimCode !== 0) {
        throw stageError("render", "Couldn't render the final video.", new Error(`ffmpeg exited ${trimCode} trimming segment ${i}`));
      }

      await ffmpeg.deleteFile(inName);
      trimmedNames.push(outName);
      onProgress?.(Math.round(((i + 1) / (clips.length + 1)) * 90));
    }

    const listContent = trimmedNames.map((n) => `file '${n}'`).join("\n");
    await ffmpeg.writeFile("list.txt", new TextEncoder().encode(listContent));

    // Stream-copy (-c copy) — NOT a full re-encode. A full re-encode was
    // tried here to fix the freeze-then-jump artifact and instead crashed
    // ffmpeg.wasm outright (Aborted() — the WASM sandbox doesn't have the
    // memory/compute headroom to decode+encode 4 segments at 720x1280 in
    // one pass). +genpts is the actual standard, lightweight fix for this:
    // concat-demuxer output can carry discontinuous/stale timestamps across
    // the joins even when the underlying packets are fine, which is what
    // produces the "last frame holds while audio keeps playing" symptom.
    // Regenerating clean presentation timestamps fixes that without paying
    // for a full transcode.
    const concatCode = await ffmpeg.exec([
      "-fflags", "+genpts",
      "-f", "concat",
      "-safe", "0",
      "-i", "list.txt",
      "-c", "copy",
      "-movflags", "+faststart",
      "output.mp4",
    ]);
    if (concatCode !== 0) {
      throw stageError("render", "Couldn't render the final video.", new Error(`ffmpeg exited ${concatCode} concatenating segments`));
    }

    const output = await ffmpeg.readFile("output.mp4");
    const blob = new Blob([output.buffer], { type: "video/mp4" });
    const url = URL.createObjectURL(blob);

    // Clean up FS so a later render in the same session doesn't accumulate files.
    await Promise.all([
      ...trimmedNames.map((n) => ffmpeg.deleteFile(n).catch(() => {})),
      ffmpeg.deleteFile("list.txt").catch(() => {}),
      ffmpeg.deleteFile("output.mp4").catch(() => {}),
    ]);

    onProgress?.(100);
    return { blob, url };
  } catch (e) {
    if (e?.stage) throw e; // already tagged (engine/fetch)
    throw stageError("render", "Couldn't render the final video.", e);
  }
}

/** Reads a remote video's duration in seconds via a throwaway <video> element. */
export function probeDuration(url) {
  return new Promise((resolve) => {
    // Chromium (and some other engines) can silently abort the metadata
    // request for a <video> that's never attached to the document — the
    // element must be in the DOM for its network request to reliably
    // complete. Keep it off-screen and clean it up once we're done.
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.style.position = "fixed";
    v.style.width = "1px";
    v.style.height = "1px";
    v.style.opacity = "0";
    v.style.pointerEvents = "none";

    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      v.remove();
      resolve(value);
    };

    // Belt-and-suspenders: never hang the whole editor over one bad clip.
    const timeoutId = setTimeout(() => finish(6), 10000);

    v.onloadedmetadata = () => {
      const d = Number.isFinite(v.duration) ? v.duration : 6;
      finish(d > 0 ? d : 6);
    };
    v.onerror = () => finish(6);

    document.body.appendChild(v);
    v.src = url;
  });
}
