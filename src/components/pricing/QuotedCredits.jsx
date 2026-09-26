import React from "react";

/**
 * Renders a server-quoted credit amount:
 *   loading → a small skeleton where the number goes
 *   error   → "Couldn't load price — Retry" (clickable)
 *   ready   → the number (optionally formatted by `children(value)`)
 */
export default function QuotedCredits({ status, value, onRetry, className = "", skeletonClassName = "", children }) {
  if (status === "error") {
    return <PriceRetry onRetry={onRetry} className={className} />;
  }
  if (status === "loading" || value == null) {
    return (
      <span
        aria-label="Loading price"
        className={`inline-block h-[0.9em] w-8 animate-pulse rounded bg-current opacity-25 align-[-0.1em] ${skeletonClassName}`}
      />
    );
  }
  return <span className={className}>{typeof children === "function" ? children(value) : value}</span>;
}

export function PriceRetry({ onRetry, className = "" }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onRetry?.(); }}
      className={`inline-flex items-center gap-1 text-[12px] font-semibold underline decoration-dotted underline-offset-2 ${className}`}
    >
      Couldn&apos;t load price — Retry
    </button>
  );
}
