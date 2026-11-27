import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useVisibleStyles } from "./useCatalog";

/** "Pick a template" from the prompt bar: every template this viewer can use, in one sheet */
export default function TemplatePicker({ studioId, onPick, onClose }) {
  const styles = useVisibleStyles(studioId);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center" role="presentation">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/70 backdrop-blur-[6px]" onClick={onClose} />
      <section role="dialog" aria-label="Pick a template" className="relative max-h-[80dvh] w-full max-w-[640px] overflow-y-auto rounded-t-[24px] border border-white/10 bg-[#121416] p-4 sm:rounded-[24px]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[17px] font-black text-white">Pick a template</h2>
          <button type="button" onClick={onClose} className="inline-flex items-center gap-1 rounded-full bg-white/[0.08] px-3 py-1.5 text-[12px] font-semibold text-white/70 hover:text-white"><X className="h-3.5 w-3.5" />Close</button>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {styles.map((s) => (
            <button key={s.id} type="button" onClick={() => onPick(s)} className="overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] text-left hover:border-lime-300/40">
              <img src={s.poster} alt="" className="aspect-square w-full object-cover" loading="lazy" />
              <p className="truncate px-2 py-1.5 text-[12px] font-semibold text-white">{s.name}</p>
            </button>
          ))}
        </div>
      </section>
    </div>,
    document.body,
  );
}
