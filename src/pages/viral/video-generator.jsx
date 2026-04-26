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
  // track when we first saw each job as running so we can estimate progress locally
  const jobStartTimesRef = useRef({});

  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Client-side progress ticker — runs every second while any job is active.
  // Uses an ease-out curve over 8 minutes so the bar moves fast early and
  // slows near the end. Takes the MAX of the real DB value and the estimate
  // so the bar never goes backwards when the real value arrives.
  useEffect(() => {
    const MAX_MS = 8 * 60 * 1000;
    const tick = setInterval(() => {
      const starts = jobStartTimesRef.current;
      if (Object.keys(starts).length === 0) return;
      setResults((prev) =>
        prev.map((job) => {
          if (!starts[job.id]) return job;
          const elapsed = Date.now() - starts[job.id];
          const ratio = Math.min(1, elapsed / MAX_MS);
          const eased = 1 - Math.pow(1 - ratio, 2);
          const estimate = Math.floor(eased * 90 + 20); // 20% → 95% over 8 min
          const current = Number(job.progress ?? 0);
          if (estimate <= current) return job;
          return { ...job, progress: estimate };
        })
      );
    }, 1000);
    return () => clearInterval(tick);
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

      // record start times for jobs we see running for the first time
      data.forEach((j) => {
        if ((j.status === "running" || j.status === "queued") && !jobStartTimesRef.current[j.id]) {
          jobStartTimesRef.current[j.id] = Date.now();
        }
        if (j.status !== "running" && j.status !== "queued") {
          delete jobStartTimesRef.current[j.id];
        }
      });

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
        <div className="flex h-full gap-2 bg-[#090A0A]">

          {/* Generate — scrollable when content overflows */}
          <div className="basis-[40%] 2xl:basis-[25%] shrink-0 h-full overflow-y-auto bg-[#090A0A]">
            <div className="p-2 min-h-full box-border flex flex-col">
              <Generate />
            </div>
          </div>

          {/* Result — scrollable when results exist, fills full height */}
          <div className="flex-1 min-w-0 h-full overflow-y-auto bg-[#090A0A]">
            <div className="p-2 pb-8 min-h-full box-border flex flex-col">
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
