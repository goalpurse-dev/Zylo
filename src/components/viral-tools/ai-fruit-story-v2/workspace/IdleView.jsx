import { Sparkles } from "lucide-react";
import { ErrorBanner, PrimaryButton, ProgressBar, SegmentedControl } from "../../../ui/zyvo";
import { formatLength, timeAgo } from "../constants";
import { Avatar } from "../shared/Avatar";

const RECENT_TABS = [
  { value: "single", label: "Single videos" },
  { value: "series", label: "Series" },
];

/** Right panel when nothing is being made: hero + Recent creations. */
export default function IdleView({ recentTab, onRecentTab, recent, byId, onOpenSingle, onOpenSeries, showHero = true }) {
  return (
    <div className="flex flex-col gap-6">
      {showHero && (
        <div>
          <div className="flex items-center gap-2 text-lime-300">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            <span className="text-[10px] font-black uppercase tracking-[0.18em]">AI Fruit Story</span>
          </div>
          <h2 className="mt-2 text-[27px] font-black leading-[1.03] tracking-[-0.045em] text-white sm:text-[34px]">
            Messy fruit drama.<br />
            <span className="text-lime-300">Made in minutes.</span>
          </h2>
          <p className="mt-2 max-w-[620px] text-[12px] font-medium leading-relaxed text-white/45">
            Pick a ready idea or bring your own story. You check every scene picture before anything is animated, and you only pay for video once you&apos;re happy.
          </p>
        </div>
      )}

      <section aria-labelledby="fv2-recent-title">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 id="fv2-recent-title" className="text-[14px] font-black text-white">Recent creations</h3>
            <p className="mt-0.5 text-[10px] font-semibold text-white/30">Pick up any story or series where you left off.</p>
          </div>
          <SegmentedControl ariaLabel="Show" options={RECENT_TABS} value={recentTab} onChange={onRecentTab} className="w-full sm:w-[240px]" />
        </div>

        {recent.status === "error" ? (
          <ErrorBanner action="Try again" onAction={recent.retry}>We couldn&apos;t load your recent creations. Check your connection and try again.</ErrorBanner>
        ) : recent.status === "loading" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading recent creations">
            {[0, 1, 2].map((i) => <div key={i} className="h-[260px] animate-pulse rounded-2xl border border-white/[0.07] bg-white/[0.035] motion-reduce:animate-none" />)}
          </div>
        ) : recent.items.length === 0 ? (
          <div className="grid min-h-[180px] place-items-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-5 text-center">
            <div>
              <p className="text-[12px] font-bold text-white/70">Nothing here yet</p>
              <p className="mt-1 text-[11px] font-semibold leading-relaxed text-white/30">
                {recentTab === "series" ? "Your series will show up here." : "Your finished videos will show up here."}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {recent.items.map((item) => (
              <RecentCard key={item.id} item={item} byId={byId} onOpen={() => (item.type === "series" ? onOpenSeries(item.id) : onOpenSingle(item.id))} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function RecentCard({ item, byId, onOpen }) {
  const isSeries = item.type === "series";
  const finished = isSeries && item.madeCount >= item.episodeCount;
  const thumbs = item.thumbUrls?.length ? item.thumbUrls : null;
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111315]/95 shadow-[0_8px_32px_rgba(0,0,0,.45)]">
      <div className="grid grid-cols-3 gap-0.5 p-0.5" aria-hidden="true">
        {thumbs
          ? thumbs.slice(0, 3).map((src, i) => <img key={i} src={src} alt="" className="aspect-[9/14] w-full rounded-xl object-cover" loading="lazy" />)
          : item.castIds.slice(0, 3).map((id) => (
            <div key={id} className="grid aspect-[9/14] place-items-center rounded-xl bg-white/[0.04]">
              <Avatar character={byId(id)} size="h-12 w-12" ring={false} />
            </div>
          ))}
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
