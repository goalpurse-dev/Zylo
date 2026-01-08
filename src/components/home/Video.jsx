import React, { useRef } from "react";

import vid1 from "../../assets/home/video1.mp4";
import vid2 from "../../assets/home/video2.mp4";
import vid3 from "../../assets/home/video3.mp4";
import vid4 from "../../assets/home/video4.mp4";
import vid5 from "../../assets/home/video5.mp4";

const cn = (...a) => a.filter(Boolean).join(" ");

export default function UnderHeroVideos({
  title = "Made with Zylo",
  speedSec = 36,
  className = "",
  videos = [vid1, vid2, vid3, vid4, vid5],
}) {
  const loopVids = [...videos, ...videos];
  const wrapRef = useRef(null);

  const handleHover = (paused) => {
    if (!wrapRef.current) return;
    const track = wrapRef.current.querySelector(".zylo-marquee");
    if (track) track.style.animationPlayState = paused ? "paused" : "running";
    wrapRef.current.querySelectorAll("video").forEach((v) => {
      try { paused ? v.pause() : v.play().catch(() => {}); } catch {}
    });
  };

  return (
    <section className={cn("w-full", className)} aria-label={title}>
      <style>{`
        @keyframes zylo-marquee-ltr {
          0%   { transform: translateX(-50%); }
          100% { transform: translateX(0%); }
        }
        .zylo-marquee { animation: zylo-marquee-ltr linear infinite; will-change: transform; }
        @media (prefers-reduced-motion: reduce) {
          .zylo-marquee { animation: none !important; transform: none !important; }
        }
      `}</style>

      <div className="flex items-center justify-between px-4 md:px-6">
        <h3 className="text-xl md:text-2xl font-semibold text-white">{title}</h3>
        <div className="text-sm text-zinc-400"></div>
      </div>

      <div
        ref={wrapRef}
        className="relative mt-4 md:mt-5"
        onMouseEnter={() => handleHover(true)}
        onMouseLeave={() => handleHover(false)}
      >
        {/* edge fades */}
        <div className="pointer-events-none absolute left-0 top-0 h-full w-24 bg-gradient-to-r from-[#0c1218] to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-[#0c1218] to-transparent" />

        <div className="overflow-hidden">
          <div
            className="zylo-marquee flex w-[200%]"
            style={{ animationDuration: `${speedSec}s`, animationDelay: `-${speedSec / 2}s` }}
          >
            <StripRow videos={loopVids.slice(0, videos.length)} />
            <StripRow videos={loopVids.slice(videos.length)} />
          </div>
        </div>
      </div>
    </section>
  );
}

function StripRow({ videos }) {
  return (
    <div className="flex">
      {videos.map((src, i) => (
        <VideoCard key={`${i}-${src}`} src={src} />
      ))}
    </div>
  );
}

function VideoCard({ src }) {
  return (
    <figure
      className={cn(
        "relative shrink-0 mx-3",
        "w-[180px] sm:w-[220px] md:w-[260px] lg:w-[300px]",
        "rounded-3xl shadow-lg overflow-hidden bg-white/5"
      )}
      style={{ aspectRatio: "9 / 16" }}
    >
      <video src={src} muted loop autoPlay playsInline preload="metadata" className="h-full w-full object-cover" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black/30 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/30 to-transparent" />
      <div className="pointer-events-none absolute inset-0 ring-1 ring-white/10" />
    </figure>
  );
}
