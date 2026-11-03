import { RefreshCw, Sparkles } from "lucide-react";
import { ErrorBanner, FOCUS, OptionChip, PrimaryButton, SectionLabel, SegmentedControl, cx } from "../../ui/zyvo";

const INPUT =
  "w-full rounded-2xl border border-white/[0.08] bg-[#111315] px-4 py-3 text-[14px] leading-relaxed text-white outline-none transition placeholder:text-white/20 focus:border-lime-300/35 focus:ring-1 focus:ring-lime-300/30";
const TABS = [
  { value: "idea", label: "Pick an idea" },
  { value: "topic", label: "Your topic" },
  { value: "own", label: "My own script" },
];

/** Step 1: pick an idea from the library, turn a topic into ideas, or paste a finished script (same layout as Blocky Stories). */
export default function StoryStep({ flow, onGate }) {
  const { tab, setTab, access } = flow;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-[18px] font-black tracking-[-0.02em] text-white">What&apos;s the world?</h2>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-white/50">Every video starts with &ldquo;In this world&hellip;&rdquo; or &ldquo;In this town&hellip;&rdquo; and one absurd rule.</p>
      </div>
      <SegmentedControl ariaLabel="How do you want to start?" options={TABS} value={tab} onChange={setTab} />
      <MoodChips flow={flow} />
      {tab === "idea" && <IdeaList state={flow.ideas} pickedId={flow.pickedId} busy={flow.busy} onAsk={() => onGate(flow.askIdeas)} onMore={() => onGate(() => flow.askIdeas({ more: true }))} onPick={(i) => onGate(() => flow.writeFromIdea(i.id), { write: true })} />}
      {tab === "topic" && (
        <>
          <div>
            <SectionLabel htmlFor="bw-topic" hint={`${flow.topic.length} / 120`}>Your topic</SectionLabel>
            <input id="bw-topic" maxLength={120} value={flow.topic} onChange={(e) => flow.setTopic(e.target.value)} placeholder="e.g. homework, my cat, a haunted swimming pool" className={INPUT} />
            <p className="mt-2 text-[10px] leading-relaxed text-white/30">We turn it into three outrageous world rules. Pick one and we write the whole story.</p>
          </div>
          {flow.topicIdeas.status === "idle" ? (
            <PrimaryButton disabled={flow.topic.trim().length < 2} onClick={() => onGate(flow.askTopic)}>Turn it into ideas</PrimaryButton>
          ) : (
            <IdeaList state={flow.topicIdeas} pickedId={flow.pickedId} busy={flow.busy} onMore={() => onGate(flow.askTopic)} moreLabel="Three new ones" onPick={(i) => onGate(() => flow.writeFromIdea(i.id), { write: true })} />
          )}
        </>
      )}
      {tab === "own" && (
        <>
          <div>
            <SectionLabel htmlFor="bw-own" hint={`${flow.ownText.trim().split(/\s+/).filter(Boolean).length} words`}>Paste your script</SectionLabel>
            <textarea id="bw-own" rows={9} maxLength={12000} value={flow.ownText} onChange={(e) => flow.setOwnText(e.target.value)} placeholder={"In this town, nobody whistles after sunset.\nYou see, if you whistle in the dark, something whistles back..."} className={cx(INPUT, "min-h-[200px] resize-y")} />
            <p className="mt-2 text-[10px] leading-relaxed text-white/30">It must start with &ldquo;In this world, &rdquo; or &ldquo;In this town, &rdquo;. We check it and can fix the first line for you.</p>
          </div>
          <PrimaryButton busy={flow.busy === "saving" ? "Checking" : undefined} disabled={flow.ownText.trim().length < 20 || access?.canWrite === false && access?.signedIn} onClick={() => onGate(flow.saveOwn, { write: true })}>Check my script</PrimaryButton>
        </>
      )}
    </div>
  );
}

function MoodChips({ flow }) {
  const moods = [{ id: null, label: "Any mood" }, ...(flow.access?.moods ?? [])];
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Mood">
      {moods.map((m) => (
        <OptionChip key={m.id ?? "any"} shape="pill" selected={flow.mood === m.id} onClick={() => flow.setMood(m.id)}>{m.label}</OptionChip>
      ))}
    </div>
  );
}

function IdeaList({ state, pickedId, busy, onAsk, onMore, onPick, moreLabel = "More ideas" }) {
  if (state.status === "idle") {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-white/[0.07] bg-white/[0.035] px-4 py-4">
        <p className="text-[12.5px] font-medium leading-relaxed text-white/65">Six outrageous worlds, each a different kind of story. Tap one and we write the whole script.</p>
        <PrimaryButton onClick={onAsk}><Sparkles className="mr-1.5 inline h-4 w-4" aria-hidden="true" />Give me ideas</PrimaryButton>
        <p className="text-center text-[10px] font-semibold leading-relaxed text-white/35">Ideas are free.</p>
      </div>
    );
  }
  return (
    <div>
      <div className="mb-2 flex items-end justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/40">Ideas for you</p>
        <button type="button" onClick={onMore} disabled={state.status === "loading" || Boolean(busy)} className={cx("flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[10px] font-bold text-white/45 transition hover:text-lime-300 disabled:opacity-40", FOCUS)}>
          <RefreshCw className={cx("h-3 w-3", state.status === "loading" && "animate-spin motion-reduce:animate-none")} aria-hidden="true" />
          {moreLabel}
        </button>
      </div>
      {state.status === "error" ? (
        <ErrorBanner action="Try again" onAction={onMore}>{state.error || "We couldn't get ideas just now. Try again, or type your own topic."}</ErrorBanner>
      ) : state.status === "loading" && !state.items.length ? (
        <div className="flex flex-col gap-1.5" aria-label="Thinking of ideas">
          {Array.from({ length: 4 }, (_, i) => <div key={i} className="h-[110px] animate-pulse rounded-xl border border-white/[0.07] bg-white/[0.035] motion-reduce:animate-none" />)}
        </div>
      ) : (
        <div className={cx("flex flex-col gap-1.5 transition-opacity", state.status === "loading" && "opacity-50")}>
          {state.items.map((idea) => {
            const picked = idea.id === pickedId, writing = picked && busy === "writing";
            return (
              <button key={idea.id} type="button" aria-pressed={picked} disabled={Boolean(busy)} onClick={() => onPick(idea)}
                className={cx("flex flex-col gap-1 rounded-xl border px-3 py-2.5 text-left transition disabled:cursor-wait", FOCUS,
                  picked ? "border-lime-300/45 bg-lime-300/[0.09]" : "border-white/[0.07] bg-white/[0.035] hover:border-lime-300/25 hover:bg-white/[0.055]")}>
                <span className="flex items-center justify-between gap-2">
                  <span className={cx("text-[13px] font-black", picked ? "text-lime-300" : "text-white")}>{idea.title}</span>
                  <span className="shrink-0 rounded-md bg-white/[0.07] px-1.5 py-0.5 text-[9.5px] font-black uppercase tracking-wide text-white/55">{idea.moodLabel}</span>
                </span>
                <span className="text-[12.5px] font-semibold leading-snug text-white/85">{idea.opener}</span>
                <span className="text-[11px] font-medium leading-relaxed text-white/45">{idea.teaser}</span>
                {writing && <span className="text-[10.5px] font-bold text-lime-300">Writing your script&hellip;</span>}
              </button>
            );
          })}
        </div>
      )}
      <p className="mt-2 text-[10px] leading-relaxed text-white/30">Tap one and we write the whole script. You can edit every line before making the video.</p>
    </div>
  );
}
