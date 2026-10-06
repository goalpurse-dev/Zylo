import { Film, PlayCircle, Sparkles } from "lucide-react";
import { ErrorBanner, PrimaryButton, ProgressBar, SegmentedControl } from "../../../ui/zyvo";
import { EXAMPLE_VIDEO, TUTORIAL_URL, formatLength, timeAgo } from "../constants";

const RECENT_TABS = [
  { value: "single", label: "Single videos" },
  { value: "series", label: "Series" },
];

/**
 * Right panel when nothing is being made: hero + Recent creations.
 *   viewer "guest"  → the example video + "Sign up to make your own"
 *   viewer "noPlan" → the example video + "Get a plan to make videos like this"
 *   viewer "paid"   → their history; with none yet, "Make your first story" + the example
 */
export default function IdleView({ recentTab, onRecentTab, recent, byId, onOpenSingle, onOpenSeries, showHero = true, viewer = "paid", onSignUp, onGetPlan, onStart }) {
  const paid = viewer === "paid";
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

      {!paid && (
        <ExampleVideo
          heading={viewer === "guest" ? "See what you can make" : "Made with AI Fruit Story"}
          action={viewer === "guest" ? "Sign up to make your own" : "Get a plan to make videos like this"}
          onAction={viewer === "guest" ? onSignUp : onGetPlan}
        />
      )}

      {paid && <section aria-labelledby="fv2-recent-title">
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
          recentTab === "series" ? (
            <div className="grid min-h-[180px] place-items-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-5 text-center">
              <div>
                <p className="text-[12px] font-bold text-white/70">No series yet</p>
                <p className="mt-1 text-[11px] font-semibold leading-relaxed text-white/30">Your series will show up here.</p>
              </div>
            </div>
          ) : (
            <ExampleVideo heading="Make your first story" sub="Here's one we made. Yours shows up here when it's done." action="Make your first story" onAction={onStart} />
          )
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {recent.items.map((item) => (
              <RecentCard key={item.id} item={item} byId={byId} onOpen={() => (item.type === "series" ? onOpenSeries(item.id) : onOpenSingle(item.id))} />
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

/** The example video card with one call to action. */
function ExampleVideo({ heading, sub, action, onAction }) {
  return (
    <section aria-label={heading} className="flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-[#111315]/95 p-3 sm:flex-row sm:items-center sm:p-4">
      <video
        src={EXAMPLE_VIDEO.url}
        poster={EXAMPLE_VIDEO.poster}
        controls
        playsInline
        preload="none"
        className="order-2 aspect-[9/16] w-full max-w-[220px] self-center rounded-xl bg-black object-cover sm:order-1 sm:max-w-[240px] sm:self-auto"
        aria-label={`Example video: ${EXAMPLE_VIDEO.title}`}
      />
      <div className="order-1 flex min-w-0 flex-col gap-2 sm:order-2">
        <h3 className="text-[16px] font-black text-white">{heading}</h3>
        <p className="text-[12px] font-semibold leading-relaxed text-white/45">
          {sub ?? <>&ldquo;{EXAMPLE_VIDEO.title}&rdquo;: {EXAMPLE_VIDEO.blurb}</>}
        </p>
        {onAction && <div className="pt-1"><PrimaryButton onClick={onAction}>{action}</PrimaryButton></div>}
      </div>
    </section>
  );
}

function RecentCard({ item, byId, onOpen }) {
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
            : `${formatLength(item.lengthSec)} · ${item.legacy ? "Earlier version · " : item.status === "final_ready" ? "" : "In progress · "}${timeAgo(item.createdAt)}`}
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
