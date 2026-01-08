import React from "react";

/** The same crisp glyph you used in Navbar */
export function CreditGlyph({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" width="14" height="14">
      <g fill="#2F57EB">
        <rect x="10" y="2" width="4" height="4" rx="1" transform="rotate(45 12 4)" />
        <rect x="18" y="10" width="4" height="4" rx="1" transform="rotate(45 20 12)" />
        <rect x="2" y="10" width="4" height="4" rx="1" transform="rotate(45 4 12)" />
        <rect x="10" y="18" width="4" height="4" rx="1" transform="rotate(45 12 20)" />
      </g>
    </svg>
  );
}

export default function CreditAmount({
  amount,
  className = "",
  pill = false,
}: {
  amount: number | string;
  className?: string;
  pill?: boolean;
}) {
  if (pill) {
    return (
      <span
        className={
          "inline-flex items-center gap-2 rounded-full bg-gray-50 ring-1 ring-black/5 px-2.5 py-1 text-sm font-semibold " +
          className
        }
      >
        <CreditGlyph />
        {amount}
      </span>
    );
  }
  return (
    <span className={"inline-flex items-center gap-1 " + className}>
      <CreditGlyph />
      <span>{amount}</span>
    </span>
  );
}
