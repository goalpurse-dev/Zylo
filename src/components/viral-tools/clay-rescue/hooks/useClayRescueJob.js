import { useCallback, useRef, useState } from "react";
import { watchJob, cancelJob } from "../../../../lib/jobs";
import {
  buildScenePrompts,
  getShuffledScenarioOrder,
  generateProblemImage,
  generateFixImage,
  animateSceneClip,
} from "../api/clayRescueApi";

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

function retryErrorMessage(error, fallback = "Video retry failed — try again") {
  const message = String(error?.message ?? error ?? "").trim();
  if (message === "INSUFFICIENT_CREDITS") return "Not enough credits to retry this video";
  return message || fallback;
}

const makeScene = (i, problem = "", fix = "") => ({
  index: i, problem, fix,
  problemJobId: null, problemStatus: "idle", problemUrl: null,
  fixJobId: null,     imageStatus: "idle",   imageUrl: null,
  videoJobId: null,   videoStatus: "idle",   videoUrl: null, videoError: null,
});

export default function useClayRescueJob() {
  const [phase,  setPhase]  = useState("idle");
  const [scenes, setScenes] = useState([]);
  const [error,  setError]  = useState(null);

  const cancelRef  = useRef(false);
  const activeRef  = useRef(false);
  const runIdRef   = useRef(0);
  // Always-fresh mirror of `scenes` so retryScene never reads a stale closure
  const scenesRef  = useRef([]);

  const patchScene = (index, patch) =>
    setScenes((prev) => {
      const next = prev.map((s) => (s.index === index ? { ...s, ...patch } : s));
      scenesRef.current = next;
      return next;
    });

  const start = useCallback(async ({ sceneInputs, aiMode = true, withSound = true }) => {
    if (activeRef.current) return;
    activeRef.current = true;
    cancelRef.current = false;
    const runId = ++runIdRef.current;
    const isCurrentRun = () => !cancelRef.current && runIdRef.current === runId;

    const initial = sceneInputs.map((si, i) => makeScene(i, si.problem, si.fix));
    scenesRef.current = initial;
    setScenes(initial);
    setError(null);
    setPhase("images");

    // Shuffle scenario order once per run so every generation is different
    const scenarioOrder = aiMode ? getShuffledScenarioOrder() : null;

    // ── Each scene runs its own A→B pipeline independently.
    //    Scenes start staggered by SCENE_STAGGER_MS to avoid simultaneous API bursts.
    //    Once a scene's Image A is done it IMMEDIATELY kicks off Image B without
    //    waiting for any other scene.
    const sceneResultSettled = await Promise.allSettled(
      sceneInputs.map(async (si, i) => {
        // Stagger start
        await delay(i * SCENE_STAGGER_MS);
        if (!isCurrentRun()) throw new Error("cancelled");

        const { problemImagePrompt, fixImagePrompt, videoPrompt, problem: resolvedProblem, fix: resolvedFix } =
          buildScenePrompts(si.problem, si.fix, i, aiMode, scenarioOrder);
        patchScene(i, {
          problem: resolvedProblem || si.problem,
          fix: resolvedFix || si.fix,
        });

        // ─ Image A: Problem ─
        patchScene(i, { problemStatus: "queued", imageStatus: "queued" });

        let problemJob, problemResult;
        try {
          problemJob = await generateProblemImage({ problemImagePrompt });
          if (!isCurrentRun()) throw new Error("cancelled");
          patchScene(i, { problemJobId: problemJob.id, problemStatus: "running" });
          problemResult = await waitForJob(problemJob.id);
        } catch (err) {
          if (err.message === "cancelled") throw err;
          console.warn(`[ClayRescue] scene ${i} problem image failed`, err);
        }

        if (!isCurrentRun()) throw new Error("cancelled");

        const problemUrl = problemResult?.status === "succeeded" ? resolveUrl(problemResult) : null;
        if (!problemUrl) {
          if (problemResult === null && problemJob?.id) cancelJob(problemJob.id).catch(() => {});
          patchScene(i, { problemStatus: "failed", imageStatus: "failed" });
          throw new Error(`scene ${i}: problem image failed`);
        }
        patchScene(i, { problemStatus: "succeeded", problemUrl });

        // ─ Image B: Fix (starts immediately after A succeeds, independent of other scenes) ─
        let fixJob, fixResult;
        try {
          fixJob = await generateFixImage({ fixImagePrompt, problemImageUrl: problemUrl });
          if (!isCurrentRun()) throw new Error("cancelled");
          patchScene(i, { fixJobId: fixJob.id, imageStatus: "running" });
          fixResult = await waitForJob(fixJob.id, undefined, () => {
            setPhase("retrying");
            patchScene(i, { imageStatus: "retrying" });
          });
          if (isCurrentRun()) { setPhase("images"); patchScene(i, { imageStatus: "running" }); }
        } catch (err) {
          if (err.message === "cancelled") throw err;
          console.warn(`[ClayRescue] scene ${i} fix image failed`, err);
        }

        if (!isCurrentRun()) throw new Error("cancelled");

        const fixUrl = fixResult?.status === "succeeded" ? resolveUrl(fixResult) : null;
        if (!fixUrl) {
          if (fixResult === null && fixJob?.id) cancelJob(fixJob.id).catch(() => {});
          // Fallback to problem image for video if fix failed
          patchScene(i, { imageStatus: "failed" });
          return { index: i, problemUrl, fixUrl: problemUrl, videoPrompt };
        }

        patchScene(i, { imageStatus: "succeeded", imageUrl: fixUrl });
        return { index: i, problemUrl, fixUrl, videoPrompt };
      })
    );

    if (!isCurrentRun()) return;

    // Collect successful image results
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

    // ── Submit ALL video jobs simultaneously ──
    const videoJobSettled = await Promise.allSettled(
      imageResults.map(({ problemUrl, fixUrl, videoPrompt }) =>
        animateSceneClip({ fixImageUrl: fixUrl, problemImageUrl: problemUrl, videoPrompt, withSound })
      )
    );

    if (!isCurrentRun()) return;

    videoJobSettled.forEach((settled, i) => {
      const { index } = imageResults[i];
      if (settled.status === "fulfilled") {
        patchScene(index, { videoJobId: settled.value.id, videoStatus: "running", videoError: null });
      } else {
        console.error(`[ClayRescue] video submission failed scene ${imageResults[i].index}`, settled.reason);
        patchScene(index, {
          videoStatus: "failed",
          videoError: retryErrorMessage(settled.reason, "Video submission failed — try again"),
        });
      }
    });

    // ── Watch all video jobs concurrently ──
    await Promise.allSettled(
      videoJobSettled.map((settled, i) => {
        const { index } = imageResults[i];
        if (settled.status !== "fulfilled") return Promise.resolve();
        return waitForJob(settled.value.id, 6 * 60 * 1000).then((result) => {
          if (!isCurrentRun()) return;
          const videoUrl = resolveUrl(result);
          patchScene(index, {
            videoStatus: result?.status === "succeeded" && videoUrl ? "succeeded" : "failed",
            videoUrl: videoUrl ?? null,
            videoError:
              result?.status === "succeeded" && videoUrl
                ? null
                : retryErrorMessage(result?.error, "Video timed out — image saved"),
          });
        });
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
   * - imageStatus === "failed"  → redo image A → image B → video
   * - videoStatus === "failed" (but image ok) → redo video only using existing imageUrl
   */
  const retryScene = useCallback(async (sceneIndex, withSound = true) => {
    // Read from ref so we always get the latest state, never a stale closure
    const scene = scenesRef.current.find((s) => s.index === sceneIndex);
    if (!scene) return;

    const videoFailed = scene.videoStatus === "failed" && scene.imageUrl;
    const imageFailed = scene.imageStatus === "failed";
    if (!videoFailed && !imageFailed) return;

    setPhase("videos"); // keeps the results panel in "active" mode

    const patchOne = (patch) =>
      setScenes((prev) => {
        const next = prev.map((s) => s.index === sceneIndex ? { ...s, ...patch } : s);
        scenesRef.current = next;
        return next;
      });

    if (videoFailed) {
      // ── Video-only retry — reuse existing imageUrl ──────────────────────
      patchOne({ videoStatus: "queued", videoJobId: null, videoUrl: null, videoError: null });

      let videoJob;
      try {
        // Rebuild the video prompt from the stored problem/fix so it's consistent
        const { videoPrompt } = buildScenePrompts(scene.problem, scene.fix, sceneIndex, false);
        videoJob = await animateSceneClip({
          fixImageUrl:     scene.imageUrl,
          problemImageUrl: scene.problemUrl ?? null,
          videoPrompt,
          withSound,
        });
        patchOne({ videoJobId: videoJob.id, videoStatus: "running" });
      } catch (e) {
        console.error("[retryScene] video job submission failed:", e);
        patchOne({ videoStatus: "failed", videoError: retryErrorMessage(e) });
        setPhase("done");
        return;
      }

      const result = await waitForJob(videoJob.id, 6 * 60 * 1000);
      const url = resolveUrl(result);
      patchOne({
        videoStatus: result?.status === "succeeded" && url ? "succeeded" : "failed",
        videoUrl:    url ?? null,
        videoError:
          result?.status === "succeeded" && url
            ? null
            : retryErrorMessage(result?.error, "Video retry timed out — try again"),
      });

    } else {
      // ── Full retry — image A → image B → video ─────────────────────────
      patchOne({ problemStatus: "queued", imageStatus: "queued", videoStatus: "idle",
                 problemUrl: null, imageUrl: null, videoUrl: null,
                 problemJobId: null, fixJobId: null, videoJobId: null, videoError: null });

      setPhase("images");

      const { problemImagePrompt, fixImagePrompt, videoPrompt } =
        buildScenePrompts(scene.problem, scene.fix, sceneIndex, false);

      // Image A
      let problemJob, problemResult;
      try {
        problemJob = await generateProblemImage({ problemImagePrompt });
        patchOne({ problemJobId: problemJob.id, problemStatus: "running" });
        problemResult = await waitForJob(problemJob.id);
      } catch { patchOne({ problemStatus: "failed", imageStatus: "failed" }); setPhase("done"); return; }

      const problemUrl = problemResult?.status === "succeeded" ? resolveUrl(problemResult) : null;
      if (!problemUrl) { patchOne({ problemStatus: "failed", imageStatus: "failed" }); setPhase("done"); return; }
      patchOne({ problemStatus: "succeeded", problemUrl });

      // Image B
      let fixJob, fixResult;
      try {
        fixJob = await generateFixImage({ fixImagePrompt, problemImageUrl: problemUrl });
        patchOne({ fixJobId: fixJob.id, imageStatus: "running" });
        fixResult = await waitForJob(fixJob.id);
      } catch { patchOne({ imageStatus: "failed" }); setPhase("done"); return; }

      const fixUrl = fixResult?.status === "succeeded" ? resolveUrl(fixResult) : null;
      if (!fixUrl) { patchOne({ imageStatus: "failed" }); setPhase("done"); return; }
      patchOne({ imageStatus: "succeeded", imageUrl: fixUrl });

      setPhase("videos");

      // Video
      let videoJob;
      try {
        videoJob = await animateSceneClip({
          fixImageUrl: fixUrl, problemImageUrl: problemUrl, videoPrompt, withSound,
        });
        patchOne({ videoJobId: videoJob.id, videoStatus: "running" });
      } catch (e) {
        patchOne({ videoStatus: "failed", videoError: retryErrorMessage(e) });
        setPhase("done");
        return;
      }

      const result = await waitForJob(videoJob.id, 6 * 60 * 1000);
      const url = resolveUrl(result);
      patchOne({
        videoStatus: result?.status === "succeeded" && url ? "succeeded" : "failed",
        videoUrl:    url ?? null,
        videoError:
          result?.status === "succeeded" && url
            ? null
            : retryErrorMessage(result?.error, "Video retry timed out — try again"),
      });
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
    const restoredScenes = (generation?.scenes || [])
      .filter((s) => s.fixUrl || s.problemUrl || s.videoUrl)
      .map((s, i) => ({
        index: s.index ?? i,
        problem: s.problem ?? "",
        fix: s.fix ?? "",
        problemJobId: null, problemStatus: s.problemUrl ? "succeeded" : "failed", problemUrl: s.problemUrl ?? null,
        fixJobId: null,     imageStatus: s.fixUrl ? "succeeded" : "failed",   imageUrl: s.fixUrl ?? s.problemUrl ?? null,
        videoJobId: null,   videoStatus: s.videoUrl ? "succeeded" : "failed", videoUrl: s.videoUrl ?? null,
        videoError: s.videoUrl ? null : "Video unavailable — retry to generate it",
      }));

    // retryScene reads from this ref so restored Recent generations must update
    // it at the same time as the rendered state. Otherwise the button silently
    // returns because it cannot find the scene that is visibly on screen.
    scenesRef.current = restoredScenes;
    setScenes(restoredScenes);
    setPhase("done");
  }, []);

  return { phase, scenes, error, start, reset, showGeneration, retryScene };
}
