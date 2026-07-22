import {
  buildAdaptiveCaptionGroups,
  visibleCaptionWords,
} from "../captionGrouping";

let ffmpegPromise = null;
let cookingRenderQueue = Promise.resolve();

const OUTPUT_W = 720;
const OUTPUT_H = 1280;
// Cooking providers currently return 24 fps clips. Keeping that frame rate
// avoids manufacturing 25% more frames before the final caption pass.
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
    ffmpeg.on("log", ({ message }) => console.log("[cooking-stitch]", message));
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
      throw stageError("render", "Couldn't render the final cooking video.", new Error(`${description}: ffmpeg exited ${code}`));
    }
  } finally {
    if (progressListener) ffmpeg.off("progress", progressListener);
  }
}

function captionAccent(styleId) {
  if (styleId?.includes("cyan") || styleId === "blue-box") return "#20DFFF";
  if (styleId?.includes("lime") || styleId?.includes("green")) return "#35FF58";
  if (styleId?.includes("red") || styleId === "orange-label") return "#FF4A2F";
  if (styleId?.includes("pink")) return "#FF43E8";
  return "#FFE000";
}

function captionExportStyle(styleId) {
  const style = {
    uppercase: true,
    fontFamily: "Impact, 'Arial Black', Arial, sans-serif",
    fontWeight: 900,
    fontScale: 1,
    fill: "#FFFFFF",
    inactiveFill: "#FFFFFF",
    accent: captionAccent(styleId),
    outline: "rgba(0,0,0,0.98)",
    outlineRatio: 0.085,
    gapEm: 0.18,
  };
  if (styleId === "white-punch") return { ...style, inactiveFill: "rgba(255,255,255,0.28)", accent: "#FFFFFF", fontScale: 1.08 };
  if (styleId === "cyan-impact") return { ...style, fontFamily: "'Arial Black', Arial, sans-serif", accent: "#13D9FF", glow: "#13D9FF", fontScale: 1.12 };
  if (styleId === "lime-karaoke") return { ...style, fontFamily: "'Arial Black', Arial, sans-serif", accent: "#00FF48", glow: "rgba(0,255,72,0.8)" };
  if (styleId === "red-white") return { ...style, fontFamily: "'Arial Black', Arial, sans-serif", accent: "#FF3B20" };
  if (styleId === "green-stack" || styleId === "two-line-pop") return { ...style, accent: "#2DFF55", glow: "rgba(45,255,85,0.75)" };
  if (styleId === "clean-subtitle") return {
    ...style,
    uppercase: false,
    fontFamily: "Arial, sans-serif",
    fontScale: 0.72,
    inactiveFill: "rgba(255,255,255,0.76)",
    accent: "#FFFFFF",
    outlineRatio: 0,
    blockBackground: "rgba(0,0,0,0.62)",
    blockRadius: 14,
    blockPadX: 18,
    blockPadY: 12,
    gapEm: 0.14,
  };
  if (styleId === "soft-white-glow") return { ...style, accent: "#FFFFFF", inactiveFill: "rgba(255,255,255,0.8)", glow: "rgba(255,255,255,0.95)", outlineRatio: 0.045 };
  if (styleId === "yellow-box") return { ...style, fontFamily: "'Arial Black', Arial, sans-serif", activeBackground: "#FFE000", activeFill: "#111111", wordPadX: 10, wordPadY: 5, wordRadius: 6, gapEm: 0.12 };
  if (styleId === "blue-box") return { ...style, fontFamily: "'Arial Black', Arial, sans-serif", activeBackground: "#29D7FF", activeFill: "#071014", wordPadX: 10, wordPadY: 5, wordRadius: 6, gapEm: 0.12 };
  if (styleId === "typewriter-clean") return { ...style, uppercase: false, fontFamily: "Arial, sans-serif", fontScale: 0.8, inactiveFill: "rgba(255,255,255,0.38)", accent: "#FFFFFF", outlineRatio: 0 };
  if (styleId === "typewriter-bold") return { ...style, fontFamily: "'Arial Black', Arial, sans-serif", fontScale: 0.82, inactiveFill: "rgba(255,255,255,0.25)", accent: "#FFE000" };
  if (styleId === "red-glitch") return { ...style, accent: "#FF1F1F", inactiveFill: "rgba(255,255,255,0.78)", glitch: true, fontScale: 0.9 };
  if (styleId === "motion-blur") return { ...style, accent: "#FFFFFF", motionBlur: true, fontScale: 1.14 };
  if (styleId === "pink-neon") return { ...style, fontFamily: "'Arial Black', Arial, sans-serif", accent: "#FF35EA", glow: "#FF35EA", fontScale: 1.12, outlineRatio: 0.03 };
  if (styleId === "orange-label") return { ...style, fontFamily: "'Arial Black', Arial, sans-serif", activeBackground: "#FF3B20", activeFill: "#FFFFFF", wordPadX: 11, wordPadY: 5, wordRadius: 5, gapEm: 0.12 };
  if (styleId === "split-cyan") return { ...style, fontFamily: "'Arial Black', Arial, sans-serif", italic: true, accent: "#19E6FF", glow: "rgba(25,230,255,0.8)", fontScale: 0.88 };
  if (styleId === "white-black-bubble") return { ...style, fontFamily: "'Arial Black', Arial, sans-serif", wordBackground: "rgba(0,0,0,0.94)", wordPadX: 12, wordPadY: 6, wordRadius: 999, gapEm: 0.13, outlineRatio: 0 };
  if (styleId === "serif-premium") return { ...style, uppercase: false, fontFamily: "Georgia, 'Times New Roman', serif", accent: "#FFFFFF", fill: "#F8F4EC", inactiveFill: "#F8F4EC", glow: "rgba(255,255,255,0.55)", outlineRatio: 0.025, fontScale: 0.92 };
  if (styleId === "gray-italic") return { ...style, uppercase: false, fontFamily: "Arial, sans-serif", italic: true, inactiveFill: "rgba(255,255,255,0.58)", accent: "#FFFFFF", outlineRatio: 0.035, fontScale: 0.9 };
  if (styleId === "keyword-badge") return { ...style, fontFamily: "'Arial Black', Arial, sans-serif", accent: "#FFE000", fontScale: 0.9 };
  if (styleId === "red-streak") return { ...style, fontFamily: "'Arial Narrow', 'Arial Black', Arial, sans-serif", accent: "#FF2A2A", glow: "rgba(255,42,42,0.85)", blockBackground: "rgba(100,0,0,0.34)", blockRadius: 5, blockPadX: 15, blockPadY: 8, fontScale: 0.86 };
  if (styleId === "small-caps") return { ...style, fontFamily: "Arial, sans-serif", accent: "#3CEBFF", glow: "rgba(60,235,255,0.8)", outlineRatio: 0.035, fontScale: 0.74 };
  if (styleId === "soft-pill") return { ...style, uppercase: false, fontFamily: "Arial, sans-serif", fontScale: 0.8, inactiveFill: "rgba(255,255,255,0.72)", activeBackground: "#FFFFFF", activeFill: "#111111", blockBackground: "rgba(0,0,0,0.58)", blockRadius: 16, blockPadX: 14, blockPadY: 10, wordPadX: 9, wordPadY: 3, wordRadius: 8, outlineRatio: 0, gapEm: 0.12 };
  if (styleId === "shadow-depth") return { ...style, uppercase: false, accent: "#FFFFFF", inactiveFill: "rgba(255,255,255,0.8)", depthShadow: true, fontScale: 1.02 };
  return style;
}

