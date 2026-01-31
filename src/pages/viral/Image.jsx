import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { watchJob } from "../../lib/jobs";
import Footer from "../../components/myproduct/footer.jsx";

import Generate from "../../components/ImageGenerator/Generate.jsx";
import Inspiration from "../../components/ImageGenerator/Inspiration.jsx";
import Result from "../../components/ImageGenerator/Result.jsx";

/* ===============================
   HEARTBEAT CONFIG
================================ */
const HEARTBEAT_MAX = 95;
const HEARTBEAT_INTERVAL = 800;

/**
 * Progress curve:
 * 0–70   : fast
 * 70–90  : medium
 * 90–95  : slow
 */
function getHeartbeatStep(p) {
  if (p < 70) return 3;
  if (p < 90) return 1.2;
  if (p < 95) return 0.3;
  return 0;
}

/* 🔒 Force numeric always */
const toNum = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export default function Image() {
  const [prompt, setPrompt] = useState("");
  const [results, setResults] = useState([]);

  const inspirationRef = useRef(null);
  const watchersRef = useRef({});

  /* ===============================
     UPSERT JOB (MONOTONIC)
     Backend can ONLY jump forward
  =============================== */
  const upsertJob = (row) => {
    if (!row?.id) return;

    setResults((prev) => {
      const idx = prev.findIndex((j) => j.id === row.id);

      // New job
      if (idx === -1) {
        return [
          {
            ...row,
            progress: toNum(row.progress, 0),
          },
          ...prev,
        ].slice(0, 40);
      }

      const next = [...prev];
      const prevJob = next[idx];

      const backendProgress = toNum(row.progress, 0);
      const uiProgress = toNum(prevJob.progress, 0);

      next[idx] = {
        ...prevJob,
        ...row,
        progress: Math.max(uiProgress, backendProgress), // 🔒 NEVER BACK
      };

      next.sort(
        (a, b) =>
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
      );

      return next.slice(0, 40);
    });
  };

  /* ===============================
     OPTIMISTIC INSERT + WATCH
  =============================== */
  const addOptimisticJob = (job) => {
    if (!job?.id) return;

    upsertJob({ ...job, progress: 0 });

    watchersRef.current[job.id] = watchJob(job.id, (updated) => {
      upsertJob(updated);

      if (
        updated.status === "succeeded" ||
        updated.status === "failed" ||
        updated.status === "canceled"
      ) {
        watchersRef.current[job.id]?.();
        delete watchersRef.current[job.id];
      }
    });
  };

  /* ===============================
     LOAD EXISTING CREATIONS
  =============================== */
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data?.user?.id;
      if (!uid) return;

      const { data: jobs } = await supabase
        .from("jobs")
        .select(
          "id, prompt, input, settings, result_url, created_at, status, progress"
        )
        .eq("user_id", uid)
        .eq("type", "image")
        .eq("settings->>creation_type", "photo")
        .order("created_at", { ascending: false })
        .limit(40);

      setResults(
        (jobs ?? []).map((j) => ({
          ...j,
          progress: toNum(j.progress, 0),
        }))
      );
    })();
  }, []);

  /* ===============================
     RE-ATTACH WATCHERS
  =============================== */
  useEffect(() => {
    results.forEach((job) => {
      if (
        ["queued", "running", "processing"].includes(job.status) &&
        !watchersRef.current[job.id]
      ) {
        watchersRef.current[job.id] = watchJob(job.id, upsertJob);
      }
    });
  }, [results]);

  /* ===============================
     HEARTBEAT (ABSOLUTE DOMINANCE)
     This CANNOT get stuck
  =============================== */
  useEffect(() => {
    const interval = setInterval(() => {
      setResults((prev) =>
        prev.map((job) => {
          // Stop immediately if finished
          if (job.result_url || job.status === "succeeded") return job;

          if (!["queued", "running", "processing"].includes(job.status)) {
            return job;
          }

          const p = toNum(job.progress, 0);
          if (p >= HEARTBEAT_MAX) return job;

          const step = getHeartbeatStep(p);

          return {
            ...job,
            progress: Math.min(p + step, HEARTBEAT_MAX),
            _uiTick: Date.now(),
          };
        })
      );
    }, HEARTBEAT_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  /* ===============================
     CLEANUP WATCHERS
  =============================== */
  useEffect(() => {
    return () => {
      Object.values(watchersRef.current).forEach((unsub) => {
        try {
          unsub();
        } catch {}
      });
      watchersRef.current = {};
    };
  }, []);

  /* ===============================
     SEND PROMPT FROM RESULT
  =============================== */
  const sendPromptToGenerator = (p) => {
    setPrompt(p);
    inspirationRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  };

  /* ===============================
     RENDER
  =============================== */
  return (
    <div className="w-full min-h-screen bg-[#F7F5FA]">
      <Generate
        prompt={prompt}
        setPrompt={setPrompt}
        onJobCreated={addOptimisticJob}
      />

      {results.length > 0 && (
        <div className="mt-10">
          <Result
            results={results}
            onCopyPrompt={(p) => navigator.clipboard.writeText(p)}
            onRegenerate={(p) => sendPromptToGenerator(p)}
          />
        </div>
      )}

      <div className="mt-10" ref={inspirationRef}>
        <Inspiration prompt={prompt} setPrompt={setPrompt} />
      </div>

           <Footer />
    </div>
  );
}
