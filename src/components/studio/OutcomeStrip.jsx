import React from "react";
import { CheckCircle2, Rocket, Zap, BadgePercent } from "lucide-react";

const GRAD = "from-purple-600 via-purple-500 to-blue-600";

const items = [
  { icon: Rocket,       text: "Make studio-quality images in minutes" },
  { icon: BadgePercent, text: "On-brand assets auto-applied" },
  { icon: Zap,          text: "Thumbnails optimized for CTR" },
  { icon: CheckCircle2, text: "No Photoshop required" },
];

export default function OutcomeStrip() {
  return (
    <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map((it, i) => {
        const Icon = it.icon;
        return (
          <div
            key={i}
            className="group relative rounded-2xl no-underline"
          >
            {/* gradient hairline border */}
            <div className={`rounded-2xl p-[1px] bg-gradient-to-r ${GRAD}`}>
              <div className="rounded-2xl bg-white/95 backdrop-blur-sm ring-1 ring-black/[0.04] px-3.5 py-3 flex items-center gap-3">
                <span
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-white
                              bg-gradient-to-r ${GRAD} shadow-sm
                              transition-transform group-hover:scale-[1.06]`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-sm text-[#0B1020]">{it.text}</span>
              </div>
            </div>

            {/* hover glow only (prevents any permanent bottom line) */}
            <div
              className={`pointer-events-none absolute inset-0 rounded-2xl
                          bg-gradient-to-r ${GRAD} opacity-0 group-hover:opacity-25 blur-[10px] transition`}
            />
          </div>
        );
      })}
    </div>
  );
}
