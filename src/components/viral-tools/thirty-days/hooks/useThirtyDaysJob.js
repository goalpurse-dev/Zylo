import { useCallback, useRef, useState } from "react";
import { cancelJob, getJob, watchJob } from "../../../../lib/jobs";
import {
  animateScene,
  beginThirtyDaysGeneration,
  checkThirtyDaysReferenceQA,
  checkThirtyDaysSceneQA,
  editReferenceImage,
  fetchThirtyDaysIdea,
  generateReferenceImage,
  generateSceneImage,
  recordThirtyDaysSceneQA,
  recoverThirtyDaysGeneration,
  selectSceneReferenceIds,
  settleThirtyDaysGeneration,
  SCENE_COUNT,
  syncThirtyDaysAssets,
  updateThirtyDaysProgress,
} from "../api/thirtyDaysApi";
import { buildReferenceCollage, createCollageCache } from "../utils/referenceCollage";
import { commitSeriesReferenceEdit, commitSeriesReferenceRegeneration, getPreviousEpisodeEndingImage, reopenSeriesVideoRetry, reopenSeriesImageRetry, reopenReferenceRetry } from "../api/thirtyDaysSeriesApi";

const TERMINAL = new Set(["succeeded", "failed", "canceled"]);
const JOB_TIMEOUT_MS = 12 * 60 * 1000;

function resultUrl(job) {
  const raw = job?.result_url || job?.resultUrl || job?.output?.result_url || job?.output?.resultUrl ||
    job?.output?.imageURL || job?.output?.imageUrl || job?.output?.image_url ||
    job?.output?.videoURL || job?.output?.videoUrl || job?.output?.video_url ||
    job?.output?.data?.[0]?.url || job?.output?.results?.[0]?.url;
  return typeof raw === "string" && /^https:\/\//i.test(raw) && !raw.includes("localhost") ? raw.trim() : null;
}

function waitForJob(jobId, onChange, timeoutMs = JOB_TIMEOUT_MS) {
  return new Promise((resolve) => {
    let done = false;
    let unsubscribe;
    const finish = (row) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { unsubscribe?.(); } catch { /* already removed */ }
      resolve(row);
    };
    const timer = setTimeout(async () => {
      await cancelJob(jobId).catch(() => {});
      const row = await getJob(jobId).catch(() => null);
      finish(row);
    }, timeoutMs);
    unsubscribe = watchJob(jobId, (row) => {
      onChange?.(row);
      if (TERMINAL.has(row?.status)) finish(row);
    });
  });
}

async function terminalJob(jobId, onChange) {
  const existing = await getJob(jobId).catch(() => null);
  if (existing && TERMINAL.has(existing.status)) return existing;
  return waitForJob(jobId, onChange);
}

