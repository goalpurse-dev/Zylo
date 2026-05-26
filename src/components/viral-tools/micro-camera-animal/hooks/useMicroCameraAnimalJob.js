import { useCallback, useRef, useState } from "react";
import { watchJob, cancelJob } from "../../../../lib/jobs";
import {
  detectAnimal,
  generateReferenceImage,
  generateSceneImage,
  animateSceneClip,
  getSceneIndices,
} from "../api/microCameraAnimalApi";

const TERMINAL = new Set(["succeeded", "failed", "canceled"]);
const isTerminal = (s) => TERMINAL.has(s);

function resolveUrl(job) {
  const raw =
    job?.result_url ||
    job?.resultUrl ||
    job?.output?.result_url ||
    job?.output?.resultUrl ||
    job?.output?.imageUrl ||
    job?.output?.image_url ||
    job?.output?.videoUrl ||
    job?.output?.video_url ||
    job?.output?.data?.[0]?.url ||
    job?.output?.results?.[0]?.url ||
    null;
  return raw && !raw.includes("localhost") ? raw.trim() : null;
}

function waitForJob(jobId, timeoutMs = 4.5 * 60 * 1000) {
  return new Promise((resolve) => {
    let unsub;
    let settled = false;
    const finish = (row) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { unsub?.(); } catch {}
      resolve(row);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    unsub = watchJob(jobId, (row) => {
      if (isTerminal(row.status)) finish(row);
    });
  });
}

const makeScene = (i) => ({
  index: i,
  imageJobId: null,
  imageStatus: "idle",
  imageUrl: null,
  videoJobId: null,
  videoStatus: "idle",
  videoUrl: null,
});

export default function useMicroCameraAnimalJob() {
  const [phase, setPhase]             = useState("idle");
  const [scenes, setScenes]           = useState([]);
  const [error, setError]             = useState(null);
  const [animalLabel, setAnimalLabel] = useState("");

  const cancelRef = useRef(false);
  const activeRef = useRef(false);
  const runIdRef  = useRef(0);

  const patchScene = (index, patch) =>
    setScenes((prev) => prev.map((s) => (s.index === index ? { ...s, ...patch } : s)));

  const start = useCallback(async ({ animalInput, sceneCount = 3 }) => {
    if (activeRef.current) return;

    activeRef.current = true;
    cancelRef.current = false;
    const runId = ++runIdRef.current;
    const isCurrentRun = () => !cancelRef.current && runIdRef.current === runId;

    const profile = detectAnimal(animalInput);
    setAnimalLabel(profile.label);
    setScenes(Array.from({ length: sceneCount }, (_, i) => makeScene(i)));
    setError(null);
    setPhase("images");

    const imagePrompts  = profile.imagePrompts;
    const videoPrompts  = profile.videoPrompts;
    const sceneIndices  = getSceneIndices(sceneCount); // e.g. [0,1,5] for 15s

    // ── Silently get a reference image first ──
    let referenceUrl = null;
    try {
      const refJob = await generateReferenceImage({ prompt: profile.referencePrompt });
      if (!isCurrentRun()) return;
      const refResult = await waitForJob(refJob.id);
      if (!isCurrentRun()) return;
      if (refResult?.status === "succeeded") {
        referenceUrl = resolveUrl(refResult);
      } else if (refResult === null && refJob?.id) {
        cancelJob(refJob.id).catch(() => {});
      }
    } catch (err) {
      console.warn("[MicroCamera] reference image failed (continuing without it)", err);
    }

    if (!isCurrentRun()) return;

    // ── Scene images — sequential so each uses the reference ──
    const imageResults = []; // { index, url }

    for (let i = 0; i < sceneIndices.length; i++) {
      const promptIdx = sceneIndices[i];
      if (!isCurrentRun()) return;

      patchScene(i, { imageStatus: "queued" });

      let job, result;
      try {
        job = await generateSceneImage({ prompt: imagePrompts[promptIdx], referenceUrl });
        if (!isCurrentRun()) return;
        patchScene(i, { imageJobId: job.id, imageStatus: "running" });
        result = await waitForJob(job.id);
      } catch (err) {
        console.warn(`[MicroCamera] scene image failed to start (scene ${i})`, err);
      }

      if (!isCurrentRun()) return;

      if (!result || result.status !== "succeeded") {
        if (result === null && job?.id) cancelJob(job.id).catch(() => {});
        patchScene(i, { imageStatus: "failed" });
        continue;
      }

      const url = resolveUrl(result);
      patchScene(i, { imageStatus: "succeeded", imageUrl: url });
      imageResults.push({ index: i, url, promptIdx });
    }

    if (!isCurrentRun()) return;

    if (!imageResults.length) {
      setError("All scene images failed. Please try again.");
      setPhase("error");
      return;
    }

    setPhase("videos");

    // ── Submit ALL video jobs simultaneously ──
    const videoJobSettled = await Promise.allSettled(
      imageResults.map(({ url, promptIdx }) =>
        animateSceneClip({ imageUrl: url, videoPrompt: videoPrompts[promptIdx] })
      )
    );

    if (!isCurrentRun()) return;

    // Mark running / failed immediately after submission
    videoJobSettled.forEach((settled, i) => {
      const { index } = imageResults[i];
      if (settled.status === "fulfilled") {
        patchScene(index, { videoJobId: settled.value.id, videoStatus: "running" });
      } else {
        console.error(`[MicroCamera] video job submission failed (scene ${imageResults[i].index})`, settled.reason);
        patchScene(index, { videoStatus: "failed" });
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
          });
        });
      })
    );

    if (isCurrentRun()) setPhase("done");
  }, []);

  const reset = useCallback(() => {
    cancelRef.current = true;
    runIdRef.current += 1;
    activeRef.current = false;
    setPhase("idle");
    setScenes([]);
    setError(null);
    setAnimalLabel("");
  }, []);

  const showGeneration = useCallback((generation) => {
    cancelRef.current = true;
    runIdRef.current += 1;
    activeRef.current = false;
    setError(null);
    setAnimalLabel(generation?.animalLabel ?? "animal");
    setScenes(
      (generation?.scenes || [])
        .filter((s) => s.imageUrl || s.videoUrl)
        .map((s, i) => ({
          index: s.index ?? i,
          imageJobId: null,
          imageStatus: s.imageUrl ? "succeeded" : "failed",
          imageUrl: s.imageUrl ?? null,
          videoJobId: null,
          videoStatus: s.videoUrl ? "succeeded" : "failed",
          videoUrl: s.videoUrl ?? null,
        }))
    );
    setPhase("done");
  }, []);

  return { phase, scenes, error, animalLabel, start, reset, showGeneration };
}
