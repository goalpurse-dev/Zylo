import { FOCUS, cx } from "./styles";

/** Cartoon Drive By error banner, with an optional action ("Try again"). */
export default function ErrorBanner({ children, action, onAction, className = "" }) {
  return (
    <div
      role="alert"
      className={cx(
        "flex items-start justify-between gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-[12px] font-semibold leading-relaxed text-red-300",
        className,
      )}
    >
      <p>{children}</p>
      {action && (
        <button
          type="button"
          onClick={onAction}
          className={cx("shrink-0 rounded-lg px-2 py-0.5 text-[12px] font-bold text-red-200 underline underline-offset-2 hover:text-white", FOCUS)}
        >
          {action}
        </button>
      )}
    </div>
  );
}
