let ffmpegPromise = null;
let thirtyDaysRenderQueue = Promise.resolve();

const OUTPUT_W = 720;
const OUTPUT_H = 1280;
// 30 Days scene clips are generated at 24 fps. Keeping that frame rate avoids
// manufacturing 25% more frames before the final stitch pass.
const OUTPUT_FPS = 24;

function stageError(stage, message, cause) {
  const error = new Error(message);
  error.stage = stage;
  if (cause) {
    error.cause = cause;
    error.detail = cause?.detail || cause?.message || String(cause);
  }
  return error;
}

async function getFFmpeg() {
  if (ffmpegPromise) return ffmpegPromise;
  ffmpegPromise = (async () => {
    let FFmpeg;
    let toBlobURL;
    try {
      [{ FFmpeg }, { toBlobURL }] = await Promise.all([
        import("@ffmpeg/ffmpeg"),
        import("@ffmpeg/util"),
      ]);
    } catch (error) {
      throw stageError("engine", "Couldn't load the video engine.", error);
    }

    const ffmpeg = new FFmpeg();
    ffmpeg.on("log", ({ message }) => console.log("[thirty-days-stitch]", message));
    try {
      await ffmpeg.load({
        coreURL: await toBlobURL("/ffmpeg/ffmpeg-core.js", "text/javascript"),
        wasmURL: await toBlobURL("/ffmpeg/ffmpeg-core.wasm", "application/wasm"),
      });
    } catch (error) {
      ffmpegPromise = null;
      throw stageError("engine", "Couldn't load the video engine.", error);
    }
    return ffmpeg;
  })();
  return ffmpegPromise;
}

async function fetchBytes(url, label = "video") {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    throw stageError("fetch", `Couldn't download the ${label}.`, error);
  }
}

const videoFilter =
  `scale=w=${OUTPUT_W}:h=${OUTPUT_H}:force_original_aspect_ratio=decrease,` +
  `pad=${OUTPUT_W}:${OUTPUT_H}:(ow-iw)/2:(oh-ih)/2:color=black,` +
  `setsar=1,fps=${OUTPUT_FPS},setpts=PTS-STARTPTS,format=yuv420p`;

async function run(ffmpeg, args, description, onProgress) {
  const progressListener = typeof onProgress === "function"
    ? ({ progress }) => onProgress(Math.max(0, Math.min(1, Number(progress) || 0)))
    : null;
  if (progressListener) ffmpeg.on("progress", progressListener);
  try {
    const code = await ffmpeg.exec(args);
    if (code !== 0) {
      throw stageError("render", "Couldn't render the final video.", new Error(`${description}: ffmpeg exited ${code}`));
    }
  } finally {
    if (progressListener) ffmpeg.off("progress", progressListener);
  }
}

/**
 * Normalizes and joins silent generated scene clips with the optional voiced
 * watermark segment. A silent stereo AAC track is added to every generated
 * clip so all segments have identical stream layouts before the lightweight
 * concat step. 30 Days has no caption feature in V1, so this is narration-only:
 * no burned-in text track is produced.
 */
function atempoFilters(rate) {
  let remaining = Math.max(0.0625, Math.min(16, Number(rate) || 1));
  const filters = [];
  while (remaining < 0.5) { filters.push("atempo=0.5"); remaining /= 0.5; }
  while (remaining > 2) { filters.push("atempo=2"); remaining /= 2; }
  filters.push(`atempo=${remaining.toFixed(5)}`);
  return filters.join(",");
}

