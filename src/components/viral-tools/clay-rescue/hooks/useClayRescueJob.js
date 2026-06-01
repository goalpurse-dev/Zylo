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

function waitForJob(jobId, timeoutMs = 4.5 * 60 * 1000) {
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
    unsub = watchJob(jobId, (row) => { if (isTerminal(row.status)) finish(row); });
  });
}

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

const makeScene = (i, problem = "", fix = "") => ({
  index: i, problem, fix,
  problemJobId: null, problemStatus: "idle", problemUrl: null,
  fixJobId: null,     imageStatus: "idle",   imageUrl: null,
  videoJobId: null,   videoStatus: "idle",   videoUrl: null,
});

export default function useClayRescueJob() {
  const [phase,  setPhase]  = useState("idle");
  const [scenes, setScenes] = useState([]);
  const [error,  setError]  = useState(null);

  const cancelRef = useRef(false);
  const activeRef = useRef(false);
  const runIdRef  = useRef(0);

  const patchScene = (index, patch) =>
    setScenes((prev) => prev.map((s) => (s.index === index ? { ...s, ...patch } : s)));

  const start = useCallback(async ({ sceneInputs, aiMode = true }) => {
    if (activeRef.current) return;
    activeRef.current = true;
    cancelRef.current = false;
    const runId = ++runIdRef.current;
    const isCurrentRun = () => !cancelRef.current && runIdRef.current === runId;

    setScenes(sceneInputs.map((si, i) => makeScene(i, si.problem, si.fix)));
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
          fixResult = await waitForJob(fixJob.id);
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
        animateSceneClip({ fixImageUrl: fixUrl, problemImageUrl: problemUrl, videoPrompt })
      )
    );

    if (!isCurrentRun()) return;

    videoJobSettled.forEach((settled, i) => {
      const { index } = imageResults[i];
      if (settled.status === "fulfilled") {
        patchScene(index, { videoJobId: settled.value.id, videoStatus: "running" });
      } else {
        console.error(`[ClayRescue] video submission failed scene ${imageResults[i].index}`, settled.reason);
        patchScene(index, { videoStatus: "failed" });
      }
    });

    // ── Watch all video jobs concurrently ──
    await Promise.allSettled(
      videoJobSettled.map((settled, i) => {
        const { index } = imageResults[i];
        if (settled.status !== "fulfilled") return Promise.resolve();
        return waitForJob(settled.value.id, 9 * 60 * 1000).then((result) => {
          if (!isCurrentRun()) return;
          const videoUrl = resolveUrl(result);
          patchScene(index, {
            videoStatus: result?.status === "succeeded" && videoUrl ? "succeeded" : "failed",
            videoUrl: videoUrl ?? null,
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

  const showGeneration = useCallback((generation) => {
    cancelRef.current = true;
    runIdRef.current += 1;
    activeRef.current = false;
    setError(null);
    setScenes(
      (generation?.scenes || [])
        .filter((s) => s.fixUrl || s.problemUrl || s.videoUrl)
        .map((s, i) => ({
          index: s.index ?? i,
          problem: s.problem ?? "",
          fix: s.fix ?? "",
          problemJobId: null, problemStatus: s.problemUrl ? "succeeded" : "failed", problemUrl: s.problemUrl ?? null,
          fixJobId: null,     imageStatus: s.fixUrl ? "succeeded" : "failed",   imageUrl: s.fixUrl ?? s.problemUrl ?? null,
          videoJobId: null,   videoStatus: s.videoUrl ? "succeeded" : "failed", videoUrl: s.videoUrl ?? null,
        }))
    );
    setPhase("done");
  }, []);

  return { phase, scenes, error, start, reset, showGeneration };
}
