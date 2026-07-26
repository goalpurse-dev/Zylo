import { Download, Expand, RefreshCw } from "lucide-react";
import TwoAmLoadingCard from "./TwoAmLoadingCard";
import { TWO_AM_CREDITS_PER_IMAGE } from "./api/twoAmApi";
import { displayImageUrl } from "./utils/twoAmHelpers";

export default function TwoAmSceneCard({ scene, index, onDownload, onRegenerate, onExpand }) {
  const loading = scene.status === "queued" || scene.status === "generating";
  const progress = Math.max(0, Math.min(100, Math.round(Number(scene.progress ?? 0))));
  return (
    <article
      className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0B0D0F] shadow-[0_12px_34px_rgba(0,0,0,.22)] [contain:layout_paint_style] [content-visibility:auto]"
      style={{ containIntrinsicSize: "320px 600px" }}
    >
      <div className="relative aspect-[9/16] overflow-hidden bg-gradient-to-br from-[#171329] via-[#101521] to-[#091518]">
        {loading ? (
          <TwoAmLoadingCard progress={progress} status={scene.status} />
        ) : scene.imageUrl ? (
          <img
            src={displayImageUrl(scene.imageUrl, 720)}
            alt={scene.title || `2AM scene ${index + 1}`}
            loading="lazy"
            decoding="async"
            onError={(event) => {
              if (event.currentTarget.dataset.fallbackApplied) return;
              event.currentTarget.dataset.fallbackApplied = "true";
              event.currentTarget.src = scene.imageUrl;
            }}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_35%_25%,rgba(190,242,100,.16),transparent_32%),radial-gradient(circle_at_70%_70%,rgba(132,204,22,.08),transparent_38%)]" />
            <div className="absolute bottom-[22%] left-[15%] right-[15%] h-[22%] rounded-[40%_40%_8%_8%] bg-white/[0.025] blur-sm" />
          </div>
        )}

        <div className="absolute left-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-full border border-white/15 bg-black/70 text-[11px] font-black text-white">{index + 1}</div>

        {scene.status === "failed" && !scene.imageUrl && (
          <div className="absolute inset-0 grid place-items-center bg-black/45 px-5 text-center">
            <div><p className="text-[12px] font-bold text-red-300">Scene failed</p><p className="mt-1 text-[9px] leading-relaxed text-white/35">Its reserved credits were refunded.</p></div>
          </div>
        )}

        {scene.imageUrl && (
          <div className="absolute inset-x-2.5 bottom-2.5 flex translate-y-1 items-center justify-center gap-1.5 opacity-100 transition sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100">
            <button type="button" onClick={() => onDownload(scene, index)} title="Download" className="grid h-9 w-9 place-items-center rounded-xl border border-white/15 bg-black/80 text-white/75 transition hover:bg-black hover:text-white"><Download className="h-4 w-4" /></button>
            <button type="button" onClick={() => onRegenerate(index)} disabled={loading} title={`Regenerate scene (${TWO_AM_CREDITS_PER_IMAGE} credits)`} className="grid h-9 w-9 place-items-center rounded-xl border border-white/15 bg-black/80 text-white/75 transition hover:bg-black hover:text-white disabled:opacity-40"><RefreshCw className="h-4 w-4" /></button>
            <button type="button" onClick={() => onExpand(scene)} title="Expand" className="grid h-9 w-9 place-items-center rounded-xl border border-white/15 bg-black/80 text-white/75 transition hover:bg-black hover:text-white"><Expand className="h-4 w-4" /></button>
          </div>
        )}
      </div>
      <div className="border-t border-white/[0.06] px-3 py-2.5">
        <p className="truncate text-[11px] font-bold text-white/70">{scene.title || `Scene ${index + 1}`}</p>
        <p className="mt-0.5 truncate text-[9px] text-white/28">{scene.location || "Somewhere after midnight"}</p>
        {scene.error && scene.imageUrl && <p className="mt-1 text-[9px] text-orange-300/70">{scene.error}</p>}
      </div>
    </article>
  );
}
