import React from "react";

export default function DotPattern({ className, size = 150, rows = 15, cols = 15, opacity = 0.35 }) {
  // Piirtää rows x cols mintunvihreää pistettä
  const gap = Math.floor(size / Math.max(rows, cols));

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={`0 0 ${gap * cols} ${gap * rows}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {Array.from({ length: rows }).map((_, r) =>
        Array.from({ length: cols }).map((_, c) => (
          <circle
            key={`${r}-${c}`}
            cx={c * gap}
            cy={r * gap}
            r={2}
            fill="#3EFECF"
            opacity={opacity}
          />
        ))
      )}
    </svg>
  );
}
