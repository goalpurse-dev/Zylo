import { createPortal } from "react-dom";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";
import { formatEpisodeRange } from "./api/thirtyDaysSeriesApi";

export default function ThirtyDaysDeleteEpisodeModal({ episode, deleting = false, onConfirm, onCancel }) {
  if (!episode) return null;
  const label = formatEpisodeRange(episode.startDay, episode.endDay);

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onClick={deleting ? undefined : onCancel}>
      <div role="dialog" aria-modal="true" aria-labelledby="thirty-days-delete-episode-title" aria-describedby="thirty-days-delete-episode-description" className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-lime-300/[0.13] bg-[#0C0F0D] p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-lime-300/25 blur-3xl" />
        <button type="button" disabled={deleting} onClick={onCancel} aria-label="Close delete confirmation" className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-white/[0.07] text-white/45 transition hover:text-white disabled:opacity-35"><X className="h-4 w-4" /></button>
        <div className="relative mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-lime-300/25 bg-lime-300/10"><Trash2 className="h-6 w-6 text-lime-300" /></div>
        <h2 id="thirty-days-delete-episode-title" className="text-center text-xl font-black text-white">Delete {label}?</h2>
        <p id="thirty-days-delete-episode-description" className="mt-2 text-center text-sm leading-relaxed text-white/50">Are you sure you want to delete {label} from this series?</p>
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-lime-300/[.12] bg-lime-300/[.045] p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-lime-300" />
          <div><p className="text-xs font-black text-lime-100">Credits will not be refunded</p><p className="mt-1 text-[10px] leading-4 text-white/35">Only this newest episode and its generated scenes will be removed. Your Series will return to the previous day.</p></div>
        </div>
        <button type="button" disabled={deleting} onClick={onConfirm} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-lime-300 py-3 text-sm font-black text-[#11150D] transition hover:bg-lime-200 disabled:cursor-wait disabled:opacity-60">{deleting ? <><Loader2 className="h-4 w-4 animate-spin" />Deleting…</> : <><Trash2 className="h-4 w-4" />Yes, delete episode</>}</button>
        <button type="button" disabled={deleting} onClick={onCancel} className="mt-3 w-full py-1 text-sm text-white/35 transition hover:text-white/60 disabled:opacity-35">Keep episode</button>
      </div>
    </div>,
    document.body,
  );
}
