import { useEffect, useRef, useState } from "react";
import { ArrowRight, FileText, Loader2, RefreshCw, Sparkles, Zap } from "lucide-react";
import { EXAMPLE_IDEAS } from "../../../../supabase/functions/_shared/blockyWorlds/examples.js";
import { cardOf } from "../../../../supabase/functions/_shared/blockyWorlds/ideas.js";
import { ErrorBanner, FOCUS, PrimaryButton, SectionLabel, cx } from "../../ui/zyvo";
import { Clip } from "./LivePreview";
import { CLIPS, useReducedMotion } from "./clips";
import { worldArt } from "./worldArt";
import "../../onboarding/onboarding.css";
import "./blockyWorlds.css";

const QUICK_TOPICS = ["my cat", "homework", "the school bus", "grandma's cookies", "a haunted pool"];
// the engine's placeholder types these out one after another while the box is empty
const TYPED = ["my cat", "homework", "the school bus", "a haunted swimming pool", "grandma's cookies", "the last day of summer"];
// signed out: our own sample cards, so the page is never empty (tapping one asks to sign up)
const SAMPLE_CARDS = EXAMPLE_IDEAS.map((idea, i) => cardOf(idea, `sample-${i}`));

/**
 * Step 1: the hero (the headline and the story engine: type any topic, get worlds), then the ideas, there as soon as the
 * page opens. More load as you scroll (the judged library only; past it, a tap on "More ideas"); mood chips filter at once.
 */
export default function StoryStep({ flow, onGate, onPeek }) {
  const own = flow.tab === "own";
  return (
    <div className="flex flex-col gap-6 pb-6">
      <Hero flow={flow} onGate={onGate} />
      {own ? <OwnScript flow={flow} onGate={onGate} /> : (
        <>
          {flow.topicIdeas.status !== "idle" && (
            <section className="ob-enter">
              <Heading title={<>Worlds from &ldquo;{flow.topic.trim()}&rdquo;</>} action={<MoreButton loading={flow.topicIdeas.status === "loading"} disabled={Boolean(flow.busy)} onClick={() => onGate(flow.askTopic)} label="Three new ones" />} />
              {flow.topicIdeas.status === "error"
                ? <ErrorBanner action="Try again" onAction={() => onGate(flow.askTopic)}>{flow.topicIdeas.error || "We couldn't turn that into ideas just now."}</ErrorBanner>
                : <IdeaGrid items={flow.topicIdeas.items} loading={flow.topicIdeas.status === "loading"} skeletons={3} flow={flow} onGate={onGate} onPeek={onPeek} />}
            </section>
          )}
          <Ideas flow={flow} onGate={onGate} onPeek={onPeek} />
        </>
      )}
    </div>
  );
}

function Hero({ flow, onGate }) {
  const own = flow.tab === "own";
  const quick = (t) => { flow.setTopic(t); flow.setTab("idea"); document.getElementById("bw-topic")?.focus(); };
  return (
    <section className="relative">
      <div className="flex items-start gap-6">
        <div className="min-w-0 flex-1">
          <p className="ob-enter mb-2.5 inline-flex items-center lg:hidden gap-1.5 rounded-full border border-lime-300/25 bg-lime-300/[0.07] px-3 py-1 text-[10.5px] font-black uppercase tracking-[0.16em] text-lime-200">
            <span className="h-1.5 w-1.5 rounded-full bg-lime-300 shadow-[0_0_8px_#BEF264]" />Blocky Worlds
          </p>
          <h1 className="ob-enter text-[34px] font-black leading-[1.02] tracking-[-0.045em] text-white sm:text-[42px] xl:text-[46px]" style={{ animationDelay: "60ms" }}>
            Every story<br className="sm:hidden" /> starts with<br className="hidden sm:block" /> <span className="bw-mark whitespace-nowrap">&ldquo;In this town&hellip;&rdquo;</span>
          </h1>
          <p className="ob-enter mt-3 max-w-[520px] text-[14px] font-medium leading-snug text-white/55" style={{ animationDelay: "120ms" }}>
            One absurd rule, one kid who breaks it. We write it, narrate it and build it in blocks.
          </p>
        </div>
        <ClipFan />
      </div>

      <Engine flow={flow} onGate={onGate} ownToggle={
        <button type="button" onClick={() => flow.setTab(own ? "idea" : "own")} className={cx("ml-auto flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-bold text-lime-200/75 transition hover:text-lime-200", FOCUS)}>
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />{own ? "Back to ideas" : "Paste my own script"}
        </button>
      } />

      <div className="ob-enter mt-2.5 flex flex-wrap items-center gap-1.5" style={{ animationDelay: "240ms" }}>
        <span className="mr-1 text-[11.5px] font-bold text-white/35">Try</span>
        {QUICK_TOPICS.map((t) => (
          <button key={t} type="button" onClick={() => quick(t)} className={cx("bw-lift rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[12px] font-semibold text-white/70", FOCUS)}>{t}</button>
        ))}
      </div>
      <ClipRow />
    </section>
  );
}

