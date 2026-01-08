// src/components/studio/StudioStickyNav.jsx
import React from "react";

import { Link } from "react-router-dom";
import { Home, Settings } from "lucide-react";

export default function StudioStickyNav() {
  const items = [
  
    { href: "#gen",     label: "Image Generator" },
    { href: "#brand",   label: "Branding Kit" },
    { href: "#thumb",   label: "Thumbnails" },
  ];

  const BAR_GRAD  = "from-blue-50/90 via-blue-50/70 to-purple-50/90";
  const CHIP_GRAD = "from-blue-500 to-purple-600";

  return (
    <div className="sticky top-0 z-40">
      {/* blue glass bar */}
      <div className="relative backdrop-blur-md">
        <div className={`absolute inset-0 bg-gradient-to-r ${BAR_GRAD}`} />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-2">
          {/* Center the WHOLE cluster: [Home] [chips] [Settings] */}
          <div className="flex items-center justify-center gap-2 sm:gap-3">
            {/* LEFT: Home (closer to chips) */}
            <Link
              to="/"
              aria-label="Home"
              className="inline-flex items-center justify-center h-9 w-9 rounded-full
                         bg-white/85 text-blue-700 ring-1 ring-white/70 hover:bg-white transition"
            >
              <Home className="h-5 w-5" />
            </Link>

            {/* CENTER: chips */}
            <nav className="flex items-center gap-2 sm:gap-3 overflow-x-auto no-scrollbar">
              {items.map((i) => (
                <a
                  key={i.href}
                  href={i.href}
                  className={`group inline-flex items-center rounded-full p-[1px]
                              bg-gradient-to-r ${CHIP_GRAD} no-underline`}
                >
                  <span
                    className="rounded-full px-3.5 py-1.5 text-sm font-semibold
                               bg-white text-blue-700 border border-white
                               transition group-hover:bg-transparent group-hover:text-white"
                  >
                    {i.label}
                  </span>
                </a>
              ))}
            </nav>

            {/* RIGHT: Settings (closer to chips) */}
            <Link
              to="/settings"
              aria-label="Settings"
              className="inline-flex items-center justify-center h-9 w-9 rounded-full
                         bg-white/85 text-blue-700 ring-1 ring-white/70 hover:bg-white transition"
            >
              <Settings className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
