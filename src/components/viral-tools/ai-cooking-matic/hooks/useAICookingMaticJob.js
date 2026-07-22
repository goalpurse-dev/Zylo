import { useCallback, useRef, useState } from "react";
import { watchJob, cancelJob, runWorkerForJob } from "../../../../lib/jobs";
import {
  generateCookingScene,
  animateCookingClip,
  extractIngredient,
  SCENE_TEMPLATES,
  CLIP_VIDEO_PROMPTS,
  CLIP_PAIRS,
  VIBES,
} from "../api/cookingMaticApi";

const TERMINAL = new Set(["succeeded", "failed", "canceled"]);
const PRIMARY_TIMEOUT_MS = 3 * 60 * 1000;
const VIDEO_TIMEOUT_MS = 9 * 60 * 1000;
const PROVIDER_BUSY_RETRY_DELAYS_MS = [15_000, 30_000, 60_000];

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function resolveUrl(job) {
  const raw = job?.result_url
    || job?.output?.result_url
    || job?.output?.imageUrl
    || job?.output?.image_url
    || job?.output?.data?.[0]?.url
    || job?.output?.results?.[0]?.url
    || null;
  return raw && !raw.includes("localhost") ? raw.trim() : null;
}

function waitForJob(jobId, timeoutMs, onRetrying = null) {
  return new Promise(resolve => {
    let unsubscribe;
    let settled = false;
    const finish = row => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { unsubscribe?.(); } catch { /* already closed */ }
      resolve(row);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    unsubscribe = watchJob(jobId, row => {
      if (onRetrying && row.status === "queued" && Number(row.attempts ?? 0) > 0) onRetrying(row);
      if (TERMINAL.has(row.status)) finish(row);
    });
  });
}

function jobError(job, fallback = "Generation failed") {
  return String(job?.error ?? job?.output?.error ?? job?.finish_error ?? fallback);
}

function isPromptViolation(message) {
  return /content|policy|moderation|safety|unsafe|nsfw|prohibited|violation|rejected/i.test(String(message || ""));
}

function isInternalCreditError(message) {
  return /INSUFFICIENT_CREDITS|LOCKED_GENERATOR/i.test(String(message || ""));
}

function isProviderBusy(message) {
  return /concurrentRequestLimitExceeded|concurrent request limit|balance is reserved by in-flight tasks|provider busy|rate limit|too many requests/i.test(String(message || ""));
}

function friendlyImagePrompt(prompt) {
  return `Safety-safe professional food tutorial. Focus entirely on ordinary prepared food, cookware and a clean kitchen. If a cook is visible, use modest high-neck chef clothing and a neutral family-friendly pose. No exposed chest, suggestive framing, public figure, injury, brand, text, logo or copyrighted character. ${String(prompt)
    .replace(/fitted black top/gi, "modest high-neck charcoal chef shirt")
    .replace(/slender hands/gi, "consistent adult hands")
    .replace(/dramatic|explosion|weapon|blood|violent|dangerous/gi, "cinematic")}`;
}

function friendlyVideoPrompt(prompt) {
  return `Family-friendly food tutorial with calm, safe kitchen movement. Show only the natural cooking action between the supplied frames. No dangerous behavior, injury, brands, text, logos or copyrighted characters. ${String(prompt)
    .replace(/dramatic|explosion|weapon|blood|violent|dangerous/gi, "smooth")}`;
}

const makeScene = index => ({ index, imageJobId: null, imageStatus: "idle", imageUrl: null, error: null });
const makeClip = index => ({ index, videoJobId: null, videoStatus: "idle", videoUrl: null, error: null });

function sceneImageUrl(sceneSnapshot, index) {
  return sceneSnapshot.find(scene => Number(scene?.index) === index)?.imageUrl ?? null;
}