/** The placeholder typing out example topics, a letter at a time, while the box is empty and not focused. */
function useTypedPlaceholder(active) {
  const still = useReducedMotion();
  const [state, setState] = useState({ word: 0, n: 0, back: false });
  useEffect(() => {
    if (!active || still) return undefined;
    const full = TYPED[state.word];
    const t = setTimeout(() => setState((s) => {
      if (!s.back && s.n < full.length) return { ...s, n: s.n + 1 };
      if (!s.back) return { ...s, back: true };
      if (s.n > 0) return { ...s, n: s.n - 1 };
      return { word: (s.word + 1) % TYPED.length, n: 0, back: false };
    }), !state.back && state.n === full.length ? 1400 : state.back ? 35 : 75);
    return () => clearTimeout(t);
  }, [active, still, state]);
  return still ? TYPED[0] : TYPED[state.word].slice(0, state.n);
}

/**
 * The story engine: the page's one big input. Any topic becomes three worlds; pick one and it becomes a script, then a
 * narrated video. A turning lime ring round it, the example topics typing themselves, a button that says what it does.
 */
function Engine({ flow, onGate, ownToggle }) {
  const [focused, setFocused] = useState(false);
  const loading = flow.topicIdeas.status === "loading";
  const ready = flow.topic.trim().length >= 2;
  const typed = useTypedPlaceholder(!flow.topic && !focused);
  const submit = (e) => { e?.preventDefault(); if (ready && !loading) onGate(flow.askTopic); };
  return (
    <form onSubmit={submit} className="ob-enter bw-engine mt-4 rounded-[28px] p-[1.5px]" style={{ animationDelay: "180ms" }}>
      <div className="relative rounded-[27px] bg-[#0D110E] px-4 pb-3 pt-3 sm:px-5">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-lime-300 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#11150D]"><Zap className="h-3 w-3" strokeWidth={3} aria-hidden="true" />Story engine</span>
          <span className="hidden truncate text-[11.5px] font-semibold text-white/45 sm:inline">Any topic &rarr; three worlds &rarr; a script &rarr; a narrated video</span>
          {ownToggle}
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="bw-topic" className="sr-only">Type your own world</label>
          <div className="relative min-w-0 flex-1">
            <input id="bw-topic" maxLength={120} value={flow.topic} autoComplete="off"
              onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
              onChange={(e) => { flow.setTopic(e.target.value); if (flow.tab === "own") flow.setTab("idea"); }}
              placeholder={focused ? "Type your own world…" : ""}
              className="w-full bg-transparent py-2.5 text-[18px] font-bold text-white outline-none placeholder:text-white/30 sm:text-[20px]" />
            {!flow.topic && !focused && (
              <span className="pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-nowrap text-[18px] font-bold text-white/35 sm:text-[20px]" aria-hidden="true">
                <span className="mr-1.5 hidden sm:inline">Type your own world:</span><span className="text-lime-200/80">{typed}</span><span className="bw-caret" />
              </span>
            )}
          </div>
          <button type="submit" disabled={!ready || loading}
            className={cx("bw-press flex h-12 shrink-0 items-center gap-1.5 rounded-full px-4 text-[14px] font-black transition sm:px-5", FOCUS,
              ready && !loading ? "bw-sweep ob-cta-pulse bg-lime-300 text-[#11150D]" : "bg-lime-300/15 text-lime-200/60")}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
            <span className="hidden sm:inline">{loading ? "Building…" : "Build my world"}</span><span className="sm:hidden">{loading ? "…" : "Build"}</span>
          </button>
        </div>
      </div>
    </form>
  );
}

