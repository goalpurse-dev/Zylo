// useJobProgress.ts
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export function useJobProgress(jobId: string | null) {
  const [serverProgress, setServerProgress] = useState(0);  // from DB
  const [displayProgress, setDisplayProgress] = useState(0); // smoothed
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (!jobId) return;

    // initial fetch
    (async () => {
      const { data } = await supabase
        .from("jobs")
        .select("progress")
        .eq("id", jobId)
        .single();
      if (data?.progress != null) {
        setServerProgress(Number(data.progress) || 0);
        setDisplayProgress(Number(data.progress) || 0);
      }
    })();

    // realtime updates
    const channel = supabase
      .channel(`job-${jobId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "jobs", filter: `id=eq.${jobId}` },
        (payload) => {
          const p = Number(payload.new?.progress ?? 0);
          setServerProgress(isFinite(p) ? p : 0);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId]);

  // easing toward serverProgress (looks smooth even with sparse bumps)
  useEffect(() => {
    const step = () => {
      setDisplayProgress((prev) => {
        const target = serverProgress;
        const delta = target - prev;
        if (Math.abs(delta) < 0.5) return target; // snap when close
        return prev + delta * 0.15; // 15% easing
      });
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [serverProgress]);

  return Math.round(displayProgress);
}
