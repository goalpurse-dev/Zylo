import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

import Generate from "../../components/VideoGenerator/Generate";
import Result from "../../components/VideoGenerator/Result";

export default function VideoGenerator() {
  const [results, setResults] = useState([]);

  useEffect(() => {
    let interval;

    async function loadVideos() {
      const { data, error } = await supabase
        .from("jobs")
        .select(
          "id, prompt, input, settings, result_url, created_at, status, progress, type"
        )
        .eq("type", "video")
        .eq("settings->>creation_type", "video")
        .order("created_at", { ascending: false })
        .limit(40);

      if (error) {
        console.error("Error loading videos:", error);
        return;
      }

      if (data) {
        console.log("LOADED VIDEOS:", data);
        setResults(data);
      }
    }

    // Initial load
    loadVideos();

    // ✅ Realtime subscription
    const channel = supabase
      .channel("video-jobs")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "jobs",
        },
        () => {
          loadVideos();
        }
      )
      .subscribe();

    // ✅ Fallback polling (guarantees updates even if realtime misses)
    interval = setInterval(() => {
      loadVideos();
    }, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="w-full min-h-screen flex flex-col md:flex-row overflow-x-hidden bg-[#0E1117]">
      <div className="w-full md:max-w-[450px] md:min-w-[400px] md:border-r md:border-white/5">
        <div className="w-full px-6 py-6">
          <Generate />
        </div>
      </div>

      <div className="w-full p-6 md:flex-1 md:min-w-0 md:overflow-hidden">
        <Result results={results} />
      </div>
    </div>
  );
}