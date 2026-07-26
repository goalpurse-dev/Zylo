import { useEffect, useState } from "react";
import { WandSparkles } from "lucide-react";
import { useProfileCredits } from "../../../hooks/useProfileCredits";
import NoCreditsModal from "../shared/NoCreditsModal";
import { TWO_AM_TOTAL_CREDITS } from "./api/twoAmApi";
import TwoAmAdvancedSettings from "./TwoAmAdvancedSettings";

const PLACEHOLDERS = ["Pokémon Alola", "Kai from Ninjago", "Naruto Shippuden", "Hogwarts", "SpongeBob Bikini Bottom", "GTA Vice City"];
export default function TwoAmGenerator({ phase, initialPrompt = "", onGenerate, onRequestAuth }) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [animatedPlaceholder, setAnimatedPlaceholder] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [noCreditsOpen, setNoCreditsOpen] = useState(false);
  const [settings, setSettings] = useState({ style: "auto", nostalgia: 0.7, customInstructions: "" });
  const creditBalance = useProfileCredits();
  const busy = phase === "planning" || phase === "generating";

  useEffect(() => {
    let timer;
    let wordIndex = 0;
    let characterIndex = 0;
    let deleting = false;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      const word = PLACEHOLDERS[wordIndex];

      if (!deleting) {
        characterIndex += 1;
        setAnimatedPlaceholder(word.slice(0, characterIndex));
        if (characterIndex === word.length) {
          deleting = true;
          timer = setTimeout(tick, 1350);
        } else {
          timer = setTimeout(tick, 72 + Math.random() * 38);
        }
        return;
      }

      characterIndex -= 1;
      setAnimatedPlaceholder(word.slice(0, characterIndex));
      if (characterIndex === 0) {
        deleting = false;
        wordIndex = (wordIndex + 1) % PLACEHOLDERS.length;
        timer = setTimeout(tick, 360);
      } else {
        timer = setTimeout(tick, 38);
      }
    };

    timer = setTimeout(tick, 450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const submit = () => {
    if (!prompt.trim()) { setValidationError("Enter a world, character, series or idea."); return; }
    if (onRequestAuth?.()) return;
    if (creditBalance < TWO_AM_TOTAL_CREDITS) { setNoCreditsOpen(true); return; }
    setValidationError("");
    onGenerate({ prompt: prompt.trim(), settings });
  };

  return (
    <>
      <section className="two-am-lime-panel relative flex flex-col overflow-hidden rounded-2xl border border-lime-300/[0.13] bg-[#0C0F0D] shadow-[inset_0_1px_0_rgba(190,242,100,.05)] lg:h-full">
        <div className="pointer-events-none absolute -left-24 top-12 h-56 w-56 rounded-full bg-lime-300/[0.055] blur-[70px]" />
        <div className="pointer-events-none absolute -right-24 bottom-16 h-52 w-52 rounded-full bg-lime-500/[0.045] blur-[72px]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.055] [background-image:linear-gradient(rgba(190,242,100,.35)_1px,transparent_1px),linear-gradient(90deg,rgba(190,242,100,.35)_1px,transparent_1px)] [background-size:34px_34px] [mask-image:linear-gradient(to_bottom,black,transparent_68%)]" />
        <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-lime-300/70 to-transparent" />

        <header className="relative z-[1] border-b border-lime-300/[0.08] px-5 pb-5 pt-5">
          <div className="flex items-center gap-3">
            <div className="relative grid h-[52px] w-[52px] shrink-0 place-items-center overflow-hidden rounded-2xl border border-lime-300/35 bg-gradient-to-br from-lime-300/15 via-[#121910] to-[#08130C] shadow-[0_0_26px_rgba(190,242,100,.14)]">
              <img
                src="/template/2am-world/preview.png"
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <h1 className="text-[19px] font-black tracking-tight text-white">2AM In...</h1>
              <p className="mt-1 max-w-[310px] text-[11px] leading-relaxed text-white/40">Turn any world, character, anime, game or movie into a nostalgic 2AM slideshow.</p>
            </div>
          </div>
        </header>

        <div className="relative z-[1] flex-1 space-y-4 px-5 pb-[150px] pt-5 lg:min-h-0 lg:overflow-y-auto lg:py-5">
          <div>
            <label htmlFor="two-am-prompt" className="mb-2 block text-[12px] font-bold text-white/80">Where are you at 2AM?</label>
            <div className="relative">
              {!prompt && (
                <div className="pointer-events-none absolute left-4 top-1/2 z-[1] flex -translate-y-1/2 items-center text-[14px] font-medium text-white/25">
                  <span>{animatedPlaceholder}</span>
                  <span className="ml-px inline-block h-[17px] w-[1.5px] animate-pulse bg-lime-300/70" />
                </div>
              )}
              <input
                id="two-am-prompt"
                value={prompt}
                maxLength={240}
                disabled={busy}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") submit(); }}
                aria-placeholder={animatedPlaceholder}
                className="w-full rounded-2xl border border-lime-300/[0.12] bg-[#080B09]/90 px-4 py-3.5 pr-12 text-[14px] font-medium text-white outline-none transition focus:border-lime-300/55 focus:ring-2 focus:ring-lime-300/10 disabled:opacity-60"
              />
              <WandSparkles className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-lime-300" />
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-white/30">Enter a world, series, season, location, character or idea.</p>
          </div>

          <TwoAmAdvancedSettings open={advancedOpen} onToggle={() => setAdvancedOpen((value) => !value)} settings={settings} onChange={setSettings} />
        </div>

        <footer className="fixed bottom-[calc(72px+env(safe-area-inset-bottom))] left-0 right-0 z-[95] border-t border-lime-300/[0.08] bg-[#0C0F0D]/95 px-5 pb-2 pt-3 backdrop-blur-xl lg:static lg:z-10 lg:shrink-0 lg:bg-transparent lg:px-5 lg:py-4 lg:backdrop-blur-0">
          {validationError && <p className="mb-2 text-center text-[11px] font-semibold text-red-400">{validationError}</p>}
          {creditBalance < TWO_AM_TOTAL_CREDITS && !busy && <p className="mb-2 text-center text-[10px] font-medium text-orange-300/80">You have {creditBalance} credits · {TWO_AM_TOTAL_CREDITS} needed</p>}
          <button type="button" disabled={busy} onClick={submit} className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl border border-lime-400/20 bg-gradient-to-r from-lime-300/[0.10] to-lime-500/[0.07] py-3.5 text-[14px] font-black text-white shadow-[inset_0_1px_0_rgba(217,249,157,.04),0_10px_30px_rgba(0,0,0,.16)] transition hover:border-lime-400/35 hover:from-lime-300/[0.14] hover:to-lime-500/[0.10] hover:shadow-[inset_0_1px_0_rgba(217,249,157,.06),0_12px_34px_rgba(132,204,22,.08)] disabled:cursor-not-allowed disabled:opacity-45">
            <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-lime-200/10 blur-md transition-transform duration-700 group-hover:translate-x-[420%]" />
            {busy ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-lime-300" />Creating your night...</> : <>
              Generate 6 Images
              <span className="ml-1 flex items-center gap-1.5 rounded-full border border-lime-400/20 bg-gradient-to-r from-lime-300/[0.10] to-lime-500/[0.07] px-2.5 py-1 text-[12px] font-semibold text-lime-300 shadow-[inset_0_1px_0_rgba(217,249,157,.04)]">
                <span
                  aria-hidden="true"
                  className="h-3.5 w-3.5 shrink-0 bg-lime-300"
                  style={{
                    WebkitMaskImage: "url('/icons/credits.png')",
                    maskImage: "url('/icons/credits.png')",
                    WebkitMaskPosition: "center",
                    maskPosition: "center",
                    WebkitMaskRepeat: "no-repeat",
                    maskRepeat: "no-repeat",
                    WebkitMaskSize: "contain",
                    maskSize: "contain",
                  }}
                />
                {TWO_AM_TOTAL_CREDITS}
              </span>
            </>}
          </button>
        </footer>
      </section>
      <NoCreditsModal open={noCreditsOpen} onClose={() => setNoCreditsOpen(false)} creditsNeeded={TWO_AM_TOTAL_CREDITS} creditBalance={creditBalance} />
    </>
  );
}
