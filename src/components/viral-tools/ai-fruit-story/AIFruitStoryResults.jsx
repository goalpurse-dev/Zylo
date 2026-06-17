import React, { useEffect, useMemo, useState } from "react";
import {
  buildVideoClipsFromScenes,
} from "./api/fruitStoryApi";

const HEARTS = [
  { id: 1, left: "82%", delay: "0s",   duration: "4.2s", size: "18px", drift: "8px"   },
  { id: 2, left: "86%", delay: "0.6s", duration: "4.8s", size: "16px", drift: "-10px" },
  { id: 3, left: "80%", delay: "1.2s", duration: "5.1s", size: "20px", drift: "12px"  },
  { id: 4, left: "88%", delay: "1.8s", duration: "4.4s", size: "15px", drift: "-8px"  },
  { id: 5, left: "84%", delay: "2.3s", duration: "5.3s", size: "17px", drift: "10px"  },
  { id: 6, left: "90%", delay: "2.9s", duration: "4.7s", size: "19px", drift: "-12px" },
  { id: 7, left: "83%", delay: "3.5s", duration: "5.5s", size: "14px", drift: "7px"   },
  { id: 8, left: "87%", delay: "4.1s", duration: "4.6s", size: "18px", drift: "-9px"  },
];

function isValidImageSrc(value) {
  const src = typeof value === "string" ? value.trim() : "";
  if (/^data:image\//i.test(src) || /^blob:/i.test(src)) return true;
  if (!/^https?:\/\//i.test(src)) return false;

  let parsed;
  try {
    parsed = new URL(src);
  } catch {
    return false;
  }

  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();

  if (host === "runware.ai" && path.includes("/docs/")) return false;

  return (
    src.length > 0 &&
    src !== "undefined" &&
    src !== "null" &&
    !src.startsWith("[object ") &&
    (
      host === "im.runware.ai" ||
      path.includes("/image/") ||
      path.includes("/storage/v1/object/") ||
      /\.(png|jpe?g|webp|gif|avif)$/i.test(path)
    )
  );
}

function resolveSceneImageSrc(scene) {
  const raw =
    scene?.imageUrl ||
    scene?.result_url ||
    scene?.resultUrl ||
    scene?.imageResultUrl ||
    scene?.imageJob?.result_url ||
    scene?.imageJob?.resultUrl ||
    scene?.imageJob?.output?.result_url ||
    scene?.imageJob?.output?.resultUrl ||
    scene?.imageJob?.output?.imageUrl ||
    scene?.imageJob?.output?.image_url ||
    scene?.imageJob?.output?.imageURL ||
    scene?.imageJob?.output?.url ||
    scene?.imageJob?.output?.data?.[0]?.url ||
    scene?.imageJob?.output?.data?.[0]?.imageURL ||
    scene?.imageJob?.output?.data?.[0]?.imageUrl ||
    scene?.imageJob?.output?.results?.[0]?.url ||
    scene?.imageJob?.output?.results?.[0]?.imageURL ||
    scene?.imageJob?.output?.results?.[0]?.imageUrl ||
    null;

  if (!isValidImageSrc(raw)) return null;

  return raw.trim();
}

function getDisplayImageSrc(scene) {
  const raw = resolveSceneImageSrc(scene);
  if (!raw) return null;

  if (/^(data:image\/|blob:)/i.test(raw)) return raw;

  if (raw.includes("?")) return raw;

  return `${raw}?format=webp&width=800`;
}

export default function AIFruitStoryResults({
  form,
  scenes = [],
  videoClips = [],
  phase,
  stepIndex,
  recentGenerations = [],
  isLoadingRecent   = false,
  onEditOptions,
  onRegenerateScene,
  onContinueGeneration,
  onDeleteGeneration,
  mobileRecentTab   = false,
}) {
  const [selectedSceneIndex, setSelectedSceneIndex] = useState(0);
  const [regenSceneIndex, setRegenSceneIndex] = useState(null);
  const [regenPrompt, setRegenPrompt] = useState("");
  const [isRegenerating, setIsRegenerating] = useState(false);

  const sceneAspect = form.sceneAspect || "9:16";
  const sceneCount  = form.sceneCount  || 5;
  const regenScene = regenSceneIndex === null ? null : scenes[regenSceneIndex];
  const derivedVideoClips = useMemo(() => {
    return videoClips.length ? videoClips : buildVideoClipsFromScenes(scenes);
  }, [scenes, videoClips]);

  useEffect(() => {
    setSelectedSceneIndex(0);
  }, [stepIndex, sceneCount, sceneAspect]);

  const openRegenerateModal = (index) => {
    const scene = scenes[index];
    setRegenSceneIndex(index);
    setRegenPrompt(scene?.imagePrompt ?? "");
  };

  const closeRegenerateModal = () => {
    if (isRegenerating) return;
    setRegenSceneIndex(null);
    setRegenPrompt("");
  };

  const submitRegenerate = async () => {
    if (regenSceneIndex === null || !onRegenerateScene) return;
    setIsRegenerating(true);
    try {
      await onRegenerateScene(regenSceneIndex, regenPrompt);
      setRegenSceneIndex(null);
      setRegenPrompt("");
    } finally {
      setIsRegenerating(false);
    }
  };

  /* ── Step 0: phone mockup + recent generations ── */
  if (stepIndex === 0) {
    // Mobile Recent tab: show only the panel
    if (mobileRecentTab) {
      return (
        <div className="pb-24 lg:pb-4">
          <div className="rounded-[28px] border border-white/10 bg-[#111315] p-4 shadow-2xl shadow-black/30 sm:p-5">
            <RecentGenerationsPanel
              generations={recentGenerations}
              isLoading={isLoadingRecent}
              onContinue={onContinueGeneration}
              onDelete={onDeleteGeneration}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="pb-24 lg:pb-4">
        <div className="rounded-[28px] border border-white/10 bg-[#111315] p-4 shadow-2xl shadow-black/30 sm:p-5">
          <div className="mb-5">
            <h2 className="text-xl font-bold text-white">Video Preview</h2>
            <p className="mt-1 text-sm text-white/45">
              Example of what your fruit story can look like.
            </p>
          </div>

          {/* Desktop: phone on left, recent generations on right */}
          <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(260px,380px)_1fr] lg:items-start">
            <div className="flex min-h-[60vh] items-center justify-center overflow-hidden rounded-[24px] border border-white/10 bg-[#0d0f10] p-4 lg:min-h-[72vh] sm:p-8">
              <PhoneVideoMockup
                title={form.storyIdea || "Your fruit story preview"}
                subtitle={form.conflict || "Betrayal / drama preview"}
              />
            </div>

            {/* Recent panel — hidden on mobile (mobile uses the Recent tab) */}
            <div className="hidden lg:block">
              <RecentGenerationsPanel
                generations={recentGenerations}
                isLoading={isLoadingRecent}
                onContinue={onContinueGeneration}
                onDelete={onDeleteGeneration}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Step 1: scene image results ── */
  if (stepIndex === 1) {
    const isGenerating = phase === "planning" || phase === "generating-scenes";
    const hasScenes    = scenes.length > 0;

    return (
      <div className="flex min-h-[calc(100vh-110px)] pb-24 lg:min-h-full lg:pb-4">
        <div className="flex min-h-[calc(100vh-130px)] w-full flex-col rounded-[28px] border border-white/10 bg-[#111315] p-4 shadow-2xl shadow-black/30 sm:p-5 lg:min-h-full">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-white">Scene Results</h2>
              <p className="mt-1 text-sm text-white/45">
                {isGenerating
                  ? "Generating your scenes…"
                  : hasScenes
                  ? "Your generated scenes appear below."
                  : "Generate your scenes on the left."}
                </p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-1.5">
              <AspectBadge value={sceneAspect} />
            </div>
          </div>

          {!hasScenes && !isGenerating ? (
            <EmptyState
              icon="🎨"
              title="No scenes yet"
              body="Once generated, your scene images will show here."
            />
          ) : (
            <div
              className={`grid gap-4 ${
                sceneAspect === "16:9" ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"
              }`}
            >
              {scenes.map((scene, index) => (
                <SceneImageCard
                  key={scene.id || scene.sceneNumber}
                  scene={scene}
                  index={index}
                  aspect={sceneAspect}
                  active={selectedSceneIndex === index}
                  onClick={() => setSelectedSceneIndex(index)}
                  onRegenerate={onRegenerateScene ? () => openRegenerateModal(index) : null}
                />
              ))}

              {/* Placeholder skeleton cards if still generating and fewer scenes than expected */}
              {isGenerating &&
                Array.from({ length: Math.max(0, sceneCount - scenes.length) }).map((_, i) => (
                  <SceneSkeleton key={`sk-${i}`} index={scenes.length + i} aspect={sceneAspect} />
                ))}
            </div>
          )}
        </div>
        {regenScene && (
          <RegenerateSceneModal
            scene={regenScene}
            prompt={regenPrompt}
            onPromptChange={setRegenPrompt}
            onCancel={closeRegenerateModal}
            onSubmit={submitRegenerate}
            isSubmitting={isRegenerating}
          />
        )}
      </div>
    );
  }

  /* Step 2: animation results */
  const isAnimating = phase === "animating";
  const hasScenes   = scenes.length > 0;
  const clipCount   = derivedVideoClips.length;
  const hasVideoOutputs =
    phase === "animating" ||
    phase === "done" ||
    derivedVideoClips.some((clip) => clip.videoJobId || clip.videoUrl || (clip.videoStatus && clip.videoStatus !== "idle"));
  const readyScenes = scenes.filter((scene) => scene?.imageUrl);

  return (
    <div className="flex min-h-[calc(100vh-110px)] pb-24 lg:min-h-full lg:pb-4">
      <div className="flex min-h-[calc(100vh-130px)] w-full flex-col rounded-[28px] border border-white/10 bg-[#111315] p-4 shadow-2xl shadow-black/30 sm:p-5 lg:min-h-full">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-white">{hasVideoOutputs ? "Videos" : "Scenes"}</h2>
            <p className="mt-1 text-sm text-white/45">
              {hasVideoOutputs
                ? isAnimating ? "Rendering your animation outputs..." : "Final video previews appear here."
                : readyScenes.length > 0 ? "Generated scene images ready to animate." : "Generate scenes first."}
            </p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1.5">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-semibold text-white/45 whitespace-nowrap">
              {hasVideoOutputs ? `${clipCount} videos` : `${readyScenes.length} scenes`}
            </span>
            <AspectBadge value={sceneAspect} />
          </div>
        </div>

        {!hasScenes ? (
          <EmptyState
            icon="Video"
            title="No scenes yet"
            body="Generated scene images will appear here."
          />
        ) : hasVideoOutputs ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {derivedVideoClips.map((clip) => (
              <VideoOutputCard
                key={clip.clipNumber}
                clip={clip}
                aspect={sceneAspect}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {readyScenes.map((scene, index) => (
              <AnimationScenePreviewCard
                key={scene.id || scene.sceneNumber || index}
                scene={scene}
                index={index}
                aspect={sceneAspect}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
/* ─── Scene image card ─── */
function getAspectClass(aspect) {
  return aspect === "16:9" ? "aspect-[16/9]" :
    aspect === "1:1" ? "aspect-square" :
    "aspect-[9/16]";
}

function AnimationScenePreviewCard({ scene, index, aspect }) {
  const imageSrc = getDisplayImageSrc(scene);
  return (
    <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-3">
      <div className="mb-2 text-sm font-bold text-white">Scene {scene.sceneNumber || index + 1}</div>
      <div className={`relative mx-auto max-h-[260px] max-w-[190px] overflow-hidden rounded-[16px] border border-white/10 bg-[#0d0f10] ${getAspectClass(aspect)}`}>
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={`Scene ${scene.sceneNumber || index + 1}`}
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <ScenePlaceholder index={index} progress={scene.imageProgress ?? 0} />
        )}
      </div>
    </div>
  );
}

function VideoOutputCard({ clip, aspect }) {
  const isBusy = !clip.videoUrl && (
    clip.videoStatus === "queued" ||
    clip.videoStatus === "running" ||
    clip.videoStatus === "processing" ||
    clip.videoStatus === "idle"
  );
  const isFailed = !clip.videoUrl && clip.videoStatus === "failed";
  const progress = clip.videoProgress ?? 0;

  return (
    <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-sm font-bold text-white">{clip.outputLabel || `Video ${clip.clipNumber}`}</div>
        <ClipStatusBadge status={clip.videoStatus} />
      </div>
      <div className={`relative mx-auto max-h-[260px] max-w-[190px] overflow-hidden rounded-[16px] border border-white/10 bg-[#0d0f10] ${getAspectClass(aspect)}`}>
        {clip.videoUrl ? (
          <video
            src={clip.videoUrl}
            className="h-full w-full object-cover"
            controls
            playsInline
            preload="none"
          />
        ) : isFailed ? (
          <div className="flex h-full min-h-[220px] items-center justify-center bg-red-500/10 p-4 text-center text-xs font-semibold text-red-200">
            Animation failed
          </div>
        ) : isBusy ? (
          <VideoLoadingMockup progress={progress} />
        ) : (
          <VideoLoadingMockup progress={0} />
        )}
      </div>
      {clip.videoUrl && (
        <a
          href={clip.videoUrl}
          download={`ai-fruit-video-${clip.clipNumber}.mp4`}
          target="_blank"
          rel="noreferrer"
          className="mt-2 block rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-center text-xs font-semibold text-white/75 transition hover:bg-white/[0.09]"
        >
          Download
        </a>
      )}
    </div>
  );
}

function RegenerateSceneModal({
  scene,
  prompt,
  onPromptChange,
  onCancel,
  onSubmit,
  isSubmitting,
}) {
  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-2xl rounded-[24px] border border-white/10 bg-[#151719] p-4 shadow-2xl shadow-black/50 sm:p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-white">
              Regenerate {scene.title || `Scene ${scene.sceneNumber}`}
            </h3>
            <p className="mt-1 text-xs text-white/45">
              Edit the scene prompt. Only this scene will be regenerated.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/60 transition hover:bg-white/[0.08] disabled:opacity-40"
          >
            Cancel
          </button>
        </div>

        <textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          className="min-h-[220px] w-full resize-y rounded-[18px] border border-white/10 bg-[#0d0f10] p-3 text-sm leading-relaxed text-white outline-none transition placeholder:text-white/25 focus:border-purple-300/45"
          placeholder="Describe the regenerated scene..."
        />

        <div className="mt-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="h-11 rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-sm font-bold text-white/70 transition hover:bg-white/[0.08] disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting || !prompt.trim()}
            className="h-11 rounded-2xl bg-white px-5 text-sm font-black text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/35"
          >
            {isSubmitting ? "Regenerating..." : "Regenerate"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SceneImageCard({ scene, index, aspect, active, onClick, onRegenerate }) {
  const aspectClass =
    aspect === "16:9" ? "aspect-[16/9]" :
    aspect === "1:1"  ? "aspect-square"  :
                        "aspect-[9/16]";

  const imageSrc = getDisplayImageSrc(scene);

  console.log("[fruit render]", {
    sceneNumber: scene.sceneNumber,
    imageStatus: scene.imageStatus,
    imageUrl: scene.imageUrl,
    imageJobResultUrl: scene.imageJob?.result_url,
    output: scene.imageJob?.output,
    resolvedImageSrc: imageSrc,
    imageUrlType: typeof scene.imageUrl,
  });

  const isBusy =
    scene.imageStatus === "queued" ||
    scene.imageStatus === "running" ||
    scene.imageStatus === "processing";
  const isDone = !!imageSrc || scene.imageStatus === "succeeded";
  const isFailed = !imageSrc && scene.imageStatus === "failed";
  const progress = scene.imageProgress ?? 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      aria-label={`Scene ${index + 1} ${isDone ? "ready" : isBusy ? "generating" : isFailed ? "failed" : ""}`.trim()}
      className={`w-full rounded-[24px] border p-4 text-left transition ${
        active
          ? "border-purple-300/40 bg-[linear-gradient(135deg,rgba(255,255,255,0.06)_0%,rgba(216,180,254,0.08)_50%,rgba(124,58,237,0.18)_100%)] shadow-[0_0_24px_rgba(124,58,237,0.10)]"
          : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-white">Scene {index + 1}</div>
        <div className="flex items-center gap-2">
          {scene.needsReanimation && (
            <span className="rounded-full border border-orange-300/25 bg-orange-500/10 px-2.5 py-1 text-[10px] font-semibold text-orange-200">
              Needs re-animation
            </span>
          )}
          {active && (
            <span className="rounded-full border border-purple-300/25 bg-purple-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-purple-100">
              Selected
            </span>
          )}
          {isFailed && (
            <span className="rounded-full border border-red-400/25 bg-red-500/10 px-2.5 py-1 text-[10px] font-semibold text-red-300">
              Failed
            </span>
          )}
        </div>
      </div>

      <div className={`relative overflow-hidden rounded-[20px] border border-white/10 bg-[#0d0f10] ${aspectClass}`}>
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={`Scene ${index + 1}`}
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
            loading="lazy"
            decoding="async"
            onError={(e) => {
              console.error("[fruit] image failed to load", {
                sceneNumber: scene.sceneNumber,
                rawImageUrl: scene.imageUrl,
                resolvedImageSrc: imageSrc,
                scene,
              });
              e.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <ScenePlaceholder index={index} progress={progress} />
        )}

        {isFailed && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="text-center">
              <div className="text-2xl">⚠️</div>
              <div className="mt-1 text-xs font-semibold text-red-300">Failed</div>
            </div>
          </div>
        )}
      </div>

      {scene.title && (
        <p className="mt-3 text-xs leading-relaxed text-white/45">{scene.title}</p>
      )}
      <div className="mt-3 flex items-center justify-end">
        {onRegenerate && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRegenerate();
            }}
            className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-white/75 transition hover:bg-white/[0.10]"
          >
            Regenerate
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Scene video card ─── */
function ClipStatusBadge({ status }) {
  const label =
    status === "succeeded" ? "Done" :
    status === "running" || status === "processing" || status === "queued" ? "Animating" :
    status === "failed" ? "Failed" :
    "Ready";
  const tone =
    status === "succeeded" ? "border-green-400/25 bg-green-500/10 text-green-200" :
    status === "failed" ? "border-red-400/25 bg-red-500/10 text-red-300" :
    status === "running" || status === "processing" || status === "queued" ? "border-purple-400/25 bg-purple-500/10 text-purple-200" :
    "border-white/10 bg-white/[0.05] text-white/55";

  return (
    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${tone}`}>
      {label}
    </span>
  );
}

function VideoLoadingMockup({ progress }) {
  return (
    <div className="relative flex h-full w-full flex-col justify-end overflow-hidden bg-[#090a0c] p-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(168,85,247,0.18),transparent_38%)]" />
      <div className="absolute inset-x-6 top-6 h-2 overflow-hidden rounded-full bg-white/[0.05]">
        <div className="shimmer-bar h-full w-1/2 rounded-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      </div>
      <div className="relative z-10 mx-auto mb-auto mt-auto flex flex-col items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.06] shadow-[0_0_32px_rgba(124,58,237,0.20)]">
          <span className="text-xl font-black text-white">Z</span>
        </div>
        <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white/35">
          Animating
        </div>
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-purple-300/70"
              style={{ animation: `dotPulse 1.2s ease-in-out ${i * 0.18}s infinite` }}
            />
          ))}
        </div>
      </div>
      <div className="relative z-10">
        <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold text-white/55">
          <span>Building video</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-white via-[#D8B4FE] to-[#7C3AED] transition-all duration-500"
            style={{ width: `${Math.max(6, progress)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function SceneVideoCard({ scene, index, aspect }) {
  const aspectClass =
    aspect === "16:9" ? "aspect-[16/9]" :
    aspect === "1:1"  ? "aspect-square"  :
                        "aspect-[9/16]";

  const displayImageSrc = getDisplayImageSrc(scene);

  const isBusy   = !scene.videoUrl && (
    scene.videoStatus === "queued" ||
    scene.videoStatus === "running" ||
    scene.videoStatus === "processing"
  );
  const isFailed = !scene.videoUrl && scene.videoStatus === "failed";
  const progress = scene.videoProgress ?? 0;

  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4 text-left transition hover:bg-white/[0.05]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">Scene {index + 1}</div>
          {scene.title && (
            <div className="mt-0.5 text-xs text-white/35">{scene.title}</div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {scene.needsReanimation && (
            <span className="rounded-full border border-orange-300/25 bg-orange-500/10 px-2.5 py-1 text-[10px] font-semibold text-orange-200">
              Needs re-animation
            </span>
          )}
          {isFailed && (
            <span className="rounded-full border border-red-400/25 bg-red-500/10 px-2.5 py-1 text-[10px] font-semibold text-red-300">
              Failed
            </span>
          )}
          {scene.videoUrl && (
            <a
              href={scene.videoUrl}
              download={`scene-${index + 1}.mp4`}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-white/75 transition hover:bg-white/[0.09]"
            >
              Download
            </a>
          )}
        </div>
      </div>

      <div className={`relative overflow-hidden rounded-[20px] border border-white/10 bg-[#0d0f10] ${aspectClass}`}>
        {scene.videoUrl ? (
          <video
            src={scene.videoUrl}
            className="h-full w-full object-cover"
            controls
            playsInline
            preload="none"
          />
        ) : displayImageSrc ? (
          <>
            <img
              src={displayImageSrc}
              alt={`Scene ${index + 1}`}
              referrerPolicy="no-referrer"
              crossOrigin="anonymous"
              className="h-full w-full object-cover"
              loading="lazy"
              decoding="async"
              onError={(e) => {
                console.error("[fruit] video fallback image failed to load", {
                  sceneNumber: scene.sceneNumber,
                  rawImageUrl: scene.imageUrl,
                  resolvedImageSrc: displayImageSrc,
                  scene,
                });
                e.currentTarget.style.display = "none";
              }}
            />
            {isBusy && <VideoProgressOverlay progress={progress} />}
            {!isBusy && !isFailed && <PlayOverlay />}
          </>
        ) : (
          <ScenePlaceholder index={index} />
        )}

        {isFailed && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="text-center">
              <div className="text-2xl">⚠️</div>
              <div className="mt-1 text-xs font-semibold text-red-300">Failed</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Skeleton card while planning / generating ─── */
function SceneSkeleton({ index, aspect }) {
  const aspectClass =
    aspect === "16:9" ? "aspect-[16/9]" :
    aspect === "1:1"  ? "aspect-square"  :
                        "aspect-[9/16]";
  return (
    <div className="rounded-[24px] border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="h-4 w-16 animate-pulse rounded-full bg-white/[0.06]" />
      </div>
      <div className={`overflow-hidden rounded-[20px] border border-white/[0.06] bg-[#0d0f10] ${aspectClass}`}>
        <ZyvoLoadingCard index={index} progress={0} />
      </div>
      <div className="mt-3 h-3 w-3/4 animate-pulse rounded-full bg-white/[0.06]" />
    </div>
  );
}

/* ─── Empty state ─── */
function EmptyState({ icon, title, body }) {
  return (
    <div className="flex min-h-[360px] flex-1 items-center justify-center rounded-[22px] border border-dashed border-white/10 bg-[#0d0f10] p-8 text-center">
      <div>
        <div className="text-4xl">{icon}</div>
        <div className="mt-3 text-lg font-bold text-white">{title}</div>
        <p className="mt-2 text-sm text-white/40">{body}</p>
      </div>
    </div>
  );
}

/* ─── Progress overlay on top of scene image during video generation ─── */
function VideoProgressOverlay({ progress }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-end bg-black/55 p-4">
      <div className="w-full space-y-1.5">
        <div className="flex justify-between text-[10px] font-semibold text-white/70">
          <span>Animating…</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-white via-[#D8B4FE] to-[#7C3AED] transition-all duration-500"
            style={{ width: `${Math.max(4, progress)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/* ─── Zyvo-branded loading card (replaces all fruit emoji placeholders) ─── */
function ZyvoLoadingCard({ index, progress = 0 }) {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-between overflow-hidden bg-[#0a0b0d]">

      {/* Ambient gradient glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,rgba(124,58,237,0.13),transparent)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_30%_at_50%_80%,rgba(216,180,254,0.06),transparent)]" />

      {/* Shimmer bar — top */}
      <div className="relative z-10 w-full px-4 pt-4">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
          <div className="shimmer-bar h-full w-[55%] rounded-full bg-gradient-to-r from-transparent via-white/[0.12] to-transparent" />
        </div>
        <div className="mt-2 h-1 w-2/3 overflow-hidden rounded-full bg-white/[0.04]">
          <div className="shimmer-bar-slow h-full w-[40%] rounded-full bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
        </div>
      </div>

      {/* Centered Zyvo icon */}
      <div className="relative z-10 flex flex-col items-center gap-3">
        {/* Z logo mark */}
        <div className="relative flex h-12 w-12 items-center justify-center rounded-[16px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(124,58,237,0.18))] shadow-[0_0_24px_rgba(124,58,237,0.15)]">
          <span className="text-xl font-black text-white/90" style={{ fontStyle: "italic" }}>Z</span>
          <div className="pointer-events-none absolute inset-[1px] rounded-[15px] ring-1 ring-inset ring-white/10" />
        </div>
        {/* Wordmark */}
        <div className="text-[11px] font-black uppercase tracking-[0.2em] text-white/25">
          Generating
        </div>
        {/* Pulsing dots */}
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-purple-400/50"
              style={{ animation: `dotPulse 1.2s ease-in-out ${i * 0.2}s infinite` }}
            />
          ))}
        </div>
      </div>

      {/* Shimmer bar — bottom */}
      <div className="relative z-10 w-full px-4 pb-4">
        <div className="mt-2 h-1 w-1/2 overflow-hidden rounded-full bg-white/[0.04]">
          <div className="shimmer-bar-slow h-full w-[40%] rounded-full bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
          <div className="shimmer-bar h-full w-[60%] rounded-full bg-gradient-to-r from-transparent via-white/[0.11] to-transparent" />
        </div>
        {/* Progress bar */}
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-white/60 via-[#D8B4FE] to-[#7C3AED] transition-all duration-700 ease-out"
            style={{ width: `${Math.max(6, progress)}%` }}
          />
        </div>
      </div>

      {/* Scene label */}
      {index !== undefined && (
        <div className="absolute left-3 top-3 z-20 rounded-full border border-white/10 bg-black/40 px-2.5 py-1 text-[10px] font-semibold text-white/50 backdrop-blur-md">
          Scene {index + 1}
        </div>
      )}

      <style>{`
        @keyframes shimmerMove {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
        @keyframes shimmerMoveSlow {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
        @keyframes dotPulse {
          0%, 100% { opacity: 0.25; transform: scale(0.85); }
          50%       { opacity: 1;    transform: scale(1.2);  }
        }
        .shimmer-bar      { animation: shimmerMove     2.0s ease-in-out infinite; }
        .shimmer-bar-slow { animation: shimmerMoveSlow 2.8s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

/* ─── Placeholder for scenes with no image yet ─── */
function ScenePlaceholder({ index, progress = 0 }) {
  return <ZyvoLoadingCard index={index} progress={progress} />;
}

function PlayOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/10">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-black/45 text-sm text-white backdrop-blur-md">
        ▶
      </div>
    </div>
  );
}

function AspectBadge({ value }) {
  return (
    <span className="shrink-0 rounded-full border border-purple-400/30 bg-purple-500/15 px-3 py-1 text-xs font-bold text-purple-200">
      {value}
    </span>
  );
}

/* ─── Recent Generations Panel ─────────────────────────────────────────────
 * Shows the user's last 20 AI Fruit Story generation packs.
 * Each card has thumbnail previews, status, and a Continue button.
 * ───────────────────────────────────────────────────────────────────────── */

const STATUS_LABELS = {
  generating_images: { label: "Generating",      color: "text-blue-300 bg-blue-500/15 border-blue-400/25" },
  images_generated:  { label: "Ready to animate", color: "text-green-300 bg-green-500/15 border-green-400/25" },
  partial_failed:    { label: "Some scenes failed",color: "text-orange-300 bg-orange-500/15 border-orange-400/25" },
  animating:         { label: "Animating",         color: "text-purple-300 bg-purple-500/15 border-purple-400/25" },
  completed:         { label: "Completed",          color: "text-purple-200 bg-purple-500/20 border-purple-400/30" },
};

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60)     return "just now";
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function GenerationCard({ generation, onContinue, onDelete }) {
  const scenes   = generation.scenes ?? [];
  const thumbs   = scenes.filter((s) => s.imageUrl).slice(0, 4);
  const status   = STATUS_LABELS[generation.status] ?? STATUS_LABELS.images_generated;
  // "generating_images" included so users can click in and watch scenes arrive in real time
  const canAnimate = ["generating_images", "images_generated", "partial_failed", "animating", "completed"].includes(generation.status);

  return (
    <div className="group rounded-[20px] border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/15 hover:bg-white/[0.05]">
      {/* Top row */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="line-clamp-1 text-sm font-semibold text-white">
            {generation.title || generation.story_idea?.slice(0, 60) || "Fruit Story"}
          </div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-white/40">
            <span>{generation.scene_count ?? "?"} scenes</span>
            <span>-</span>
            <span>{generation.scene_aspect ?? "9:16"}</span>
            <span>-</span>
            <span>{timeAgo(generation.created_at)}</span>
          </div>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${status.color}`}>
          {status.label}
        </span>
      </div>

      {/* Thumbnail strip */}
      {thumbs.length > 0 ? (
        <div className="mb-3 grid grid-cols-4 gap-1.5 overflow-hidden rounded-[12px]">
          {thumbs.map((scene, i) => (
            <div key={i} className="aspect-[9/16] overflow-hidden rounded-[8px] bg-[#0d0f10]">
              <img
                src={`${scene.imageUrl}?format=webp&width=120`}
                alt={`Scene ${scene.sceneNumber}`}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
          ))}
          {/* Fill empty slots */}
          {Array.from({ length: Math.max(0, 4 - thumbs.length) }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-[9/16] rounded-[8px] bg-white/[0.04]" />
          ))}
        </div>
      ) : (
        <div className="mb-3 flex h-16 items-center justify-center rounded-[12px] border border-dashed border-white/10 bg-white/[0.02]">
          <span className="text-[11px] text-white/25">No images yet</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onContinue?.(generation.id)}
          disabled={!canAnimate}
          className={`flex-1 rounded-[12px] py-2.5 text-sm font-bold transition ${
            canAnimate
              ? "bg-gradient-to-r from-[#7A3BFF] to-[#9d4eff] text-white hover:brightness-110"
              : "cursor-not-allowed bg-white/[0.04] text-white/25"
          }`}
        >
          Continue →
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Delete this saved generation?")) onDelete?.(generation.id);
          }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border border-white/10 bg-white/[0.03] text-white/40 transition hover:border-red-400/30 hover:bg-red-500/10 hover:text-red-300"
          title="Delete"
        >
          ×
        </button>
      </div>
    </div>
  );
}

function RecentGenerationsPanel({ generations, isLoading, onContinue, onDelete }) {
  return (
    <div>
      <div className="mb-4">
        <h3 className="text-lg font-bold text-white">Recent Generations</h3>
        <p className="mt-1 text-sm text-white/40">
          Continue from your saved fruit story scenes.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-[20px] bg-white/[0.04]" />
          ))}
        </div>
      ) : generations.length === 0 ? (
        <div className="flex min-h-[200px] flex-col items-center justify-center rounded-[20px] border border-dashed border-white/10 bg-white/[0.02] p-6 text-center">
          <div className="text-3xl opacity-30">🍊</div>
          <div className="mt-3 text-sm font-semibold text-white/50">No saved fruit stories yet</div>
          <p className="mt-1 text-xs text-white/30">
            Generate scenes once and they&apos;ll appear here.
          </p>
        </div>
      ) : (
        <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
          {generations.map((gen) => (
            <GenerationCard
              key={gen.id}
              generation={gen}
              onContinue={onContinue}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Phone mockup (step 0 preview) ─── */
function PhoneVideoMockup({ title, subtitle }) {
  return (
    <div className="group relative mx-auto animate-[phonePop_0.55s_ease-out_both] rounded-[42px] border border-white/15 bg-[#050505] p-2.5 shadow-[0_28px_100px_rgba(0,0,0,0.55)] w-full max-w-[430px]">
      <div className="overflow-hidden rounded-[34px] border border-white/10 bg-black">
        <div className="floating-heart-active relative aspect-[9/19.5] w-full overflow-hidden bg-black">
          <video
            className="absolute inset-0 h-full w-full object-cover"
            src="/viral-builder/ai-fruit/result.mp4"
            autoPlay
            muted
            loop
            playsInline
            preload="none"
          />

          <FloatingHeartSpam />

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/65" />

          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 pt-4 text-[11px] font-semibold text-white/85">
            <span>9:41</span>
            <span className="rounded-full bg-black/35 px-2.5 py-1 backdrop-blur-md">Preview</span>
          </div>

          <div className="pointer-events-none absolute left-4 top-12 z-20 rounded-full border border-white/10 bg-black/45 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-white/80 backdrop-blur-md">
            AI Fruit Story
          </div>

          <div className="pointer-events-none absolute right-3 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-3">
            {["♥", "💬", "↗"].map((icon) => (
              <div
                key={icon}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-sm text-white shadow-lg"
              >
                {icon}
              </div>
            ))}
          </div>

          <div className="pointer-events-none absolute bottom-5 left-4 right-4 z-20 translate-y-0 rounded-3xl border border-white/10 bg-black/45 p-4 backdrop-blur-xl transition duration-500 group-hover:-translate-y-1">
            <div className="line-clamp-2 text-sm font-black leading-tight text-white sm:text-base">
              {title || "Your fruit story preview"}
            </div>
            <div className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/70">
              {subtitle || "Betrayal / drama preview"}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
              <span className="text-[11px] font-bold text-white/70">Live template preview</span>
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-3 h-1.5 w-24 rounded-full bg-white/15" />
      <style>{`
        @keyframes phonePop {
          from { opacity: 0; transform: translateY(18px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

function FloatingHeartSpam() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 z-[12] overflow-hidden">
        {HEARTS.map((heart) => (
          <span
            key={heart.id}
            className="absolute bottom-[-30px] select-none opacity-0"
            style={{
              left:              heart.left,
              fontSize:          heart.size,
              animationDelay:    heart.delay,
              animationDuration: heart.duration,
              "--drift":         heart.drift,
            }}
          >
            ❤️
          </span>
        ))}
      </div>
      <style>{`
        @keyframes floatHeart {
          0%   { transform: translate3d(0,0,0) scale(0.7); opacity: 0; }
          10%  { opacity: 0.95; }
          30%  { transform: translate3d(calc(var(--drift)*0.4),-120px,0) scale(0.95); opacity: 1; }
          60%  { transform: translate3d(calc(var(--drift)*0.8),-280px,0) scale(1.05); opacity: 0.9; }
          100% { transform: translate3d(var(--drift),-520px,0) scale(1.15); opacity: 0; }
        }
        .floating-heart-active span {
          animation-name: floatHeart;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          filter: drop-shadow(0 6px 14px rgba(255,65,108,0.28));
        }
      `}</style>
    </>
  );
}
