import { useCallback, useRef, useState } from "react";
import { watchJob, cancelJob } from "../../../../lib/jobs";
import {
  buildImagePrompt,
  buildFriendlyImagePrompt,
  buildVideoPrompt,
  buildFriendlyVideoPrompt,
  fetchFootballerIdentity,
  generateFootballerImage,
  animateFootballerClip,
} from "../api/footballerNationalitySwapApi";

const TERMINAL = new Set(["succeeded", "failed", "canceled"]);
const isTerminal = (s) => TERMINAL.has(s);

// Stagger between scene starts so we don't hammer the API simultaneously
const SCENE_STAGGER_MS = 300;

function resolveUrl(job) {
  const raw =
    job?.result_url || job?.resultUrl ||
    job?.output?.result_url || job?.output?.resultUrl ||
    job?.output?.imageUrl   || job?.output?.image_url  ||
    job?.output?.videoUrl   || job?.output?.video_url  ||
    job?.output?.data?.[0]?.url || job?.output?.results?.[0]?.url ||
    null;
  return raw && !raw.includes("localhost") ? raw.trim() : null;
}

function waitForJob(jobId, timeoutMs = 4.5 * 60 * 1000, onRetrying = null) {
  return new Promise((resolve) => {
    let unsub, settled = false;
    const finish = (row) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { unsub?.(); } catch {}
      resolve(row);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    unsub = watchJob(jobId, (row) => {
      if (onRetrying && row.status === "queued" && Number(row.attempts ?? 0) > 0) onRetrying(row);
      if (isTerminal(row.status)) finish(row);
    });
  });
}

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

async function resolveIdentity(si) {
  const hasFullOverride = si.customName?.trim() && si.customJersey?.trim() && si.customLine?.trim();
  if (hasFullOverride) {
    return {
      localizedName: si.customName.trim(),
      jerseyNumber:  si.customJersey.trim(),
      spokenLine:    si.customLine.trim(),
      language:      "Custom",
    };
  }
  const identity = await fetchFootballerIdentity({ footballer: si.footballer, nationality: si.nationality });
  return {
    localizedName: si.customName?.trim()   || identity.localizedName,
    jerseyNumber:  si.customJersey?.trim() || identity.jerseyNumber,
    spokenLine:    si.customLine?.trim()   || identity.spokenLine,
    language:      identity.language,
  };
}

const makeScene = (i, si = {}) => ({
  index: i,
  footballer:  si.footballer ?? "",
  nationality: si.nationality ?? "",
  expression:  si.expression ?? "confident",
  videoStyle:  si.videoStyle ?? "stadium-tunnel",

  identityStatus: "idle", localizedName: null, jerseyNumber: null, spokenLine: null, language: null,
  imageJobId: null, imageStatus: "idle", imageUrl: null, imageError: null,
  videoJobId: null, videoStatus: "idle", videoUrl: null, videoError: null,
});