async function stitchThirtyDaysVideoUnlocked({ clips, watermarkUrl, watermarkDuration = 6, voiceUrl, voicePlaybackRate = 1, voiceClipTimings = [], onProgress }) {
  if (!clips?.length) throw stageError("render", "No scene clips are ready.");

  const ffmpeg = await getFFmpeg();
  const segments = [
    ...clips.map((clip) => ({ ...clip, duration: clip.duration || 5, hasAudio: false })),
    ...(watermarkUrl ? [{ url: watermarkUrl, duration: watermarkDuration, hasAudio: true, watermark: true }] : []),
  ];
  const normalized = [];
  const cleanup = new Set();

  try {
    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      const inputName = `thirty-days-in-${index}.mp4`;
      const outputName = `thirty-days-segment-${index}.mp4`;
      cleanup.add(inputName);
      cleanup.add(outputName);
      await ffmpeg.writeFile(inputName, await fetchBytes(
        segment.url,
        segment.watermark ? "watermark video" : `scene clip ${index + 1}`,
      ));

      const commonOutput = [
        "-t", String(segment.duration),
        "-vf", videoFilter,
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-ar", "44100",
        "-ac", "2",
        "-shortest",
        "-avoid_negative_ts", "make_zero",
        outputName,
      ];

      if (segment.hasAudio) {
        await run(ffmpeg, [
          "-i", inputName,
          "-map", "0:v:0",
          "-map", "0:a:0",
          "-af", "aresample=async=1:first_pts=0,asetpts=PTS-STARTPTS",
          ...commonOutput,
        ], `normalizing segment ${index + 1}`, (progress) => {
          onProgress?.(Math.round(4 + ((index + progress) / segments.length) * 66));
        });
      } else {
        // Generated scene clips already use the required 720x1280 H.264
        // format. Copy their video stream and only add silent AAC; if a
        // provider ever returns a different format, fall back to normalization.
        try {
          await run(ffmpeg, [
            "-fflags", "+genpts",
            "-i", inputName,
            "-f", "lavfi",
            "-t", String(segment.duration),
            "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
            "-map", "0:v:0",
            "-map", "1:a:0",
            "-t", String(segment.duration),
            "-c:v", "copy",
            "-c:a", "aac",
            "-ar", "44100",
            "-ac", "2",
            "-shortest",
            "-avoid_negative_ts", "make_zero",
            "-movflags", "+faststart",
            outputName,
          ], `copying segment ${index + 1}`);
        } catch (copyError) {
          console.warn(`[thirty-days-stitch] fast copy failed for clip ${index + 1}; normalizing instead`, copyError);
          await ffmpeg.deleteFile(outputName).catch(() => {});
          await run(ffmpeg, [
            "-i", inputName,
            "-f", "lavfi",
            "-t", String(segment.duration),
            "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
            "-map", "0:v:0",
            "-map", "1:a:0",
            "-af", "asetpts=PTS-STARTPTS",
            ...commonOutput,
          ], `normalizing segment ${index + 1}`, (progress) => {
            onProgress?.(Math.round(4 + ((index + progress) / segments.length) * 66));
          });
        }
      }

      normalized.push(outputName);
      await ffmpeg.deleteFile(inputName).catch(() => {});
      cleanup.delete(inputName);
      onProgress?.(Math.round(4 + ((index + 1) / segments.length) * 66));
    }

    const listName = "thirty-days-list.txt";
    const joinedName = "thirty-days-joined.mp4";
    cleanup.add(listName);
    cleanup.add(joinedName);
    await ffmpeg.writeFile(listName, new TextEncoder().encode(normalized.map((name) => `file '${name}'`).join("\n")));
    await run(ffmpeg, [
      "-fflags", "+genpts",
      "-f", "concat",
      "-safe", "0",
      "-i", listName,
      "-c", "copy",
      "-movflags", "+faststart",
      joinedName,
    ], "joining normalized segments");
    onProgress?.(78);

    const clipsDuration = clips.reduce((total, clip) => total + (clip.duration || 5), 0);
    const visualName = joinedName;

    let finalName = visualName;
    if (voiceUrl) {
      const audioOffset = 0;
      const audioDelayMs = Math.round(audioOffset * 1000);
      const availableVoiceDuration = Math.max(0.1, clipsDuration - audioOffset);
      // Clamp defensively even though the caller is expected to have already
      // clamped this — an out-of-range atempo value is a hard ffmpeg failure.
      const safePlaybackRate = Math.max(0.5, Math.min(2, Number(voicePlaybackRate) || 1));
      const sourceVoiceDuration = availableVoiceDuration * safePlaybackRate;
      const voiceName = "thirty-days-voice.mp3";
      finalName = "thirty-days-final.mp4";
      cleanup.add(voiceName);
      cleanup.add(finalName);
      await ffmpeg.writeFile(voiceName, await fetchBytes(voiceUrl, "voiceover"));
      onProgress?.(85);
      const timings = Array.isArray(voiceClipTimings)
        ? voiceClipTimings.filter((item) => Number(item?.sourceEnd) > Number(item?.sourceStart) && Number(item?.targetDuration) > 0).slice(0, clips.length)
        : [];
      const hasPerClipTiming = timings.length === clips.length;
      const perClipVoiceFilter = hasPerClipTiming ? (() => {
        const parts = timings.map((item, index) => {
          const sourceStart = Math.max(0, Number(item.sourceStart).toFixed(3));
          const sourceEnd = Math.max(sourceStart + 0.02, Number(item.sourceEnd).toFixed(3));
          const target = Math.max(0.2, Number(item.targetDuration));
          const rate = (sourceEnd - sourceStart) / target;
          return `[1:a]atrim=start=${sourceStart}:end=${sourceEnd},asetpts=PTS-STARTPTS,${atempoFilters(rate)}[voice${index}]`;
        });
        const inputs = timings.map((_, index) => `[voice${index}]`).join("");
        return `${parts.join(";")};${inputs}concat=n=${timings.length}:v=0:a=1[voice]`;
      })() : `[1:a]atrim=0:${sourceVoiceDuration},asetpts=PTS-STARTPTS,atempo=${safePlaybackRate},adelay=${audioDelayMs}|${audioDelayMs}[voice]`;
      await run(ffmpeg, [
        "-i", visualName,
        "-i", voiceName,
        "-filter_complex",
        `[0:a]asetpts=PTS-STARTPTS[bed];${perClipVoiceFilter};[bed][voice]amix=inputs=2:duration=first:dropout_transition=0[a]`,
        "-map", "0:v:0",
        "-map", "[a]",
        "-c:v", "copy",
        "-c:a", "aac",
        "-ar", "44100",
        "-ac", "2",
        "-movflags", "+faststart",
        finalName,
      ], "mixing voiceover");
    }

    const output = await ffmpeg.readFile(finalName);
    const blob = new Blob([output.buffer], { type: "video/mp4" });
    const url = URL.createObjectURL(blob);
    onProgress?.(100);
    return { blob, url };
  } catch (error) {
    if (error?.stage) throw error;
    throw stageError("render", "Couldn't render the final video.", error);
  } finally {
    await Promise.all([...cleanup].map((name) => ffmpeg.deleteFile(name).catch(() => {})));
  }
}

// @ffmpeg/ffmpeg exposes one shared WASM filesystem/process. React StrictMode
// and quick retries can otherwise run two exports at once, letting one
// cleanup delete another render's thirty-days-in-*.mp4 files. Serialize every
// 30 Days export and keep the queue alive after failures.
export function stitchThirtyDaysVideo(options) {
  const task = thirtyDaysRenderQueue.then(
    () => stitchThirtyDaysVideoUnlocked(options),
    () => stitchThirtyDaysVideoUnlocked(options),
  );
  thirtyDaysRenderQueue = task.catch(() => undefined);
  return task;
}
