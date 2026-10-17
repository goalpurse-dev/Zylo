import { useMemo, useState } from "react";
import { ChevronRight, Clock3, Layers } from "lucide-react";
import { useProfileCredits } from "../../../hooks/useProfileCredits";
import { emitCreditSpend } from "../../../lib/creditPopEvents";
import NoCreditsModal from "../shared/NoCreditsModal";
import useToolPriceQuotes from "../../../hooks/useToolPriceQuotes";
import QuotedCredits from "../../pricing/QuotedCredits";
import { calcCredits, DEFAULT_LENGTH, LENGTHS, PRICE_ITEMS } from "./api/cutawayApi";

const TOPIC_EXAMPLES = ["Rain gutter", "How a toilet flushes", "A house foundation", "A city water tower"];

function CreditIcon() {
  return (
    <span
      aria-hidden="true"
      className="h-4 w-4 shrink-0 bg-current"
      style={{ WebkitMaskImage: "url('/icons/credits.png')", maskImage: "url('/icons/credits.png')", WebkitMaskPosition: "center", maskPosition: "center", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskSize: "contain", maskSize: "contain" }}
    />
  );
}

export default function CutawayBuilder({ values, onValuesChange, onGenerate, onReset, busy, phase, historyMode = false, onDone }) {
  const topic = values?.topic ?? "";
  const lengthSec = values?.lengthSec ?? DEFAULT_LENGTH;
  const [validationError, setValidationError] = useState("");
  const [noCreditsOpen, setNoCreditsOpen] = useState(false);
  const creditBalance = useProfileCredits();
  const quotes = useToolPriceQuotes(PRICE_ITEMS);
  const totalCredits = useMemo(() => calcCredits(lengthSec, quotes.prices), [lengthSec, quotes.prices]);
  const firstCredits = quotes.prices[`plan:${lengthSec}`];
  const isWorking = phase === "working" || phase === "review";
  const isDone = phase === "done" || phase === "error";

  const update = (key, value) => { if (!historyMode) onValuesChange?.({ ...values, [key]: value }); };

  const handleGenerate = () => {
    const clean = topic.trim();
    if (clean.length < 3) { setValidationError("Type what the video should explain."); return; }
    if (quotes.status === "error") { quotes.retry(); return; }
    if (totalCredits == null) return;
    if (creditBalance < totalCredits) { setNoCreditsOpen(true); return; }
    setValidationError("");
    emitCreditSpend(firstCredits, "Cutaway Explainer");
    onGenerate({ topic: clean, lengthSec });
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
              placeholder="What should the video explain? e.g. rain gutter"
              className="h-[96px] w-full resize-none rounded-2xl border border-white/[0.08] bg-[#111315] px-4 py-3 text-[14px] leading-relaxed text-white outline-none transition placeholder:text-white/20 focus:border-cutaway/35 focus:ring-1 focus:ring-cutaway/30"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {TOPIC_EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => { update("topic", example); setValidationError(""); }}
                  disabled={historyMode || isWorking}
                  className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold text-white/45 transition hover:border-cutaway/25 hover:text-white/75"
                >
                  {example}
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

          <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-2.5">
            <p className="text-[11px] font-bold text-white/75">How it works</p>
            <ol className="mt-1.5 space-y-1 text-[10.5px] font-medium leading-relaxed text-white/45">
              <li>1. A fact-checked script and voiceover.</li>
              <li>2. The cutaway images: you check them and regenerate any you don't like.</li>
              <li>3. Clips between the images, joined into one seamless vertical video.</li>
            </ol>
            {firstCredits != null && totalCredits != null && (
              <p className="mt-2 text-[10px] font-semibold text-white/35">{firstCredits} credits now, {totalCredits - firstCredits} when you approve the images.</p>
            )}
          </div>
        </div>
      </div>

      <div className="fixed bottom-[calc(72px+env(safe-area-inset-bottom))] left-0 right-0 z-[90] border-t border-white/[0.07] bg-[#0C0F0D]/95 px-5 pb-2 pt-3 backdrop-blur-xl lg:static lg:shrink-0 lg:bg-[#0C0F0D] lg:pb-3 lg:pt-2.5">
        {validationError && <p className="mb-2 text-center text-[11px] font-semibold text-red-400">{validationError}</p>}
        <button
          type="button"
          onClick={historyMode ? onDone : isDone ? onReset : handleGenerate}
          disabled={busy || isWorking || (!historyMode && !isDone && quotes.status === "loading")}
          className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[14px] font-black transition lg:py-2.5 ${isWorking || busy ? "cursor-not-allowed bg-cutaway/15 text-cutaway/40" : isDone ? "border border-white/10 bg-white/[0.05] text-white/70 hover:bg-white/[0.08]" : "bg-cutaway text-cutaway-ink hover:bg-cutaway-soft"}`}
        >
          {historyMode ? "Done" : isWorking ? (phase === "review" ? "Check the images on the right" : "Working…") : isDone ? "Create another" : <>
            {quotes.status === "error" ? "Couldn't load price — Retry" : quotes.status === "loading" ? "Loading price…" : "Generate"}
            {quotes.status !== "error" && <span className="flex items-center gap-1 text-[13px] font-semibold"><CreditIcon /><QuotedCredits status={quotes.status} value={totalCredits} onRetry={quotes.retry} /></span>}
            <ChevronRight className="h-4 w-4" />
          </>}
        </button>
      </div>

      <NoCreditsModal open={noCreditsOpen} onClose={() => setNoCreditsOpen(false)} creditsNeeded={totalCredits ?? 0} creditBalance={creditBalance} />
    </section>
  );
}
