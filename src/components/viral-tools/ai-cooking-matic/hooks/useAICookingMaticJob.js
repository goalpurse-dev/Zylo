import { useCallback, useRef, useState } from "react";
import { watchJob, cancelJob } from "../../../../lib/jobs";
import {
  generateCookingScene,
  extractIngredient,
  SCENE_TEMPLATES,
  VIBES,
} from "../api/cookingMaticApi";

const TERMINAL = new Set(["succeeded", "failed", "canceled"]);
const isTerminal = (s) => TERMINAL.has(s);

function resolveUrl(job) {
  const raw =
    job?.result_url ||
    job?.output?.result_url ||
    job?.output?.imageUrl ||
    job?.output?.image_url ||
    job?.output?.data?.[0]?.url ||
    job?.output?.results?.[0]?.url ||
    null;
  return raw && !raw.includes("localhost") ? raw.trim() : null;
}

function waitForJob(jobId, timeoutMs = 5 * 60 * 1000) {
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
});

export default function useAICookingMaticJob() {
  const [phase, setPhase]         = useState("idle");
  const [scenes, setScenes]       = useState([]);
  const [error, setError]         = useState(null);
  const [dishLabel, setDishLabel] = useState("");

  const cancelRef = useRef(false);
  const activeRef = useRef(false);
  const runIdRef  = useRef(0);

  const patchScene = (index, patch) =>
    setScenes((prev) => prev.map((s) => (s.index === index ? { ...s, ...patch } : s)));

  const start = useCallback(async ({ dishName, vibeId }) => {
    if (activeRef.current) return;
    activeRef.current = true;
    cancelRef.current = false;
    const runId = ++runIdRef.current;
    const isCurrentRun = () => !cancelRef.current && runIdRef.current === runId;

    const ingredient = extractIngredient(dishName);
    const vibe       = VIBES.find((v) => v.id === vibeId) ?? VIBES[0];
    const vibeToken  = vibe.token;

    setDishLabel(dishName);
    setScenes(Array.from({ length: 10 }, (_, i) => makeScene(i)));
    setError(null);
    setPhase("images");

    // imageResults[i] = { index: i, url: string|null }
    const imageResults = [];

    for (let i = 0; i < 10; i++) {
      if (!isCurrentRun()) break;

      patchScene(i, { imageStatus: "queued" });

      // Chaining logic:
      //  Scene 1 (i=0) → no reference (sets the style bible)
      //  Scenes 2-8 (i=1-7) → reference previous scene
      //  Scene 9 (i=8) → reference Scene 1 (keeps chef character)
      //  Scene 10 (i=9) → reference Scene 8 (beauty plate consistency)
      let refUrl = null;
      if (i === 0)      refUrl = null;
      else if (i === 8) refUrl = imageResults[0]?.url ?? null;
      else if (i === 9) refUrl = imageResults[7]?.url ?? null;
      else              refUrl = imageResults[i - 1]?.url ?? null;

      const prompt = SCENE_TEMPLATES[i](dishName, ingredient, vibeToken);

      let job, result;
      try {
        job = await generateCookingScene({ prompt, referenceUrl: refUrl });
        if (!isCurrentRun()) break;
        patchScene(i, { imageJobId: job.id, imageStatus: "running" });

        result = await waitForJob(job.id);
        if (!isCurrentRun()) break;

        if (result?.status === "succeeded") {
          const url = resolveUrl(result);
          imageResults.push({ index: i, url });
          patchScene(i, { imageStatus: "succeeded", imageUrl: url });
        } else {
          if (result === null && job?.id) cancelJob(job.id).catch(() => {});
          imageResults.push({ index: i, url: null });
          patchScene(i, { imageStatus: "failed" });
          if (isCurrentRun() && result?.error) {
            const errMsg = result.error;
            if (errMsg.includes("insufficientCredits") || errMsg.includes("Insufficient credits")) {
              setError("Image service ran out of credits. Please try again shortly.");
            }
          }
        }
      } catch (err) {
        console.error(`[CookingMatic] Scene ${i + 1} failed:`, err);
        imageResults.push({ index: i, url: null });
        patchScene(i, { imageStatus: "failed" });
        if (isCurrentRun() && !cancelRef.current) {
          const msg = err?.message ?? String(err);
          if (msg.includes("INSUFFICIENT_CREDITS") || msg.includes("insufficientCredits")) {
            setError("Not enough credits to continue generating.");
          } else if (msg.includes("402") || msg.includes("Insufficient credits")) {
            setError("Image service temporarily unavailable. Please try again shortly.");
          }
        }
      }
    }

    if (isCurrentRun()) setPhase("done");
    activeRef.current = false;
  }, []);

  const reset = useCallback(() => {
    cancelRef.current = true;
    activeRef.current = false;
    setPhase("idle");
    setScenes([]);
    setError(null);
    setDishLabel("");
  }, []);

  const showGeneration = useCallback((generation) => {
    if (!generation) return;
    const saved = Array.isArray(generation.scenes) ? generation.scenes : [];
    const filled = Array.from({ length: 10 }, (_, i) => {
      const found = saved.find((s) => s.index === i);
      return found
        ? { ...makeScene(i), imageStatus: "succeeded", imageUrl: found.imageUrl }
        : makeScene(i);
    });
    setDishLabel(generation.dish_name ?? "");
    setScenes(filled);
    setPhase("done");
  }, []);

  return { phase, scenes, error, dishLabel, start, reset, showGeneration };
}
