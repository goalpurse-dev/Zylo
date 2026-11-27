import { useRef, useState } from "react";
import { Film, ImagePlus, Link2, Loader2, Upload, X } from "lucide-react";
import { COPY_PARTS, REFERENCE } from "../../../supabase/functions/_shared/reference/breakdown.js";
import { uploadReferenceImage } from "../../lib/references";

const ROLE_LABEL = { style: "Style", character: "Character", place: "Place", product: "Product/Logo" };

/** "Scanning your video… about 20 s" with the step and a bar */
export function ScanProgress({ scan }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-3" data-testid="reference-scanning">
      <p className="flex items-center gap-2 text-[13px] font-bold text-white"><Loader2 className="h-4 w-4 animate-spin text-lime-300" />Scanning your video… about 20 s</p>
      <p className="mt-0.5 text-[12px] text-white/65">{scan.label ?? "Working"}</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-lime-300 transition-all duration-500" style={{ width: `${Math.max(4, scan.pct ?? 0)}%` }} /></div>
    </div>
  );
}

/** "What I learned from your video": the shots, the numbers a director looks at, and what to copy */
export function BreakdownCard({ card, copy, onCopy, compact = false }) {
  if (!card) return null;
  const rows = [
    ["Length", `${card.seconds} s`], ["Shots", `${card.shots} (about ${card.avgShot} s each)`], ["Pace", card.pace],
    ["Hook", card.hook], ["Structure", card.structure], ["Look", card.look], ["Captions", card.captions], ["Sound", card.music],
  ].filter(([, v]) => v);
  return (
    <div className="overflow-hidden rounded-2xl border border-lime-300/25 bg-gradient-to-br from-lime-300/[0.06] to-transparent p-3" data-testid="reference-breakdown">
      <p className="text-[14px] font-black text-white">What I learned from your video</p>
      {card.thumbs?.length > 0 && (
        <div className="mt-2 flex gap-1 overflow-x-auto pb-1 [scrollbar-width:thin]" aria-label="The shots">
          {card.thumbs.map((t, i) => <img key={i} src={t} alt="" loading="lazy" className="h-[72px] w-[41px] shrink-0 rounded-md object-cover" />)}
        </div>
      )}
      <dl className={`mt-2 grid gap-x-3 gap-y-1 text-[12.5px] ${compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>
        {rows.map(([k, v]) => <div key={k} className="flex gap-2"><dt className="w-[70px] shrink-0 font-bold text-white/60">{k}</dt><dd className="min-w-0 text-white/90">{v}</dd></div>)}
      </dl>
      {onCopy && (
        <>
          <p className="mt-3 text-[11.5px] font-bold uppercase tracking-[0.12em] text-white/60">Copy from it</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label="What to copy">
            {COPY_PARTS.map((p) => (
              <button key={p.id} type="button" aria-pressed={copy[p.id]} onClick={() => onCopy({ ...copy, [p.id]: !copy[p.id] })}
                className={`rounded-full px-3 py-1 text-[12px] font-bold transition ${copy[p.id] ? "bg-lime-300 text-[#11150D]" : "border border-white/15 text-white/75 hover:border-white/30"}`}>{p.label}</button>
            ))}
          </div>
          <p className="mt-1.5 text-[11.5px] text-white/55">{copy.topic ? "Same topic, told your way." : "We copy the style, not the story: your idea stays yours."}</p>
        </>
      )}
    </div>
  );
}

/** "+ Reference video": upload or paste a link, then the scan and the card */
export function ReferenceVideoPanel({ rs, onClose }) {
  const file = useRef(null);
  const [link, setLink] = useState("");
  const busy = rs.scan && rs.scan.status !== "done" && rs.scan.status !== "failed";
  return (
    <div className="mt-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3" data-testid="reference-video">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[13px] font-bold text-white"><Film className="h-4 w-4 text-lime-300" />Reference video</p>
        <button type="button" onClick={() => { rs.clear(); onClose?.(); }} className="inline-flex items-center gap-0.5 text-[12px] text-white/60 hover:text-white"><X className="h-3 w-3" />Remove</button>
      </div>
      {!rs.scan && (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input ref={file} type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) rs.fromFile(f); e.target.value = ""; }} />
            <button type="button" onClick={() => file.current?.click()} className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-[12.5px] font-bold text-black hover:bg-lime-200"><Upload className="h-3.5 w-3.5" />Upload a video</button>
            <span className="text-[12px] text-white/50">or</span>
            <div className="flex min-w-[220px] flex-1 items-center gap-1 rounded-xl border border-white/12 bg-black/30 pl-2">
              <Link2 className="h-3.5 w-3.5 shrink-0 text-white/50" />
              <input value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && link.trim()) rs.fromLink(link); }} placeholder="Paste a TikTok, YouTube Shorts or Instagram link" className="min-w-0 flex-1 bg-transparent py-1.5 text-[13px] text-white placeholder:text-white/40 focus:outline-none" />
              <button type="button" disabled={!link.trim()} onClick={() => rs.fromLink(link)} className="rounded-lg px-2.5 py-1 text-[12px] font-bold text-lime-300 disabled:text-white/30">Scan</button>
            </div>
          </div>
          <p className="mt-1.5 text-[11.5px] text-white/55">Use videos you're allowed to reference. Up to 3 minutes (MP4, MOV or WebM, 100 MB). We copy the rhythm and style, never the video, its creator's name or logo.</p>
        </>
      )}
      {rs.error && <p className="mt-2 text-[12.5px] text-rose-300" role="alert">{rs.error}</p>}
      {busy && <div className="mt-2"><ScanProgress scan={rs.scan} /></div>}
      {rs.scan?.status === "failed" && <p className="mt-2 text-[12.5px] text-rose-300">{rs.scan.error} <button type="button" onClick={rs.clear} className="font-bold text-white underline">Try another</button></p>}
      {rs.scan?.status === "done" && <div className="mt-2"><BreakdownCard card={rs.scan.card} copy={rs.copy} onCopy={rs.setCopy} /></div>}
    </div>
  );
}

/** "+ Reference images": up to 6, each with a role guessed from the file and changed with one tap */
export function ReferenceImages({ images, onChange }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const add = async (files) => {
    const list = [...files].filter((f) => /^image\//.test(f.type)).slice(0, REFERENCE.maxImages - images.length);
    if (!list.length) return;
    setBusy(true); setError(null);
    const next = [...images];
    for (const f of list) {
      if (f.size > 10 * 1024 * 1024) { setError("Each image up to 10 MB."); continue; }
      try {
        next.push(await uploadReferenceImage(f));
      } catch { setError("An image didn't upload. Try again."); }
    }
    onChange(next);
    setBusy(false);
  };
  return (
    <div className="mt-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3" data-testid="reference-images">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[13px] font-bold text-white"><ImagePlus className="h-4 w-4 text-lime-300" />Reference images <span className="font-semibold text-white/50">{images.length}/{REFERENCE.maxImages}</span></p>
        {images.length > 0 && <button type="button" onClick={() => onChange([])} className="text-[12px] text-white/60 hover:text-white">Remove all</button>}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {images.map((im, k) => (
          <div key={im.path} className="w-[104px] overflow-hidden rounded-xl border border-white/10 bg-black/30">
            <div className="relative h-[72px]">
              {im.url ? <img src={im.url} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-[11px] text-white/50">{im.name.slice(0, 14)}</div>}
              <button type="button" aria-label="Remove" onClick={() => onChange(images.filter((_, j) => j !== k))} className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/70 text-white"><X className="h-3 w-3" /></button>
            </div>
            {/* one tap moves to the next role */}
            <button type="button" onClick={() => { const roles = REFERENCE.imageRoles; onChange(images.map((x, j) => (j === k ? { ...x, role: roles[(roles.indexOf(x.role) + 1) % roles.length] } : x))); }}
              className="w-full px-1.5 py-1 text-[11px] font-bold text-lime-300 hover:bg-white/[0.05]" title="Tap to change">{ROLE_LABEL[im.role]}</button>
          </div>
        ))}
        {images.length < REFERENCE.maxImages && (
          <button type="button" onClick={() => input.current?.click()} disabled={busy} className="grid h-[96px] w-[104px] place-items-center rounded-xl border border-dashed border-white/20 text-[12px] font-semibold text-white/70 hover:border-white/40">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "+ Add"}
          </button>
        )}
        <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { add(e.target.files ?? []); e.target.value = ""; }} />
      </div>
      <p className="mt-1.5 text-[11.5px] text-white/55">Style guides the look, Character keeps someone looking the same, Place sets the scene, Product/Logo gets shown in the video. Tap a label to change it.</p>
      {error && <p className="mt-1 text-[12px] text-rose-300">{error}</p>}
    </div>
  );
}