function roundedRect(context, x, y, width, height, radius) {
  const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
  context.beginPath();
  if (typeof context.roundRect === "function") {
    context.roundRect(x, y, width, height, safeRadius);
  } else {
    context.moveTo(x + safeRadius, y);
    context.lineTo(x + width - safeRadius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
    context.lineTo(x + width, y + height - safeRadius);
    context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
    context.lineTo(x + safeRadius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
    context.lineTo(x, y + safeRadius);
    context.quadraticCurveTo(x, y, x + safeRadius, y);
    context.closePath();
  }
  context.fill();
}

async function renderCaptionFrame({ words, activeIndex, x = 50, y = 76, scale = 1, styleId }) {
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_W;
  canvas.height = OUTPUT_H;
  const context = canvas.getContext("2d");
  const style = captionExportStyle(styleId);
  const labels = words.map(word => String(word.word || "").trim()).filter(Boolean);
  if (labels.length) {
    let fontSize = Math.max(28, Math.min(92, 62 * Number(scale || 1) * style.fontScale));
    const setFont = () => { context.font = `${style.italic ? "italic " : ""}${style.fontWeight} ${fontSize}px ${style.fontFamily}`; };
    const measureLine = () => {
      // Use em-based optical spacing rather than a large fixed minimum. This
      // keeps short words close while still leaving room for their outlines.
      const gap = Math.max(style.wordBackground || style.activeBackground ? 6 : 8, Math.min(16, fontSize * style.gapEm));
      const widths = labels.map(label => context.measureText(style.uppercase ? label.toUpperCase() : label).width + Number(style.wordPadX || 0) * 2);
      return {
        gap,
        widths,
        totalWidth: widths.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, labels.length - 1),
      };
    };
    setFont();
    let metrics = measureLine();
    while (fontSize > 32 && metrics.totalWidth > OUTPUT_W * 0.86) {
      fontSize -= 2;
      setFont();
      metrics = measureLine();
    }
    const { gap, widths, totalWidth } = metrics;
    let cursor = Math.max(16, Math.min(OUTPUT_W - totalWidth - 16, (Number(x) / 100) * OUTPUT_W - totalWidth / 2));
    const baseline = Math.max(fontSize, Math.min(OUTPUT_H - 24, (Number(y) / 100) * OUTPUT_H + fontSize * 0.35));
    context.lineJoin = "round";
    context.miterLimit = 2;
    context.lineWidth = style.outlineRatio > 0 ? Math.max(2, fontSize * style.outlineRatio) : 0;
    context.strokeStyle = style.outline;
    if (style.blockBackground) {
      context.fillStyle = style.blockBackground;
      roundedRect(
        context,
        cursor - Number(style.blockPadX || 0),
        baseline - fontSize - Number(style.blockPadY || 0) * 0.65,
        totalWidth + Number(style.blockPadX || 0) * 2,
        fontSize * 1.2 + Number(style.blockPadY || 0) * 1.3,
        Number(style.blockRadius || 0),
      );
    }
    labels.forEach((label, index) => {
      const active = index === activeIndex;
      const shown = style.uppercase ? label.toUpperCase() : label;
      const padX = Number(style.wordPadX || 0);
      const padY = Number(style.wordPadY || 0);
      const textX = cursor + padX;
      const background = active ? style.activeBackground || style.wordBackground : style.wordBackground;
      if (background) {
        context.fillStyle = background;
        roundedRect(context, cursor, baseline - fontSize - padY * 0.65, widths[index], fontSize * 1.18 + padY * 1.3, Number(style.wordRadius || 0));
      }
      context.save();
      context.fillStyle = active ? style.activeFill || style.accent : style.inactiveFill || style.fill;
      if (active && style.glow) {
        context.shadowColor = style.glow;
        context.shadowBlur = Math.max(8, fontSize * 0.22);
      }
      if (style.depthShadow) {
        context.shadowColor = "rgba(0,0,0,0.9)";
        context.shadowOffsetY = Math.max(4, fontSize * 0.09);
        context.shadowBlur = Math.max(5, fontSize * 0.12);
      }
      if (active && style.glitch) {
        context.fillStyle = "rgba(0,240,255,0.75)";
        context.fillText(shown, textX + 3, baseline);
        context.fillStyle = "rgba(255,0,30,0.75)";
        context.fillText(shown, textX - 3, baseline);
        context.fillStyle = style.accent;
      }
      if (active && style.motionBlur) {
        context.globalAlpha = 0.28;
        context.fillText(shown, textX - 14, baseline);
        context.fillText(shown, textX + 14, baseline);
        context.globalAlpha = 1;
      }
      if (context.lineWidth > 0) context.strokeText(shown, textX, baseline);
      context.fillText(shown, textX, baseline);
      context.restore();
      cursor += widths[index] + gap;
    });
  }
  const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Caption frame encoding failed")), "image/png"));
  return new Uint8Array(await blob.arrayBuffer());
}

function buildCaptionPhases(captionData, cookingDuration) {
  const overlays = Array.isArray(captionData?.textOverlays) ? captionData.textOverlays : [];
  const rawPhases = [];
  overlays
    .slice()
    .sort((a, b) => Number(a.start || 0) - Number(b.start || 0))
    .forEach((overlay) => {
      const words = Array.isArray(overlay.words) && overlay.words.length ? overlay.words : [];
      const groups = buildAdaptiveCaptionGroups(words, { styleId: overlay.styleId, maxWords: 3, maxChars: 30 });
      groups.forEach((group) => {
        group.words.forEach((word, activeSourceIndex) => {
          const start = Math.max(0, Number(word.start ?? overlay.start ?? 0));
          const nextWord = group.words[activeSourceIndex + 1];
          const end = Math.min(
            cookingDuration,
            Number(nextWord?.start ?? group.end ?? overlay.end ?? word.end ?? start + 0.3),
          );
          if (end <= start) return;
          const visible = visibleCaptionWords(group.words, activeSourceIndex, overlay.styleId);
          rawPhases.push({
            start,
            end,
            words: visible.words,
            activeIndex: visible.activeIndex,
            x: overlay.x,
            y: overlay.y,
            scale: overlay.scale,
            styleId: overlay.styleId,
          });
        });
      });
    });
  const sorted = rawPhases.sort((a, b) => a.start - b.start || a.end - b.end);
  const phases = [];
  for (let index = 0; index < sorted.length; index += 1) {
    const phase = sorted[index];
    const previousEnd = phases[phases.length - 1]?.end ?? 0;
    // Preview renders only the first active caption. Apply the same rule to
    // export by discarding a competing phase that begins under the active one.
    if (phase.start < previousEnd - 0.015) continue;
    const start = Math.max(0, phase.start, previousEnd);
    const end = Math.min(cookingDuration, phase.end);
    if (end <= start + 0.025) continue;
    phases.push({ ...phase, start, end });
  }
  return phases;
}

async function writeCaptionSequence(ffmpeg, captionData, cookingDuration, totalDuration, cleanup, onProgress) {
  const phases = buildCaptionPhases(captionData, cookingDuration);
  if (!phases.length) return null;
  const segments = [];
  let cursor = 0;
  const transparent = { words: [], activeIndex: 0, x: 50, y: 76, scale: 1 };
  for (const phase of phases) {
    if (cursor >= totalDuration) break;
    const start = Math.max(cursor, phase.start);
    if (start > cursor + 0.015) segments.push({ ...transparent, duration: start - cursor });
    const end = Math.min(totalDuration, Math.max(start + 0.04, phase.end));
    if (end <= start) continue;
    segments.push({ ...phase, duration: end - start });
    cursor = end;
  }
  if (cursor < totalDuration) segments.push({ ...transparent, duration: totalDuration - cursor });

  const lines = ["ffconcat version 1.0"];
  for (let index = 0; index < segments.length; index += 1) {
    const name = `cooking-caption-${index}.png`;
    cleanup.add(name);
    await ffmpeg.writeFile(name, await renderCaptionFrame(segments[index]));
    lines.push(`file '${name}'`, `duration ${Math.max(0.04, segments[index].duration).toFixed(4)}`);
    onProgress?.((index + 1) / segments.length);
  }
  const finalName = `cooking-caption-${segments.length - 1}.png`;
  lines.push(`file '${finalName}'`);
  const listName = "cooking-captions.txt";
  cleanup.add(listName);
  await ffmpeg.writeFile(listName, new TextEncoder().encode(lines.join("\n")));
  return listName;
}

/**
 * Normalizes and joins silent generated clips with the voiced watermark.
 * A silent stereo AAC track is added to every generated clip so all segments
 * have identical stream layouts before the lightweight concat step.
 */
async function stitchCookingVideoUnlocked({ clips, watermarkUrl, watermarkDuration = 6, voiceUrl, captionData = null, onProgress }) {
  if (!clips?.length) throw stageError("render", "No cooking clips are ready.");

  const ffmpeg = await getFFmpeg();
  const segments = [
    ...clips.map((clip) => ({ ...clip, duration: clip.duration || 6, hasAudio: false })),
    { url: watermarkUrl, duration: watermarkDuration, hasAudio: true, watermark: true },
  ];
  const normalized = [];
  const cleanup = new Set();

  try {
    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      const inputName = `cooking-in-${index}.mp4`;
      const outputName = `cooking-segment-${index}.mp4`;
      cleanup.add(inputName);
      cleanup.add(outputName);
      await ffmpeg.writeFile(inputName, await fetchBytes(
        segment.url,
        segment.watermark ? "watermark video" : `cooking clip ${index + 1}`,
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
          onProgress?.(Math.round(4 + ((index + progress) / segments.length) * 50));
        });
      } else {
        // Generated cooking clips already use the required 720x1280 H.264
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
          console.warn(`[cooking-stitch] fast copy failed for clip ${index + 1}; normalizing instead`, copyError);
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
            onProgress?.(Math.round(4 + ((index + progress) / segments.length) * 50));
          });
        }
      }

      normalized.push(outputName);
      await ffmpeg.deleteFile(inputName).catch(() => {});
      cleanup.delete(inputName);
      onProgress?.(Math.round(4 + ((index + 1) / segments.length) * 50));
    }

    const listName = "cooking-list.txt";
    const joinedName = "cooking-joined.mp4";
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
    onProgress?.(60);

    const cookingDuration = clips.reduce((total, clip) => total + (clip.duration || 6), 0);
    const totalDuration = cookingDuration + watermarkDuration;
    let visualName = joinedName;
    const captionListName = await writeCaptionSequence(
      ffmpeg,
      captionData,
      cookingDuration,
      totalDuration,
      cleanup,
      (progress) => onProgress?.(Math.round(62 + progress * 10)),
    );
    if (captionListName) {
      const captionedName = "cooking-captioned.mp4";
      cleanup.add(captionedName);
      await run(ffmpeg, [
        "-i", joinedName,
        "-f", "concat",
        "-safe", "0",
        "-i", captionListName,
        "-filter_complex", "[0:v]setpts=PTS-STARTPTS[base];[1:v]setpts=PTS-STARTPTS,format=rgba[caption];[base][caption]overlay=0:0:eof_action=pass[v]",
        "-map", "[v]",
        "-map", "0:a:0",
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-pix_fmt", "yuv420p",
        "-c:a", "copy",
        "-movflags", "+faststart",
        captionedName,
      ], "burning captions", (progress) => {
        onProgress?.(Math.round(72 + progress * 22));
      });
      visualName = captionedName;
      onProgress?.(94);
    }

    let finalName = visualName;
    if (voiceUrl) {
      const audioOffset = Math.max(0, Math.min(cookingDuration - 0.1, Number(captionData?.audioOffset) || 0));
      const audioDelayMs = Math.round(audioOffset * 1000);
      const availableVoiceDuration = Math.max(0.1, cookingDuration - audioOffset);
      const voicePlaybackRate = Math.max(0.5, Math.min(2, Number(captionData?.voicePlaybackRate) || 1));
      const sourceVoiceDuration = availableVoiceDuration * voicePlaybackRate;
      const voiceName = "cooking-voice.mp3";
      finalName = "cooking-final.mp4";
      cleanup.add(voiceName);
      cleanup.add(finalName);
      await ffmpeg.writeFile(voiceName, await fetchBytes(voiceUrl, "voiceover"));
      onProgress?.(96);
      await run(ffmpeg, [
        "-i", visualName,
        "-i", voiceName,
        "-filter_complex",
        `[0:a]asetpts=PTS-STARTPTS[bed];[1:a]atrim=0:${sourceVoiceDuration},asetpts=PTS-STARTPTS,atempo=${voicePlaybackRate},adelay=${audioDelayMs}|${audioDelayMs}[voice];[bed][voice]amix=inputs=2:duration=first:dropout_transition=0[a]`,
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
    throw stageError("render", "Couldn't render the final cooking video.", error);
  } finally {
    await Promise.all([...cleanup].map((name) => ffmpeg.deleteFile(name).catch(() => {})));
  }
}

// @ffmpeg/ffmpeg exposes one shared WASM filesystem/process. React StrictMode
// and quick retries can otherwise run two exports at once, letting one
// cleanup delete another render's cooking-in-*.mp4 files. Serialize every
// cooking export and keep the queue alive after failures.
export function stitchCookingVideo(options) {
  const task = cookingRenderQueue.then(
    () => stitchCookingVideoUnlocked(options),
    () => stitchCookingVideoUnlocked(options),
  );
  cookingRenderQueue = task.catch(() => undefined);
  return task;
}
