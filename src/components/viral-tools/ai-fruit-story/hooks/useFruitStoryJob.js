import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { watchJob, getJob } from "../../../../lib/jobs";
import {
  planFruitStory,
  generateCharacterPortrait,
  generateSceneImage,
  regenerateSceneImage,
  animateClip,
  FRUIT_VIDEO_MODELS,
  DEFAULT_FRUIT_VIDEO_MODEL,
  buildVideoClipsFromScenes,
  buildSceneVideoPrompt,
  buildSceneVideoPromptWithDialogue,
  generateVisionVideoPrompts,
  dialogueToVoiceover,
  normalizeClipDialogue,
  normalizeClipVoiceover,
  createFruitStoryGeneration,
  updateGenerationScenes,
  updateFruitStoryGeneration,
  listFruitStoryGenerations,
  getFruitStoryGeneration,
  deleteFruitStoryGeneration,
} from "../api/fruitStoryApi";

const TERMINAL = new Set(["succeeded", "failed", "canceled"]);
const isTerminal = (status) => TERMINAL.has(status);

/**
 * Waits for a single job to reach terminal status.
 * Returns the terminal job row (or null on failure/timeout).
 * Used for sequential scene generation so each scene's imageUrl is available
 * before the next scene starts — enabling real previous-scene continuity refs.
 *
 * Timeout: 4.5 min — safely under runware-image's 5-min wall-clock limit.
 */
function waitForJobCompletion(jobId, timeoutMs = 4.5 * 60 * 1000) {
  return new Promise((resolve) => {
    let unsubFn;
    const timer = setTimeout(() => {
      try { unsubFn?.(); } catch { /* ignore */ }
      resolve(null);
    }, timeoutMs);

    unsubFn = watchJob(jobId, (row) => {
      if (isTerminal(row.status)) {
        clearTimeout(timer);
        try { unsubFn?.(); } catch { /* ignore */ }
        resolve(row);
      }
    });
  });
}

/* ─── URL validators ─────────────────────────────────────────────────────── */