// Shared by the main generation pass and the explicit scene-image retry button.
// One invocation creates at most ONE provider image. QA is recorded as an
// observation, but never silently buys/submits a second variation: the user
// asked for one scene image, and any replacement must come from the visible
// manual retry action.
async function generateSceneImageWithEscalation({
  generationId, scene, worldBible, referencesById, collageUrl, cameraMode, quality,
  sceneIndex, expectedSceneCount, startAttempt = 0, patchScene, persist, setProgressLabel, liveScene, liveScenes,
  previousEpisodeEndingImageUrl = null,
}) {
  let imageJobId = liveScene()?.imageJobId;
  let imageUrl = liveScene()?.imageUrl;
  try {
    if (!imageUrl || liveScene()?.imageStatus !== "succeeded") {
      if (!imageJobId || ["failed", "canceled"].includes(liveScene()?.imageStatus)) {
        const job = await generateSceneImage({
          generationId, scene, worldBible, referencesById, collageUrl, cameraMode, quality,
          softenLevel: 0, repairNote: "", previousEpisodeEndingImageUrl,
        });
        imageJobId = job.id;
        patchScene(sceneIndex, { imageJobId, imageStatus: "queued", qaAttempts: startAttempt, error: null });
        await persist("scenes");
      }

      const terminal = await terminalJob(imageJobId, (row) => {
        patchScene(sceneIndex, { imageStatus: row.status, imageProgress: Number(row.progress || 0) });
        setProgressLabel?.(`Creating Scene ${sceneIndex + 1} / ${expectedSceneCount}`);
      });
      imageUrl = terminal?.status === "succeeded" ? resultUrl(terminal) : null;
      await syncThirtyDaysAssets(generationId);
      if (!imageUrl) throw new Error(terminal?.error || "Scene image generation failed");
    }

    patchScene(sceneIndex, { imageUrl, imageStatus: "succeeded", imageProgress: 100, error: null });
    const previousSceneImages = (liveScenes?.() || [])
      .filter((item) => Number(item.index) < Number(scene.index) && item.imageUrl)
      .sort((a, b) => Number(a.index) - Number(b.index))
      .map((item) => ({ sceneIndex: Number(item.index), imageUrl: item.imageUrl }));
    let qa = await checkThirtyDaysSceneQA({ generationId, imageUrl, scene, worldBible, referencesById, previousSceneImages });
    // Any checked QA rejection is a real stop before animation. Previously a
    // model could return usable=false for an obvious bad still without also
    // setting one of the optional category flags, and that image still went
    // straight into video generation.
    // Identity and POV notes from low-detail vision are advisory: custom
    // character names (Nova/Eevee) and viewer-insert hands regularly trigger
    // false mismatches. Only objectively broken canvases block animation.
    let hardQaFailure = qa?.usable === false || qa?.hasReadableText === true || qa?.multiPanel === true;
    let qaLooksGood = qa?.usable !== false && qa?.nearDuplicate !== true && !hardQaFailure;
    let qaStatus = qa?.reason === "qa_unavailable" ? "unavailable" : hardQaFailure ? "failed" : "passed";
    let qaReason = qa?.nearDuplicate
      ? `qa_warning:near_duplicate:${qa?.similarityReason || "repeats an earlier scene"}`
      : qaLooksGood ? (qa?.reason || qaStatus) : `qa_warning:${qa?.reason || "visual mismatch"}`;
    const hardReason = qa?.hasReadableText ? "onscreen_text"
      : qa?.multiPanel ? "multi_panel" : null;
    try {
      await recordThirtyDaysSceneQA({ generationId, sceneIndex, jobId: imageJobId, usable: !hardQaFailure, reason: qaStatus === "unavailable" ? "qa_unavailable" : hardQaFailure ? `hard_qa:${hardReason}:${qa?.reason || "unusable still"}` : qaReason });
    } catch (qaAuditError) {
      // The image provider succeeded; only the optional QA ledger has not
      // caught up with its job row yet. Never discard a good still or block
      // its animation over that race — the server worker will reconcile the
      // audit later. Treat this precisely like a temporary QA outage.
      console.warn("[thirty-days] scene QA audit unavailable; continuing:", qaAuditError);
      qa = { usable: true, reason: "qa_unavailable", status: "unavailable", nearDuplicate: false, identityChecks: [], observedEvent: "" };
      hardQaFailure = false;
      qaLooksGood = true;
      qaStatus = "unavailable";
      qaReason = "qa_unavailable";
    }
    patchScene(sceneIndex, {
      qaStatus, qaReason: qaReason || null, qaAttempts: startAttempt + 1,
      visualObservation: qa?.observedEvent || null,
      identityChecks: Array.isArray(qa?.identityChecks) ? qa.identityChecks : [],
      duplicateOfSceneIndex: qa?.duplicateOfSceneIndex ?? null,
      compositionSimilarityReason: qa?.similarityReason || null,
    });
    await persist("scenes");
    if (hardQaFailure) {
      patchScene(sceneIndex, { imageStatus: "failed", videoStatus: "failed", error: `Image rejected: ${hardReason}. Use Regenerate image to replace it.` });
      await persist("scenes");
      return { imageUrl: null };
    }
    return { imageUrl };
  } catch (caught) {
    const message = String(caught?.message || caught || "Scene image generation failed");
    patchScene(sceneIndex, { imageStatus: "failed", videoStatus: "failed", error: message });
    await persist("scenes");
    return { imageUrl: null };
  }
}

// A single call covers up to 3 attempts, escalating how much of the LLM's
// own wording survives into the video prompt each time. A provider content
// filter rejecting the exact same prompt again is a near-certain repeat
// failure, so retrying identically wastes the user's wait; softening what's
// actually sent gives each attempt a real, different chance. Shared between
// the first generation pass and the manual retry button so both behave the
// same way and never need more than one user click.
async function animateSceneWithEscalation({ generationId, scene, nextScene, imageUrl, quality, paidRetry, cameraMode, sceneIndex, patchScene, setProgressLabel, labelPrefix }) {
  let lastError = "Animation failed";
  for (let softenLevel = 0; softenLevel < 3; softenLevel += 1) {
    if (softenLevel > 0) {
      setProgressLabel?.(`${labelPrefix} — content filter blocked it, trying a ${softenLevel === 1 ? "softer" : "much gentler"} version…`);
      patchScene(sceneIndex, { videoStatus: "retrying", videoError: null });
    }
    try {
      const job = await animateScene({ generationId, scene, nextScene, imageUrl, quality, paidRetry, softenLevel, cameraMode });
      patchScene(sceneIndex, { videoJobId: job.id, videoStatus: "queued", videoError: null });
      const terminal = await terminalJob(job.id, (row) => {
        patchScene(sceneIndex, { videoStatus: row.status, videoProgress: Number(row.progress || 0) });
      });
      const videoUrl = terminal?.status === "succeeded" ? resultUrl(terminal) : null;
      if (videoUrl) return { videoUrl, jobId: job.id };
      lastError = terminal?.error || lastError;
    } catch (caught) {
      lastError = String(caught?.message || caught || lastError);
    }
  }
  return { videoUrl: null, error: lastError };
}

