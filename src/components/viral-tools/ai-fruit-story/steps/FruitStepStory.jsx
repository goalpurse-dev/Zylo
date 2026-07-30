import React, { useEffect, useRef, useState } from "react";
import { Check, RefreshCw, X } from "lucide-react";
import { generateFruitStoryIdeas } from "../api/fruitStoryApi";

// `form` lives in a plain useState on the parent page, so it resets on every
// full page reload — without this, a refresh would silently burn a fresh
// OpenAI call every time. Cached ideas survive reloads; only Regenerate (or
// a genuinely empty cache) triggers a new call.
const IDEAS_CACHE_KEY = "zyvo_fruit_story_ideas_v1";

function readCachedIdeas() {
  try {
    const raw = localStorage.getItem(IDEAS_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function writeCachedIdeas(ideas) {
  try {
    localStorage.setItem(IDEAS_CACHE_KEY, JSON.stringify(ideas));
  } catch {
    // Storage may be unavailable (private browsing, quota) — non-fatal.
  }
}

export default function FruitStepStory({ form, setForm }) {
  const ideas = form.generatedIdeas || [];
  const [loadingIdeas, setLoadingIdeas] = useState(false);
  const [ideasError, setIdeasError] = useState("");
  const fetchedRef = useRef(false);

  const fetchIdeas = async () => {
    setLoadingIdeas(true);
    setIdeasError("");
    try {
      const result = await generateFruitStoryIdeas();
      writeCachedIdeas(result);
      setForm((prev) => ({ ...prev, generatedIdeas: result }));
    } catch (error) {
      setIdeasError(error.message || "Could not generate ideas. Try again.");
    } finally {
      setLoadingIdeas(false);
    }
  };

  // Auto-generate once on first visit to this step — ideas persist on `form`
  // across step navigation, and in localStorage across page reloads, so this
  // only fires again if the user explicitly clicks Regenerate or the cache
  // is genuinely empty.
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    if (ideas.length > 0) return;
    const cached = readCachedIdeas();
    if (cached) {
      setForm((prev) => ({ ...prev, generatedIdeas: cached }));
      return;
    }
    fetchIdeas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickIdea = (idea) => {
    setForm({
      ...form,
      storyIdea: idea,
      storyPreset: "custom",
      conflict: "Custom story conflict",
      ideaSource: "suggested",
    });
  };

  const clearSuggestedIdea = () => {
    setForm({
      ...form,
      storyIdea: "",
      ideaSource: "custom",
    });
  };

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl border border-white/10">
        <img
          src="/viral-builder/ai-fruit/presets/cheating.webp"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/88 to-black/45" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/40 to-black/85" />

        <div className="relative z-10 p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-black text-white">Pick a story idea</div>
              <p className="mt-1 text-xs text-white/50">
                15 viral fruit-drama ideas — tap one to build your story from it.
              </p>
            </div>

            <button
              type="button"
              onClick={fetchIdeas}
              disabled={loadingIdeas}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-purple-400/30 bg-purple-500/20 px-3 py-2 text-xs font-black text-purple-100 backdrop-blur-sm transition hover:bg-purple-500/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loadingIdeas ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-purple-200/30 border-t-purple-100" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Regenerate
            </button>
          </div>

          {ideasError && (
            <p className="mb-2 text-xs font-semibold text-red-400">{ideasError}</p>
          )}

          {loadingIdeas && ideas.length === 0 ? (
            <div className="space-y-1.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-9 animate-pulse rounded-lg bg-white/[0.04]" />
              ))}
            </div>
          ) : (
            <div className="max-h-[260px] overflow-y-auto rounded-xl bg-black/25 pr-1 shadow-[inset_0_0_24px_rgba(0,0,0,0.5)] [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.2)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/15">
              {ideas.map((idea, index) => {
                const active = form.ideaSource === "suggested" && form.storyIdea === idea;
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => pickIdea(idea)}
                    className={`relative block w-full border-l-2 px-3 py-2.5 pr-8 text-left text-[13px] leading-snug transition ${
                      index > 0 ? "border-t border-t-white/[0.06]" : ""
                    } ${
                      active
                        ? "border-l-purple-400 bg-gradient-to-r from-purple-500/25 via-fuchsia-500/10 to-transparent text-white"
                        : "border-l-transparent text-white/75 hover:bg-white/[0.06]"
                    }`}
                  >
                    <span className={`mr-1.5 font-black ${active ? "text-purple-300" : "text-white/35"}`}>
                      {index + 1}.
                    </span>
                    {idea}
                    {active && (
                      <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-purple-400 to-fuchsia-500 text-white shadow-[0_0_10px_rgba(168,85,247,0.7)]">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-white/10">
        <img
          src="/viral-builder/ai-fruit/presets/custom.webp"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/88 to-black/45" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/35 to-black/85" />

        <div className="relative z-10 p-4">
          <label className="mb-2 block text-sm font-black text-white">
            Your story idea
          </label>

          {form.ideaSource === "suggested" ? (
            <div className="flex min-h-[100px] w-full flex-col items-center justify-center gap-2 rounded-2xl bg-black/20 px-4 py-4 text-center shadow-[inset_0_0_24px_rgba(0,0,0,0.5)]">
              <span className="text-xs font-black uppercase tracking-wide text-purple-300 [text-shadow:0_2px_10px_rgba(0,0,0,0.9)]">
                Suggested story is chosen
              </span>
              <button
                type="button"
                onClick={clearSuggestedIdea}
                className="flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-white/60 transition hover:border-white/25 hover:text-white/90"
              >
                <X className="h-3 w-3" />
                Write my own instead
              </button>
            </div>
          ) : (
            <textarea
              value={form.storyIdea}
              onChange={(e) =>
                setForm({
                  ...form,
                  storyIdea: e.target.value,
                  storyPreset: "custom",
                  conflict: e.target.value ? "Custom story conflict" : "",
                  ideaSource: "custom",
                })
              }
              placeholder="Pick an idea above, or write your own — e.g. 'A poor strawberry is betrayed by his rich banana brother over family inheritance.'"
              className="min-h-[100px] w-full resize-none rounded-2xl bg-black/20 px-4 py-4 text-sm text-white outline-none shadow-[inset_0_0_24px_rgba(0,0,0,0.5)] placeholder:text-white/40 focus:bg-black/35 [text-shadow:0_1px_4px_rgba(0,0,0,0.8)]"
            />
          )}
          <p className="mt-2 text-xs text-white/45">
            Characters, story, and scenes are generated automatically from this idea on the next step.
          </p>
        </div>
      </div>
    </div>
  );
}
