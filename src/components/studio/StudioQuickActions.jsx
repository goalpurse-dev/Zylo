
import React from "react";
// src/components/studio/StudioQuickActions.jsx
import { Link } from "react-router-dom";
import { Image as ImageIcon, Scissors, Palette, Sparkles } from "lucide-react";

const GRAD = "from-purple-600 via-purple-500 to-blue-600";

const tools = [
  { id: "gen",   label: "Image Generator",   blurb: "Art, photo, cartoonizer",          to: "/image-generator", icon: ImageIcon },
  { id: "bg",    label: "BG Remover",        blurb: "Remove & replace in 1 click",      to: "/bg-remover",      icon: Scissors   },
  { id: "brand", label: "Branding Kit",      blurb: "Logos, colors, banners",           to: "/branding-kit",    icon: Palette    },
  { id: "thumb", label: "Thumbnail Creator", blurb: "CTR-optimized for YouTube/TikTok", to: "/thumbnail-maker", icon: Sparkles   },
];

export default function StudioQuickActions() {
  return (
    <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {tools.map((t) => {
        const Icon = t.icon;
        return (
          <Link
            key={t.id}
            to={t.to}
            className={`
              group relative rounded-2xl p-[1px] bg-gradient-to-r ${GRAD} no-underline
              transition-transform hover:-translate-y-[2px] active:translate-y-[0px]
            `}
          >
            {/* inner glass card */}
            <div className="rounded-2xl bg-white/90 backdrop-blur-sm ring-1 ring-black/5 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                {/* icon bubble */}
                <span
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-xl text-white
                              bg-gradient-to-br ${GRAD} shadow-sm
                              transition-transform group-hover:scale-[1.06]`}
                >
                  <Icon className="h-4 w-4" />
                </span>

                <div className="min-w-0">
                  <div className="text-[15px] font-semibold text-[#0B1020]">{t.label}</div>
                  <div className="text-xs text-black/60 mt-1">{t.blurb}</div>
                </div>
              </div>

              {/* left accent that grows on hover */}
              <span
                className={`pointer-events-none absolute left-0 top-0 h-full w-[3px] rounded-l-2xl
                            bg-gradient-to-b ${GRAD} opacity-40
                            transition-all group-hover:w-[6px] group-hover:opacity-70`}
              />
            </div>

            {/* subtle glow (no hard shadow → no fake underline) */}
            <div className={`absolute -inset-[1px] rounded-2xl bg-gradient-to-r ${GRAD}
                             opacity-0 group-hover:opacity-30 blur-[12px] transition`} />
          </Link>
        );
      })}
    </div>
  );
}
