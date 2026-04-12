import React from "react";

const platforms = [
  { name: "TikTok",     logo: "/images/logos/tiktok.webp" },
  { name: "YouTube",    logo: "/images/logos/youtube.webp" },
  { name: "Instagram",  logo: "/images/logos/instagram.webp" },
  { name: "Pinterest",  logo: "/images/logos/pinterest.webp" },
  { name: "Shopify",    logo: "/images/logos/shopify.webp" },
  { name: "X",          logo: "/images/logos/x.webp" },
];

// 4 copies: first 2 are the "real" set, last 2 are the seamless loop clone
const track = [...platforms, ...platforms, ...platforms, ...platforms];

export default function PlatformCarousel() {
  return (
    <div className="w-full overflow-hidden bg-[#F7F5FA] cursor-default py-2">

      <p className="text-center text-sm text-gray-500 mb-6">
        Optimized for creators on
      </p>

      <div className="relative">
        {/* Fade edges */}
        <div className="pointer-events-none absolute left-0 top-0 h-full w-24 bg-gradient-to-r from-[#F7F5FA] to-transparent z-10" />
        <div className="pointer-events-none absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-[#F7F5FA] to-transparent z-10" />

        {/* Track — translate -50% of 4 copies = seamless loop over 2 copies */}
        <div className="flex animate-marquee whitespace-nowrap will-change-transform">
          {track.map((platform, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 mx-10 opacity-50 hover:opacity-90 transition-opacity shrink-0"
            >
              <img
                src={platform.logo}
                alt={platform.name}
                className="h-5 w-auto grayscale"
              />
              <span className="text-gray-600 text-sm font-medium">{platform.name}</span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes marquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 28s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}
