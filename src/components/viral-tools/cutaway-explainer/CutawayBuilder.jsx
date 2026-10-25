import { useMemo, useRef, useState } from "react";
import { ArrowRight, BadgeCheck, Check, ChevronRight, Clock3, Hourglass, Layers, Loader2, Lock, PackageX, Sparkles, Volume2, VolumeX, X } from "lucide-react";
import { freshSuggestions } from "../../../data/cutawayTopics";
import { canRemoveEndCard, closestNames, DEFAULT_LENGTH, LENGTHS, PRICES, quoteTopic } from "./api/cutawayApi";
import CutawayUpgradeModal from "./CutawayUpgradeModal";
import { FailureDetails } from "./CutawayResults";

function CreditIcon({ className = "h-4 w-4" }) {
  return (
    <span
      aria-hidden="true"
      className={`${className} shrink-0 bg-current`}
      style={{ WebkitMaskImage: "url('/icons/credits.png')", maskImage: "url('/icons/credits.png')", WebkitMaskPosition: "center", maskPosition: "center", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskSize: "contain", maskSize: "contain" }}
    />
  );
}

/** A switch whose knob lands with a small overshoot. */
function Knob({ on, dim = false }) {
  return (
    <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${on ? "bg-cutaway" : "bg-white/15"} ${dim ? "opacity-50" : ""}`}>
      <span className={`cw-knob absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,.35)] ${on ? "translate-x-5" : ""}`} />
    </span>
  );
}

const PLAN_PILL = {
  free: { label: "Free plan", tone: "border-white/10 bg-white/[0.05] text-white/55" },
  starter: { label: "Starter", tone: "border-white/10 bg-white/[0.06] text-white/70" },
  affiliate: { label: "Affiliate", tone: "border-white/10 bg-white/[0.06] text-white/70" },
  pro: { label: "Pro", tone: "border-cutaway/30 bg-cutaway/10 text-cutaway" },
  generative: { label: "Generative", tone: "border-cutaway/30 bg-cutaway/10 text-cutaway" },
};

const waitText = (sec) => {
  if (!Number.isFinite(sec) || sec <= 0) return null;
  const m = Math.ceil(sec / 60);
  return m <= 1 ? "Try again in a minute." : m < 60 ? `Try again in about ${m} minutes.` : `Try again in about ${Math.round(m / 60)} h.`;
};

// access: "guest" (signed out: the button reads "Sign up to generate" and opens sign-up), "free" (Generate opens
// the upgrade popup), "paid" or "unknown" (Generate runs; the server checks the plan again on every call).
export default function CutawayBuilder({ values, onValuesChange, onGenerate, onReset, phase, historyMode = false, onDone, usedTopics = [], planCode = null, access = "unknown", onSignUp, onUpgrade, starting = false, notice = null, onDismissNotice, onShowRun, hero = null, approved = null }) {
  const topic = values?.topic ?? "";
  const lengthSec = values?.lengthSec ?? DEFAULT_LENGTH;
  const soundEffects = values?.soundEffects !== false;
  const canRemove = canRemoveEndCard(planCode);
  const removeWatermark = canRemove && values?.removeWatermark === true;
  // premade = an owner-approved layout (null while the list loads: no chips yet, prices as custom)
  // every approved premade topic, always (one already made, or the one picked, too: the owner's rule of 2026-10-25)
  const suggestions = useMemo(() => freshSuggestions([], 6, approved ?? []), [approved]);
  const [validationError, setValidationError] = useState("");
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [cantBuild, setCantBuild] = useState(null); // { topic, missing, closest } after the kit check said no
  const [lockNudge, setLockNudge] = useState(0); // the lock wiggles when a locked toggle is pressed
  const [ripples, setRipples] = useState([]);
  const pressRef = useRef(null);
  // The live price: premade (a chip, or a typed topic that names one) or custom, by the same rule the server charges by.
  const quote = useMemo(() => quoteTopic(topic, lengthSec, approved ?? []), [topic, lengthSec, approved]);
  const hasTopic = topic.trim().length >= 3;
  const credits = hasTopic ? quote.credits : PRICES.video.credits.premade[lengthSec];
  const kindLabel = !hasTopic ? null : quote.kind === "premade" ? "Premade topic" : "Custom topic";
  const isWorking = phase === "working";
  const isDone = phase === "done";
  const locked = historyMode || isWorking || starting;
  // a "can't build" from the page's own check, or from the server's (it asks Claude Haiku on unsure topics)
  const shownCantBuild = cantBuild ?? (notice?.kind === "CANT_BUILD" ? notice : null);
  const calm = notice && notice.kind !== "CANT_BUILD" ? notice : null;
  const pill = access === "guest" ? null : PLAN_PILL[String(planCode ?? "").toLowerCase()] ?? null;

  const update = (key, value) => { if (!historyMode) onValuesChange?.({ ...values, [key]: value }); };
  const pickTopic = (name) => { update("topic", name); setValidationError(""); setCantBuild(null); onDismissNotice?.(); };

  const ripple = (e) => {
    const r = pressRef.current?.getBoundingClientRect();
    if (!r) return;
    const id = Date.now();
    const x = e?.clientX ? e.clientX - r.left : r.width / 2, y = e?.clientY ? e.clientY - r.top : r.height / 2;
    setRipples((list) => [...list.slice(-2), { id, x, y }]);
    window.setTimeout(() => setRipples((list) => list.filter((p) => p.id !== id)), 700);
  };

  const handleGenerate = () => {
    if (access === "guest") { onSignUp?.(); return; }
    if (access === "free") { onUpgrade?.(); return; }
    const clean = topic.trim();
    if (clean.length < 3) { setValidationError("Type what the video should explain."); return; }
    setValidationError("");
    // The kit check, before anything is charged. "no" stops here; "unsure" goes on, and the server asks Claude
    // Haiku (~$0.0005, ours) before charging, so a topic it refuses is never paid for either.
    if (quote.kind === "custom" && quote.check.verdict === "no") { setCantBuild({ topic: clean, missing: quote.check.missing, closest: closestNames(quote.check.closest) }); return; }
    onGenerate({ topic: clean, lengthSec, soundEffects, removeWatermark });
  };

  return (
    <section className="relative flex min-h-[560px] flex-col overflow-hidden rounded-2xl border border-cutaway/[0.13] bg-[#0C0F0D] shadow-[inset_0_1px_0_rgba(74,222,128,.05)] lg:h-full lg:min-h-0">
      <div className={`shrink-0 border-b border-white/[0.06] px-5 py-4 transition lg:py-2.5 ${historyMode ? "opacity-[.55] grayscale" : ""}`}>
        <div className="flex items-center gap-2">
          <span className="relative grid h-8 w-8 place-items-center rounded-xl border border-cutaway/20 bg-cutaway/10">
            <Layers className="h-4 w-4 text-cutaway" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-[18px] font-black tracking-[-0.03em] text-white">Cutaway Explainer</h1>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cutaway/65">How things work, in one shot</p>
          </div>
          {pill && <span data-testid="cutaway-plan" className={`shrink-0 rounded-full border px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wide ${pill.tone}`}>{pill.label}</span>}
        </div>
      </div>

      {/* the content fades in when the builder comes back from the read-only summary (the fixed bar is a sibling) */}
      <div className={`cw-view min-h-0 flex-1 overflow-y-auto px-5 py-4 transition [scrollbar-width:thin] lg:py-3 ${historyMode ? "pointer-events-none opacity-[.55] grayscale" : ""}`}>
        <div className="flex flex-col gap-5 pb-[150px] lg:gap-4 lg:pb-0">
          {hero && <div className="-mx-1">{hero}</div>}

          {isWorking && (
            <button type="button" onClick={onShowRun} className="cw-fade-up cw-press flex items-center gap-3 rounded-2xl border border-cutaway/25 bg-cutaway/[0.07] px-3.5 py-3 text-left lg:hidden">
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-cutaway motion-reduce:animate-none" />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-black text-white">Your video is being made</span>
                <span className="block text-[11px] font-medium text-white/45">Watch it come together on the Result tab.</span>
              </span>
              <ArrowRight className="h-4 w-4 text-cutaway" />
            </button>
          )}

          <div style={{ "--d": "40ms" }} className="cw-fade-up">
            <label htmlFor="cutaway-topic" className="mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.12em] text-white/40 lg:mb-1.5">
              Topic
              <span className={`text-[10px] font-semibold normal-case tracking-normal tabular-nums transition-opacity ${topic.length > 90 ? "text-white/45 opacity-100" : "opacity-0"}`}>{topic.length}/120</span>
            </label>
            <div className="group relative">
              {/* focus glow: an opacity fade, not an animated shadow */}
              <span aria-hidden="true" className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 shadow-[0_0_0_1px_rgba(74,222,128,.45),0_0_28px_rgba(74,222,128,.18)] transition-opacity duration-200 group-focus-within:opacity-100" />
              <textarea
                id="cutaway-topic"
                value={topic}
                onChange={(e) => { update("topic", e.target.value); setValidationError(""); setCantBuild(null); onDismissNotice?.(); }}
                disabled={locked}
                maxLength={120}
                rows={3}
                placeholder="What should the video explain? e.g. septic tank"
                className={`relative h-[96px] w-full resize-none rounded-2xl border bg-[#111315] px-4 py-3 text-[14px] leading-relaxed text-white outline-none transition-colors placeholder:text-white/25 disabled:opacity-60 ${validationError ? "cw-shake border-red-400/50" : "border-white/[0.08] focus:border-cutaway/35"}`}
              />
            </div>
            <p className="mb-1.5 mt-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/30">Premade topics</p>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s, i) => {
                const picked = quote.kind === "premade" && quote.premade === s.key;
                return (
                  <button
                    key={s.topic}
                    type="button"
                    title={`If you ${s.hook}…`}
                    aria-pressed={picked}
                    onClick={() => pickTopic(s.topic)}
                    disabled={locked}
                    style={{ "--d": `${80 + i * 35}ms` }}
                    className={`cw-press cw-pop flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold ${picked ? "border-cutaway/50 bg-cutaway/15 text-cutaway shadow-[0_0_18px_rgba(74,222,128,.15)]" : "border-white/[0.08] bg-white/[0.04] text-white/55 hover:border-cutaway/25 hover:text-white/80"}`}
                  >
                    {picked ? <Check key="on" className="cw-pop h-3 w-3" strokeWidth={3} /> : s.ready && <span className="h-1.5 w-1.5 rounded-full bg-cutaway" aria-label="ready" />}
                    {s.topic}
                  </button>
                );
              })}
            </div>
            {shownCantBuild && (
              <div role="status" className="cw-fade-up mt-3 rounded-xl border border-[#F5C042]/25 bg-[#F5C042]/[0.06] px-3 py-2.5">
                <p className="flex items-center gap-1.5 text-[12px] font-black text-[#F5C042]"><PackageX className="h-4 w-4" />We can't build this one yet</p>
                <p className="mt-1 text-[11px] font-medium leading-relaxed text-white/55">
                  “{shownCantBuild.topic}” needs parts our 3D kit doesn't have yet{shownCantBuild.missing?.length ? ` (${shownCantBuild.missing.join(", ")})` : ""}. You weren't charged, and we've noted it for the next parts we build.
                </p>
                {shownCantBuild.closest?.length > 0 && (
                  <>
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-white/35">Closest premade topics</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {shownCantBuild.closest.map((name, i) => (
                        <button key={name} type="button" style={{ "--d": `${60 + i * 50}ms` }} onClick={() => pickTopic(name)} className="cw-press cw-pop rounded-full border border-cutaway/30 bg-cutaway/10 px-2.5 py-1 text-[11px] font-bold text-cutaway hover:bg-cutaway/20">
                          {name}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div style={{ "--d": "90ms" }} className="cw-fade-up">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-white/40 lg:mb-1.5">Length</p>
            <div className="relative grid grid-cols-2 gap-1 rounded-xl border border-white/[0.07] bg-[#0E1012] p-1">
              <span aria-hidden="true" className={`cw-thumb absolute inset-y-1 left-1 w-[calc(50%-6px)] rounded-lg bg-white shadow-[0_4px_14px_rgba(0,0,0,.3)] ${lengthSec === LENGTHS[1] ? "translate-x-[calc(100%+4px)]" : ""}`} />
              {LENGTHS.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={lengthSec === s}
                  onClick={() => update("lengthSec", s)}
                  disabled={locked}
                  className={`relative flex items-center justify-center gap-1.5 rounded-lg px-1 py-2.5 text-[12px] font-bold transition-colors duration-200 active:scale-[.97] ${lengthSec === s ? "text-black" : "text-white/45 hover:text-white/75"}`}
                >
                  <Clock3 className="h-3.5 w-3.5" />{s} seconds
                </button>
              ))}
            </div>
          </div>

          <div style={{ "--d": "130ms" }} className="cw-fade-up">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-white/40 lg:mb-1.5">Sound effects</p>
            <button
              id="cutaway-sfx"
              type="button"
              role="switch"
              aria-checked={soundEffects}
              onClick={() => update("soundEffects", !soundEffects)}
              disabled={locked}
              className={`cw-press flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left ${soundEffects ? "border-cutaway/35 bg-cutaway/[0.08]" : "border-white/[0.07] bg-white/[0.035]"}`}
            >
              <span className="flex min-w-0 items-center gap-2 text-[12px] font-bold text-white/80">
                {soundEffects ? <Volume2 key="on" className="cw-pop h-4 w-4 shrink-0 text-cutaway" /> : <VolumeX key="off" className="cw-pop h-4 w-4 shrink-0 text-white/40" />}
                {soundEffects ? "On: digging, drips, engines and a chime on each name" : "Off: voice only"}
              </span>
              <Knob on={soundEffects} />
            </button>
          </div>

          <div style={{ "--d": "170ms" }} className="cw-fade-up">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-white/40 lg:mb-1.5">Watermark</p>
            <button
              id="cutaway-watermark"
              type="button"
              role="switch"
              aria-checked={removeWatermark}
              aria-disabled={!canRemove}
              onClick={() => { if (canRemove) update("removeWatermark", !removeWatermark); else { setLockNudge((n) => n + 1); setUpgradeOpen(true); } }}
              disabled={locked}
              className={`cw-press flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left ${removeWatermark ? "border-cutaway/35 bg-cutaway/[0.08]" : "border-white/[0.07] bg-white/[0.035]"}`}
            >
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-[12px] font-bold text-white/80">
                  {canRemove ? <BadgeCheck className={`h-4 w-4 ${removeWatermark ? "text-cutaway" : "text-white/40"}`} /> : <Lock key={lockNudge} className={`h-4 w-4 text-white/45 ${lockNudge ? "cw-wiggle" : ""}`} />}
                  Remove watermark
                  {!canRemove && <span className="cw-sheen rounded-full bg-gradient-to-r from-[#F5C042]/25 to-[#F5C042]/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#F5C042]">Pro</span>}
                </span>
                <span className="mt-0.5 block text-[10.5px] font-semibold text-white/35">{removeWatermark ? "No end card: the video ends on “Congratulations”." : "Ends with a 2 s “Make videos like this with Zyvo” sign."}</span>
              </span>
              <Knob on={removeWatermark} dim={!canRemove} />
            </button>
          </div>

          <div style={{ "--d": "210ms" }} className="cw-fade-up rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-2.5">
            <p className="text-[11px] font-bold text-white/75">How it works</p>
            <ol className="mt-1.5 space-y-1 text-[11px] font-medium leading-relaxed text-white/45">
              <li><span className="font-bold text-cutaway/80">1.</span> Script: a fact-checked script and an energetic voiceover.</li>
              <li><span className="font-bold text-cutaway/80">2.</span> Scene: the 3D cutaway is built, and every part appears on its word.</li>
              <li><span className="font-bold text-cutaway/80">3.</span> Render: one continuous vertical video with captions and sound.</li>
            </ol>
            <p className="mt-2 text-[10.5px] font-semibold text-white/35">
              {lengthSec} s video: {PRICES.video.credits.premade[lengthSec]} credits for a premade topic, {PRICES.video.credits.custom[lengthSec]} for a custom one. Charged once, when it starts; back in full if it fails.
            </p>
          </div>
        </div>
      </div>

      <div className="fixed bottom-[calc(72px+env(safe-area-inset-bottom))] left-0 right-0 z-[90] border-t border-white/[0.07] bg-[#0C0F0D]/95 px-5 pb-2 pt-3 backdrop-blur-xl lg:static lg:shrink-0 lg:bg-[#0C0F0D] lg:pb-3 lg:pt-2.5">
        {validationError && <p className="cw-fade-up mb-2 text-center text-[11px] font-semibold text-red-400">{validationError}</p>}
        {calm && (
          <div role="status" className="cw-fade-up mb-2 flex items-start gap-2.5 rounded-xl border border-white/[0.09] bg-white/[0.04] px-3 py-2.5">
            <Hourglass className="mt-0.5 h-4 w-4 shrink-0 text-cutaway/80" />
            <div className="min-w-0 flex-1 text-[11.5px] font-medium leading-snug text-white/70">
              <p>{calm.message}{waitText(calm.retryAfterSec) && <span className="text-white/45"> {waitText(calm.retryAfterSec)}</span>}</p>
              <span className="mt-0.5 block text-[10.5px] text-white/35">Nothing was charged.</span>
              {calm.debug && <FailureDetails debug={calm.debug} />}
            </div>
            <button type="button" onClick={onDismissNotice} aria-label="Dismiss" className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-white/35 transition hover:bg-white/10 hover:text-white/70"><X className="h-3.5 w-3.5" /></button>
          </div>
        )}
        <button
          ref={pressRef}
          type="button"
          data-testid="cutaway-generate"
          onPointerDown={(e) => { if (!isWorking && !starting) ripple(e); }}
          onClick={historyMode ? onDone : isDone ? onReset : handleGenerate}
          disabled={isWorking || starting}
          aria-busy={starting || undefined}
          className={`cw-press relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl py-3.5 text-[14px] font-black lg:py-2.5 ${starting ? "cw-sheen cursor-wait bg-cutaway text-cutaway-ink" : isWorking ? "cursor-not-allowed bg-cutaway/15 text-cutaway/50" : isDone ? "border border-white/10 bg-white/[0.05] text-white/70 hover:bg-white/[0.08]" : "bg-cutaway text-cutaway-ink shadow-[0_10px_30px_-8px_rgba(74,222,128,.55)] hover:bg-cutaway-soft"}`}
        >
          {ripples.map((p) => <span key={p.id} aria-hidden="true" className="cw-ripple" style={{ left: p.x, top: p.y }} />)}
          {historyMode ? "Done" : starting ? <>
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />Starting your video…
          </> : isWorking ? <>
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />Making your video…
          </> : isDone ? "Create another" : access === "guest" ? <>
            Sign up to generate
            <ChevronRight className="h-4 w-4" />
          </> : <>
            {access === "free" ? <Sparkles className="h-4 w-4" /> : null}
            Generate
            {kindLabel && <span data-testid="cutaway-kind" className="rounded-full bg-cutaway-ink/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide">{kindLabel}</span>}
            <span className="flex items-center gap-1 text-[13px] font-semibold"><CreditIcon /><span key={credits} className="cw-tick tabular-nums">{credits}</span></span>
            <ChevronRight className="h-4 w-4" />
          </>}
        </button>
        {access === "guest" && !historyMode && <p className="mt-1.5 text-center text-[10.5px] font-medium text-white/35">Free to join. Watch the examples first, no account needed.</p>}
        {access === "free" && !historyMode && !isDone && <p className="mt-1.5 text-center text-[10.5px] font-medium text-white/35">Cutaway Explainer is on Starter and above.</p>}
      </div>
      <CutawayUpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </section>
  );
}
