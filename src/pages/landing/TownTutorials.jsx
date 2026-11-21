import { useState } from "react";
import { Play, Youtube } from "lucide-react";
import { trackSeoEvent } from "../../lib/seoAnalytics.js";
import { TOWN_TUTORIALS, getTutorial } from "../../data/inThisTownLanding.js";

// The owner's YouTube tutorials on the In This Town page and guides. A "lite" embed: the thumbnail and a play button
// first (no YouTube script, nothing tracked); the privacy-enhanced player loads only when the visitor taps it.

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0D0F]";

export function LiteYouTube({ video, slug, eager = false }) {
  const [on, setOn] = useState(false);
  return (
    <div className="relative aspect-video overflow-hidden rounded-[18px] border-2 border-white/10 bg-black">
      {on ? (
        <iframe
          src={`${video.embed}?autoplay=1&rel=0`}
          title={video.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      ) : (
        <button type="button" onClick={() => { setOn(true); trackSeoEvent("seo_tutorial_play", { slug, video: video.id }); }}
          className={`group absolute inset-0 h-full w-full ${FOCUS}`} aria-label={`Play the tutorial: ${video.label} (${video.length})`}>
          <picture>
            <source srcSet={video.thumb} type="image/webp" />
            <img src={video.thumbJpg} alt="" width={1280} height={720} loading={eager ? "eager" : "lazy"} decoding="async" className="absolute inset-0 h-full w-full object-cover" />
          </picture>
          <span className="absolute inset-0 bg-black/15 transition group-hover:bg-black/0" aria-hidden="true" />
          <span className="absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-2xl bg-lime-300 text-[#11150D] shadow-xl transition group-hover:scale-110" aria-hidden="true">
            <Play className="ml-1 h-8 w-8" fill="currentColor" />
          </span>
          <span className="absolute bottom-2 right-2 rounded-md bg-black/80 px-2 py-0.5 text-[13px] font-bold text-white">{video.length}</span>
        </button>
      )}
    </div>
  );
}

/** The landing page's grid of all tutorials. */
export function TutorialGrid({ slug }) {
  return (
    <ul className="grid gap-5 md:grid-cols-2">
      {TOWN_TUTORIALS.map((v) => (
        <li key={v.id} className="flex flex-col gap-3">
          <LiteYouTube video={v} slug={slug} />
          <div>
            <h3 className="text-[18px] font-black leading-snug text-white">{v.label}</h3>
            <p className="mt-1 text-[15px] leading-6 text-white/70">{v.blurb}</p>
            <a href={v.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-[14px] font-bold text-lime-200 hover:underline">
              <Youtube className="h-4 w-4" aria-hidden="true" />Watch on YouTube
            </a>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** A guide's block: one tutorial up front, the other two as links. */
export function TutorialBlock({ id, slug }) {
  const main = getTutorial(id);
  if (!main) return null;
  const more = TOWN_TUTORIALS.filter((v) => v.id !== id);
  return (
    <section className="my-12 rounded-[24px] border-2 border-lime-300/25 bg-[#11150d] p-4 sm:p-6" aria-labelledby={`tut-${id}`}>
      <p className="text-[12px] font-black uppercase tracking-[0.14em] text-lime-300">Video tutorial · {main.length}</p>
      <h2 id={`tut-${id}`} className="mt-1 text-[22px] font-black leading-tight text-white sm:text-[26px]">{main.label}</h2>
      <p className="mt-1 text-[15px] leading-6 text-white/70">{main.blurb}</p>
      <div className="mt-4"><LiteYouTube video={main} slug={slug} /></div>
      <p className="mt-4 text-[14px] font-bold text-white/60">More tutorials:</p>
      <ul className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {more.map((v) => (
          <li key={v.id}>
            <a href={v.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/15 px-3 text-[14px] font-bold text-white hover:border-lime-300/50">
              <Youtube className="h-4 w-4 text-lime-300" aria-hidden="true" />{v.label} <span className="text-white/50">{v.length}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
