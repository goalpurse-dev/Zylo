import { useCallback, useRef, useState } from "react";
import { cancelJob, getJob, runWorkerForJob, watchJob } from "../../../../lib/jobs";
import {
  createTwoAmPlan,
  getTwoAmGeneration,
  mapTwoAmGeneration,
  regenerateTwoAmScene,
  settleTwoAmGeneration,
  TWO_AM_TOTAL_CREDITS,
  updateTwoAmGeneration,
} from "../api/twoAmApi";

const TERMINAL = new Set(["succeeded", "failed", "canceled"]);

function jobProgress(row) {
  if (TERMINAL.has(row?.status)) return 100;
  const value = Number(row?.progress ?? 0);
  return Number.isFinite(value) ? Math.max(0, Math.min(99, Math.round(value))) : 0;
}

function resolveUrl(job) {
  const raw = job?.result_url || job?.resultUrl || job?.output?.result_url || job?.output?.resultUrl ||
    job?.output?.imageURL || job?.output?.imageUrl || job?.output?.image_url ||
    job?.output?.data?.[0]?.imageURL || job?.output?.data?.[0]?.imageUrl ||
    job?.output?.data?.[0]?.image_url || job?.output?.data?.[0]?.url ||
    job?.output?.results?.[0]?.imageURL || job?.output?.results?.[0]?.imageUrl ||
    job?.output?.results?.[0]?.image_url || job?.output?.results?.[0]?.url;
  return typeof raw === "string" && !raw.includes("localhost") ? raw.trim() : null;
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function reconcileTerminalJob(row) {
  if (!row || row.status !== "succeeded" || resolveUrl(row)) return row;

  let fresh = row;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await delay(350 + attempt * 150);
    try {
      fresh = await getJob(row.id);
      if (resolveUrl(fresh)) return fresh;
    } catch {
      // A realtime terminal event can briefly arrive before its row is
      // readable through the REST endpoint. Keep reconciling for a moment.
    }
  }
  return fresh;
}

function waitForJob(jobId, onChange, timeoutMs = 6 * 60 * 1000) {
  return new Promise((resolve) => {
    let settled = false;
    let unsubscribe;
    const finish = (row) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { unsubscribe?.(); } catch {
        // The realtime channel may already have closed after a terminal row.
      }
      resolve(row);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    unsubscribe = watchJob(jobId, (row) => {
      onChange?.(row);
      if (TERMINAL.has(row.status)) finish(row);
    });
  });
}