// OpenAI (gpt-image) flags real-footballer-likeness prompts more than most —
// especially the biggest names ("create face of mbappe" etc). Cascade through
// engine + prompt-strength combos before giving up:
//   1. OpenAI, exact prompt          2. Nano Banana 2, exact prompt
//   3. OpenAI, friendlier prompt     4. Nano Banana 2, friendlier prompt
async function generateImageWithFallback({ si, patch, isCurrentRun, onRetrying }) {
  const primaryPrompt  = buildImagePrompt(si);
  const friendlyPrompt = buildFriendlyImagePrompt(si);

  const stages = [
    { provider: "openai", prompt: primaryPrompt,  label: "openai/primary-prompt" },
    { provider: "nano2",  prompt: primaryPrompt,  label: "nano2/primary-prompt" },
    { provider: "openai", prompt: friendlyPrompt, label: "openai/friendly-prompt" },
    { provider: "nano2",  prompt: friendlyPrompt, label: "nano2/friendly-prompt" },
  ];

  for (const stage of stages) {
    if (!isCurrentRun()) throw new Error("cancelled");
    patch({ imageStatus: "queued" });

    let job, result;
    try {
      job = await generateFootballerImage({ imagePrompt: stage.prompt, provider: stage.provider });
      if (!isCurrentRun()) throw new Error("cancelled");
      patch({ imageJobId: job.id, imageStatus: "running" });
      result = await waitForJob(job.id, undefined, onRetrying);
      if (isCurrentRun()) patch({ imageStatus: "running" });
    } catch (err) {
      if (err.message === "cancelled") throw err;
      console.warn(`[Footballer] image stage "${stage.label}" failed to start`, err);
    }
    if (!isCurrentRun()) throw new Error("cancelled");

    const url = result?.status === "succeeded" ? resolveUrl(result) : null;
    if (url) return url;

    // Timed out (result === null) rather than a clean failure — the primary
    // job may still complete later at the provider, so cancel it to avoid a
    // late success charging credits after we've already moved on.
    if (result === null && job?.id) cancelJob(job.id).catch(() => {});

    console.warn(`[Footballer] image stage "${stage.label}" produced no image, trying next stage`);
  }

  console.error("[Footballer] all 4 image stages exhausted (openai/nano2 × primary/friendly prompt)");
  patch({ imageStatus: "failed", imageError: "Generation failed — try again" });
  return null;
}

// Primary is Seedance 2.0 Fast @ 480p (cheap, not hitting the content-filter
// wall Veo did — see providers.ts). Fallback is Seedance 1.5 Pro @ 720p,
// which has confirmed native audio via providerSettings.bytedance.audio.
//   1. Seedance 2.0 Fast, exact prompt   2. Seedance 2.0 Fast, friendlier prompt
//   3. Seedance 1.5 Pro, exact prompt    4. Seedance 1.5 Pro, friendlier prompt
async function generateVideoWithFallback({ imageUrl, spokenLine, expression, videoStyle, patch, isCurrentRun }) {
  const primaryPrompt  = buildVideoPrompt({ spokenLine, expression, videoStyle });
  const friendlyPrompt = buildFriendlyVideoPrompt({ spokenLine, expression, videoStyle });

  const stages = [
    { provider: "seedance2",  prompt: primaryPrompt,  label: "seedance2.0/primary-prompt" },
    { provider: "seedance2",  prompt: friendlyPrompt, label: "seedance2.0/friendly-prompt" },
    { provider: "seedance15", prompt: primaryPrompt,  label: "seedance1.5/primary-prompt" },
    { provider: "seedance15", prompt: friendlyPrompt, label: "seedance1.5/friendly-prompt" },
  ];

  for (const stage of stages) {
    if (!isCurrentRun()) throw new Error("cancelled");
    patch({ videoStatus: "queued" });

    let job, result;
    try {
      job = await animateFootballerClip({ imageUrl, videoPrompt: stage.prompt, provider: stage.provider });
      if (!isCurrentRun()) throw new Error("cancelled");
      patch({ videoJobId: job.id, videoStatus: "running" });
      result = await waitForJob(job.id, 6 * 60 * 1000);
    } catch (err) {
      if (err.message === "cancelled") throw err;
      console.warn(`[Footballer] video stage "${stage.label}" failed to start`, err);
    }
    if (!isCurrentRun()) throw new Error("cancelled");

    const url = result?.status === "succeeded" ? resolveUrl(result) : null;
    if (url) return url;

    // Timed out rather than a clean failure — cancel so a late success at
    // the provider can't charge credits after we've already moved on.
    if (result === null && job?.id) cancelJob(job.id).catch(() => {});

    console.warn(`[Footballer] video stage "${stage.label}" produced no video, trying next stage`);
  }

  console.error("[Footballer] all 4 video stages exhausted (seedance2.0/seedance1.5 × primary/friendly prompt)");
  patch({ videoStatus: "failed", videoError: "Video failed — try again" });
  return null;
}

