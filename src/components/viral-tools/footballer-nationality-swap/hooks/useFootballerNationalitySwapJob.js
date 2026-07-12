import { useCallback, useRef, useState } from "react";
import { watchJob, cancelJob } from "../../../../lib/jobs";
import {
  buildImagePrompt,
  buildVideoPrompt,
  fetchFootballerIdentity,
  generateFootballerImage,
  animateFootballerClip,
} from "../api/footballerNationalitySwapApi";

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

async function resolveIdentity(si) {
  const hasFullOverride = si.customName?.trim() && si.customJersey?.trim() && si.customLine?.trim();
  if (hasFullOverride) {
    return {
      localizedName: si.customName.trim(),
      jerseyNumber:  si.customJersey.trim(),
      spokenLine:    si.customLine.trim(),
      language:      "Custom",
    };
  }
  const identity = await fetchFootballerIdentity({ footballer: si.footballer, nationality: si.nationality });
  return {
    localizedName: si.customName?.trim()   || identity.localizedName,
    jerseyNumber:  si.customJersey?.trim() || identity.jerseyNumber,
    spokenLine:    si.customLine?.trim()   || identity.spokenLine,
    language:      identity.language,
  };
}

const makeScene = (i, si = {}) => ({
  index: i,
  footballer:  si.footballer ?? "",
  nationality: si.nationality ?? "",
  expression:  si.expression ?? "confident",
  videoStyle:  si.videoStyle ?? "stadium-tunnel",

  identityStatus: "idle", localizedName: null, jerseyNumber: null, spokenLine: null, language: null,
  imageJobId: null, imageStatus: "idle", imageUrl: null,
  videoJobId: null, videoStatus: "idle", videoUrl: null,
});

