import { FOCUS, cx } from "./styles";

/** On/off switch (role="switch"). Lime when on. */
export default function Toggle({ checked, onChange, label, disabled = false, className = "" }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
        FOCUS,
        checked ? "bg-lime-300" : "bg-white/10",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          "inline-block h-5 w-5 rounded-full shadow transition-transform duration-200 motion-reduce:transition-none",
          checked ? "translate-x-[22px] bg-[#11150D]" : "translate-x-0.5 bg-white",
        )}
      />
    </button>
  );
}
