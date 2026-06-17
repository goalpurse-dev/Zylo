import { useCallback, useRef, useState } from "react";
import { watchJob, cancelJob } from "../../../../lib/jobs";
import {
  generateCookingScene,
  generateCookingSceneFallback,
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

// Is the error a Runware-side balance failure?
// Both primary and fallback share the same API key, so a balance error on
// primary means the fallback would also fail — don't bother trying.
function isRunwareBalanceError(msg) {
  return (
    msg.includes("insufficientCredits") ||
    msg.includes("Insufficient credits") ||
    msg.includes("402")
  );
}

// Is this an internal-app credit check failure?
// Thrown by createImageJobSimple before any Runware call is made.
function isInternalCreditError(msg) {
  return msg.includes("INSUFFICIENT_CREDITS") || msg.includes("LOCKED_GENERATOR");
}

const makeScene = (i) => ({
  index: i,
  imageJobId: null,
  imageStatus: "idle",
  imageUrl: null,
});

// Primary timeout: GPT Image 2 normally completes in <30s — 3min covers
// any Runware-side queuing without blocking the whole generation forever.
const PRIMARY_TIMEOUT_MS  = 3 * 60 * 1000;
// Fallback timeout: Nano Banana 2 is much faster (~10-15s).
const FALLBACK_TIMEOUT_MS = 2 * 60 * 1000;

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

    // imageResults[i] = { index: i, url: string|null }  — used for scene chaining
    const imageResults = [];

    for (let i = 0; i < 10; i++) {
      if (!isCurrentRun()) break;

      patchScene(i, { imageStatus: "queued" });

      // Scene chaining:
      //  Scene 1 (i=0) → no ref (style bible)
      //  Scenes 2–8 (i=1–7) → previous scene
      //  Scene 9 (i=8) → Scene 1 (chef character continuity)
      //  Scene 10 (i=9) → Scene 8 (beauty plate)
      let refUrl = null;
      if      (i === 0) refUrl = null;
      else if (i === 8) refUrl = imageResults[0]?.url ?? null;
      else if (i === 9) refUrl = imageResults[7]?.url ?? null;
      else              refUrl = imageResults[i - 1]?.url ?? null;

      const prompt = SCENE_TEMPLATES[i](dishName, ingredient, vibeToken);

      // ── PRIMARY: GPT Image 2 ──────────────────────────────────────────────
      let sceneSucceeded = false;
      let skipFallback   = false;  // true when fallback is known to be futile
      let primaryJobId   = null;

      try {
        const job = await generateCookingScene({ prompt, referenceUrl: refUrl });
        primaryJobId = job.id;
        if (!isCurrentRun()) break;
        patchScene(i, { imageJobId: job.id, imageStatus: "running" });

        const result = await waitForJob(job.id, PRIMARY_TIMEOUT_MS);
        if (!isCurrentRun()) break;

        if (result?.status === "succeeded") {
          const url = resolveUrl(result);
          imageResults.push({ index: i, url });
          patchScene(i, { imageStatus: "succeeded", imageUrl: url });
          sceneSucceeded = true;
        } else {
          // Timed out — cancel the Supabase job record so credits aren't charged later
          if (!result && primaryJobId) cancelJob(primaryJobId).catch(() => {});

          const errMsg = result?.error ?? "";
          if (isRunwareBalanceError(errMsg)) {
            // Fallback uses the same Runware API key — it will also fail
            if (isCurrentRun()) setError("Image service ran out of credits. Please try again shortly.");
            skipFallback = true;
          }
        }
      } catch (err) {
        const msg = String(err?.message ?? err);
        if (isInternalCreditError(msg)) {
          // Internal app credits depleted — stop everything
          if (isCurrentRun()) setError("Not enough credits to generate.");
          imageResults.push({ index: i, url: null });
          patchScene(i, { imageStatus: "failed" });
          break;
        }
        // Other primary errors (network, model error, etc.) → try fallback
      }

      if (!isCurrentRun()) break;
      if (sceneSucceeded) continue; // ✓ primary worked — next scene

      if (skipFallback) {
        // Balance error: no point continuing — mark scene & stop
        imageResults.push({ index: i, url: null });
        patchScene(i, { imageStatus: "failed" });
        break;
      }

      // ── FALLBACK: Nano Banana 2 (no ref images, faster) ─────────────────
      patchScene(i, { imageStatus: "queued" });
      try {
        const fbJob = await generateCookingSceneFallback({ prompt });
        if (!isCurrentRun()) break;
        patchScene(i, { imageJobId: fbJob.id, imageStatus: "running" });

        const fbResult = await waitForJob(fbJob.id, FALLBACK_TIMEOUT_MS);
        if (!isCurrentRun()) break;

        if (fbResult?.status === "succeeded") {
          const url = resolveUrl(fbResult);
          imageResults.push({ index: i, url });
          patchScene(i, { imageStatus: "succeeded", imageUrl: url });
        } else {
          if (!fbResult && fbJob?.id) cancelJob(fbJob.id).catch(() => {});
          imageResults.push({ index: i, url: null });
          patchScene(i, { imageStatus: "failed" });
        }
      } catch {
        // Fallback itself failed — mark scene as failed and keep going
        imageResults.push({ index: i, url: null });
        patchScene(i, { imageStatus: "failed" });
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
