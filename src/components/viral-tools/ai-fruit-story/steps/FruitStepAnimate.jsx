import React, { useEffect, useMemo, useState } from "react";
import { isFruitVideoPromptReady } from "../api/fruitStoryApi";

function ActiveGlow({ children, className = "" }) {
  return (
    <div
      className={`
        relative overflow-hidden border border-[#D8B4FE]/55
        bg-[linear-gradient(135deg,rgba(255,255,255,0.16)_0%,rgba(224,194,255,0.16)_30%,rgba(168,85,247,0.22)_65%,rgba(124,58,237,0.34)_100%)]
        shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_12px_34px_rgba(124,58,237,0.18)]
        ${className}
      `}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.16),transparent_38%)]" />
      <div className="pointer-events-none absolute inset-[1px] rounded-[inherit] ring-1 ring-inset ring-white/18" />
      {children}
    </div>
  );
}

const ANIMATION_MODELS = [
  {
    id: "zyvo-video-v2",
    label: "Zyvo Video V2",
    description: "Fast talking clips with sound",
    tag: "Wan 2.6 Flash",
  },
  {
    id: "zyvo-video-v3",
    label: "Zyvo Video V3",
    description: "Premium talking clips with better audio and stronger motion",
    tag: "Veo 3.1 Fast",
  },
];

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
  const selectedModelId = form.animationModel || "zyvo-video-v2";
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

  const updateFormValue = (key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

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

      <div>
        <h3 className="text-sm font-semibold text-white">Animation model</h3>
        <p className="mt-1 text-xs text-white/40">
          Choose the model used after your edited prompts are ready.
        </p>

        <div className="mt-3 grid gap-3">
          {ANIMATION_MODELS.map((model) => {
            const active = selectedModelId === model.id;
            const content = (
              <button
                type="button"
                onClick={() => updateFormValue("animationModel", model.id)}
                className="w-full rounded-[20px] p-4 text-left"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white">{model.label}</div>
                    <p className={`mt-1 text-xs ${active ? "text-white/60" : "text-white/45"}`}>
                      {model.description}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                    active ? "border-white/25 bg-white/14 text-white" : "border-white/10 bg-white/[0.04] text-white/35"
                  }`}>
                    {model.tag}
                  </span>
                </div>
              </button>
            );

            return active ? (
              <ActiveGlow key={model.id} className="rounded-[20px]">{content}</ActiveGlow>
            ) : (
              <div key={model.id} className="rounded-[20px] border border-white/10 bg-white/[0.025] transition hover:border-white/15 hover:bg-white/[0.05]">
                {content}
              </div>
            );
          })}
        </div>
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
