import { FOCUS, cx } from "./styles";

/**
 * Selectable option (Cartoon Drive By mood chip).
 *   shape "card" = rounded-xl mood/option card; "pill" = rounded-full chip.
 *   selected → lime border + tint; otherwise the quiet glass style.
 */
export default function OptionChip({ selected = false, onClick, children, shape = "card", disabled = false, className = "", ...rest }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "border text-left font-bold transition disabled:cursor-not-allowed disabled:opacity-50",
        FOCUS,
        shape === "pill"
          ? "rounded-full px-3 py-1.5 text-[11px]"
          : "flex items-center gap-2 rounded-xl px-3 py-2.5 text-[11px] lg:py-1.5",
        selected
          ? "border-lime-300/45 bg-lime-300/[0.09] text-white"
          : "border-white/[0.07] bg-white/[0.035] text-white/55 hover:text-white/80",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
