import { useCallback, useRef, useState } from "react";
import { watchJob, cancelJob } from "../../../../lib/jobs";
import { generateFaceImage, generateFaceImageFallback, animateFaceClip } from "../api/faceAsmrApi";

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

// Max video jobs running at the same time — keeps provider rate limits happy
const MAX_VIDEO_CONCURRENT = 2;

export default function useFaceAsmrJob() {
  const [phase, setPhase] = useState("idle");
  const [scenes, setScenes] = useState([]);
  const [error, setError] = useState(null);

  const cancelRef = useRef(false);
  const activeRef = useRef(false);
  const runIdRef = useRef(0);

  const patchScene = (index, patch) =>
    setScenes((prev) => prev.map((s) => (s.index === index ? { ...s, ...patch } : s)));

  const start = useCallback(async ({ scenes: inputScenes, backgroundId }) => {
    if (activeRef.current) return;

    activeRef.current = true;
    cancelRef.current = false;
    const runId = ++runIdRef.current;
    const isCurrentRun = () => !cancelRef.current && runIdRef.current === runId;

    const scenesToRun = inputScenes.slice();
    const count = scenesToRun.length;

    setScenes(scenesToRun.map((_, i) => makeScene(i)));
    setError(null);
    setPhase("images");

    // Shared concurrency counter for video jobs
    let activeVideos = 0;

    // Launches a single video, waiting for a free slot first
    const launchVideo = async (imageUrl, sceneIndex) => {
      while (activeVideos >= MAX_VIDEO_CONCURRENT) {
        if (!isCurrentRun()) return;
        await new Promise((r) => setTimeout(r, 500));
      }
      if (!isCurrentRun()) return;

      activeVideos++;
      patchScene(sceneIndex, { videoStatus: "queued" });

      let job;
      try {
        job = await animateFaceClip({ imageUrl });
        if (!isCurrentRun()) { activeVideos--; return; }
      } catch (err) {
        console.error(`[FaceAsmr] video job failed to start (scene ${sceneIndex})`, err);
        patchScene(sceneIndex, { videoStatus: "failed" });
        activeVideos--;
        return;
      }

      patchScene(sceneIndex, { videoJobId: job.id, videoStatus: "running" });

      const result = await waitForJob(job.id, 6 * 60 * 1000);
      activeVideos--;

      if (!isCurrentRun()) return;

      const videoUrl = resolveUrl(result);
      patchScene(sceneIndex, {
        videoStatus: result?.status === "succeeded" && videoUrl ? "succeeded" : "failed",
        videoUrl: videoUrl ?? null,
      });
    };

    try {
      const videoPromises = [];
      let hasAnyImage = false;

      // Images run one at a time; each fires its video as soon as it's ready
      for (let i = 0; i < count; i++) {
        if (!isCurrentRun()) return;

        const scene = scenesToRun[i];
        patchScene(i, { imageStatus: "queued" });

        let job;
        let result;

        try {
          job = await generateFaceImage({
            description: scene.description,
            imagePreview: scene.imagePreview,
            backgroundId,
          });
          if (!isCurrentRun()) return;

          patchScene(i, { imageJobId: job.id, imageStatus: "running" });
          result = await waitForJob(job.id);
        } catch (err) {
          console.warn(`[FaceAsmr] primary image failed to start (scene ${i})`, err);
        }

        if (!isCurrentRun()) return;

        if (!result || result.status !== "succeeded") {
          // result === null means waitForJob hit the 4.5-min timeout — the primary
          // job may still be running at the provider and could succeed later,
          // which would charge 2 credits after we've already paid for the fallback.
          // Cancel it now so the edge function won't charge on a late success.
          // result with a status (failed/canceled) is already terminal — no need to cancel.
          if (result === null && job?.id) {
            cancelJob(job.id).catch((err) =>
              console.warn(`[FaceAsmr] could not cancel timed-out primary job ${job.id}`, err)
            );
          }

          console.log(`[FaceAsmr] falling back to Nano Banana for scene ${i}`);
          patchScene(i, { imageStatus: "queued" });

          try {
            job = await generateFaceImageFallback({
              description: scene.description,
              imagePreview: scene.imagePreview,
              backgroundId,
            });
            if (!isCurrentRun()) return;

            patchScene(i, { imageJobId: job.id, imageStatus: "running" });
            result = await waitForJob(job.id);
          } catch (err) {
            console.error(`[FaceAsmr] fallback also failed (scene ${i})`, err);
          }
        }

        if (!isCurrentRun()) return;

        if (!result || result.status !== "succeeded") {
          patchScene(i, { imageStatus: "failed" });
          continue;
        }

        const url = resolveUrl(result);
        hasAnyImage = true;
        patchScene(i, { imageStatus: "succeeded", imageUrl: url });

        // Fire the video immediately — tracked but not awaited here
        videoPromises.push(launchVideo(url, i));
      }

      if (!isCurrentRun()) return;

      if (!hasAnyImage) {
        setError("All scene images failed. Check your descriptions.");
        setPhase("error");
        return;
      }

      // All images done — switch status bar to videos phase
      setPhase("videos");

      // Wait for every in-flight video to finish
      await Promise.allSettled(videoPromises);

      if (isCurrentRun()) setPhase("done");
    } finally {
      if (runIdRef.current === runId) activeRef.current = false;
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
        .filter((scene) => scene.imageUrl || scene.videoUrl)
        .map((scene, i) => ({
          index: scene.index ?? i,
          imageJobId: null,
          imageStatus: scene.imageUrl ? "succeeded" : "failed",
          imageUrl: scene.imageUrl ?? null,
          videoJobId: null,
          videoStatus: scene.videoUrl ? "succeeded" : "failed",
          videoUrl: scene.videoUrl ?? null,
        }))
    );
    setPhase("done");
  }, []);

  return { phase, scenes, error, start, reset, showGeneration };
}
