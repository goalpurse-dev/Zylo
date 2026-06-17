import React, { useEffect, useMemo, useState } from "react";
import { isFruitVideoPromptReady } from "../api/fruitStoryApi";

function getThumbUrl(url) {
  if (!url) return "";
  const raw = String(url);
  if (raw.startsWith("data:") || raw.startsWith("blob:") || raw.includes("?")) return raw;
  return `${raw}?format=webp&width=180`;
}

export default function FruitStepAnimate({
  form,
  setForm,
  scenes = [],
  onSceneVideoPromptChange,
  onRegenerateSceneVideoPrompt,
  onRegenerateVideoPrompts,
  onEnsureVideoPrompts,
  isAnimating = false,
}) {
  const generatedScenes = useMemo(
    () => [...scenes]
      .filter((scene) => scene?.imageUrl)
      .sort((a, b) => Number(a.sceneNumber ?? 0) - Number(b.sceneNumber ?? 0)),
    [scenes],
  );
  const promptsReady = generatedScenes.length > 0 &&
    generatedScenes.every((scene) => isFruitVideoPromptReady(scene.videoPrompt));

  useEffect(() => {
    if (generatedScenes.length > 0) onEnsureVideoPrompts?.(false);
  }, [generatedScenes.length, onEnsureVideoPrompts]);

  return (
    <div className="space-y-3">
      <div className="rounded-[20px] border border-white/10 bg-[#151719] p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-white">Voiceover / Video Prompts</h3>
            <p className="mt-1 text-sm leading-relaxed text-white/45">
              Review and edit the full Video Prompt for each scene before animating.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onRegenerateVideoPrompts?.()}
            disabled={generatedScenes.length === 0 || isAnimating}
            className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold text-white/65 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-35"
          >
            Regenerate prompts
          </button>
        </div>

        {generatedScenes.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-white/10 bg-white/[0.025] p-3 text-sm text-white/35">
            Generate scene images first, then review video prompts here.
          </div>
        ) : (
          <div className="mt-3 max-h-[36vh] space-y-2 overflow-y-auto pr-1">
            {generatedScenes.map((scene) => (
              <PromptSceneCard
                key={scene.sceneNumber}
                scene={scene}
                disabled={isAnimating}
                onChange={onSceneVideoPromptChange}
                onReset={onRegenerateSceneVideoPrompt}
              />
            ))}
          </div>
        )}

        {generatedScenes.length > 0 && !promptsReady && (
          <div className="mt-3 rounded-2xl border border-orange-300/20 bg-orange-500/10 px-3 py-2 text-xs font-semibold text-orange-100">
            Every generated scene needs a complete video prompt before Animate can run.
          </div>
        )}
      </div>

    </div>
  );
}

function PromptSceneCard({ scene, disabled, onChange, onReset }) {
  const [copied, setCopied] = useState(false);
  const prompt = String(scene.videoPrompt ?? "");
  const notReady = !isFruitVideoPromptReady(prompt);

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="rounded-[16px] border border-white/10 bg-white/[0.03] p-2.5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="h-12 w-9 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/30 sm:h-14 sm:w-10">
            <img
              src={getThumbUrl(scene.imageUrl)}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-white">Scene {scene.sceneNumber}</div>
            <div className={`mt-0.5 text-[11px] font-semibold ${notReady ? "text-orange-200" : "text-white/35"}`}>
              Video Prompt - {prompt.trim().length} chars
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={copyPrompt}
            disabled={!prompt.trim()}
            className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold text-white/60 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-35"
          >
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            onClick={() => onReset?.(scene.sceneNumber)}
            disabled={disabled}
            className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold text-white/60 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-35"
          >
            Reset
          </button>
        </div>
      </div>

      <textarea
        value={prompt}
        onChange={(event) => onChange?.(scene.sceneNumber, event.target.value.slice(0, 1450))}
        disabled={disabled}
        maxLength={1450}
        aria-label={`Scene ${scene.sceneNumber} Video Prompt`}
        placeholder="Video Prompt will appear here with Characters, Action, Dialogue, Voice direction, Motion, Camera, Audio, and Negative sections..."
        className="max-h-32 min-h-24 w-full resize-y overflow-y-auto rounded-xl border border-white/10 bg-[#0d0f10] px-3 py-2.5 font-mono text-[12px] leading-relaxed text-white/82 outline-none transition placeholder:text-white/25 focus:border-purple-300/45 disabled:opacity-60"
      />

      {/* Character counter — only warn if user manually pastes over the limit */}
      <div className="mt-1 flex items-center justify-end gap-1.5">
        <span className={`text-[10px] font-mono tabular-nums ${
          prompt.length >= 1450 ? "font-bold text-white/50" : "text-white/20"
        }`}>
          {prompt.length} / 1450
        </span>
      </div>
    </div>
  );
}
