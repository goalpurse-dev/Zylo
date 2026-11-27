import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { studioPath } from "../../data/styles";
import { LoopVideo } from "./StyleCard";
import Reveal from "./Reveal";
import { trackCreate, useStudios } from "./useCatalog";

/**
 * The four studios as big cards (the Create hub and Home use the same ones). A short-form studio shows its clips side
 * by side as tall 9:16 tiles; Long Form shows one wide 16:9 clip. Nothing is stretched or cropped (LoopVideo's Frame).
 */
export default function StudioCards({ placement = "create" }) {
  const studios = useStudios();
  return (
    <div className="grid gap-3 sm:grid-cols-2" data-testid="studio-cards">
      {studios.map((s, i) => {
        const wide = s.format === "16:9";
        const covers = s.covers?.length ? s.covers : [{ src: s.preview, poster: s.poster }];
        return (
          <Reveal key={s.id} delay={(i % 2) * 90 + Math.floor(i / 2) * 60}>
            <Link to={studioPath(s.id)} onClick={() => trackCreate("studio_opened", { target: s.id, placement })} className="group block overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#111314] p-2.5 transition hover:border-lime-300/40" data-testid={`studio-${s.id}`}>
              {/* every card's media row has the same height; tiles keep their own shape inside it */}
              <div className="flex h-[165px] items-center justify-center gap-1.5 overflow-hidden rounded-[14px] bg-black/40 sm:h-[250px]">
                {(wide ? covers.slice(0, 1) : covers.slice(0, 3)).map((c, n) => (
                  <div key={`${c.src ?? c.poster}-${n}`} className={`h-full max-w-full shrink overflow-hidden rounded-[12px] ${wide ? "aspect-video" : "aspect-[9/16]"}`}>
                    <LoopVideo src={c.src} poster={c.poster} className="h-full w-full" />
                  </div>
                ))}
              </div>
              <div className="flex items-end justify-between gap-3 px-1.5 pb-1 pt-3">
                <div className="min-w-0">
                  <p className="text-[19px] font-black leading-tight text-white">{s.name}</p>
                  <p className="mt-0.5 text-[13px] text-white/75">{s.line}</p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/[0.1] px-3 py-1 text-[12px] font-semibold text-white group-hover:bg-lime-300 group-hover:text-[#11150D]">
                  {s.count} {s.count === 1 ? "template" : "templates"} <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </Link>
          </Reveal>
        );
      })}
    </div>
  );
}
