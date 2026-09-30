import { FOCUS, cx } from "./styles";

/**
 * Chunky 3D "key" button: a solid face over a darker bottom edge (box-shadow).
 * Hover brightens the face; pressing moves the face down 3px while the edge
 * shrinks to 1px, like pressing a key. Reduced motion keeps the pressed state
 * but drops the transition.
 *
 *   variant: "lime"    recommended plan and main actions (lime-300 face, lime-600 edge)
 *            "white"   secondary plans (near-white face, grey edge)
 *            "outline" quiet, flat: "Current plan" and other non-actions
 *   size:    "lg" (52px, plan cards) | "md" (44px, finder, top-ups)
 */
const VARIANTS = {
  lime: "bg-lime-300 text-[#11150D] shadow-[0_4px_0_#65A30D] hover:bg-lime-200 enabled:active:shadow-[0_1px_0_#65A30D]",
  white: "bg-[#F2F4F1] text-[#11150D] shadow-[0_4px_0_#9AA197] hover:bg-white enabled:active:shadow-[0_1px_0_#9AA197]",
  outline: "border border-white/15 bg-transparent text-white/60 shadow-none",
};
const SIZES = { lg: "h-[52px] text-[15px]", md: "h-11 text-[14px]" };

export default function KeyButton({ children, variant = "lime", size = "lg", fullWidth = true, disabled = false, busy = false, type = "button", className = "", ...rest }) {
  const flat = variant === "outline";
  return (
    <button
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={cx(
        "relative inline-flex select-none items-center justify-center gap-2 rounded-xl px-5 font-bold tracking-[-0.01em]",
        "transition-[transform,box-shadow,background-color] duration-100 ease-out motion-reduce:transition-none",
        !flat && "mb-1 enabled:active:translate-y-[3px]",
        "disabled:cursor-default",
        !flat && "disabled:opacity-60",
        SIZES[size] ?? SIZES.lg,
        VARIANTS[variant] ?? VARIANTS.lime,
        fullWidth && "w-full",
        FOCUS,
        className,
      )}
      {...rest}
    >
      {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current motion-reduce:animate-none" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
