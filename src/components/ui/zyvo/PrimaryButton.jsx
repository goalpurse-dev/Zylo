import { ChevronRight } from "lucide-react";
import QuotedCredits from "../../pricing/QuotedCredits";
import CreditIcon from "./CreditIcon";
import { FOCUS, PRESS, cx } from "./styles";

/**
 * Full-width action button with an optional price chip (Cartoon Drive By
 * Generate button).
 *
 *   price:   number | { status: "loading" | "ready" | "error", value, onRetry }
 *   priceOf: optional { value, approx } shown after the price: "24 of ~174"
 *            (a step's price out of the whole job's)
 *            "loading" disables the button and shows a skeleton;
 *            "error" turns it into "Couldn't load price — Retry".
 *   busy:    string label shown with a spinner while work runs (disabled)
 *   variant: "primary" (lime) | "secondary" (glass)
 *   fullWidth: false for buttons sized by their label (Back, Done)
 *   size:    "md" (footer actions) | "sm" (cards)
 */
export default function PrimaryButton({
  children,
  onClick,
  price,
  priceOf = null,
  busy,
  variant = "primary",
  disabled = false,
  chevron = false,
  fullWidth = true,
  size = "md",
  type = "button",
  className = "",
  ...rest
}) {
  const quote = typeof price === "number" ? { status: "ready", value: price } : price;
  const priceError = quote?.status === "error";
  const priceLoading = quote?.status === "loading";
  const isBusy = Boolean(busy);
  const isDisabled = disabled || isBusy || priceLoading;

  const look = isBusy
    ? "cursor-not-allowed bg-lime-300/15 text-lime-300/40"
    : variant === "secondary"
      ? "border border-white/10 bg-white/[0.05] text-white/70 enabled:hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
      : "bg-lime-300 text-[#11150D] enabled:hover:bg-lime-200 disabled:cursor-not-allowed disabled:bg-lime-300/15 disabled:text-lime-300/40";

  return (
    <button
      type={type}
      onClick={priceError && !isBusy ? quote.onRetry : onClick}
      disabled={isDisabled && !(priceError && !isBusy)}
      aria-busy={isBusy || priceLoading || undefined}
      className={cx(
        "flex items-center justify-center gap-2 rounded-xl font-black transition",
        size === "sm" ? "py-2.5 text-[12px] lg:py-2" : "py-3.5 text-[14px] lg:py-2.5",
        fullWidth && "w-full",
        FOCUS,
        PRESS,
        look,
        className,
      )}
      {...rest}
    >
      {isBusy ? (
        <>
          <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-lime-300/20 border-t-lime-300/70 motion-reduce:animate-none" />
          {busy}
        </>
      ) : priceError ? (
        "Couldn't load price — Retry"
      ) : (
        <>
          {priceLoading ? "Loading price…" : children}
          {quote && (
            <span className="flex items-center gap-1 text-[13px] font-semibold">
              <CreditIcon className="h-4 w-4" />
              <QuotedCredits status={quote.status} value={quote.value} onRetry={quote.onRetry} />
              {priceOf?.value != null && quote.status === "ready" && (
                <span className="opacity-60">of {priceOf.approx ? "~" : ""}{priceOf.value.toLocaleString()}</span>
              )}
              <span className="sr-only"> credits{priceOf?.value != null ? ` of about ${priceOf.value} for the whole video` : ""}</span>
            </span>
          )}
          {chevron && <ChevronRight className="h-4 w-4" aria-hidden="true" />}
        </>
      )}
    </button>
  );
}
