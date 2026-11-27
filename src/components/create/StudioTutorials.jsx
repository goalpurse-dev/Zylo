import { useState } from "react";
import { Play } from "lucide-react";
import { tutorialThumb, tutorialsForStudio, youtubeVideoId } from "../../lib/tutorials";
import { trackCreate } from "./useCatalog";

/** One tutorial: YouTube's picture until it is tapped, then the real player (nothing from YouTube loads before that). */
function TutorialEmbed({ t, studioId }) {
  const [on, setOn] = useState(false);
  const id = youtubeVideoId(t.url);
  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]" data-testid="studio-tutorial">
      <div className="relative aspect-video w-full bg-black">
        {on ? (
          <iframe src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`} title={t.title} loading="lazy"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen className="absolute inset-0 h-full w-full" />
        ) : (
          <button type="button" onClick={() => { setOn(true); trackCreate("tutorial_play", { target: t.url, placement: `studio_${studioId}` }); }} className="group absolute inset-0" aria-label={`Play: ${t.title}`}>
            <img src={tutorialThumb(t)} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
            <span className="absolute inset-0 grid place-items-center bg-black/20">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-red-600 shadow-lg transition group-hover:scale-110"><Play className="ml-0.5 h-6 w-6 fill-white text-white" /></span>
            </span>
          </button>
        )}
      </div>
      <div className="p-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-lime-300/80">{t.toolName}</p>
        <p className="mt-1 line-clamp-2 text-[14px] font-semibold leading-snug text-white">{t.title}</p>
        <a href={t.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-bold text-white/75 hover:text-white">
          <svg viewBox="0 0 24 17" className="h-3 w-4" aria-hidden="true"><rect width="24" height="17" rx="4.5" fill="#FF0033" /><path d="M9.6 4.8v7.4l6.2-3.7z" fill="#fff" /></svg>Watch on YouTube
        </a>
      </div>
    </article>
  );
}

/** The bottom of a studio page: its tutorials (src/lib/tutorials.js, `studios`). Nothing when it has none. */
export default function StudioTutorials({ studioId }) {
  const list = tutorialsForStudio(studioId);
  if (!list.length) return null;
  return (
    <section className="mt-14" aria-labelledby="studio-tutorials" data-testid="studio-tutorials">
      <h2 id="studio-tutorials" className="text-[20px] font-black text-white">Tutorials</h2>
      <p className="mt-0.5 text-[13.5px] text-white/70">Watch how it's made, step by step.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((t) => <TutorialEmbed key={t.url} t={t} studioId={studioId} />)}
      </div>
    </section>
  );
}
