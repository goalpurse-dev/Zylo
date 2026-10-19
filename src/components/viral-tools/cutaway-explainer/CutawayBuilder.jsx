import { useMemo, useState } from "react";
import { ChevronRight, Clock3, Layers, Volume2, VolumeX } from "lucide-react";
import { freshSuggestions } from "../../../data/cutawayTopics";
import { CREDITS, DEFAULT_LENGTH, DEMO_MODE, LENGTHS } from "./api/cutawayApi";

function CreditIcon() {
  return (
    <span
      aria-hidden="true"
      className="h-4 w-4 shrink-0 bg-current"
      style={{ WebkitMaskImage: "url('/icons/credits.png')", maskImage: "url('/icons/credits.png')", WebkitMaskPosition: "center", maskPosition: "center", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskSize: "contain", maskSize: "contain" }}
    />
  );
}

export default function CutawayBuilder({ values, onValuesChange, onGenerate, onReset, phase, historyMode = false, onDone, usedTopics = [] }) {
  const topic = values?.topic ?? "";
  const lengthSec = values?.lengthSec ?? DEFAULT_LENGTH;
  const soundEffects = values?.soundEffects !== false;
  const suggestions = useMemo(() => freshSuggestions(usedTopics, 6), [usedTopics]);
  const [validationError, setValidationError] = useState("");
  const credits = CREDITS[lengthSec];
  const isWorking = phase === "working";
  const isDone = phase === "done";

  const update = (key, value) => { if (!historyMode) onValuesChange?.({ ...values, [key]: value }); };

  const handleGenerate = () => {
    const clean = topic.trim();
    if (clean.length < 3) { setValidationError("Type what the video should explain."); return; }
    setValidationError("");
    onGenerate({ topic: clean, lengthSec, soundEffects });
  };

  return (
    <section className="relative flex min-h-[560px] flex-col overflow-hidden rounded-2xl border border-cutaway/[0.13] bg-[#0C0F0D] shadow-[inset_0_1px_0_rgba(74,222,128,.05)] lg:h-full lg:min-h-0">
      <div className={`shrink-0 border-b border-white/[0.06] px-5 py-4 transition lg:py-2.5 ${historyMode ? "opacity-[.55] grayscale" : ""}`}>
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl border border-cutaway/20 bg-cutaway/10">
            <Layers className="h-4 w-4 text-cutaway" />
          </span>
          <div>
            <h1 className="text-[18px] font-black tracking-[-0.03em] text-white">Cutaway Explainer</h1>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cutaway/65">How things work, in one shot</p>
          </div>
        </div>
      </div>

      <div className={`min-h-0 flex-1 overflow-y-auto px-5 py-4 transition [scrollbar-width:thin] lg:py-3 ${historyMode ? "pointer-events-none opacity-[.55] grayscale" : ""}`}>
        <div className="flex flex-col gap-5 pb-[150px] lg:gap-4 lg:pb-0">
          <div>
            <label htmlFor="cutaway-topic" className="mb-2 block text-[11px] font-bold uppercase tracking-[0.12em] text-white/40 lg:mb-1.5">Topic</label>
            <textarea
              id="cutaway-topic"
              value={topic}
              onChange={(e) => { update("topic", e.target.value); setValidationError(""); }}
              disabled={historyMode || isWorking}
              maxLength={120}
              rows={3}
              placeholder="What should the video explain? e.g. septic tank"
              className="h-[96px] w-full resize-none rounded-2xl border border-white/[0.08] bg-[#111315] px-4 py-3 text-[14px] leading-relaxed text-white outline-none transition placeholder:text-white/20 focus:border-cutaway/35 focus:ring-1 focus:ring-cutaway/30"
            />
            <p className="mb-1.5 mt-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/30">Topics it can build</p>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s.topic}
                  type="button"
                  title={`If you ${s.hook}…`}
                  onClick={() => { update("topic", s.topic); setValidationError(""); }}
                  disabled={historyMode || isWorking}
                  className="flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold text-white/45 transition hover:border-cutaway/25 hover:text-white/75"
                >
                  {s.ready && <span className="h-1.5 w-1.5 rounded-full bg-cutaway" aria-label="ready" />}
                  {s.topic}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-white/40 lg:mb-1.5">Length</p>
            <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/[0.07] bg-[#0E1012] p-1">
              {LENGTHS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => update("lengthSec", s)}
                  disabled={historyMode || isWorking}
                  className={`flex items-center justify-center gap-1.5 rounded-lg px-1 py-2 text-[12px] font-bold transition ${lengthSec === s ? "bg-white text-black" : "text-white/45 hover:bg-white/[0.06] hover:text-white/75"}`}
                >
                  <Clock3 className="h-3.5 w-3.5" />{s} seconds
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-white/40 lg:mb-1.5">Sound effects</p>
            <button
              id="cutaway-sfx"
              type="button"
              role="switch"
              aria-checked={soundEffects}
              onClick={() => update("soundEffects", !soundEffects)}
              disabled={historyMode || isWorking}
              className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition ${soundEffects ? "border-cutaway/35 bg-cutaway/[0.08]" : "border-white/[0.07] bg-white/[0.035]"}`}
            >
              <span className="flex items-center gap-2 text-[12px] font-bold text-white/80">
                {soundEffects ? <Volume2 className="h-4 w-4 text-cutaway" /> : <VolumeX className="h-4 w-4 text-white/40" />}
                {soundEffects ? "On: digging, drips, engines and a chime on each name" : "Off: voice only"}
              </span>
              <span className={`relative h-5 w-9 shrink-0 rounded-full transition ${soundEffects ? "bg-cutaway" : "bg-white/15"}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${soundEffects ? "left-[18px]" : "left-0.5"}`} />
              </span>
            </button>
          </div>

          <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-2.5">
            <p className="text-[11px] font-bold text-white/75">How it works</p>
            <ol className="mt-1.5 space-y-1 text-[10.5px] font-medium leading-relaxed text-white/45">
              <li>1. Script: a fact-checked script and an energetic voiceover.</li>
              <li>2. Scene: the 3D cutaway is built, and every part appears on its word.</li>
              <li>3. Render: one continuous vertical video with captions and sound.</li>
            </ol>
            <p className="mt-2 text-[10px] font-semibold text-white/35">{credits} credits for a {lengthSec} s video{DEMO_MODE ? " · not charged in the demo" : ""}</p>
          </div>
        </div>
      </div>

      <div className="fixed bottom-[calc(72px+env(safe-area-inset-bottom))] left-0 right-0 z-[90] border-t border-white/[0.07] bg-[#0C0F0D]/95 px-5 pb-2 pt-3 backdrop-blur-xl lg:static lg:shrink-0 lg:bg-[#0C0F0D] lg:pb-3 lg:pt-2.5">
        {validationError && <p className="mb-2 text-center text-[11px] font-semibold text-red-400">{validationError}</p>}
        <button
          type="button"
          onClick={historyMode ? onDone : isDone ? onReset : handleGenerate}
          disabled={isWorking}
          className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[14px] font-black transition lg:py-2.5 ${isWorking ? "cursor-not-allowed bg-cutaway/15 text-cutaway/40" : isDone ? "border border-white/10 bg-white/[0.05] text-white/70 hover:bg-white/[0.08]" : "bg-cutaway text-cutaway-ink hover:bg-cutaway-soft"}`}
        >
          {historyMode ? "Done" : isWorking ? "Working…" : isDone ? "Create another" : <>
            Generate
            <span className="flex items-center gap-1 text-[13px] font-semibold"><CreditIcon />{credits}</span>
            <ChevronRight className="h-4 w-4" />
          </>}
        </button>
      </div>
    </section>
  );
}
