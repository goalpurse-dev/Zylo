import { useEffect, useRef } from "react";
import { ArrowUp, ChevronRight, FileText, Loader2, RefreshCw } from "lucide-react";
import { EXAMPLE_IDEAS } from "../../../../supabase/functions/_shared/blockyWorlds/examples.js";
import { cardOf } from "../../../../supabase/functions/_shared/blockyWorlds/ideas.js";
import { fittingWithSwap } from "../../../../supabase/functions/_shared/blockyWorlds/boardFit.js";
import { BOARD_SAMPLE_IDEAS } from "./boardSamples";
import { ErrorBanner, FOCUS, SectionLabel, cx } from "../../ui/zyvo";
import { ActionBar, ActionButton, StepBody } from "./StepShell";
import { worldArt } from "./worldArt";
import "./blockyWorlds.css";

const QUICK_TOPICS = ["my cat", "homework", "the school bus", "a haunted pool"];
// signed out: our own sample cards, so the page is never empty (tapping one asks to sign up); in the board-only launch
// mode only the ones the board kit can film (boardFit.js, the same check as the library filter)
const SAMPLE_CARDS = EXAMPLE_IDEAS.map((idea, i) => cardOf(idea, `sample-${i}`));
// (only 2 of the 6 examples fit, so six judged live library ideas that fit come first: boardSamples.js)
const BOARD_SAMPLE_CARDS = [
  ...BOARD_SAMPLE_IDEAS.map((idea, i) => cardOf(idea, `board-sample-${i}`)),
  ...fittingWithSwap(EXAMPLE_IDEAS).map((idea, i) => cardOf(idea, `sample-fit-${i}`)),
];

/**
 * Step 1 (the Cartoon Drive By layout: one calm panel, the action pinned at the bottom): the headline, the prompt bar,
 * then the ideas, there as soon as the page opens (more as you scroll; mood chips filter at once). Type your own idea
 * and Continue: the AI turns it into a story. Tapping an idea card puts it into the bar; Continue writes it.
 */
export default function StoryStep({ flow, onGate, onPeek }) {
  const own = flow.tab === "own";
  const ready = flow.topic.trim().length >= 2;
  const go = () => ready && onGate(flow.continueStory, { write: true });
  const selected = flow.picked;
  const onSelect = (idea) => flow.pickIdea(idea);
  return (
    <>
      <StepBody>
        <Hero flow={flow} onContinue={go} />
        {own ? <OwnScript flow={flow} /> : (
          <>
            {/* only after Continue made the worlds but couldn't write the script: they can be picked from here */}
            {flow.topicIdeas.status === "ready" && flow.topicIdeas.items.length > 0 && (
              <section className="bw-step-in">
                <Heading title="Worlds from your idea" />
                <IdeaList items={flow.topicIdeas.items} loading={false} skeletons={0} flow={flow} selected={selected} onSelect={onSelect} onPeek={onPeek} />
              </section>
            )}
            <Ideas flow={flow} onGate={onGate} onPeek={onPeek} selected={selected} onSelect={onSelect} />
          </>
        )}
      </StepBody>
      <ActionBar>
        {own ? (
          <ActionButton busy={flow.busy === "saving" ? "Checking your script…" : null} disabled={flow.ownText.trim().length < 20} onClick={() => onGate(flow.saveOwn, { write: true })}>
            Continue<ChevronRight className="h-4 w-4" />
          </ActionButton>
        ) : (
          <ActionButton busy={flow.busy === "turning" ? "Turning your idea into a story…" : flow.busy === "writing" ? "Writing your story…" : null} disabled={!ready || Boolean(flow.busy)} onClick={go}>
            Continue<ChevronRight className="h-4 w-4 shrink-0" />
          </ActionButton>
        )}
      </ActionBar>
    </>
  );
}

