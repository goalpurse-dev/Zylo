import { motion as Motion, useReducedMotion } from "framer-motion";
import { cx } from "./styles";

/** Lime progress bar. value 0–100. */
export default function ProgressBar({ value, label, className = "" }) {
  const reduce = useReducedMotion();
  const pct = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={label}
      className={cx("h-1.5 overflow-hidden rounded-full bg-white/10", className)}
    >
      <Motion.div
        className="h-full rounded-full bg-lime-300"
        initial={false}
        animate={{ width: `${pct}%` }}
        transition={reduce ? { duration: 0 } : { duration: 0.5, ease: "easeOut" }}
      />
    </div>
  );
}
