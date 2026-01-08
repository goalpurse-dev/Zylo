// JobProgressOverlay.tsx
import React, { useMemo } from "react";
import { useJobProgress } from "../hooks/useJobProgress";
import { supabase } from "../lib/supabaseClient";

export default function JobProgressOverlay({ jobId, onDone }: { jobId: string; onDone: () => void }) {
  const progress = useJobProgress(jobId);
  const [status, setStatus] = React.useState<"running"|"succeeded"|"failed">("running");

  // also watch status so you keep showing the overlay briefly after done
  React.useEffect(() => {
    const channel = supabase
      .channel(`job-status-${jobId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "jobs", filter: `id=eq.${jobId}` },
        (payload) => setStatus(payload.new?.status)
      )
      .subscribe();

    (async () => {
      const { data } = await supabase.from("jobs").select("status").eq("id", jobId).single();
      if (data?.status) setStatus(data.status);
    })();

    return () => supabase.removeChannel(channel);
  }, [jobId]);

  React.useEffect(() => {
    if (status === "succeeded" && progress >= 98) {
      // tiny grace so the user SEES the bar hit 100 before you switch views
      const t = setTimeout(() => onDone(), 400);
      return () => clearTimeout(t);
    }
  }, [status, progress, onDone]);

  return (
    <div className="fixed inset-0 grid place-items-center bg-black/60 z-50">
      <div className="w-[360px] rounded-xl bg-white/95 p-5 shadow-lg">
        <div className="mb-2 text-sm font-medium text-gray-900">
          {status === "running" ? "Rendering…" : "Finishing…"}
        </div>
        <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-[width] duration-150"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        <div className="mt-2 text-xs text-gray-600">{Math.min(progress, 100)}%</div>
      </div>
    </div>
  );
}
