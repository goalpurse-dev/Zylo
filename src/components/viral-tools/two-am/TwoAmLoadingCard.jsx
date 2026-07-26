import { useId } from "react";

function loadingLabel(status, progress) {
  if (status === "planning") return "Planning";
  if (status === "queued") return "Queued";
  if (progress < 35) return "Generating";
  if (progress < 75) return "Rendering";
  if (progress < 95) return "Finalizing";
  return "Almost done";
}

export default function TwoAmLoadingCard({ progress = 0, status = "generating" }) {
  const gradientId = useId().replace(/:/g, "");
  const displayProgress = Math.max(0, Math.min(99, Math.round(Number(progress) || 0)));
  const circumference = 251.3;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden bg-[#060b08]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_24%,rgba(190,242,100,.10),transparent_32%),radial-gradient(circle_at_70%_78%,rgba(132,204,22,.06),transparent_30%)]" />

      <div className="relative z-10 flex flex-col items-center gap-3">
        <div className="relative">
          <svg className="h-[68px] w-[68px] -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
            <defs>
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#BEF264" />
                <stop offset="100%" stopColor="#84CC16" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke={`url(#${gradientId})`}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - displayProgress / 100)}
              style={{ transition: "stroke-dashoffset .5s cubic-bezier(.4,0,.2,1)" }}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <span className="text-[12px] font-bold tabular-nums text-white/90">{displayProgress}%</span>
          </div>
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/45">
            {loadingLabel(status, displayProgress)}
          </p>
          <div className="flex gap-1">
            {[0, 1, 2].map((dot) => (
              <span
                key={dot}
                className={`h-1 w-1 animate-bounce rounded-full ${status === "queued" ? "bg-white/25" : "bg-lime-300/60"}`}
                style={{ animationDelay: `${dot * 150}ms`, animationDuration: "1.1s" }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10 h-0.5 bg-white/[0.04]">
        <div
          className="h-full rounded-r-full bg-gradient-to-r from-lime-300 to-lime-500 shadow-[0_0_8px_rgba(190,242,100,.65)] transition-[width] duration-500 ease-out"
          style={{ width: `${Math.max(2, displayProgress)}%` }}
        />
      </div>
    </div>
  );
}
