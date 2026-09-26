import { FOCUS, cx } from "./styles";

/**
 * Segmented control on the #0E1012 track with a white selected pill.
 *
 *   options: [{ value, label, sublabel?, disabled? }]
 *   size: "sm" (Cartoon Drive By vehicle picker) | "lg" (mode toggle with sublabels)
 */
export default function SegmentedControl({ options, value, onChange, ariaLabel, size = "sm", disabled = false, className = "" }) {
  const lg = size === "lg";
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cx("grid gap-1 rounded-xl border border-white/[0.07] bg-[#0E1012] p-1", className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            disabled={disabled || option.disabled}
            onClick={() => onChange(option.value)}
            className={cx(
              "rounded-lg transition disabled:cursor-not-allowed disabled:opacity-50",
              FOCUS,
              lg ? "px-2 py-2.5 text-[12px] font-black" : "px-1 py-2 text-[10px] font-bold lg:py-1.5",
              selected ? "bg-white text-black" : "text-white/45 hover:bg-white/[0.06] hover:text-white/75",
            )}
          >
            <span className="block">{option.label}</span>
            {option.sublabel && (
              <span className={cx("mt-0.5 block text-[10px] font-semibold", selected ? "text-black/55" : "text-white/30")}>
                {option.sublabel}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