/** Desktop: three clips fanned out beside the headline (no extra height). They play while on screen. */
function ClipFan() {
  return (
    <div className="ob-enter relative hidden h-[150px] w-[176px] shrink-0 lg:block" style={{ animationDelay: "200ms" }} aria-hidden="true">
      {CLIPS.slice(0, 3).map((c, i) => (
        <div key={c.key} className="bw-bob absolute top-0 aspect-[9/16] w-[84px] overflow-hidden rounded-2xl border border-white/15 bg-black shadow-[0_18px_40px_-14px_rgba(0,0,0,0.9)]"
          style={{ left: `${i * 44}px`, top: `${[10, 0, 12][i]}px`, zIndex: i === 1 ? 2 : 1, "--delay": `${-i * 1.4}s`, "--rot": `${[-8, 0, 8][i]}deg` }}>
          <Clip clip={c.key} />
          <span className="bw-caption absolute inset-x-1 top-[58%] text-center text-[14px] leading-none [-webkit-text-stroke:3px_#0b0a12]">{c.word}</span>
        </div>
      ))}
    </div>
  );
}

/** Phones and narrow screens: the clips as a row under the engine; they only play while the row is on screen. */
function ClipRow() {
  const ref = useRef(null);
  const [inView, setInView] = useState(true);
  useEffect(() => {
    if (!ref.current || typeof IntersectionObserver === "undefined") return undefined;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.2 });
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className="-mx-1 mt-4 flex gap-2.5 overflow-x-auto px-1 pb-1 pt-1 [scrollbar-width:none] lg:hidden" aria-hidden="true">
      {CLIPS.map((c, i) => (
        <div key={c.key} className="ob-enter shrink-0" style={{ animationDelay: `${300 + i * 80}ms` }}>
          <div className="bw-bob relative aspect-[9/16] w-[84px] overflow-hidden rounded-2xl border border-white/10 bg-black" style={{ "--delay": `${-i * 1.3}s`, "--rot": `${[-2, 1.5, -1, 2][i]}deg` }}>
            <Clip clip={c.key} playing={inView} />
            <span className="bw-caption absolute inset-x-1 top-[60%] text-center text-[13px] leading-none [-webkit-text-stroke:3px_#0b0a12]">{c.word}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function Heading({ title, action }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="text-[19px] font-black tracking-[-0.02em] text-white">{title}</h2>
      {action}
    </div>
  );
}

function MoreButton({ loading, disabled, onClick, label = "More ideas" }) {
  return (
    <button type="button" onClick={onClick} disabled={loading || disabled} className={cx("flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-[11.5px] font-bold text-white/60 transition hover:border-lime-300/40 hover:text-lime-200 disabled:opacity-40", FOCUS)}>
      <RefreshCw className={cx("h-3.5 w-3.5", loading && "animate-spin motion-reduce:animate-none")} aria-hidden="true" />{label}
    </button>
  );
}

const MOOD_EMOJI = { horror: "👻", wholesome: "💛", funny: "😂", epic: "⚔️" };

function MoodChips({ flow }) {
  const moods = [{ id: null, label: "All" }, ...(flow.access?.moods ?? [])];
  return (
    <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Mood">
      {moods.map((m) => {
        const on = flow.mood === m.id;
        return (
          <button key={m.id ?? "any"} type="button" aria-pressed={on} onClick={() => flow.setMood(m.id)}
            className={cx("flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition", FOCUS, on ? "ob-pick border-lime-300 bg-lime-300 text-[#11150D] shadow-[0_0_20px_rgba(190,242,100,0.35)]" : "border-white/10 bg-white/[0.04] text-white/65 hover:border-white/25 hover:text-white")}>
            {m.id && <span aria-hidden="true">{MOOD_EMOJI[m.id]}</span>}{m.label}
          </button>
        );
      })}
    </div>
  );
}

/** "Ideas for you": loaded on open, filtered by mood at once, more as the user scrolls. */
function Ideas({ flow, onGate, onPeek }) {
  const signedIn = Boolean(flow.access?.signedIn);
  const { ideas } = flow;
  const items = signedIn ? flow.shownIdeas : SAMPLE_CARDS.filter((i) => !flow.mood || i.mood === flow.mood);
  const loading = ideas.status === "loading";
  const more = () => onGate(() => flow.askIdeas({ more: true }));

  // the bottom of the list coming into view loads the next batch (the judged library only: no cost, no daily limit)
  const sentinel = useRef(null);
  const canAuto = signedIn && ideas.status === "ready" && !ideas.libraryDone;
  const askIdeas = flow.askIdeas;
  useEffect(() => {
    if (!canAuto || !sentinel.current || typeof IntersectionObserver === "undefined") return undefined;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) askIdeas({ more: true }); }, { rootMargin: "320px 0px" });
    io.observe(sentinel.current);
    return () => io.disconnect();
  }, [canAuto, askIdeas]);

  return (
    <section>
      <Heading title="Ideas for you" action={signedIn && <MoreButton loading={loading} disabled={Boolean(flow.busy)} onClick={more} />} />
      <MoodChips flow={flow} />
      <IdeaGrid items={items} loading={loading} skeletons={signedIn ? 6 : 0} flow={flow} onGate={onGate} onPeek={onPeek} />
      {ideas.status === "error" && <div className="mt-3"><ErrorBanner action="Try again" onAction={more}>{ideas.error || "We couldn't get more ideas just now. Try again, or type your own world."}</ErrorBanner></div>}
      {signedIn && !loading && ideas.status !== "error" && !items.length && <p className="rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-5 text-center text-[13px] text-white/55">No {flow.access?.moods?.find((m) => m.id === flow.mood)?.label.toLowerCase()} ideas left today. Try another mood, or type your own world.</p>}
      <div ref={sentinel} className="h-px" />
      {signedIn && ideas.libraryDone && items.length > 0 && <div className="mt-4 flex justify-center"><MoreButton loading={loading} disabled={Boolean(flow.busy)} onClick={more} /></div>}
      {!signedIn && <p className="mt-3 text-center text-[12px] text-white/45">Sign up free to get fresh ideas every day.</p>}
    </section>
  );
}