export default function useFootballerNationalitySwapJob() {
  const [phase,  setPhase]  = useState("idle");
  const [scenes, setScenes] = useState([]);
  const [error,  setError]  = useState(null);

  const cancelRef = useRef(false);
  const activeRef = useRef(false);
  const runIdRef  = useRef(0);
  // Always-fresh mirror of `scenes` so retryScene never reads a stale closure
  const scenesRef = useRef([]);

  const patchScene = (index, patch) =>
    setScenes((prev) => {
      const next = prev.map((s) => (s.index === index ? { ...s, ...patch } : s));
      scenesRef.current = next;
      return next;
    });

  const start = useCallback(async ({ sceneInputs }) => {
    if (activeRef.current) return;
    activeRef.current = true;
    cancelRef.current = false;
    const runId = ++runIdRef.current;
    const isCurrentRun = () => !cancelRef.current && runIdRef.current === runId;

    const initial = sceneInputs.map((si, i) => makeScene(i, si));
    scenesRef.current = initial;
    setScenes(initial);
    setError(null);
    setPhase("images");

    // ── Each scene runs its own identity + image → video pipeline independently.
    //    Scenes start staggered by SCENE_STAGGER_MS to avoid simultaneous API bursts.
    const sceneResultSettled = await Promise.allSettled(
      sceneInputs.map(async (si, i) => {
        await delay(i * SCENE_STAGGER_MS);
        if (!isCurrentRun()) throw new Error("cancelled");

        patchScene(i, { identityStatus: "queued", imageStatus: "queued" });

        // Identity (name / jersey / spoken line) and the portrait image are
        // independent of each other — run them concurrently.
        const identityPromise = (async () => {
          patchScene(i, { identityStatus: "running" });
          try {
            const identity = await resolveIdentity(si);
            if (!isCurrentRun()) return null;
            patchScene(i, { identityStatus: "succeeded", ...identity });
            return identity;
          } catch (e) {
            console.warn(`[Footballer] scene ${i} identity failed`, e);
            if (isCurrentRun()) patchScene(i, { identityStatus: "failed" });
            return null;
          }
        })();

        const imagePromise = (async () => {
          const imagePrompt = buildImagePrompt(si);
          let imageJob, imageResult;
          try {
            imageJob = await generateFootballerImage({ imagePrompt });
            if (!isCurrentRun()) throw new Error("cancelled");
            patchScene(i, { imageJobId: imageJob.id, imageStatus: "running" });
            imageResult = await waitForJob(imageJob.id, undefined, () => {
              patchScene(i, { imageStatus: "retrying" });
            });
            if (isCurrentRun()) patchScene(i, { imageStatus: "running" });
          } catch (err) {
            if (err.message === "cancelled") throw err;
            console.warn(`[Footballer] scene ${i} image failed`, err);
          }
          if (!isCurrentRun()) throw new Error("cancelled");

          const imageUrl = imageResult?.status === "succeeded" ? resolveUrl(imageResult) : null;
          if (!imageUrl) {
            if (imageResult === null && imageJob?.id) cancelJob(imageJob.id).catch(() => {});
            patchScene(i, { imageStatus: "failed" });
            return null;
          }
          patchScene(i, { imageStatus: "succeeded", imageUrl });
          return imageUrl;
        })();

        const [identity, imageUrl] = await Promise.all([identityPromise, imagePromise]);
        if (!isCurrentRun()) throw new Error("cancelled");
        if (!imageUrl) throw new Error(`scene ${i}: image failed`);

        return {
          index: i,
          imageUrl,
          spokenLine: identity?.spokenLine ?? `Hi, I'm the new number for ${si.nationality}.`,
          expression: si.expression,
          videoStyle: si.videoStyle,
        };
      })
    );

    if (!isCurrentRun()) return;

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

    const videoJobSettled = await Promise.allSettled(
      imageResults.map(({ imageUrl, spokenLine, expression, videoStyle }) =>
        animateFootballerClip({ imageUrl, videoPrompt: buildVideoPrompt({ spokenLine, expression, videoStyle }) })
      )
    );

    if (!isCurrentRun()) return;

    videoJobSettled.forEach((settled, i) => {
      const { index } = imageResults[i];
      if (settled.status === "fulfilled") {
        patchScene(index, { videoJobId: settled.value.id, videoStatus: "running" });
      } else {
        console.error(`[Footballer] video submission failed scene ${imageResults[i].index}`, settled.reason);
        patchScene(index, { videoStatus: "failed" });
      }
    });

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
   * - identityStatus/imageStatus failed → redo identity + image + video
   * - videoStatus failed (but image ok) → redo video only using existing imageUrl
   */
  const retryScene = useCallback(async (sceneIndex) => {
    const scene = scenesRef.current.find((s) => s.index === sceneIndex);
    if (!scene) return;

    const videoFailed = scene.videoStatus === "failed" && scene.imageUrl;
    const needsFull    = scene.imageStatus === "failed" || scene.identityStatus === "failed";
    if (!videoFailed && !needsFull) return;

    setPhase("videos"); // keeps the results panel in "active" mode

    const patchOne = (patch) =>
      setScenes((prev) => {
        const next = prev.map((s) => (s.index === sceneIndex ? { ...s, ...patch } : s));
        scenesRef.current = next;
        return next;
      });

    if (videoFailed && !needsFull) {
      patchOne({ videoStatus: "queued", videoJobId: null, videoUrl: null });
      let videoJob;
      try {
        const videoPrompt = buildVideoPrompt({
          spokenLine: scene.spokenLine,
          expression: scene.expression,
          videoStyle: scene.videoStyle,
        });
        videoJob = await animateFootballerClip({ imageUrl: scene.imageUrl, videoPrompt });
        patchOne({ videoJobId: videoJob.id, videoStatus: "running" });
      } catch (e) {
        console.error("[retryScene] video job submission failed:", e);
        patchOne({ videoStatus: "failed" });
        setPhase("done");
        return;
      }

      const result = await waitForJob(videoJob.id, 6 * 60 * 1000);
      const url = resolveUrl(result);
      patchOne({
        videoStatus: result?.status === "succeeded" && url ? "succeeded" : "failed",
        videoUrl:    url ?? null,
      });
    } else {
      patchOne({
        identityStatus: "queued", imageStatus: "queued", videoStatus: "idle",
        imageUrl: null, videoUrl: null, imageJobId: null, videoJobId: null,
      });

      setPhase("images");

      let identity = null;
      try {
        identity = await resolveIdentity(scene);
        patchOne({ identityStatus: "succeeded", ...identity });
      } catch {
        patchOne({ identityStatus: "failed" });
      }

      const imagePrompt = buildImagePrompt(scene);
      let imageJob, imageResult;
      try {
        imageJob = await generateFootballerImage({ imagePrompt });
        patchOne({ imageJobId: imageJob.id, imageStatus: "running" });
        imageResult = await waitForJob(imageJob.id);
      } catch { patchOne({ imageStatus: "failed" }); setPhase("done"); return; }

      const imageUrl = imageResult?.status === "succeeded" ? resolveUrl(imageResult) : null;
      if (!imageUrl) { patchOne({ imageStatus: "failed" }); setPhase("done"); return; }
      patchOne({ imageStatus: "succeeded", imageUrl });

      setPhase("videos");

      let videoJob;
      try {
        const videoPrompt = buildVideoPrompt({
          spokenLine: identity?.spokenLine ?? scene.spokenLine,
          expression: scene.expression,
          videoStyle: scene.videoStyle,
        });
        videoJob = await animateFootballerClip({ imageUrl, videoPrompt });
        patchOne({ videoJobId: videoJob.id, videoStatus: "running" });
      } catch { patchOne({ videoStatus: "failed" }); setPhase("done"); return; }

      const result = await waitForJob(videoJob.id, 6 * 60 * 1000);
      const url = resolveUrl(result);
      patchOne({
        videoStatus: result?.status === "succeeded" && url ? "succeeded" : "failed",
        videoUrl:    url ?? null,
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
    setScenes(
      (generation?.scenes || [])
        .filter((s) => s.imageUrl || s.videoUrl)
        .map((s, i) => ({
          index: s.index ?? i,
          footballer:  s.footballer ?? "",
          nationality: s.nationality ?? "",
          expression:  s.expression ?? "confident",
          videoStyle:  s.videoStyle ?? "stadium-tunnel",
          identityStatus: "succeeded",
          localizedName: s.localizedName ?? "",
          jerseyNumber:  s.jerseyNumber ?? "",
          spokenLine:    s.spokenLine ?? "",
          language: null,
          imageJobId: null, imageStatus: s.imageUrl ? "succeeded" : "failed", imageUrl: s.imageUrl ?? null,
          videoJobId: null, videoStatus: s.videoUrl ? "succeeded" : "failed", videoUrl: s.videoUrl ?? null,
        }))
    );
    setPhase("done");
  }, []);

  return { phase, scenes, error, start, reset, showGeneration, retryScene };
}
