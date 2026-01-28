import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

import Generate from "../../components/ImageGenerator/Generate.jsx";
import Inspiration from "../../components/ImageGenerator/Inspiration.jsx";
import Result from "../../components/ImageGenerator/Result.jsx";

export default function Image() {
  const [prompt, setPrompt] = useState("");
  const [results, setResults] = useState([]);
  const [userId, setUserId] = useState(null);

  const inspirationRef = useRef(null);

  /* ===============================
     LOAD EXISTING RESULTS
     =============================== */
  const loadResults = async (uid) => {
    const { data, error } = await supabase
      .from("jobs")
      .select(
        "id, prompt, input, settings, result_url, created_at, status, progress"
      )
      .eq("user_id", uid)
      .eq("type", "image")
      .eq("settings->>creation_type", "photo")
      .order("created_at", { ascending: false })
      .limit(40);

    if (!error) setResults(data ?? []);
  };

  /* ===============================
     UPSERT JOB INTO STATE
     =============================== */
  const upsertJob = (row) => {
    if (!row?.id) return;

    setResults((prev) => {
      const idx = prev.findIndex((x) => x.id === row.id);

      // new job (or optimistic placeholder)
      if (idx === -1) {
        return [row, ...prev].slice(0, 40);
      }

      // merge update
      const next = [...prev];
      next[idx] = { ...next[idx], ...row };

      // keep newest first
      next.sort(
        (a, b) =>
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
      );

      return next.slice(0, 40);
    });
  };

  /* ===============================
     OPTIMISTIC INSERT
     =============================== */
  const addOptimisticJob = (jobRow) => {
    upsertJob(jobRow);
  };

  /* ===============================
     SEND PROMPT FROM RESULTS
     =============================== */
  const sendPromptToGenerator = (p) => {
    setPrompt(p);
    inspirationRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  };

  /* ===============================
     PAGE META
     =============================== */
useEffect(() => {
  let channel;

  (async () => {
    const { data } = await supabase.auth.getUser();
    const uid = data?.user?.id;
    if (!uid) return;

    // initial load
    const { data: jobs } = await supabase
      .from("jobs")
      .select("*")
      .eq("user_id", uid)
      .eq("type", "image")
      .order("created_at", { ascending: false })
      .limit(40);

    setResults(jobs ?? []);

    // 🔴 REALTIME
    channel = supabase
      .channel(`jobs-progress-${uid}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "jobs",
          filter: `user_id=eq.${uid}`,
        },
        (payload) => {
          const updated = payload.new;
          if (updated.type !== "image") return;

          // ✅ force React repaint
         setResults((prev) =>
  prev.map((job) =>
    job.id === updated.id
      ? {
          ...job,
          ...updated,
          _rt: Date.now(), // 👈 force React diff
        }
      : job
  )
);;
        }
      )
      .subscribe();
  })();

  return () => {
    if (channel) supabase.removeChannel(channel);
  };
}, []);

/* ===============================
   LOCAL PROGRESS HEARTBEAT
   =============================== */
useEffect(() => {
  const interval = setInterval(() => {
    setResults((prev) =>
      prev.map((job) => {
        if (
          job.status === "running" &&
          typeof job.progress === "number" &&
          job.progress < 95
        ) {
          return {
            ...job,
            progress: Math.min(job.progress + 1, 95),
            _tick: Date.now(),
          };
        }
        return job;
      })
    );
  }, 1200); // smooth, matches backend polling

  return () => clearInterval(interval);
}, []);


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
    </div>
  );
}