function IdeaGrid({ items, loading, skeletons, flow, onGate, onPeek }) {
  const pick = (idea) => onGate(() => flow.writeFromIdea(idea.id), { write: true });
  return (
    <div className="grid gap-3 sm:grid-cols-2" aria-busy={loading}>
      {items.map((idea, i) => (
        <IdeaCard key={idea.id} idea={idea} index={i % 6} picked={idea.id === flow.pickedId} writing={idea.id === flow.pickedId && flow.busy === "writing"} disabled={Boolean(flow.busy)} onPick={() => pick(idea)} onPeek={onPeek} />
      ))}
      {loading && Array.from({ length: items.length ? 2 : skeletons }, (_, i) => (
        <div key={`s${i}`} className="bw-shimmer h-[168px] rounded-[22px] border border-white/[0.06] bg-white/[0.03]" style={{ "--i": i }} />
      ))}
    </div>
  );
}

/** "In this town," in lime, the rule in white: the hook reads at a glance. */
function Opener({ text }) {
  const m = /^(In this (?:world|town),)\s*(.*)$/i.exec(text ?? "");
  if (!m) return text;
  return <><span className="text-lime-300">{m[1]}</span> {m[2]}</>;
}

function IdeaCard({ idea, index, picked, writing, disabled, onPick, onPeek }) {
  const art = worldArt(idea);
  return (
    <button type="button" aria-pressed={picked} disabled={disabled} onClick={onPick}
      onMouseEnter={() => onPeek?.(idea)} onMouseLeave={() => onPeek?.(null)} onFocus={() => onPeek?.(idea)} onBlur={() => onPeek?.(null)}
      style={{ "--i": index }}
      className={cx("bw-card-in bw-lift group relative flex min-h-[168px] gap-3.5 overflow-hidden rounded-[22px] border p-4 text-left disabled:cursor-wait", FOCUS,
        picked ? "ob-pick border-lime-300/70 bg-lime-300/[0.08] shadow-[0_0_30px_rgba(190,242,100,0.22)]" : "border-white/[0.08] bg-[#111512]/85",
        writing && "bw-shimmer")}>
      {/* the mood's glow in the corner */}
      <span className={cx("pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full blur-2xl transition-opacity duration-300 group-hover:opacity-100", art.style.glow, picked ? "opacity-100" : "opacity-60")} aria-hidden="true" />
      {/* the world tile: the idea's thing on the mood's colours, a blocky checker, the setting as a badge */}
      <span className={cx("bw-tile bw-checker relative grid h-[64px] w-[64px] shrink-0 place-items-center rounded-[18px] bg-gradient-to-br text-[34px] shadow-[inset_0_-6px_0_rgba(0,0,0,0.18),0_10px_24px_-10px_rgba(0,0,0,0.8)]", art.style.tile)} aria-hidden="true">
        <span className="relative z-[1] drop-shadow-[0_3px_0_rgba(0,0,0,0.25)]">{art.emoji}</span>
        {art.place && <span className="absolute -bottom-1.5 -right-1.5 z-[1] grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-[#0D100E] text-[14px]">{art.place.emoji}</span>}
      </span>
      <span className="relative flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex items-center justify-between gap-2">
          <span className={cx("truncate text-[15px] font-black tracking-[-0.01em]", picked ? "text-lime-200" : "text-white")}>{idea.title}</span>
          <span className={cx("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide", art.style.pill)}>{idea.moodLabel}</span>
        </span>
        <span className="text-[14px] font-bold leading-snug text-white/90"><Opener text={idea.opener} /></span>
        <span className="text-[12px] font-medium italic leading-relaxed text-white/45">&ldquo;{idea.teaser}&rdquo;</span>
        <span className="mt-auto flex items-center justify-between gap-2 pt-1">
          {art.place ? <span className="truncate text-[10.5px] font-bold uppercase tracking-[0.1em] text-white/30">{art.place.label}</span> : <span />}
          <span className={cx("flex shrink-0 items-center gap-1 text-[11.5px] font-black transition", writing ? "text-lime-200" : "text-lime-300/0 group-hover:text-lime-300 group-focus-visible:text-lime-300")}>
            {writing ? <><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />Writing your script&hellip;</> : <>Write this story<ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden="true" /></>}
          </span>
        </span>
      </span>
    </button>
  );
}