function Hero({ flow, onContinue }) {
  const own = flow.tab === "own";
  const loading = flow.busy === "turning" || flow.busy === "writing";
  const ready = flow.topic.trim().length >= 2;
  const submit = (e) => { e?.preventDefault(); if (ready && !loading) onContinue(); };
  return (
    <section>
      <h1 className="text-[34px] font-black leading-[1.02] tracking-[-0.045em] text-white sm:text-[40px]">
        Every story<br className="sm:hidden" /> starts with<br className="hidden sm:block" /> <span className="bw-mark whitespace-nowrap">&ldquo;In this town&hellip;&rdquo;</span>
      </h1>
      <p className="mt-3 text-[13.5px] font-medium leading-snug text-white/50">One absurd rule, one kid who breaks it. We write it, narrate it and build it in blocks.</p>

      <form onSubmit={submit} className="mt-5 flex items-end gap-2 rounded-2xl border border-white/[0.08] bg-[#111315] py-1.5 pl-4 pr-1.5 transition focus-within:border-lime-300/35 focus-within:ring-1 focus-within:ring-lime-300/30">
        <label htmlFor="bw-topic" className="sr-only">Your idea: type a world, or tap an idea below</label>
        <textarea id="bw-topic" rows={1} maxLength={200} value={flow.topic} autoComplete="off" placeholder="Type your own idea…"
          onChange={(e) => { flow.setTopic(e.target.value.replace(/\s*\n\s*/g, " ")); if (own) flow.setTab("idea"); }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) submit(e); }}
          style={{ fieldSizing: "content" }}
          className="max-h-[120px] min-w-0 flex-1 resize-none bg-transparent py-2 text-[15px] font-semibold leading-snug text-white outline-none placeholder:text-white/25" />
        <button type="submit" aria-label="Continue" disabled={!ready || loading}
          className={cx("bw-press grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-lime-300 text-[#11150D] transition hover:bg-lime-200 disabled:bg-white/[0.06] disabled:text-white/25", FOCUS)}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowUp className="h-4 w-4" strokeWidth={3} aria-hidden="true" />}
        </button>
      </form>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {QUICK_TOPICS.map((t) => (
          <button key={t} type="button" onClick={() => { flow.setTopic(t); flow.setTab("idea"); }}
            className={cx("rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold text-white/45 transition hover:border-lime-300/25 hover:text-white/75", FOCUS)}>{t}</button>
        ))}
        <button type="button" onClick={() => flow.setTab(own ? "idea" : "own")} className={cx("ml-auto flex items-center gap-1 px-1 py-1 text-[11px] font-semibold text-white/40 transition hover:text-lime-200", FOCUS)}>
          <FileText className="h-3 w-3" aria-hidden="true" />{own ? "Back to ideas" : "Paste my own script"}
        </button>
      </div>
      {flow.access?.film?.length > 0 && <CanFilm items={flow.access.film} />}
    </section>
  );
}

/**
 * The board-only launch mode: "What we can film", under the topic box. The list comes from the server (boardFit.js
 * canFilm: generated from the kit manifest, never written here), so it grows with the kit. Hover / long-press: the detail.
 */
function CanFilm({ items }) {
  return (
    <div className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5" data-testid="bw-can-film">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">What we can film</p>
      <ul className="mt-1.5 flex flex-wrap gap-1" aria-label="What we can film">
        {items.map((x) => (
          <li key={x.id} title={x.what} className="rounded-full border border-lime-300/15 bg-lime-300/[0.05] px-2 py-0.5 text-[10.5px] font-semibold text-lime-100/75">{x.label}</li>
        ))}
      </ul>
      <p className="mt-1.5 text-[10.5px] leading-snug text-white/35">An idea that needs something else is moved into our town, keeping your rule.</p>
    </div>
  );
}

function Heading({ title, action }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/40">{title}</h2>
      {action}
    </div>
  );
}

function MoreButton({ loading, disabled, onClick, label = "More ideas" }) {
  return (
    <button type="button" onClick={onClick} disabled={loading || disabled} className={cx("flex items-center gap-1 text-[11px] font-semibold text-white/40 transition hover:text-lime-200 disabled:opacity-40", FOCUS)}>
      <RefreshCw className={cx("h-3 w-3", loading && "animate-spin motion-reduce:animate-none")} aria-hidden="true" />{label}
    </button>
  );
}

