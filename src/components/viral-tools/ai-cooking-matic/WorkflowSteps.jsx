// WorkflowSteps.jsx — Step 2 (Voice) and Step 3 (Captions) panels
import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronUp, Download, FolderOpen, Loader2, Mic, Play, RefreshCw, RotateCcw, Send, SkipForward, Sparkles, Square, Upload, X, Zap } from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import { saveFullVideo } from "../../../lib/jobs";
import { uploadForExternalFetch } from "../../../lib/storage";
import { CAPTION_PRESETS, TEXT_SPEEDS } from "./CaptionPreviewPanel";
import { stitchCookingVideo } from "./videoEditor/ffmpegStitcher";
import { updateCookingMaticFullVideo } from "./api/cookingMaticApi";
import { saveMediaToDevice } from "../../../lib/downloadMedia";

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;
const CAPTION_TIMING_VERSION = 3;
const COOKING_VOICE_TIMELINE_SEC = 30;
const cookingFinalRenderJobs = new Map();

function cookingVoicePlaybackRate(durationSec, targetDurationSec = COOKING_VOICE_TIMELINE_SEC) {
  const duration = Number(durationSec);
  const target = Number(targetDurationSec);
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(target) || target <= 0) return 1;
  return Math.max(0.5, Math.min(2, duration / target));
}

function getCookingFinalRenderJob(key, options, onProgress) {
  let job = cookingFinalRenderJobs.get(key);
  if (!job) {
    job = { listeners: new Set(), progress: 0, promise: null };
    job.promise = stitchCookingVideo({
      ...options,
      onProgress: (progress) => {
        const nextProgress = Math.max(job.progress, Math.min(100, Math.round(Number(progress) || 0)));
        if (nextProgress === job.progress) return;
        job.progress = nextProgress;
        job.listeners.forEach(listener => listener(nextProgress));
      },
    }).then(({ blob, url }) => {
      URL.revokeObjectURL(url);
      return blob;
    }).finally(() => {
      window.setTimeout(() => {
        if (cookingFinalRenderJobs.get(key) === job) cookingFinalRenderJobs.delete(key);
      }, 30_000);
    });
    cookingFinalRenderJobs.set(key, job);
  }
  job.listeners.add(onProgress);
  onProgress(job.progress);
  return {
    promise: job.promise,
    unsubscribe: () => job.listeners.delete(onProgress),
  };
}

function hasCurrentProviderTiming(captionScript) {
  const source = String(captionScript?.timingSource || "");
  const version = Number(captionScript?.timingVersion || 0);
  // Version-2 generated takes already contain ElevenLabs' native TTS
  // alignment, so keep that exact data. Version-2 Whisper/import timings are
  // refreshed through ElevenLabs Scribe v2 or Forced Alignment.
  const acceptedVersion = /elevenlabs-character-alignment/i.test(source)
    ? version >= 2
    : version >= CAPTION_TIMING_VERSION;
  return acceptedVersion
    && /alignment|timestamps/i.test(source)
    && Array.isArray(captionScript?.words)
    && captionScript.words.length > 0;
}

/* ── ElevenLabs default-library voices with traits ────────────────────────── */
/* id = ElevenLabs voice_id — keep in sync with VALID_VOICES in the
   cooking-voice-generate / cooking-voice-preview edge functions. */
const VOICES = [
  // 🔥 Viral picks — best for TikTok/cooking content
  { id: "TxGEqnHWrfWFTfGW9XjX", label: "Josh",   viral: true,  traits: ["Energetic", "Youthful"], desc: "High energy — made for viral content" },
  { id: "AZnzlk1XvdvUeBnXmlld", label: "Domi",   viral: true,  traits: ["Confident", "Bold"],     desc: "Strong, punchy delivery for hooks" },
  { id: "ErXwobaYiN019PkySvjV", label: "Antoni", viral: true,  traits: ["Warm", "Engaging"],      desc: "Friendly narrator, great for cooking" },
  // Standard voices
  { id: "21m00Tcm4TlvDq8ikWAM", label: "Rachel", viral: false, traits: ["Calm", "Clear"],         desc: "Balanced, natural narration" },
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Bella",  viral: false, traits: ["Soft", "Gentle"],        desc: "Light and approachable" },
  { id: "pNInz6obpgDQGcFmaJgB", label: "Adam",   viral: false, traits: ["Deep", "Authoritative"], desc: "Bold, commanding presence" },
  { id: "JBFqnCBsd6RMkjVDRZzb", label: "George", viral: false, traits: ["Warm", "Narrative"],      desc: "Polished storyteller with a rich tone" },
  { id: "nPczCjzI2devNBz1zQrb", label: "Brian",  viral: false, traits: ["Mature", "Smooth"],        desc: "Steady, trustworthy recipe narration" },
  { id: "onwK4e9ZLuTAKqWW03F9", label: "Daniel", viral: false, traits: ["Deep", "British"],        desc: "Confident presenter with a premium feel" },
  { id: "XrExE9yKIg1WjnnlVkGX", label: "Matilda", viral: false, traits: ["Warm", "Friendly"],       desc: "Natural, inviting creator voice" },
  { id: "cgSgspJ2msm6clMCkdW9", label: "Jessica", viral: false, traits: ["Expressive", "Bright"],  desc: "Lively delivery for quick food videos" },
  { id: "Xb7hH8MSUJpSbSDYk0k2", label: "Alice",  viral: false, traits: ["Clear", "British"],       desc: "Crisp, confident instructional voice" },
];

const VOICE_UPDATES = {
  "TxGEqnHWrfWFTfGW9XjX": { desc: "Fast, bright delivery for viral cooking hooks", vibe: "TikTok energy" },
  "AZnzlk1XvdvUeBnXmlld": { desc: "Punchy, confident narration for satisfying recipes", vibe: "Creator favorite" },
  "ErXwobaYiN019PkySvjV": { desc: "Expressive pacing for story-style food videos", vibe: "Story mode" },
  "21m00Tcm4TlvDq8ikWAM": { vibe: "Clean" },
  "EXAVITQu4vr4xnSDxMaL": { vibe: "Soft" },
  "pNInz6obpgDQGcFmaJgB": { vibe: "Deep" },
  "JBFqnCBsd6RMkjVDRZzb": { vibe: "Storyteller" },
  "nPczCjzI2devNBz1zQrb": { vibe: "Trusted" },
  "onwK4e9ZLuTAKqWW03F9": { vibe: "Presenter" },
  "XrExE9yKIg1WjnnlVkGX": { vibe: "Friendly" },
  "cgSgspJ2msm6clMCkdW9": { vibe: "Creator" },
  "Xb7hH8MSUJpSbSDYk0k2": { vibe: "Crisp" },
};

const getVoice = (id) => {
  const voice = VOICES.find(v => v.id === id) ?? VOICES[0];
  return { ...voice, ...(VOICE_UPDATES[voice.id] ?? {}) };
};

const CAPTION_WORDS_PER_SECOND = 3.2;

function buildTimedCaptionScript(text, durationSec = 30) {
  const clean = String(text || "").trim();
  const words = clean.split(/\s+/).filter(Boolean);
  const safeDuration = Math.max(1, Number(durationSec) || 30);
  const secondsPerWord = words.length > 0
    ? Math.max(0.18, Math.min(0.52, safeDuration / words.length))
    : 1 / CAPTION_WORDS_PER_SECOND;
  const timedWords = words.map((word, i) => ({
    word,
    start: Number((i * secondsPerWord).toFixed(2)),
    end: Number(((i + 1) * secondsPerWord).toFixed(2)),
  }));
  const segments = [];
  for (let i = 0; i < timedWords.length; i += 5) {
    const chunk = timedWords.slice(i, i + 5);
    if (chunk.length) segments.push({ text: chunk.map(w => w.word).join(" "), start: chunk[0].start, end: chunk[chunk.length - 1].end });
  }
  return { script: clean, words: timedWords, segments };
}

