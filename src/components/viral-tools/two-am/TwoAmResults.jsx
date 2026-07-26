import { useState } from "react";
import { createPortal } from "react-dom";
import { Download, MoonStar, RefreshCw, X } from "lucide-react";
import TwoAmSceneCard from "./TwoAmSceneCard";
import TwoAmDemoCarousel from "./TwoAmDemoCarousel";
import TwoAmLoadingCard from "./TwoAmLoadingCard";
import { TWO_AM_TOTAL_CREDITS } from "./api/twoAmApi";
import { downloadFile, downloadImagesAsZip } from "./utils/twoAmHelpers";

export default function TwoAmResults({ phase, plannerStage, scenes, generation, error, recentGenerations, onOpenRecent, onRegenerate, onAnotherNight, recentOnly = false }) {
  const [expanded, setExpanded] = useState(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const active = phase === "planning" || phase === "generating";
  const hasResults = scenes.some((scene) => scene.imageUrl);
  const lockDesktopPreview = phase === "idle" && !hasResults;

  const downloadOne = async (scene, index) => {
    try { await downloadFile(scene.imageUrl, `2am-${String(index + 1).padStart(2, "0")}.jpg`); } catch (caught) { console.error(caught); }
  };
  const downloadAll = async () => {
    setDownloadingAll(true);
    try { await downloadImagesAsZip(scenes, `2am-in-${generation?.world || generation?.userPrompt || "slideshow"}`); } catch (caught) { console.error(caught); }
    finally { setDownloadingAll(false); }
  };

  return (
    <section className={`relative flex min-h-[520px] w-full flex-col overflow-hidden rounded-2xl border border-lime-300/[0.1] bg-[#0C0F0D] shadow-[inset_0_1px_0_rgba(190,242,100,.035)] ${lockDesktopPreview ? "lg:h-full lg:min-h-0" : "lg:min-h-full"}`}>
      <div className="pointer-events-none absolute -right-32 top-20 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(190,242,100,.045),transparent_68%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.04] [background-image:radial-gradient(rgba(190,242,100,.8)_1px,transparent_1px)] [background-size:28px_28px] [mask-image:linear-gradient(to_bottom,black,transparent_72%)]" />
      <div className="pointer-events-none absolute inset-x-16 top-0 h-px bg-gradient-to-r from-transparent via-lime-300/55 to-transparent" />
      <header className="relative z-[1] flex flex-wrap items-center justify-between gap-3 border-b border-lime-300/[0.07] px-5 py-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-lime-300">2AM Slideshow</p>
          <h2 className="mt-1 text-[15px] font-black text-white">{generation ? `2AM in ${generation.world || generation.userPrompt}` : recentOnly ? "Recent nights" : "Your six-image night"}</h2>
          {generation?.era && <p className="mt-0.5 text-[10px] text-white/30">{generation.era}</p>}
        </div>
        {hasResults && !active && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={onAnotherNight} className="flex items-center gap-1.5 rounded-xl border border-lime-300/15 bg-lime-300/[0.035] px-3 py-2 text-[10px] font-bold text-white/60 transition hover:border-lime-300/30 hover:bg-lime-300/[0.07] hover:text-white"><RefreshCw className="h-3.5 w-3.5 text-lime-300" />Create Another Night</button>
            <button type="button" onClick={downloadAll} disabled={downloadingAll} className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-lime-300 to-lime-500 px-3 py-2 text-[10px] font-black text-[#071006] shadow-[0_7px_20px_rgba(132,204,22,.14)] transition hover:brightness-110 disabled:opacity-50"><Download className="h-3.5 w-3.5" />{downloadingAll ? "Zipping..." : "Download All"}</button>
          </div>
        )}
      </header>

      <div className="relative z-[1] min-h-0 flex-1 p-4 sm:p-5">
        {recentOnly && phase === "idle" ? (
          <div className="min-h-[430px]">
            {recentGenerations.length > 0 ? (
              <div className="grid gap-3">
                {recentGenerations.map((row, generationIndex) => {
                  const completedScenes = (row.scenes ?? []).filter((scene) => scene.imageUrl);
                  return (
                    <button key={row.id} type="button" onClick={() => onOpenRecent(row)} className="group overflow-hidden rounded-2xl border border-lime-300/[0.09] bg-white/[0.025] p-3 text-left transition active:scale-[0.99] hover:border-lime-300/25 hover:bg-lime-300/[0.035]">
                      <div className="mb-3 grid grid-cols-3 gap-1.5 overflow-hidden rounded-xl">
                        {[0, 1, 2].map((index) => completedScenes[index]?.imageUrl ? (
                          <img
                            key={index}
                            src={completedScenes[index].imageUrl}
                            alt=""
                            loading={generationIndex === 0 ? "eager" : "lazy"}
                            fetchPriority={generationIndex === 0 ? "high" : "auto"}
                            decoding="async"
                            className="aspect-[9/12] w-full object-cover"
                          />
                        ) : (
                          <div key={index} className="grid aspect-[9/12] place-items-center bg-lime-300/[0.035]"><MoonStar className="h-4 w-4 text-lime-300/25" /></div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-black text-white/75 group-hover:text-white">2AM in {row.world || row.user_prompt}</p>
                          <p className="mt-1 text-[9px] font-medium text-white/30">{new Date(row.created_at).toLocaleDateString()} · {completedScenes.length}/6 images</p>
                        </div>
                        <span className="shrink-0 rounded-full border border-lime-300/15 bg-lime-300/[0.055] px-2.5 py-1 text-[9px] font-bold text-lime-300">Open</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-lime-300/[0.08] bg-black/20 px-3 py-5 text-center sm:px-5">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-lime-300">Preview nights</p>
                <p className="mb-5 mt-1 text-[10px] leading-relaxed text-white/30">See two 2AM worlds play side by side as TikTok slideshows.</p>
                <TwoAmDemoCarousel compact />
              </div>
            )}
          </div>
        ) : phase === "idle" && !hasResults ? (
          <div className="flex h-full min-h-[420px] flex-col lg:min-h-0">
            <div className="flex min-h-0 flex-1 items-stretch justify-center px-3 py-3 sm:px-6 lg:py-4">
              <TwoAmDemoCarousel fitHeight recentGenerations={recentGenerations} onOpenRecent={onOpenRecent} />
            </div>
          </div>
        ) : phase === "planning" && scenes.length === 0 ? (
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="relative aspect-[9/16] overflow-hidden rounded-2xl border border-lime-300/[0.07]">
                <TwoAmLoadingCard progress={[2, 7, 12][plannerStage] ?? 12} status="planning" />
                <div className="absolute left-2.5 top-2.5 z-20 grid h-7 w-7 place-items-center rounded-full border border-white/15 bg-black/45 text-[11px] font-black text-white backdrop-blur-md">{index + 1}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
            {scenes.map((scene, index) => <TwoAmSceneCard key={scene.id || index} scene={scene} index={index} onDownload={downloadOne} onRegenerate={onRegenerate} onExpand={setExpanded} />)}
          </div>
        )}

        {phase === "error" && error && (
          <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/[0.08] px-4 py-3 text-center text-[11px] font-semibold text-red-300">{error === "INSUFFICIENT_CREDITS" ? `You need ${TWO_AM_TOTAL_CREDITS} credits to create this slideshow.` : error}</div>
        )}
      </div>

      {expanded?.imageUrl && createPortal(
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/85 p-4 backdrop-blur-lg" onClick={() => setExpanded(null)}>
          <button type="button" aria-label="Close" onClick={() => setExpanded(null)} className="absolute right-5 top-5 grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-black/40 text-white/70"><X className="h-5 w-5" /></button>
          <div className="relative h-[min(88vh,1000px)] max-w-[90vw] overflow-hidden rounded-2xl border border-white/15 shadow-2xl" onClick={(event) => event.stopPropagation()}><img src={expanded.imageUrl} alt={expanded.title} className="h-full w-full object-contain" /></div>
        </div>, document.body
      )}
    </section>
  );
}