function MoodChips({ flow }) {
  const moods = [{ id: null, label: "All" }, ...(flow.access?.moods ?? [])];
  return (
    <div className="mb-3 grid grid-cols-5 gap-1 rounded-xl border border-white/[0.07] bg-[#0E1012] p-1" role="group" aria-label="Mood">
      {moods.map((m) => {
        const on = flow.mood === m.id;
        return (
          <button key={m.id ?? "any"} type="button" aria-pressed={on} onClick={() => flow.setMood(m.id)}
            className={cx("rounded-lg py-1.5 text-[11.5px] font-bold transition", FOCUS, on ? "bg-white/[0.09] text-white" : "text-white/40 hover:text-white/70")}>
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

/** "Ideas for you": loaded on open, filtered by mood at once, more as the user scrolls. */
function Ideas({ flow, onGate, onPeek, selected, onSelect }) {
  const signedIn = Boolean(flow.access?.signedIn);
  const { ideas } = flow;
  const samples = flow.access?.launch === "board" ? BOARD_SAMPLE_CARDS : SAMPLE_CARDS;
  const items = signedIn ? flow.shownIdeas : samples.filter((i) => !flow.mood || i.mood === flow.mood);
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
      <IdeaList items={items} loading={loading} skeletons={signedIn ? 5 : 0} flow={flow} selected={selected} onSelect={signedIn ? onSelect : () => onGate(() => {})} onPeek={onPeek} />
      {ideas.status === "error" && <div className="mt-3"><ErrorBanner action="Try again" onAction={more}>{ideas.error || "We couldn't get more ideas just now. Try again, or type your own world."}</ErrorBanner></div>}
      {signedIn && !loading && ideas.status !== "error" && !items.length && <p className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-5 text-center text-[12.5px] text-white/50">No {flow.access?.moods?.find((m) => m.id === flow.mood)?.label.toLowerCase()} ideas left today. Try another mood, or type your own world.</p>}
      <div ref={sentinel} className="h-px" />
      {signedIn && ideas.libraryDone && items.length > 0 && <div className="mt-3 flex justify-center"><MoreButton loading={loading} disabled={Boolean(flow.busy)} onClick={more} /></div>}
      {!signedIn && <p className="mt-3 text-center text-[11.5px] text-white/40">Sign up free to get fresh ideas every day.</p>}
    </section>
  );
}

function IdeaList({ items, loading, skeletons, flow, selected, onSelect, onPeek }) {
  return (
    <div className="flex flex-col gap-2" aria-busy={loading}>
      {items.map((idea, i) => (
        <IdeaCard key={idea.id} idea={idea} index={i % 6} selected={idea.id === selected?.id} writing={idea.id === flow.pickedId && flow.busy === "writing"} disabled={Boolean(flow.busy)} onSelect={() => onSelect(idea)} onPeek={onPeek} />
      ))}
      {loading && Array.from({ length: items.length ? 2 : skeletons }, (_, i) => (
        <div key={`s${i}`} className="bw-shimmer h-[86px] rounded-xl border border-white/[0.06] bg-white/[0.025]" />
      ))}
    </div>
  );
}

/** "In this town," in lime, the rule in white: the hook reads at a glance. */
function Opener({ text }) {
  const m = /^(In this (?:world|town),)\s*(.*)$/i.exec(text ?? "");
  if (!m) return text;
  return <><span className="text-lime-300/90">{m[1]}</span> {m[2]}</>;
}

/** An idea: its world icon, its title (the mood quietly beside it) and its first line. Nothing else. */
function IdeaCard({ idea, index, selected, writing, disabled, onSelect, onPeek }) {
  const art = worldArt(idea);
  return (
    <button type="button" aria-pressed={selected} disabled={disabled} onClick={onSelect}
      onMouseEnter={() => onPeek?.(idea)} onMouseLeave={() => onPeek?.(null)}
      style={{ "--i": index }}
      className={cx("bw-card-in bw-lift group flex items-start gap-3.5 rounded-xl border px-3.5 py-3.5 text-left disabled:cursor-wait", FOCUS,
        selected ? "border-lime-300/45 bg-lime-300/[0.07]" : "border-white/[0.07] bg-white/[0.025] hover:border-white/15 hover:bg-white/[0.04]",
        writing && "bw-shimmer")}>
      <span className={cx("grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-[22px]", art.style.tile)} aria-hidden="true">{art.emoji}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-baseline gap-2">
          <span className={cx("truncate text-[14px] font-black tracking-[-0.01em]", selected ? "text-lime-200" : "text-white")}>{idea.title}</span>
          <span className="shrink-0 text-[10.5px] font-semibold text-white/30">{idea.moodLabel}</span>
        </span>
        <span className="text-[13px] font-semibold leading-snug text-white/75"><Opener text={idea.opener} /></span>
      </span>
    </button>
  );
}

function OwnScript({ flow }) {
  const words = flow.ownText.trim().split(/\s+/).filter(Boolean).length;
  return (
    <section className="bw-step-in">
      <SectionLabel htmlFor="bw-own" hint={`${words} words`}>Paste your script</SectionLabel>
      <textarea id="bw-own" rows={12} maxLength={12000} value={flow.ownText} onChange={(e) => flow.setOwnText(e.target.value)}
        placeholder={"In this town, nobody whistles after sunset.\nYou see, if you whistle in the dark, something whistles back..."}
        className="min-h-[260px] w-full resize-y rounded-2xl border border-white/[0.08] bg-[#111315] px-4 py-3 text-[14px] leading-relaxed text-white outline-none transition placeholder:text-white/20 focus:border-lime-300/35 focus:ring-1 focus:ring-lime-300/30" />
      <p className="mt-2 text-[11px] leading-relaxed text-white/35">It must start with &ldquo;In this town, &rdquo;. We check it and can fix the first line for you.</p>
    </section>
  );
}