function buildCookingFallbackScript(dish, durationSec = 30) {
  const safeDish = String(dish || "this dish").trim();
  const clips = [
    [`Here's how to make ${safeDish}.`, "Set that finished plate aside.", "Get every ingredient measured and ready."],
    ["Carefully prep the main ingredients.", "Set the knife down safely.", "Now transfer everything into the bowl."],
    ["Add the seasoning in a steady stream.", "Fold until every piece is evenly coated.", "Tip the mixture into the cooking vessel."],
    ["Cook it through, turning every piece evenly.", "Let the surfaces brown naturally.", "Plate it and add the final finish."],
    ["Bring back that same finished dish.", "Set it down gently.", "Save this recipe and try it tonight."],
  ];
  const safeDuration = Math.max(30, Number(durationSec) || 30);
  const clipDuration = safeDuration / clips.length;
  const beatDuration = clipDuration / 3;
  const words = [];
  const segments = [];
  const beatSegments = [];
  const clipSegments = [];

  clips.forEach((beats, clipIndex) => {
    const clipStart = clipIndex * clipDuration;
    const clipEnd = (clipIndex + 1) * clipDuration;
    clipSegments.push({ clip: clipIndex + 1, text: beats.join(" "), start: clipStart, end: clipEnd });
    beats.forEach((text, beatIndex) => {
      const beatStart = clipStart + beatIndex * beatDuration;
      const beatEnd = beatStart + beatDuration;
      const tokens = text.split(/\s+/).filter(Boolean);
      const spokenStart = beatStart + 0.06;
      const spokenEnd = beatEnd - 0.06;
      const secondsPerWord = (spokenEnd - spokenStart) / Math.max(1, tokens.length);
      const beatWords = tokens.map((word, wordIndex) => ({
        word,
        start: Number((spokenStart + wordIndex * secondsPerWord).toFixed(2)),
        end: Number((spokenStart + (wordIndex + 1) * secondsPerWord).toFixed(2)),
        clip: clipIndex + 1,
        beat: beatIndex + 1,
      }));
      words.push(...beatWords);
      beatSegments.push({ clip: clipIndex + 1, beat: beatIndex + 1, text, start: beatStart, end: beatEnd });
      for (let index = 0; index < beatWords.length; index += 4) {
        const group = beatWords.slice(index, index + 4);
        segments.push({ text: group.map(item => item.word).join(" "), start: group[0].start, end: group[group.length - 1].end });
      }
    });
  });

  return {
    script: clips.map(beats => beats.join(" ")).join("\n"),
    words,
    segments,
    clipSegments,
    beatSegments,
    timingVersion: 3,
    timingSource: "cooking-local-beat-fallback",
    fallback: true,
  };
}

function mergeVoiceAlignmentWithBeatPlan(providerTiming, beatPlan, playbackRate = 1) {
  if (!Array.isArray(providerTiming?.words) || !providerTiming.words.length) {
    return beatPlan ?? providerTiming ?? null;
  }
  if (!Array.isArray(beatPlan?.words) || !beatPlan.words.length) return providerTiming;

  const safeRate = Math.max(0.5, Math.min(2, Number(playbackRate) || 1));
  const timelineTime = value => Number(((Number(value) || 0) / safeRate).toFixed(3));
  const words = providerTiming.words.map((word, index) => ({
    ...word,
    start: timelineTime(word.start),
    end: timelineTime(word.end),
    clip: beatPlan.words[index]?.clip,
    beat: beatPlan.words[index]?.beat,
  }));
  const segments = Array.isArray(providerTiming.segments)
    ? providerTiming.segments.map(segment => ({
      ...segment,
      start: timelineTime(segment.start),
      end: timelineTime(segment.end),
    }))
    : [];
  const timedGroup = (planItem, matcher) => {
    const group = words.filter(matcher);
    return {
      ...planItem,
      plannedStart: planItem.start,
      plannedEnd: planItem.end,
      start: group[0]?.start ?? planItem.start,
      end: group[group.length - 1]?.end ?? planItem.end,
    };
  };
  const clipSegments = Array.isArray(beatPlan.clipSegments)
    ? beatPlan.clipSegments.map(item => timedGroup(item, word => word.clip === item.clip))
    : [];
  const beatSegments = Array.isArray(beatPlan.beatSegments)
    ? beatPlan.beatSegments.map(item => timedGroup(item, word => word.clip === item.clip && word.beat === item.beat))
    : [];

  return {
    ...beatPlan,
    ...providerTiming,
    words,
    segments,
    clipSegments,
    beatSegments,
    playbackRate: safeRate,
    timelineDurationSec: COOKING_VOICE_TIMELINE_SEC,
    timelineNormalized: true,
  };
}

const voicePreviewCache = new Map();

// Safari/WebKit throws NotSupportedError when an <audio> element plays from a
// blob: URL created via URL.createObjectURL() — a long-standing WebKit bug.
// A base64 data: URI sidesteps it and works everywhere (Chrome, Safari, iOS webviews).
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64, mimeType = "audio/mpeg") {
  const binary = window.atob(String(base64 || ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mimeType });
}

function probeAudioDuration(url) {
  return new Promise((resolve) => {
    const audio = new Audio();
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      audio.removeAttribute("src");
      resolve(Number.isFinite(value) && value > 0 ? Number(value.toFixed(2)) : null);
    };
    const timeout = window.setTimeout(() => finish(null), 8000);
    audio.preload = "metadata";
    audio.onloadedmetadata = () => finish(audio.duration);
    audio.onerror = () => finish(null);
    audio.src = url;
  });
}

function waitForVideoEvent(video, eventName, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error = null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      video.removeEventListener(eventName, onEvent);
      video.removeEventListener("error", onError);
      if (error) reject(error);
      else resolve();
    };
    const onEvent = () => finish();
    const onError = () => finish(new Error("Video frame could not be read"));
    const timeout = window.setTimeout(() => finish(new Error("Video frame timed out")), timeoutMs);
    video.addEventListener(eventName, onEvent, { once: true });
    video.addEventListener("error", onError, { once: true });
  });
}

async function captureClipSpeechFrames(clip) {
  if (!clip?.videoUrl) return [];
  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";

  try {
    const metadataReady = waitForVideoEvent(video, "loadedmetadata");
    video.src = clip.videoUrl;
    video.load();
    await metadataReady;
    const sourceDuration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 6;
    const frameTimes = [1, 3, 5].map(value => Math.min(value, Math.max(0.05, sourceDuration - 0.08)));
    const frames = [];

    for (let beatIndex = 0; beatIndex < frameTimes.length; beatIndex += 1) {
      const seekReady = waitForVideoEvent(video, "seeked", 6000);
      video.currentTime = frameTimes[beatIndex];
      await seekReady;
      const canvas = document.createElement("canvas");
      canvas.width = 180;
      canvas.height = 320;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) continue;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push({
        clip: Number(clip.index) + 1,
        beat: beatIndex + 1,
        timeSec: frameTimes[beatIndex],
        imageUrl: canvas.toDataURL("image/jpeg", 0.58),
      });
    }
    return frames;
  } catch (error) {
    console.warn(`[cooking-script] could not sample clip ${Number(clip.index) + 1}`, error);
    return [];
  } finally {
    video.removeAttribute("src");
    video.load();
  }
}

async function captureCookingSpeechFrames(clips) {
  const ready = clips
    .filter(clip => clip?.videoUrl)
    .sort((a, b) => Number(a.index) - Number(b.index))
    .slice(0, 5);
  const frameGroups = await Promise.all(ready.map(captureClipSpeechFrames));
  return frameGroups.flat();
}

async function generateVoiceAudio({ voiceId, script, generationId }) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/cooking-voice-generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON,
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify({ voice: voiceId, script, generationId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (res.status === 409 || data.error === "VOICE_LIMIT_REACHED") {
      throw new Error("You have reached the generated voice limit for this creation. Imported audio is still unlimited.");
    }
    throw new Error(data.error || `Voice generation failed (${res.status})`);
  }
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const data = await res.json();
    const blob = base64ToBlob(data.audioBase64, data.mimeType || "audio/mpeg");
    const audioUrl = await blobToDataUrl(blob);
    return {
      audioUrl,
      audioBlob: blob,
      audioBytes: blob.size,
      mimeType: blob.type || "audio/mpeg",
      durationSec: Number(data.durationSec) || await probeAudioDuration(audioUrl),
      captionScript: data.captionScript,
    };
  }

  // Backward compatibility while the timestamp-enabled edge function rolls out.
  const blob = await res.blob();
  const audioUrl = await blobToDataUrl(blob);
  return {
    audioUrl,
    audioBlob: blob,
    audioBytes: blob.size,
    mimeType: blob.type || "audio/mpeg",
    durationSec: await probeAudioDuration(audioUrl),
  };
}

async function transcribeSpeechAudio(file, durationSec = 30, generationId = null, transcript = "") {
  const { data: { session } } = await supabase.auth.getSession();
  const form = new FormData();
  form.append("audio", file);
  form.append("durationSec", String(durationSec));
  form.append("generationId", generationId || "");
  if (String(transcript || "").trim()) form.append("transcript", String(transcript).trim());
  const res = await fetch(`${SUPABASE_URL}/functions/v1/cooking-speech-transcribe`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON,
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: form,
  });
  if (!res.ok) throw new Error("Speech transcription failed");
  return res.json();
}

function fitCaptionCardStyle(style = {}, active = false) {
  const next = { ...style };
  if (typeof next.fontSize === "number") {
    const cap = active ? 16 : 15;
    next.fontSize = Math.max(8, Math.min(cap, Number((next.fontSize * 0.58).toFixed(1))));
  }
  if (next.padding) next.padding = active ? "1px 4px" : "1px 3px";
  next.transform = undefined;
  next.lineHeight = 0.9;
  next.maxWidth = "100%";
  return next;
}