export default function useFootballerNationalitySwapJob() {
  const [phase,  setPhase]  = useState("idle");
  const [scenes, setScenes] = useState([]);
  const [error,  setError]  = useState(null);

  const cancelRef = useRef(false);
  const activeRef = useRef(false);
  const runIdRef  = useRef(0);
  // Always-fresh mirror of `scenes` so retryScene never reads a stale closure
  const scenesRef = useRef([]);

  const patchScene = (index, patch) =>
    setScenes((prev) => {
      const next = prev.map((s) => (s.index === index ? { ...s, ...patch } : s));
      scenesRef.current = next;
      return next;
    });

  const start = useCallback(async ({ sceneInputs }) => {
    if (activeRef.current) return;
    activeRef.current = true;
    cancelRef.current = false;
    const runId = ++runIdRef.current;
    const isCurrentRun = () => !cancelRef.current && runIdRef.current === runId;

    const initial = sceneInputs.map((si, i) => makeScene(i, si));
    scenesRef.current = initial;
    setScenes(initial);
    setError(null);
    setPhase("images");

    // ── Each scene runs identity → image → video in sequence (identity has to
    //    resolve first now — the localized name gets printed on the player
    //    card, so the image prompt needs it before it can build). Scenes
    //    start staggered by SCENE_STAGGER_MS to avoid simultaneous API bursts.
    const sceneResultSettled = await Promise.allSettled(
      sceneInputs.map(async (si, i) => {
        await delay(i * SCENE_STAGGER_MS);
        if (!isCurrentRun()) throw new Error("cancelled");

        patchScene(i, { identityStatus: "queued", imageStatus: "queued" });

        patchScene(i, { identityStatus: "running" });
        let identity = null;
        try {
          identity = await resolveIdentity(si);
          if (!isCurrentRun()) throw new Error("cancelled");
          patchScene(i, { identityStatus: "succeeded", ...identity });
        } catch (e) {
          if (e.message === "cancelled") throw e;
          console.warn(`[Footballer] scene ${i} identity failed`, e);
          patchScene(i, { identityStatus: "failed" });
        }
        if (!isCurrentRun()) throw new Error("cancelled");

        const imageUrl = await generateImageWithFallback({
          si: { ...si, localizedName: identity?.localizedName },
          patch: (patch) => patchScene(i, patch),
          isCurrentRun,
          onRetrying: () => patchScene(i, { imageStatus: "retrying" }),
        });
        if (!isCurrentRun()) throw new Error("cancelled");
        if (!imageUrl) throw new Error(`scene ${i}: image failed`);
        patchScene(i, { imageStatus: "succeeded", imageUrl, imageError: null });

        return {
          index: i,
          imageUrl,
          spokenLine: identity?.spokenLine ?? `Hi, I'm the new number for ${si.nationality}.`,
          expression: si.expression,
          videoStyle: si.videoStyle,
        };
      })
    );

    if (!isCurrentRun()) return;

    const imageResults = sceneResultSettled
      .filter((r) => r.status === "fulfilled")
      .map((r) => r.value);

    if (!imageResults.length) {
      setError("All scene images failed. Please try again.");
      setPhase("error");
      activeRef.current = false;
      return;
    }

    setPhase("videos");

    await Promise.allSettled(
      imageResults.map(async ({ index, imageUrl, spokenLine, expression, videoStyle }) => {
        if (!isCurrentRun()) return;
        patchScene(index, { videoStatus: "queued" });

        let videoUrl;
        try {
          videoUrl = await generateVideoWithFallback({
            imageUrl, spokenLine, expression, videoStyle,
            patch: (patch) => patchScene(index, patch),
            isCurrentRun,
          });
        } catch (err) {
          if (err.message !== "cancelled") console.warn(`[Footballer] video cascade threw for scene ${index}`, err);
          return;
        }

        if (!isCurrentRun() || !videoUrl) return;
        patchScene(index, { videoStatus: "succeeded", videoUrl, videoError: null });
      })
    );

    if (isCurrentRun()) {
      setPhase("done");
      activeRef.current = false;
    }
  }, []);

  const reset = useCallback(() => {
    cancelRef.current = true;
    runIdRef.current += 1;
    activeRef.current = false;
    setPhase("idle");
    setScenes([]);
    setError(null);
  }, []);

  /**
   * Retry a single failed scene without touching the others.
   * - identityStatus/imageStatus failed → redo identity + image + video
   * - videoStatus failed (but image ok) → redo video only using existing imageUrl
   */
  const retryScene = useCallback(async (sceneIndex) => {
    const scene = scenesRef.current.find((s) => s.index === sceneIndex);
    if (!scene) return;

    const videoFailed = scene.videoStatus === "failed" && scene.imageUrl;
    const needsFull    = scene.imageStatus === "failed" || scene.identityStatus === "failed";
    if (!videoFailed && !needsFull) return;

    setPhase("videos"); // keeps the results panel in "active" mode

    const patchOne = (patch) =>
      setScenes((prev) => {
        const next = prev.map((s) => (s.index === sceneIndex ? { ...s, ...patch } : s));
        scenesRef.current = next;
        return next;
      });

    if (videoFailed && !needsFull) {
      patchOne({ videoStatus: "queued", videoJobId: null, videoUrl: null, videoError: null });
      const videoUrl = await generateVideoWithFallback({
        imageUrl: scene.imageUrl,
        spokenLine: scene.spokenLine,
        expression: scene.expression,
        videoStyle: scene.videoStyle,
        patch: patchOne,
        isCurrentRun: () => true,
      });
      if (videoUrl) {
        patchOne({ videoStatus: "succeeded", videoUrl, videoError: null });
      }
    } else {
      patchOne({
        identityStatus: "queued", imageStatus: "queued", videoStatus: "idle",
        imageUrl: null, imageError: null, videoUrl: null, imageJobId: null, videoJobId: null,
      });

      setPhase("images");

      let identity = null;
      try {
        identity = await resolveIdentity(scene);
        patchOne({ identityStatus: "succeeded", ...identity });
      } catch {
        patchOne({ identityStatus: "failed" });
      }

      const imageUrl = await generateImageWithFallback({
        si: { ...scene, localizedName: identity?.localizedName ?? scene.localizedName },
        patch: patchOne,
        isCurrentRun: () => true,
        onRetrying: () => patchOne({ imageStatus: "retrying" }),
      });
      if (!imageUrl) { setPhase("done"); return; }
      patchOne({ imageStatus: "succeeded", imageUrl, imageError: null });

      setPhase("videos");

      const videoUrl = await generateVideoWithFallback({
        imageUrl,
        spokenLine: identity?.spokenLine ?? scene.spokenLine,
        expression: scene.expression,
        videoStyle: scene.videoStyle,
        patch: patchOne,
        isCurrentRun: () => true,
      });
      if (videoUrl) {
        patchOne({ videoStatus: "succeeded", videoUrl, videoError: null });
      }
    }

    setPhase("done");
  // No [scenes] dep — we read via scenesRef which is always current
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showGeneration = useCallback((generation) => {
    cancelRef.current = true;
    runIdRef.current += 1;
    activeRef.current = false;
    setError(null);
    setScenes(
      (generation?.scenes || [])
        .filter((s) => s.imageUrl || s.videoUrl)
        .map((s, i) => ({
          index: s.index ?? i,
          footballer:  s.footballer ?? "",
          nationality: s.nationality ?? "",
          expression:  s.expression ?? "confident",
          videoStyle:  s.videoStyle ?? "stadium-tunnel",
          identityStatus: "succeeded",
          localizedName: s.localizedName ?? "",
          jerseyNumber:  s.jerseyNumber ?? "",
          spokenLine:    s.spokenLine ?? "",
          language: null,
          imageJobId: null, imageStatus: s.imageUrl ? "succeeded" : "failed", imageUrl: s.imageUrl ?? null, imageError: null,
          videoJobId: null, videoStatus: s.videoUrl ? "succeeded" : "failed", videoUrl: s.videoUrl ?? null, videoError: null,
        }))
    );
    setPhase("done");
  }, []);

  return { phase, scenes, error, start, reset, showGeneration, retryScene };
}
