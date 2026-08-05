import { useCallback, useRef, useState } from "react";
import { cancelJob, watchJob } from "../../../../lib/jobs";
import { animateDriveBy, generateDriveByImage } from "../api/cartoonDriveByApi";

const TERMINAL = new Set(["succeeded", "failed", "canceled"]);

function resolveUrl(job) {
  const raw =
    job?.result_url || job?.resultUrl ||
    job?.output?.result_url || job?.output?.resultUrl ||
    job?.output?.imageUrl || job?.output?.image_url ||
    job?.output?.videoUrl || job?.output?.video_url ||
    job?.output?.data?.[0]?.url || job?.output?.results?.[0]?.url || null;
  return raw && !raw.includes("localhost") ? raw.trim() : null;
}

function waitForJob(jobId, timeoutMs, onRetrying) {
  return new Promise((resolve) => {
    let unsub;
    let settled = false;
    const finish = (row) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { unsub?.(); } catch {
        // The realtime subscription may already be closed after a terminal update.
      }
      resolve(row);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    unsub = watchJob(jobId, (row) => {
      if (row.status === "queued" && Number(row.attempts ?? 0) > 0) onRetrying?.();
      if (TERMINAL.has(row.status)) finish(row);
    });
  });
}

function emptyResult(input = {}) {
  return {
    world: input.world ?? "",
    vehicle: input.vehicle ?? "car",
    mood: input.mood ?? "golden-dusk",
    qualityId: input.qualityId ?? "cartoon-drive-v2",
    imageJobId: null,
    imageStatus: "idle",
    imageUrl: null,
    videoJobId: null,
    videoStatus: "idle",
    videoUrl: null,
    createdAt: input.createdAt ?? null,
  };
}

export default function useCartoonDriveByJob() {
  const [phase, setPhase] = useState("idle");
  const [result, setResult] = useState(emptyResult());
  const [error, setError] = useState(null);
  const runIdRef = useRef(0);

  const patch = (next) => setResult((current) => ({ ...current, ...next }));

  const start = useCallback(async (input) => {
    const runId = ++runIdRef.current;
    const isCurrent = () => runIdRef.current === runId;
    setError(null);
    setResult({ ...emptyResult(input), imageStatus: "queued" });
    setPhase("image");

    let imageJob;
    try {
      imageJob = await generateDriveByImage(input);
      if (!isCurrent()) return;
      patch({ imageJobId: imageJob.id, imageStatus: "running" });
      const imageRow = await waitForJob(imageJob.id, 5 * 60 * 1000, () => patch({ imageStatus: "retrying" }));
      if (!isCurrent()) return;
      const imageUrl = imageRow?.status === "succeeded" ? resolveUrl(imageRow) : null;
      if (!imageUrl) {
        if (!imageRow && imageJob?.id) cancelJob(imageJob.id).catch(() => {});
        throw new Error("The image could not be generated. Please try again.");
      }

      patch({ imageStatus: "succeeded", imageUrl, videoStatus: "queued" });
      setPhase("video");

      const videoJob = await animateDriveBy({ ...input, imageUrl });
      if (!isCurrent()) return;
      patch({ videoJobId: videoJob.id, videoStatus: "running" });
      const videoRow = await waitForJob(videoJob.id, 8 * 60 * 1000);
      if (!isCurrent()) return;
      const videoUrl = videoRow?.status === "succeeded" ? resolveUrl(videoRow) : null;
      if (!videoUrl) {
        if (!videoRow && videoJob?.id) cancelJob(videoJob.id).catch(() => {});
        throw new Error("The video could not be generated. Your still image is ready, so you can try again.");
      }

      patch({ videoStatus: "succeeded", videoUrl, createdAt: new Date().toISOString() });
      setPhase("done");
    } catch (err) {
      if (!isCurrent()) return;
      const message = err?.message || "Generation failed. Please try again.";
      setError(message);
      setResult((current) => ({
        ...current,
        imageStatus: current.imageUrl ? "succeeded" : "failed",
        videoStatus: current.imageUrl ? "failed" : current.videoStatus,
      }));
      setPhase("error");
    }
  }, []);

  const reset = useCallback(() => {
    runIdRef.current += 1;
    setPhase("idle");
    setResult(emptyResult());
    setError(null);
  }, []);

  const showGeneration = useCallback((generation) => {
    runIdRef.current += 1;
    setError(null);
    setResult({
      ...emptyResult(generation),
      imageStatus: generation?.imageUrl ? "succeeded" : "failed",
      videoStatus: generation?.videoUrl ? "succeeded" : "failed",
      imageUrl: generation?.imageUrl ?? null,
      videoUrl: generation?.videoUrl ?? null,
    });
    setPhase("done");
  }, []);

  return { phase, result, error, start, reset, showGeneration };
}
