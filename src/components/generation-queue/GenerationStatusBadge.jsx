import { TONE_COLORS } from "../../lib/queueStatusUtils";

/**
 * Shared status badge used across all generation cards.
 * Pass either a pre-computed DisplayStatus or raw tone+label.
 *
 * Usage:
 *   <GenerationStatusBadge tone="retrying" label="Provider busy" />
 *   <GenerationStatusBadge status={displayStatus} />
 */
export default function GenerationStatusBadge({ status, tone: toneProp, label: labelProp, subLabel: subLabelProp, compact = false }) {
  const tone     = status?.tone     ?? toneProp     ?? "queued";
  const label    = status?.label    ?? labelProp    ?? "Queued";
  const subLabel = status?.subLabel ?? subLabelProp ?? null;

  const colors = TONE_COLORS[tone] ?? TONE_COLORS.queued;
  const isPulsing = tone === "processing" || tone === "retrying";

  return (
    <div className={compact ? "inline-flex items-center gap-1" : "flex flex-col gap-0.5"}>
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold leading-none ${colors.text} ${colors.bg} ${colors.border}`}
      >
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${colors.dot} ${isPulsing ? "animate-pulse" : ""}`}
        />
        {label}
      </span>
      {!compact && subLabel && (
        <span className="text-[9px] text-white/25 pl-1">{subLabel}</span>
      )}
    </div>
  );
}