function CaptionStyleButton({ preset, active, onClick }) {
  const words = preset.demo.split(" ");
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex h-[58px] min-w-0 flex-col items-center justify-center overflow-hidden rounded-lg border transition ${
        active ? "border-orange-400 bg-orange-500/10 ring-1 ring-orange-300/35" : "border-white/[0.06] bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.06]"
      }`}
      style={{ background: preset.cardBg }}
    >
      <div className="flex w-full max-w-full flex-wrap items-center justify-center gap-x-0.5 gap-y-0 px-1 text-center">
        {words.map((word, index) => (
          <span
            key={`${preset.id}-${word}-${index}`}
            style={fitCaptionCardStyle(index === 0 ? preset.activeStyle : preset.wordStyle, index === 0)}
            className="inline-block max-w-full whitespace-nowrap leading-none"
          >
            {word}
          </span>
        ))}
      </div>
      {active && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-orange-400" />}
    </button>
  );
}

function WorkflowProgress({ current = 2 }) {
  const steps = ["Scenes", "Voice", "Captions"];
  return (
    <div className="shrink-0 border-b border-white/[0.06] px-4 py-3">
      <div className="flex items-center gap-2">
        {steps.map((label, index) => {
          const step = index + 1;
          const done = step < current;
          const active = step === current;
          return (
            <div key={label} className="flex flex-1 items-center gap-2">
              <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${
                done ? "bg-emerald-500 text-white" : active ? "bg-orange-500 text-white" : "bg-white/[0.08] text-white/30"
              }`}>
                {done ? <Check className="h-3.5 w-3.5" /> : step}
              </div>
              <span className={`truncate text-[11px] font-bold ${active ? "text-white" : done ? "text-emerald-300" : "text-white/28"}`}>{label}</span>
              {index < steps.length - 1 && <div className={`hidden h-px flex-1 sm:block ${done ? "bg-emerald-500/50" : "bg-white/[0.08]"}`} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Global preview coordinator ───────────────────────────────────────────────
   Only one voice preview should ever play at once. All VoicePreviewBtn
   instances share this singleton instead of managing their own <audio> —
   starting a new preview stops whatever else is currently playing, and a
   request-sequence counter drops stale responses so a slow first click can't
   steal playback back after a faster later click already won. ───────────── */
let activeAudio = null;
let previewAudioContext = null;
let activePreviewKey = null;
let previewRequestSeq = 0;
const previewListeners = new Set();

function notifyPreviewListeners() {
  previewListeners.forEach((fn) => fn(activePreviewKey));
}

function stopActivePreview() {
  previewRequestSeq++; // invalidate any in-flight request
  if (activeAudio) {
    try { activeAudio.pause?.(); } catch { /* already stopped */ }
    try { activeAudio.stop?.(); } catch { /* already stopped */ }
    try { activeAudio.disconnect?.(); } catch { /* already disconnected */ }
    activeAudio.onended = null;
    activeAudio.onerror = null;
  }
  activeAudio = null;
  activePreviewKey = null;
  notifyPreviewListeners();
}

function useActivePreviewKey() {
  const [key, setKey] = useState(activePreviewKey);
  useEffect(() => {
    previewListeners.add(setKey);
    return () => previewListeners.delete(setKey);
  }, []);
  return key;
}

/* ── Mini voice preview ───────────────────────────────────────────────────── */
function VoicePreviewBtn({ voiceId, dish, generationId = null, className = "" }) {
  const key = `${voiceId}:${dish || ""}`;
  const activeKey = useActivePreviewKey();
  const isPlaying = activeKey === key;
  const [loading, setLoading] = useState(false);

  const toggle = async (event) => {
    event?.stopPropagation();
    if (loading) return; // ignore rapid re-clicks on the same button
    if (isPlaying) { stopActivePreview(); return; }

    const mySeq = ++previewRequestSeq;
    // Resume Web Audio while the click still counts as a user gesture. ElevenLabs
    // can take several seconds to respond, which is long enough for browsers to
    // reject a later HTMLAudioElement.play() call as autoplay.
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!previewAudioContext && AudioContextClass) previewAudioContext = new AudioContextClass();
    const resumeAudio = previewAudioContext?.state === "suspended"
      ? previewAudioContext.resume()
      : Promise.resolve();
    setLoading(true);
    try {
      let audioBytes = voicePreviewCache.get(key);
      if (!audioBytes) {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`${SUPABASE_URL}/functions/v1/cooking-voice-preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON, ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
          body: JSON.stringify({ voice: voiceId, dish, generationId }),
        });
        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          throw new Error(`Preview request failed (${res.status})${detail ? `: ${detail}` : ""}`);
        }
        audioBytes = await res.arrayBuffer();
        voicePreviewCache.set(key, audioBytes);
      }
      // A newer click (this voice or another) already won — drop this stale response.
      if (mySeq !== previewRequestSeq) return;

      if (previewAudioContext) {
        await resumeAudio;
        const decoded = await previewAudioContext.decodeAudioData(audioBytes.slice(0));
        if (mySeq !== previewRequestSeq) return;
        const source = previewAudioContext.createBufferSource();
        source.buffer = decoded;
        source.connect(previewAudioContext.destination);
        source.onended = () => {
          if (activeAudio === source) stopActivePreview();
        };
        if (activeAudio) {
          try { activeAudio.stop?.(); } catch { /* already stopped */ }
          try { activeAudio.disconnect?.(); } catch { /* already disconnected */ }
          activeAudio.onended = null;
        }
        activeAudio = source;
        activePreviewKey = key;
        notifyPreviewListeners();
        source.start(0);
      } else {
        const url = await blobToDataUrl(new Blob([audioBytes], { type: "audio/mpeg" }));
        const audio = new Audio(url);
        audio.onended = () => stopActivePreview();
        audio.onerror = () => stopActivePreview();
        if (activeAudio) { activeAudio.pause?.(); activeAudio.onended = null; activeAudio.onerror = null; }
        activeAudio = audio;
        activePreviewKey = key;
        notifyPreviewListeners();
        await audio.play();
      }
    } catch (error) {
      console.error("[cooking-voice-preview]", error);
      if (mySeq === previewRequestSeq) stopActivePreview();
    } finally {
      setLoading(false);
    }
  };

  return (
    <button type="button" onClick={toggle}
      className={`flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
        isPlaying ? "bg-orange-500/20 text-orange-200 border border-orange-500/30" : "bg-white/[0.07] text-white/55 hover:text-white hover:bg-white/[0.12]"
      } ${className}`}>
      {loading ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : isPlaying ? <Square className="w-2.5 h-2.5 fill-current" /> : <Play className="w-2.5 h-2.5 fill-current" />}
      {loading ? "…" : isPlaying ? "Stop" : "Preview"}
    </button>
  );
}

/* ── Step 2: Voice ────────────────────────────────────────────────────────── */
function VoiceStepLegacy({ dish, onBack, onSkip, onGenerate }) {
  const [selectedVoice, setSelectedVoice] = useState("TxGEqnHWrfWFTfGW9XjX");
  const [script, setScript]               = useState("");
  const [loadingScript, setLoadingScript] = useState(false);
  const [generating, setGenerating]       = useState(false);
  const currentVoice = getVoice(selectedVoice);

  // Auto-generate script when step loads
  useEffect(() => {
    generateScript();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generateScript() {
    setLoadingScript(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/cooking-script-captions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON, ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({ dish, durationSec: 30 }),
      });
      const data = await res.json();
      if (data.script) setScript(data.script);
    } catch { /* silent */ } finally { setLoadingScript(false); }
  }

  async function handleGenerate() {
    if (!script.trim()) return;
    setGenerating(true);
    try {
      const trimmedScript = script.trim();
      const audio = await generateVoiceAudio({ voiceId: selectedVoice, script: trimmedScript });
      await onGenerate({ voiceId: selectedVoice, voiceLabel: currentVoice.label, script: trimmedScript, ...audio });
    } finally { setGenerating(false); }
  }

  return (
    <div className="flex flex-col h-full bg-[#0D0F11] rounded-2xl border border-white/[0.07] overflow-hidden">

      {/* Back */}
      <div className="hidden">
        <button type="button" onClick={onBack}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07] text-white/45 hover:text-white text-[13px] font-semibold transition w-full">
          <span className="text-[16px] leading-none">←</span> Back
        </button>
      </div>

      {/* Header */}
      <div className="shrink-0 px-5 pt-4 pb-2">
        <h2 className="text-white font-black text-[16px]">Voiceover</h2>
        <p className="text-white/35 text-[11px] mt-0.5">AI-written script · choose a voice</p>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto [scrollbar-width:none] px-5 pb-4 space-y-4">

        {/* Script prompt area */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">Script</label>
            <button type="button" onClick={generateScript} disabled={loadingScript}
              className="flex items-center gap-1 text-[10px] text-orange-400/70 hover:text-orange-300 transition disabled:opacity-40">
              <RefreshCw className={`w-3 h-3 ${loadingScript ? "animate-spin" : ""}`} />
              Regenerate
            </button>
          </div>
          <div className={`relative rounded-xl border transition ${loadingScript ? "border-white/[0.05]" : "border-white/[0.09] focus-within:border-orange-500/40"} bg-[#0e1012]`}>
            {loadingScript ? (
              <div className="flex items-center gap-2 px-4 py-3 text-white/30 text-[13px]">
                <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
                Writing viral script…
              </div>
            ) : (
              <textarea
                value={script}
                onChange={e => setScript(e.target.value)}
                rows={7}
                placeholder="Your voiceover script will appear here…"
                className="w-full bg-transparent px-4 py-3 text-[13px] text-white/85 placeholder:text-white/20 outline-none resize-none leading-relaxed"
              />
            )}
          </div>
          <p className="text-[10px] text-white/20 mt-1 text-right">{script.length} chars</p>
        </div>

        {/* Voice picker */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2 block">Voice</label>

          {/* Viral picks */}
          <p className="text-[9px] font-bold uppercase tracking-widest text-orange-400/60 mb-1.5">🔥 Best for viral cooking</p>
          <div className="space-y-1.5 mb-3">
            {VOICES.filter(v => v.viral).map(v => {
              const active = selectedVoice === v.id;
              return (
                <button key={v.id} type="button" onClick={() => setSelectedVoice(v.id)}
                  className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${active ? "border-orange-500/50 bg-orange-500/[0.08]" : "border-white/[0.08] bg-white/[0.03] hover:border-white/15"}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[13px] font-black ${active ? "text-white" : "text-white/70"}`}>{v.label}</span>
                      <div className="flex gap-1 flex-wrap">
                        {v.traits.map(t => (
                          <span key={t} className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${active ? "bg-orange-500/20 text-orange-300" : "bg-white/[0.07] text-white/35"}`}>{t}</span>
                        ))}
                      </div>
                    </div>
                    <p className="text-[10px] text-white/30">{v.desc}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <VoicePreviewBtn voiceId={v.id} dish={dish} />
                    {active && <span className="w-2 h-2 rounded-full bg-orange-400" />}
                  </div>
                </button>
              );
            })}
          </div>

          {/* All other voices */}
          <p className="text-[9px] font-bold uppercase tracking-widest text-white/25 mb-1.5">All voices</p>
          <div className="grid grid-cols-2 gap-1.5">
            {VOICES.filter(v => !v.viral).map(v => {
              const active = selectedVoice === v.id;
              return (
                <button key={v.id} type="button" onClick={() => setSelectedVoice(v.id)}
                  className={`flex flex-col gap-1 rounded-xl border px-3 py-2 text-left transition ${active ? "border-orange-500/40 bg-orange-500/[0.07]" : "border-white/[0.06] bg-white/[0.02] hover:border-white/10"}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[12px] font-bold ${active ? "text-white" : "text-white/55"}`}>{v.label}</span>
                    {active && <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />}
                  </div>
                  <div className="flex gap-1 flex-wrap mb-0.5">
                    {v.traits.map(t => (
                      <span key={t} className="text-[8px] font-semibold text-white/25">{t}</span>
                    ))}
                  </div>
                  <VoicePreviewBtn voiceId={v.id} dish={dish} />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sticky footer */}
      <div className="shrink-0 px-5 pb-5 pt-3 border-t border-white/[0.06] space-y-2">
        <button type="button" onClick={handleGenerate} disabled={generating || loadingScript || !script.trim()}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-black text-[14px] flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition disabled:opacity-40">
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
          {generating ? "Generating…" : "Generate Voice"}
        </button>
        <button type="button" onClick={onSkip}
          className="w-full py-2 text-white/30 hover:text-white/55 text-[12px] font-medium transition flex items-center justify-center gap-1.5">
          <SkipForward className="w-3.5 h-3.5" /> Skip voiceover
        </button>
      </div>
      <div className="hidden">
        <button type="button" onClick={() => {}}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-3 text-[13px] font-bold text-white/60 transition hover:border-white/15 hover:bg-white/[0.07] hover:text-white">
          <span className="text-[16px] leading-none">←</span> New generation
        </button>
      </div>
    </div>
  );
}

/* ── Step 3: Captions ─────────────────────────────────────────────────────── */
function VoiceAvatar({ voice, active = false }) {
  return (
    <div className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${
      active ? "border-orange-300/45" : "border-white/10"
    } bg-[radial-gradient(circle_at_35%_25%,rgba(255,255,255,0.26),rgba(249,115,22,0.24)_38%,rgba(14,16,18,0.95)_72%)]`}>
      <div className="absolute inset-1 rounded-full border border-white/10" />
      <span className="relative text-[13px] font-black text-white">{voice.label.slice(0, 1)}</span>
    </div>
  );
}

function VoicePickerCard({ voice, active, dish, generationId, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(voice.id)}
      className={`group w-full rounded-2xl border p-3 text-left transition active:scale-[0.99] ${
        active
          ? "border-orange-400/55 bg-orange-500/[0.10] shadow-[0_18px_45px_rgba(249,115,22,0.14)]"
          : "border-white/[0.08] bg-white/[0.035] hover:border-white/15 hover:bg-white/[0.06]"
      }`}
    >
      <div className="flex items-center gap-3">
        <VoiceAvatar voice={voice} active={active} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[14px] font-black text-white">{voice.label}</span>
            {voice.viral && (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-orange-200">
                <Zap className="h-2.5 w-2.5" /> Viral
              </span>
            )}
          </div>
          <p className="mt-0.5 line-clamp-1 text-[11px] font-medium text-white/42">{voice.desc}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {voice.traits.map(t => (
              <span key={t} className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                active ? "bg-orange-400/15 text-orange-100" : "bg-white/[0.06] text-white/38"
              }`}>
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <VoicePreviewBtn voiceId={voice.id} dish={dish} generationId={generationId} className="min-w-[34px] px-2 sm:px-3" />
          <div className={`flex h-6 w-6 items-center justify-center rounded-full border ${
            active ? "border-orange-300/50 bg-orange-400 text-black" : "border-white/10 bg-white/[0.04] text-transparent"
          }`}>
            <Check className="h-3.5 w-3.5" />
          </div>
        </div>
      </div>
    </button>
  );
}

function VoicePickerModal({ dish, generationId, selectedVoice, onSelect, onClose }) {
  const viralVoices = VOICES.filter(v => v.viral).map(v => getVoice(v.id));
  const allVoices = VOICES.filter(v => !v.viral).map(v => getVoice(v.id));

  // Stop any preview that's still playing the moment this modal goes away,
  // however it closes (X, backdrop click, selecting a voice, unmount).
  useEffect(() => stopActivePreview, []);

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center md:items-center md:px-4">
      <button type="button" aria-label="Close voice picker" className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(21,23,25,0.98),rgba(12,14,16,0.98))] shadow-[0_-18px_70px_rgba(0,0,0,0.65)] md:max-w-[720px] md:rounded-3xl md:shadow-[0_28px_90px_rgba(0,0,0,0.62)]">
        <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-white/20 md:hidden" />
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-orange-300" />
              <h3 className="text-[17px] font-black text-white">Select voice</h3>
            </div>
            <p className="mt-0.5 text-[12px] text-white/40">ElevenLabs voices tuned for short cooking videos</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/55 transition hover:bg-white/[0.08] hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-4 [scrollbar-width:none]">
          <div className="mb-4">
            <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-orange-300/80">
              <Zap className="h-3 w-3" /> Best for viral cooking
            </p>
            <div className="grid gap-2">
              {viralVoices.map(voice => (
                <VoicePickerCard
                  key={voice.id}
                  voice={voice}
                  active={selectedVoice === voice.id}
                  dish={dish}
                  generationId={generationId}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </div>

          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-white/28">All ElevenLabs voices</p>
          <div className="grid gap-2 md:grid-cols-2">
            {allVoices.map(voice => (
              <VoicePickerCard
                key={voice.id}
                voice={voice}
                active={selectedVoice === voice.id}
                dish={dish}
                generationId={generationId}
                onSelect={onSelect}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function VoiceStep({ dish, scenes = [], clips = [], clipPrompts = [], draft = null, hasGeneratedVoice = false, generationId = null, voiceLimit = 2, voiceUsed = 0, onDraftChange, onBack, onSkip, onClose, onGenerate }) {
  const targetDurationSec = 30;
  const [selectedVoice, setSelectedVoice] = useState(draft?.voiceId ?? "TxGEqnHWrfWFTfGW9XjX");
  const [voicePickerOpen, setVoicePickerOpen] = useState(false);
  const [script, setScript] = useState(draft?.script ?? "");
  const [scriptTiming, setScriptTiming] = useState(draft?.captionScript ?? null);
  const [loadingScript, setLoadingScript] = useState(false);
  const [scriptError, setScriptError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);
  const autoScriptRequestedRef = useRef(false);
  const currentVoice = getVoice(selectedVoice);
  const voiceLimitReached = voiceUsed >= voiceLimit;

  useEffect(() => {
    if (draft?.script || script.trim() || autoScriptRequestedRef.current) return;
    const readyScenes = scenes.filter(scene => scene.imageUrl).length;
    const readyClips = clips.filter(clip => clip.videoUrl).length;
    if (readyScenes === 0 && readyClips === 0) return;
    autoScriptRequestedRef.current = true;
    void generateScript();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dish, scenes, clips]);

  // Stop any preview audio when leaving this step entirely (Back/Skip/unmount).
  useEffect(() => stopActivePreview, []);

  useEffect(() => {
    onDraftChange?.({ voiceId: selectedVoice, script, captionScript: scriptTiming });
  }, [selectedVoice, script, scriptTiming, onDraftChange]);

  async function generateScript() {
    setLoadingScript(true);
    setScriptError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const clipFrames = await captureCookingSpeechFrames(clips);
      const res = await fetch(`${SUPABASE_URL}/functions/v1/cooking-script-captions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON, ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({ generationId, dish, durationSec: targetDurationSec, scenes, clips, clipPrompts, clipFrames }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const requestError = new Error(data.error || `Script request failed (${res.status})`);
        requestError.status = res.status;
        throw requestError;
      }
      if (!data.script?.trim()) throw new Error("The AI returned an empty script");
      const nextScript = data.script.trim().slice(0, 700);
      setScript(nextScript);
      setScriptTiming({
        ...data,
        script: nextScript,
        words: Array.isArray(data.words) && data.words.length ? data.words : buildTimedCaptionScript(nextScript, targetDurationSec).words,
        segments: Array.isArray(data.segments) && data.segments.length ? data.segments : buildTimedCaptionScript(nextScript, targetDurationSec).segments,
      });
    } catch (error) {
      console.error("[cooking-script] failed:", error);
      const message = error instanceof Error ? error.message : "Could not generate the suggested voiceover";
      const blocked = Number(error?.status) === 401
        || Number(error?.status) === 403
        || Number(error?.status) === 429
        || /access denied|limit reached|missing generation/i.test(message);
      if (blocked) {
        setScriptError(message);
      } else {
        // Keep creators moving during an Edge/provider rollout. This script is
        // still locked to the same 15 visual beats as the generated clips.
        const fallback = buildCookingFallbackScript(dish, targetDurationSec);
        setScript(fallback.script.slice(0, 700));
        setScriptTiming(fallback);
        setScriptError("");
        console.warn("[cooking-script] using synchronized local fallback");
      }
    } finally { setLoadingScript(false); }
  }

  async function handleGenerate() {
    if (!script.trim() || voiceLimitReached) return;
    if (!generationId) {
      setScriptError("This creation is not ready for voice generation yet. Reload it and try again.");
      return;
    }
    setScriptError("");
    setGenerating(true);
    try {
      const trimmedScript = script.trim().slice(0, 700);
      const audio = await generateVoiceAudio({ voiceId: selectedVoice, script: trimmedScript, generationId });
      const playbackRate = cookingVoicePlaybackRate(audio.durationSec, targetDurationSec);
      const captionScript = mergeVoiceAlignmentWithBeatPlan(
        audio.captionScript,
        scriptTiming ?? buildTimedCaptionScript(trimmedScript, targetDurationSec),
        playbackRate,
      );
      await onGenerate({
        voiceId: selectedVoice,
        voiceLabel: currentVoice.label,
        script: trimmedScript,
        ...audio,
        playbackRate,
        timelineDurationSec: targetDurationSec,
        captionScript,
      });
    } catch (voiceError) {
      console.error("[cooking-voice-generate] failed:", voiceError);
      setScriptError(voiceError instanceof Error ? voiceError.message : "Voice generation failed");
    } finally { setGenerating(false); }
  }

  const handleSelectVoice = (voiceId) => {
    setSelectedVoice(voiceId);
    setVoicePickerOpen(false);
  };

  const handleFilePicked = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setImporting(true);
    try {
      const audioUrl = await blobToDataUrl(file);
      const durationSec = await probeAudioDuration(audioUrl);
      let importedScript = "";
      let importedTiming = null;
      try {
        const transcription = await transcribeSpeechAudio(file, durationSec || targetDurationSec, generationId);
        importedScript = String(transcription.script || transcription.text || "").trim();
        if (importedScript) {
          const fallbackTiming = buildTimedCaptionScript(importedScript, durationSec || targetDurationSec);
          importedTiming = {
            ...transcription,
            script: importedScript,
            words: Array.isArray(transcription.words) && transcription.words.length ? transcription.words : fallbackTiming.words,
            segments: Array.isArray(transcription.segments) && transcription.segments.length ? transcription.segments : fallbackTiming.segments,
          };
        }
      } catch (error) {
        console.warn("[cooking-voice-import] transcription failed:", error);
      }
      let transcriptionUnavailable = false;
      if (!importedScript) {
        // Never attach the previous take's script to newly imported audio.
        // No transcript is safer and truthful; the creator can type one.
        importedScript = "";
        importedTiming = { script: "", words: [], segments: [] };
        transcriptionUnavailable = true;
        setScriptError("Imported audio was added, but its transcript could not be generated. Add the caption text manually if needed.");
      }
      setScript(importedScript);
      setScriptTiming(importedTiming);
      await onGenerate({
        voiceId: null,
        voiceLabel: "Imported voice",
        fileName: file.name,
        script: importedScript,
        captionScript: importedTiming,
        audioUrl,
        audioBlob: file,
        audioBytes: file.size,
        mimeType: file.type || "audio/mpeg",
        durationSec,
        imported: true,
        transcriptionUnavailable,
      });
    } finally { setImporting(false); }
  };

  return (
    <div className="flex min-h-0 flex-col rounded-2xl border border-white/[0.07] bg-[#0D0F11] lg:h-full lg:overflow-hidden">
      <WorkflowProgress current={2} />
      <div className="hidden">
        <button type="button" onClick={onBack}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[13px] font-bold text-white/55 transition hover:bg-white/[0.07] hover:text-white">
          <span className="text-[16px] leading-none">â†</span> Back
        </button>
      </div>

      <div className="shrink-0 px-5 pb-3 pt-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-orange-400/20 bg-orange-500/10">
            <Mic className="h-4 w-4 text-orange-300" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[17px] font-black leading-tight text-white">Voiceover</h2>
            <p className="mt-0.5 text-[11px] text-white/35">Edit the script, then generate speech</p>
          </div>
          <button type="button" onClick={onClose}
            className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.035] text-white/40 transition hover:bg-white/[0.08] hover:text-white"
            aria-label="Close creation" title="Close creation">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="px-5 pb-[calc(250px+env(safe-area-inset-bottom))] lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pb-4 lg:[scrollbar-width:none]">
        <div className="flex min-h-full flex-col">
          {/* Import your own audio */}
          <div className="mb-4 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-white/55">Use your own audio</p>
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={importing}
                className="flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-bold text-orange-300 transition hover:bg-white/[0.10] disabled:cursor-wait disabled:opacity-60">
                {importing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />} {importing ? "Adding…" : "Import"}
              </button>
              <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFilePicked} />
            </div>
          </div>

          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">Script</label>
            <button type="button" onClick={generateScript} disabled={loadingScript}
              className="flex items-center gap-1 text-[10px] text-orange-400/75 transition hover:text-orange-300 disabled:opacity-40">
              <RefreshCw className={`h-3 w-3 ${loadingScript ? "animate-spin" : ""}`} />
              Regenerate
            </button>
          </div>

          {scriptError && (
            <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-red-400/20 bg-red-500/[0.07] px-3 py-2">
              <p className="text-[10px] leading-relaxed text-red-200/75">{scriptError}</p>
              <button type="button" onClick={generateScript} className="shrink-0 text-[10px] font-black text-red-200 transition hover:text-white">Try again</button>
            </div>
          )}

          <div className={`voiceover-script-beam relative h-[300px] min-h-[300px] shrink-0 overflow-hidden rounded-2xl border bg-[#0e1012] transition ${
            loadingScript ? "border-white/[0.05]" : "border-white/[0.09] focus-within:border-orange-500/40"
          }`}>
            {loadingScript ? (
              <div className="flex items-center gap-2 px-4 py-3 text-[13px] text-white/30">
                <Loader2 className="h-4 w-4 animate-spin text-orange-400" />
                Writing viral script…
              </div>
            ) : (
              <textarea
                value={script}
                maxLength={700}
                onChange={e => {
                  const value = e.target.value;
                  setScript(value);
                  setScriptTiming(buildTimedCaptionScript(value, targetDurationSec));
                }}
                rows={14}
                placeholder="Your voiceover script will appear here…"
                className="h-full min-h-0 w-full resize-none bg-transparent px-4 py-3 text-[15px] leading-relaxed text-white/90 outline-none placeholder:text-white/20 md:text-[13px]"
              />
            )}
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px]">
            <span className={voiceLimitReached ? "font-bold text-red-300" : "text-white/30"}>Generated voices {voiceUsed}/{voiceLimit}</span>
            <span className="text-white/20">{script.length}/700 chars</span>
          </div>
          {voiceLimitReached && (
            <p className="mt-2 rounded-xl border border-red-400/20 bg-red-500/[0.08] px-3 py-2 text-[10px] font-semibold leading-relaxed text-red-200">
              You cannot generate more voices for this creation. Imported audio is still unlimited.
            </p>
          )}

        </div>
      </div>

      <div className="fixed inset-x-3 bottom-[calc(86px+env(safe-area-inset-bottom))] z-40 space-y-2.5 rounded-2xl border border-white/[0.08] bg-[#101213]/96 px-4 pb-3 pt-3 shadow-[0_-18px_55px_rgba(0,0,0,0.50)] backdrop-blur-xl lg:static lg:inset-auto lg:z-auto lg:shrink-0 lg:rounded-none lg:border-x-0 lg:border-b-0 lg:bg-[#101213]/95 lg:px-5 lg:pb-[calc(16px+env(safe-area-inset-bottom))] lg:shadow-none">
        <button type="button" onClick={() => setVoicePickerOpen(true)}
          className="group w-full rounded-2xl border border-white/[0.10] bg-white/[0.05] px-3 py-2.5 text-left transition hover:border-orange-400/35 hover:bg-white/[0.08]">
          <div className="flex items-center gap-3">
            <VoiceAvatar voice={currentVoice} active />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-[13px] font-black text-white">{currentVoice.label}</span>
                {currentVoice.viral && (
                  <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-orange-200">Viral</span>
                )}
              </div>
              <p className="truncate text-[11px] font-medium text-white/42">{currentVoice.vibe} - {currentVoice.traits.join(" / ")}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <VoicePreviewBtn voiceId={selectedVoice} dish={dish} generationId={generationId} className="hidden sm:flex" />
              <ChevronUp className="h-4 w-4 text-white/35 transition group-hover:text-white/70" />
            </div>
          </div>
        </button>

        <button type="button" onClick={handleGenerate} disabled={generating || loadingScript || !script.trim() || voiceLimitReached}
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 py-3 text-[14px] font-black text-white transition hover:brightness-110 active:scale-[0.98] disabled:opacity-40">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
          {generating ? "Generating take…" : hasGeneratedVoice ? "Generate Another Take" : "Generate Voice"}
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onBack}
            className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[12px] font-bold text-white/50 transition hover:bg-white/[0.07] hover:text-white">
            Back
          </button>
          <button type="button" onClick={onSkip}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[12px] font-bold text-white/50 transition hover:bg-white/[0.07] hover:text-white">
            <SkipForward className="h-3.5 w-3.5" /> Skip voice
          </button>
        </div>
      </div>

      {voicePickerOpen && createPortal(
        <VoicePickerModal
          dish={dish}
          generationId={generationId}
          selectedVoice={selectedVoice}
          onSelect={handleSelectVoice}
          onClose={() => setVoicePickerOpen(false)}
        />,
        document.body
      )}
    </div>
  );
}

export function CaptionStep({ dish, scenes = [], clips = [], clipPrompts = [], voiceData = null, draft = null, generationId = null, onDraftChange, onVoiceDataChange, onBack, onSkip, onClose, onApply }) {
  const durationSec = Math.max(1, clips.filter(c => c.videoUrl).length * 6 || 30);
  const hasProviderTiming = hasCurrentProviderTiming(voiceData?.captionScript);
  const initialScript = hasProviderTiming
    ? voiceData?.captionScript?.script ?? voiceData?.script ?? ""
    : draft?.captionScript?.script ?? voiceData?.script ?? "";
  const suppliedCaptionScript = hasProviderTiming
    ? voiceData?.captionScript
    : draft?.captionScript ?? voiceData?.captionScript ?? null;
  const initialCaptionScript = suppliedCaptionScript?.words?.length
    ? suppliedCaptionScript
    : (initialScript
      ? buildTimedCaptionScript(initialScript, Math.min(durationSec, Number(voiceData?.durationSec) || durationSec))
      : null);
  const selectedTakeKey = voiceData?.id || voiceData?.audioUrl || "no-voice";
  const alignmentRequestedRef = useRef(null);
  const [captionStyle, setCaptionStyle] = useState(draft?.captionStyle ?? "viral-yellow");
  const [textSpeed, setTextSpeed]       = useState(draft?.textSpeed ?? "fast");
  const [script, setScript]             = useState(initialScript);
  const [scriptData, setScriptData]     = useState(initialCaptionScript);
  const [loading, setLoading]           = useState(false);
  const [generating, setGenerating]     = useState(false);
  const [analyzingTiming, setAnalyzingTiming] = useState(false);
  const [timingNote, setTimingNote] = useState("");

  const analyzeVoiceTiming = useCallback(async ({ force = false } = {}) => {
    if (!generationId || !voiceData?.audioUrl) return;
    if (!force && alignmentRequestedRef.current === selectedTakeKey) return;
    alignmentRequestedRef.current = selectedTakeKey;
    setAnalyzingTiming(true);
    setTimingNote("Analyzing voice timing word by word…");
    try {
      const response = await fetch(voiceData.audioUrl);
      if (!response.ok) throw new Error("Could not read saved voice audio");
      const blob = await response.blob();
      const file = new File([blob], voiceData.fileName || "cooking-voice.mp3", { type: blob.type || "audio/mpeg" });
      const timing = await transcribeSpeechAudio(
        file,
        Number(voiceData.durationSec) || durationSec,
        generationId,
        voiceData.imported ? "" : voiceData.script,
      );
      const exactScript = String(timing.script || voiceData.script || "").trim();
      const alignmentRate = voiceData.imported
        ? 1
        : Math.max(0.5, Math.min(2, Number(voiceData.playbackRate)
          || cookingVoicePlaybackRate(voiceData.durationSec, durationSec)));
      const timelineTime = value => Number(((Number(value) || 0) / alignmentRate).toFixed(3));
      const exactCaptionScript = {
        ...timing,
        timingVersion: CAPTION_TIMING_VERSION,
        timingSource: `${timing.timingSource || "elevenlabs-alignment"}${alignmentRate === 1 ? "" : "+normalized-timeline"}`,
        script: exactScript,
        words: Array.isArray(timing.words)
          ? timing.words.map(word => ({ ...word, start: timelineTime(word.start), end: timelineTime(word.end) }))
          : [],
        segments: Array.isArray(timing.segments)
          ? timing.segments.map(segment => ({ ...segment, start: timelineTime(segment.start), end: timelineTime(segment.end) }))
          : [],
        playbackRate: alignmentRate,
        timelineDurationSec: durationSec,
        timelineNormalized: !voiceData.imported,
      };
      setScript(exactScript);
      setScriptData(exactCaptionScript);
      onVoiceDataChange?.({ ...voiceData, script: exactScript, captionScript: exactCaptionScript });
      onDraftChange?.((currentDraft) => ({
        ...(currentDraft ?? {}),
        captionScript: exactCaptionScript,
        textOverlays: Array.isArray(currentDraft?.textOverlays)
          ? currentDraft.textOverlays.filter(item => !item?.autoCaption)
          : undefined,
      }));
      setTimingNote("Voice timing refreshed — captions now follow every spoken word.");
    } catch (error) {
      console.warn("[cooking-caption-alignment] failed:", error);
      if (force) alignmentRequestedRef.current = null;
      setTimingNote("Could not analyze this voice take. Try again in a moment.");
    } finally {
      setAnalyzingTiming(false);
    }
  }, [durationSec, generationId, onDraftChange, onVoiceDataChange, selectedTakeKey, voiceData]);

  // Old saved takes used evenly-spaced estimates. Analyze their real audio once
  // so they receive the same word-accurate timing as newly generated takes.
  useEffect(() => {
    if (!generationId || !voiceData?.audioUrl) return;
    if (hasCurrentProviderTiming(scriptData) || hasCurrentProviderTiming(voiceData?.captionScript)) return;
    void analyzeVoiceTiming();
  }, [analyzeVoiceTiming, generationId, scriptData, voiceData?.audioUrl, voiceData?.captionScript]);

  // CaptionStep stays mounted while takes are switched. Always replace its
  // textarea/timeline source with the newly selected take's exact transcript.
  useEffect(() => {
    const exact = voiceData?.captionScript;
    if (!hasCurrentProviderTiming(exact)) return;
    setScript(String(exact.script || voiceData?.script || ""));
    setScriptData(exact);
    setTimingNote("");
  }, [selectedTakeKey, voiceData?.captionScript, voiceData?.script]);

  // Keep parent in sync for realtime right-panel preview
  useEffect(() => {
    onDraftChange?.((currentDraft) => {
      const nextCaptionScript = scriptData ?? currentDraft?.captionScript ?? null;
      if (
        currentDraft?.captionStyle === captionStyle
        && currentDraft?.textSpeed === textSpeed
        && currentDraft?.captionScript === nextCaptionScript
      ) return currentDraft;
      return {
        ...(currentDraft ?? {}),
        captionStyle,
        textSpeed,
        captionScript: nextCaptionScript,
      };
    });
  }, [captionStyle, textSpeed, scriptData, onDraftChange]);

  useEffect(() => {
    if (hasCurrentProviderTiming(voiceData?.captionScript)) return;
    const nextScript = String(draft?.captionScript?.script ?? voiceData?.script ?? "");
    const nextTiming = draft?.captionScript?.words?.length
      ? draft.captionScript
      : (nextScript ? buildTimedCaptionScript(nextScript, Math.min(durationSec, Number(voiceData?.durationSec) || durationSec)) : null);
    setScript(nextScript);
    setScriptData(nextTiming);
    setTimingNote("");
  // Changing selectedTakeKey intentionally resets the local editor state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTakeKey]);

  async function generateScript() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const clipFrames = await captureCookingSpeechFrames(clips);
      const res = await fetch(`${SUPABASE_URL}/functions/v1/cooking-script-captions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON, ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({ generationId, dish, durationSec: 30, scenes, clips, clipPrompts, clipFrames }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Script request failed (${res.status})`);
      if (data.script) {
        setScript(data.script);
        setScriptData({
          ...data,
          words: Array.isArray(data.words) && data.words.length ? data.words : buildTimedCaptionScript(data.script, durationSec).words,
          segments: Array.isArray(data.segments) && data.segments.length ? data.segments : buildTimedCaptionScript(data.script, durationSec).segments,
        });
      }
    } catch (error) {
      console.warn("[cooking-caption-script] using synchronized local fallback", error);
      const fallback = buildCookingFallbackScript(dish, durationSec);
      setScript(fallback.script);
      setScriptData(fallback);
    } finally { setLoading(false); }
  }

  function handleScriptChange(value) {
    setScript(value);
    setScriptData(buildTimedCaptionScript(value, durationSec));
  }

  async function handleGenerate() {
    if (!script.trim() && !loading) { generateScript(); return; }
    // If script exists, generate the voice using it (just close with current data)
    setGenerating(true);
    try {
      await onApply({
        ...(draft ?? {}),
        captionStyle,
        textSpeed,
        captionScript: scriptData ?? draft?.captionScript ?? buildTimedCaptionScript(script, durationSec),
      });
    }
    finally { setGenerating(false); }
  }

  // Auto-generate on first open if no draft
  useEffect(() => {
    if (!draft?.captionScript?.script && !voiceData?.script && !voiceData?.imported) generateScript();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-0 flex-col rounded-2xl border border-white/[0.07] bg-[#0D0F11] lg:h-full lg:overflow-hidden">
      <WorkflowProgress current={3} />
      <div className="flex shrink-0 justify-end px-5 pt-3">
        <button type="button" onClick={onClose}
          className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1.5 text-[10px] font-bold text-white/45 transition hover:bg-white/[0.08] hover:text-white">
          <X className="h-3 w-3" /> Close
        </button>
      </div>

      <div className="px-5 pb-[calc(230px+env(safe-area-inset-bottom))] lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pb-4 lg:[scrollbar-width:none]">
        <div className="pt-4 space-y-4">
          <div className="space-y-2">
            <div className="rounded-xl border border-orange-400/15 bg-orange-500/[0.06] px-3 py-2.5">
              <p className="text-[11px] font-bold text-orange-100/80">Choose how captions look on the final video.</p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-white/38">Apply them to open Preview, check the timing and placement, then finish the export.</p>
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/30">
                <Sparkles className="h-3 w-3 text-orange-300" /> Text style
              </p>
              <div className="flex rounded-lg bg-white/[0.04] p-0.5">
                {TEXT_SPEEDS.map(speed => (
                  <button
                    key={speed.id}
                    type="button"
                    onClick={() => setTextSpeed(speed.id)}
                    className={`rounded-md px-2 py-1 text-[10px] font-black transition ${
                      textSpeed === speed.id ? "bg-white text-black" : "text-white/38 hover:text-white"
                    }`}
                    title={speed.desc}
                  >
                    {speed.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {CAPTION_PRESETS.map(preset => (
                <CaptionStyleButton
                  key={preset.id}
                  preset={preset}
                  active={captionStyle === preset.id}
                  onClick={() => setCaptionStyle(preset.id)}
                />
              ))}
            </div>
          </div>

          {/* Script */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">Transcript captions</label>
              <button type="button" onClick={() => voiceData?.audioUrl ? analyzeVoiceTiming({ force: true }) : generateScript()} disabled={loading || analyzingTiming}
                className="flex items-center gap-1 text-[10px] text-orange-400/75 transition hover:text-orange-300 disabled:opacity-40">
                <RefreshCw className={`h-3 w-3 ${loading || analyzingTiming ? "animate-spin" : ""}`} />
                {voiceData?.audioUrl ? "Refresh timing" : (script ? "Regenerate" : "Generate")}
              </button>
            </div>

            <div className={`relative rounded-2xl border bg-[#0e1012] transition ${loading ? "border-white/[0.05]" : "border-white/[0.09] focus-within:border-orange-500/40"}`}>
              {loading ? (
                <div className="flex items-center gap-2 px-4 py-3 text-[13px] text-white/30">
                  <Loader2 className="h-4 w-4 animate-spin text-orange-400" />
                  Writing script…
                </div>
              ) : (
                <textarea
                  value={script}
                  onChange={e => handleScriptChange(e.target.value)}
                  rows={10}
                  placeholder="Your voiceover script will appear here…"
                  className="w-full resize-none bg-transparent px-4 py-3 text-[13px] leading-relaxed text-white/85 outline-none placeholder:text-white/20"
                />
              )}
            </div>
            {timingNote && <p className="mt-1.5 text-[10px] font-semibold text-orange-200/60">{timingNote}</p>}
            <p className="mt-1 text-right text-[10px] text-white/20">{script.length} chars</p>
          </div>

          {/* Style hint */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
            <p className="text-[11px] text-white/40">
              <span className="font-semibold text-white/60">Caption style</span> — choose from the preview panel on the right. Drag the orange handle to reposition captions on screen.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="fixed inset-x-3 bottom-[calc(86px+env(safe-area-inset-bottom))] z-40 space-y-2 rounded-2xl border border-white/[0.08] bg-[#101213]/96 px-4 pb-3 pt-3 shadow-[0_-18px_55px_rgba(0,0,0,0.50)] backdrop-blur-xl lg:static lg:inset-auto lg:z-auto lg:shrink-0 lg:rounded-none lg:border-x-0 lg:border-b-0 lg:bg-[#101213]/95 lg:px-5 lg:pb-[calc(16px+env(safe-area-inset-bottom))] lg:shadow-none">
        <button type="button" onClick={handleGenerate} disabled={generating || loading || !script.trim()}
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 py-3 text-[14px] font-black text-white transition hover:brightness-110 active:scale-[0.98] disabled:opacity-40">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="text-sm font-black">CC</span>}
          {generating ? "Applying…" : "Apply Captions"}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onBack}
            className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[12px] font-bold text-white/50 transition hover:bg-white/[0.07] hover:text-white">
            Back
          </button>
          <button type="button" onClick={onSkip}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[12px] font-bold text-white/50 transition hover:bg-white/[0.07] hover:text-white">
            <SkipForward className="h-3.5 w-3.5" /> Skip
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Final step ───────────────────────────────────────────────────────────── */
export function FinalStep({ clips, dishLabel, voiceData, captionData, existingVideoUrl = null, ensureGenerationId, onSaved, onClose, onBackToEditing, onRestart, onPublish, onViewCreations }) {
  const readyClips = clips.filter(c => c.videoUrl).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const clipSignature = readyClips.map((clip) => `${clip.index}:${clip.videoUrl}`).join("|");
  const voicePlaybackRate = voiceData?.imported
    ? 1
    : Number(voiceData?.playbackRate) || cookingVoicePlaybackRate(voiceData?.durationSec, COOKING_VOICE_TIMELINE_SEC);
  const captionSignature = JSON.stringify({
    captionStyle: captionData?.captionStyle ?? null,
    textOverlays: captionData?.textOverlays ?? [],
    voicePlaybackRate,
  });
  const [finalVideoUrl, setFinalVideoUrl] = useState(existingVideoUrl);
  const [renderProgress, setRenderProgress] = useState(existingVideoUrl ? 100 : 0);
  const [renderError, setRenderError] = useState("");
  const [renderAttempt, setRenderAttempt] = useState(0);
  const [saveStatus, setSaveStatus] = useState(existingVideoUrl ? "saved" : "idle");
  const [saveError, setSaveError] = useState("");
  const savedJobIdRef = useRef(null);
  const renderKey = `${clipSignature}::${voiceData?.audioUrl || "silent"}::${voicePlaybackRate}::${captionSignature}::${renderAttempt}`;

  useEffect(() => {
    if (existingVideoUrl) {
      setFinalVideoUrl(existingVideoUrl);
      setRenderProgress(100);
      setRenderError("");
      setSaveStatus("saved");
      setSaveError("");
      return undefined;
    }
    if (readyClips.length !== 5) return undefined;
    let cancelled = false;
    let createdUrl = null;
    setFinalVideoUrl(null);
    setRenderProgress(1);
    setRenderError("");
    setSaveStatus("idle");
    setSaveError("");

    const renderJob = getCookingFinalRenderJob(renderKey, {
      clips: readyClips.map((clip) => ({ url: clip.videoUrl, duration: 6 })),
      watermarkUrl: "/template/nationality-swap/ai-cooking/watermarkvideo.mp4",
      watermarkDuration: 6,
      voiceUrl: voiceData?.audioUrl || null,
      captionData: { ...(captionData ?? {}), voicePlaybackRate },
    }, (progress) => { if (!cancelled) setRenderProgress(progress); });
    renderJob.promise.then(async (blob) => {
      if (cancelled) return;
      const url = URL.createObjectURL(blob);
      createdUrl = url;
      setFinalVideoUrl(url);
      setRenderProgress(100);
      setSaveStatus("saving");
      try {
        const generationId = await ensureGenerationId?.();
        const safeName = (dishLabel || "cooking-video").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "cooking-video";
        const file = new File([blob], `${safeName}.mp4`, { type: "video/mp4" });
        const uploaded = await uploadForExternalFetch(file, { prefix: "ai-cooking-final" }, true);
        if (cancelled) return;
        const job = await saveFullVideo({
          resultUrl: uploaded.url,
          prompt: `AI Cooking Matic — ${dishLabel || "Cooking video"}`,
          existingId: savedJobIdRef.current,
        });
        savedJobIdRef.current = job.id;
        const updatedGeneration = generationId
          ? await updateCookingMaticFullVideo({ generationId, fullVideoUrl: uploaded.url })
          : null;
        if (!cancelled) {
          setSaveStatus("saved");
          onSaved?.(uploaded.url, updatedGeneration);
        }
      } catch (error) {
        console.error("[cooking-final] save failed:", error);
        if (!cancelled) {
          setSaveStatus("error");
          setSaveError("Video rendered, but it could not be saved to Creations. You can still download it.");
        }
      }
    }).catch((error) => {
      if (!cancelled) {
        console.error("[cooking-final] stitch failed:", error);
        const message = error?.message || "Couldn't render the final video.";
        const detail = error?.detail || error?.cause?.message;
        setRenderError(detail && detail !== message ? `${message} ${detail}` : message);
      }
    });

    return () => {
      cancelled = true;
      renderJob.unsubscribe();
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  // clipSignature deliberately represents the five immutable output URLs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderKey, existingVideoUrl]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const fileName = `${(dishLabel || "cooking-video").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "cooking-video"}.mp4`;
  const complete = Boolean(finalVideoUrl);
  const stageLabel = renderProgress < 60
      ? "Preparing video clips"
      : renderProgress < 72
        ? "Stitching scenes and watermark"
        : renderProgress < 96
          ? "Applying captions and voice"
          : "Finalizing your export";
  const stages = [
    { label: "Prepare clips", done: renderProgress >= 60 || complete },
    { label: "Stitch + ending", done: renderProgress >= 72 || complete },
    { label: "Captions + voice", done: renderProgress >= 96 || complete },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 p-3 backdrop-blur-md sm:p-6" role="dialog" aria-modal="true" aria-label="Export final cooking video">
      <div className="flex h-[calc(100dvh-16px)] w-[calc(100vw-16px)] flex-col overflow-hidden rounded-[22px] border border-white/[0.12] bg-[#101214] shadow-[0_30px_120px_rgba(0,0,0,0.75)] sm:h-[88vh] sm:w-[88vw] sm:rounded-[26px] lg:h-[82vh] lg:w-[80vw] lg:max-w-[1180px]">
        <header className="flex shrink-0 items-center justify-between border-b border-white/[0.08] px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-orange-500/30 bg-orange-500/10">
              {complete ? <Check className="h-5 w-5 text-emerald-400" /> : <Loader2 className="h-5 w-5 animate-spin text-orange-400" />}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-black text-white sm:text-[17px]">{complete ? "Your video is ready" : "Exporting final video"}</p>
              <p className="truncate text-[11px] text-white/35 sm:text-[12px]">{dishLabel || "AI Cooking Matic"} · 9:16 MP4</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.09] bg-white/[0.04] text-white/45 transition hover:bg-white/[0.09] hover:text-white" aria-label="Close export">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto overscroll-contain lg:grid-cols-[minmax(300px,0.9fr)_minmax(360px,1.1fr)] lg:overflow-hidden">
          <div className={`flex items-center justify-center border-b border-white/[0.07] bg-[#090a0b] p-3 sm:p-5 lg:min-h-0 lg:border-b-0 lg:border-r ${complete ? "min-h-[260px]" : "min-h-[330px]"}`}>
            <div className={`relative aspect-[9/16] overflow-hidden rounded-2xl border border-white/[0.1] bg-black shadow-2xl ${complete ? "h-[34dvh] max-h-[300px] sm:h-full sm:max-h-[66vh]" : "h-[43dvh] max-h-[420px] sm:h-full sm:max-h-[66vh]"}`}>
              {finalVideoUrl ? (
                <video src={finalVideoUrl} controls playsInline className="h-full w-full object-contain" />
              ) : readyClips[0]?.videoUrl ? (
                <>
                  <video src={readyClips[0].videoUrl} muted playsInline className="h-full w-full object-cover opacity-35" />
                  <div className="absolute inset-0 bg-black/45" />
                </>
              ) : null}
              {!complete && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
                  <div className="relative flex h-24 w-24 items-center justify-center rounded-full" style={{ background: `conic-gradient(#ff7a1a ${renderProgress * 3.6}deg, rgba(255,255,255,.09) 0deg)` }}>
                    <div className="absolute inset-[6px] rounded-full bg-[#111315]" />
                    {renderError ? <span className="relative text-2xl font-black text-red-400">!</span> : <span className="relative text-[22px] font-black tabular-nums text-white">{renderProgress}%</span>}
                  </div>
                  <div>
                    <p className="text-[14px] font-black text-white">{renderError ? "Export interrupted" : stageLabel}</p>
                    <p className="mt-1 text-[11px] text-white/40">Keep this window open while Zyvo renders.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex min-h-0 flex-col p-3 pb-[calc(16px+env(safe-area-inset-bottom))] sm:p-7 lg:overflow-y-auto">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3 sm:p-4">
              <div className="mb-2 flex items-center justify-between gap-3 sm:mb-3">
                <span className="text-[12px] font-black text-white">{complete ? "Export complete" : stageLabel}</span>
                <span className={`text-[12px] font-black tabular-nums ${complete ? "text-emerald-400" : "text-orange-400"}`}>{complete ? "100%" : `${renderProgress}%`}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/[0.07]">
                <div className={`h-full rounded-full transition-[width] duration-500 ${complete ? "bg-emerald-400" : "bg-gradient-to-r from-orange-500 to-red-500"}`} style={{ width: `${complete ? 100 : renderProgress}%` }} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-1.5 sm:mt-5 sm:gap-2">
                {stages.map((stage, index) => (
                  <div key={stage.label} className={`flex min-w-0 items-center gap-1.5 rounded-xl border px-2 py-2 sm:gap-2 sm:px-3 sm:py-2.5 ${stage.done ? "border-emerald-500/20 bg-emerald-500/[0.06]" : "border-white/[0.06] bg-black/10"}`}>
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black ${stage.done ? "bg-emerald-400 text-black" : "bg-white/[0.07] text-white/30"}`}>
                      {stage.done ? <Check className="h-3 w-3" /> : index + 1}
                    </span>
                    <span className={`min-w-0 text-[9px] font-bold leading-tight sm:text-[10px] ${stage.done ? "text-white/75" : "text-white/30"}`}>{stage.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {renderError && (
              <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/[0.07] p-4">
                <p className="text-[12px] font-black text-red-300">Final render failed</p>
                <p className="mt-1 text-[11px] leading-relaxed text-red-200/60">{renderError}</p>
                <p className="mt-2 text-[10px] leading-relaxed text-red-100/40">More detail: open browser DevTools → Console and filter for <code>[cooking-final]</code> or <code>[cooking-stitch]</code>.</p>
                <button type="button" onClick={() => setRenderAttempt(value => value + 1)} className="mt-3 flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-[11px] font-black text-white transition hover:bg-red-400">
                  <RotateCcw className="h-3.5 w-3.5" /> Retry export
                </button>
              </div>
            )}

            {complete && (
              <div className="mt-3 space-y-2.5 sm:mt-4 sm:space-y-3">
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3 sm:p-4">
                  <p className="text-[13px] font-black text-emerald-300">Ready to share</p>
                  <p className="mt-1 text-[11px] text-white/40">Captions, selected voice, scene clips and the Zyvo ending are included.</p>
                  {saveStatus === "saving" && <p className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-white/35"><Loader2 className="h-3 w-3 animate-spin" /> Saving to Creations…</p>}
                  {saveStatus === "saved" && <p className="mt-2 text-[10px] font-bold text-emerald-400">✓ Saved to Creations — ready to publish</p>}
                  {saveError && <p className="mt-2 text-[10px] font-semibold text-amber-300">{saveError}</p>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => saveMediaToDevice({ url: finalVideoUrl, filename: fileName, title: "Cooking Matic video" })} className="flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-[12px] font-black text-black transition hover:bg-white/90">
                    <Download className="h-4 w-4" /> Download
                  </button>
                  <button type="button" onClick={onPublish} disabled={saveStatus !== "saved"} className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 px-4 py-3 text-[12px] font-black text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">
                    <Send className="h-4 w-4" /> Publish
                  </button>
                  <button type="button" onClick={onViewCreations} className="flex items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.04] px-4 py-3 text-[11px] font-bold text-white/65 transition hover:bg-white/[0.08] hover:text-white">
                    <FolderOpen className="h-4 w-4" /> Creations
                  </button>
                  <button type="button" onClick={onBackToEditing} className="flex items-center justify-center gap-2 rounded-xl border border-orange-400/25 bg-orange-500/[0.08] px-4 py-3 text-[11px] font-black text-orange-200 transition hover:bg-orange-500/[0.14] hover:text-white">
                    <RotateCcw className="h-4 w-4" /> Back to editing
                  </button>
                  <button type="button" onClick={onRestart} className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.04] px-4 py-3 text-[11px] font-bold text-white/65 transition hover:bg-white/[0.08] hover:text-white">
                    <RotateCcw className="h-4 w-4" /> Create another
                  </button>
                </div>
              </div>
            )}

            {!complete && !renderError && <p className="mt-auto pt-5 text-center text-[10px] text-white/20">Rendering happens locally in your browser. You can keep editing after closing this export.</p>}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