function OwnScript({ flow, onGate }) {
  const words = flow.ownText.trim().split(/\s+/).filter(Boolean).length;
  return (
    <section className="bw-step-in flex flex-col gap-3">
      <div>
        <SectionLabel htmlFor="bw-own" hint={`${words} words`}>Paste your script</SectionLabel>
        <textarea id="bw-own" rows={10} maxLength={12000} value={flow.ownText} onChange={(e) => flow.setOwnText(e.target.value)}
          placeholder={"In this town, nobody whistles after sunset.\nYou see, if you whistle in the dark, something whistles back..."}
          className="bw-input-glow min-h-[240px] w-full resize-y rounded-[22px] border border-white/10 bg-[#0F1311]/90 px-5 py-4 text-[14.5px] leading-relaxed text-white outline-none placeholder:text-white/25" />
        <p className="mt-2 text-[11px] leading-relaxed text-white/35">It must start with &ldquo;In this world, &rdquo; or &ldquo;In this town, &rdquo;. We check it and can fix the first line for you.</p>
      </div>
      <PrimaryButton busy={flow.busy === "saving" ? "Checking" : undefined} disabled={flow.ownText.trim().length < 20} onClick={() => onGate(flow.saveOwn, { write: true })}>Check my script</PrimaryButton>
    </section>
  );
}
