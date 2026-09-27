export default function ThirtyDaysCreditBadge({ value }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-lime-400/20 bg-[#0B120B]/90 px-2.5 py-1 text-[11px] font-black text-lime-300 shadow-[inset_0_1px_0_rgba(217,249,157,0.05)]">
      <span
        aria-hidden="true"
        className="h-3.5 w-3.5 shrink-0 bg-lime-300"
        style={{
          WebkitMaskImage: "url(/icons/credits.png)",
          maskImage: "url(/icons/credits.png)",
          WebkitMaskPosition: "center",
          maskPosition: "center",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskSize: "contain",
          maskSize: "contain",
        }}
      />
      {value}
    </span>
  );
}
