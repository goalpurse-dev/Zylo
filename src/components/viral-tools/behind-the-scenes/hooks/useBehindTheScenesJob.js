import { useCallback, useRef, useState } from "react";
import { cancelJob, reconcileVideoJob, watchJob } from "../../../../lib/jobs";
import {
  animateBehindTheScenes,
  createBehindTheScenesGeneration,
  generateBehindTheScenesImage,
  updateBehindTheScenesGeneration,
} from "../api/behindTheScenesApi";

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
    place: input.place ?? "",
    disaster: input.disaster ?? "wave",
    vantage: input.vantage ?? "tank-edge",
    qualityId: input.qualityId ?? "bts-v2",
    imageJobId: null,
    imageStatus: "idle",
    imageUrl: null,
    videoJobId: null,
    videoStatus: "idle",
    videoUrl: null,
    createdAt: input.createdAt ?? null,
  };
}

export default function useBehindTheScenesJob() {
  const [phase, setPhase] = useState("idle");
  const [result, setResult] = useState(emptyResult());
  const [error, setError] = useState(null);
  const [generationId, setGenerationId] = useState(null);
  const [videoAttempts, setVideoAttempts] = useState(0);
  const runIdRef = useRef(0);

  const patch = (next) => setResult((current) => ({ ...current, ...next }));

  // Shared by the initial generate flow and the standalone "try video
  // again" retry — takes an image that already exists and only runs the
  // video half, so a retry never re-spends image credits or re-rolls the
  // still. `attemptNumber` drives the escalating error copy: after a
  // second straight video failure on the same image we stop suggesting
  // "try again" and point the user at starting a new episode instead.
  const runVideoStep = useCallback(async (input, genId, isCurrent, attemptNumber) => {
    try {
      const videoJob = await animateBehindTheScenes(input);
      if (!isCurrent()) return;
      patch({ videoJobId: videoJob.id, videoStatus: "running" });
      const videoRow = await waitForJob(videoJob.id, 8 * 60 * 1000);
      if (!isCurrent()) return;
      const videoUrl = videoRow?.status === "succeeded" ? resolveUrl(videoRow) : null;
      if (!videoUrl) {
        if (!videoRow && videoJob?.id) cancelJob(videoJob.id).catch(() => {});
        throw new Error("failed");
      }

      patch({ videoStatus: "succeeded", videoUrl, createdAt: new Date().toISOString() });
      setPhase("done");
      if (genId) {
        updateBehindTheScenesGeneration(genId, { videoUrl, status: "completed" }).catch((e) =>
          console.error("[useBehindTheScenesJob] video save failed:", e.message)
        );
      }
    } catch {
      if (!isCurrent()) return;
      patch({ videoStatus: "failed" });
      setPhase("error");
      setError(
        attemptNumber >= 2
          ? "This image still won't animate. Your image is saved — try a new episode instead."
          : "The video could not be generated. Your still image is ready, so you can try again."
      );
      if (genId) {
        updateBehindTheScenesGeneration(genId, { status: "failed" }).catch(() => {});
      }
    }
  }, []);

  const start = useCallback(async (input) => {
    const runId = ++runIdRef.current;
    const isCurrent = () => runIdRef.current === runId;
    setError(null);
    setVideoAttempts(0);
    setResult({ ...emptyResult(input), imageStatus: "queued" });
    setPhase("image");
    setGenerationId(null);

    // Save a row up front, before anything else — so a generation that's
    // still cooking when the tab closes or the user hits reset is still
    // recoverable from Recent Creations, not silently lost. Best-effort:
    // a save failure here shouldn't block the actual generation.
    let genId = null;
    try {
      const saved = await createBehindTheScenesGeneration({ ...input, status: "generating" });
      if (!isCurrent()) return;
      genId = saved.id;
      setGenerationId(genId);
    } catch (e) {
      console.error("[useBehindTheScenesJob] createBehindTheScenesGeneration failed:", e.message);
    }

    let imageJob;
    try {
      imageJob = await generateBehindTheScenesImage(input);
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
        updateBehindTheScenesGeneration(genId, { imageUrl, status: "generating" }).catch((e) =>
          console.error("[useBehindTheScenesJob] image save failed:", e.message)
        );
      }

      setVideoAttempts(1);
      await runVideoStep({ ...input, imageUrl }, genId, isCurrent, 1);
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
        updateBehindTheScenesGeneration(genId, { status: "failed" }).catch(() => {});
      }
    }
  }, [runVideoStep]);

  // "Try video again" — reuses the already-generated image and current
  // form values, so it only re-spends video credits, not image credits.
  const retryVideo = useCallback(() => {
    if (!result.imageUrl) return;
    const runId = ++runIdRef.current;
    const isCurrent = () => runIdRef.current === runId;
    const attemptNumber = videoAttempts + 1;
    setVideoAttempts(attemptNumber);
    setError(null);
    patch({ videoStatus: "queued", videoUrl: null });
    setPhase("video");
    void runVideoStep(
      {
        place: result.place,
        disaster: result.disaster,
        vantage: result.vantage,
        qualityId: result.qualityId,
        imageUrl: result.imageUrl,
      },
      generationId,
      isCurrent,
      attemptNumber,
    );
  }, [result, generationId, videoAttempts, runVideoStep]);

  const reset = useCallback(() => {
    runIdRef.current += 1;
    setPhase("idle");
    setResult(emptyResult());
    setError(null);
    setGenerationId(null);
    setVideoAttempts(0);
  }, []);

  // Reopening a saved/recovered generation — correctly reflects whatever
  // actually finished instead of always claiming "done". A row can be
  // fully complete, image-only (video failed or the tab closed before it
  // ran), or fully interrupted (closed before the image even finished) —
  // each needs different messaging and a different retry path.
  const showGeneration = useCallback((generation) => {
    runIdRef.current += 1;
    setError(null);
    setGenerationId(generation?.id ?? null);
    const hasImage = Boolean(generation?.imageUrl);
    const hasVideo = Boolean(generation?.videoUrl);
    setVideoAttempts(hasImage ? 1 : 0);
    setResult({
      ...emptyResult(generation),
      imageStatus: hasImage ? "succeeded" : "failed",
      videoStatus: hasVideo ? "succeeded" : "failed",
      imageUrl: generation?.imageUrl ?? null,
      videoUrl: generation?.videoUrl ?? null,
    });
    if (hasVideo) {
      setPhase("done");
    } else if (hasImage) {
      setPhase("error");
      setError("This episode's video never finished. Your image is still here — try the video again, or start a new episode.");
    } else {
      setPhase("error");
      setError("This generation didn't finish. Start a new episode.");
    }
  }, []);

  return { phase, result, error, generationId, videoAttempts, start, retryVideo, reset, showGeneration };
}
