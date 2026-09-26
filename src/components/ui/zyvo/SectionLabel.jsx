import { cx } from "./styles";

/**
 * Uppercase section label ("WORLD TO DRIVE PAST"), with an optional hint on
 * the right ("10 sec · 9:16"). Pass htmlFor to render a <label>.
 */
export default function SectionLabel({ children, hint, htmlFor, id, className = "" }) {
  const labelClass = "text-[11px] font-bold uppercase tracking-[0.12em] text-white/40";
  const label = htmlFor
    ? <label htmlFor={htmlFor} id={id} className={labelClass}>{children}</label>
    : <p id={id} className={labelClass}>{children}</p>;

  if (!hint) {
    return <div className={cx("mb-2 lg:mb-1.5", className)}>{label}</div>;
  }
  return (
    <div className={cx("mb-2 flex items-end justify-between gap-3 lg:mb-1.5", className)}>
      {label}
      <span className="text-[10px] font-semibold text-white/25">{hint}</span>
    </div>
  );
}
