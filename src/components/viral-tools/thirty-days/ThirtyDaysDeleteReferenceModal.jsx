import { createPortal } from "react-dom";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";

export default function ThirtyDaysDeleteReferenceModal({ reference, deleting, onConfirm, onCancel }) {
  if (!reference) return null;
  return createPortal(
    <div className="fixed inset-0 z-[310] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onClick={deleting ? undefined : onCancel}>
      <div role="dialog" aria-modal="true" aria-labelledby="delete-series-reference-title" className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-lime-300/[.14] bg-[#0C0F0D] p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <button type="button" disabled={deleting} onClick={onCancel} aria-label="Cancel reference deletion" className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-white/[.07] text-white/45 transition hover:text-white disabled:opacity-30"><X className="h-4 w-4" /></button>
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-red-300/20 bg-red-400/10"><AlertTriangle className="h-6 w-6 text-red-200" /></div>
        <h2 id="delete-series-reference-title" className="text-center text-xl font-black text-white">Delete this reference?</h2>
        <p className="mt-2 text-center text-sm font-bold text-lime-200">{reference.label || reference.role || "Persistent reference"}</p>
        <div className="mt-4 rounded-2xl border border-red-300/10 bg-red-400/[.055] p-4 text-xs leading-5 text-red-100/70">
          Credits will not be refunded. Finished episodes will stay unchanged. If this is a duplicate, the extra card is removed; otherwise its role stays as an empty placeholder so you can generate a replacement.
        </div>
        <button type="button" disabled={deleting} onClick={onConfirm} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-red-300 py-3 text-sm font-black text-[#21100F] transition hover:bg-red-200 disabled:opacity-45">
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}{deleting ? "Deleting…" : "Yes, delete it"}
        </button>
        <button type="button" disabled={deleting} onClick={onCancel} className="mt-3 w-full py-1 text-sm text-white/35 transition hover:text-white/60 disabled:opacity-30">Keep reference</button>
      </div>
    </div>,
    document.body,
  );
}
