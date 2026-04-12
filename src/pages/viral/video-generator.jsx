import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

import Generate from "../../components/VideoGenerator/Generate";
import Result from "../../components/VideoGenerator/Result";

export default function VideoGenerator() {
  const [results, setResults] = useState([]);
  const intervalRef = useRef(null);

  useEffect(() => {
    async function loadVideos() {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;

      const { data, error } = await supabase
        .from("jobs")
        .select(
          "id, prompt, input, settings, result_url, created_at, status, progress, type"
        )
        .eq("type", "video")
        .eq("settings->>creation_type", "video")
        .order("created_at", { ascending: false })
        .limit(40);

      if (error) return;
      if (!data) return;

      setResults(data);

      // Only keep polling if there are active jobs — stop when all are settled
      const hasActive = data.some(
        (j) => j.status === "running" || j.status === "queued"
      );

      if (!hasActive && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      } else if (hasActive && !intervalRef.current) {
        intervalRef.current = setInterval(loadVideos, 4000);
      }
    }

    // Initial load
    loadVideos();

    // Realtime subscription — triggers a fresh fetch on any job change
    const channel = supabase
      .channel("video-jobs")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs" },
        loadVideos
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <div className="w-full flex flex-col md:flex-row md:h-screen md:overflow-hidden bg-[#090A0A]">
      {/* Generate — on desktop: fixed height column, no scroll */}
      <div className="w-full md:max-w-[450px] md:min-w-[400px] md:border-r md:border-white/5 p-4 md:p-5 md:h-full md:overflow-hidden flex-shrink-0">
        <Generate />
      </div>

      {/* Result — on mobile: normal flow below generate; on desktop: scrollable column */}
      <div className="w-full flex-1 p-4 md:p-5 md:min-w-0 md:overflow-y-auto">
        <Result results={results} />
      </div>
    </div>
  );
}