// Same escalation shape as animateSceneWithEscalation, for references. A
// reference generation failure — even a generic provider "standardError",
// not just a content-policy rejection — gets fresh attempts with softer
// wording rather than repeating the identical request. Setup references are
// covered by the still-open series reservation the whole time setup is
// incomplete, so a retry here needs no reopen/reservation step at all —
// it's just a normal regeneration call.
async function generateReferenceWithEscalation({ generationId, reference, worldBible, quality, referenceId, patchReference, setProgressLabel, labelPrefix }) {
  let lastError = "Reference generation failed";
  for (let softenLevel = 0; softenLevel < 3; softenLevel += 1) {
    if (softenLevel > 0) {
      setProgressLabel?.(`${labelPrefix} — content filter blocked it, trying a ${softenLevel === 1 ? "softer" : "much gentler"} version…`);
      patchReference(referenceId, { status: "retrying", error: null });
    }
    try {
      const job = await generateReferenceImage({ generationId, reference, worldBible, quality, softenLevel });
      patchReference(referenceId, { jobId: job.id, status: "queued", error: null });
      const terminal = await terminalJob(job.id, (row) => {
        patchReference(referenceId, { status: row.status, progress: Number(row.progress || 0) });
      });
      let imageUrl = terminal?.status === "succeeded" ? resultUrl(terminal) : null;
      let jobId = job.id;
      if (imageUrl) {
        // Franchise-identity check — only meaningful at softenLevel 0 (full
        // detail); a softened content-policy fallback has already traded
        // specificity away, so there's nothing left to correct there. One
        // repair attempt with a strengthened, more explicit prompt; if that
        // also fails or errors, keep the original image rather than losing
        // the reference entirely over one QA flag.
        if (softenLevel === 0) {
          const qa = await checkThirtyDaysReferenceQA({ generationId, imageUrl, reference, worldBible }).catch(() => ({ usable: true, reason: "qa_unavailable" }));
          if (qa?.usable === false) {
            setProgressLabel?.(`${labelPrefix} — didn't look like ${worldBible?.franchise || "the real franchise"}, correcting…`);
            patchReference(referenceId, { status: "retrying", error: null });
            try {
              const repairJob = await generateReferenceImage({ generationId, reference, worldBible, quality, softenLevel: 0, repairNote: qa.reason });
              patchReference(referenceId, { jobId: repairJob.id, status: "queued", error: null });
              const repairTerminal = await terminalJob(repairJob.id, (row) => {
                patchReference(referenceId, { status: row.status, progress: Number(row.progress || 0) });
              });
              const repairedUrl = repairTerminal?.status === "succeeded" ? resultUrl(repairTerminal) : null;
              if (repairedUrl) { imageUrl = repairedUrl; jobId = repairJob.id; }
            } catch (caught) {
              console.warn("[thirty-days] reference franchise repair failed, keeping original:", caught);
            }
          }
        }
        return { imageUrl, jobId };
      }
      lastError = terminal?.error || lastError;
    } catch (caught) {
      lastError = String(caught?.message || caught || lastError);
    }
  }
  return { imageUrl: null, error: lastError };
}

