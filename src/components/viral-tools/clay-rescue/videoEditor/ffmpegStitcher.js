// Client-side clip trimming + concatenation using ffmpeg.wasm.
// Loaded lazily (dynamic import) — only pulled in once someone actually
// reaches the Clay Rescue "done" step with finished clips, so the ~30MB
// wasm core never touches the main app bundle.
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

      // Re-encode (rather than stream-copy) so every trimmed segment shares
      // identical codec params — that's what lets the concat step below use
      // a fast stream-copy instead of a second full re-encode.
      await ffmpeg.exec([
        "-i", inName,
        "-ss", String(Math.max(0, trimStart)),
        "-to", String(Math.max(trimStart + 0.1, trimEnd)),
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-c:a", "aac",
        "-avoid_negative_ts", "make_zero",
        outName,
      ]);

      await ffmpeg.deleteFile(inName);
      trimmedNames.push(outName);
      onProgress?.(Math.round(((i + 1) / (clips.length + 1)) * 90));
    }

    const listContent = trimmedNames.map((n) => `file '${n}'`).join("\n");
    await ffmpeg.writeFile("list.txt", new TextEncoder().encode(listContent));

    await ffmpeg.exec([
      "-f", "concat",
      "-safe", "0",
      "-i", "list.txt",
      "-c", "copy",
      "output.mp4",
    ]);

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