function isValidJobResultUrl(value) {
  const url = typeof value === "string" ? value.trim() : "";
  if (/^data:image\//i.test(url) || /^blob:/i.test(url)) return true;
  if (!/^https?:\/\//i.test(url)) return false;
  let parsed;
  try { parsed = new URL(url); } catch { return false; }
  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();
  if (host === "runware.ai" && path.includes("/docs/")) return false;
  return (
    url.length > 0 &&
    url !== "undefined" && url !== "null" && !url.startsWith("[object ") &&
    (
      host === "im.runware.ai" ||
      path.includes("/image/") ||
      path.includes("/storage/v1/object/") ||
      /\.(png|jpe?g|webp|gif|avif)$/i.test(path)
    )
  );
}

function isValidMediaResultUrl(value) {
  const url = typeof value === "string" ? value.trim() : "";
  if (/^data:(image|video)\//i.test(url) || /^blob:/i.test(url)) return true;
  if (!/^https?:\/\//i.test(url)) return false;
  let parsed;
  try { parsed = new URL(url); } catch { return false; }
  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();
  if (host === "runware.ai" && path.includes("/docs/")) return false;
  return url.length > 0 && url !== "undefined" && url !== "null" && !url.startsWith("[object ");
}

function resolveJobMediaUrl(job) {
  const raw =
    job?.result_url || job?.resultUrl ||
    job?.output?.result_url || job?.output?.resultUrl ||
    job?.output?.videoUrl || job?.output?.video_url || job?.output?.url ||
    job?.output?.imageUrl || job?.output?.image_url ||
    job?.output?.data?.[0]?.url || job?.output?.data?.[0]?.videoURL || job?.output?.data?.[0]?.videoUrl ||
    job?.output?.results?.[0]?.url || job?.output?.results?.[0]?.videoURL || job?.output?.results?.[0]?.videoUrl ||
    null;
  return isValidMediaResultUrl(raw) ? raw.trim() : null;
}

export function resolveJobResultUrl(job) {
  const raw =
    job?.result_url || job?.resultUrl ||
    job?.output?.result_url || job?.output?.resultUrl ||
    job?.output?.imageUrl || job?.output?.image_url || job?.output?.imageURL || job?.output?.url ||
    job?.output?.data?.[0]?.url || job?.output?.data?.[0]?.imageURL || job?.output?.data?.[0]?.imageUrl ||
    job?.output?.results?.[0]?.url || job?.output?.results?.[0]?.imageURL || job?.output?.results?.[0]?.imageUrl ||
    null;
  return isValidJobResultUrl(raw) ? raw.trim() : null;
}

/* ─── DB persistence helpers ─────────────────────────────────────────────── */

/** Derive overall status from scene array for saving to DB. */
function deriveScenesStatus(scenes, videoPhase = false) {
  if (!scenes.length) return "generating_images";
  const imageDone   = scenes.every((s) => isTerminal(s.imageStatus ?? "queued"));
  const imageSucceeded = scenes.some((s) => s.imageUrl);
  const anyImageFailed = scenes.some((s) => s.imageStatus === "failed" && !s.imageUrl);
  const clipScenes = scenes.filter((s) => s.videoClipNumber || s.videoJobId || s.videoUrl);
  const videoDone   = clipScenes.length > 0 && clipScenes.every((s) => isTerminal(s.videoStatus ?? "idle"));
  const videoSucceeded = clipScenes.some((s) => s.videoUrl);

  if (videoPhase && videoDone && videoSucceeded) return "completed";
  if (videoPhase) return "animating";
  if (imageDone && imageSucceeded && !anyImageFailed) return "images_generated";
  if (imageDone && imageSucceeded && anyImageFailed)  return "partial_failed";
  return "generating_images";
}

/** Strip React/job-watcher state from scenes before persisting. */
function scenesForDB(scenes) {
  return scenes.map((s) => ({
    sceneNumber:          s.sceneNumber,
    title:                s.title,
    beatType:             s.beatType,
    storyPurpose:         s.storyPurpose,
    charactersInScene:    s.characterIdsInScene ?? s.charactersInScene ?? [],
    forbiddenCharacters:  s.forbiddenCharacters ?? [],
    imagePrompt:          s.imagePrompt,
    videoPrompt:          s.videoPrompt,
    videoVoiceover:       s.videoVoiceover ?? null,
    videoDialogue:        s.videoDialogue ?? null,
    imageJobId:           s.imageJobId ?? null,
    imageUrl:             s.imageUrl   ?? null,
    imageStatus:          s.imageStatus ?? "queued",
    videoClipNumber:      s.videoClipNumber ?? null,
    videoEndSceneNumber:  s.videoEndSceneNumber ?? null,
    videoJobId:           s.videoJobId ?? null,
    videoUrl:             s.videoUrl   ?? null,
    videoStatus:          s.videoStatus ?? "idle",
  }));
}

/* ═══════════════════════════════════════════════════════════════════════════
   useFruitStoryJob
═══════════════════════════════════════════════════════════════════════════ */

export default function useFruitStoryJob({ form }) {
  const [phase,            setPhase]            = useState("idle");
  const [scenes,           setScenes]           = useState([]);
  const [error,            setError]            = useState(null);
  const [generationId,     setGenerationId]     = useState(null);
  const [videoClips,       setVideoClips]        = useState([]);
  const [recentGenerations, setRecentGenerations] = useState([]);
  const [isLoadingRecent,  setIsLoadingRecent]  = useState(false);

  const formRef        = useRef(form);
  const scenesRef      = useRef(scenes);
  const videoClipsRef  = useRef(videoClips);
  const generationRef  = useRef(generationId);
  const castBibleRef   = useRef([]);
  const phaseRef       = useRef(phase);
  const generationRunIdRef = useRef(null);
  const inFlightSceneKeysRef = useRef(new Set());
  const inFlightClipKeysRef = useRef(new Set());
  const autoAnimateTriggeredRef = useRef(false);

  useEffect(() => { formRef.current       = form;         }, [form]);
  useEffect(() => { scenesRef.current     = scenes;       }, [scenes]);
  useEffect(() => { videoClipsRef.current = videoClips;   }, [videoClips]);
  useEffect(() => { generationRef.current = generationId; }, [generationId]);
  useEffect(() => { phaseRef.current      = phase;        }, [phase]);

  const watchersRef = useRef({});

  const clearWatchers = useCallback(() => {
    Object.values(watchersRef.current).forEach((unsub) => { try { unsub(); } catch { /* ignore */ } });
    watchersRef.current = {};
  }, []);

  useEffect(() => () => clearWatchers(), [clearWatchers]);

  /* ─── Auto-transition: generating-scenes → scenes-done ───
   * Images and videos now run concurrently (each scene's video starts the
   * moment that scene's image succeeds — see startSceneVideo), so this just
   * marks "every image job has reached a terminal state" for persistence and
   * as a catch-up trigger below. It no longer gates video start.
   */
  useEffect(() => {
    if (phase !== "generating-scenes" || scenes.length === 0) return;
    const allDone = scenes.every((s) => isTerminal(s.imageStatus ?? "queued"));
    if (allDone) {
      setPhase("scenes-done");
      const dbStatus = deriveScenesStatus(scenes);
      void updateGenerationScenes(generationRef.current, scenesForDB(scenes), dbStatus);
    }
  }, [phase, scenes]);

  /* ─── Auto-transition: → done ───
   * Fires whenever every image is terminal AND every scene that has an image
   * also has a terminal video status (or never got a video job at all, e.g.
   * an image that failed). Independent of the exact phase string so it still
   * fires correctly now that video generation overlaps image generation.
   */
  useEffect(() => {
    if (phase === "idle" || phase === "planning" || phase === "failed" || phase === "done") return;
    if (scenes.length === 0) return;
    const imagesDone = scenes.every((s) => isTerminal(s.imageStatus ?? "queued"));
    if (!imagesDone) return;
    const clipScenes = scenes.filter((s) => s.imageUrl && (s.videoClipNumber || s.videoJobId || s.videoUrl));
    const videosDone = clipScenes.every((s) => isTerminal(s.videoStatus ?? "idle"));
    if (!videosDone) return;
    setPhase("done");
    void updateGenerationScenes(generationRef.current, scenesForDB(scenes), "completed");
  }, [phase, scenes]);

  /* ─── totalProgress ─── combined image + video progress per scene, so the
   * bar reflects both stages happening at once instead of jumping 0→100
   * twice. */
  const totalProgress = useMemo(() => {
    if (scenes.length === 0) return 0;
    const sum = scenes.reduce((acc, s) => {
      const imagePart = s.imageStatus === "succeeded" ? 50 : (s.imageProgress ?? 0) / 2;
      const videoPart = s.videoJobId ? (s.videoProgress ?? 0) / 2 : 0;
      return acc + imagePart + videoPart;
    }, 0);
    return Math.round(sum / scenes.length);
  }, [scenes]);

  /* ─── applySceneImageUpdate ─── */
  const applySceneImageUpdate = useCallback(
    (prev, row, finalUrl) =>
      prev.map((s) => {
        if (s.imageJobId !== row.id) return s;
        return {
          ...s,
          imageStatus:   row.status,
          imageProgress: row.status === "succeeded" ? 100 : Math.min(99, Number(row.progress || 0)),
          imageUrl:      finalUrl || s.imageUrl || null,
          imageJob:      row,
          error:         row.status === "failed" ? (row.error || null) : null,
        };
      }),
    [],
  );

  /* ─── watchImageJob ─── */
  const watchImageJob = useCallback((sceneNumber, jobId) => {
    const key = `image-${sceneNumber}`;
    if (watchersRef.current[key]) { try { watchersRef.current[key](); } catch { /* ignore */ } delete watchersRef.current[key]; }

    const unsub = watchJob(jobId, async (row) => {
      let resolvedUrl = resolveJobResultUrl(row);

      console.log("[fruit] watch image update", { sceneNumber, status: row.status, result_url: row.result_url, resolvedUrl });

      if (row.status === "succeeded" && !resolvedUrl) {
        setTimeout(async () => {
          try {
            const fresh = await getJob(row.id);
            const freshUrl = resolveJobResultUrl(fresh);
            console.log("[fruit] refetch result", { sceneNumber, freshUrl });
            if (freshUrl) {
              setScenes((prev) => {
                const next = applySceneImageUpdate(prev, fresh, freshUrl);
                void updateGenerationScenes(generationRef.current, scenesForDB(next));
                return next;
              });
            }
          } catch { /* ignore */ }
        }, 500);
      }

      setScenes((prev) => {
        const next = applySceneImageUpdate(prev, row, resolvedUrl);
        // Persist after every terminal update
        if (isTerminal(row.status)) {
          void updateGenerationScenes(generationRef.current, scenesForDB(next));
        }
        return next;
      });
    });

    watchersRef.current[key] = unsub;
  }, [applySceneImageUpdate]);

  /* ─── watchVideoJob ─── */
  const watchVideoJob = useCallback((sceneNumber, jobId) => {
    const key = `video-${sceneNumber}`;
    if (watchersRef.current[key]) { try { watchersRef.current[key](); } catch { /* ignore */ } delete watchersRef.current[key]; }

    const unsub = watchJob(jobId, (row) => {
      const finalUrl = resolveJobMediaUrl(row);
      setVideoClips((prev) => prev.map((clip) =>
        clip.startSceneNumber === sceneNumber || clip.videoJobId === row.id
          ? {
              ...clip,
              videoStatus: row.status,
              videoProgress: row.status === "succeeded" ? 100 : Math.min(99, Number(row.progress ?? clip.videoProgress ?? 0)),
              videoUrl: finalUrl || clip.videoUrl || null,
              error: row.status === "failed" ? (row.error || clip.error) : clip.error,
            }
          : clip,
      ));
      setScenes((prev) => {
        const next = prev.map((s) => {
          if (s.videoJobId !== row.id && s.sceneNumber !== sceneNumber) return s;
          return {
            ...s,
            videoStatus:   row.status,
            videoProgress: row.status === "succeeded" ? 100 : Math.min(99, Number(row.progress ?? s.videoProgress ?? 0)),
            videoUrl:      finalUrl || s.videoUrl || null,
            error:         row.status === "failed" ? (row.error || s.error) : s.error,
          };
        });
        if (isTerminal(row.status)) {
          void updateGenerationScenes(generationRef.current, scenesForDB(next));
        }
        return next;
      });
    });
    watchersRef.current[key] = unsub;
  }, []);

  /* ─── startSceneVideo ───────────────────────────────────────────────────
   * Animates ONE scene as soon as its image is ready, instead of waiting for
   * every scene's image to finish first. Builds that scene's video prompt
   * (fast text pass, then a best-effort vision pass) and launches the clip.
   * Safe to call concurrently for multiple scenes — inFlightClipKeysRef and
   * the videoJobId/videoUrl checks in callers prevent double-starts.
   * ────────────────────────────────────────────────────────────────────── */
  const startSceneVideo = useCallback(async (scene, f, castBible, videoModel) => {
    const key = `clip:${scene.sceneNumber}`;
    if (inFlightClipKeysRef.current.has(key)) return;
    inFlightClipKeysRef.current.add(key);

    try {
      // Phase 1: fast text-based prompt — unblocks launch immediately
      let workingScene = { ...scene, videoPrompt: buildSceneVideoPrompt({ scene, form: f }) };
      setScenes((prev) => prev.map((s) =>
        s.sceneNumber === scene.sceneNumber ? { ...s, videoPrompt: workingScene.videoPrompt } : s,
      ));

      // Phase 2: vision-enhance this one scene (best-effort, keeps text prompt on failure)
      try {
        const visionData = await generateVisionVideoPrompts({
          scenes: [workingScene],
          form: { ...f, castBible },
        });
        const v = visionData?.scenes?.[0];
        if (v?.dialogue?.length) {
          workingScene = {
            ...workingScene,
            videoPrompt: buildSceneVideoPromptWithDialogue({ scene: workingScene, form: f, dialogue: v.dialogue }),
          };
          setScenes((prev) => prev.map((s) =>
            s.sceneNumber === scene.sceneNumber ? { ...s, videoPrompt: workingScene.videoPrompt } : s,
          ));
        }
      } catch (err) {
        console.warn(`[AI FRUIT] vision prompt failed for scene ${scene.sceneNumber}, keeping text prompt`, err);
      }

      const modelInfo = FRUIT_VIDEO_MODELS[videoModel] ?? FRUIT_VIDEO_MODELS[DEFAULT_FRUIT_VIDEO_MODEL];
      const clip = {
        clipNumber:         scene.sceneNumber,
        outputLabel:        `Video ${scene.sceneNumber}`,
        displaySceneNumber: scene.sceneNumber,
        startSceneNumber:   scene.sceneNumber,
        startImageUrl:      scene.imageUrl,
        duration:            modelInfo.duration,
        startPrompt:         workingScene.videoPrompt,
        videoPrompt:         workingScene.videoPrompt,
        dialogue:            normalizeClipDialogue(workingScene.videoDialogue ?? []),
        voiceover:           normalizeClipVoiceover(workingScene.videoVoiceover ?? ""),
      };

      setVideoClips((prev) => prev.some((c) => c.clipNumber === clip.clipNumber)
        ? prev.map((c) => (c.clipNumber === clip.clipNumber ? { ...c, ...clip } : c))
        : [...prev, clip]);

      let job, lastErr;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          job = await animateClip({ clip, startScene: workingScene, form: f, videoModel });
          break;
        } catch (err) {
          lastErr = err;
          const isTimeout = /idle.?timeout|504/i.test(err?.message ?? "");
          if (isTimeout && attempt < 2) {
            await new Promise((r) => setTimeout(r, (attempt + 1) * 8000));
          } else {
            throw err;
          }
        }
      }
      if (!job) throw lastErr;

      setVideoClips((prev) => prev.map((c) =>
        c.clipNumber === clip.clipNumber ? { ...c, videoJobId: job.id, videoStatus: job.status, videoProgress: 0 } : c,
      ));
      setScenes((prev) => {
        const next = prev.map((s) =>
          s.sceneNumber === scene.sceneNumber
            ? {
                ...s,
                videoClipNumber: clip.clipNumber,
                videoJobId:      job.id,
                videoStatus:     job.status,
                videoProgress:   0,
                videoPrompt:     workingScene.videoPrompt,
                videoVoiceover:  clip.voiceover ?? "",
                videoDialogue:   clip.dialogue ?? [],
              }
            : s,
        );
        void updateGenerationScenes(generationRef.current, scenesForDB(next));
        return next;
      });

      watchVideoJob(scene.sceneNumber, job.id);
    } catch (e) {
      console.error(`[AI FRUIT] scene ${scene.sceneNumber} video failed to start:`, e?.message ?? e);
      setVideoClips((prev) => prev.map((c) =>
        c.clipNumber === scene.sceneNumber ? { ...c, videoStatus: "failed", error: e.message ?? "Failed to start animation job" } : c,
      ));
      setScenes((prev) => prev.map((s) =>
        s.sceneNumber === scene.sceneNumber
          ? { ...s, videoStatus: "failed", error: e.message ?? "Failed to start animation job" }
          : s,
      ));
    } finally {
      inFlightClipKeysRef.current.delete(key);
    }
  }, [watchVideoJob]);

  /* ─── loadRecentGenerations ─── */
  const loadRecentGenerations = useCallback(async () => {
    setIsLoadingRecent(true);
    try {
      const list = await listFruitStoryGenerations(20);
      setRecentGenerations(list);
    } catch (e) {
      console.error("[useFruitStoryJob] loadRecentGenerations failed:", e.message);
    } finally {
      setIsLoadingRecent(false);
    }
  }, []);

  // Load recent generations on mount
  useEffect(() => { void loadRecentGenerations(); }, [loadRecentGenerations]);

  /* ─── loadGeneration ─── */
  const loadGeneration = useCallback(async (id) => {
    try {
      const row = await getFruitStoryGeneration(id);
      if (!row) return null;

      const restoredScenes = (row.scenes ?? []).map((s) => ({
        ...s,
        characterIdsInScene:  s.charactersInScene ?? [],
        charactersInScene:    s.charactersInScene ?? [],
        forbiddenCharacters:  s.forbiddenCharacters ?? [],
        environment:          s.environment ?? "",
        continuityFromPrevious: s.continuityFromPrevious ?? false,
        emotionDirection:     s.emotionDirection ?? "",
        actionDirection:      s.actionDirection ?? "",
        cameraDirection:      s.cameraDirection ?? "",
        backgroundDetail:     s.backgroundDetail ?? "",
        imageProgress:        s.imageUrl ? 100 : 0,
        videoProgress:        s.videoUrl ? 100 : 0,
        videoDialogue:        s.videoDialogue ?? [],
        imageJob:             null,
        error:                null,
      }));

      castBibleRef.current = row.cast_data ?? [];
      setGenerationId(row.id);
      generationRef.current = row.id;
      setScenes(restoredScenes);
      setVideoClips(buildVideoClipsFromScenes(restoredScenes));

      // Derive phase from status
      const statusToPhase = {
        generating_images: "generating-scenes",
        images_generated:  "scenes-done",
        partial_failed:    "scenes-done",
        animating:         "animating",
        completed:         "done",
      };
      const restoredPhase = statusToPhase[row.status] ?? "scenes-done";
      // Update ref immediately so guards (e.g. startAnimation) see the correct phase
      // before the next React render cycle runs the effect.
      phaseRef.current = restoredPhase;
      setPhase(restoredPhase);
      setError(null);

      // Re-attach watchers for any image jobs that were in-flight when the user
      // left the page during image generation.
      if (row.status === "generating_images") {
        for (const scene of restoredScenes) {
          if (scene.imageJobId && !isTerminal(scene.imageStatus ?? "queued")) {
            watchImageJob(scene.sceneNumber, scene.imageJobId);
          }
        }
      }

      // Re-attach watchers for any video jobs that were in-flight when the user
      // left the page. This lets them complete (or surface as failed) without
      // the UI being permanently stuck at "Animating".
      if (row.status === "animating") {
        for (const scene of restoredScenes) {
          if (scene.videoJobId && !isTerminal(scene.videoStatus ?? "idle")) {
            watchVideoJob(scene.sceneNumber, scene.videoJobId);
          }
        }
      }

      return row;
    } catch (e) {
      console.error("[useFruitStoryJob] loadGeneration failed:", e.message);
      return null;
    }
  }, [watchImageJob, watchVideoJob]);

  /* ─── deleteGeneration ─── */
  const deleteGeneration = useCallback(async (id) => {
    try {
      await deleteFruitStoryGeneration(id);
      setRecentGenerations((prev) => prev.filter((g) => g.id !== id));
      if (generationRef.current === id) {
        setGenerationId(null);
        setScenes([]);
        setPhase("idle");
      }
    } catch (e) {
      console.error("[useFruitStoryJob] deleteGeneration failed:", e.message);
    }
  }, []);

  /* ─── startSceneGeneration ─── */
  const startSceneGeneration = useCallback(async (overrides = {}) => {
    if (phaseRef.current === "planning" || phaseRef.current === "generating-characters" || phaseRef.current === "generating-scenes") {
      console.warn("[AI FRUIT] startSceneGeneration ignored because already running");
      return;
    }

    const generationRunId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `run-${Date.now()}`;
    generationRunIdRef.current = generationRunId;
    inFlightSceneKeysRef.current.clear();
    autoAnimateTriggeredRef.current = false;

    clearWatchers();
    setError(null);
    phaseRef.current = "planning";
    setPhase("planning");

    const f = { ...formRef.current, ...overrides };

    /* 1. Plan */
    let plan;
    try {
      plan = await planFruitStory({
        storyIdea:          f.storyIdea,
        storyPreset:        f.storyPreset,
        conflict:           f.conflict,
        selectedCharacters: f.selectedCharacters ?? [],
        sceneCount:         f.sceneCount ?? 5,
        storyLength:        f.storyLength ?? "30s",
        sceneAspect:        f.sceneAspect ?? "9:16",
        styleId:            f.style ?? "cinematic",
      });
    } catch (e) {
      setError(e.message ?? "Story planning failed");
      phaseRef.current = "failed";
      setPhase("failed");
      return;
    }

    const castBible = plan.cast ?? [];

    /* 1.5 Generate one solo reference portrait per cast member BEFORE any
     *     scene runs — mirrors the manual creator workflow's "character
     *     design" step. Portraits are independent of each other, so they
     *     run in parallel. A failed/timed-out portrait is non-fatal: that
     *     character's scenes just fall back to text-only description
     *     (buildSceneRefSlots already handles a missing portraitUrl).
     */
    phaseRef.current = "generating-characters";
    setPhase("generating-characters");

    await Promise.allSettled(
      castBible.map(async (member) => {
        try {
          const job = await generateCharacterPortrait({ member, form: f });
          const finished = await waitForJobCompletion(job.id);
          const url = finished?.status === "succeeded" ? resolveJobResultUrl(finished) : null;
          if (url) member.portraitUrl = url;
        } catch (e) {
          console.error("[useFruitStoryJob] character portrait failed:", member?.id, e?.message);
        }
      }),
    );

    castBibleRef.current = castBible;

    /* 2. Initialise scene state */
    const planned = plan.scenes.map((s, index) => {
      const sceneNumber = Number(s.sceneNumber || index + 1);
      return ({
      sceneNumber,
      title:                 s.title               ?? `Scene ${sceneNumber}`,
      storyPreset:           f.storyPreset          ?? "",
      imagePrompt:           s.imagePrompt          ?? "",
      videoPrompt:           "",
      videoDialogue:         Array.isArray(s.videoDialogue) ? s.videoDialogue : [],
      negativePrompt:        s.negativePrompt       ?? "",
      beatType:              s.beatType             ?? "",
      storyPurpose:          s.storyPurpose         ?? s.scenePurpose ?? "",
      characterIdsInScene:   s.characterIdsInScene  ?? s.charactersInScene ?? [],
      charactersInScene:     s.charactersInScene     ?? s.characterIdsInScene ?? [],
      charactersNotInScene:  s.charactersNotInScene  ?? [],
      forbiddenCharacters:   s.forbiddenCharacters   ?? [],
      emotionalBeat:         s.emotionalBeat         ?? "",
      emotionDirection:      s.emotionDirection      ?? "",
      actionDirection:       s.actionDirection       ?? "",
      cameraDirection:       s.cameraDirection       ?? "",
      backgroundDetail:      s.backgroundDetail      ?? "",
      captionText:           s.captionText           ?? "",
      durationSeconds:       s.durationSeconds       ?? 6,
      environment:           s.environment           ?? "",
      continuityFromPrevious: s.continuityFromPrevious ?? false,
      imageJobId:    null,
      imageStatus:   "queued",
      imageProgress: 0,
      imageUrl:      null,
      imageJob:      null,
      videoJobId:    null,
      videoStatus:   "idle",
      videoProgress: 0,
      videoUrl:      null,
      error:         null,
      });
    });

    setScenes(planned);
    setVideoClips([]);
    phaseRef.current = "generating-scenes";
    setPhase("generating-scenes");

    /* 3. Create DB row */
    let genId = null;
    try {
      genId = await createFruitStoryGeneration({
        title:         plan.title ?? plan.storyTitle ?? f.storyIdea?.slice(0, 80),
        storyAngle:    plan.storyAngle ?? f.storyPreset,
        storyIdea:     f.storyIdea,
        sceneCount:    f.sceneCount ?? 5,
        sceneAspect:   f.sceneAspect ?? "9:16",
        imageModel:    f.sceneImageModel ?? "zyvo-v2",
        animationModel:f.animationModel ?? null,
        castData:      castBible,
        plannerOutput: { title: plan.title, hook: plan.hook, storyDNA: plan.storyDNA },
        scenes:        scenesForDB(planned),
      });
      setGenerationId(genId);
    } catch (e) {
      console.error("[useFruitStoryJob] createFruitStoryGeneration failed:", e.message);
      // Non-fatal — continue generating even if save fails
    }

    const imageToolKey = f.sceneImageModel ?? "zyvo-v2";

    /* 4. Generate scenes SEQUENTIALLY so each scene can use the previous
     *    scene's real imageUrl as an environment/continuity reference.
     *    watchImageJob keeps updating the UI as each job progresses.
     *    waitForJobCompletion blocks until terminal before starting the next.
     */
    let previousCompletedScene = null;

    for (const [index, scene] of planned.entries()) {
      const sceneNumber = Number(scene.sceneNumber || index + 1);
      const sceneKey = `${generationRunId}:image:${sceneNumber}`;
      if (inFlightSceneKeysRef.current.has(sceneKey)) {
        console.warn("[AI FRUIT] duplicate scene blocked", {
          runId: generationRunId,
          sceneNumber,
          key: sceneKey,
        });
        continue;
      }
      inFlightSceneKeysRef.current.add(sceneKey);

      const seqStart = new Date().toISOString();
      console.log(`[useFruitStoryJob] SEQUENTIAL START scene ${scene.sceneNumber} at ${seqStart}`, {
        prevSceneImageUrl: previousCompletedScene?.imageUrl?.slice(0, 60) ?? null,
      });
      try {
        const job = await generateSceneImage({
          scene,
          form:                  f,
          imageToolKey,
          previousSceneImageUrl: previousCompletedScene?.imageUrl ?? null,
          prevScene:             previousCompletedScene,
          castBible,
          generationRunId,
        });

        console.log(`[useFruitStoryJob] SEQUENTIAL scene ${scene.sceneNumber} job created: ${job.id}`);

        setScenes((prev) => {
          const next = prev.map((s) =>
            s.sceneNumber === scene.sceneNumber
              ? { ...s, imageJobId: job.id, imageStatus: job.status }
              : s,
          );
          void updateGenerationScenes(genId, scenesForDB(next));
          return next;
        });

        watchImageJob(scene.sceneNumber, job.id);

        console.log(`[useFruitStoryJob] SEQUENTIAL waiting for scene ${scene.sceneNumber} job ${job.id}…`);

        // Block until this scene completes — its imageUrl feeds the next scene's continuity ref
        const finishedJob = await waitForJobCompletion(job.id);
        const resultUrl = finishedJob?.status === "succeeded"
          ? resolveJobResultUrl(finishedJob)
          : null;
        const seqEnd    = new Date().toISOString();

        console.log(`[useFruitStoryJob] SEQUENTIAL scene ${scene.sceneNumber} terminal at ${seqEnd}`, {
          resultUrl: resultUrl?.slice(0, 80) ?? null,
        });

        if (resultUrl) {
          previousCompletedScene = {
            ...scene,
            imageUrl: resultUrl,
            environment: scene.environment,
          };
          // Fire-and-forget: animate this scene right now instead of waiting
          // for every other scene's image to finish first. Runs concurrently
          // with the next scene's (sequential) image generation.
          void startSceneVideo(previousCompletedScene, f, castBible, f.animationModel ?? DEFAULT_FRUIT_VIDEO_MODEL);
        } else {
          previousCompletedScene = null;
        }
      } catch (e) {
        console.error(`[useFruitStoryJob] SEQUENTIAL scene ${scene.sceneNumber} threw:`, e?.message ?? e);
        setScenes((prev) => prev.map((s) =>
          s.sceneNumber === scene.sceneNumber
            ? { ...s, imageStatus: "failed", error: e.message ?? "Failed to start image job" }
            : s,
        ));
        previousCompletedScene = null;
      } finally {
        inFlightSceneKeysRef.current.delete(sceneKey);
      }
    }

    // Refresh recent generations list after all scenes have been submitted
    void loadRecentGenerations();
  }, [clearWatchers, watchImageJob, loadRecentGenerations, startSceneVideo]);

  const updateClipVoiceover = useCallback((clipNumber, value) => {
    const nextDialogue = Array.isArray(value)
      ? normalizeClipDialogue(value)
      : (value?.dialogue ? normalizeClipDialogue(value.dialogue) : null);
    const nextVoiceover = nextDialogue
      ? dialogueToVoiceover(nextDialogue)
      : normalizeClipVoiceover(value?.voiceover ?? value);
    setVideoClips((prev) => {
      const base = prev.length ? prev : buildVideoClipsFromScenes(scenesRef.current);
      return base.map((clip) =>
        Number(clip.clipNumber) === Number(clipNumber)
          ? { ...clip, dialogue: nextDialogue ?? clip.dialogue, voiceover: nextVoiceover }
          : clip,
      );
    });
  }, []);

  /* ─── startAnimation ───────────────────────────────────────────────────
   * Catch-up pass: animates every scene that already has an image but no
   * video yet. In the normal live flow this is a no-op — startSceneVideo
   * already fired per scene inside startSceneGeneration's loop — but it
   * matters for restoring a saved generation (images done, videos never
   * started) and as a safety net if a per-scene launch was ever missed.
   * ────────────────────────────────────────────────────────────────────── */
  const startAnimation = useCallback(async () => {
    const currentScenes = scenesRef.current;
    const f             = formRef.current;
    const castBible     = castBibleRef.current ?? [];
    const videoModel    = f.animationModel ?? DEFAULT_FRUIT_VIDEO_MODEL;

    const needsVideo = [...currentScenes]
      .filter((scene) => scene.imageUrl && !scene.videoJobId && !scene.videoUrl && scene.videoStatus !== "failed")
      .sort((a, b) => Number(a.sceneNumber ?? 0) - Number(b.sceneNumber ?? 0));

    if (needsVideo.length === 0) return;

    setError(null);
    const isVeo = videoModel === "fruit-v4";
    // Stagger submissions — higher-tier models hit IDLE_TIMEOUT when clips pile up
    const staggerMs = isVeo ? 5000 : 3000;

    for (const [index, scene] of needsVideo.entries()) {
      if (index > 0) await new Promise((r) => setTimeout(r, staggerMs));
      void startSceneVideo(scene, f, castBible, videoModel);
    }
  }, [startSceneVideo]);

  /* ─── regenerateScene ─── */
  const regenerateScene = useCallback(async (sceneIndex, customPrompt) => {
    const f            = formRef.current;
    const imageToolKey = f.sceneImageModel ?? "zyvo-v2";
    const castBible    = castBibleRef.current ?? [];
    const scene        = scenesRef.current[sceneIndex];
    if (!scene) return;

    setScenes((prev) => prev.map((s, i) =>
      i === sceneIndex ? { ...s, imageStatus: "queued", imageProgress: 0, imageUrl: null, imageJobId: null, error: null } : s,
    ));

    try {
      // Pass the previous scene's imageUrl for continuity if available
      const prevSceneForRegen = sceneIndex > 0 ? scenesRef.current[sceneIndex - 1] : null;
      const job = await regenerateSceneImage({
        scene,
        form:                  f,
        imageToolKey,
        customPrompt,
        previousSceneImageUrl: prevSceneForRegen?.imageUrl ?? null,
        prevScene:             prevSceneForRegen ?? null,
        castBible,
      });

      setScenes((prev) => {
        const next = prev.map((s) =>
          s.sceneNumber === scene.sceneNumber
            ? { ...s, imageJobId: job.id, imageStatus: job.status }
            : s,
        );
        void updateGenerationScenes(generationRef.current, scenesForDB(next));
        return next;
      });

      watchImageJob(scene.sceneNumber, job.id);
    } catch (e) {
      setScenes((prev) => prev.map((s) =>
        s.sceneNumber === scene.sceneNumber
          ? { ...s, imageStatus: "failed", error: e.message ?? "Regeneration failed" }
          : s,
      ));
    }
  }, [watchImageJob]);

  /* ─── retryFailedClips ─── */
  // clipNumbers: null = retry ALL failed clips, array = retry specific clip numbers
  const retryFailedClips = useCallback(async (clipNumbers = null) => {
    const f = formRef.current;
    const currentClips = videoClipsRef.current;
    const currentScenes = scenesRef.current;

    const toRetry = currentClips.filter((clip) =>
      !clip.videoUrl &&
      clip.videoStatus === "failed" &&
      (clipNumbers === null || clipNumbers.includes(clip.clipNumber))
    );
    if (!toRetry.length) return;

    // Reset targeted clips to queued
    setVideoClips((prev) => prev.map((clip) =>
      toRetry.some((c) => c.clipNumber === clip.clipNumber)
        ? { ...clip, videoJobId: null, videoStatus: "queued", videoProgress: 0, error: null }
        : clip,
    ));
    setScenes((prev) => prev.map((s) =>
      toRetry.some((c) => c.startSceneNumber === Number(s.sceneNumber))
        ? { ...s, videoJobId: null, videoStatus: "queued", videoProgress: 0, error: null }
        : s,
    ));

    phaseRef.current = "animating";
    setPhase("animating");
    setError(null);

    const videoModel = f.animationModel ?? DEFAULT_FRUIT_VIDEO_MODEL;

    for (const clip of toRetry) {
      const key = `clip:${clip.clipNumber}`;
      inFlightClipKeysRef.current.delete(key); // clear stale lock so it isn't skipped
      inFlightClipKeysRef.current.add(key);

      const startScene = currentScenes.find(
        (scene) => Number(scene.sceneNumber) === clip.startSceneNumber
      );

      try {
        let job;
        let lastErr;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            job = await animateClip({ clip, startScene, form: f, videoModel });
            break;
          } catch (err) {
            lastErr = err;
            const isTimeout = /idle.?timeout|504/i.test(err?.message ?? "");
            if (isTimeout && attempt < 2) {
              await new Promise((r) => setTimeout(r, (attempt + 1) * 8000));
            } else {
              throw err;
            }
          }
        }
        if (!job) throw lastErr;

        setVideoClips((prev) => prev.map((item) =>
          item.clipNumber === clip.clipNumber
            ? { ...item, videoJobId: job.id, videoStatus: job.status, videoProgress: 0 }
            : item,
        ));
        watchVideoJob(clip.startSceneNumber, job.id);
      } catch (e) {
        setVideoClips((prev) => prev.map((item) =>
          item.clipNumber === clip.clipNumber
            ? { ...item, videoStatus: "failed", error: e.message ?? "Retry failed" }
            : item,
        ));
        inFlightClipKeysRef.current.delete(key);
      }
    }
  }, [watchVideoJob]);

  /* ─── reset ─── */
  const reset = useCallback(() => {
    clearWatchers();
    phaseRef.current = "idle";
    setPhase("idle");
    setScenes([]);
    setVideoClips([]);
    setError(null);
    setGenerationId(null);
    castBibleRef.current = [];
    autoAnimateTriggeredRef.current = false;
    void loadRecentGenerations();
  }, [clearWatchers, loadRecentGenerations]);

  /* ─── Catch-up: scenes-done → make sure every succeeded scene has a video ───
   * In the live flow, each scene's video already started the moment that
   * scene's image succeeded (see startSceneVideo call inside
   * startSceneGeneration). This only matters for restoring a saved
   * generation whose images finished but videos never started — startAnimation
   * itself is a no-op for scenes that already have a videoJobId/videoUrl.
   */
  useEffect(() => {
    if (phase !== "scenes-done" || autoAnimateTriggeredRef.current) return;
    if (scenes.length === 0) return;
    autoAnimateTriggeredRef.current = true;
    void startAnimation();
  }, [phase, scenes, startAnimation]);

  return {
    phase,
    scenes,
    videoClips,
    error,
    totalProgress,
    generationId,
    recentGenerations,
    isLoadingRecent,

    // "generating-characters" (portrait generation) happens after planning
    // but before any scene exists — bucketed with isPlanning so every
    // consumer's busy/disabled state stays correct without having to know
    // about the new phase individually.
    isPlanning: phase === "planning" || phase === "generating-characters",
    // Images and videos now run concurrently, so these are derived straight
    // from scene state instead of a single mutually-exclusive phase string —
    // both can be true at once while a story is generating.
    isGeneratingScenes: scenes.length > 0 && scenes.some((s) => !isTerminal(s.imageStatus ?? "queued")),
    isAnimating:        scenes.length > 0 && scenes.some((s) => s.videoJobId && !isTerminal(s.videoStatus ?? "idle")),
    isDone:             phase === "done",
    scenesDone:         phase === "scenes-done" || phase === "animating" || phase === "done",

    startSceneGeneration,
    startAnimation,
    retryFailedClips,
    updateClipVoiceover,
    regenerateScene,
    loadGeneration,
    deleteGeneration,
    loadRecentGenerations,
    reset,
  };
}
