import React from "react";

export function Button({ className = "", as: As = "button", children, ...props }) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-4 py-2 font-semibold " +
    "transition active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2";
  const styles = "bg-[#007BFF] text-white hover:bg-[#0066d6] focus:ring-[#007BFF]";
  return (
    <As className={`${base} ${styles} ${className}`} {...props}>
      {children}
    </As>
  );
}
