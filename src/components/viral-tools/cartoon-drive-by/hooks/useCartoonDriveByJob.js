import { useCallback, useRef, useState } from "react";
import { cancelJob, reconcileVideoJob, watchJob } from "../../../../lib/jobs";
import {
  animateDriveBy,
  createCartoonDriveByGeneration,
  generateDriveByImage,
  updateCartoonDriveByGeneration,
} from "../api/cartoonDriveByApi";

const TERMINAL = new Set(["succeeded", "failed", "canceled"]);
// After the main wait times out, keep actively checking the real provider
// state for a while longer instead of declaring failure outright — a
// content-policy retry can still be genuinely generating server-side even
// after our own worker's single invocation has already given up on it.
const RECONCILE_POLL_MS = 10_000;
const RECONCILE_MAX_ATTEMPTS = 18; // ~3 more minutes on top of the main wait

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
    const timer = setTimeout(async () => {
      // Our local wait gave up, but the job may still be legitimately
      // generating server-side — a content-policy retry can take longer
      // than a single worker invocation's own polling window. Keep actively
      // checking the real provider state for a while longer instead of
      // declaring failure the moment our own clock runs out.
      for (let attempt = 0; attempt < RECONCILE_MAX_ATTEMPTS; attempt++) {
        if (settled) return;
        const reconciled = await reconcileVideoJob(jobId).catch(() => null);
        if (reconciled && TERMINAL.has(reconciled.status)) {
          finish(reconciled);
          return;
        }
        await new Promise((r) => setTimeout(r, RECONCILE_POLL_MS));
      }
      finish(null);
    }, timeoutMs);
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
  const [generationId, setGenerationId] = useState(null);
  const runIdRef = useRef(0);

  const patch = (next) => setResult((current) => ({ ...current, ...next }));

  const start = useCallback(async (input) => {
    const runId = ++runIdRef.current;
    const isCurrent = () => runIdRef.current === runId;
    setError(null);
    setResult({ ...emptyResult(input), imageStatus: "queued" });
    setPhase("image");
    setGenerationId(null);

    // Save a row up front, before anything else — so a generation that's
    // still cooking when the tab closes or the user hits reset is still
    // recoverable from Recent Creations, not silently lost. Best-effort:
    // a save failure here shouldn't block the actual generation.
    let genId = null;
    try {
      const saved = await createCartoonDriveByGeneration({ ...input, status: "generating" });
      if (!isCurrent()) return;
      genId = saved.id;
      setGenerationId(genId);
    } catch (e) {
      console.error("[useCartoonDriveByJob] createCartoonDriveByGeneration failed:", e.message);
    }

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
      if (genId) {
        updateCartoonDriveByGeneration(genId, { imageUrl, status: "generating" }).catch((e) =>
          console.error("[useCartoonDriveByJob] image save failed:", e.message)
        );
      }

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
      if (genId) {
        updateCartoonDriveByGeneration(genId, { videoUrl, status: "completed" }).catch((e) =>
          console.error("[useCartoonDriveByJob] video save failed:", e.message)
        );
      }
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
      if (genId) {
        updateCartoonDriveByGeneration(genId, { status: "failed" }).catch(() => {});
      }
    }
  }, []);

  const reset = useCallback(() => {
    runIdRef.current += 1;
    setPhase("idle");
    setResult(emptyResult());
    setError(null);
    setGenerationId(null);
  }, []);

  const showGeneration = useCallback((generation) => {
    runIdRef.current += 1;
    setError(null);
    setGenerationId(generation?.id ?? null);
    setResult({
      ...emptyResult(generation),
      imageStatus: generation?.imageUrl ? "succeeded" : "failed",
      videoStatus: generation?.videoUrl ? "succeeded" : "failed",
      imageUrl: generation?.imageUrl ?? null,
      videoUrl: generation?.videoUrl ?? null,
    });
    setPhase("done");
  }, []);

  return { phase, result, error, generationId, start, reset, showGeneration };
}
