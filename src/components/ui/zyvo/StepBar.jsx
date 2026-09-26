import { cx } from "./styles";

/**
 * Segmented step progress ("Step 2 of 5 · Settings").
 *   steps: string[]; current: index of the active step
 */
export default function StepBar({ steps, current, className = "" }) {
  return (
    <div className={className}>
      <ol className="flex gap-1.5" aria-label={`Step ${current + 1} of ${steps.length}: ${steps[current]}`}>
        {steps.map((name, index) => (
          <li
            key={name}
            aria-current={index === current ? "step" : undefined}
            className={cx(
              "h-1 flex-1 rounded-full transition-colors duration-300 motion-reduce:transition-none",
              index < current ? "bg-lime-300/40" : index === current ? "bg-lime-300" : "bg-white/10",
            )}
          >
            <span className="sr-only">{name}</span>
          </li>
        ))}
      </ol>
      <div className="mt-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.14em]" aria-hidden="true">
        <span className="text-white/30">Step {current + 1} of {steps.length}</span>
        <span className="text-lime-300">{steps[current]}</span>
      </div>
    </div>
  );
}
