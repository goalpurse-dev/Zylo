import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useSEO } from "../../hooks/useSEO";

import Generate from "../../components/VideoGenerator/Generate";
import Result from "../../components/VideoGenerator/Result";

export default function VideoGenerator() {
  useSEO({
    title: "AI Video Generator — Create Viral Short-Form Videos With AI | Zyvo",
    description:
      "Turn your ideas into viral AI videos for TikTok, Instagram Reels, and YouTube Shorts. Generate cinematic clips, animations, and scroll-stopping content in minutes.",
    canonical: "https://www.tryzyvo.com/workspace/video-generator",
    structuredData: {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Zyvo AI Video Generator",
      applicationCategory: "CreativeApplication",
      operatingSystem: "Web",
      description:
        "AI-powered video generator for TikTok, Reels, and YouTube Shorts. Create cinematic, animated, and viral short-form video content in minutes.",
      url: "https://www.tryzyvo.com/workspace/video-generator",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      featureList: [
        "AI short-form video generation",
        "TikTok, Reels, and YouTube Shorts formats",
        "Cinematic and animated video styles",
        "Prompt-based video creation",
        "Fast generation in minutes",
      ],
    },
  });

  const [results, setResults] = useState([]);
  const intervalRef = useRef(null);

  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    async function loadVideos() {
      const { data: authData } = await supabase.auth.getSession();
      if (!authData?.session?.user) return;

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

    loadVideos();

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
    <div className={`w-full bg-[#090A0A] ${isDesktop ? "h-full overflow-hidden" : ""}`}>

      {isDesktop ? (
        /*
         * DESKTOP — locked workspace, no outer scroll.
         * Generate: static (overflow-hidden), clips if screen too short.
         * Result: scrollable only when results overflow the column.
         */
        <div className="flex h-full">

          {/* Generate — scrollable when content overflows */}
          <div className="w-[450px] flex-shrink-0 h-full overflow-y-auto bg-[#191B1C] border-r border-white/5">
            <div className="p-5">
              <Generate />
            </div>
          </div>

          {/* Result — scrollable when results exist, fills full height */}
          <div className="flex-1 min-w-0 h-full overflow-y-auto">
            <div className="p-5 pb-8 min-h-full box-border flex flex-col">
              <Result results={results} />
            </div>
          </div>

        </div>
      ) : (
        /*
         * MOBILE / TABLET — stacked.
         * workspace-scroll handles all scrolling.
         * pb-[220px] ensures Generate Video + Estimated cost always
         * reachable above the fixed bottom nav.
         */
        <div className="flex flex-col p-4 pb-[220px] gap-4">
          <Generate />
          <Result results={results} />
        </div>
      )}

    </div>
  );
}
