import React, { useMemo, useState } from "react";
import { ArrowRight, Clock3, Film, Play, Skull, Sparkles } from "lucide-react";
import ToolGenerationLayout from "../viral/shared/ToolGenerationLayout";

const RECENT_PLACEHOLDERS = [
  {
    id: "rome",
    title: "Eating in Rome",
    status: "Draft UI",
    image: "/images/thumbs/viralskeleton.webp",
    time: "Just now",
  },
  {
    id: "rave",
    title: "Neon rave skeleton",
    status: "Template",
    image: "/styles/skeleton2.webp",
    time: "Preview",
  },
  {
    id: "ancient",
    title: "Ancient Greece fit check",
    status: "Template",
    image: "/images/thumbs/viralskeleton.webp",
    time: "Preview",
  },
];

const EXAMPLES = [
  "eating in Rome",
  "running from paparazzi in Paris",
  "trying luxury coffee in Dubai",
];

export default function SkeletonShorts() {
  const [idea, setIdea] = useState("");
  const [selectedExample, setSelectedExample] = useState(null);

  const previewTitle = useMemo(() => {
    const trimmed = idea.trim();
    if (!trimmed) return "Your skeleton short preview";
    return trimmed.length > 54 ? `${trimmed.slice(0, 54)}...` : trimmed;
  }, [idea]);

  const useExample = (example) => {
    setSelectedExample(example);
    setIdea(example);
  };

  return (
    <ToolGenerationLayout
      left={
        <SkeletonPromptPanel
          idea={idea}
          setIdea={(value) => {
            setSelectedExample(null);
            setIdea(value);
          }}
          selectedExample={selectedExample}
          onUseExample={useExample}
        />
      }
      right={
        <SkeletonPreviewPanel
          previewTitle={previewTitle}
          recentItems={RECENT_PLACEHOLDERS}
        />
      }
    />
  );
}

