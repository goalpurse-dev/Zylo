import { Film, PlayCircle, Sparkles } from "lucide-react";
import { ErrorBanner, PrimaryButton, ProgressBar, SegmentedControl } from "../../../ui/zyvo";
import { TUTORIAL_URL, formatLength, timeAgo } from "../constants";
import Showcase from "./Showcase";

const RECENT_TABS = [
  { value: "single", label: "Single videos" },
  { value: "series", label: "Series" },
];

/**
 * Right panel when nothing is being made: hero, then the showcase or Recent creations.
 *   viewer "guest"  → real videos playing + "Sign up to create your own" (the sign-up popup)
 *   viewer "noPlan" → the same videos + "Upgrade your plan to make videos like these", "See plans" (the pricing page)
 *   viewer "paid"   → their history; with none yet, the videos + "Make your first story"
 * showSeries false (series is behind its own switch): no "Series" tab, single videos only.
 */
export default function IdleView({ recentTab, onRecentTab, recent, onOpenSingle, onOpenSeries, showHero = true, showSeries = true, viewer = "paid", onSignUp, onUpgrade, onStart, onLookAround }) {
  const paid = viewer === "paid";
  return (
    <div className="flex flex-col gap-6">
      {showHero && (
        <div>
          <div className="flex items-center gap-2 text-lime-300">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            <span className="text-[10px] font-black uppercase tracking-[0.18em]">Blocky Stories</span>
          </div>
          <h2 className="mt-2 text-[27px] font-black leading-[1.03] tracking-[-0.045em] text-white sm:text-[34px]">
            Blocky stories that talk.<br />
            <span className="text-lime-300">Made in minutes.</span>
          </h2>
          {/* With the showcase under it, a phone keeps this short so the button is on the first screen. */}
          <p className={`mt-2 max-w-[620px] text-[12px] font-medium leading-relaxed text-white/45 ${paid ? "" : "hidden sm:block"}`}>
            Pick an idea, describe a story or paste your own script. You check every scene picture before anything is animated, and you only pay for video once you&apos;re happy.
          </p>
        </div>
      )}

      {viewer === "guest" && (
        <Showcase
          message="Sign up to create your own"
          sub="Free to join. Pick your characters, pick a story, and watch them act it out."
          action="Sign up"
          onAction={onSignUp}
          secondary="Look around first"
          onSecondary={onLookAround}
        />
      )}
      {viewer === "noPlan" && (
        <Showcase
          message="Upgrade your plan to make videos like these"
          sub="Story ideas are free to try. Videos start on the Starter plan."
          action="See plans"
          onAction={onUpgrade}
          secondary="Try the free story ideas"
          onSecondary={onLookAround}
        />
      )}

      {paid && <section aria-labelledby="fv2-recent-title">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 id="fv2-recent-title" className="text-[14px] font-black text-white">Recent creations</h3>
            <p className="mt-0.5 text-[10px] font-semibold text-white/30">{showSeries ? "Pick up any story or series where you left off." : "Pick up any story where you left off."}</p>
          </div>
          {showSeries && <SegmentedControl ariaLabel="Show" options={RECENT_TABS} value={recentTab} onChange={onRecentTab} className="w-full sm:w-[240px]" />}
        </div>

        {recent.status === "error" ? (
          <ErrorBanner action="Try again" onAction={recent.retry}>We couldn&apos;t load your recent creations. Check your connection and try again.</ErrorBanner>
        ) : recent.status === "loading" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading recent creations">
            {[0, 1, 2].map((i) => <div key={i} className="h-[260px] animate-pulse rounded-2xl border border-white/[0.07] bg-white/[0.035] motion-reduce:animate-none" />)}
          </div>
        ) : recent.items.length === 0 ? (
          recentTab === "series" ? (
            <div className="grid min-h-[180px] place-items-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-5 text-center">
              <div>
                <p className="text-[12px] font-bold text-white/70">No series yet</p>
                <p className="mt-1 text-[11px] font-semibold leading-relaxed text-white/30">Your series will show up here.</p>
              </div>
            </div>
          ) : (
            <Showcase message="Make your first story" sub="Here are two we made. Yours shows up here when it's done." action="Make your first story" onAction={onStart} />
          )
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {recent.items.map((item) => (
              <RecentCard key={item.id} item={item} onOpen={() => (item.type === "series" ? onOpenSeries(item.id) : onOpenSingle(item.id))} />
            ))}
          </div>
        )}
      </section>}

      {TUTORIAL_URL && (
        <a href={TUTORIAL_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 self-start text-[12px] font-bold text-lime-300 hover:text-lime-200">
          <PlayCircle className="h-4 w-4" aria-hidden="true" />
          Watch the tutorial
        </a>
      )}
    </div>
  );
}


function RecentCard({ item, onOpen }) {
  const isSeries = item.type === "series";
  const finished = isSeries && item.madeCount >= item.episodeCount;
  // The story's first 3 scene pictures; a scene without a picture yet is a blank tile.
  const thumbs = [0, 1, 2].map((i) => item.thumbUrls?.[i] ?? null);
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111315]/95 shadow-[0_8px_32px_rgba(0,0,0,.45)]">
      <div className="grid grid-cols-3 gap-0.5 p-0.5" aria-hidden="true">
        {thumbs.map((src, i) => (src
          ? <img key={i} src={src} alt="" className="aspect-[9/14] w-full rounded-xl object-cover" loading="lazy" />
          : (
            <div key={i} className="grid aspect-[9/14] place-items-center rounded-xl bg-white/[0.04]">
              <Film className="h-5 w-5 text-white/15" />
            </div>
          )))}
      </div>
      <div className="flex flex-1 flex-col gap-1 px-3.5 pb-3.5 pt-2.5">
        <h4 className="text-[13px] font-black leading-snug text-white">{item.title}</h4>
        <p className="text-[10px] font-semibold text-white/40">
          {isSeries
            ? `Episode ${Math.min(item.madeCount, item.episodeCount)} of ${item.episodeCount} · ${timeAgo(item.createdAt)}`
            : `${formatLength(item.lengthSec)} · ${item.status === "final_ready" ? "" : "In progress · "}${timeAgo(item.createdAt)}`}
        </p>
        {isSeries && <ProgressBar value={(item.madeCount / item.episodeCount) * 100} label={`${item.madeCount} of ${item.episodeCount} episodes made`} className="mt-1.5" />}
        <div className="mt-auto pt-2.5">
          <PrimaryButton variant="secondary" size="sm" onClick={onOpen}>
            {isSeries ? (finished ? "View series" : `Continue with episode ${item.madeCount + 1}`) : "Open"}
          </PrimaryButton>
        </div>
      </div>
    </article>
  );
}