export default function useThirtyDaysJob() {
  const [phase, setPhase] = useState("idle");
  const [progressLabel, setProgressLabel] = useState("");
  const [generation, setGeneration] = useState(null);
  const [error, setError] = useState(null);
  const generationRef = useRef(null);
  const runRef = useRef(0);
  const persistQueueRef = useRef(Promise.resolve());
  const collageCacheRef = useRef(createCollageCache());
  const videoRetryLocksRef = useRef(new Set());
  const imageRetryLocksRef = useRef(new Set());
  const referenceRetryLocksRef = useRef(new Set());

  const replaceGeneration = useCallback((next) => {
    generationRef.current = next;
    setGeneration(next);
    return next;
  }, []);

  const patchReference = useCallback((referenceId, patch) => {
    const current = generationRef.current;
    if (!current) return null;
    return replaceGeneration({
      ...current,
      visualReferences: current.visualReferences.map((ref) => ref.id === referenceId ? { ...ref, ...patch } : ref),
    });
  }, [replaceGeneration]);

  const patchScene = useCallback((sceneIndex, patch) => {
    const current = generationRef.current;
    if (!current) return null;
    return replaceGeneration({
      ...current,
      scenes: current.scenes.map((scene) => Number(scene.index) === Number(sceneIndex) ? { ...scene, ...patch } : scene),
    });
  }, [replaceGeneration]);

  const persist = useCallback((status) => {
    const snapshot = generationRef.current;
    if (!snapshot?.id) return Promise.resolve(null);
    persistQueueRef.current = persistQueueRef.current
      .catch(() => null)
      .then(() => updateThirtyDaysProgress({
        generationId: snapshot.id,
        status: status || snapshot.status || "scenes",
        visualReferences: snapshot.visualReferences,
        scenes: snapshot.scenes,
      }));
    return persistQueueRef.current;
  }, []);

  const runVisualPipeline = useCallback(async (initialGeneration, runId) => {
    const currentRun = () => runRef.current === runId;
    const quality = initialGeneration.qualityTier;
    const expectedSceneCount = Array.isArray(initialGeneration.scenes) ? initialGeneration.scenes.length : SCENE_COUNT;
    setPhase("references");
    setProgressLabel("Building references");

    await Promise.all(initialGeneration.visualReferences.map(async (reference, index) => {
      if (!currentRun()) return;
      if (reference.imageUrl && reference.status === "succeeded") return;
      const labelPrefix = `Reference ${index + 1} / ${initialGeneration.visualReferences.length}`;
      // A failed reference's jobId still points at the dead job — same class
      // of bug as the scene video fix: resuming must never just re-poll a
      // terminal failure and call it done. Only an actually in-flight job is
      // worth watching; anything already failed gets a fresh escalation.
      if (reference.jobId && reference.status !== "failed") {
        setProgressLabel(labelPrefix);
        const terminal = await terminalJob(reference.jobId, (row) => {
          patchReference(reference.id, { status: row.status, progress: Number(row.progress || 0) });
        });
        const imageUrl = terminal?.status === "succeeded" ? resultUrl(terminal) : null;
        await syncThirtyDaysAssets(initialGeneration.id);
        patchReference(reference.id, {
          status: imageUrl ? "succeeded" : "failed",
          progress: 100,
          imageUrl,
          error: imageUrl ? null : (terminal?.error || "Reference generation failed"),
        });
      } else {
        setProgressLabel(labelPrefix);
        const { imageUrl, error } = await generateReferenceWithEscalation({
          generationId: initialGeneration.id, reference, worldBible: initialGeneration.worldBible, quality,
          referenceId: reference.id, patchReference, setProgressLabel, labelPrefix,
        });
        patchReference(reference.id, { status: imageUrl ? "succeeded" : "failed", progress: 100, imageUrl, error: imageUrl ? null : error });
      }
      await persist("references");
    }));

    if (!currentRun()) return;
    setPhase("scenes");
    setProgressLabel("Creating scenes");
    // Fetched once per episode, used only for scene 0's image so the episode
    // visually continues from wherever the previous one actually ended
    // (e.g. mid-fight) instead of resetting to a fresh establishing shot —
    // see getPreviousEpisodeEndingImage for why text continuity alone isn't
    // enough. Never fetched for episode 1 or single-video generations.
    const previousEpisodeEndingImageUrl = initialGeneration.generationMode === "series_episode"
      ? await getPreviousEpisodeEndingImage(initialGeneration.seriesId, initialGeneration.seriesEpisodeId).catch(() => null)
      : null;
    // Generate in story order so QA for Scene N can compare against real
    // earlier scene images before any animation credits are spent. Parallel
    // scene generation made duplicate detection race-dependent.
    const sceneTasks = generationRef.current.scenes.map((seedScene) => async () => {
      const sceneIndex = Number(seedScene.index);
      const liveScene = () => generationRef.current.scenes.find((item) => Number(item.index) === sceneIndex);
      const referencesById = new Map(generationRef.current.visualReferences.map((ref) => [ref.id, ref]));
      const orderedReferences = selectSceneReferenceIds(seedScene, referencesById).map((id) => referencesById.get(id)).filter(Boolean);
      const availableReferences = orderedReferences.filter((ref) => ref.imageUrl).map((ref) => ({ ...ref, url: ref.imageUrl }));
      if (availableReferences.length !== orderedReferences.length) {
        patchScene(sceneIndex, {
          imageStatus: "failed", videoStatus: "failed",
          error: "A required visual reference could not be created.",
        });
        await persist("scenes");
        return;
      }

      let collageUrl = seedScene.collageUrl || null;
      if (!collageUrl) {
        try {
          collageUrl = await buildReferenceCollage(availableReferences, collageCacheRef.current);
        } catch (caught) {
          // Provider result URLs are already durable. Falling back to the first
          // ordered reference keeps the reserved asset runnable if public
          // collage publication is temporarily unavailable.
          collageUrl = availableReferences[0]?.url || null;
          patchScene(sceneIndex, { collageError: String(caught?.message || caught) });
        }
        patchScene(sceneIndex, { collageUrl });
        await persist("scenes");
      }

      const { imageUrl } = await generateSceneImageWithEscalation({
        generationId: initialGeneration.id, scene: seedScene, worldBible: initialGeneration.worldBible,
        referencesById, collageUrl, cameraMode: initialGeneration.cameraMode, quality,
        previousEpisodeEndingImageUrl,
        sceneIndex, expectedSceneCount, startAttempt: Number(liveScene()?.qaAttempts || 0),
        patchScene, persist, setProgressLabel, liveScene,
        liveScenes: () => generationRef.current?.scenes || [],
      });
      if (!imageUrl) return;

      try {
        let videoJobId = liveScene()?.videoJobId;
        // A failed scene's videoJobId still points at the dead job. Resuming
        // must never just re-poll that terminal row again — terminalJob()
        // would instantly hand back the same failure with zero new attempt,
        // which is exactly why a resumed generation could get permanently
        // stuck on a content-filter rejection with no escalation ever firing.
        // Only an actually in-flight job (queued/running) is worth watching;
        // anything already failed needs a fresh escalated attempt instead.
        if (liveScene()?.videoStatus === "failed") {
          videoJobId = null;
        }
        const labelPrefix = `Animating Scene ${sceneIndex + 1} / ${expectedSceneCount}`;
        setProgressLabel(labelPrefix);
        let videoUrl = null;
        let lastError = "Animation failed";
        if (videoJobId) {
          // Resuming a run that already has a live/queued job for this scene
          // — just watch it, no need to start a fresh escalation cascade.
          const terminal = await terminalJob(videoJobId, (row) => {
            patchScene(sceneIndex, { videoStatus: row.status, videoProgress: Number(row.progress || 0) });
          });
          videoUrl = terminal?.status === "succeeded" ? resultUrl(terminal) : null;
          lastError = terminal?.error || lastError;
        } else {
          await persist("scenes");
          const result = await animateSceneWithEscalation({
            generationId: initialGeneration.id, scene: seedScene,
            nextScene: generationRef.current.scenes.find((item) => Number(item.index) === sceneIndex + 1) || null,
            imageUrl, quality,
            cameraMode: initialGeneration.cameraMode,
            sceneIndex, patchScene, setProgressLabel, labelPrefix,
          });
          videoUrl = result.videoUrl;
          lastError = result.error || lastError;
        }
        patchScene(sceneIndex, {
          videoStatus: videoUrl ? "succeeded" : "failed",
          videoProgress: 100,
          videoUrl,
          videoError: videoUrl ? null : lastError,
        });
      } catch (caught) {
        patchScene(sceneIndex, { videoStatus: "failed", videoError: String(caught?.message || caught) });
      }
      await syncThirtyDaysAssets(initialGeneration.id).catch(() => {});
      await persist("scenes");
    });

    for (const runScene of sceneTasks) await runScene();
    if (!currentRun()) return;
    await persist("scenes");
    await syncThirtyDaysAssets(initialGeneration.id);
    const settled = await settleThirtyDaysGeneration({ generationId: initialGeneration.id });
    replaceGeneration({
      ...generationRef.current,
      ...settled,
      visualReferences: generationRef.current.visualReferences,
      scenes: generationRef.current.scenes,
    });
    const completeVideos = generationRef.current.scenes.filter((scene) => scene.videoStatus === "succeeded" && scene.videoUrl).length;
    setPhase(completeVideos === expectedSceneCount ? "voice" : completeVideos > 0 ? "partial" : "error");
    setProgressLabel(completeVideos === expectedSceneCount ? "Ready for voiceover" : "Visual generation finished with missing scenes");
  }, [patchReference, patchScene, persist, replaceGeneration]);

  const start = useCallback(async ({ universe, premise, aiIdeaMode = true, quality, visualStyle }) => {
    const runId = ++runRef.current;
    setError(null);
    replaceGeneration(null);
    setPhase("planning");
    setProgressLabel(aiIdeaMode ? "Creating a viral idea" : "Planning your 30-day story");
    try {
      const resolvedPremise = aiIdeaMode ? await fetchThirtyDaysIdea({ universe }) : String(premise || "").trim();
      if (runRef.current !== runId) return null;
      setProgressLabel("Researching world");
      const planned = await beginThirtyDaysGeneration({ universe, premise: resolvedPremise, aiIdeaMode, quality, visualStyle });
      // The planner repairs world-only/manual input into the mandatory
      // viewer-insert premise. Keep that trusted version through scenes,
      // voiceover, persistence, and restore instead of restoring raw input.
      const next = planned.generation;
      replaceGeneration(next);
      collageCacheRef.current = createCollageCache();
      await runVisualPipeline(next, runId);
      return generationRef.current;
    } catch (caught) {
      if (runRef.current !== runId) return null;
      const message = String(caught?.message || caught || "Generation failed");
      setError(message.includes("INSUFFICIENT_CREDITS") ? "INSUFFICIENT_CREDITS" : message);
      setPhase("error");
      throw caught;
    }
  }, [replaceGeneration, runVisualPipeline]);

  const resume = useCallback(async (savedGeneration) => {
    const runId = ++runRef.current;
    setError(null);
    // A device may sleep after the provider completes but before the browser
    // writes its result URL into visualReferences. Recover the durable job
    // projection first, so reopening never retries/rebills a finished asset.
    let restoredGeneration = savedGeneration;
    if (savedGeneration?.id) {
      try {
        restoredGeneration = (await recoverThirtyDaysGeneration(savedGeneration.id)) || savedGeneration;
      } catch (recoveryError) {
        console.warn("[thirty-days] generation recovery unavailable", recoveryError);
      }
    }
    replaceGeneration(restoredGeneration);
    collageCacheRef.current = createCollageCache();
    const completeVideos = (restoredGeneration?.scenes || []).filter((scene) => scene.videoStatus === "succeeded" && scene.videoUrl).length;
    const expectedSceneCount = Array.isArray(restoredGeneration?.scenes) ? restoredGeneration.scenes.length : SCENE_COUNT;
    const reservationActive = restoredGeneration?.reservationStatus === "reserved";
    if (!reservationActive) {
      if (restoredGeneration?.fullVideoUrl || restoredGeneration?.status === "completed") setPhase("done");
      else if (completeVideos === expectedSceneCount || restoredGeneration?.status === "voiceover") setPhase("voice");
      else if (completeVideos > 0 || restoredGeneration?.status === "partial") setPhase("partial");
      else setPhase("error");
      setProgressLabel(completeVideos === expectedSceneCount ? "Ready for voiceover" : "Saved creation restored");
      setError(restoredGeneration?.error || null);
      return restoredGeneration;
    }
    try {
      await runVisualPipeline(restoredGeneration, runId);
      return generationRef.current;
    } catch (caught) {
      setError(String(caught?.message || caught));
      setPhase("error");
      return null;
    }
  }, [replaceGeneration, runVisualPipeline]);

  const retryVideo = useCallback(async (sceneIndex) => {
    const numericIndex = Number(sceneIndex);
    const current = generationRef.current;
    const scene = current?.scenes?.find((item) => Number(item.index) === numericIndex);
    if (!current?.id || !scene?.imageUrl || videoRetryLocksRef.current.has(numericIndex)) return null;
    if (["queued", "running", "retrying"].includes(scene.videoStatus)) return null;

    videoRetryLocksRef.current.add(numericIndex);
    setError(null);
    setPhase("scenes");
    setProgressLabel(`Retrying Day ${scene.day || numericIndex + 1} animation`);
    patchScene(numericIndex, { videoJobId: null, videoUrl: null, videoStatus: "queued", videoProgress: 0, videoError: null });

    try {
      const isSeriesEpisode = current.generationMode === "series_episode";
      // Series includes one reopened reservation slot without an additional
      // net asset charge (reopenSeriesVideoRetry is one-time-only per asset —
      // call it once, then run the escalation cascade against that single
      // reopened slot). Single-video keeps its existing paid retry behavior;
      // only the attempt that actually succeeds is ever charged.
      if (isSeriesEpisode) await reopenSeriesVideoRetry(current.id, numericIndex);
      await persist("scenes");
      const labelPrefix = `Retrying Day ${scene.day || numericIndex + 1} animation`;
      const { videoUrl, error: retryError } = await animateSceneWithEscalation({
        generationId: current.id, scene,
        nextScene: current.scenes.find((item) => Number(item.index) === numericIndex + 1) || null,
        imageUrl: scene.imageUrl, quality: current.qualityTier,
        cameraMode: current.cameraMode,
        paidRetry: !isSeriesEpisode, sceneIndex: numericIndex, patchScene, setProgressLabel, labelPrefix,
      });
      patchScene(numericIndex, {
        videoStatus: videoUrl ? "succeeded" : "failed",
        videoProgress: 100,
        videoUrl,
        videoError: videoUrl ? null : (retryError || "Animation failed — try again"),
      });
      await persist("scenes");
    } catch (caught) {
      const message = String(caught?.message || caught || "Video retry failed");
      patchScene(numericIndex, {
        videoStatus: "failed",
        videoError: message.includes("INSUFFICIENT_CREDITS") ? "Not enough credits to retry this video" : message,
      });
    } finally {
      videoRetryLocksRef.current.delete(numericIndex);
    }

    if (generationRef.current.generationMode === "series_episode") {
      await syncThirtyDaysAssets(generationRef.current.id).catch(() => null);
      const settled = await settleThirtyDaysGeneration({ generationId: generationRef.current.id }).catch(() => null);
      if (settled) replaceGeneration({ ...generationRef.current, ...settled, scenes: generationRef.current.scenes, visualReferences: generationRef.current.visualReferences });
    }
    const completeVideos = generationRef.current.scenes.filter((item) => item.videoStatus === "succeeded" && item.videoUrl).length;
    const expectedSceneCount = generationRef.current.scenes.length || SCENE_COUNT;
    const nextStatus = completeVideos === expectedSceneCount ? "voiceover" : "partial";
    replaceGeneration({ ...generationRef.current, status: nextStatus });
    await persist(nextStatus).catch(() => null);
    setPhase(completeVideos === expectedSceneCount ? "voice" : "partial");
    setProgressLabel(completeVideos === expectedSceneCount ? "Ready for voiceover" : `${completeVideos} of ${expectedSceneCount} clips ready`);
    return generationRef.current;
  }, [patchScene, persist, replaceGeneration]);

  // A scene whose IMAGE failed (not just its video) previously had no way
  // back at all — only videos could be retried. Reopening re-deducts both
  // the image and (if it was also refunded via settle's dependency cascade)
  // the video's credits, since the video can't exist without a real image.
  const retryImage = useCallback(async (sceneIndex) => {
    const numericIndex = Number(sceneIndex);
    const current = generationRef.current;
    const scene = current?.scenes?.find((item) => Number(item.index) === numericIndex);
    if (!current?.id || !scene || imageRetryLocksRef.current.has(numericIndex)) return null;
    if (["queued", "running", "retrying"].includes(scene.imageStatus)) return null;

    imageRetryLocksRef.current.add(numericIndex);
    setError(null);
    setPhase("scenes");
    setProgressLabel(`Retrying Day ${scene.day || numericIndex + 1} image`);
    patchScene(numericIndex, {
      imageJobId: null, imageUrl: null, imageStatus: "queued", imageProgress: 0, qaStatus: null, qaAttempts: 0, error: null,
      videoJobId: null, videoUrl: null, videoStatus: "queued", videoProgress: 0, videoError: null,
    });

    try {
      await reopenSeriesImageRetry(current.id, numericIndex);
      await persist("scenes");
      const referencesById = new Map((current.visualReferences || []).map((ref) => [ref.id, ref]));
      const orderedReferences = selectSceneReferenceIds(scene, referencesById).map((id) => referencesById.get(id)).filter(Boolean);
      let collageUrl = scene.collageUrl || null;
      if (!collageUrl) {
        const availableReferences = orderedReferences.filter((ref) => ref.imageUrl).map((ref) => ({ ...ref, url: ref.imageUrl }));
        collageUrl = availableReferences[0]?.url || null;
      }
      const liveScene = () => generationRef.current.scenes.find((item) => Number(item.index) === numericIndex);
      const expectedSceneCount = generationRef.current.scenes.length || SCENE_COUNT;
      const previousEpisodeEndingImageUrl = numericIndex === 0 && current.generationMode === "series_episode"
        ? await getPreviousEpisodeEndingImage(current.seriesId, current.seriesEpisodeId).catch(() => null)
        : null;
      const { imageUrl } = await generateSceneImageWithEscalation({
        generationId: current.id, scene, worldBible: current.worldBible, referencesById, collageUrl,
        cameraMode: current.cameraMode, quality: current.qualityTier, sceneIndex: numericIndex,
        expectedSceneCount, startAttempt: 0, patchScene, persist, setProgressLabel, liveScene,
        liveScenes: () => generationRef.current?.scenes || [], previousEpisodeEndingImageUrl,
      });
      if (imageUrl) {
        const labelPrefix = `Animating Day ${scene.day || numericIndex + 1}`;
        setProgressLabel(labelPrefix);
        const { videoUrl, error: videoError } = await animateSceneWithEscalation({
          generationId: current.id, scene,
          nextScene: current.scenes.find((item) => Number(item.index) === numericIndex + 1) || null,
          imageUrl, quality: current.qualityTier,
          cameraMode: current.cameraMode,
          sceneIndex: numericIndex, patchScene, setProgressLabel, labelPrefix,
        });
        patchScene(numericIndex, {
          videoStatus: videoUrl ? "succeeded" : "failed", videoProgress: 100, videoUrl,
          videoError: videoUrl ? null : (videoError || "Animation failed — try again"),
        });
      }
      await persist("scenes");
    } catch (caught) {
      const message = String(caught?.message || caught || "Image retry failed");
      patchScene(numericIndex, {
        imageStatus: "failed", videoStatus: "failed",
        error: message.includes("INSUFFICIENT_CREDITS") ? "Not enough credits to retry this scene" : message,
      });
    } finally {
      imageRetryLocksRef.current.delete(numericIndex);
    }

    await syncThirtyDaysAssets(generationRef.current.id).catch(() => null);
    const settled = await settleThirtyDaysGeneration({ generationId: generationRef.current.id }).catch(() => null);
    if (settled) replaceGeneration({ ...generationRef.current, ...settled, scenes: generationRef.current.scenes, visualReferences: generationRef.current.visualReferences });
    const completeVideos = generationRef.current.scenes.filter((item) => item.videoStatus === "succeeded" && item.videoUrl).length;
    const expectedSceneCount = generationRef.current.scenes.length || SCENE_COUNT;
    const nextStatus = completeVideos === expectedSceneCount ? "voiceover" : "partial";
    replaceGeneration({ ...generationRef.current, status: nextStatus });
    await persist(nextStatus).catch(() => null);
    setPhase(completeVideos === expectedSceneCount ? "voice" : "partial");
    setProgressLabel(completeVideos === expectedSceneCount ? "Ready for voiceover" : `${completeVideos} of ${expectedSceneCount} clips ready`);
    return generationRef.current;
  }, [patchScene, persist, replaceGeneration]);

  // Like video retries, a reference whose generation already settled (e.g.
  // a series_setup batch that hit SETUP_REFERENCES_INCOMPLETE) needs its
  // reservation reopened before job-worker's authorize_thirty_days_asset_job
  // will accept a fresh job — otherwise it 403s immediately since
  // reservation_status is no longer 'reserved'.
  const retryReference = useCallback(async (referenceId) => {
    const current = generationRef.current;
    const reference = current?.visualReferences?.find((item) => item.id === referenceId);
    if (!current?.id || !reference || referenceRetryLocksRef.current.has(referenceId)) return null;
    if (["queued", "running", "retrying"].includes(reference.status)) return null;

    referenceRetryLocksRef.current.add(referenceId);
    setError(null);
    patchReference(referenceId, { jobId: null, imageUrl: null, status: "queued", progress: 0, error: null });
    try {
      const isSeriesGeneration = current.generationMode === "series_setup" || current.generationMode === "series_episode";
      if (isSeriesGeneration) await reopenReferenceRetry(current.id, referenceId);
      await persist("references");
      const { imageUrl, error: retryError } = await generateReferenceWithEscalation({
        generationId: current.id, reference, worldBible: current.worldBible, quality: current.qualityTier,
        referenceId, patchReference, setProgressLabel, labelPrefix: `Retrying ${reference.label || "reference"}`,
      });
      patchReference(referenceId, { status: imageUrl ? "succeeded" : "failed", progress: 100, imageUrl, error: imageUrl ? null : (retryError || "Reference generation failed — try again") });
    } catch (caught) {
      const message = String(caught?.message || caught || "Reference retry failed");
      patchReference(referenceId, {
        status: "failed",
        error: message.includes("INSUFFICIENT_CREDITS") ? "Not enough credits to retry this reference" : message,
      });
    } finally {
      referenceRetryLocksRef.current.delete(referenceId);
    }
    if (["series_setup", "series_episode"].includes(generationRef.current.generationMode)) {
      await syncThirtyDaysAssets(generationRef.current.id).catch(() => null);
      const settled = await settleThirtyDaysGeneration({ generationId: generationRef.current.id }).catch(() => null);
      if (settled) replaceGeneration({ ...generationRef.current, ...settled, scenes: generationRef.current.scenes, visualReferences: generationRef.current.visualReferences });
    }
    await persist("references").catch(() => null);
    return generationRef.current;
  }, [patchReference, persist, replaceGeneration]);

  // A user-requested persistent-reference replacement is its own one-asset
  // reserved generation. Keeping it separate from the original setup or
  // episode generation preserves historical billing/media and guarantees
  // that pressing Generate creates exactly one replacement slot.
  const regenerateSeriesReference = useCallback(async ({ generation: preparedGeneration, seriesId, referenceId }) => {
    const reference = preparedGeneration?.visualReferences?.find((item) => item.id === referenceId);
    if (!preparedGeneration?.id || preparedGeneration.generationMode !== "series_reference" || !seriesId || !reference) {
      throw new Error("Reference replacement is not ready");
    }

    runRef.current += 1;
    replaceGeneration(preparedGeneration);
    setError(null);
    setPhase("references");
    setProgressLabel(`Regenerating ${reference.label || "reference"}`);
    try {
      const { imageUrl, error: generationError } = await generateReferenceWithEscalation({
        generationId: preparedGeneration.id,
        reference,
        worldBible: preparedGeneration.worldBible,
        quality: preparedGeneration.qualityTier,
        referenceId,
        patchReference,
        setProgressLabel,
        labelPrefix: `Regenerating ${reference.label || "reference"}`,
      });
      patchReference(referenceId, {
        status: imageUrl ? "succeeded" : "failed",
        progress: 100,
        imageUrl,
        error: imageUrl ? null : (generationError || "Reference generation failed"),
      });
      await persist("references");
      await syncThirtyDaysAssets(preparedGeneration.id);
      await settleThirtyDaysGeneration({ generationId: preparedGeneration.id });
      if (!imageUrl) throw new Error(generationError || "Reference generation failed — your credits were returned");
      return await commitSeriesReferenceRegeneration(seriesId, preparedGeneration.id, referenceId);
    } catch (caught) {
      await syncThirtyDaysAssets(preparedGeneration.id).catch(() => null);
      await settleThirtyDaysGeneration({ generationId: preparedGeneration.id }).catch(() => null);
      const message = String(caught?.message || caught || "Reference regeneration failed");
      setError(message);
      throw caught;
    } finally {
      setPhase("idle");
      setProgressLabel("");
      replaceGeneration(null);
    }
  }, [patchReference, persist, replaceGeneration]);

  // Unlike automatic setup regeneration, an intentional user edit must send
  // exactly one image request: the user is modifying a known source image,
  // not asking us to explore alternate reference designs.
  const editSeriesReference = useCallback(async ({ generation: preparedGeneration, seriesId, referenceId, editInstruction }) => {
    const reference = preparedGeneration?.visualReferences?.find((item) => item.id === referenceId);
    if (!preparedGeneration?.id || preparedGeneration.generationMode !== "series_reference" || !seriesId || !reference?.imageUrl) {
      throw new Error("Reference edit is not ready");
    }

    runRef.current += 1;
    replaceGeneration(preparedGeneration);
    setError(null);
    setPhase("references");
    setProgressLabel(`Editing ${reference.label || "reference"}`);
    try {
      const job = await editReferenceImage({
        generationId: preparedGeneration.id,
        reference,
        worldBible: preparedGeneration.worldBible,
        quality: preparedGeneration.qualityTier,
        editInstruction,
      });
      patchReference(referenceId, { jobId: job.id, status: "queued", error: null });
      const terminal = await terminalJob(job.id, (row) => {
        patchReference(referenceId, { status: row.status, progress: Number(row.progress || 0) });
      });
      const imageUrl = terminal?.status === "succeeded" ? resultUrl(terminal) : null;
      patchReference(referenceId, { status: imageUrl ? "succeeded" : "failed", progress: 100, imageUrl, error: imageUrl ? null : (terminal?.error || "Reference edit failed") });
      await persist("references");
      await syncThirtyDaysAssets(preparedGeneration.id);
      await settleThirtyDaysGeneration({ generationId: preparedGeneration.id });
      if (!imageUrl) throw new Error(terminal?.error || "Reference edit failed — your credits were returned");
      return await commitSeriesReferenceEdit(seriesId, preparedGeneration.id, referenceId);
    } catch (caught) {
      await syncThirtyDaysAssets(preparedGeneration.id).catch(() => null);
      await settleThirtyDaysGeneration({ generationId: preparedGeneration.id }).catch(() => null);
      const message = String(caught?.message || caught || "Reference edit failed");
      setError(message);
      throw caught;
    } finally {
      setPhase("idle");
      setProgressLabel("");
      replaceGeneration(null);
    }
  }, [patchReference, persist, replaceGeneration]);

  const cancel = useCallback(() => {
    runRef.current += 1;
    setPhase("idle");
    setProgressLabel("");
    setError(null);
    replaceGeneration(null);
  }, [replaceGeneration]);

  return { phase, progressLabel, generation, error, start, resume, retryVideo, retryImage, retryReference, regenerateSeriesReference, editSeriesReference, cancel, setGeneration: replaceGeneration };
}