function getSceneReferenceUrls(index, sceneSnapshot) {
  if (index === 0) return [];
  const previousUrl = sceneImageUrl(sceneSnapshot, index - 1);
  const openingDishAnchorUrl = sceneImageUrl(sceneSnapshot, 0);
  const workspaceAnchorUrl = sceneImageUrl(sceneSnapshot, 1);
  const finishedPlateAnchorUrl = sceneImageUrl(sceneSnapshot, 7);

  // Presenter payoff binds the opening cook to the newly finished plate.
  if (index === 8) return [openingDishAnchorUrl, finishedPlateAnchorUrl].filter(Boolean);

  // Final macro is food-only. Avoid feeding the presenter portrait back into
  // the safety model; scene 8 already reconciled the plate to the opening.
  if (index === 9) return [finishedPlateAnchorUrl].filter(Boolean);

  // Cooking frames always receive: immediate food state, immutable worktop,
  // and cook/hand identity. The style image is appended as reference four.
  if (index >= 2) {
    return [previousUrl, workspaceAnchorUrl, openingDishAnchorUrl].filter(Boolean);
  }

  return [openingDishAnchorUrl].filter(Boolean);
}

export default function useAICookingMaticJob() {
  const [phase, setPhase] = useState("idle");
  const [scenes, setScenes] = useState([]);
  const [clips, setClips] = useState([]);
  const [error, setError] = useState(null);
  const [dishLabel, setDishLabel] = useState("");
  const cancelRef = useRef(false);
  const activeRef = useRef(false);
  const runIdRef = useRef(0);
  const sceneRetryIdsRef = useRef({});
  const clipRetryIdsRef = useRef({});
  const vibeIdRef = useRef("dark-moody");

  const patchScene = useCallback((index, patch) => {
    setScenes(previous => previous.map(scene => scene.index === index ? { ...scene, ...patch } : scene));
  }, []);

  const patchClip = useCallback((index, patch) => {
    setClips(previous => previous.map(clip => clip.index === index ? { ...clip, ...patch } : clip));
  }, []);

  const submitScene = useCallback(async ({ index, dish, vibeId, referenceUrls, allowFriendlyPrompt, isCurrentRun }) => {
    const ingredient = extractIngredient(dish);
    const vibe = VIBES.find(item => item.id === vibeId) ?? VIBES[0];
    const originalPrompt = SCENE_TEMPLATES[index](dish, ingredient, vibe.token);
    const prompts = [originalPrompt];
    let lastError = "Image generation failed";
    let providerBusyRetryCount = 0;
    let friendlyPromptQueued = false;

    for (let attempt = 0; attempt < prompts.length; attempt += 1) {
      if (!isCurrentRun()) return null;
      patchScene(index, { imageStatus: "queued", imageUrl: null, error: null });
      let job;
      try {
        job = await generateCookingScene({
          prompt: prompts[attempt],
          referenceUrls,
          styleReferenceUrl: vibe.image ?? null,
        });
        if (!isCurrentRun()) return null;
        patchScene(index, { imageJobId: job.id, imageStatus: "running", error: null });
        const result = await waitForJob(job.id, PRIMARY_TIMEOUT_MS, () => {
          patchScene(index, { imageStatus: "retrying" });
        });
        if (!isCurrentRun()) return null;
        const url = result?.status === "succeeded" ? resolveUrl(result) : null;
        if (url) {
          patchScene(index, { imageStatus: "succeeded", imageUrl: url, error: null });
          return url;
        }
        if (!result && job?.id) void cancelJob(job.id).catch(() => {});
        lastError = jobError(result, result ? "Image generation failed" : "Image generation timed out");
      } catch (submitError) {
        lastError = String(submitError?.message ?? submitError);
        if (isInternalCreditError(lastError)) setError("Not enough credits to regenerate this scene.");
      }

      if (allowFriendlyPrompt && !friendlyPromptQueued && isPromptViolation(lastError)) {
        friendlyPromptQueued = true;
        prompts.push(friendlyImagePrompt(originalPrompt));
      } else if (isProviderBusy(lastError) && providerBusyRetryCount < PROVIDER_BUSY_RETRY_DELAYS_MS.length) {
        const retryDelayMs = PROVIDER_BUSY_RETRY_DELAYS_MS[providerBusyRetryCount];
        providerBusyRetryCount += 1;
        patchScene(index, {
          imageStatus: "retrying",
          error: `Provider is busy. Retrying in ${Math.round(retryDelayMs / 1000)} seconds…`,
        });
        await delay(retryDelayMs);
        if (!isCurrentRun()) return null;
        prompts.push(prompts[attempt]);
      }
    }

    patchScene(index, { imageStatus: "failed", imageUrl: null, error: lastError });
    return null;
  }, [patchScene]);

  const submitClip = useCallback(async ({ index, dish, vibeId, sceneSnapshot, allowFriendlyPrompt, isCurrentRun }) => {
    const [firstIndex, secondIndex] = CLIP_PAIRS[index];
    const firstImageUrl = sceneSnapshot.find(scene => scene.index === firstIndex)?.imageUrl ?? null;
    const secondImageUrl = sceneSnapshot.find(scene => scene.index === secondIndex)?.imageUrl ?? null;
    if (!firstImageUrl || !secondImageUrl) {
      patchClip(index, { videoStatus: "failed", videoUrl: null, error: "Both source scenes are required before this clip can be animated." });
      return null;
    }

    const ingredient = extractIngredient(dish);
    const vibe = VIBES.find(item => item.id === vibeId) ?? VIBES[0];
    const originalPrompt = CLIP_VIDEO_PROMPTS[index](dish, ingredient, vibe.token);
    const prompts = [originalPrompt];
    let lastError = "Video generation failed";

    for (let attempt = 0; attempt < prompts.length; attempt += 1) {
      if (!isCurrentRun()) return null;
      patchClip(index, { videoStatus: "queued", videoUrl: null, error: null });
      let job;
      try {
        job = await animateCookingClip({ firstImageUrl, secondImageUrl, prompt: prompts[attempt] });
        if (!isCurrentRun()) return null;
        patchClip(index, { videoJobId: job.id, videoStatus: "running", error: null });
        const result = await waitForJob(job.id, VIDEO_TIMEOUT_MS);
        if (!isCurrentRun()) return null;
        const url = result?.status === "succeeded" ? resolveUrl(result) : null;
        if (url) {
          patchClip(index, { videoStatus: "succeeded", videoUrl: url, error: null });
          return url;
        }
        if (!result && job?.id) void cancelJob(job.id).catch(() => {});
        lastError = jobError(result, result ? "Video generation failed" : "Video generation timed out");
      } catch (submitError) {
        lastError = String(submitError?.message ?? submitError);
        if (isInternalCreditError(lastError)) setError("Not enough credits to regenerate this clip.");
      }

      if (allowFriendlyPrompt && attempt === 0 && isPromptViolation(lastError)) {
        prompts.push(friendlyVideoPrompt(originalPrompt));
      }
    }

    patchClip(index, { videoStatus: "failed", videoUrl: null, error: lastError });
    return null;
  }, [patchClip]);

  const start = useCallback(async ({ dishName, vibeId }) => {
    if (activeRef.current) return;
    activeRef.current = true;
    cancelRef.current = false;
    const runId = ++runIdRef.current;
    const isCurrentRun = () => !cancelRef.current && runIdRef.current === runId;
    vibeIdRef.current = vibeId;
    setDishLabel(dishName);
    setError(null);
    setScenes(Array.from({ length: 10 }, (_, index) => makeScene(index)));
    setClips([]);
    setPhase("images");

    const completedScenes = [];
    for (let index = 0; index < 10 && isCurrentRun(); index += 1) {
      const referenceUrls = getSceneReferenceUrls(index, completedScenes);
      const imageUrl = await submitScene({ index, dish: dishName, vibeId, referenceUrls, allowFriendlyPrompt: true, isCurrentRun });
      completedScenes[index] = { index, imageUrl };
    }

    if (!isCurrentRun()) { activeRef.current = false; return; }
    setPhase("videos");
    setClips(Array.from({ length: 5 }, (_, index) => makeClip(index)));
    await Promise.allSettled(CLIP_PAIRS.map((_, index) => submitClip({
      index,
      dish: dishName,
      vibeId,
      sceneSnapshot: completedScenes,
      allowFriendlyPrompt: false,
      isCurrentRun,
    })));
    if (isCurrentRun()) setPhase("done");
    activeRef.current = false;
  }, [submitClip, submitScene]);

  const retryScene = useCallback(async index => {
    if (["queued", "running", "retrying"].includes(scenes.find(scene => scene.index === index)?.imageStatus)) return;
    cancelRef.current = false;
    const retryId = Number(sceneRetryIdsRef.current[index] ?? 0) + 1;
    sceneRetryIdsRef.current[index] = retryId;
    const isCurrentRun = () => !cancelRef.current && sceneRetryIdsRef.current[index] === retryId;
    const referenceUrls = getSceneReferenceUrls(index, scenes);
    setError(null);
    if (!activeRef.current) setPhase("retrying");
    const imageUrl = await submitScene({ index, dish: dishLabel || "dish", vibeId: vibeIdRef.current, referenceUrls, allowFriendlyPrompt: true, isCurrentRun });
    if (imageUrl) {
      const dependentClipIndex = CLIP_PAIRS.findIndex(pair => pair.includes(index));
      if (dependentClipIndex >= 0) {
        patchClip(dependentClipIndex, {
          videoStatus: "failed",
          videoUrl: null,
          error: "A source scene changed. Regenerate this clip to keep it in sync.",
        });
      }
    }
    if (isCurrentRun() && !activeRef.current) setPhase("done");
  }, [dishLabel, patchClip, scenes, submitScene]);

  const retryClip = useCallback(async index => {
    if (["queued", "running", "retrying"].includes(clips.find(clip => clip.index === index)?.videoStatus)) return;
    cancelRef.current = false;
    const retryId = Number(clipRetryIdsRef.current[index] ?? 0) + 1;
    clipRetryIdsRef.current[index] = retryId;
    const isCurrentRun = () => !cancelRef.current && clipRetryIdsRef.current[index] === retryId;
    setError(null);
    if (!activeRef.current) setPhase("videos");
    await submitClip({ index, dish: dishLabel || "dish", vibeId: vibeIdRef.current, sceneSnapshot: scenes, allowFriendlyPrompt: true, isCurrentRun });
    if (isCurrentRun() && !activeRef.current) setPhase("done");
  }, [clips, dishLabel, scenes, submitClip]);

  const reset = useCallback(() => {
    cancelRef.current = true;
    activeRef.current = false;
    runIdRef.current += 1;
    sceneRetryIdsRef.current = {};
    clipRetryIdsRef.current = {};
    setPhase("idle");
    setScenes([]);
    setClips([]);
    setError(null);
    setDishLabel("");
  }, []);

  const showGeneration = useCallback(generation => {
    if (!generation) return;
    cancelRef.current = false;
    const runId = ++runIdRef.current;
    const isCurrentRun = () => !cancelRef.current && runIdRef.current === runId;
    const savedScenes = Array.isArray(generation.scenes) ? generation.scenes : [];
    const savedClips = Array.isArray(generation.clips) ? generation.clips : [];
    const restoredScenes = Array.from({ length: 10 }, (_, index) => {
      const saved = savedScenes.find(scene => Number(scene.index) === index);
      if (!saved) return makeScene(index);
      return {
        ...makeScene(index),
        ...saved,
        imageStatus: saved.imageUrl ? "succeeded" : saved.imageStatus ?? "idle",
      };
    });
    const restoredClips = Array.from({ length: 5 }, (_, index) => {
      const saved = savedClips.find(clip => Number(clip.index) === index);
      if (!saved) return makeClip(index);
      return {
        ...makeClip(index),
        ...saved,
        videoStatus: saved.videoUrl ? "succeeded" : saved.videoStatus ?? "idle",
      };
    });
    vibeIdRef.current = generation.vibe_id ?? "dark-moody";
    setDishLabel(generation.dish_name ?? "");
    setScenes(restoredScenes);
    setClips(restoredClips);

    const resumableScenes = restoredScenes.filter(scene => scene.imageJobId && !scene.imageUrl && ["queued", "running", "retrying"].includes(scene.imageStatus));
    const resumableClips = restoredClips.filter(clip => {
      if (!clip.videoJobId || clip.videoUrl) return false;
      if (["queued", "running", "retrying"].includes(clip.videoStatus)) return true;
      return clip.videoStatus === "failed" && /timed out|polling failed|taking long/i.test(String(clip.error || ""));
    });
    const idleScenes = restoredScenes.filter(scene => scene.imageStatus === "idle");
    const idleClips = restoredClips.filter(clip => clip.videoStatus === "idle");
    if (!resumableScenes.length && !resumableClips.length && !idleScenes.length && !idleClips.length) {
      setPhase("done");
      return;
    }

    activeRef.current = true;
    const resume = async () => {
      const workingScenes = restoredScenes.map(scene => ({ ...scene }));
      setPhase("images");

      for (const scene of resumableScenes) {
        const result = await waitForJob(scene.imageJobId, PRIMARY_TIMEOUT_MS);
        if (!isCurrentRun()) return;
        const imageUrl = result?.status === "succeeded" ? resolveUrl(result) : null;
        const patch = imageUrl
          ? { imageStatus: "succeeded", imageUrl, error: null }
          : { imageStatus: "failed", error: jobError(result, "Image job could not be recovered") };
        Object.assign(workingScenes[scene.index], patch);
        patchScene(scene.index, patch);
      }

      for (const scene of workingScenes) {
        if (scene.imageStatus !== "idle" || !isCurrentRun()) continue;
        const referenceUrls = getSceneReferenceUrls(scene.index, workingScenes);
        const imageUrl = await submitScene({
          index: scene.index,
          dish: generation.dish_name || "dish",
          vibeId: vibeIdRef.current,
          referenceUrls,
          allowFriendlyPrompt: true,
          isCurrentRun,
        });
        Object.assign(workingScenes[scene.index], imageUrl
          ? { imageStatus: "succeeded", imageUrl, error: null }
          : { imageStatus: "failed", imageUrl: null });
      }

      if (!isCurrentRun()) return;
      setPhase("videos");
      const workingClips = restoredClips.map(clip => ({ ...clip }));

      // If a previous edge invocation died after Runware accepted the task,
      // ask job-worker to resume polling its saved provider_job_id. Recovery
      // never launches a second paid provider video.
      await Promise.allSettled(resumableClips.map(clip =>
        runWorkerForJob(clip.videoJobId, true)
      ));

      await Promise.allSettled(resumableClips.map(async clip => {
        const result = await waitForJob(clip.videoJobId, VIDEO_TIMEOUT_MS);
        if (!isCurrentRun()) return;
        const videoUrl = result?.status === "succeeded" ? resolveUrl(result) : null;
        const patch = videoUrl
          ? { videoStatus: "succeeded", videoUrl, error: null }
          : { videoStatus: "failed", error: jobError(result, "Video job could not be recovered") };
        Object.assign(workingClips[clip.index], patch);
        patchClip(clip.index, patch);
      }));

      await Promise.allSettled(workingClips
        .filter(clip => clip.videoStatus === "idle")
        .map(clip => submitClip({
          index: clip.index,
          dish: generation.dish_name || "dish",
          vibeId: vibeIdRef.current,
          sceneSnapshot: workingScenes,
          allowFriendlyPrompt: false,
          isCurrentRun,
        })));

      if (isCurrentRun()) setPhase("done");
      activeRef.current = false;
    };
    void resume();
  }, [patchClip, patchScene, submitClip, submitScene]);

  const startVideoOnly = useCallback(async ({ vibeId = "dark-moody" } = {}) => {
    if (!scenes.some(scene => scene.imageUrl)) return;
    cancelRef.current = false;
    const runId = ++runIdRef.current;
    const isCurrentRun = () => !cancelRef.current && runIdRef.current === runId;
    vibeIdRef.current = vibeId;
    setPhase("videos");
    setClips(Array.from({ length: 5 }, (_, index) => makeClip(index)));
    await Promise.allSettled(CLIP_PAIRS.map((_, index) => submitClip({
      index,
      dish: dishLabel || "dish",
      vibeId,
      sceneSnapshot: scenes,
      allowFriendlyPrompt: false,
      isCurrentRun,
    })));
    if (isCurrentRun()) setPhase("done");
  }, [dishLabel, scenes, submitClip]);

  return {
    phase,
    scenes,
    clips,
    error,
    dishLabel,
    start,
    reset,
    showGeneration,
    startVideoOnly,
    retryScene,
    retryClip,
  };
}
