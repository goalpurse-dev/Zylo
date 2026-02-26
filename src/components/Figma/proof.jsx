import React from "react";

const platforms = [
  { name: "TikTok", logo: "/images/logos/tiktok.webp" },
  { name: "YouTube", logo: "/images/logos/youtube.webp" },
  { name: "Instagram", logo: "/images/logos/instagram.webp" },
  { name: "Pinterest", logo: "/images/logos/pinterest.webp" },
  { name: "Shopify", logo: "/images/logos/shopify.webp" },
  { name: "X", logo: "/images/logos/x.webp" },
];

export default function PlatformCarousel() {
  return (
    <div className="w-full overflow-hidden bg-[#F7F5FA] cursor-default">

      {/* Top small text */}
      <p className="text-center text-sm text-gray-600 mb-6">
        Optimized for creators on
      </p>

      <div className="relative">

        {/* Fade edges */}
        <div className="pointer-events-none absolute left-0 top-0 h-full w-24 bg-gradient-to-r from-[#F7F5FA] to-transparent z-10" />
        <div className="pointer-events-none absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-[#F7F5FA] to-transparent z-10" />

        {/* Scrolling Track */}
        <div className="flex animate-scroll whitespace-nowrap">
          {[...platforms, ...platforms].map((platform, index) => (
            <div
              key={index}
              className="flex items-center gap-3 mx-12 opacity-60 hover:opacity-100 transition"
            >
              <img
                src={platform.logo}
                alt={platform.name}
                className="h-6 w-auto grayscale"
              />
              <span className="text-gray-600 text-base font-medium">
                {platform.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Animation */}
      <style>
        {`
          @keyframes scroll {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }

          .animate-scroll {
            animation: scroll 25s linear infinite;
          }
        `}
      </style>
    </div>
  );
}