function SkeletonPromptPanel({ idea, setIdea, selectedExample, onUseExample }) {
  const canContinue = idea.trim().length > 0;

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#111315] shadow-2xl shadow-black/30">
      <div className="border-b border-white/10 p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
            <img
              src="/styles/skeleton2.webp"
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-black text-white">Skeleton Shorts</h1>
            <p className="mt-1 text-sm text-white/45">
              Turn one idea into a viral skeleton video.
            </p>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-5">
        <div className="mb-5">
          <h2 className="text-lg font-black text-white">Start With The Idea</h2>
          <p className="mt-1 text-sm text-white/45">
            Type the simple concept first. The prompt engine comes next.
          </p>
        </div>

        <div className="rounded-[22px] border border-white/10 bg-[#0d0f10] p-4">
          <label htmlFor="skeleton-idea" className="mb-3 block text-sm font-bold text-white">
            Type in your idea
          </label>
          <textarea
            id="skeleton-idea"
            value={idea}
            onChange={(event) => setIdea(event.target.value)}
            rows={6}
            placeholder="e.g. eating in Rome"
            className="min-h-[160px] w-full resize-none rounded-[18px] border border-white/10 bg-white/[0.04] p-4 text-[15px] leading-relaxed text-white outline-none transition placeholder:text-white/25 focus:border-white/25 focus:bg-white/[0.06]"
          />
        </div>

        <div className="mt-5">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-white/35">
            <Sparkles className="h-3.5 w-3.5" />
            Quick ideas
          </div>
          <div className="grid gap-2">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => onUseExample(example)}
                className={`rounded-[16px] border px-3.5 py-3 text-left text-sm font-semibold transition ${
                  selectedExample === example
                    ? "border-white/25 bg-white/[0.09] text-white"
                    : "border-white/10 bg-white/[0.03] text-white/55 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-auto pt-5">
          <button
            type="button"
            disabled={!canContinue}
            className={`flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-black transition ${
              canContinue
                ? "bg-white text-black hover:bg-white/90 active:scale-[0.99]"
                : "cursor-not-allowed bg-white/10 text-white/35"
            }`}
          >
            Next
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function SkeletonPreviewPanel({ previewTitle, recentItems }) {
  return (
    <div className="pb-24 lg:pb-4">
      <div className="rounded-[28px] border border-white/10 bg-[#111315] p-4 shadow-2xl shadow-black/30 sm:p-5">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-white">Reference Video</h2>
            <p className="mt-1 text-sm text-white/45">
              This is the visual direction for the skeleton shorts flow.
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold text-white/45">
            9:16
          </span>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(280px,430px)_1fr] xl:items-start">
          <div className="flex min-h-[58vh] items-center justify-center overflow-hidden rounded-[24px] border border-white/10 bg-[#0d0f10] p-4 sm:p-8 xl:min-h-[72vh]">
            <PhoneReferenceVideo title={previewTitle} />
          </div>

          <RecentSkeletonGenerations items={recentItems} />
        </div>
      </div>
    </div>
  );
}

function PhoneReferenceVideo({ title }) {
  return (
    <div className="relative mx-auto w-full max-w-[420px] rounded-[42px] border border-white/15 bg-[#050505] p-2.5 shadow-[0_28px_100px_rgba(0,0,0,0.55)]">
      <div className="overflow-hidden rounded-[34px] border border-white/10 bg-black">
        <div className="relative aspect-[9/19.5] w-full overflow-hidden bg-black">
          <video
            className="absolute inset-0 h-full w-full object-cover"
            src="/library/skeleton.mp4"
            autoPlay
            muted
            loop
            playsInline
            preload="none"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/70" />

          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 pt-4 text-[11px] font-semibold text-white/85">
            <span>9:41</span>
            <span className="rounded-full bg-black/35 px-2.5 py-1 backdrop-blur-md">
              Reference
            </span>
          </div>

          <div className="pointer-events-none absolute left-4 top-12 z-20 flex items-center gap-2 rounded-full border border-white/10 bg-black/45 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-white/80 backdrop-blur-md">
            <Skull className="h-3.5 w-3.5" />
            Skeleton Shorts
          </div>

          <div className="pointer-events-none absolute right-3 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-3">
            {[Play, Film, Clock3].map((Icon, index) => (
              <div
                key={index}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white shadow-lg backdrop-blur-md"
              >
                <Icon className="h-4 w-4" />
              </div>
            ))}
          </div>

          <div className="pointer-events-none absolute bottom-5 left-4 right-4 z-20 rounded-3xl border border-white/10 bg-black/45 p-4 backdrop-blur-xl">
            <div className="line-clamp-2 text-sm font-black leading-tight text-white sm:text-base">
              {title}
            </div>
            <div className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/70">
              Cinematic 3D skeleton character, vertical short, dramatic camera motion.
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-3 h-1.5 w-24 rounded-full bg-white/15" />
    </div>
  );
}

function RecentSkeletonGenerations({ items }) {
  return (
    <div>
      <div className="mb-4">
        <h3 className="text-lg font-bold text-white">Recent Generations</h3>
        <p className="mt-1 text-sm text-white/40">
          Your latest skeleton shorts will show here.
        </p>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="group rounded-[20px] border border-white/10 bg-white/[0.03] p-3 transition hover:border-white/15 hover:bg-white/[0.05]"
          >
            <div className="flex gap-3">
              <div className="h-24 w-16 shrink-0 overflow-hidden rounded-[14px] border border-white/10 bg-[#0d0f10]">
                <img
                  src={item.image}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="min-w-0 flex-1 py-1">
                <div className="line-clamp-2 text-sm font-bold text-white">
                  {item.title}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-white/35">
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1">
                    {item.status}
                  </span>
                  <span>{item.time}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-[18px] border border-dashed border-white/10 bg-white/[0.02] p-4 text-center text-xs font-semibold text-white/25">
        New renders will appear here.
      </div>
    </div>
  );
}
