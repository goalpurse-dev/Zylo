import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUp, FileText, Loader2, RefreshCw } from "lucide-react";
import { EXAMPLE_IDEAS } from "../../../../supabase/functions/_shared/blockyWorlds/examples.js";
import { cardOf } from "../../../../supabase/functions/_shared/blockyWorlds/ideas.js";
import { ErrorBanner, FOCUS, PrimaryButton, SectionLabel, cx } from "../../ui/zyvo";
import { Clip } from "./LivePreview";
import { CLIPS } from "./clips";
import "../../onboarding/onboarding.css";
import "./blockyWorlds.css";

const QUICK_TOPICS = ["my cat", "homework", "the school bus", "grandma's cookies", "a haunted pool"];
const MOOD_TINT = { horror: "bg-violet-400/15 text-violet-200", wholesome: "bg-pink-400/15 text-pink-200", funny: "bg-yellow-300/15 text-yellow-200", epic: "bg-orange-400/15 text-orange-200" };
// signed out: our own sample cards, so the page is never empty (tapping one asks to sign up)
const SAMPLE_CARDS = EXAMPLE_IDEAS.map((idea, i) => cardOf(idea, `sample-${i}`));

/**
 * Step 1: the hero (the headline, "type your own world" and the clips), then the ideas, there as soon as the page opens.
 * More load as you scroll (the judged library only; past it, a tap on "More ideas"); the mood chips filter at once.
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
  const loading = flow.topicIdeas.status === "loading";
  const submit = (e) => { e?.preventDefault(); if (flow.topic.trim().length >= 2 && !loading) onGate(flow.askTopic); };
  const quick = (t) => { flow.setTopic(t); flow.setTab("idea"); };
  return (
    <section className="relative">
      <p className="ob-enter mb-3 inline-flex items-center gap-1.5 rounded-full border border-lime-300/25 bg-lime-300/[0.07] px-3 py-1 text-[10.5px] font-black uppercase tracking-[0.16em] text-lime-200">
        <span className="h-1.5 w-1.5 rounded-full bg-lime-300 shadow-[0_0_8px_#BEF264]" />Blocky Worlds
      </p>
      <h1 className="ob-enter text-[38px] font-black leading-[0.98] tracking-[-0.045em] text-white sm:text-[48px] xl:text-[56px]" style={{ animationDelay: "60ms" }}>
        Every story starts with <span className="bw-mark whitespace-nowrap">&ldquo;In this town&hellip;&rdquo;</span>
      </h1>
      <p className="ob-enter mt-3 max-w-[520px] text-[14.5px] font-medium leading-relaxed text-white/60" style={{ animationDelay: "120ms" }}>
        One absurd rule, one kid who breaks it. Pick a world or type your own: we write it, narrate it and build it in blocks.
      </p>

      <form onSubmit={submit} className="ob-enter bw-input-glow mt-5 flex items-center gap-2 rounded-[26px] border border-white/12 bg-[#0F1311]/90 py-2 pl-5 pr-2 backdrop-blur" style={{ animationDelay: "180ms" }}>
        <label htmlFor="bw-topic" className="sr-only">Your own world</label>
        <input id="bw-topic" maxLength={120} value={flow.topic} onChange={(e) => { flow.setTopic(e.target.value); if (own) flow.setTab("idea"); }}
          placeholder="Type your own world… my cat, homework, a haunted pool" autoComplete="off"
          className="min-w-0 flex-1 bg-transparent py-3 text-[16px] font-semibold text-white outline-none placeholder:text-white/30 sm:text-[17px]" />
        <button type="submit" aria-label="Turn it into worlds" disabled={flow.topic.trim().length < 2 || loading}
          className={cx("bw-press grid h-12 w-12 shrink-0 place-items-center rounded-full bg-lime-300 text-[#11150D] shadow-[0_0_24px_rgba(190,242,100,0.45)] transition disabled:bg-white/[0.08] disabled:text-white/30 disabled:shadow-none", FOCUS)}>
          {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <ArrowUp className="h-5 w-5" strokeWidth={3} aria-hidden="true" />}
        </button>
      </form>
      <div className="ob-enter mt-3 flex flex-wrap items-center gap-1.5" style={{ animationDelay: "240ms" }}>
        <span className="mr-1 text-[11.5px] font-bold text-white/35">Try</span>
        {QUICK_TOPICS.map((t) => (
          <button key={t} type="button" onClick={() => quick(t)} className={cx("bw-lift rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[12px] font-semibold text-white/70", FOCUS)}>{t}</button>
        ))}
        <button type="button" onClick={() => flow.setTab(own ? "idea" : "own")} className={cx("ml-auto flex items-center gap-1 rounded-full px-2 py-1 text-[12px] font-bold text-lime-200/80 transition hover:text-lime-200", FOCUS)}>
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />{own ? "Back to ideas" : "Paste my own script"}
        </button>
      </div>

      <ClipRow />
    </section>
  );
}

/** The row of looping clips under the input; they only play while the row is on screen. */
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
    <div ref={ref} className="-mx-1 mt-5 flex gap-3 overflow-x-auto px-1 pb-2 pt-1 [scrollbar-width:none]" aria-hidden="true">
      {CLIPS.map((c, i) => (
        <div key={c.key} className="ob-enter shrink-0" style={{ animationDelay: `${300 + i * 80}ms` }}>
          <div className="bw-bob relative aspect-[9/16] w-[96px] overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_18px_40px_-18px_rgba(0,0,0,0.9)] xl:w-[88px]" style={{ "--delay": `${-i * 1.3}s`, "--rot": `${[-2, 1.5, -1, 2][i]}deg` }}>
            <Clip clip={c.key} playing={inView} />
            <span className="bw-caption absolute inset-x-1 top-[60%] text-center text-[15px] leading-none [-webkit-text-stroke:3px_#0b0a12]">{c.word}</span>
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

function MoodChips({ flow }) {
  const moods = [{ id: null, label: "All" }, ...(flow.access?.moods ?? [])];
  return (
    <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Mood">
      {moods.map((m) => {
        const on = flow.mood === m.id;
        return (
          <button key={m.id ?? "any"} type="button" aria-pressed={on} onClick={() => flow.setMood(m.id)}
            className={cx("rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition", FOCUS, on ? "ob-pick border-lime-300 bg-lime-300 text-[#11150D] shadow-[0_0_20px_rgba(190,242,100,0.35)]" : "border-white/10 bg-white/[0.04] text-white/65 hover:border-white/25 hover:text-white")}>
            {m.label}
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
    <div className="grid gap-2.5 sm:grid-cols-2" aria-busy={loading}>
      {items.map((idea, i) => (
        <IdeaCard key={idea.id} idea={idea} index={i % 6} picked={idea.id === flow.pickedId} writing={idea.id === flow.pickedId && flow.busy === "writing"} disabled={Boolean(flow.busy)} onPick={() => pick(idea)} onPeek={onPeek} />
      ))}
      {loading && Array.from({ length: items.length ? 2 : skeletons }, (_, i) => (
        <div key={`s${i}`} className="bw-shimmer h-[150px] rounded-2xl border border-white/[0.06] bg-white/[0.03]" style={{ "--i": i }} />
      ))}
    </div>
  );
}

function IdeaCard({ idea, index, picked, writing, disabled, onPick, onPeek }) {
  return (
    <button type="button" aria-pressed={picked} disabled={disabled} onClick={onPick}
      onMouseEnter={() => onPeek?.(idea)} onMouseLeave={() => onPeek?.(null)} onFocus={() => onPeek?.(idea)} onBlur={() => onPeek?.(null)}
      style={{ "--i": index }}
      className={cx("bw-card-in bw-lift group relative flex min-h-[150px] flex-col gap-2 rounded-2xl border p-4 text-left disabled:cursor-wait", FOCUS,
        picked ? "ob-pick border-lime-300/70 bg-lime-300/[0.08] shadow-[0_0_30px_rgba(190,242,100,0.22)]" : "border-white/[0.08] bg-[#121614]/80",
        writing && "bw-shimmer")}>
      <span className="flex items-center justify-between gap-2">
        <span className={cx("text-[14px] font-black tracking-[-0.01em]", picked ? "text-lime-200" : "text-white")}>{idea.title}</span>
        <span className={cx("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide", MOOD_TINT[idea.mood] ?? "bg-white/10 text-white/60")}>{idea.moodLabel}</span>
      </span>
      <span className="text-[14.5px] font-bold leading-snug text-white/90">{idea.opener}</span>
      <span className="text-[12px] font-medium leading-relaxed text-white/45">{idea.teaser}</span>
      <span className={cx("mt-auto flex items-center gap-1 text-[11.5px] font-black transition", writing ? "text-lime-200" : "text-lime-300/0 group-hover:text-lime-300 group-focus-visible:text-lime-300")}>
        {writing ? <><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />Writing your script&hellip;</> : <>Write this story<ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden="true" /></>}
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