export default function useTwoAmGeneration() {
  const [phase, setPhase] = useState("idle");
  const [plannerStage, setPlannerStage] = useState(0);
  const [scenes, setScenes] = useState([]);
  const [generation, setGeneration] = useState(null);
  const [error, setError] = useState(null);
  const activeRef = useRef(false);
  const runIdRef = useRef(0);
  const scenesRef = useRef([]);
  const generationRef = useRef(null);

  const replaceScenes = useCallback((updater) => {
    setScenes((previous) => {
      const next = typeof updater === "function" ? updater(previous) : updater;
      scenesRef.current = next;
      return next;
    });
  }, []);

  const patchScene = useCallback((index, patch) => {
    replaceScenes((previous) => previous.map((scene, sceneIndex) => sceneIndex === index ? { ...scene, ...patch } : scene));
  }, [replaceScenes]);

  const start = useCallback(async ({ prompt, settings }) => {
    if (activeRef.current) return;
    activeRef.current = true;
    const runId = ++runIdRef.current;
    const current = () => runId === runIdRef.current;
    setError(null);
    setGeneration(null);
    generationRef.current = null;
    replaceScenes([]);
    setPhase("planning");
    setPlannerStage(0);
    const stageTimer = setInterval(() => setPlannerStage((stage) => Math.min(2, stage + 1)), 1800);

    try {
      const plan = await createTwoAmPlan({ prompt, settings });
      clearInterval(stageTimer);
      if (!current()) return;
      const mapped = mapTwoAmGeneration(plan.generation);
      // Keep the server's settings (mapped.settings already reflects
      // plan.generation.settings) rather than overwriting with the client's
      // requested settings — two-am-planner clamps settings.quality down to
      // whatever the user's plan actually allows, and the regenerate path
      // relies on that clamped value being the one stored here.
      mapped.scenes = plan.scenes.map((scene) => ({ ...scene, progress: 0 }));
      generationRef.current = mapped;
      setGeneration(mapped);
      replaceScenes(mapped.scenes);
      setPhase("generating");

      const terminalScenes = await Promise.all(mapped.scenes.map(async (scene, index) => {
        const watchedResult = await waitForJob(scene.jobId, (row) => {
          if (!current()) return;
          const status = row.status === "succeeded" ? "completed" : row.status === "failed" || row.status === "canceled" ? "failed" : "generating";
          patchScene(index, { status, progress: jobProgress(row) });
        });
        const result = await reconcileTerminalJob(watchedResult);
        if (!current()) return null;
        const imageUrl = result?.status === "succeeded" ? resolveUrl(result) : null;
        const terminalScene = {
          ...scene,
          status: imageUrl ? "completed" : "failed",
          progress: 100,
          imageUrl,
          error: imageUrl ? null : (result?.error || "Scene generation failed"),
        };
        patchScene(index, terminalScene);
        if (!result && scene.jobId) cancelJob(scene.jobId).catch(() => {});
        return terminalScene;
      }));

      if (!current()) return;
      const finishedScenes = terminalScenes.map((scene, index) => scene ?? scenesRef.current[index] ?? mapped.scenes[index]);
      replaceScenes(finishedScenes);
      const completed = finishedScenes.filter((scene) => scene.status === "completed" && scene.imageUrl).length;
      const status = completed === 6 ? "completed" : completed > 0 ? "partial" : "failed";
      await updateTwoAmGeneration(mapped.id, { scenes: finishedScenes, status });
      await settleTwoAmGeneration(mapped.id, completed);
      const finishedGeneration = { ...mapped, scenes: finishedScenes, status };
      generationRef.current = finishedGeneration;
      setGeneration(finishedGeneration);
      setPhase(completed ? "done" : "error");
      if (!completed) setError(`The image provider could not create this night. Your ${mapped.reservedCredits ?? TWO_AM_TOTAL_CREDITS} credits were refunded.`);
    } catch (caught) {
      clearInterval(stageTimer);
      if (!current()) return;
      const message = String(caught?.message || caught);
      setError(message.includes("INSUFFICIENT_CREDITS") ? "INSUFFICIENT_CREDITS" : message || "Could not create your 2AM world");
      setPhase("error");
    } finally {
      if (current()) activeRef.current = false;
    }
  }, [patchScene, replaceScenes]);

  const regenerateScene = useCallback(async (index) => {
    const currentGeneration = generationRef.current;
    const scene = scenesRef.current[index];
    if (!currentGeneration || !scene || scene.status === "generating") return;
    patchScene(index, { status: "generating", progress: 0, error: null });
    try {
      const job = await regenerateTwoAmScene({
        worldBible: currentGeneration.worldBible,
        scene,
        randomSeed: currentGeneration.randomSeed,
        settings: currentGeneration.settings,
      });
      patchScene(index, { jobId: job.id });
      const watchedResult = await waitForJob(job.id, (row) => {
        const status = row.status === "succeeded" ? "completed" : row.status === "failed" || row.status === "canceled" ? "failed" : "generating";
        patchScene(index, { status, progress: jobProgress(row) });
      });
      const result = await reconcileTerminalJob(watchedResult);
      const imageUrl = result?.status === "succeeded" ? resolveUrl(result) : null;
      patchScene(index, { status: imageUrl ? "completed" : "failed", progress: 100, imageUrl: imageUrl || scene.imageUrl, error: imageUrl ? null : (result?.error || "Regeneration failed") });
    } catch (caught) {
      const message = String(caught?.message || caught);
      patchScene(index, { status: "completed", imageUrl: scene.imageUrl, error: message.includes("INSUFFICIENT_CREDITS") ? "Not enough credits to regenerate" : message });
    } finally {
      const nextScenes = scenesRef.current;
      await updateTwoAmGeneration(currentGeneration.id, { scenes: nextScenes }).catch(() => {});
      const nextGeneration = { ...currentGeneration, scenes: nextScenes };
      generationRef.current = nextGeneration;
      setGeneration(nextGeneration);
    }
  }, [patchScene]);

  const showGeneration = useCallback(async (row) => {
    const runId = ++runIdRef.current;
    const current = () => runId === runIdRef.current;
    activeRef.current = false;
    let mapped = mapTwoAmGeneration(row);

    const reconcileScenesFromJobs = async (candidate) => {
      const jobRows = await Promise.all(candidate.scenes.map(async (scene) => {
        if (!scene.jobId) return null;
        try { return await getJob(scene.jobId); }
        catch { return null; }
      }));
      const syncedScenes = candidate.scenes.map((scene, index) => {
        const job = jobRows[index];
        if (!job) return scene;
        const imageUrl = resolveUrl(job);
        if (job.status === "succeeded" && imageUrl) {
          return { ...scene, status: "completed", progress: 100, imageUrl, error: null };
        }
        if (job.status === "failed" || job.status === "canceled") {
          return { ...scene, status: "failed", progress: 100, error: job.error || "Scene generation failed" };
        }
        return { ...scene, status: job.status === "queued" ? "queued" : "generating", progress: jobProgress(job) };
      });
      const terminal = syncedScenes.every((scene) => ["completed", "failed"].includes(scene.status));
      if (!terminal) return { ...candidate, scenes: syncedScenes };

      const completed = syncedScenes.filter((scene) => scene.status === "completed" && scene.imageUrl).length;
      const status = completed === 6 ? "completed" : completed > 0 ? "partial" : "failed";
      await updateTwoAmGeneration(candidate.id, { scenes: syncedScenes, status }).catch(() => {});
      await settleTwoAmGeneration(candidate.id, completed).catch(() => {});
      return { ...candidate, scenes: syncedScenes, status };
    };

    mapped = await reconcileScenesFromJobs(mapped);
    generationRef.current = mapped;
    setGeneration(mapped);
    replaceScenes(mapped.scenes);
    setError(null);

    const hasPendingScenes = () => mapped.scenes.some((scene) =>
      scene.jobId && !["completed", "failed"].includes(String(scene.status))
    );

    if (!["planning", "generating"].includes(mapped.status) && !hasPendingScenes()) {
      setPhase(mapped.status === "failed" ? "error" : "done");
      return;
    }

    activeRef.current = true;
    setPhase("generating");
    const recoverableJobs = mapped.scenes
      .filter((scene) =>
        scene.jobId &&
        !["completed", "failed"].includes(String(scene.status)),
      )
      .map((scene) => scene.jobId);
    await Promise.allSettled(
      recoverableJobs.map((jobId) => runWorkerForJob(jobId, true)),
    );

    while (current() && (["planning", "generating"].includes(mapped.status) || hasPendingScenes())) {
      await delay(1500);
      try {
        mapped = mapTwoAmGeneration(await getTwoAmGeneration(mapped.id));
        mapped = await reconcileScenesFromJobs(mapped);
        if (!current()) return;
        generationRef.current = mapped;
        setGeneration(mapped);
        replaceScenes(mapped.scenes);
      } catch {
        // Keep the last synchronized generation visible through a transient
        // network error; the next poll can recover it.
      }
    }

    if (!current()) return;
    activeRef.current = false;
    setPhase(mapped.status === "failed" ? "error" : "done");
    if (mapped.status === "failed") {
      setError(`The image provider could not create this night. Your ${mapped.reservedCredits ?? TWO_AM_TOTAL_CREDITS} credits were refunded.`);
    }
  }, [replaceScenes]);

  const reset = useCallback(() => {
    runIdRef.current += 1;
    activeRef.current = false;
    generationRef.current = null;
    scenesRef.current = [];
    setGeneration(null);
    setScenes([]);
    setError(null);
    setPlannerStage(0);
    setPhase("idle");
  }, []);

  return { phase, plannerStage, scenes, generation, error, start, regenerateScene, showGeneration, reset };
}
