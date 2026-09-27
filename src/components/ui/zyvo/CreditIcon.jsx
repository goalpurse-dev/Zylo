import { cx } from "./styles";

/** The credits glyph as a CSS mask, so it takes the surrounding text color. */
export default function CreditIcon({ className = "h-4 w-4" }) {
  return (
    <span
      aria-hidden="true"
      className={cx("shrink-0 bg-current", className)}
      style={{
        WebkitMaskImage: "url('/icons/credits.png')",
        maskImage: "url('/icons/credits.png')",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
  );
}
